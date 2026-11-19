/* Император и старец — сцена: одно дерево, камера идёт по нему сверху вниз,
   на каждом слайде яблоко срывается и падает по кроне к следующей ветке,
   из него вылетают текст и анимированные схемы. */
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

  /* ---------- разметка фона: фото 1920x2560 = кадр 750 x 1000 единиц ---------- */
  var FW = 750, FH = 1000, CX = 355;      // CX — средняя линия кроны, на ней центр экрана
  /* Точки на реальных ветках по центру кроны, сверху вниз.
     hang — висит на черенке, rest — застряло в ветках, ground — трава у ствола. */
  var STOPS = [
    { x: 302, y: 255, m: 'hang' },   // 1 гроздь у верхушки
    { x: 338, y: 330, m: 'rest' },   // 2 ветка со второй гроздью
    { x: 378, y: 420, m: 'rest' },   // 3 светлая наклонная ветка
    { x: 410, y: 497, m: 'rest' },   // 4 тёмная толстая ветка
    { x: 392, y: 590, m: 'rest' },   // 5 ветка над развилкой
    { x: 322, y: 652, m: 'rest' },   // 6 нижняя гроздь у ствола
    { x: 362, y: 706, m: 'rest' },   // 7 нижняя ветка
    { x: 340, y: 858, m: 'ground' }  // 8 трава
  ];

  /* ---------- раскладка ---------- */
  var W, H, VS, slideL, slideT, slideW, slideH, u, offX, SH, R = 20, BOX = 0;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function layout() {
    W = window.innerWidth; H = window.innerHeight;
    var ph = (bar ? bar.offsetHeight : 44) + 14;
    VS = Math.min(0.94 * W / 1280, (H - ph - 20) / 720);
    slideW = 1280 * VS; slideH = 720 * VS;
    slideL = (W - slideW) / 2;
    slideT = Math.max(6, (H - ph - slideH) / 2);
    slidesEl.style.transform = 'translate(' + slideL + 'px,' + slideT + 'px) scale(' + VS + ')';
    u = Math.max(W / FW, 1.25 * H / FH) * 1.06;
    offX = Math.min(0, Math.max(W - FW * u, W / 2 - CX * u));
    SH = FH * u;
    // яблоко чуть крупнее яблок на фото, чтобы его было видно
    R = clamp(u * 8.6, 14, 38);
    tree.style.width = (FW * u) + 'px';
    tree.style.height = (FH * u) + 'px';
    hero.style.width = hero.style.height = (R * 2.25) + 'px';
    var nb = Math.ceil(R * 4.4);
    if (nb !== BOX) { BOX = nb; if (gl) gl.resize(); }
    if (st && !moving) { var rp = restPos(cur); st.x = rp.x; st.y = rp.y; }
  }

  /* ---------- состояние яблока (координаты — в единицах кадра) ---------- */
  var st = null;
  var cam = 0, camReady = false;
  var cur = 0, tl = null, firstDrop = true, moving = false, idleSw = 0, clock = 0;
  var TAU = Math.PI * 2;

  function Ru() { return R / u; }
  function stemL() { return Ru() * 1.15; }
  function restPos(i) {
    var s = STOPS[i];
    if (s.m === 'hang') return { x: s.x, y: s.y + stemL() };
    if (s.m === 'rest') return { x: s.x, y: s.y - Ru() * .85 };
    return { x: s.x, y: s.y - Ru() };
  }
  function disp() {
    var a = st.sw + idleSw, L = stemL();
    return { x: st.x + L * Math.sin(a), y: st.y - L * (1 - Math.cos(a)), a: a };
  }
  function appleScreen() {
    var d = disp();
    return { x: offX + d.x * u, y: d.y * u - cam };
  }

  /* ---------- листья и пыль ---------- */
  var leaves = [];
  function spawnLeaves(n, spread) {
    var p = appleScreen();
    for (var i = 0; i < n; i++) {
      var el = document.createElement('div');
      el.className = 'leaf';
      var s = R * (0.5 + Math.random() * 0.25);
      el.style.width = (s * 1.9) + 'px'; el.style.height = s + 'px';
      fx.appendChild(el);
      leaves.push({ el: el, x: p.x + (Math.random() - .5) * R * (spread || 1.6), wy: p.y + cam - R * (0.2 + Math.random() * 0.8),
        vx: (Math.random() - .5) * 90, vy: -30 - Math.random() * 60, r: Math.random() * 360,
        vr: (Math.random() - .5) * 300, ph: Math.random() * 6.28, age: 0 });
    }
  }
  function tickLeaves(dt, t) {
    for (var i = leaves.length - 1; i >= 0; i--) {
      var L = leaves[i];
      L.age += dt;
      L.vy = Math.min(L.vy + 220 * dt, 70);
      L.vx *= (1 - dt * 0.9);
      L.x += (L.vx + Math.sin(t * 2.6 + L.ph) * 45) * dt;
      L.wy += L.vy * dt;
      L.r += L.vr * dt;
      var sy = L.wy - cam;
      if (sy > H + 40 || L.age > 7) { L.el.remove(); leaves.splice(i, 1); continue; }
      L.el.style.transform = 'translate3d(' + L.x.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,0) rotate(' + L.r.toFixed(0) + 'deg) scaleY(' + Math.sin(t * 3.4 + L.ph).toFixed(2) + ')';
    }
  }
  function dust() {
    var p = appleScreen();
    for (var i = 0; i < 7; i++) {
      var el = document.createElement('div');
      el.className = 'dust';
      fx.appendChild(el);
      var dir = (i - 3) / 3;
      gsap.fromTo(el, { x: p.x - 13, y: p.y + R * 0.75 - 6, scale: .3, opacity: .8 },
        { x: p.x - 13 + dir * R * 2.4 + (Math.random() - .5) * 10, y: p.y + R * 0.75 - 6 - R * (0.3 + Math.random() * 0.6),
          scale: 1.2 + Math.random() * 0.8, opacity: 0, duration: 1.1, ease: 'power2.out',
          onComplete: function () { this.targets()[0].remove(); } });
    }
  }

  /* ---------- вылет текста и схем из яблока ---------- */
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
    if (reduce) { gsap.set(els, { opacity: 1, x: 0, y: 0, scale: 1 }); st.op = .4; return; }
    gsap.set(els, { x: 0, y: 0, scale: 1 });
    var p = appleScreen();
    // яблоко «раскрывается»: вспышка, затем уходит в тень под текстом
    gsap.timeline().to(st, { glow: 1, duration: .12, ease: 'power2.out' }).to(st, { glow: 0, duration: .5 });
    gsap.to(st, { op: .5, duration: .7, delay: .55, ease: 'power1.inOut' });
    els.forEach(function (e, k) {
      var r = e.getBoundingClientRect();
      var dx = (p.x - (r.left + r.width / 2)) / VS, dy = (p.y - (r.top + r.height / 2)) / VS;
      gsap.fromTo(e, { x: dx, y: dy, scale: .04, opacity: 0 },
        { x: 0, y: 0, scale: 1, opacity: 1, duration: .85, delay: k * .075, ease: 'power3.out',
          onStart: function () { playDiagram(e); } });
    });
  }

  /* ---------- падение по кроне ---------- */
  function fallTime(dyUnits) { return Math.sqrt(2 * Math.max(dyUnits, 0) * u / (2.6 * H)); }
  function nearTurn(v, dir) {
    return dir > 0 ? Math.ceil(v / TAU - 1e-6) * TAU : dir < 0 ? Math.floor(v / TAU + 1e-6) * TAU : Math.round(v / TAU) * TAU;
  }

  function goTo(idx) {
    if (idx === cur && tl) return;
    var interrupted = !!tl || moving;
    var from = cur;
    if (tl) { tl.kill(); tl = null; }
    if (cur !== idx) { var old = items(cur); gsap.killTweensOf(old); gsap.to(old, { opacity: 0, duration: .2 }); }
    cur = idx;
    hideSlide(idx);
    updateUI();
    gsap.killTweensOf(st, 'op');
    gsap.to(st, { op: 1, duration: .15 });
    var tp = restPos(idx);
    if (reduce) {
      st.x = tp.x; st.y = tp.y; st.sx = st.sy = 1; st.tilt = 0; st.sw = 0; st.rx = 0;
      flyIn(idx); return;
    }
    if (tp.y > st.y + 0.5) fall(idx, from, interrupted);
    else if (tp.y < st.y - 0.5) rise(idx);
    else flyIn(idx);
  }

  function fall(idx, from, interrupted) {
    moving = true;
    var t = gsap.timeline({ onComplete: function () { tl = null; moving = false; } });
    tl = t;
    if (!interrupted) {
      var s = STOPS[from];
      if (s.m === 'hang') {
        // качается на черенке и срывается
        var amps = firstDrop ? [.05, -.09, .13, -.17, .08] : [.06, -.1, .07];
        amps.forEach(function (a) { t.to(st, { sw: a * 1.5, duration: .1, ease: 'sine.inOut' }); });
        t.to(st, { sw: 0, y: '-=' + (Ru() * .2), sx: 1.05, sy: .95, duration: .09, ease: 'power1.out',
          onStart: function () { spawnLeaves(firstDrop ? 3 : 2); } });
      } else {
        // застрявшее в ветках: ветки поддаются, яблоко проскальзывает вниз
        [.05, -.07, .09].forEach(function (a) { t.to(st, { tilt: a, duration: .09, ease: 'sine.inOut' }); });
        t.to(st, { y: '+=' + (Ru() * .25), tilt: 0, duration: .12, ease: 'power1.in', onStart: function () { spawnLeaves(2); } });
      }
      firstDrop = false;
    } else {
      t.to(st, { sw: 0, duration: .08 }, 0);
    }
    t.call(function () { flight(t, idx); });
  }

  // полёт до следующей ветки по параболе и остановка в ветках
  function flight(t0, idx) {
    var t = gsap.timeline({ onComplete: function () { tl = null; moving = false; } });
    tl = t;
    var stop = STOPS[idx], tp = restPos(idx);
    var dy = tp.y - st.y, T = fallTime(dy);
    var dir = tp.x > st.x + .5 ? 1 : tp.x < st.x - .5 ? -1 : 0;
    var turns = dy * u > R * 6 ? 1 : 0;   // на длинном пролёте один медленный оборот
    t.addLabel('fall');
    t.to(st, { y: tp.y, duration: T, ease: 'power2.in' }, 'fall');
    t.to(st, { x: tp.x, duration: T, ease: 'none' }, 'fall');
    t.to(st, { rx: nearTurn(st.rx + turns * TAU * .5, 1), ry: '+=' + (0.6 * Math.PI), tilt: (dir || 1) * .25,
      duration: T, ease: 'sine.inOut' }, 'fall');
    t.to(st, { sx: .95, sy: 1.07, duration: Math.max(.05, T * .6), ease: 'power1.in' }, 'fall');
    // по пути задевает листву
    if (T > .25) t.call(function () { spawnLeaves(1); }, null, 'fall+=' + (T * .55));

    var ground = stop.m === 'ground';
    t.to(st, { sx: 1.16, sy: .82, tilt: 0, duration: .06, ease: 'power2.out',
      onStart: function () { if (ground) dust(); else spawnLeaves(3, 2.4); } });
    var h1 = (ground ? 1.0 : .3) * Ru(), t1 = fallTime(h1);
    t.to(st, { y: tp.y - h1, sx: .97, sy: 1.03, duration: t1, ease: 'power2.out' });
    t.to(st, { y: tp.y, sx: 1, sy: 1, duration: t1, ease: 'power2.in' });
    t.to(st, { sx: 1.07, sy: .93, duration: .05, ease: 'power2.out' });
    if (ground) {
      var h2 = Ru() * .3, t2 = fallTime(h2);
      t.to(st, { y: tp.y - h2, sx: 1, sy: 1, duration: t2, ease: 'power2.out' });
      t.to(st, { y: tp.y, duration: t2, ease: 'power2.in' });
    }
    t.call(function () { flyIn(idx); });
    // покачивается в ветках и замирает
    t.to(st, { sx: 1, sy: 1, duration: .1 });
    [.07, -.04, .015, 0].forEach(function (a) { t.to(st, { tilt: a, duration: .18, ease: 'sine.inOut' }); });
    t0.kill();
  }

  function rise(idx) {
    moving = true;
    var t = gsap.timeline({ onComplete: function () { tl = null; moving = false; } });
    tl = t;
    var tp = restPos(idx);
    t.to(st, { y: tp.y, x: tp.x, sx: 1, sy: 1, sw: 0, tilt: 0, rx: nearTurn(st.rx, 0), duration: 1, ease: 'power2.inOut' });
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
    renderer.toneMappingExposure = 1.1;

    var scene = new T3.Scene();
    var camera = new T3.OrthographicCamera(-1, 1, 1, -1, -2000, 2000);
    camera.position.set(0, 0, 500);

    // свет как на фото: яркое солнце сбоку-сверху, голубое небо, тёплый отсвет травы
    scene.add(new T3.HemisphereLight(0xcfe3ff, 0x6b7a3a, 1.0));
    var sun = new T3.DirectionalLight(0xfff0d8, 2.6); sun.position.set(-.9, 1.0, 1.1); scene.add(sun);
    var rim = new T3.DirectionalLight(0xd8ecff, .8); rim.position.set(1, .5, -1.2); scene.add(rim);
    var fill = new T3.DirectionalLight(0xffffff, .35); fill.position.set(.6, -.4, 1); scene.add(fill);

    // форма яблока: чуть шире сверху, впадины у черенка и снизу, лёгкая асимметрия
    var pts = [];
    for (var i = 0; i < 64; i++) {
      var t = Math.PI * i / 63;
      var r = Math.sin(t) * (1 + .09 * (-Math.cos(t))) * .97;
      var y = -Math.cos(t) * .94 - .32 * Math.exp(-Math.pow((Math.PI - t) / .4, 2)) + .16 * Math.exp(-Math.pow(t / .36, 2));
      pts.push(new T3.Vector2(Math.max(r, 0.0001), y));
    }
    var geo = new T3.LatheGeometry(pts, 96);
    // небольшие неровности по окружности — настоящие яблоки не идеально круглые
    var pos = geo.attributes.position;
    for (var k = 0; k < pos.count; k++) {
      var px = pos.getX(k), pz = pos.getZ(k), py = pos.getY(k);
      var ang = Math.atan2(pz, px);
      var f = 1 + .025 * Math.sin(ang * 5 + 1.3) * Math.max(0, py + .2) + .02 * Math.sin(ang * 2);
      pos.setX(k, px * f); pos.setZ(k, pz * f);
    }
    geo.computeVertexNormals();
    var tex = new T3.TextureLoader().load(window.__SKIN);
    if ('colorSpace' in tex) tex.colorSpace = T3.SRGBColorSpace;
    tex.wrapS = T3.RepeatWrapping;
    tex.anisotropy = 4;
    var bump = new T3.TextureLoader().load(window.__SKIN);
    bump.wrapS = T3.RepeatWrapping;
    var mat = new T3.MeshPhysicalMaterial({ map: tex, bumpMap: bump, bumpScale: .012, color: 0xffffff,
      roughness: .5, clearcoat: .35, clearcoatRoughness: .35, sheen: .3, sheenRoughness: .6, sheenColor: new T3.Color(0xffe2c0) });
    var body = new T3.Mesh(geo, mat);

    // черенок: тонкий, изогнутый, бурый с зеленоватым основанием
    var stemCurve = new T3.CubicBezierCurve3(new T3.Vector3(0, .55, 0), new T3.Vector3(.01, .8, 0),
      new T3.Vector3(.05, .98, 0), new T3.Vector3(.13, 1.16, .02));
    var stem = new T3.Mesh(new T3.TubeGeometry(stemCurve, 16, .032, 8, false),
      new T3.MeshStandardMaterial({ color: 0x5b4426, roughness: .85 }));
    var cap = new T3.Mesh(new T3.SphereGeometry(.036, 8, 6), stem.material);
    cap.position.set(.13, 1.16, .02);

    var spin = new T3.Group(); spin.add(body, stem, cap);
    var tilt = new T3.Group(); tilt.add(spin);
    var squash = new T3.Group(); squash.add(tilt);
    scene.add(squash);

    function resize() {
      renderer.setSize(BOX, BOX);
      camera.left = -BOX / 2; camera.right = BOX / 2; camera.top = BOX / 2; camera.bottom = -BOX / 2;
      camera.updateProjectionMatrix();
    }
    function draw() {
      squash.scale.set(R * st.sx, R * st.sy, R);
      squash.position.y = -R * (1 - st.sy) * 0.9;
      tilt.rotation.set(st.rx, 0, -st.tilt + disp().a);
      spin.rotation.y = st.ry;
      mat.emissive.setRGB(.35 * st.glow, .22 * st.glow, .08 * st.glow);
      renderer.render(scene, camera);
    }
    return { resize: resize, draw: draw };
  }

  /* ---------- кадр ---------- */
  function frame(time, deltaMs) {
    var dt = Math.min(deltaMs / 1000, .1) * SPEED;
    clock += dt;
    idleSw = (!reduce && !moving && STOPS[cur].m === 'hang') ? idleSw + (0.03 * Math.sin(clock * 1.7) - idleSw) * Math.min(1, dt * 3) : idleSw * Math.max(0, 1 - dt * 8);
    // камера держит яблоко чуть выше центра экрана
    var target = clamp(st.y * u - H * .46, 0, Math.max(0, SH - H));
    if (!camReady) { cam = target; camReady = true; }
    cam += (target - cam) * (1 - Math.exp(-dt * 6.5));
    var ay = st.y * u - cam;
    if (ay > H - R * 1.3) cam = st.y * u - (H - R * 1.3);
    if (ay < R * 1.6) cam = Math.max(0, st.y * u - R * 1.6);
    tree.style.transform = 'translate3d(' + offX.toFixed(2) + 'px,' + (-cam).toFixed(2) + 'px,0)';

    if (!reduce && !moving) st.ry += dt * 0.3;
    var p = appleScreen();
    var el = gl ? canvas : hero;
    el.style.opacity = st.op.toFixed(3);
    if (gl) {
      canvas.style.transform = 'translate3d(' + (p.x - BOX / 2).toFixed(2) + 'px,' + (p.y - BOX / 2).toFixed(2) + 'px,0)';
      gl.draw();
    } else {
      var hs = R * 2.25;
      hero.style.transform = 'translate3d(' + (p.x - hs / 2).toFixed(2) + 'px,' + (p.y - hs / 2 - R * (1 - st.sy) * .9).toFixed(2) + 'px,0) rotate(' + (st.rx + st.tilt - disp().a).toFixed(3) + 'rad) scale(' + st.sx.toFixed(3) + ',' + st.sy.toFixed(3) + ')';
    }
    if (leaves.length) tickLeaves(dt, clock);
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
  st = { x: 0, y: 0, tilt: 0, rx: 0, ry: 0, sx: 1, sy: 1, sw: 0, op: 1, glow: 0 };
  var rp0 = restPos(0); st.x = rp0.x; st.y = rp0.y;
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
    var rp = restPos(cur); st.y = rp.y; st.x = rp.x;
    if (cur > 0) firstDrop = false;
    updateUI();
    layout();
    gsap.ticker.add(frame);
    setTimeout(function () { flyIn(cur); }, reduce ? 0 : 450);
  });
  Reveal.on('slidechanged', function (e) { goTo(e.indexh); });

  // для проверок
  window.__pres = { st: st, get cam() { return cam; }, get R() { return R; }, get VS() { return VS; }, get BOX() { return BOX; },
    get gl() { return !!gl; }, apple: appleScreen, get moving() { return moving; },
    slideRect: function () { return { left: slideL, top: slideT, width: slideW, height: slideH }; } };
})();
