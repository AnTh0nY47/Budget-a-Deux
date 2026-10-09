// Envoie les rappels sur les téléphones, deux fois par jour :
// à midi, le ménage du jour ; à 18h, le ménage qui reste, et le virement du mois le 1er puis tous les 3 jours tant qu'il n'est pas coché.
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

// Heure de Paris (TZ=Europe/Paris dans la tâche). GitHub lance la tâche deux fois avant chaque rappel,
// une pour l'heure d'été et une pour l'heure d'hiver : on garde le bon créneau, on attend l'heure pile,
// et chaque rappel n'est envoyé qu'une fois par jour.
const CRENEAUX = { midi: { heure: 12, de: 11 * 60 + 30, a: 13 * 60 + 30 }, soir: { heure: 18, de: 17 * 60 + 30, a: 20 * 60 } };
const manuel = process.env.GITHUB_EVENT_NAME === 'workflow_dispatch';
const maintenant = new Date();
const minutes = maintenant.getHours() * 60 + maintenant.getMinutes();
let creneau = Object.keys(CRENEAUX).find(k => minutes >= CRENEAUX[k].de && minutes <= CRENEAUX[k].a);
if (manuel) creneau = minutes < 15 * 60 ? 'midi' : 'soir';
if (!creneau) { console.log('Pas la bonne heure, rien à faire.'); process.exit(0); }
const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0);
const jourIso = `${aujourdhui.getFullYear()}-${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(aujourdhui.getDate()).padStart(2, '0')}`;
const reglage = db.doc('reglages/rappel');
const champ = creneau === 'soir' ? 'dernierEnvoi' : 'dernierEnvoiMidi';
if (!manuel && ((await reglage.get()).data() || {})[champ] === jourIso) { console.log('Rappel déjà envoyé pour ce créneau.'); process.exit(0); }
// On attend l'heure pile si on est en avance
const attente = new Date(aujourdhui); attente.setHours(CRENEAUX[creneau].heure, 0, 0, 0);
if (!manuel && attente - Date.now() > 0) { console.log('Attente de l\'heure du rappel.'); await new Promise(r => setTimeout(r, attente - Date.now())); }
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
    title: creneau === 'midi'
      ? (noms.length === 1 ? 'Une chose à faire aujourd’hui' : `${noms.length} choses à faire aujourd’hui`)
      : (noms.length === 1 ? 'Encore une chose à faire ce soir' : `Encore ${noms.length} choses à faire ce soir`),
    body: noms.length <= 3 ? noms.join(', ') : `${noms.slice(0, 3).join(', ')} et ${noms.length - 3} autre${noms.length - 3 > 1 ? 's' : ''}`
  });
}

// 2. Le virement : le 1er du mois, puis le 4, le 7, etc. tant qu'il n'est pas coché
const jourDuMois = aujourdhui.getDate();
if (creneau === 'soir' && (manuel || (jourDuMois - 1) % 3 === 0)) {
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

// 3. Le défi du mois
{
  const finMois = new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + 1, 0).getDate();
  const dernierJour = aujourdhui.getDate() === finMois && creneau === 'soir';
  const premierJour = aujourdhui.getDate() === 1 && creneau === 'midi';
  if (dernierJour || premierJour || manuel) {
    const cible = premierJour ? new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1) : new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1);
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const debut = iso(cible), fin = iso(new Date(cible.getFullYear(), cible.getMonth() + 1, 1));
    const hist = (await db.collection('menage_historique').where('jour', '>=', debut).where('jour', '<', fin).get()).docs.map(d => d.data());
    const sc = P.scores(hist, tous, cible.getFullYear(), cible.getMonth());
    if (sc.a + sc.b > 0) {
      const main = (await db.doc('budget/main').get()).data() || {};
      const noms = { a: main.personnes?.a || 'Personne A', b: main.personnes?.b || 'Personne B' };
      const defi = (await db.doc(`defis/${debut.slice(0, 7)}`).get()).data() || {};
      const nomMois = cible.toLocaleDateString('fr-FR', { month: 'long' });
      const g = sc.gagnant, perdant = g === 'a' ? 'b' : 'a';
      if (premierJour || (manuel && !dernierJour && aujourdhui.getDate() <= 3)) {
        messages.push({ tag: 'defi', url: './menage.html', title: `Le défi ${/^[aeiouy]/.test(nomMois) ? 'd’' : 'de '}${nomMois}`,
          body: g ? `${noms[g]} gagne ${sc[g]} à ${sc[perdant]} !${defi.gage ? ` Gage pour ${noms[perdant]} : ${defi.gage}` : ''}` : `Égalité parfaite, ${sc.a} partout.` });
      } else {
        messages.push({ tag: 'defi', url: './menage.html', title: 'Dernier jour du défi',
          body: g ? `${noms[g]} mène ${sc[g]} à ${sc[perdant]}. ${noms[perdant]}, c’est le moment de faire une tâche !` : `Égalité, ${sc.a} partout. Tout se joue ce soir !` });
      }
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
if (!manuel) await reglage.set({ [champ]: jourIso }, { merge: true });
console.log(`${messages.length} rappel(s) envoyé(s) : ${ok} réussi(s), ${ko} échec(s), ${morts.size} téléphone(s) retiré(s).`);
