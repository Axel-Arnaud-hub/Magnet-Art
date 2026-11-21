(function () {
  MODELS.push(...EXPERIENCE_MODELS);
  let currentSection = 'experiences';
  let activeLesson = null;
  let lessonStep = 0;
  let lessonsDone = {};
  try { lessonsDone = JSON.parse(localStorage.getItem('mmlab-lessons-v2') || '{}'); } catch (e) {}
  const S = {
    def: null, sim: null, speed: 1, paused: false, last: 0,
    ui: {}, plots: [], hudStamp: 0, plotFlip: 0, errShown: false
  };

  const viewC = qs('#view'), plotC = [qs('#plot1'), qs('#plot2')];
  const host = { toast: toast, setParamUI: setParamUI, open: function (id, sec) { select(id, sec || 'lab'); } };

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
    if (qs('#plotdetails').open) {
      fitCanvas(plotC[0]);
      fitCanvas(plotC[1]);
    }
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
        b.onclick = function () { select(m.id, 'lab'); };
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
    const lc = qs('#lesson-inline-control');
    if (lc && lc.dataset.param === id) {
      const lin = lc.querySelector('[data-lesson-input]');
      const lout = lc.querySelector('output');
      const lq = S.ui[id] && S.ui[id].q;
      if (lin) {
        if (lin.type === 'checkbox') lin.checked = !!v;
        else if (lin.type === 'range' && lq) lin.value = valueToSlider(lq, v);
        else lin.value = v;
      }
      if (lout && lq) lout.textContent = fmtParam(lq, Number(v));
    }
    const u = S.ui[id];
    if (!u) return;
    const q = u.q;
    if (q.type === 'check') { u.input.checked = !!v; return; }
    if (q.type === 'select') { u.input.value = v; return; }
    if (q.type === 'number') {
      u.input.value = v;
      if (u.slider) u.slider.value = q.log ? valueToSlider(q, v) : v;
      if (u.out) u.out.textContent = fmtParam(q, Number(v));
      return;
    }
    u.input.value = valueToSlider(q, v);
    u.out.textContent = fmtParam(q, v);
  }

  function setParamFromUI(q, v) {
    if (S.sim) {
      S.sim.setParam(q.id, v);
      renderHud(); // retour immédiat pendant le glissement, même si le calcul est lent
      updateLessonStatus();
    }
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
        // Sandbox: un curseur ET un champ numérique exact partagent la même valeur.
        // Les changements structurels sont validés au relâchement afin de ne pas
        // recréer plusieurs fois le solveur FFT pendant un glissement.
        const numeric = mk('input');
        numeric.type = 'number'; numeric.className = 'numeric numeric-compact';
        numeric.inputMode = 'decimal';
        numeric.min = q.min; numeric.max = q.max;
        numeric.step = q.step || 'any'; numeric.value = q.value;
        input = numeric;
        out = mk('output', '', fmtParam(q, Number(q.value)));
        head.appendChild(out);
        const group = mk('div', 'slider-numeric');
        const slider = mk('input');
        slider.type = 'range';
        slider.setAttribute('aria-label', q.label);
        if (q.log) {
          slider.min = 0; slider.max = 1000; slider.step = 1;
          slider.value = valueToSlider(q, q.value);
        } else {
          slider.min = q.min; slider.max = q.max;
          slider.step = q.step || 'any'; slider.value = q.value;
        }
        const structural = ['Lx', 'Ly', 'thick', 'nx', 'ny'].includes(q.id);
        function readSlider() {
          let v = sliderToValue(q, slider.value);
          if (q.log) v = parseFloat(v.toFixed(q.digits === undefined ? 3 : q.digits));
          return v;
        }
        function preview(v) {
          numeric.value = v;
          out.textContent = fmtParam(q, Number(v));
        }
        slider.addEventListener('input', function () {
          const v = readSlider(); preview(v);
          if (!structural) setParamFromUI(q, v);
        });
        slider.addEventListener('change', function () {
          const v = readSlider(); preview(v);
          if (structural) setParamFromUI(q, v);
        });
        numeric.addEventListener('change', function () {
          const v = Number(numeric.value);
          if (numeric.value.trim() === '' || !Number.isFinite(v) || v < q.min || v > q.max ||
              (['nx','ny'].includes(q.id) && !Number.isInteger(v))) {
            preview(S.sim ? S.sim.p[q.id] : q.value);
            toast('Valeur invalide pour ' + q.label + ' (' + q.min + ' à ' + q.max + ').');
            return;
          }
          slider.value = q.log ? valueToSlider(q, v) : v;
          preview(v);
          setParamFromUI(q, v);
        });
        group.appendChild(slider); group.appendChild(numeric);
        row.appendChild(head); row.appendChild(group);
        row._slider = slider;
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
      row.dataset.param = q.id;
      box.appendChild(row);
      S.ui[q.id] = { q: q, input: input, out: out, slider: row._slider || null };
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
          updateLessonStatus();
        });
        if (it.act && S.sim) S.sim.action(it.act);
      };
      w.appendChild(e);
    });
  }

  function buildPhysics(def) {
    const points = Array.isArray(def.observe) ? def.observe : [];
    qs('#physics-observe').innerHTML = points.length ? '<strong>À observer</strong><ul>' + points.map(function(o) { return '<li>' + o + '</li>'; }).join('') + '</ul>' : '';
    qs('#physics-why').innerHTML = '<strong>Interprétation et limites</strong>' + (def.why || '<p>Consulter SOURCES.md pour les hypothèses.</p>');
    qs('#physicsdetails').open = false;
  }

  function switchSection(section, showDetail) {
    currentSection = section;
    document.body.dataset.section = section;
    qs('#app').hidden = !showDetail;
    qs('#home').hidden = !!showDetail;
    document.querySelectorAll('.navbtn').forEach(function (b) {
      const active = b.dataset.section === section;
      b.classList.toggle('active', active);
      b.setAttribute('aria-current', active ? 'page' : 'false');
    });
    if (!showDetail) {
      if (S.sim && typeof S.sim.leave === 'function') S.sim.leave();
      S.sim = null;
      renderHome(section);
    }
    else requestAnimationFrame(fitAll);
  }

  function renderHome(section) {
    const el = qs('#home');
    if (section === 'discover') {
      el.innerHTML = '<div class="home-head"><span class="eyebrow">PARCOURS DÉBUTANT · 7 LEÇONS</span><h2>Commence par observer.<br>Les formules viendront après.</h2>' +
        '<p>Un seul concept nouveau par leçon. Commence par les couleurs et les flèches, puis découvre les paramètres, dans l’ordre conseillé. Aucune formule requise.</p></div>' +
        '<div class="catalog">' + LESSONS.map(function (l,i) {
          return '<button type="button" class="catalog-card course-card" data-lesson="' + l.id + '">' +
          '<span class="card-num">ÉTAPE ' + (i+1) + ' SUR ' + LESSONS.length + '</span><span class="card-symbol">' + l.icon + '</span>' +
          '<strong>' + l.name + '</strong><span class="card-desc">' + l.short + '</span>' +
          '<span class="card-foot"><span>◷ ' + l.minutes + '</span><span>' + (lessonsDone[l.id] ? '✓ Compris' : (i===0?'Commencer ici ↗':'Explorer ↗')) + '</span></span></button>';
        }).join('') + '</div>' +
        '<p class="home-note">Les conditions de calcul, les approximations et les publications sont indiquées dans chaque leçon et dans SOURCES.md.</p>';
      el.querySelectorAll('[data-lesson]').forEach(function (b) { b.onclick=function () { startLesson(b.dataset.lesson); }; });
    } else {
      el.innerHTML = '<div class="home-head"><span class="eyebrow">EXPERIENCES À NOTRE ÉCHELLE</span><h2>Le magnétisme se découvre<br>en expérimentant.</h2>' +
        '<p>Cinq expériences interactives, des lignes de champ au disque dur. Les modèles conceptuels sont identifiés et les capteurs ne sont utilisés qu’avec permission.</p></div>' +
        '<div class="catalog">' + EXPERIENCE_MODELS.map(function (m,i) {
          return '<button type="button" class="catalog-card" data-exp="' + m.id + '">' +
          '<span class="card-num">0' + (i+1) + ' / EXPÉRIENCE</span><span class="card-symbol">' + m.icon + '</span>' +
          '<strong>' + m.name + '</strong><span class="card-desc">' + m.tagline + '</span>' +
          '<span class="card-foot"><span>' + (m.id==='pocket'?'◉ Capteur compatible':'◎ Interactif') + '</span><span>Explorer ↗</span></span></button>';
        }).join('') + '</div>' +
        '<section class="home-next"><span class="eyebrow">ALLER PLUS LOIN</span><h3>Comprendre pourquoi ?</h3><p>Manipule H, A, K, D, α et le champ démagnétisant dans de vraies simulations.</p><button type="button" id="go-discover" class="btn">Découverte guidée ↗</button></section>';
      el.querySelectorAll('[data-exp]').forEach(function (b) { b.onclick=function () { select(b.dataset.exp,'experiences'); }; });
      qs('#go-discover').onclick=function () { switchSection('discover',false); };
    }
    try { history.replaceState(null,'', section === 'discover' ? '#decouverte' : '#experiences'); } catch(e) {}
    window.scrollTo({top:0,behavior:'instant'});
  }

  function startLesson(id) {
    activeLesson = LESSONS.find(function (l) { return l.id === id; });
    if (!activeLesson) return;
    lessonStep = 0;
    select(activeLesson.model,'discover');
    // Le préréglage est appliqué avant les manipulations pour garantir
    // des points de départ reproductibles, y compris pour la FFT.
    Object.keys(activeLesson.setup).forEach(function (k) {
      if (S.sim) { S.sim.setParam(k,activeLesson.setup[k]); setParamUI(k,activeLesson.setup[k]); }
    });
    if (S.sim && typeof S.sim.reset === 'function') S.sim.reset();
    renderLesson();
    try { history.replaceState(null,'','#lecon:'+id); } catch(e) {}
  }

  // A single contextual control for each tutorial step; it is coupled to the
  // actual solver parameter and kept consistent with the advanced sliders.
  function buildLessonControl(id) {
    const box = qs('#lesson-inline-control');
    const u = S.ui[id];
    if (!box || !u || !S.sim) return;
    const q = u.q, current = S.sim.p[id];
    if (!id) {box.hidden=true;return;}
    box.hidden=false;
    box.dataset.param = id;
    box.innerHTML = '';
    const title = mk('label','lesson-control-head',q.label);
    box.appendChild(title);
    const put = function(v) {
      setParamUI(id,v); setParamFromUI(q,v);
      const st = activeLesson && activeLesson.steps[lessonStep];
      if (st && st.resetOnChange && S.sim && typeof S.sim.reset==='function') {S.sim.reset();renderHud();}
    };
    if (q.type === 'check') {
      const toggle = mk('input'); toggle.type='checkbox'; toggle.checked=!!current;
      toggle.setAttribute('data-lesson-input',''); toggle.id='lesson-param-input';
      title.setAttribute('for',toggle.id);
      toggle.addEventListener('change',function(){put(toggle.checked);});
      box.appendChild(toggle);
    } else if (q.type === 'select') {
      const select = mk('select'); select.id='lesson-param-input'; select.setAttribute('data-lesson-input','');
      title.setAttribute('for',select.id);
      q.options.forEach(function(opt){const item=mk('option','',opt[1]); item.value=opt[0]; select.appendChild(item);});
      select.value=current;
      select.addEventListener('change',function(){put(select.value);}); box.appendChild(select);
    } else {
      const wrap=mk('div','lesson-slider');
      const slider=mk('input'); slider.type='range';slider.id='lesson-param-input';
      slider.setAttribute('data-lesson-input',''); title.setAttribute('for',slider.id);
      if(q.log){slider.min=0;slider.max=1000;slider.step=1;slider.value=valueToSlider(q,current);}
      else {slider.min=q.min;slider.max=q.max;slider.step=q.step || 'any';slider.value=current;}
      const out=mk('output','',fmtParam(q,Number(current)));
      slider.addEventListener('input',function(){
        let v=sliderToValue(q,slider.value);
        if(q.log)v=parseFloat(v.toFixed((q.digits===undefined ? 3:q.digits)+1));
        out.textContent=fmtParam(q,v);put(v);
      });
      wrap.appendChild(slider);wrap.appendChild(out);box.appendChild(wrap);
    }
  }

  function updateLessonStatus() {
    if (currentSection !== 'discover' || !activeLesson || !S.sim) return;
    const st = activeLesson.steps[lessonStep], out = qs('#lesson-status');
    if (!st || !out) return;
    if (!st.param) {
      out.textContent = 'Prends le temps de repérer l’élément dans l’image.';
      out.classList.add('fulfilled');
      return;
    }
    const ok = !!st.ok(S.sim.p);
    out.textContent = ok ? '✓ Réglage atteint. Compare les deux situations avant de continuer.' : 'À régler : ' + st.target;
    out.classList.toggle('fulfilled', ok);
  }

  function renderLessonQuiz(box, lesson) {
    const q=lesson.quiz, index=LESSONS.indexOf(lesson), next=LESSONS[index+1];
    box.innerHTML='<div class="lesson-top"><span class="eyebrow">VÉRIFICATION · '+lesson.name+'</span><span>FIN DE LEÇON</span></div>'+ 
      '<div class="lesson-progress"><span style="width:100%"></span></div>'+ 
      '<h3>Est-ce que tu as compris ?</h3><p>'+q.ask+'</p>'+ 
      '<div class="lesson-choices">'+q.options.map(function(option,i){return '<label class="lesson-choice"><input type="radio" name="lesson-answer" value="'+i+'"><span>'+option+'</span></label>';}).join('')+'</div>'+ 
      '<div id="lesson-feedback" role="status" aria-live="polite"></div>'+ 
      '<div class="lesson-actions"><button class="btn" type="button" id="lessonanswer">Vérifier ma réponse</button><button class="subtle" type="button" id="lessonback">Revoir</button></div>'+ 
      '<details class="lesson-theory"><summary>Pour aller plus loin : physique et référence</summary><p>'+lesson.theory+'</p><a href="'+lesson.source+'" target="_blank" rel="noopener">Source scientifique ↗</a></details>';
    qs('#lessonback').onclick=function(){lessonStep=Math.max(0,lesson.steps.length-1);renderLesson();};
    qs('#lessonanswer').onclick=function(){
      const checked=box.querySelector('input[name="lesson-answer"]:checked'), fb=qs('#lesson-feedback');
      if(!checked){fb.textContent='Choisis une réponse avant de vérifier.';fb.className='lesson-feedback';return;}
      if(Number(checked.value)!==q.correct){fb.textContent='Pas tout à fait. '+q.explain+' Tu peux réessayer.';fb.className='lesson-feedback error';return;}
      fb.textContent='✓ '+q.explain;fb.className='lesson-feedback success';
      lessonsDone[lesson.id]=true;
      try{localStorage.setItem('mmlab-lessons-v2',JSON.stringify(lessonsDone));}catch(e){}
      qs('#lessonanswer').disabled=true;
      qs('#lessonanswer').textContent='Leçon comprise ✓';
      const area=box.querySelector('.lesson-actions');
      const btn=mk('button','btn',next?'Leçon suivante →':'Retour aux leçons');
      btn.type='button';btn.onclick=function(){if(next)startLesson(next.id);else{activeLesson=null;switchSection('discover',false);}};
      area.appendChild(btn);
    };
  }

  function renderLesson() {
    const box = qs('#lessonbox'), lesson = activeLesson;
    if (!lesson || currentSection !== 'discover') {box.hidden=true;return;}
    box.hidden=false;
    document.querySelectorAll('.prm').forEach(function (r) {r.classList.remove('lesson-focus');});
    const step=lesson.steps[lessonStep];
    if (!step) {renderLessonQuiz(box,lesson);return;}
    const number=LESSONS.indexOf(lesson)+1;
    box.innerHTML='<div class="lesson-top"><span class="eyebrow">LEÇON '+number+' / '+LESSONS.length+' · '+lesson.name+'</span><span>'+(lessonStep+1)+' / '+lesson.steps.length+'</span></div>' +
      '<div class="lesson-progress"><span style="width:'+((lessonStep+1)*100/(lesson.steps.length+1))+'%"></span></div>' +
      '<h3>'+step.title+'</h3>'+
      '<div class="lesson-prompt"><strong>1. Regarde</strong><p>'+step.see+'</p></div>'+ 
      '<div class="lesson-prompt"><strong>2. Essaie</strong><p>'+step.do+'</p></div>'+ 
      '<div id="lesson-inline-control" class="lesson-inline-control"></div>'+ 
      '<div class="lesson-prompt lesson-expected"><strong>3. Ce que tu peux observer</strong><p>'+step.expect+'</p></div>'+ 
      '<div id="lesson-status" class="lesson-status" role="status"></div>'+
      '<div class="lesson-actions"><button id="lessoncheck" class="btn" type="button">'+(lessonStep===lesson.steps.length-1?'Tester mes connaissances →':'Étape suivante →')+'</button><button id="lessonquit" class="subtle" type="button">Quitter</button></div>'+
      '<details class="lesson-theory"><summary>Pourquoi ? · Explication et source</summary><p>'+step.why+'</p><p class="lesson-advanced">Niveau approfondi : '+lesson.theory+'</p><a href="'+lesson.source+'" target="_blank" rel="noopener">Consulter la référence scientifique ↗</a></details>';
    if(step.param) {
      const input=qs('#params [data-param="'+step.param+'"]');
      if(input)input.classList.add('lesson-focus');
      buildLessonControl(step.param);
    } else qs('#lesson-inline-control').hidden=true;
    qs('#lessoncheck').onclick=function () {
      if (step.ok && !step.ok(S.sim.p)) { toast('Essaie d’abord : '+step.target); return; }
      lessonStep++;
      renderLesson();
    };
    qs('#lessonquit').onclick=function(){activeLesson=null;switchSection('discover',false);};
    updateLessonStatus();
  }
  function select(id, section) {
    section = section || (EXPERIENCE_MODELS.some(function (m) {return m.id===id;}) ? 'experiences':'lab');
    if (S.sim && typeof S.sim.leave === 'function') S.sim.leave();
    if (section !== 'discover') activeLesson = null;
    switchSection(section,true);
    const def = MODELS.find(function (m) { return m.id === id; });
    if (!def) return;
    S.def = def;
    S.sim = null;
    S.errShown = false;
    document.querySelectorAll('.mcard').forEach(function (b) { b.classList.toggle('on', b.dataset.id === id); });
    qs('#mtitle').textContent = section==='discover' && activeLesson ? activeLesson.name : def.icon + ' ' + def.name;
    qs('#mintro').textContent = section==='discover' ? 'Observe la simulation, puis réalise une manipulation simple. Les explications détaillées restent facultatives.' : def.intro;
    const hud = qs('#hud'), externalHud = qs('#hudpanel');
    if (id === 'sandbox' || id === 'wallpin') {
      externalHud.appendChild(hud);
      externalHud.style.display = 'block';
    } else {
      qs('#viewwrap').appendChild(hud);
      externalHud.style.display = 'none';
    }
    buildParams(def);
    buildActions(def);
    fitAll();
    const defaults = {};
    def.params.forEach(function (q) { defaults[q.id] = q.value; });
    S.sim = def.create(host, defaults);
    if (window.MMLabSensors) window.MMLabSensors.attach(function (beta, gamma) {
      if (S.sim && typeof S.sim.setSensorTilt === 'function') S.sim.setSensorTilt(beta, gamma);
    },function () {
      if (S.sim && typeof S.sim.setPhoneShake === 'function') S.sim.setPhoneShake();
    });
    buildPhysics(def);
    qs('#scenario-card').hidden = def.whatIf.length === 0 || section === 'discover';
    qs('#paramcard').hidden = section === 'discover' || (def.params.length === 0 && def.buttons.length === 0);
    qs('#physicsdetails').hidden = section === 'discover';
    const pd = qs('#plotdetails');
    pd.hidden = section !== 'lab';
    pd.open = false;
    const sensorsNeeded = (section === 'lab' && id === 'sandbox') || id === 'curie';
    qs('#sensors').hidden = !sensorsNeeded;
    qs('#sensorstatus').hidden = !sensorsNeeded;
    // No passive animations or chart allocations when the advanced pane is shut.
    S.paused = false;
    updatePlay();
    qs('#viewwrap').classList.toggle('grab', typeof S.sim.drag === 'function' && S.sim instanceof MacroBase);
    qs('#menu').hidden = section !== 'lab';
    qs('#lessonbox').hidden = section !== 'discover';
    if (section === 'discover') renderLesson();
    try { history.replaceState(null, '', section === 'discover' && activeLesson ? '#lecon:' + activeLesson.id : (section === 'experiences' ? '#exp:' + id : '#' + id)); } catch (e) {}
    qs('#panel').scrollTop = 0;
  }

  function updatePlay() {
    qs('#play').textContent = S.paused ? '▶ Reprendre' : '⏸ Pause';
  }

  function renderHud() {
    const sim = S.sim;
    if (!sim) return;
    let items = sim.hud();
    if (currentSection==='discover' && activeLesson) {
      const filters={
        read:['Type de paroi'],field:['Position de la paroi'],
        exchange:['Largeur Δ = √(A/K)'],anisotropy:['Largeur Δ = √(A/K)'],
        damping:['Angle entre m et B'],demag:['Champ dipolaire moyen','Magnétostatique'],
        dmi:['Type de paroi']
      };
      const labels=filters[activeLesson.id] || [];
      items=items.filter(function(it){return labels.some(function(lb){return it[0]===lb;});});
    }
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
      if (currentSection === 'lab' && qs('#plotdetails').open && (S.plotFlip === 0 || S.paused)) {
        sim.drawPlots(S.plots[0], S.plots[1]);
      }
      if (now - S.hudStamp > 120) { S.hudStamp = now; renderHud(); }
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
    qs('#plotdetails').addEventListener('toggle', function () {
      if (qs('#plotdetails').open) fitAll();
    });
    document.querySelectorAll('.navbtn').forEach(function (b) {
      b.onclick = function () {
        const sec = b.dataset.section;
        activeLesson = null;
        if (sec === 'lab') select('sandbox','lab');
        else switchSection(sec,false);
      };
    });
    const cp=qs('#collapseparams');
    cp.onclick=function(){const card=qs('#paramcard'), closed=card.classList.toggle('collapsed');cp.setAttribute('aria-expanded', String(!closed));cp.textContent=closed?'Afficher':'Masquer';};
  }

  S.plots = [new Plot(plotC[0]), new Plot(plotC[1])];
  buildMenu();
  bindUI();
  const start = decodeURIComponent((location.hash || '').replace('#', ''));
  if (start.startsWith('lecon:') && LESSONS.some(function (l){return l.id===start.slice(6);})) {
    startLesson(start.slice(6));
  } else if (start.startsWith('exp:') && EXPERIENCE_MODELS.some(function (m){return m.id===start.slice(4);})) {
    select(start.slice(4),'experiences');
  } else if (start === 'decouverte') switchSection('discover',false);
  else if (start === 'experiences' || start === '') switchSection('experiences',false);
  else if (MODELS.some(function (m) { return m.id === start; })) select(start,'lab');
  else switchSection('experiences',false);
  requestAnimationFrame(frame);
})();
