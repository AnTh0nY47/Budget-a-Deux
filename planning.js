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

  // Points du défi du mois : réglables par tâche, sinon une tâche rare rapporte plus qu'une tâche de tous les jours
  function points(t) {
    if (t && typeof t.pointsDefi === 'number') return t.pointsDefi; // réglé à la main (0 = hors défi)
    if (!t || t.apres || joursPrecis(t)) return 1;
    const n = t.jours || 7;
    if (n <= 3) return 1;
    if (n <= 7) return 2;
    if (n <= 14) return 3;
    return 4;
  }

  // Scores d'un mois à partir de l'historique (lignes {tache, cle, jour}) et des tâches par id
  function scores(historique, tous, an, mois) {
    const s = { a: 0, b: 0, nb: { a: 0, b: 0 } };
    const vus = new Set();
    historique.forEach(h => {
      const d = lireJour(h.jour);
      if (!d || d.getFullYear() !== an || d.getMonth() !== mois || !(h.cle in s.nb)) return;
      const k = h.tache + '|' + h.jour; if (vus.has(k)) return; vus.add(k);
      const pts = points(tous && tous[h.tache]);
      if (!pts) return;                                   // tâche hors défi
      if (h.aDeux) { s.a += pts; s.b += pts; s.nb.a++; s.nb.b++; } // faite ensemble : les deux marquent
      else { s[h.cle] += pts; s.nb[h.cle]++; }
    });
    s.gagnant = s.a === s.b ? null : (s.a > s.b ? 'a' : 'b');
    return s;
  }

  const api = { lireJour, plus, prochaine, dans, frequence, points, scores, NOMS_JOURS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else racine.Planning = api;
})(typeof window !== 'undefined' ? window : globalThis);
