// Envoie le rappel du soir sur les téléphones quand des tâches de ménage sont à faire.
// Ce script tourne sur GitHub et ses journaux sont publics : il n'y affiche jamais le nom d'une tâche.
import admin from 'firebase-admin';
import { createRequire } from 'module';
const P = createRequire(import.meta.url)('../planning.js');

const cle = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!cle) { console.error('Secret FIREBASE_SERVICE_ACCOUNT manquant'); process.exit(1); }
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(cle)) });
const db = admin.firestore();

const aujourdhui = new Date(); aujourdhui.setHours(0, 0, 0, 0); // TZ=Europe/Paris dans la tâche
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
console.log(`Rappel envoyé : ${rep.successCount} réussi(s), ${rep.failureCount} échec(s), ${retires} téléphone(s) retiré(s).`);
