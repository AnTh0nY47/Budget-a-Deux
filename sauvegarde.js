// Sauvegarde des données de l'appli, rangée dans Firebase (collection « sauvegardes »).
// Une sauvegarde automatique par semaine à l'ouverture de l'appli, les 8 dernières sont gardées.
(function () {
  const COLLECTIONS = ['budget', 'mois', 'menage', 'menage_historique', 'courses', 'courses_frequents', 'reparations', 'membres', 'reglages'];
  const GARDER = 8;
  const SEMAINE = 7 * 86400000;

  // Les dates Firebase sont transformées en nombres pour tenir dans du texte
  function versTexte(v) {
    if (v && typeof v.toMillis === 'function') return { __date: v.toMillis() };
    if (Array.isArray(v)) return v.map(versTexte);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = versTexte(v[k]); return o; }
    return v;
  }
  function depuisTexte(v) {
    if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 1 && '__date' in v) return firebase.firestore.Timestamp.fromMillis(v.__date);
    if (Array.isArray(v)) return v.map(depuisTexte);
    if (v && typeof v === 'object') { const o = {}; for (const k in v) o[k] = depuisTexte(v[k]); return o; }
    return v;
  }

  async function exporter(fs) {
    const donnees = {};
    for (const c of COLLECTIONS) {
      const snap = await fs.collection(c).get();
      donnees[c] = {};
      snap.docs.forEach(d => { donnees[c][d.id] = versTexte(d.data()); });
    }
    // L'historique du ménage peut grossir : on garde les 1000 dernières lignes
    const h = Object.entries(donnees.menage_historique || {});
    if (h.length > 1000) {
      h.sort((a, b) => ((b[1].ts && b[1].ts.__date) || 0) - ((a[1].ts && a[1].ts.__date) || 0));
      donnees.menage_historique = Object.fromEntries(h.slice(0, 1000));
    }
    return donnees;
  }

  async function creer(fs, raison) {
    const donnees = await exporter(fs);
    const maintenant = Date.now();
    const id = new Date(maintenant).toISOString().replace(/[:.]/g, '-');
    await fs.collection('sauvegardes').doc(id).set({ date: maintenant, raison: raison || 'automatique', donnees: JSON.stringify(donnees) });
    await fs.doc('reglages/sauvegarde').set({ derniere: maintenant }, { merge: true });
    // On ne garde que les plus récentes
    const toutes = await fs.collection('sauvegardes').orderBy('date', 'desc').get();
    const b = fs.batch(); let n = 0;
    toutes.docs.slice(GARDER).forEach(d => { b.delete(d.ref); n++; });
    if (n) await b.commit();
    return id;
  }

  // Appelée à l'ouverture : sauvegarde si la dernière date de plus d'une semaine
  async function auto(fs) {
    try {
      const r = (await fs.doc('reglages/sauvegarde').get()).data() || {};
      if (!r.derniere || Date.now() - r.derniere > SEMAINE) await creer(fs, 'automatique');
    } catch (e) { console.warn('Sauvegarde automatique impossible', e); }
  }

  async function lister(fs) {
    const snap = await fs.collection('sauvegardes').orderBy('date', 'desc').get();
    return snap.docs.map(d => ({ id: d.id, date: d.data().date, raison: d.data().raison, taille: (d.data().donnees || '').length }));
  }

  // Remet les données telles qu'elles étaient dans la sauvegarde.
  // Une sauvegarde de l'état actuel est faite juste avant, pour pouvoir revenir en arrière.
  async function restaurer(fs, id) {
    const doc = await fs.collection('sauvegardes').doc(id).get();
    if (!doc.exists) throw new Error('Sauvegarde introuvable');
    const donnees = JSON.parse(doc.data().donnees);
    await creer(fs, 'avant restauration');
    for (const c of COLLECTIONS) {
      if (c === 'reglages') continue; // on garde les réglages actuels (rappels, dernière sauvegarde)
      const garder = donnees[c] || {};
      const actuels = await fs.collection(c).get();
      let b = fs.batch(), n = 0;
      const flush = async () => { if (n) { await b.commit(); b = fs.batch(); n = 0; } };
      for (const d of actuels.docs) { if (!(d.id in garder)) { b.delete(d.ref); if (++n >= 400) await flush(); } }
      for (const [docId, data] of Object.entries(garder)) { b.set(fs.collection(c).doc(docId), depuisTexte(data)); if (++n >= 400) await flush(); }
      await flush();
    }
  }

  // Fichier à garder chez soi
  async function telecharger(fs) {
    const donnees = await exporter(fs);
    const blob = new Blob([JSON.stringify({ app: 'Chez nous', date: new Date().toISOString(), donnees }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `chez-nous-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  window.Sauvegarde = { auto, creer, lister, restaurer, telecharger };
})();
