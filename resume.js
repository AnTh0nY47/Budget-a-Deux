// Résumé du jour affiché en fenêtre à l'ouverture de l'appli (une fois par ouverture).
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const eur = n => (Math.round(n * 100) / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const cleMois = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
  const isoDay = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const de = m => (/^[aeiouy]/i.test(m) ? 'd’' : 'de ') + m;

  function dejaVu() { try { return sessionStorage.getItem('resumeVu') === '1'; } catch (e) { return false; } }
  function marquer() { try { sessionStorage.setItem('resumeVu', '1'); } catch (e) {} }

  const css = `
  .rs-fond{position:fixed;inset:0;z-index:20;background:rgba(27,33,30,.35);display:flex;align-items:flex-end;justify-content:center;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));animation:rs-in .2s ease}
  .rs-boite{background:var(--card,#fff);color:var(--ink,#1b211e);border-radius:18px;width:100%;max-width:460px;padding:22px 20px 16px;box-shadow:0 20px 50px -20px rgba(0,0,0,.45);display:flex;flex-direction:column;gap:14px;max-height:85vh;overflow:auto;animation:rs-up .25s ease}
  .rs-boite h2{margin:0;font-size:26px;font-weight:500;line-height:1.15}
  .rs-date{margin:-8px 0 0;color:var(--muted,#5f6862);font-style:italic}
  .rs-l{display:flex;flex-direction:column;gap:2px;padding:10px 0;border-top:1px solid var(--line,#e5e2d9)}
  .rs-l a{color:inherit;text-decoration:none}
  .rs-t{font-size:14px;color:var(--green,#1f5e4a);font-style:italic}
  .rs-v{font-size:18px;line-height:1.35}
  .rs-v .late{color:var(--red,#b5432f)}
  .rs-v .amt{color:var(--green,#1f5e4a);font-weight:600;white-space:nowrap}
  .rs-ok{align-self:stretch;border:0;background:var(--green,#1f5e4a);color:#fff;border-radius:10px;padding:12px;font:inherit;font-size:17px;cursor:pointer}
  @keyframes rs-in{from{opacity:0}}
  @keyframes rs-up{from{transform:translateY(24px);opacity:0}}
  @media (min-width:600px){.rs-fond{align-items:center}}
  @media (prefers-reduced-motion:reduce){.rs-fond,.rs-boite{animation:none}}`;

  async function montrer(u) {
    const fs = firebase.firestore();
    const P = window.Planning, CB = window.CalculBudget;
    const auj = new Date(); auj.setHours(0, 0, 0, 0);
    let membre, main, mois, prec, menage, courses, reps, vac;
    try {
      [membre, main, mois, prec, menage, courses, reps, vac] = await Promise.all([
        fs.collection('membres').doc(u.uid).get(),
        fs.doc('budget/main').get(),
        fs.doc('mois/' + cleMois(auj)).get(),
        fs.doc('mois/' + cleMois(new Date(auj.getFullYear(), auj.getMonth() - 1, 1))).get(),
        fs.collection('menage').get(),
        fs.collection('courses').get(),
        fs.collection('reparations').get(),
        fs.doc('reglages/vacances').get()
      ]);
    } catch (e) { return; } // pas d'accès : on ne montre rien
    if (!membre.exists) return; // la personne n'a pas encore choisi son nom
    const personnes = Object.assign({ a: 'Personne A', b: 'Personne B' }, (main.data() || {}).personnes);
    const moi = personnes[membre.data().cle] || '';
    const lignes = [];

    // Ménage
    const v = vac.data() || {};
    if (P) {
      const taches = menage.docs.map(d => Object.assign({ id: d.id }, d.data()));
      const parId = Object.fromEntries(taches.map(t => [t.id, t]));
      const jamais = t => !t.dernier && !t.apres && !(t.joursSemaine || []).length;
      const aFaire = taches.filter(t => t.dernier !== isoDay(auj) && !jamais(t) && P.dans(t, auj, parId) <= 0)
        .sort((a, b) => P.dans(a, auj, parId) - P.dans(b, auj, parId));
      let txt;
      if (v.actif) txt = 'En pause pendant les vacances.';
      else if (!aFaire.length) txt = 'Rien à faire aujourd’hui.';
      else txt = aFaire.slice(0, 4).map(t => { const n = P.dans(t, auj, parId); return esc(t.nom) + (n < 0 ? ' <span class="late">(en retard)</span>' : ''); }).join(', ') + (aFaire.length > 4 ? ` et ${aFaire.length - 4} autre${aFaire.length - 4 > 1 ? 's' : ''}` : '');
      lignes.push(['menage.html', aFaire.length && !v.actif ? `Le ménage du jour, ${aFaire.length} chose${aFaire.length > 1 ? 's' : ''}` : 'Le ménage du jour', txt]);
    }

    // Virement
    const m = mois.data() || {};
    if (CB && main.exists && !m.vire) {
      const r = CB.virement(main.data(), m, prec.data() || {});
      if (r.montant >= 0.01) {
        const nm = auj.toLocaleDateString('fr-FR', { month: 'long' });
        lignes.push(['./', `Le virement ${de(nm)} n’est pas encore fait`, `${esc(personnes[r.de])} vire <span class="amt">${eur(r.montant)}</span> à ${esc(personnes[r.vers])}.`]);
      }
    }

    // Courses
    const aAcheter = courses.docs.map(d => d.data()).filter(c => !c.pris);
    if (aAcheter.length) lignes.push(['courses.html', `Les courses, ${aAcheter.length} article${aAcheter.length > 1 ? 's' : ''}`, esc(aAcheter.slice(0, 5).map(c => c.nom.charAt(0).toLowerCase() + c.nom.slice(1)).join(', ')) + (aAcheter.length > 5 ? '…' : '')]);

    // Réparations urgentes
    const urgents = reps.docs.map(d => d.data()).filter(r => !r.fait && r.urgence === 'urgent');
    if (urgents.length) lignes.push(['reparations.html', `À réparer, ${urgents.length} urgent${urgents.length > 1 ? 's' : ''}`, esc(urgents.slice(0, 3).map(r => r.titre).join(', '))]);

    const h = new Date().getHours();
    const date = auj.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);
    const fond = document.createElement('div');
    fond.className = 'rs-fond';
    fond.innerHTML = `<div class="rs-boite" role="dialog" aria-modal="true" aria-labelledby="rs-titre">
      <h2 id="rs-titre">${h >= 18 ? 'Bonsoir' : 'Bonjour'}, ${esc(moi)}</h2>
      <p class="rs-date">${date.charAt(0).toUpperCase() + date.slice(1)}</p>
      ${lignes.map(([lien, titre, val]) => `<div class="rs-l"><a href="${lien}"><div class="rs-t">${titre}</div><div class="rs-v">${val}</div></a></div>`).join('')}
      <button class="rs-ok" type="button">C’est parti</button>
    </div>`;
    const fermer = () => { fond.remove(); document.removeEventListener('keydown', echap); };
    const echap = e => { if (e.key === 'Escape') fermer(); };
    fond.addEventListener('click', e => { if (e.target === fond) fermer(); });
    fond.querySelector('.rs-ok').addEventListener('click', fermer);
    fond.querySelectorAll('.rs-l a').forEach(a => a.addEventListener('click', e => {
      // lien vers la page où l'on est déjà : on ferme juste la fenêtre
      const cible = new URL(a.getAttribute('href'), location.href).pathname.replace(/index\.html$/, '');
      if (cible === location.pathname.replace(/index\.html$/, '')) { e.preventDefault(); fermer(); }
    }));
    document.addEventListener('keydown', echap);
    document.body.appendChild(fond);
    fond.querySelector('.rs-ok').focus();
  }

  if (dejaVu() || !window.firebase) return;
  let fait = false;
  firebase.auth().onAuthStateChanged(u => {
    if (!u || fait || dejaVu()) return;
    fait = true; marquer();
    setTimeout(() => montrer(u).catch(() => {}), 600);
  });
})();
