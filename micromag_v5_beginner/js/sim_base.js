// Interface entre le noyau physique, les modes et l’interface.
class SimBase {
  constructor(host, d) {
    this.host = host;
    this.p = Object.assign({}, d);
    this.t = 0;
    this.obs = {};
  }
  setParam(id, v) { this.p[id] = v; this.onParam(id, v); }
  onParam() {}
  action() {}
  hud() { return []; }
  drag() {}
  plotClick() {}
  drawPlots() {}
}

class MacroBase extends SimBase {
  constructor(host, d) {
    super(host, d);
    this.ph = newPhys();
    this.m = [0, 0, 1];
    this.integ = new MacroIntegrator();
    this.trail = [];
    this.view = { yaw: -0.55, pitch: 0.42 };
    this.timeScale = 1.2e-10;
    this.bScale = 0.1;
    this.histMax = 520;
    this.fieldFn = (t, o) => this.fieldAt(t, o);
  }
  dtMax() { return Math.min(3e-12, 0.08 / (GAMMA * Math.max(this.bScale, 1e-3))); }
  tsNow() { return this.timeScale; }
  drag(dx, dy) {
    this.view.yaw -= dx * 0.008;
    this.view.pitch = clamp(this.view.pitch + dy * 0.008, -1.4, 1.4);
  }
  update(dtReal, speed) {
    const tf = this.tsNow() * speed * dtReal;
    const dm = this.dtMax();
    let n = Math.ceil(tf / dm);
    if (n < 1) n = 1;
    if (n > 5000) n = 5000;
    const dt = tf / n;
    for (let i = 0; i < n; i++) this.stepOnce(dt);
    this.afterFrame(tf);
  }
  stepOnce(dt) {
    this.preStep(dt);
    this.integ.step(this.m, this.t, dt, this.ph, this.fieldFn);
    this.t += dt;
    this.postStep(dt);
  }
  preStep() {}
  postStep() {}
  afterFrame() {}
  fieldAt(t, o) { o[0] = 0; o[1] = 0; o[2] = 0; }
  vectors() { return []; }
  pushTrail() {
    this.trail.push([this.m[0], this.m[1], this.m[2]]);
    if (this.trail.length > 260) this.trail.shift();
  }
  draw(ctx, W, H) {
    drawSphere(ctx, W, H, this.view, { m: this.m, trail: this.trail, vecs: this.vectors() });
  }
}


class FilmSimBase extends SimBase {
  update(dtReal, speed) {
    const c = this.core, dt = c.dt, target = this.timeScale * speed * dtReal;
    const t0 = performance.now();
    let adv = 0, k = 0;
    this.beforeFrame();
    while (adv < target) {
      c.step(dt, this.t);
      this.t += dt;
      adv += dt;
      k++;
      if ((k & 3) === 0 && performance.now() - t0 > 11) break;
    }
    this.afterFrame();
  }
  beforeFrame() {}
  afterFrame() {}
}

