// Mode sombre le soir : de 20h à 7h, l'appli passe en couleurs foncées toute seule.
(function () {
  function appliquer() {
    const h = new Date().getHours();
    const sombre = h >= 20 || h < 7;
    document.documentElement.dataset.theme = sombre ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', sombre ? '#141a17' : '#faf8f3');
  }
  appliquer();
  setInterval(appliquer, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) appliquer(); });
})();
