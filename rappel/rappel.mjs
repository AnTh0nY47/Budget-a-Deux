// Envoie le rappel du virement pour le mois qui vient de se terminer.
// Ce script tourne sur GitHub, ses journaux sont publics : il n'y affiche jamais de montant ni de nom.
import admin from 'firebase-admin';
import nodemailer from 'nodemailer';

const env = k => { const v = process.env[k]; if (!v) { console.error(`Secret manquant : ${k}`); process.exit(1); } return v; };

admin.initializeApp({ credential: admin.credential.cert(JSON.parse(env('FIREBASE_SERVICE_ACCOUNT'))) });
const fs = admin.firestore();

// Mois concerné : le mois précédent, à l'heure de Paris
const maintenant = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
const mois = new Date(maintenant.getFullYear(), maintenant.getMonth() - 1, 1);
const cle = `${mois.getFullYear()}-${String(mois.getMonth() + 1).padStart(2, '0')}`;
const nomMois = mois.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

const num = v => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
const sum = (l, f) => (l || []).reduce((s, x) => s + ((!f || f(x)) ? num(x.montant) : 0), 0);
const commun = l => (l || []).filter(x => !x.perso);
const eur = n => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

const main = (await fs.doc('budget/main').get()).data();
if (!main) { console.log('Budget vide, aucun rappel envoyé.'); process.exit(0); }
const m = (await fs.doc(`mois/${cle}`).get()).data() || {};
if (m.vire) { console.log('Virement déjà marqué comme fait, aucun rappel envoyé.'); process.exit(0); }

// Même calcul que dans l'appli
const eff = k => Array.isArray(m[k]) ? m[k] : (main[k] || []);
const R = eff('revenus'), C = commun(eff('charges')), A = eff('aides'), D = commun(m.depenses);
const Ra = sum(R, x => x.qui === 'a'), Rb = sum(R, x => x.qui === 'b');
const pa = (Ra + Rb) > 0 ? Ra / (Ra + Rb) : 0.5;
const total = sum(C) - sum(A) + sum(D);
const paidA = sum(C, x => x.compte === 'a') + sum(D, x => x.payeur === 'a') - sum(A, x => x.compte === 'a');
const diff = paidA - total * pa;
const N = { a: main.personnes?.a || 'Personne A', b: main.personnes?.b || 'Personne B' };

if (Math.abs(diff) < 0.005) { console.log('Rien à virer ce mois-ci, aucun rappel envoyé.'); process.exit(0); }
const de = diff > 0 ? N.b : N.a, vers = diff > 0 ? N.a : N.b, montant = eur(Math.abs(diff));
const lien = 'https://anth0ny47.github.io/Budget-a-Deux/';

const texte = `Bonjour,

Pour ${nomMois}, ${de} vire ${montant} à ${vers}.

Ce mois là, il restait ${eur(total)} à payer à deux une fois les aides retirées.

Une fois le virement fait, pensez à le cocher dans l'appli :
${lien}

À bientôt`;

const html = `<div style="font-family:Georgia,serif;font-size:17px;line-height:1.5;color:#1b211e;max-width:520px">
<p>Bonjour,</p>
<p style="font-size:22px">Pour ${nomMois}, <b>${de}</b> vire <b style="color:#1f5e4a">${montant}</b> à <b>${vers}</b>.</p>
<p style="color:#5f6862">Ce mois là, il restait ${eur(total)} à payer à deux une fois les aides retirées.</p>
<p>Une fois le virement fait, pensez à le cocher dans <a href="${lien}" style="color:#1f5e4a">l'appli</a>.</p>
<p>À bientôt</p></div>`;

const transport = nodemailer.createTransport({ service: 'gmail', auth: { user: env('GMAIL_USER'), pass: env('GMAIL_APP_PASSWORD') } });
await transport.sendMail({
  from: `Budget à deux <${env('GMAIL_USER')}>`,
  to: env('MAIL_TO'),
  subject: `Virement de ${nomMois} : ${montant}`,
  text: texte, html
});
console.log('Rappel envoyé.');
