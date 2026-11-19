"""Собирает один самодостаточный HTML: dist/Prezentaciya_Aleksandr_I.html и ZIP для флешки.
Всё встроено (base64): библиотеки, стили, шрифт, фото, анимированные схемы. Без CDN.

Запуск:  npm install  ->  (схемы) /opt/mvenv/bin/python manim/render.py S2 ... S7  ->  python3 build.py
"""
import base64, io, json, os, re, struct, subprocess, sys, zipfile

SPEED = 1.5

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
NM = os.path.join(ROOT, 'node_modules')
DIST = os.path.join(ROOT, 'dist')
OUT_NAME = 'Prezentaciya_Aleksandr_I.html'


def read(p, mode='r'):
    with open(p, mode, **({} if 'b' in mode else {'encoding': 'utf-8'})) as f:
        return f.read()


def b64(p):
    return base64.b64encode(read(p, 'rb')).decode('ascii')


def data_uri(p, mime):
    return 'data:%s;base64,%s' % (mime, b64(p))


def webp_speed(data, k):
    """Делит длительность кадров анимированного WebP на k (чанк ANMF, 3 байта со смещением 12). Без пережатия."""
    out = bytearray(data)
    pos = 12
    n = 0
    while pos + 8 <= len(out):
        tag = bytes(out[pos:pos + 4])
        size = struct.unpack('<I', out[pos + 4:pos + 8])[0]
        if tag == b'ANMF':
            o = pos + 8 + 12
            d = out[o] | out[o + 1] << 8 | out[o + 2] << 16
            d = max(11, round(d / k))
            out[o:o + 3] = bytes((d & 255, d >> 8 & 255, d >> 16 & 255))
            n += 1
        pos += 8 + size + (size & 1)
    return bytes(out), n


def fonts_css():
    """Carlito (метрический аналог Calibri, OFL) — подмножество латиница + кириллица в WOFF2."""
    css = []
    try:
        from fontTools import subset
    except ImportError:
        print('fontTools не найден — шрифт не встраивается')
        return ''
    for weight, fn in ((400, 'Carlito-Regular.ttf'), (700, 'Carlito-Bold.ttf')):
        p = os.path.join('/usr/share/fonts/truetype/crosextra', fn)
        if not os.path.exists(p):
            p = os.path.join(SRC, 'assets', fn)
        if not os.path.exists(p):
            print('нет шрифта', fn); continue
        opts = subset.Options()
        opts.flavor = 'woff2'
        opts.layout_features = ['kern', 'liga', 'tnum', 'lnum']
        f = subset.load_font(p, opts)
        s = subset.Subsetter(opts)
        s.populate(unicodes=list(range(0x20, 0x7f)) + list(range(0xa0, 0x180)) + list(range(0x400, 0x460)) +
                   [0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x201e, 0x2022, 0x2026, 0x2116, 0x2192])
        s.subset(f)
        buf = io.BytesIO()
        subset.save_font(f, buf, opts)
        css.append("@font-face{font-family:'Carlito';font-style:normal;font-weight:%d;font-display:block;"
                   "src:url(data:font/woff2;base64,%s) format('woff2');}" % (weight, base64.b64encode(buf.getvalue()).decode()))
    return '\n'.join(css)


def main():
    os.makedirs(DIST, exist_ok=True)
    diagrams = {}
    finals = {}
    for n in range(2, 8):
        anim = os.path.join(SRC, 'diagrams', 's%d.webp' % n)
        fin = os.path.join(SRC, 'diagrams', 's%d_final.webp' % n)
        data, frames = webp_speed(read(anim, 'rb'), SPEED)
        diagrams[str(n)] = base64.b64encode(data).decode('ascii')
        finals[n] = data_uri(fin, 'image/webp')
        print('схема %d: %d кадров, %d КБ' % (n, frames, len(data) // 1024))

    slides = read(os.path.join(SRC, 'slides.html'))
    slides = re.sub(r'\{\{DIAGRAM_FINAL_(\d)\}\}', lambda m: finals[int(m.group(1))], slides)

    js = {
        'REVEAL_JS': read(os.path.join(NM, 'reveal.js', 'dist', 'reveal.js')),
        'GSAP_JS': read(os.path.join(NM, 'gsap', 'dist', 'gsap.min.js')),
        'THREE_JS': read(os.path.join(NM, 'three', 'build', 'three.min.js')),
        'APP_JS': read(os.path.join(SRC, 'app.js')),
        'DIAGRAMS': json.dumps(diagrams),
    }
    for k, v in js.items():
        if re.search(r'</script', v, re.I):
            sys.exit('В %s встречается </script> — встраивать нельзя' % k)

    parts = dict(js)
    parts.update({
        'FONTS': fonts_css(),
        'REVEAL_CSS': read(os.path.join(NM, 'reveal.js', 'dist', 'reveal.css')),
        'STYLE': read(os.path.join(SRC, 'style.css')),
        'TREE': data_uri(os.path.join(SRC, 'assets', 'tree.webp'), 'image/webp'),
        'APPLE': data_uri(os.path.join(SRC, 'assets', 'apple.webp'), 'image/webp'),
        'APPLE_SKIN': data_uri(os.path.join(SRC, 'assets', 'apple_skin.webp'), 'image/webp'),
        'SLIDES': slides,
        'SPEED': repr(SPEED),
    })
    tpl = read(os.path.join(SRC, 'template.html'))
    missing = set(re.findall(r'\{\{([A-Z_0-9]+)\}\}', tpl)) - set(parts)
    if missing:
        sys.exit('Нет значений для: %s' % ', '.join(sorted(missing)))
    # одна проходка по шаблону: вставленное содержимое повторно не разбирается
    html = re.sub(r'\{\{([A-Z_0-9]+)\}\}', lambda m: parts[m.group(1)], tpl)

    out = os.path.join(DIST, OUT_NAME)
    with open(out, 'w', encoding='utf-8') as f:
        f.write(html)
    print('%s: %.2f МБ' % (out, os.path.getsize(out) / 2**20))

    # версия для публикации ссылкой (без DOCTYPE/html/head/body)
    body = html
    head_inner = re.search(r'<head>(.*?)</head>', body, re.S).group(1)
    body_inner = re.search(r'<body>(.*)</body>', body, re.S).group(1)
    head_inner = re.sub(r'<meta charset="utf-8">\s*', '', head_inner)
    head_inner = re.sub(r'<meta name="viewport"[^>]*>\s*', '', head_inner)
    art = head_inner + '<style>:root{color-scheme:dark} html,body{background:#0f1a0e}</style>\n' + body_inner
    with open(os.path.join(DIST, 'artifact.html'), 'w', encoding='utf-8') as f:
        f.write(art)

    # ZIP для флешки
    zp = os.path.join(DIST, 'Prezentaciya_Aleksandr_I.zip')
    txt = read(os.path.join(ROOT, 'KAK_OTKRYT.txt')).replace('\r\n', '\n').replace('\n', '\r\n')
    with zipfile.ZipFile(zp, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        z.write(out, OUT_NAME)
        z.writestr('KAK_OTKRYT.txt', '﻿'.encode('utf-8') + txt.encode('utf-8'))
    print('%s: %.2f МБ' % (zp, os.path.getsize(zp) / 2**20))


if __name__ == '__main__':
    main()
