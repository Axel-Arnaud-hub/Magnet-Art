(function () {
  const S = {
    def: null, sim: null, speed: 1, paused: false, last: 0,
    ui: {}, plots: [], done: {}, hudStamp: 0, chStamp: 0, plotFlip: 0, errShown: false
  };

  function loadDone() {
    try { return JSON.parse(localStorage.getItem('mmlab-done-v1') || '{}'); } catch (e) { return {}; }
  }
  function saveDone() {
    try { localStorage.setItem('mmlab-done-v1', JSON.stringify(S.done)); } catch (e) {}
  }
  S.done = loadDone();

  const viewC = qs('#view'), plotC = [qs('#plot1'), qs('#plot2')];
  const host = { toast: toast, setParamUI: setParamUI };

  function toast(msg) {
    const t = qs('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast.tm);
    toast.tm = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  function fitCanvas(c) {
    const r = c.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    c._w = Math.max(10, r.width);
    c._h = Math.max(10, r.height);
    c._dpr = dpr;
    c.width = Math.round(c._w * dpr);
    c.height = Math.round(c._h * dpr);
  }
  function fitAll() {
    fitCanvas(viewC);
    fitCanvas(plotC[0]);
    fitCanvas(plotC[1]);
  }

  function totalChallenges() {
    let n = 0;
    MODELS.forEach(function (m) { n += m.challenges.length; });
    return n;
  }
  function updateScore() {
    const n = Object.keys(S.done).length;
    qs('#score').innerHTML = '⭐ <b>' + n + '</b> / ' + totalChallenges() + ' défis';
  }

  function buildMenu() {
    const nav = qs('#menu');
    nav.innerHTML = '';
    PACKS.forEach(function (pk) {
      const sec = mk('div', 'pack');
      sec.style.setProperty('--pc', pk.color);
      sec.appendChild(mk('h3', '', pk.icon + ' ' + pk.name));
      MODELS.filter(function (m) { return m.pack === pk.id; }).forEach(function (m) {
        const b = mk('button', 'mcard', '<span class="mi">' + m.icon + '</span><span class="mt"><b>' + m.name + '</b><small>' + m.tagline + '</small></span>');
        b.dataset.id = m.id;
        b.onclick = function () { select(m.id); };
        sec.appendChild(b);
      });
      nav.appendChild(sec);
    });
  }

  function sliderToValue(q, s) {
    if (q.log) return q.min * Math.pow(q.max / q.min, s / 1000);
    return parseFloat(s);
  }
  function valueToSlider(q, v) {
    if (q.log) return 1000 * Math.log(v / q.min) / Math.log(q.max / q.min);
    return v;
  }
  function fmtParam(q, v) {
    const d = q.digits !== undefined ? q.digits : (q.step < 1 ? 2 : 0);
    return v.toFixed(d) + (q.unit ? ' ' + q.unit : '');
  }

  function setParamUI(id, v) {
    const u = S.ui[id];
    if (!u) return;
    const q = u.q;
    if (q.type === 'check') { u.input.checked = !!v; return; }
    if (q.type === 'select' || q.type === 'number') { u.input.value = v; return; }
    u.input.value = valueToSlider(q, v);
    u.out.textContent = fmtParam(q, v);
  }

  function setParamFromUI(q, v) {
    if (S.sim) S.sim.setParam(q.id, v);
  }

  function buildParams(def) {
    const box = qs('#params');
    box.innerHTML = '';
    S.ui = {};
    def.params.forEach(function (q) {
      const row = mk('div', 'prm');
      const head = mk('div', 'prm-h');
      const lab = mk('label', '', q.label + (q.help ? ' <i class="info" title="">ⓘ</i>' : ''));
      head.appendChild(lab);
      let input, out = null;
      if (q.type === 'check') {
        const sw = mk('label', 'sw');
        input = mk('input');
        input.type = 'checkbox';
        input.checked = !!q.value;
        sw.appendChild(input);
        sw.appendChild(mk('span'));
        head.appendChild(sw);
        input.addEventListener('change', function () { setParamFromUI(q, input.checked); });
      } else if (q.type === 'select') {
        input = mk('select');
        q.options.forEach(function (o) {
          const op = mk('option', '', o[1]);
          op.value = o[0];
          input.appendChild(op);
        });
        input.value = q.value;
        input.addEventListener('change', function () { setParamFromUI(q, input.value); });
        row.appendChild(head);
        row.appendChild(input);
      } else if (q.type === 'number') {
        input = mk('input');
        input.type = 'number'; input.className = 'numeric'; input.inputMode = 'decimal';
        input.min = q.min; input.max = q.max; input.step = q.step || 'any'; input.value = q.value;
        input.addEventListener('change', function () {
          const val = Number(input.value);
          if (!Number.isFinite(val) || val < q.min || val > q.max) {
            input.value = S.sim ? S.sim.p[q.id] : q.value;
            toast('Valeur invalide pour ' + q.label + ' (' + q.min + ' à ' + q.max + ').');
            return;
          }
          setParamFromUI(q, val);
        });
        row.appendChild(head);
        row.appendChild(input);
      } else {
        out = mk('output', '', fmtParam(q, q.value));
        head.appendChild(out);
        input = mk('input');
        input.type = 'range';
        if (q.log) { input.min = 0; input.max = 1000; input.step = 1; input.value = valueToSlider(q, q.value); }
        else { input.min = q.min; input.max = q.max; input.step = q.step; input.value = q.value; }
        input.addEventListener('input', function () {
          let v = sliderToValue(q, input.value);
          if (q.log) {
            const dg = q.digits !== undefined ? q.digits : 3;
            v = parseFloat(v.toFixed(dg + 1));
          }
          out.textContent = fmtParam(q, v);
          setParamFromUI(q, v);
        });
        row.appendChild(head);
        row.appendChild(input);
      }
      if (q.type === 'check') row.appendChild(head);
      if (q.help) {
        const hp = mk('div', 'prm-help', q.help);
        row.appendChild(hp);
        const info = qs('.info', lab);
        if (info) info.onclick = function (e) { e.preventDefault(); hp.classList.toggle('open'); };
      }
      box.appendChild(row);
      S.ui[q.id] = { q: q, input: input, out: out };
    });
  }

  function buildActions(def) {
    const a = qs('#actions');
    a.innerHTML = '';
    def.buttons.forEach(function (b) {
      const e = mk('button', 'btn', b.label);
      e.onclick = function () { if (S.sim) S.sim.action(b.id); };
      a.appendChild(e);
    });
    const w = qs('#whatif');
    w.innerHTML = '';
    def.whatIf.forEach(function (it) {
      const e = mk('button', 'chip', it.label);
      e.onclick = function () {
        Object.keys(it.set).forEach(function (k) {
          setParamUI(k, it.set[k]);
          if (S.sim) S.sim.setParam(k, it.set[k]);
        });
        if (it.act && S.sim) S.sim.action(it.act);
      };
      w.appendChild(e);
    });
  }

  function buildTabs(def) {
    qs('#tab-observe').innerHTML = '<ul>' + def.observe.map(function (o) { return '<li>' + o + '</li>'; }).join('') + '</ul>';
    qs('#tab-why').innerHTML = def.why;
    qs('#tab-ub').innerHTML = '<p>' + def.ub.text + '</p><div class="codes">' + def.ub.classes.map(function (c) { return '<code>' + c + '</code>'; }).join('') + '</div><p class="small">Pour aller plus loin : <a href="https://ubermag.github.io/" target="_blank" rel="noopener">ubermag.github.io</a></p>';
    renderChallenges();
  }

  function renderChallenges() {
    const def = S.def;
    if (!def) return;
    const ul = qs('#tab-ch');
    ul.innerHTML = '';
    def.challenges.forEach(function (c) {
      const ok = !!S.done[c.id];
      ul.appendChild(mk('li', ok ? 'ok' : '', '<span>' + (ok ? '⭐' : '☆') + '</span> ' + c.text));
    });
    const n = def.challenges.filter(function (c) { return S.done[c.id]; }).length;
    qs('#chcount').textContent = n + '/' + def.challenges.length;
    updateScore();
  }

  function checkChallenges() {
    const def = S.def, sim = S.sim;
    if (!def || !sim) return;
    let changed = false;
    def.challenges.forEach(function (c) {
      if (S.done[c.id]) return;
      let ok = false;
      try { ok = !!c.test(sim.obs || {}, sim.p); } catch (e) { ok = false; }
      if (ok) {
        S.done[c.id] = 1;
        changed = true;
        toast('🏆 Défi réussi : ' + c.text);
      }
    });
    if (changed) { saveDone(); renderChallenges(); }
  }

  function select(id) {
    const def = MODELS.find(function (m) { return m.id === id; });
    if (!def) return;
    S.def = def;
    S.sim = null;
    S.errShown = false;
    document.querySelectorAll('.mcard').forEach(function (b) { b.classList.toggle('on', b.dataset.id === id); });
    qs('#mtitle').textContent = def.icon + ' ' + def.name;
    qs('#mintro').textContent = def.intro;
    buildParams(def);
    buildActions(def);
    fitAll();
    const defaults = {};
    def.params.forEach(function (q) { defaults[q.id] = q.value; });
    S.sim = def.create(host, defaults);
    if (window.MMLabSensors) window.MMLabSensors.attach(function (beta, gamma) {
      if (S.sim && typeof S.sim.setSensorTilt === 'function') S.sim.setSensorTilt(beta, gamma);
    });
    buildTabs(def);
    S.paused = false;
    updatePlay();
    qs('#viewwrap').classList.toggle('grab', typeof S.sim.drag === 'function' && S.sim instanceof MacroBase);
    try { history.replaceState(null, '', '#' + id); } catch (e) {}
    qs('#panel').scrollTop = 0;
  }

  function updatePlay() {
    qs('#play').textContent = S.paused ? '▶ Reprendre' : '⏸ Pause';
  }

  function renderHud() {
    const sim = S.sim;
    if (!sim) return;
    const items = sim.hud();
    qs('#hud').innerHTML = items.map(function (it) {
      return '<div class="chipv ' + (it[2] || '') + '"><span>' + it[0] + '</span><b>' + it[1] + '</b></div>';
    }).join('');
  }

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, ((now - S.last) / 1000) || 0.016);
    S.last = now;
    const sim = S.sim;
    if (!sim) return;
    try {
      if (!S.paused) sim.update(dt, S.speed);
      const ctx = viewC.getContext('2d'), dpr = viewC._dpr || 1;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, viewC._w, viewC._h);
      sim.draw(ctx, viewC._w, viewC._h);
      S.plotFlip ^= 1;
      if (S.plotFlip === 0 || S.paused) {
        sim.drawPlots(S.plots[0], S.plots[1]);
      }
      if (now - S.hudStamp > 120) { S.hudStamp = now; renderHud(); }
      if (now - S.chStamp > 350) { S.chStamp = now; checkChallenges(); }
    } catch (e) {
      console.error(e);
      if (!S.errShown) {
        S.errShown = true;
        S.paused = true;
        updatePlay();
        toast('Oups, une erreur est survenue. Clique sur ↺ ou change de modèle.');
      }
    }
  }

  function bindUI() {
    qs('#play').onclick = function () { S.paused = !S.paused; updatePlay(); };
    qs('#restart').onclick = function () {
      if (!S.sim) return;
      S.errShown = false;
      S.paused = false;
      updatePlay();
      if (typeof S.sim.reset === 'function') S.sim.reset();
    };
    const sp = qs('#speed'), so = qs('#speedout');
    sp.oninput = function () {
      S.speed = Math.pow(10, (parseFloat(sp.value) - 50) / 50 * 0.8);
      so.textContent = '×' + S.speed.toFixed(S.speed < 1 ? 2 : 1);
    };
    sp.oninput();
    document.querySelectorAll('.tab').forEach(function (t) {
      t.onclick = function () {
        document.querySelectorAll('.tab').forEach(function (x) { x.classList.toggle('on', x === t); });
        document.querySelectorAll('.pane').forEach(function (p) { p.classList.toggle('on', p.id === t.dataset.pane); });
      };
    });
    let drag = null;
    viewC.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY };
      viewC.setPointerCapture(e.pointerId);
    });
    viewC.addEventListener('pointermove', function (e) {
      if (!drag || !S.sim) return;
      if (typeof S.sim.drag === 'function') S.sim.drag(e.clientX - drag.x, e.clientY - drag.y);
      drag.x = e.clientX; drag.y = e.clientY;
    });
    viewC.addEventListener('pointerup', function (e) {
      if (!drag || !S.sim || typeof S.sim.tap !== 'function') return;
      const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
      if (dist > 8) return;
      const r = viewC.getBoundingClientRect();
      S.sim.tap(e.clientX - r.left, e.clientY - r.top);
    });
    const end = function () { drag = null; };
    viewC.addEventListener('pointerup', end);
    viewC.addEventListener('pointercancel', end);
    plotC.forEach(function (c, i) {
      c.addEventListener('click', function (e) {
        const r = c.getBoundingClientRect();
        if (S.sim) S.sim.plotClick(i + 1, e.clientX - r.left, e.clientY - r.top, S.plots[i]);
      });
    });
    window.addEventListener('keydown', function (e) {
      if (e.code === 'Space' && e.target.tagName !== 'SELECT' && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        S.paused = !S.paused;
        updatePlay();
      }
    });
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(fitAll);
      ro.observe(qs('#viewwrap'));
      ro.observe(qs('#plots'));
    } else {
      window.addEventListener('resize', fitAll);
    }
    if (window.MMLabSensors) window.MMLabSensors.init(qs('#sensors'), qs('#sensorstatus'));
    qs('#resetscore').onclick = function () {
      S.done = {};
      saveDone();
      renderChallenges();
    };
  }

  S.plots = [new Plot(plotC[0]), new Plot(plotC[1])];
  buildMenu();
  bindUI();
  updateScore();
  const start = (location.hash || '').replace('#', '');
  select(MODELS.some(function (m) { return m.id === start; }) ? start : 'compass');
  requestAnimationFrame(frame);
})();
