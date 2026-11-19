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
    im = Image.open(os.path.join(RAW, 'Tree_with_red_apples_in_Barkedal_2.jpg')).convert('RGB')
    w = 2560
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, 'tree.webp'), 'WEBP', quality=80, method=6)
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


def skin():
    src = Image.open(os.path.join(RAW, 'Red_apple_with_leaf.jpg')).convert('RGB')
    k = src.width / 2048.0
    box = tuple(round(v * k) for v in (560, 680, 1080, 1200))
    c = src.crop(box).convert('L').resize((512, 512), Image.LANCZOS)
    a = np.asarray(c).astype(np.float32) + 1
    blur = np.asarray(c.filter(ImageFilter.GaussianBlur(18))).astype(np.float32) + 1
    detail = a / blur                      # только фактура (поры, крапинки)
    detail = 1 + (detail - 1) * 0.5        # в половину силы
    # зеркальный бесшовный тайл 1024x512 (по u дважды, зеркально)
    tile = np.concatenate([detail, detail[:, ::-1]], 1)
    tile = np.concatenate([tile[:256], tile[:256][::-1]], 0)  # бесшовно и по v
    tile = np.asarray(Image.fromarray(np.clip(tile * 128, 0, 255).astype(np.uint8)).resize((1024, 512), Image.LANCZOS)).astype(np.float32) / 128
    # градиент цвета снизу (v=0 — низ) вверх: в three.js LatheGeometry v=0 у низа
    stops = ['#c4963a', '#cd4e2c', '#c42a22', '#a01a18', '#601c12']
    stops = [np.array([int(s[i:i + 2], 16) for i in (1, 3, 5)], np.float32) for s in stops]
    pos = np.array([0.0, 0.16, 0.45, 0.8, 1.0])
    ys = np.linspace(0, 1, 512)
    grad = np.stack([np.interp(ys, pos, [s[ch] for s in stops]) for ch in range(3)], 1)
    grad = grad[::-1]  # строка 0 изображения — верх текстуры (v=1)
    img = np.repeat(grad[:, None, :], 1024, 1)
    # лёгкая неравномерность румянца
    rng = np.random.default_rng(7)
    noise = rng.random((16, 32)).astype(np.float32)
    noise = np.asarray(Image.fromarray((noise * 255).astype(np.uint8)).resize((1024, 512), Image.BICUBIC).filter(ImageFilter.GaussianBlur(30))).astype(np.float32) / 255
    blush = 0.88 + 0.24 * noise
    img = img * blush[..., None]
    img = img * tile[..., None]
    out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
    out.save(os.path.join(OUT, 'apple_skin.webp'), 'WEBP', quality=84, method=6)
    print('skin', os.path.getsize(os.path.join(OUT, 'apple_skin.webp')))


if __name__ == '__main__':
    tree(); apple_photo(); skin()
