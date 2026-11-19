/* Император и старец — логика сцены: раскладка, камера, падение яблока, вылет текста, 3D-яблоко. */
(function () {
  'use strict';

  var SPEED = window.__SPEED || 1.5;
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var root = document.documentElement;
  root.classList.add('js');

  var tree = document.getElementById('tree');
  var hero = document.getElementById('hero');
  var canvas = document.getElementById('apple3d');
  var fx = document.getElementById('fx');
  var slidesEl = document.querySelector('.reveal .slides');
  var sections = Array.prototype.slice.call(document.querySelectorAll('.reveal .slides > section'));
  var bar = document.querySelector('.controls-bar');
  var N = sections.length;

  gsap.globalTimeline.timeScale(SPEED);

  /* ---------- разметка фона (кадр 750 x 1001) ---------- */
  var FW = 750, FH = 1001, PX = 715, P_TOP = 150, P_BOT = 540, P_GROUND = 905;
  function stopY(i) { return P_TOP + (P_BOT - P_TOP) * Math.min(i, 6) / 6; }

  /* ---------- раскладка ---------- */
  var W, H, VS, slideL, slideT, slideW, slideH, mx, u, offX, SH, R = 28, BOX = 0, fieldW;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    var ph = (bar ? bar.offsetHeight : 44) + 14;
    VS = Math.min(0.84 * W / 1280, (H - ph - 20) / 720);
    slideW = 1280 * VS; slideH = 720 * VS;
    var rem = W - slideW;
    slideL = rem * 0.2;
    slideT = Math.max(6, (H - ph - slideH) / 2);
    slidesEl.style.transform = 'translate(' + slideL + 'px,' + slideT + 'px) scale(' + VS + ')';
    fieldW = W - slideL - slideW;
    mx = slideL + slideW + fieldW / 2;
    R = clamp(W * 0.036, 42, 78) / 2;
    if (R * 2.3 > fieldW) R = Math.max(12, fieldW / 2.3);
    u = Math.max(W / FW, 1.3 * H / FH) * 1.04;
    offX = Math.min(0, Math.max(W - FW * u, mx - PX * u));
    SH = FH * u;
    tree.style.width = (FW * u) + 'px';
    tree.style.height = (FH * u) + 'px';
    hero.style.width = hero.style.height = (R * 2.25) + 'px';
    var nb = Math.ceil(R * 4.4);
    if (nb !== BOX) { BOX = nb; if (gl) gl.resize(); }
  }

  /* ---------- состояние яблока (y — в единицах кадра, x — смещение в единицах) ---------- */
  var st = { x: 0, y: stopY(0), tilt: 0, rx: 0, ry: 0, sx: 1, sy: 1 };
  var cam = 0, camReady = false;
  var cur = 0, tl = null, firstDrop = true, moving = false;

  function groundY() { return P_GROUND - R / u; }
  function targetY(i) { return i >= 7 ? groundY() : stopY(i); }
  function targetX(i) { return i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.min(6, fieldW * 0.12 / u); }
  function appleScreen() { return { x: mx + st.x * u, y: st.y * u - cam }; }

  /* ---------- листья и пыль ---------- */
  var leaves = [];
  function spawnLeaves(n) {
    var p = appleScreen();
    for (var i = 0; i < n; i++) {
      var el = document.createElement('div');
      el.className = 'leaf';
      fx.appendChild(el);
      leaves.push({ el: el, x: p.x + (Math.random() - .5) * R, wy: p.y + cam - R * (0.6 + Math.random() * 0.5),
        vx: (Math.random() - .5) * 140, vy: -60 - Math.random() * 90, r: Math.random() * 360,
        vr: (Math.random() - .5) * 420, ph: Math.random() * 6.28, age: 0 });
    }
  }
  function tickLeaves(dt, t) {
    for (var i = leaves.length - 1; i >= 0; i--) {
      var L = leaves[i];
      L.age += dt;
      L.vy = Math.min(L.vy + 300 * dt, 95);
      L.vx *= (1 - dt * 0.9);
      L.x += (L.vx + Math.sin(t * 3.2 + L.ph) * 55) * dt;
      L.wy += L.vy * dt;
      L.r += L.vr * dt;
      var sy = L.wy - cam;
      if (sy > H + 40 || L.age > 6) { L.el.remove(); leaves.splice(i, 1); continue; }
      L.el.style.transform = 'translate3d(' + L.x.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0) rotate(' + L.r.toFixed(0) + 'deg) scaleY(' + (0.55 + 0.45 * Math.abs(Math.sin(t * 4 + L.ph))).toFixed(2) + ')';
    }
  }
  function dust() {
    var p = appleScreen();
    for (var i = 0; i < 7; i++) {
      var el = document.createElement('div');
      el.className = 'dust';
      fx.appendChild(el);
      var dir = (i - 3) / 3;
      gsap.fromTo(el, { x: p.x - 13, y: p.y + R * 0.75 - 6, scale: .3, opacity: .85 },
        { x: p.x - 13 + dir * R * 2.2 + (Math.random() - .5) * 10, y: p.y + R * 0.75 - 6 - R * (0.3 + Math.random() * 0.6),
          scale: 1.4 + Math.random() * 0.8, opacity: 0, duration: 1.1, ease: 'power2.out',
          onComplete: function () { this.targets()[0].remove(); } });
    }
  }

  /* ---------- вылет текста из яблока ---------- */
  var diagramURL = {};
  var blobs = {};
  function diagramBlob(n) {
    if (blobs[n]) return blobs[n];
    var b64 = (window.__DIAGRAMS || {})[n];
    if (!b64) return null;
    var bin = atob(b64), arr = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return (blobs[n] = new Blob([arr], { type: 'image/webp' }));
  }
  function playDiagram(el) {
    var img = el.querySelector ? el.querySelector('img.diagram') : null;
    if (!img || reduce) return;
    var n = img.getAttribute('data-n'), b = diagramBlob(n);
    if (!b || !window.URL || !URL.createObjectURL) return;
    var old = diagramURL[n];
    diagramURL[n] = URL.createObjectURL(b);
    img.src = diagramURL[n];
    if (old) setTimeout(function () { URL.revokeObjectURL(old); }, 1000);
  }
  function items(i) { return sections[i] ? Array.prototype.slice.call(sections[i].querySelectorAll('.a, .footer')) : []; }
  function hideSlide(i) {
    var els = items(i);
    gsap.killTweensOf(els);
    gsap.set(els, { opacity: 0, x: 0, y: 0, scale: 1 });
  }
  function flyIn(i) {
    var els = items(i);
    gsap.killTweensOf(els);
    if (reduce) { gsap.set(els, { opacity: 1, x: 0, y: 0, scale: 1 }); return; }
    gsap.set(els, { x: 0, y: 0, scale: 1 });
    var p = appleScreen();
    els.forEach(function (e, k) {
      var r = e.getBoundingClientRect();
      var dx = (p.x - (r.left + r.width / 2)) / VS, dy = (p.y - (r.top + r.height / 2)) / VS;
      gsap.fromTo(e, { x: dx, y: dy, scale: .04, opacity: 0 },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: .85, delay: k * .075, ease: 'power3.out',
          onStart: function () { playDiagram(e); } });
    });
  }

  /* ---------- падение / подъём ---------- */
  var TAU = Math.PI * 2;
  function fallTime(dyUnits) { return Math.sqrt(2 * Math.max(dyUnits, 0) * u / (2.6 * H)); }

  function goTo(idx) {
    if (idx === cur && tl) return;
    var interrupted = !!tl || moving;
    if (tl) { tl.kill(); tl = null; }
    if (cur !== idx) { var old = items(cur); gsap.killTweensOf(old); gsap.to(old, { opacity: 0, duration: .2 }); }
    cur = idx;
    hideSlide(idx);
    updateUI();
    var ty = targetY(idx);
    if (reduce) {
      st.y = ty; st.x = targetX(idx); st.sx = st.sy = 1; st.tilt = 0;
      flyIn(idx); return;
    }
    if (ty > st.y + 0.5) fall(idx, ty, interrupted);
    else if (ty < st.y - 0.5) rise(idx, ty);
    else { flyIn(idx); }
  }

  function fall(idx, ty, interrupted) {
    moving = true;
    var t = gsap.timeline({ onComplete: function () { tl = null; moving = false; } });
    tl = t;
    var y0 = st.y;
    if (!interrupted) {
      var amps = firstDrop ? [.05, -.09, .13, -.17, .08] : [.06, -.1, .07];
      amps.forEach(function (a) { t.to(st, { tilt: a, duration: .1, ease: 'sine.inOut' }); });
      var jump = R * 0.25 / u;
      y0 = st.y - jump;
      t.to(st, { y: y0, tilt: 0, sx: 1.06, sy: 0.94, duration: .09, ease: 'power1.out',
        onStart: function () { spawnLeaves(firstDrop ? 3 : 2); } });
      firstDrop = false;
    } else {
      t.to(st, { tilt: 0, duration: .08 }, 0);
    }
    var T = fallTime(ty - y0);
    var rxT = Math.ceil(st.rx / TAU + 1 - 1e-6) * TAU;
    t.addLabel('fall');
    t.to(st, { y: ty, duration: T, ease: 'power2.in' }, 'fall');
    t.to(st, { x: targetX(idx), duration: T, ease: 'sine.inOut' }, 'fall');
    t.to(st, { rx: rxT, ry: '+=' + (1.5 * Math.PI), duration: T, ease: 'none' }, 'fall');
    t.to(st, { sx: .91, sy: 1.15, duration: Math.max(.05, T * .6), ease: 'power1.in' }, 'fall');
    // удар
    t.to(st, { sx: 1.22, sy: .74, duration: .06, ease: 'power2.out',
      onStart: function () { if (idx >= 7) dust(); else spawnLeaves(1); } });
    // отскоки
    var h1 = R * 1.1 / u, t1 = fallTime(h1), h2 = R * 0.35 / u, t2 = fallTime(h2);
    t.to(st, { y: ty - h1, sx: .96, sy: 1.05, duration: t1, ease: 'power2.out' });
    t.to(st, { y: ty, sx: 1, sy: 1, duration: t1, ease: 'power2.in' });
    t.to(st, { sx: 1.1, sy: .9, duration: .05, ease: 'power2.out' });
    t.to(st, { y: ty - h2, sx: 1, sy: 1, duration: t2, ease: 'power2.out' });
    t.to(st, { y: ty, duration: t2, ease: 'power2.in' });
    t.call(function () { flyIn(idx); });
    t.to(st, { sx: 1.05, sy: .95, duration: .05 }).to(st, { sx: 1, sy: 1, duration: .1 });
  }

  function rise(idx, ty) {
    moving = true;
    var t = gsap.timeline({ onComplete: function () { tl = null; moving = false; } });
    tl = t;
    var rxT = Math.round(st.rx / TAU) * TAU;
    t.to(st, { y: ty, x: targetX(idx), sx: 1, sy: 1, tilt: 0, rx: rxT, duration: 1, ease: 'power2.inOut' });
    t.call(function () { flyIn(idx); }, null, .75);
  }

  /* ---------- 3D-яблоко (three.js) ---------- */
  var gl = null;
  function webglOK() {
    try {
      var c = document.createElement('canvas');
      var ctx = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!ctx) return false;
      var ext = ctx.getExtension('WEBGL_lose_context');
      if (ext) ext.loseContext();
      return true;
    } catch (e) { return false; }
  }

  function initGL() {
    if (!window.THREE || !webglOK()) return null;
    var T3 = window.THREE;
    var renderer;
    try {
      renderer = new T3.WebGLRenderer({ canvas: canvas, alpha: true, antialias: true, powerPreference: 'low-power', premultipliedAlpha: true });
    } catch (e) { return null; }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    if ('outputColorSpace' in renderer) renderer.outputColorSpace = T3.SRGBColorSpace;
    renderer.toneMapping = T3.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    var scene = new T3.Scene();
    var camera = new T3.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    camera.position.set(0, 0, 500);

    scene.add(new T3.HemisphereLight(0xdfefff, 0x3c5a2a, 1.1));
    var sun = new T3.DirectionalLight(0xfff1d6, 2.3); sun.position.set(.8, 1.1, 1.2); scene.add(sun);
    var rim = new T3.DirectionalLight(0xbfe0ff, .9); rim.position.set(-1, .6, -1.2); scene.add(rim);
    var fill = new T3.DirectionalLight(0xffffff, .5); fill.position.set(-1, -.3, 1); scene.add(fill);

    // форма яблока
    var pts = [];
    for (var i = 0; i < 64; i++) {
      var t = Math.PI * i / 63;
      var r = Math.sin(t) * (1 + .07 * (-Math.cos(t))) * .97;
      var y = -Math.cos(t) - .30 * Math.exp(-Math.pow((Math.PI - t) / .42, 2)) + .14 * Math.exp(-Math.pow(t / .38, 2));
      pts.push(new T3.Vector2(Math.max(r, 0.0001), y));
    }
    var geo = new T3.LatheGeometry(pts, 72);
    geo.computeVertexNormals();
    var tex = new T3.TextureLoader().load(window.__SKIN, function () { dirty = true; });
    if ('colorSpace' in tex) tex.colorSpace = T3.SRGBColorSpace;
    tex.wrapS = T3.RepeatWrapping;
    tex.anisotropy = 4;
    var mat = new T3.MeshPhysicalMaterial({ map: tex, color: 0xffffff, roughness: .45, clearcoat: .55, clearcoatRoughness: .28 });
    var body = new T3.Mesh(geo, mat);

    var stemCurve = new T3.QuadraticBezierCurve3(new T3.Vector3(0, .6, 0), new T3.Vector3(.03, .9, 0), new T3.Vector3(.12, 1.18, 0));
    var stem = new T3.Mesh(new T3.TubeGeometry(stemCurve, 12, .045, 8, false), new T3.MeshStandardMaterial({ color: 0x5a3b22, roughness: .8 }));

    var ls = new T3.Shape();
    ls.moveTo(0, 0);
    ls.bezierCurveTo(.18, .12, .42, .12, .62, 0);
    ls.bezierCurveTo(.42, -.12, .18, -.12, 0, 0);
    var leaf = new T3.Mesh(new T3.ShapeGeometry(ls, 16), new T3.MeshStandardMaterial({ color: 0x4f9a3a, roughness: .6, side: T3.DoubleSide }));
    leaf.scale.setScalar(1.5);
    leaf.position.set(.1, 1.1, 0);
    leaf.rotation.set(.5, .3, .45);

    var spin = new T3.Group(); spin.add(body, stem, leaf);
    var tilt = new T3.Group(); tilt.add(spin);
    var squash = new T3.Group(); squash.add(tilt);
    scene.add(squash);

    // мягкая тень под яблоком
    var sc = document.createElement('canvas'); sc.width = sc.height = 64;
    var g2 = sc.getContext('2d'), gr = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g2.fillStyle = gr; g2.fillRect(0, 0, 64, 64);
    var shadow = new T3.Mesh(new T3.PlaneGeometry(1, 1), new T3.MeshBasicMaterial({ map: new T3.CanvasTexture(sc), transparent: true, depthWrite: false }));
    shadow.renderOrder = -1;
    scene.add(shadow);

    var dirty = true;
    function resize() {
      renderer.setSize(BOX, BOX);
      camera.left = -BOX / 2; camera.right = BOX / 2; camera.top = BOX / 2; camera.bottom = -BOX / 2;
      camera.updateProjectionMatrix();
      dirty = true;
    }
    function draw() {
      squash.scale.set(R * st.sx, R * st.sy, R);
      squash.position.y = -R * (1 - st.sy) * 0.9; // сплющивание от точки опоры
      tilt.rotation.set(st.rx, 0, -st.tilt);
      spin.rotation.y = st.ry;
      shadow.scale.set(R * 2.1 * st.sx, R * .55, 1);
      shadow.position.set(0, -R * 1.02, -R * 2);
      renderer.render(scene, camera);
    }
    return { resize: resize, draw: draw };
  }

  /* ---------- кадр ---------- */
  var lastKey = '';
  function frame(time, deltaMs) {
    var dt = Math.min(deltaMs / 1000, .1) * SPEED;
    var target = clamp(st.y * u - H / 2, 0, Math.max(0, SH - H));
    if (!camReady) { cam = target; camReady = true; }
    cam += (target - cam) * (1 - Math.exp(-dt * 6.5));
    var ay = st.y * u - cam;
    if (ay > H - R * 1.3) cam = st.y * u - (H - R * 1.3);
    if (ay < R * 1.6) cam = Math.max(0, st.y * u - R * 1.6);
    tree.style.transform = 'translate3d(' + offX.toFixed(2) + 'px,' + (-cam).toFixed(2) + 'px,0)';

    if (!reduce && !moving) st.ry += dt * 0.35;
    var p = appleScreen();
    if (gl) {
      canvas.style.transform = 'translate3d(' + (p.x - BOX / 2).toFixed(2) + 'px,' + (p.y - BOX / 2).toFixed(2) + 'px,0)';
      gl.draw();
    } else {
      var hs = R * 2.25;
      hero.style.transform = 'translate3d(' + (p.x - hs / 2).toFixed(2) + 'px,' + (p.y - hs / 2 - R * (1 - st.sy) * .9).toFixed(2) + 'px,0) rotate(' + (st.rx + st.tilt).toFixed(3) + 'rad) scale(' + st.sx.toFixed(3) + ',' + st.sy.toFixed(3) + ')';
    }
    if (leaves.length) tickLeaves(dt, time);
  }

  /* ---------- управление ---------- */
  var btnPrev = document.getElementById('btn-prev'), btnNext = document.getElementById('btn-next'), btnFs = document.getElementById('btn-fs');
  var numEl = document.getElementById('prog-num'), fillEl = document.getElementById('prog-fill');
  function updateUI() {
    numEl.textContent = (cur + 1) + ' / ' + N;
    fillEl.style.width = ((cur + 1) / N * 100) + '%';
    btnPrev.disabled = cur === 0;
    btnNext.disabled = cur === N - 1;
  }
  function noFocus(b) { b.addEventListener('mousedown', function (e) { e.preventDefault(); }); }
  [btnPrev, btnNext, btnFs].forEach(noFocus);
  btnPrev.addEventListener('click', function () { Reveal.prev(); this.blur(); });
  btnNext.addEventListener('click', function () { Reveal.next(); this.blur(); });
  var de = document.documentElement;
  var reqFs = de.requestFullscreen || de.webkitRequestFullscreen;
  var exitFs = document.exitFullscreen || document.webkitExitFullscreen;
  if (!reqFs || document.fullscreenEnabled === false || document.webkitFullscreenEnabled === false) {
    btnFs.style.display = 'none';
  } else {
    btnFs.addEventListener('click', function () {
      this.blur();
      try {
        var isFs = document.fullscreenElement || document.webkitFullscreenElement;
        var r = isFs ? exitFs.call(document) : reqFs.call(de);
        if (r && r.catch) r.catch(function () {});
      } catch (e) {}
    });
  }

  /* ---------- запуск ---------- */
  gl = initGL();
  if (!gl) root.classList.add('no-gl');
  layout();
  if (gl) gl.resize();
  window.addEventListener('resize', function () { layout(); camReady = false; });

  Reveal.initialize({
    width: 1280, height: 720, disableLayout: true,
    hash: false, history: false, respondToHashChanges: false, fragmentInURL: false,
    controls: false, progress: false, slideNumber: false, overview: false, help: false,
    center: false, transition: 'fade', transitionSpeed: 'fast', backgroundTransition: 'none',
    touch: true, loop: false, keyboard: { 13: 'next' }, postMessage: false, postMessageEvents: false,
    embedded: false, previewLinks: false, autoPlayMedia: false
  }).then(function () {
    cur = Reveal.getIndices().h || 0;
    st.y = targetY(cur); st.x = targetX(cur);
    if (cur > 0) firstDrop = false;
    updateUI();
    layout();
    gsap.ticker.add(frame);
    setTimeout(function () { flyIn(cur); }, reduce ? 0 : 350);
  });
  Reveal.on('slidechanged', function (e) { goTo(e.indexh); });

  // для проверок
  window.__pres = { st: st, get cam() { return cam; }, get R() { return R; }, get VS() { return VS; }, get BOX() { return BOX; },
    get gl() { return !!gl; }, apple: appleScreen, get moving() { return moving; },
    slideRect: function () { return { left: slideL, top: slideT, width: slideW, height: slideH }; } };
})();
