// Envoie les rappels du soir sur les téléphones :
// le ménage quand des tâches sont à faire, et le virement du mois le 1er puis tous les 3 jours tant qu'il n'est pas coché.
// Ce script tourne sur GitHub et ses journaux sont publics : il n'y affiche jamais un nom, une tâche ni un montant.
import admin from 'firebase-admin';
import { createRequire } from 'module';
const exiger = createRequire(import.meta.url);
const P = exiger('../planning.js');
const { virement } = exiger('../calcul-budget.js');

const cle = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!cle) { console.error('Secret FIREBASE_SERVICE_ACCOUNT manquant'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(cle)) });
const db = admin.firestore();

// Heure de Paris (TZ=Europe/Paris dans la tâche). GitHub lance la tâche deux fois vers 17h45,
// une pour l'heure d'été et une pour l'heure d'hiver : on n'envoie qu'entre 17h30 et 20h, une seule fois par jour.
const manuel = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
const maintenant = new Date();
const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
if (!manuel && (minutes < 17 * 60 + 30 || minutes > 20 * 60)) { console.log('Pas la bonne heure, rien à faire.'); process.exit(0); }
const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
const jourIso = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`;
const reglage = db.doc('reglages/rappel');
if (!manuel && ((await reglage.get()).data() || {}).dernierEnvoi === jourIso) { console.log('Rappel déjà envoyé aujourd\'hui.'); process.exit(0); }
// On attend 18h00 pile si on est en avance
const attente = new Date(aujourdhui); attente.setHours(18, 0, 0, 0);
if (!manuel && attente - Date.now() > 0) { console.log('Attente de 18h00.'); await new Promise(r => setTimeout(r, attente - Date.now())); }
const messages = [];

// 1. Le ménage
const docs = (await db.collection('menage').get()).docs;
const tous = Object.fromEntries(docs.map(d => [d.id, d.data()]));
const taches = Object.values(tous);
const dans = t => P.dans(t, aujourdhui, tous);
const jamais = t => !t.dernier && !t.apres && !(Array.isArray(t.joursSemaine) && t.joursSemaine.length);
const aFaire = taches.filter(t => !jamais(t) && dans(t) <= 0).sort((a, b) => dans(a) - dans(b));
const vac = (await db.doc('reglages/vacances').get()).data() || {};
if (aFaire.length && !vac.actif) {
  const noms = aFaire.map(t => t.nom);
  messages.push({
    tag: 'menage', url: './menage.html',
    title: noms.length === 1 ? 'Une chose à faire ce soir' : `${noms.length} choses à faire`,
    body: noms.length <= 3 ? noms.join(', ') : `${noms.slice(0, 3).join(', ')} et ${noms.length - 3} autre${noms.length - 3 > 1 ? 's' : ''}`
  });
}

// 2. Le virement : le 1er du mois, puis le 4, le 7, etc. tant qu'il n'est pas coché
const jourDuMois = aujourdhui.getDate();
if (manuel || (jourDuMois - 1) % 3 === 0) {
  const cleMois = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const main = (await db.doc('budget/main').get()).data();
  const mois = (await db.doc(`mois/${cleMois(aujourdhui)}`).get()).data() || {};
  const precedent = (await db.doc(`mois/${cleMois(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1))}`).get()).data() || {};
  if (main && !mois.vire) {
    const v = virement(main, mois, precedent);
    if (v.montant >= 0.01) {
      const noms = { a: main.personnes?.a || 'Personne A', b: main.personnes?.b || 'Personne B' };
      const nomMois = aujourdhui.toLocaleDateString('fr-FR', { month: 'long' });
      const euros = (Math.round(v.montant * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
      messages.push({
        tag: 'virement', url: './',
        title: `Le virement ${/^[aeiouy]/.test(nomMois) ? 'd’' : 'de '}${nomMois}`,
        body: `${noms[v.de]} vire ${euros} à ${noms[v.vers]}. Pensez à le cocher une fois fait.`
      });
    }
  }
}

if (!messages.length) { console.log('Rien à rappeler ce soir.'); process.exit(0); }

const appareils = await db.collection('appareils').get();
const jetons = appareils.docs.map(d => d.id);
if (!jetons.length) { console.log('Aucun téléphone inscrit.'); process.exit(0); }

let ok = 0, ko = 0;
const morts = new Set();
for (const m of messages) {
  const rep = await admin.messaging().sendEachForMulticast({
    tokens: jetons,
    data: m,
    webpush: { headers: { Urgency: 'high', TTL: '43200' } }
  });
  ok += rep.successCount; ko += rep.failureCount;
  rep.responses.forEach((r, i) => {
    const code = r.error && r.error.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') morts.add(jetons[i]);
  });
}
// On oublie les téléphones qui ne répondent plus (appli supprimée, notifications coupées)
await Promise.all([...morts].map(j => db.collection('appareils').doc(j).delete()));
if (!manuel) await reglage.set({ dernierEnvoi: jourIso }, { merge: true });
console.log(`${messages.length} rappel(s) envoyé(s) : ${ok} réussi(s), ${ko} échec(s), ${morts.size} téléphone(s) retiré(s).`);
