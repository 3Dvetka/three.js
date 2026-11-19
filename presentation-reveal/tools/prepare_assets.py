"""Готовит фото-ресурсы: фон (яблоня), вырезанное фото-яблоко, кожуру для three.js.
Исходники (CC0, Wikimedia Commons) лежат в raw/:
  Tree_with_red_apples_in_Barkedal_2.jpg (миниатюра 3840px)
  Red_apple_with_leaf.jpg (миниатюра 1920px от оригинала 2048x1536)
"""
import os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, 'raw')
OUT = os.path.join(ROOT, 'src', 'assets')
os.makedirs(OUT, exist_ok=True)


def tree():
    # «Apple tree at Dehibolo 2021.jpg», PJakopin, CC BY 4.0 (миниатюра 1920x2560)
    im = Image.open(os.path.join(RAW, 'Apple_tree_at_Dehibolo_2021.jpg')).convert('RGB')
    im.save(os.path.join(OUT, 'tree.webp'), 'WEBP', quality=84, method=6)
    print('tree', im.size, os.path.getsize(os.path.join(OUT, 'tree.webp')))


def hull(points):
    pts = sorted(set(map(tuple, points)))
    def cross(o, a, b):
        return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])
    lo, up = [], []
    for p in pts:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 0:
            lo.pop()
        lo.append(p)
    for p in reversed(pts):
        while len(up) >= 2 and cross(up[-2], up[-1], p) <= 0:
            up.pop()
        up.append(p)
    return lo[:-1] + up[:-1]


def apple_photo():
    src = Image.open(os.path.join(RAW, 'Red_apple_with_leaf.jpg')).convert('RGB')
    k = src.width / 2048.0
    a = np.asarray(src).astype(np.int32)
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    red = (r > 18) & (r > g * 1.35) & (r > b * 1.2)
    # убираем мелкий шум: берём точки в центральной части, где лежит яблоко
    H, W = red.shape
    yy, xx = np.nonzero(red)
    keep = (xx > W * 0.18) & (xx < W * 0.86) & (yy > H * 0.10) & (yy < H * 0.97)
    pts = np.stack([xx[keep], yy[keep]], 1)[::7]
    hp = hull(pts)
    mask = Image.new('L', src.size, 0)
    ImageDraw.Draw(mask).polygon([tuple(map(float, p)) for p in hp], fill=255)
    mask = mask.filter(ImageFilter.GaussianBlur(1.8 * k * 2))
    bbox = mask.getbbox()
    rgba = src.copy(); rgba.putalpha(mask)
    rgba = rgba.crop(bbox)
    s = max(rgba.size)
    sq = Image.new('RGBA', (s, s), (0, 0, 0, 0))
    sq.paste(rgba, ((s - rgba.width) // 2, (s - rgba.height) // 2))
    sq = sq.resize((220, 220), Image.LANCZOS)
    sq.save(os.path.join(OUT, 'apple.webp'), 'WEBP', quality=86, method=6)
    print('apple', bbox, os.path.getsize(os.path.join(OUT, 'apple.webp')))


def periodic_noise(h, w, cutoff, rng):
    """Гладкий шум, бесшовный по обеим осям (фильтр в частотной области)."""
    n = rng.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None] * h
    fx = np.fft.fftfreq(w)[None, :] * w
    f = np.exp(-((fx / cutoff[0]) ** 2 + (fy / cutoff[1]) ** 2))
    out = np.real(np.fft.ifft2(np.fft.fft2(n) * f))
    out -= out.min(); out /= out.max()
    return out


def skin():
    """Кожура для 3D-яблока: жёлто-оранжевая основа, красный румянец полосками, светлые крапинки,
    фактура пор с ровного участка реального фото. Бесшовно по u. v=1 (верх картинки) — черенок."""
    H_, W_ = 512, 1024
    rng = np.random.default_rng(11)
    src = Image.open(os.path.join(RAW, 'Red_apple_with_leaf.jpg')).convert('RGB')
    k = src.width / 2048.0
    box = tuple(round(v * k) for v in (560, 680, 1080, 1200))
    c = src.crop(box).convert('L').resize((512, 512), Image.LANCZOS)
    a = np.asarray(c).astype(np.float32) + 1
    blur = np.asarray(c.filter(ImageFilter.GaussianBlur(18))).astype(np.float32) + 1
    detail = 1 + (a / blur - 1) * 0.45
    tile = np.concatenate([detail, detail[:, ::-1]], 1)
    tile = np.concatenate([tile[:256], tile[:256][::-1]], 0)
    tile = np.asarray(Image.fromarray(np.clip(tile * 128, 0, 255).astype(np.uint8)).resize((W_, H_), Image.LANCZOS)).astype(np.float32) / 128

    v = np.linspace(1, 0, H_)[:, None]          # 1 — верх (черенок), 0 — низ
    big = periodic_noise(H_, W_, (3, 2), rng)    # крупные пятна румянца
    streak = periodic_noise(H_, W_, (34, 2.5), rng)  # вертикальные полоски
    cov = 0.6 * big + 0.4 * streak + 0.3 * (v - 0.35)
    cov = np.clip((cov - 0.12) / 0.42, 0, 1)
    cov = cov ** 0.8
    ground = np.array([226, 182, 92], np.float32)   # жёлто-оранжевая основа
    blush = np.array([198, 58, 36], np.float32)     # румянец
    deep = np.array([150, 36, 26], np.float32)      # густой красный
    col = ground * (1 - cov[..., None]) + blush * cov[..., None]
    dd = np.clip((cov - 0.7) / 0.3, 0, 1)[..., None] * (0.35 + 0.4 * streak[..., None])
    col = col * (1 - dd) + deep * dd
    # у черенка — зеленовато-бурая воронка, снизу — тёмная чашечка
    top = np.clip((v - 0.9) / 0.1, 0, 1)[..., None]
    col = col * (1 - top * .55) + np.array([120, 104, 52], np.float32) * top * .55
    bot = np.clip((0.07 - v) / 0.07, 0, 1)[..., None]
    col = col * (1 - bot * .5) + np.array([110, 80, 40], np.float32) * bot * .5
    col *= tile[..., None]
    img = Image.fromarray(np.clip(col, 0, 255).astype(np.uint8))
    # светлые крапинки (чечевички): гуще и крупнее к низу
    d = ImageDraw.Draw(img)
    for _ in range(700):
        x = rng.uniform(0, W_); y = rng.uniform(H_ * .06, H_ * .92)
        r = rng.uniform(.6, 1.5) * (0.8 + 0.6 * y / H_)
        for xx in (x, x - W_, x + W_):
            d.ellipse([xx - r, y - r * .8, xx + r, y + r * .8], fill=(232, 196, 140))
    img = img.filter(ImageFilter.GaussianBlur(.5))
    img.save(os.path.join(OUT, 'apple_skin.webp'), 'WEBP', quality=88, method=6)
    print('skin', os.path.getsize(os.path.join(OUT, 'apple_skin.webp')))


if __name__ == '__main__':
    tree(); apple_photo(); skin()
