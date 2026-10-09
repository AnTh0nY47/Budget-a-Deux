// Petit bandeau quand le téléphone n'a plus de réseau (en magasin, par exemple).
// L'appli continue de marcher : les changements sont gardés sur le téléphone et envoyés au retour du réseau.
(function () {
  const style = document.createElement('style');
  style.textContent = `.reseau{position:fixed;left:50%;transform:translateX(-50%);top:max(10px,env(safe-area-inset-top));z-index:30;
    background:var(--toast-bg,#1b211e);color:#fff;border-radius:999px;padding:8px 16px;font-size:14px;line-height:1.3;text-align:center;
    max-width:calc(100% - 32px);box-shadow:0 8px 20px -10px rgba(0,0,0,.4)}
    .reseau.ok{background:var(--green,#1f5e4a)}`;
  document.head.appendChild(style);
  let el = null, minuteur = null;
  function montrer(texte, ok) {
    if (!el) { el = document.createElement('div'); el.className = 'reseau'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = texte; el.classList.toggle('ok', !!ok); el.hidden = false;
    clearTimeout(minuteur);
    if (ok) minuteur = setTimeout(() => { el.hidden = true; }, 3500);
  }
  window.addEventListener('offline', () => montrer('Pas de réseau. Tout ce que tu fais est gardé et partira dès que ça capte.'));
  window.addEventListener('online', () => montrer('Réseau retrouvé, tout est envoyé.', true));
  if (!navigator.onLine) window.addEventListener('DOMContentLoaded', () => montrer('Pas de réseau. Tout ce que tu fais est gardé et partira dès que ça capte.'));
})();
