// Calcul des échéances du ménage, partagé entre l'appli et l'envoi des notifications
(function (racine) {
  const JOUR = 86400000;
  const NOMS_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

  function lireJour(s) {
    if (!s) return null;
    const [a, m, j] = s.split('-').map(Number);
    return new Date(a, m - 1, j);
  }
  function plus(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function joursPrecis(t) { return Array.isArray(t.joursSemaine) && t.joursSemaine.length ? t.joursSemaine : null; }

  // Prochaine date où la tâche est à faire (tous : les tâches par id, pour les tâches liées)
  function prochaine(t, aujourdhui, tous) {
    const dernier = lireJour(t.dernier);
    if (t.apres) {
      const parent = tous && tous[t.apres];
      const fait = parent && lireJour(parent.dernier);
      if (!fait) return null;                       // la tâche d'avant n'a pas encore été faite
      if (dernier && dernier >= fait) return null;  // déjà fait depuis
      return plus(fait, t.delai || 0);
    }
    const js = joursPrecis(t);
    if (js) {
      let d = dernier ? plus(dernier, 1) : aujourdhui;
      for (let i = 0; i < 8; i++) { if (js.includes(d.getDay())) return d; d = plus(d, 1); }
      return null;
    }
    if (!dernier) return aujourdhui;
    return plus(dernier, t.jours || 7);
  }

  // Nombre de jours avant l'échéance (négatif si en retard)
  function dans(t, aujourdhui, tous) {
    const p = prochaine(t, aujourdhui, tous);
    return p ? Math.round((p - aujourdhui) / JOUR) : 999;
  }

  function frequence(t, tous) {
    if (t.apres) {
      const parent = tous && tous[t.apres];
      const nom = parent ? `« ${parent.nom} »` : 'une tâche supprimée';
      const d = t.delai || 0;
      return `après ${nom}` + (d === 0 ? '' : d === 1 ? ', le lendemain' : `, ${d} jours plus tard`);
    }
    const js = joursPrecis(t);
    if (js) {
      const ordre = [1, 2, 3, 4, 5, 6, 0].filter(j => js.includes(j)).map(j => 'le ' + NOMS_JOURS[j]);
      if (ordre.length === 7) return 'chaque jour';
      return ordre.length > 1 ? ordre.slice(0, -1).join(', ') + ' et ' + ordre[ordre.length - 1] : ordre[0];
    }
    const n = t.jours || 7;
    if (n === 1) return 'chaque jour';
    if (n % 30 === 0) return n === 30 ? 'chaque mois' : `tous les ${n / 30} mois`;
    if (n % 7 === 0) return n === 7 ? 'chaque semaine' : `toutes les ${n / 7} semaines`;
    return `tous les ${n} jours`;
  }

  const api = { lireJour, plus, prochaine, dans, frequence, NOMS_JOURS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Planning = api;
})(typeof window !== 'undefined' ? window : globalThis);
