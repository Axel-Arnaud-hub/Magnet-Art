// Couche d'accès aux capteurs : aucune autorisation demandée sans clic explicite.
// Le contrôle par inclinaison crée un champ VIRTUEL dans le Sandbox ; ce n'est
// en aucun cas une mesure de B par le magnétomètre du téléphone.
window.MMLabSensors = (function () {
  let active = false, button = null, status = null, receiver = null, shakeReceiver = null, lastShake = 0;
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
  function handleMotion(e) {
    if (!active || !shakeReceiver) return;
    const a = e.acceleration || e.accelerationIncludingGravity;
    if (!a || ![a.x,a.y,a.z].every(Number.isFinite)) return;
    const magnitude = Math.hypot(a.x,a.y,a.z);
    // acceleration excluding gravity preferable; fallback to includingGravity
    const shaken = e.acceleration ? magnitude > 11 : (magnitude > 17 || magnitude < 3);
    const now = performance.now();
    if (shaken && now-lastShake > 1800) {
      lastShake = now;
      shakeReceiver();
    }
  }
  function stop() {
    window.removeEventListener('deviceorientation', handle);
    window.removeEventListener('devicemotion', handleMotion);
    active = false; latest = null;
    if (receiver) receiver(0, 0);
    if (button) { button.textContent = '📱 Activer les capteurs'; button.setAttribute('aria-pressed', 'false'); }
    updateStatus('Inactifs');
  }
  async function toggle() {
    if (active) { stop(); return; }
    const DE = window.DeviceOrientationEvent, DM = window.DeviceMotionEvent;
    if (!window.isSecureContext) { updateStatus('HTTPS ou localhost nécessaire.'); return; }
    if (typeof DE === 'undefined' && typeof DM === 'undefined') { updateStatus('Capteurs indisponibles.'); return; }
    try {
      // Les demandes sont lancées dans le même geste utilisateur : important sur iOS.
      const orientReq = DE && typeof DE.requestPermission === 'function' ? DE.requestPermission() : Promise.resolve('granted');
      const motionReq = DM && typeof DM.requestPermission === 'function' ? DM.requestPermission() : Promise.resolve('granted');
      const [orientOk, motionOk] = await Promise.all([orientReq,motionReq]);
      if (orientOk !== 'granted' && motionOk !== 'granted') {updateStatus('Accès refusé.');return;}
      active = true;
      if (DE && orientOk === 'granted') window.addEventListener('deviceorientation', handle);
      if (DM && motionOk === 'granted') window.addEventListener('devicemotion', handleMotion);
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
    attach: function (cb, onShake) {
      receiver = cb; shakeReceiver = onShake || null;
      if (receiver) receiver(active && latest ? latest.beta : 0, active && latest ? latest.gamma : 0);
    }
  };
})();
