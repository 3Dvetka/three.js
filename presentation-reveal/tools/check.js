// Проверка презентации в Chromium (Playwright). Использование:
//   node tools/check.js [shots_dir]
const { chromium, devices } = require('playwright');
const path = require('path');
const fs = require('fs');

const FILE = path.resolve(__dirname, '..', 'dist', 'Prezentaciya_Aleksandr_I.html');
const URL = 'file://' + FILE;
const SHOTS = process.argv[2] || path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const GL_ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const sleep = ms => new Promise(r => setTimeout(r, ms));
let failures = 0;
function ok(cond, msg) { if (!cond) { failures++; console.log('  FAIL', msg); } }

// проверки одного слайда, выполняются внутри страницы
function inspect() {
  const P = window.__pres;
  const sec = document.querySelector('.reveal .slides > section.present');
  const sr = sec.getBoundingClientRect();
  const out = { n: sec.dataset.n, problems: [] };
  const els = [...sec.querySelectorAll('.a, .footer')];
  for (const e of els) {
    const r = e.getBoundingClientRect();
    if (r.left < sr.left - 1 || r.right > sr.right + 1 || r.top < sr.top - 1 || r.bottom > sr.bottom + 1)
      out.problems.push('за слайдом: ' + e.className + ' ' + e.textContent.slice(0, 30));
    if (getComputedStyle(e).opacity !== '1') out.problems.push('прозрачен: ' + e.textContent.slice(0, 30));
  }
  for (const e of sec.querySelectorAll('*')) {
    if (e.scrollHeight > e.clientHeight + 2 && getComputedStyle(e).overflow !== 'visible')
      out.problems.push('обрезка: ' + e.tagName + '.' + e.className);
    if (e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflow !== 'visible')
      out.problems.push('обрезка по ширине: ' + e.tagName + '.' + e.className);
  }
  // пересечения блоков (кроме вложенных)
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const a = els[i], b = els[j];
    if (a.contains(b) || b.contains(a)) continue;
    const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
    const ix = Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left);
    const iy = Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top);
    if (ix > 1 && iy > 1) out.problems.push('пересечение: ' + a.className + ' / ' + b.className);
  }
  // переполнение текста в колонках
  for (const c of sec.querySelectorAll('.col, .refs')) {
    const cr = c.getBoundingClientRect();
    for (const k of c.children) {
      const kr = k.getBoundingClientRect();
      if (kr.bottom > cr.bottom + 1 || kr.top < cr.top - 1) out.problems.push('выходит из колонки: ' + k.className);
    }
  }
  const bar = document.querySelector('.controls-bar').getBoundingClientRect();
  if (bar.top < sr.bottom - 1 && bar.right > sr.left && bar.left < sr.right) out.problems.push('панель налезает на слайд');
  const ap = P.apple(), R = P.R;
  if (ap.x - R < sr.right + 2 && ap.y + R > sr.top && ap.y - R < sr.bottom) out.problems.push('яблоко на слайде');
  if (ap.x + R > innerWidth || ap.y - R * 1.2 < 0 || ap.y + R > innerHeight) out.problems.push('яблоко за экраном ' + JSON.stringify(ap));
  const img = sec.querySelector('img.diagram');
  if (img) {
    if (!img.src.startsWith('blob:')) out.problems.push('схема не запущена');
    if (!img.complete || !img.naturalWidth) out.problems.push('схема не загружена');
  }
  out.apple = ap; out.gl = P.gl;
  return out;
}

async function walk(page, label, { useButtons = false, frame = null, shots = false } = {}) {
  const ctx = frame || page;
  await sleep(2600);
  for (let i = 0; i < 8; i++) {
    const r = await ctx.evaluate(inspect);
    ok(r.n == String(i + 1), `${label}: ожидался слайд ${i + 1}, а показан ${r.n}`);
    r.problems.forEach(p => ok(false, `${label} слайд ${r.n}: ${p}`));
    if (shots) { await sleep(1800); await page.screenshot({ path: path.join(SHOTS, `slide${i + 1}.png`) }); }
    if (i < 7) {
      if (useButtons) await ctx.click('#btn-next');
      else await page.keyboard.press('ArrowRight');
      await sleep(2700);
    }
  }
  console.log(`${label}: пройдено 8 слайдов`);
}

