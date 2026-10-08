// Calcul du virement de début de mois, partagé avec la tâche de rappel.
// Même règle que l'onglet Budget : charges du mois + dépenses du mois précédent, au prorata des salaires.
(function (racine) {
  const num = v => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const sum = (l, f) => (l || []).reduce((s, x) => s + ((!f || f(x)) ? num(x.montant) : 0), 0);
  const commun = l => (l || []).filter(x => !x.perso);
  function prorata(R) {
    const Ra = sum(R, x => x.qui === 'a'), Rb = sum(R, x => x.qui === 'b');
    return (Ra + Rb) > 0 ? Ra / (Ra + Rb) : 0.5;
  }
  // main : budget/main ; mois : le mois du virement ; precedent : le mois d'avant (documents mois/AAAA-MM, éventuellement vides)
  function virement(main, mois, precedent) {
    mois = mois || {}; precedent = precedent || {};
    const eff = (m, k) => Array.isArray(m[k]) ? m[k] : (main[k] || []);
    const C = commun(eff(mois, 'charges')), A = eff(mois, 'aides');
    const pa = prorata(eff(mois, 'revenus'));
    const fixeA = sum(C, x => x.compte === 'a') - sum(A, x => x.compte === 'a');
    const diffFixe = fixeA - (sum(C) - sum(A)) * pa;
    const D = commun(precedent.depenses), paP = prorata(eff(precedent, 'revenus'));
    const diffDep = sum(D, x => x.payeur === 'a') - sum(D) * paP;
    const diff = diffFixe + diffDep; // > 0 : B doit à A
    return { diff, montant: Math.abs(diff), de: diff > 0 ? 'b' : 'a', vers: diff > 0 ? 'a' : 'b' };
  }
  const api = { virement };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.CalculBudget = api;
})(typeof window !== 'undefined' ? window : globalThis);
