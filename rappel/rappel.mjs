// Envoie le rappel du soir sur les téléphones quand des tâches de ménage sont à faire.
// Ce script tourne sur GitHub et ses journaux sont publics : il n'y affiche jamais le nom d'une tâche.
import admin from 'firebase-admin';
import { createRequire } from 'module';
const P = createRequire(import.meta.url)('../planning.js');

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
const docs = (await db.collection('menage').get()).docs;
const tous = Object.fromEntries(docs.map(d => [d.id, d.data()]));
const taches = Object.values(tous);
const dans = t => P.dans(t, aujourdhui, tous);
const jamais = t => !t.dernier && !t.apres && !(Array.isArray(t.joursSemaine) && t.joursSemaine.length);
const aFaire = taches.filter(t => !jamais(t) && dans(t) <= 0).sort((a, b) => dans(a) - dans(b));
if (!aFaire.length) { console.log('Rien à faire ce soir, aucun rappel.'); process.exit(0); }

const noms = aFaire.map(t => t.nom);
const corps = noms.length <= 3 ? noms.join(', ') : `${noms.slice(0, 3).join(', ')} et ${noms.length - 3} autre${noms.length - 3 > 1 ? 's' : ''}`;
const titre = noms.length === 1 ? 'Une chose à faire ce soir' : `${noms.length} choses à faire`;

const appareils = await db.collection('appareils').get();
const jetons = appareils.docs.map(d => d.id);
if (!jetons.length) { console.log('Aucun téléphone inscrit.'); process.exit(0); }

const rep = await admin.messaging().sendEachForMulticast({
  tokens: jetons,
  data: { title: titre, body: corps, url: './menage.html' },
  webpush: { headers: { Urgency: 'high', TTL: '43200' } }
});

// On oublie les téléphones qui ne répondent plus (appli supprimée, notifications coupées)
let retires = 0;
await Promise.all(rep.responses.map((r, i) => {
  const code = r.error && r.error.code;
  if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') { retires++; return db.collection('appareils').doc(jetons[i]).delete(); }
}));
if (!manuel) await reglage.set({ dernierEnvoi: jourIso }, { merge: true });
console.log(`Rappel envoyé : ${rep.successCount} réussi(s), ${rep.failureCount} échec(s), ${retires} téléphone(s) retiré(s).`);