(async () => {
  const errors = [];
  const browser = await chromium.launch({ args: GL_ARGS });

  // 1. Компьютер 1600x900
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('desktop: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('desktop console: ' + m.text()); });
    await page.goto(URL);
    const gl = await page.evaluate(() => window.__pres.gl);
    ok(gl, 'desktop: 3D-яблоко (WebGL) не поднялось');
    await walk(page, 'desktop 1600x900', { shots: true });
    // назад
    await page.keyboard.press('ArrowLeft'); await sleep(2600);
    const back = await page.evaluate(inspect);
    ok(back.n === '7' && back.problems.length === 0, 'desktop: шаг назад ' + JSON.stringify(back.problems));
    // схемы на последнем кадре
    await ctx.close();
  }

  // 2. iPad
  {
    const ctx = await browser.newContext({ ...devices['iPad (gen 7) landscape'] });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('ipad: ' + e.message));
    await page.goto(URL);
    await walk(page, 'iPad landscape', { useButtons: true });
    await page.screenshot({ path: path.join(SHOTS, 'ipad_slide8.png') });
    await ctx.close();
  }

  // 3. Изолированная рамка (iframe sandbox="allow-scripts" srcdoc)
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 820 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push('sandbox outer: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('sandbox console: ' + m.text()); });
    const html = fs.readFileSync(FILE, 'utf8');
    await page.setContent('<!DOCTYPE html><body style="margin:0"><iframe id="f" sandbox="allow-scripts" style="border:0;width:100vw;height:100vh"></iframe></body>');
    await page.evaluate(h => { document.getElementById('f').srcdoc = h; }, html);
    await sleep(1500);
    const frame = page.frames().find(f => f !== page.mainFrame());
    await walk(page, 'iframe sandbox', { useButtons: true, frame });
    await page.screenshot({ path: path.join(SHOTS, 'sandbox_slide8.png') });
    await ctx.close();
  }

  // 4. Флешка: только file:, data:, blob:
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    let external = 0;
    await page.route('**/*', r => {
      const u = r.request().url();
      if (/^(file|data|blob):/.test(u)) return r.continue();
      external++; return r.abort();
    });
    page.on('pageerror', e => errors.push('offline: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('offline console: ' + m.text()); });
    const dir = path.join('/tmp', 'ФЛЕШКА E', 'Мои документы');
    fs.mkdirSync(dir, { recursive: true });
    require('child_process').execSync(`cd "${dir}" && unzip -o -q "${path.resolve(__dirname, '..', 'dist', 'Prezentaciya_Aleksandr_I.zip')}"`);
    await page.goto('file://' + encodeURI(path.join(dir, 'Prezentaciya_Aleksandr_I.html')));
    await sleep(2500);
    const imgs = await page.evaluate(() => [...document.images].map(i => i.complete && i.naturalWidth > 0));
    ok(imgs.every(Boolean), 'offline: не все картинки загрузились ' + JSON.stringify(imgs));
    // 5. Пульт: три PageDown подряд с интервалом 0,5 с
    await page.keyboard.press('PageDown'); await sleep(500);
    await page.keyboard.press('PageDown'); await sleep(500);
    await page.keyboard.press('PageDown'); await sleep(3200);
    const r = await page.evaluate(inspect);
    ok(r.n === '4', 'пульт: ожидался слайд 4, показан ' + r.n);
    r.problems.forEach(p => ok(false, 'пульт: ' + p));
    ok(external === 0, 'offline: внешних запросов ' + external);
    console.log(`флешка: картинок ${imgs.length}, внешних запросов ${external}; пульт: слайд ${r.n}`);
    await ctx.close();
  }

  // 6. Тайминги
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(URL); await sleep(2500);
    const t = await page.evaluate(() => new Promise(res => {
      const t0 = performance.now(); let land = 0, text = 0, diag = 0;
      const y0 = window.__pres.st.y;
      Reveal.next();
      const sec = document.querySelectorAll('.reveal .slides > section')[1];
      const img = sec.querySelector('img.diagram');
      (function poll() {
        const now = performance.now() - t0;
        if (!land && window.__pres.st.sy < .8) land = now;
        if (!diag && img.src.startsWith('blob:')) diag = now;
        const els = [...sec.querySelectorAll('.a, .footer')];
        if (!text && els.every(e => getComputedStyle(e).opacity === '1' && !e.style.transform.match(/scale\(0/) )) {
          const allDone = els.every(e => !gsap.isTweening(e));
          if (allDone) text = now;
        }
        if (now > 6000 || (land && text && diag)) return res({ land, text, diag });
        requestAnimationFrame(poll);
      })();
    }));
    console.log('тайминги, с: приземление', (t.land / 1000).toFixed(2), '| текст на месте', (t.text / 1000).toFixed(2), '| старт схемы', (t.diag / 1000).toFixed(2));
    await ctx.close();
  }
  await browser.close();

  // 7. Без WebGL
  {
    const b2 = await chromium.launch({ args: ['--disable-webgl', '--disable-3d-apis'] });
    const page = await b2.newPage({ viewport: { width: 1600, height: 900 } });
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    await page.goto(URL); await sleep(2500);
    const s = await page.evaluate(() => ({ gl: window.__pres.gl, hero: getComputedStyle(document.getElementById('hero')).display }));
    await page.keyboard.press('ArrowRight'); await sleep(2700);
    await page.screenshot({ path: path.join(SHOTS, 'nowebgl_slide2.png') });
    ok(!s.gl && s.hero === 'block', 'без WebGL: нет фото-яблока ' + JSON.stringify(s));
    ok(errs.filter(e => !/deprecated/i.test(e)).length === 0, 'без WebGL: ошибки ' + JSON.stringify(errs));
    console.log('без WebGL:', JSON.stringify(s), 'сообщений', errs.length);
    await b2.close();
  }

  // 8. «Телефон»: Pixel 7 + замедление процессора x4
  {
    const b3 = await chromium.launch({ args: GL_ARGS });
    const ctx = await b3.newContext({ ...devices['Pixel 7 landscape'] });
    const page = await ctx.newPage();
    await page.goto(URL); await sleep(2500);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.evaluate(() => Reveal.next());
    await sleep(4500);
    const fps = await page.evaluate(() => new Promise(res => {
      let n = 0; const t0 = performance.now();
      (function f() { n++; if (performance.now() - t0 < 2500) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); })();
    }));
    console.log('телефон (Pixel 7, CPU x4): кадров/с', fps.toFixed(1));
    ok(fps > 50, 'телефон: мало кадров ' + fps.toFixed(1));
    await page.screenshot({ path: path.join(SHOTS, 'phone_slide2.png') });
    await b3.close();
  }

  errors.forEach(e => ok(!/./.test(e) || /deprecated|THREE\.WebGLRenderer|GPU stall|GL Driver Message/i.test(e), 'ошибка: ' + e));
  console.log(failures ? `ПРОВАЛОВ: ${failures}` : 'ВСЁ ЧИСТО');
  process.exit(failures ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
