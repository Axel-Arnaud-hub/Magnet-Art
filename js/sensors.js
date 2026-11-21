// Couche d'accès aux capteurs : aucune autorisation demandée sans clic explicite.
// Le contrôle par inclinaison crée un champ VIRTUEL dans le Sandbox ; ce n'est
// en aucun cas une mesure de B par le magnétomètre du téléphone.
window.MMLabSensors = (function () {
  let active = false, button = null, status = null, receiver = null;
  let latest = null;

  function updateStatus(s) { if (status) status.textContent = s; }
  function handle(e) {
    if (!active || !Number.isFinite(e.beta) || !Number.isFinite(e.gamma)) return;
    const now = performance.now();
    if (latest && now - latest.time < 70) return;
    latest = { beta: e.beta, gamma: e.gamma, time: now };
    updateStatus('β ' + e.beta.toFixed(0) + '° ; γ ' + e.gamma.toFixed(0) + '°');
    if (receiver) receiver(e.beta, e.gamma);
  }
  function stop() {
    window.removeEventListener('deviceorientation', handle);
    active = false; latest = null;
    if (receiver) receiver(0, 0);
    if (button) { button.textContent = '📱 Activer les capteurs'; button.setAttribute('aria-pressed', 'false'); }
    updateStatus('Inactifs');
  }
  async function toggle() {
    if (active) { stop(); return; }
    const DE = window.DeviceOrientationEvent;
    if (!window.isSecureContext) { updateStatus('HTTPS ou localhost nécessaire.'); return; }
    if (typeof DE === 'undefined') { updateStatus('Capteurs d’orientation non disponibles.'); return; }
    try {
      // Il faut déclencher cette méthode directement dans le gestionnaire du clic.
      if (typeof DE.requestPermission === 'function') {
        const granted = await DE.requestPermission();
        if (granted !== 'granted') { updateStatus('Accès refusé.'); return; }
      }
      active = true;
      window.addEventListener('deviceorientation', handle);
      button.setAttribute('aria-pressed', 'true');
      button.textContent = '📱 Désactiver les capteurs';
      updateStatus('Autorisation accordée ; en attente de données…');
      window.setTimeout(function () {
        if (active && !latest) updateStatus('Aucune donnée : navigateur ou appareil incompatible.');
      }, 2500);
    } catch (e) {
      active = false;
      updateStatus('Accès impossible : ' + (e && e.message ? e.message : 'erreur de permission'));
    }
  }
  return {
    init: function (b, s) { button = b; status = s; b.addEventListener('click', toggle); },
    attach: function (cb) {
      receiver = cb;
      if (receiver) receiver(active && latest ? latest.beta : 0, active && latest ? latest.gamma : 0);
    }
  };
})();
