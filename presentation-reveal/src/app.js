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
  var FW = 750, FH = 1001, PX = 708;
  /* Реальные ветки на фото (точки в единицах кадра), сверху вниз.
     hang — яблоко висит на черенке под веткой, rest — лежит на ветке, ground — трава. s — наклон ветки. */
  var STOPS = [
    { x: 726, y: 160, m: 'hang', s: .55 },          // 1 светлая ветка у верхушки
    { x: 728, y: 212, m: 'rest', s: -.15 }, // 2 тонкая ветка
    { x: 720, y: 250, m: 'hang', s: .5 },          // 3 ветка с гроздью яблок
    { x: 695, y: 298, m: 'hang', s: .45 },          // 4 тёмная наклонная ветка
    { x: 698, y: 398, m: 'hang', s: .12 },          // 5 ветка между двумя яблоками
    { x: 680, y: 495, m: 'rest', s: -.03 }, // 6 почти горизонтальная ветка
    { x: 728, y: 532, m: 'rest', s: .26 },  // 7 нижняя ветка у ствола
    { x: 712, y: 905, m: 'ground' }         // 8 трава
  ];

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
    if (typeof st !== 'undefined' && !moving && camReady) { var rp = restPos(cur); st.x = rp.x; st.y = rp.y; }
    if (twigsEl) { if (twigs.length && Math.abs(twigs[0].Lp - twigLen() * u) < .5) placeTwigs(); else buildTwigs(); }
    SH = FH * u;
    tree.style.width = (FW * u) + 'px';
    tree.style.height = (FH * u) + 'px';
    hero.style.width = hero.style.height = (R * 2.25) + 'px';
    var nb = Math.ceil(R * 4.4);
    if (nb !== BOX) { BOX = nb; if (gl) gl.resize(); }
  }

  /* ---------- состояние яблока (y — в единицах кадра, x — смещение в единицах) ---------- */
  var st = { x: STOPS[0].x, y: STOPS[0].y, tilt: 0, rx: 0, ry: 0, sx: 1, sy: 1, sw: 0, att: 0 };
  var cam = 0, camReady = false;
  var cur = 0, tl = null, firstDrop = true, moving = false, idleSw = 0, clock = 0;

  function Ru() { return R / u; }
  function stemL() { return Ru() * 1.15; }           // от точки подвеса до центра яблока
  function restPos(i) {
    var s = STOPS[i];
    if (s.m === 'hang') return { x: s.x, y: s.y + stemL() };
    if (s.m === 'rest') return { x: s.x, y: s.y - Ru() * .9 };
    return { x: s.x, y: s.y - Ru() };
  }
  // положение с учётом раскачивания на черенке (sw — угол маятника)
  function disp() {
    var a = st.sw + idleSw, L = stemL();
    var by = (st.att >= 0 && twigs[st.att]) ? Math.sin(twigs[st.att].bend) * twigLen() * .75 : 0;
    return { x: st.x + L * Math.sin(a), y: st.y - L * (1 - Math.cos(a)) + by, a: a };
  }
  function appleScreen() {
    var d = disp();
    var x = offX + d.x * u;
    x = clamp(x, slideL + slideW + R + 6, W - R - 4);
    return { x: x, y: d.y * u - cam };
  }

  /* ---------- ветки: объёмные веточки поверх реальных веток фото, пружинят под яблоком ---------- */
  var twigsEl = document.getElementById('twigs');
  var twigs = [];
  var SVGNS = 'http://www.w3.org/2000/svg';
  function twigLen() { return Ru() * 4.2; }
  function el(tag, attrs, parent) {
    var e = document.createElementNS(SVGNS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function buildTwigs() {
    twigsEl.innerHTML = '';
    twigs.forEach(function (t) { t.dead = true; });
    var old = twigs; twigs = [];
    STOPS.forEach(function (stop, i) {
      if (stop.m === 'ground') { twigs.push(null); return; }
      var Lp = twigLen() * u, h = R * 3.2, c = h / 2, w0 = R * .36, w1 = R * .09;
      var svg = el('svg', { width: Lp.toFixed(1), height: h.toFixed(1), viewBox: '0 0 ' + Lp.toFixed(1) + ' ' + h.toFixed(1) });
      svg.setAttribute('class', 'twig');
      var defs = el('defs', {}, svg), id = 'bark' + i;
      var g = el('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
      el('stop', { offset: '0', 'stop-color': '#b3a58e' }, g);
      el('stop', { offset: '.45', 'stop-color': '#76644f' }, g);
      el('stop', { offset: '1', 'stop-color': '#352a21' }, g);
      var lg = el('linearGradient', { id: 'lf' + i, x1: 0, y1: 0, x2: 1, y2: 1 }, defs);
      el('stop', { offset: '0', 'stop-color': '#86bd5e' }, lg);
      el('stop', { offset: '1', 'stop-color': '#2f6127' }, lg);
      // боковой сучок
      var sx0 = Lp * .38, sy0 = c - w0 * .25;
      el('path', { d: 'M' + sx0 + ' ' + sy0 + ' Q' + (sx0 + Lp * .12) + ' ' + (c - R * .7) + ' ' + (sx0 + Lp * .22) + ' ' + (c - R * 1.15),
        stroke: 'url(#' + id + ')', 'stroke-width': (R * .11).toFixed(1), fill: 'none', 'stroke-linecap': 'round' }, svg);
      // ствол ветки: сужается от основания (x=0) к кончику (x=Lp)
      var bow = -R * .1;
      var d = 'M0 ' + (c - w0 / 2) +
        ' Q' + (Lp / 2) + ' ' + (c + bow - (w0 + w1) / 4) + ' ' + Lp + ' ' + (c - w1 / 2) +
        ' A' + (w1 / 2) + ' ' + (w1 / 2) + ' 0 0 1 ' + Lp + ' ' + (c + w1 / 2) +
        ' Q' + (Lp / 2) + ' ' + (c + bow + (w0 + w1) / 4) + ' 0 ' + (c + w0 / 2) + 'Z';
      el('path', { d: d, fill: 'url(#' + id + ')' }, svg);
      // лишайник на коре
      [[.12, -.05, .16], [.3, .06, .1], [.52, -.03, .08]].forEach(function (q) {
        el('ellipse', { cx: Lp * q[0], cy: c + R * q[1], rx: R * q[2], ry: R * q[2] * .45, fill: 'rgba(196,204,186,.55)' }, svg);
      });
      // листья
      [[.22, -1, -38], [.5, 1, 32], [.62, -1, -50], [.97, -1, -12]].forEach(function (q) {
        var lx = Lp * q[0], ly = c + q[1] * R * .05, len = R * .95, wd = R * .34;
        var gl2 = el('g', { transform: 'translate(' + lx + ' ' + ly + ') rotate(' + (q[1] < 0 ? 180 + q[2] : q[2]) + ')' }, svg);
        el('path', { d: 'M0 0 Q' + len / 2 + ' ' + (-wd) + ' ' + len + ' 0 Q' + len / 2 + ' ' + wd + ' 0 0Z', fill: 'url(#lf' + i + ')' }, gl2);
        el('path', { d: 'M0 0 L' + len * .92 + ' 0', stroke: 'rgba(220,240,190,.45)', 'stroke-width': '1', fill: 'none' }, gl2);
      });
      twigsEl.appendChild(svg);
      var prev = old[i];
      twigs.push({ el: svg, bend: prev ? prev.bend : 0, Lp: Lp, h: h, i: i, last: null });
    });
    placeTwigs();
  }
  function placeTwigs() {
    twigs.forEach(function (t) {
      if (!t) return;
      var stop = STOPS[t.i], s = stop.s || 0, n = Math.sqrt(1 + s * s);
      // точка крепления — там, где яблоко висит/лежит (с тем же ограничением по полю, что и яблоко)
      var ax = clamp(offX + stop.x * u, slideL + slideW + R + 6, W - R - 4), ay = stop.y * u;
      var bx = ax + .75 * t.Lp / n, by = ay + .75 * t.Lp * s / n;            // основание справа, к стволу
      t.ang = Math.atan2(-s, -1) * 180 / Math.PI;                            // от основания к кончику
      t.bx = bx; t.by = by; t.last = null;
    });
  }
  function drawTwigs() {
    for (var k = 0; k < twigs.length; k++) {
      var t = twigs[k];
      if (!t) continue;
      var key = t.bend.toFixed(4);
      if (key === t.last) continue;
      t.last = key;
      t.el.style.transform = 'translate3d(' + t.bx.toFixed(1) + 'px,' + (t.by - t.h / 2).toFixed(1) + 'px,0) rotate(' + (t.ang - t.bend * 180 / Math.PI).toFixed(2) + 'deg)';
    }
  }
  // ветка пружинит: прогиб amp (рад) и затухающие колебания
  function springTwig(i, amp, t, pos) {
    var tw = twigs[i];
    if (!tw) return;
    var tt = gsap.timeline();
    tt.to(tw, { bend: amp, duration: .07, ease: 'power2.out' })
      .to(tw, { bend: 0, duration: .9, ease: 'elastic.out(1.1, .32)' });
    if (t) t.add(tt, pos); else tt.play();
  }

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
    var from = cur;
    if (tl) { tl.kill(); tl = null; }
    if (cur !== idx) { var old = items(cur); gsap.killTweensOf(old); gsap.to(old, { opacity: 0, duration: .2 }); }
    cur = idx;
    hideSlide(idx);
    updateUI();
    var tp = restPos(idx);
    if (reduce) {
      st.x = tp.x; st.y = tp.y; st.sx = st.sy = 1; st.tilt = 0; st.sw = 0; st.rx = 0; st.att = STOPS[idx].m === 'ground' ? -1 : idx;
      flyIn(idx); return;
    }
    if (tp.y > st.y + 0.5) fall(idx, from, interrupted);
    else if (tp.y < st.y - 0.5) rise(idx);
    else flyIn(idx);
  }

  function nearTurn(v, dir) {
    return dir > 0 ? Math.ceil(v / TAU - 1e-6) * TAU : dir < 0 ? Math.floor(v / TAU + 1e-6) * TAU : Math.round(v / TAU) * TAU;
  }

  // отрыв от текущей ветки: сорваться с черенка или скатиться
  function leave(t, from, idx) {
    var s = STOPS[from], nx = STOPS[idx].x;
    if (s.m === 'hang') {
      var amps = firstDrop ? [.05, -.09, .13, -.17, .08] : [.06, -.1, .07];
      amps.forEach(function (a) { t.to(st, { sw: a * 1.6, duration: .1, ease: 'sine.inOut' }); });
      // черенок рвётся: яблоко дёргается вверх, слетают листья
      t.to(st, { sw: 0, y: '-=' + (Ru() * .22), sx: 1.06, sy: .94, duration: .09, ease: 'power1.out',
        onStart: function () { spawnLeaves(firstDrop ? 3 : 2); st.att = -1; springTwig(from, -.07); } });
    } else {
      // лежит на ветке: покачивается и скатывается к краю
      [.06, -.08, .1].forEach(function (a) { t.to(st, { tilt: a, duration: .1, ease: 'sine.inOut' }); });
      var dir = nx >= st.x ? 1 : -1, dist = Ru() * 1.2, slope = s.s || 0;
      t.to(st, { x: '+=' + dir * dist, y: '+=' + (slope * dir * dist - Ru() * .08), tilt: dir * dist / Ru(),
        duration: .32, ease: 'power1.in', onStart: function () { spawnLeaves(1); } });
      t.call(function () { st.att = -1; springTwig(from, -.05); });
    }
    firstDrop = false;
  }

  function fall(idx, from, interrupted) {
    moving = true;
    var t = gsap.timeline({ onComplete: function () { tl = null; moving = false; } });
    tl = t;
    if (!interrupted) leave(t, from, idx);
    else { st.att = -1; t.to(st, { sw: 0, duration: .08 }, 0); }
    t.call(function () { flight(t, idx); });
  }

  // полёт до следующей ветки и «приём» веткой; строится в момент отрыва, когда известна высота
  function flight(t0, idx) {
    var t = gsap.timeline({ onComplete: function () { tl = null; moving = false; } });
    tl = t;
    var stop = STOPS[idx], tp = restPos(idx);
    var dx = tp.x - st.x, dir = dx > .5 ? 1 : dx < -.5 ? -1 : 0;
    var yEnd = tp.y;                                              // проседание даёт сама ветка
    var T = fallTime(yEnd - st.y);
    t.addLabel('fall');
    t.to(st, { y: yEnd, duration: T, ease: 'power2.in' }, 'fall');
    t.to(st, { x: tp.x, duration: T, ease: 'none' }, 'fall');
    t.to(st, { rx: nearTurn(st.rx + TAU * .6, 1), ry: '+=' + (1.5 * Math.PI), tilt: nearTurn(st.tilt, dir || 1),
      duration: T, ease: 'none' }, 'fall');
    t.to(st, { sx: .91, sy: 1.15, duration: Math.max(.05, T * .6), ease: 'power1.in' }, 'fall');

    if (stop.m === 'hang') {
      // зацепился черенком: рывок, пружинит вверх и раскачивается
      var kick = (dir || (idx % 2 ? 1 : -1)) * .42;
      t.to(st, { sx: .94, sy: 1.12, sw: kick, duration: .07, ease: 'power2.out',
        onStart: function () { spawnLeaves(2); st.att = idx; springTwig(idx, .2); } });
      t.to(st, { sx: 1, sy: 1, duration: .32, ease: 'back.out(3)' }, '>');
      t.call(function () { flyIn(idx); }, null, '<');
      [-.26, .15, -.08, .03, 0].forEach(function (a, k) {
        t.to(st, { sw: a, duration: .26 - k * .02, ease: 'sine.inOut' }, k === 0 ? '<' : '>');
      });
    } else {
      var ground = stop.m === 'ground';
      t.to(st, { sx: 1.22, sy: .74, duration: .06, ease: 'power2.out',
        onStart: function () { if (ground) dust(); else { spawnLeaves(2); st.att = idx; springTwig(idx, .13); } } });
      var h1 = (ground ? 1.1 : .22) * Ru(), t1 = fallTime(h1);
      t.to(st, { y: tp.y - h1, sx: .96, sy: 1.05, duration: t1, ease: 'power2.out' });
      t.to(st, { y: tp.y, sx: 1, sy: 1, duration: t1, ease: 'power2.in' });
      t.to(st, { sx: 1.1, sy: .9, duration: .05, ease: 'power2.out' });
      if (ground) {
        var h2 = Ru() * .35, t2 = fallTime(h2);
        t.to(st, { y: tp.y - h2, sx: 1, sy: 1, duration: t2, ease: 'power2.out' });
        t.to(st, { y: tp.y, duration: t2, ease: 'power2.in' });
        t.call(function () { flyIn(idx); });
        t.to(st, { sx: 1.05, sy: .95, duration: .05 }).to(st, { sx: 1, sy: 1, duration: .1 });
      } else {
        // улёгся на ветку: перекатывается туда-сюда и замирает
        t.call(function () { flyIn(idx); });
        var base = st.tilt;
        t.to(st, { sx: 1, sy: 1, duration: .08 });
        [.16, -.1, .05, 0].forEach(function (a, k) {
          t.to(st, { x: tp.x + a * Ru() * .6, tilt: '+=' + 0, duration: .16, ease: 'sine.inOut',
            onUpdate: function () { st.tilt = Math.round(st.tilt / TAU) * TAU + (st.x - tp.x) / Ru(); } }, k === 0 ? '<' : '>');
        });
        t.to(st, { x: tp.x, duration: .05 });
      }
    }
    t0.kill();
  }

  function rise(idx) {
    moving = true;
    var t = gsap.timeline({ onComplete: function () { tl = null; moving = false; } });
    tl = t;
    var tp = restPos(idx);
    t.to(st, { y: tp.y, x: tp.x, sx: 1, sy: 1, sw: 0, tilt: nearTurn(st.tilt, 0), rx: nearTurn(st.rx, 0),
      duration: 1, ease: 'power2.inOut' });
    t.call(function () { flyIn(idx); }, null, .75);
    st.att = -1;
    t.call(function () { st.att = STOPS[idx].m === 'ground' ? -1 : idx; springTwig(idx, .06); });
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
      tilt.rotation.set(st.rx, 0, -st.tilt + disp().a);
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
    clock += dt;
    idleSw = (!reduce && !moving && STOPS[cur].m === 'hang') ? idleSw + (0.03 * Math.sin(clock * 1.7) - idleSw) * Math.min(1, dt * 3) : idleSw * Math.max(0, 1 - dt * 8);
    var target = clamp(st.y * u - H / 2, 0, Math.max(0, SH - H));
    if (!camReady) { cam = target; camReady = true; }
    cam += (target - cam) * (1 - Math.exp(-dt * 6.5));
    var ay = st.y * u - cam;
    if (ay > H - R * 1.3) cam = st.y * u - (H - R * 1.3);
    if (ay < R * 1.6) cam = Math.max(0, st.y * u - R * 1.6);
    tree.style.transform = 'translate3d(' + offX.toFixed(2) + 'px,' + (-cam).toFixed(2) + 'px,0)';
    twigsEl.style.transform = 'translate3d(0,' + (-cam).toFixed(2) + 'px,0)';
    drawTwigs();

    if (!reduce && !moving) st.ry += dt * 0.35;
    var p = appleScreen();
    if (gl) {
      canvas.style.transform = 'translate3d(' + (p.x - BOX / 2).toFixed(2) + 'px,' + (p.y - BOX / 2).toFixed(2) + 'px,0)';
      gl.draw();
    } else {
      var hs = R * 2.25;
      hero.style.transform = 'translate3d(' + (p.x - hs / 2).toFixed(2) + 'px,' + (p.y - hs / 2 - R * (1 - st.sy) * .9).toFixed(2) + 'px,0) rotate(' + (st.rx + st.tilt - disp().a).toFixed(3) + 'rad) scale(' + st.sx.toFixed(3) + ',' + st.sy.toFixed(3) + ')';
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
    var rp0 = restPos(cur); st.y = rp0.y; st.x = rp0.x;
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
