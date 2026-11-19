"""Рендер одной схемы: python render.py S2  ->  ../src/diagrams/s2.webp + s2_final.webp
Прозрачный фон, 900 px по ширине, 30 к/с. Кадры PNG собираются PIL в анимированный WebP."""
import os, sys, glob, shutil, tempfile
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(HERE), 'src', 'diagrams')
os.makedirs(OUT, exist_ok=True)
sys.path.insert(0, HERE)

from manim import tempconfig, config
import diagrams


def render(name):
    cls = getattr(diagrams, name)
    H = cls.H
    tmp = tempfile.mkdtemp(prefix='mn_' + name)
    with tempconfig(dict(pixel_width=900, pixel_height=round(H * 1.5), frame_width=8.0,
                         frame_height=8.0 * H / 600, frame_rate=30, transparent=True,
                         format='png', media_dir=tmp, verbosity='WARNING',
                         disable_caching=True, progress_bar='none')):
        cls().render()
    frames = sorted(glob.glob(os.path.join(tmp, '**', '*.png'), recursive=True))
    frames = [f for f in frames if os.path.basename(f).startswith(name)]
    ims = [Image.open(f).convert('RGBA') for f in frames]
    n = name.lower()
    ims[0].save(os.path.join(OUT, n + '.webp'), 'WEBP', save_all=True, append_images=ims[1:],
                duration=round(1000 / 30), loop=1, quality=72, method=6, minimize_size=True, allow_mixed=True)
    ims[-1].save(os.path.join(OUT, n + '_final.webp'), 'WEBP', quality=88, method=6)
    ims[-1].save(os.path.join(tmp, '..', n + '_final.png'))
    print(name, len(ims), 'frames', os.path.getsize(os.path.join(OUT, n + '.webp')) // 1024, 'KB')
    shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    for a in sys.argv[1:]:
        render(a)
