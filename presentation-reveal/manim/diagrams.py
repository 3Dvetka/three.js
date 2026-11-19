"""Анимированные схемы для слайдов 2–7 (Manim Community 0.19.0).
Макет: 600 x H px, 8 единиц Manim по ширине (U = 1/75)."""
import numpy as np
from manim import *

U = 1 / 75
FONT = "Carlito"
DARK = "#f3efe6"     # тёмная тема: светлый текст на тёмных плашках
DARK2 = "#c9c2b4"
GOLD = "#f2c86b"
# тёмные варианты той же палитры: верх лица, низ лица, кромка, цветной ободок
PAL = {
    "rose":  ("#4a302c", "#2f1e1c", "#6e4139", "#e3a397"),
    "sage":  ("#2f4636", "#1d2d22", "#45684f", "#9fd1b0"),
    "sky":   ("#2e3e55", "#1c2738", "#45618a", "#a9c6ee"),
    "lilac": ("#3c3555", "#262139", "#5f5590", "#c4b8f0"),
    "sand":  ("#4b3e26", "#2f2617", "#7d653a", "#ecd29c"),
}


class Diagram(Scene):
    H = 540

    def P(self, x, y):
        return np.array([(x - 300) * U, (self.H / 2 - y) * U, 0])

    def T(self, s, px, x, y, color=DARK, bold=False, align="c"):
        """Текст: (x, y) — центр строки по вертикали; align: c / l / r."""
        t = Text(s, font=FONT, font_size=px * 0.963, color=color,
                 weight=BOLD if bold else NORMAL)
        if align == "l":
            t.move_to(self.P(x, y), aligned_edge=LEFT)
        elif align == "r":
            t.move_to(self.P(x, y), aligned_edge=RIGHT)
        else:
            t.move_to(self.P(x, y))
        # выравниваем по высоте строчной буквы, а не по габариту
        return t

    def W(self, s, px, x, y, bold=False, align="c", color=WHITE):
        t = self.T(s, px, x, y, color=color, bold=bold, align=align)
        t.set_stroke(BLACK, 5, 0.45, background=True)
        return t

    def lines(self, rows, x, y, gap=1.18, align="c"):
        """rows: [(text, px, color, bold)] — строки, центрированные вокруг y."""
        total = sum(r[1] * gap for r in rows)
        cy = y - total / 2
        g = VGroup()
        for s, px, color, bold in rows:
            cy += px * gap / 2
            g.add(self.T(s, px, x, cy, color=color, bold=bold, align=align))
            cy += px * gap / 2
        return g

    def card(self, x, y, w, h, pal="sky", r=18, depth=6):
        """Мягкая пастельная плашка: тень, кромка, лицо с градиентом, блик."""
        light, main, edge, rim = PAL[pal]
        c = self.P(x + w / 2, y + h / 2)
        g = VGroup()
        for i, (grow, dy, op) in enumerate(((4, 10, .22), (9, 14, .14), (16, 18, .09))):
            s = RoundedRectangle(width=(w + grow) * U, height=(h + grow) * U,
                                 corner_radius=(r + grow / 2) * U, stroke_width=0)
            s.set_fill(BLACK, op).move_to(c + DOWN * dy * U)
            g.add(s)
        e = RoundedRectangle(width=w * U, height=h * U, corner_radius=r * U, stroke_width=0)
        e.set_fill(edge, 1).move_to(c + DOWN * depth * U)
        f = RoundedRectangle(width=w * U, height=h * U, corner_radius=r * U, stroke_width=0)
        f.set_fill([light, main], 1).set_sheen_direction(DOWN)
        f.set_stroke(rim, 1.6, .55)
        f.move_to(c)
        hl = RoundedRectangle(width=(w - 10) * U, height=h * .42 * U,
                              corner_radius=max(2, r - 4) * U, stroke_width=0)
        hl.set_fill([WHITE, WHITE], [0.10, 0.0]).set_sheen_direction(DOWN)
        hl.move_to(self.P(x + w / 2, y + 5 + h * .21))
        g.add(e, f, hl)
        return g

    def orb(self, r=11):
        g = VGroup()
        g.add(Circle(radius=(r + 7) * U, stroke_width=0).set_fill(GOLD, .18))
        g.add(Circle(radius=r * U, stroke_width=0).set_fill(["#fff3c9", GOLD, "#c89a3a"], 1).set_sheen_direction(DR))
        g.add(Circle(radius=r * .35 * U, stroke_width=0).set_fill(WHITE, .7).shift((-r * .3 * U) * RIGHT + (r * .3 * U) * UP))
        return g

    def bez(self, pts, color=GOLD, width=4, dashed=True):
        p = [self.P(*q) for q in pts]
        curve = CubicBezier(*p)
        curve.set_stroke(color, width)
        if dashed:
            return curve, DashedVMobject(curve, num_dashes=26, dashed_ratio=.55)
        return curve, curve

    def setup(self):
        self.camera.background_color = BLACK
        self.camera.background_opacity = 0


class S2(Diagram):
    H = 540

    def construct(self):
        title = self.W("Одна жизнь или две?", 32, 300, 34, bold=True)
        c1 = self.card(30, 100, 230, 210, "rose")
        t1 = self.lines([("1825", 50, DARK, True), ("Таганрог", 27, DARK, True),
                         ("смерть", 22, DARK2, False), ("Александра I", 22, DARK2, False)], 145, 205)
        c2 = self.card(340, 100, 230, 210, "sage")
        t2 = self.lines([("1837", 50, DARK, True), ("Томск", 27, DARK, True),
                         ("появление", 22, DARK2, False), ("старца", 22, DARK2, False)], 455, 205)
        g1, g2 = VGroup(c1, t1), VGroup(c2, t2)
        path, dash = self.bez([(145, 330), (170, 445), (430, 445), (455, 330)])
        ball = self.orb().move_to(path.get_start())
        plate = self.card(110, 430, 380, 66, "lilac", r=33)
        pt = self.T("12 лет между событиями", 27, 300, 463, bold=True)
        dash.set_z_index(1); ball.set_z_index(2)

        self.play(Write(title), run_time=.55)
        self.play(FadeIn(g1, shift=UP * .5), run_time=.45)
        self.play(FadeIn(g2, shift=UP * .5), run_time=.45)
        self.play(Create(dash), FadeIn(ball, scale=.3), run_time=.4)
        self.play(MoveAlongPath(ball, path), run_time=.6, rate_func=smooth)
        self.play(GrowFromCenter(VGroup(plate, pt)), run_time=.4)
        self.wait(.1)


class S3(Diagram):
    H = 540

    def construct(self):
        title = self.W("Жизнь Александра I", 32, 300, 34, bold=True)
        axis = Line(self.P(100, 92), self.P(100, 520), stroke_width=4, color=WHITE).set_opacity(.75)
        rows = [("1777", "sky", ["Рождение"]),
                ("1801", "lilac", ["Становится императором"]),
                ("1812", "rose", ["Война с Наполеоном"]),
                ("1814", "sage", ["Въезд в Париж во главе", "союзных войск"]),
                ("1825", "sand", ["Смерть в Таганроге,", "47 лет"])]
        self.play(Write(title), Create(axis), run_time=.55)
        for i, (yr, pal, txt) in enumerate(rows):
            y = 118 + i * 92
            pill = VGroup(self.card(32, y - 25, 136, 50, pal, r=25, depth=5),
                          self.T(yr, 28, 100, y, bold=True))
            n = len(txt)
            tl = VGroup(*[self.W(s, 25, 196, y + (k - (n - 1) / 2) * 29, align="l", bold=(k == 0))
                          for k, s in enumerate(txt)])
            self.play(GrowFromCenter(pill), FadeIn(tl, shift=LEFT * .6), run_time=.36)
        self.wait(.15)


class S4(Diagram):
    H = 520

    def construct(self):
        title = self.W("Путь легенды", 32, 300, 34, bold=True)
        bg = self.card(14, 72, 572, 430, "sky", r=24)
        bg[-2].set_fill(["#22302a", "#18221d"], 1).set_stroke("#6f8a78", 1.6, .55)
        bg[-3].set_fill("#3b4c40", 1)
        # контур суши
        land_pts = [(40, 470), (36, 300), (62, 190), (120, 130), (230, 112), (360, 98),
                    (470, 110), (560, 140), (566, 300), (552, 470)]
        land = Polygon(*[self.P(*p) for p in land_pts], stroke_width=0)
        land = land.round_corners(28 * U)
        land.set_fill(["#2d4232", "#233426"], 1).set_sheen_direction(DOWN)
        sea = Ellipse(width=95 * U, height=48 * U, stroke_width=0).set_fill("#26425e", 1).move_to(self.P(108, 458))
        sea_lbl = self.T("Чёрное море", 14, 108, 490, color="#8fb2d8")
        river1 = self.bez([(160, 140), (200, 230), (150, 320), (175, 420)], "#5f8fbf", 3, False)[0]
        river2 = self.bez([(430, 130), (460, 220), (440, 300), (470, 390)], "#5f8fbf", 3, False)[0]
        # горы «Урал»
        mts = VGroup()
        for i, (mx, my, s) in enumerate([(300, 170, 1.0), (285, 225, 1.15), (305, 285, 1.0), (290, 340, 1.1), (305, 395, .9)]):
            w, h = 52 * s, 44 * s
            tri = Polygon(self.P(mx - w / 2, my + h / 2), self.P(mx, my - h / 2), self.P(mx + w / 2, my + h / 2), stroke_width=0)
            tri.set_fill(["#9a8360", "#5e4c30"], 1).set_sheen_direction(DR)
            cap = Polygon(self.P(mx - w * .17, my - h * .5 + h * .34), self.P(mx, my - h / 2), self.P(mx + w * .17, my - h * .5 + h * .34), stroke_width=0)
            cap.set_fill("#e6e0d2", 1)
            mts.add(VGroup(tri, cap))
        ural = self.T("Урал", 20, 364, 292, color="#e0c999", bold=True)

        def pin(x, y, pal, label_rows, lx, ly, align="c"):
            light, main, edge, rim = PAL[pal]
            sh = Ellipse(width=22 * U, height=8 * U, stroke_width=0).set_fill(BLACK, .18).move_to(self.P(x, y + 2))
            head = Circle(radius=11 * U, stroke_width=3, stroke_color=rim).set_fill([light, main], 1).set_sheen_direction(DOWN)
            head.move_to(self.P(x, y - 22))
            stem = Polygon(self.P(x - 7, y - 16), self.P(x + 7, y - 16), self.P(x, y), stroke_width=0).set_fill(rim, 1)
            dot = Circle(radius=4 * U, stroke_width=0).set_fill(WHITE, 1).move_to(self.P(x, y - 22))
            lab = self.lines(label_rows, lx, ly, align=align)
            return VGroup(sh, stem, head, dot), lab

        spb, spb_l = pin(110, 205, "sky", [("Петербург", 21, DARK, True)], 110, 228)
        tag, tag_l = pin(200, 362, "rose", [("Таганрог", 21, DARK, True), ("1825, смерть царя", 17, DARK2, False)], 200, 394)
        tom, tom_l = pin(470, 240, "sage", [("Томск", 21, DARK, True), ("март 1837", 17, DARK2, False)], 470, 272)
        route, rdash = self.bez([(203, 345), (270, 280), (360, 190), (466, 226)], "#f2c86b", 4)
        note = self.T("Схема без масштаба", 15, 572, 486, color="#9fb0a3", align="r")

        self.play(Write(title), FadeIn(bg, scale=.85), run_time=.5)
        self.play(FadeIn(land, shift=UP * .3), FadeIn(sea), run_time=.35)
        self.play(Create(river1), Create(river2),
                  LaggedStart(*[GrowFromEdge(m, DOWN) for m in mts], lag_ratio=.15),
                  FadeIn(ural), FadeIn(sea_lbl), run_time=.55)
        self.play(LaggedStart(*[AnimationGroup(FadeIn(p, shift=DOWN * .8), FadeIn(l))
                                for p, l in ((spb, spb_l), (tag, tag_l), (tom, tom_l))], lag_ratio=.3), run_time=.6)
        self.play(Create(rdash), FadeIn(note), run_time=.55)
        self.wait(.1)


class S5(Diagram):
    H = 540

    def construct(self):
        title = self.W("Возраст в 1864 году", 32, 300, 34, bold=True)
        base_y = 410
        base = self.card(24, base_y, 552, 14, "sage", r=7, depth=3)
        data = [(80, "sand", "Старец", "одни источники", 120),
                (88, "rose", "Старец", "другие источники", 300),
                (86, "lilac", "Александр I", "род. в 1777 г.", 480)]
        k = 3.1
        self.play(Write(title), run_time=.45)
        self.play(GrowFromEdge(base, LEFT), run_time=.35)
        bars, nums, labs, trackers = [], [], [], []
        for v, pal, a, b, cx in data:
            h = v * k
            bar = self.card(cx - 62, base_y - h, 124, h, pal, r=14)
            bar.save_state()
            bar.stretch(0.02, 1, about_edge=DOWN)
            vt = ValueTracker(0)
            num = always_redraw(lambda vt=vt, bar=bar: self.W(str(int(round(vt.get_value()))), 44, 0, 0, bold=True)
                                .next_to(bar[-2], UP, buff=10 * U))
            lab = VGroup(self.W(a, 23, cx, base_y + 45, bold=True), self.W(b, 19, cx, base_y + 72))
            bars.append(bar); nums.append(num); labs.append(lab); trackers.append((vt, v))
        self.add(*bars, *nums)
        self.play(*[Restore(b, rate_func=rate_functions.ease_out_back) for b in bars],
                  *[vt.animate(rate_func=rate_functions.ease_out_cubic).set_value(v) for vt, v in trackers],
                  LaggedStart(*[FadeIn(l, shift=UP * .3) for l in labs], lag_ratio=.25),
                  run_time=1.1)
        for n in nums:
            n.clear_updaters()
        self.wait(.2)


class S6(Diagram):
    H = 560

    def construct(self):
        title = self.W("Чаша весов", 32, 300, 34, bold=True)
        steel = ["#f2f5f7", "#aeb8c0", "#6e7a84"]
        piv = self.P(300, 150)
        base = Polygon(self.P(210, 500), self.P(240, 470), self.P(360, 470), self.P(390, 500), stroke_width=0)
        base.set_fill(steel, 1).set_sheen_direction(DOWN)
        base_sh = Ellipse(width=230 * U, height=16 * U, stroke_width=0).set_fill(BLACK, .25).move_to(self.P(300, 504))
        post = Rectangle(width=16 * U, height=322 * U, stroke_width=0).set_fill(["#c6ced5", "#f4f6f8", "#8a959e"], 1)
        post.set_sheen_direction(RIGHT).move_to(self.P(300, 309))
        knob = VGroup(Circle(radius=15 * U, stroke_width=0).set_fill(steel, 1).set_sheen_direction(DR),
                      Circle(radius=5 * U, stroke_width=0).set_fill("#5f6a73", 1)).move_to(piv)
        top = Triangle(stroke_width=0).set_fill(steel, 1).scale_to_fit_width(26 * U).move_to(self.P(300, 128))

        L = 200
        theta = ValueTracker(-0.22)

        def beam():
            b = RoundedRectangle(width=2 * L * U + 20 * U, height=12 * U, corner_radius=6 * U, stroke_width=0)
            b.set_fill(["#f4f6f8", "#9aa5ae", "#6e7a84"], 1).set_sheen_direction(DOWN).move_to(piv)
            ends = VGroup(*[Circle(radius=7 * U, stroke_width=0).set_fill(steel, 1).move_to(piv + s * L * U * RIGHT) for s in (-1, 1)])
            return VGroup(b, ends).rotate(theta.get_value(), about_point=piv)

        def end(s):
            a = theta.get_value()
            return piv + np.array([s * L * U * np.cos(a), s * L * U * np.sin(a), 0])

        def pan(color_rows):
            g = VGroup()
            hang = 130
            for dx in (-72, 72):
                g.add(Line(ORIGIN, np.array([dx * U, -hang * U, 0]), stroke_width=2.2, color="#d7dde2"))
            bowl = ArcBetweenPoints(np.array([-82 * U, -hang * U, 0]), np.array([82 * U, -hang * U, 0]), angle=PI * .62)
            bowl = VGroup(bowl.copy().set_stroke(width=0).set_fill(steel, 1).set_sheen_direction(DOWN))
            rim = Line(np.array([-84 * U, -hang * U, 0]), np.array([84 * U, -hang * U, 0]), stroke_width=5, color="#e9eef2")
            g.add(bowl, rim)
            return g

        lp, rp = pan(None), pan(None)

        def cube(pal):
            light, main, edge, rim = PAL[pal]
            s = 34
            e = RoundedRectangle(width=s * U, height=s * U, corner_radius=6 * U, stroke_width=0).set_fill(edge, 1).shift(DOWN * 4 * U)
            f = RoundedRectangle(width=s * U, height=s * U, corner_radius=6 * U, stroke_width=0).set_fill([light, main], 1).set_sheen_direction(DOWN).set_stroke(rim, 1.6, .7)
            return VGroup(e, f)

        lc = [cube("sage") for _ in range(3)]
        rc = [cube("rose")]
        loff = [np.array([-38 * U, 0, 0]), np.array([0, 0, 0]), np.array([38 * U, 0, 0])]
        roff = [np.array([0, 0, 0])]

        def lay(group, s):
            group.move_to(end(s), aligned_edge=UP)
            group.shift(UP * 0)  # точка подвеса — верх группы

        def place_pan(p, s):
            hook = end(s)
            p.shift(hook - p[0].get_start())

        def cube_spot(s, off):
            return end(s) + np.array([0, -128 * U + 21 * U, 0]) + off

        b = always_redraw(beam)
        lp.add_updater(lambda m: place_pan(m, -1))
        rp.add_updater(lambda m: place_pan(m, 1))
        place_pan(lp, -1); place_pan(rp, 1)

        labL = VGroup(self.W("ЗА", 26, 100, 350, bold=True, color=GOLD), self.W("3 мнения,", 20, 100, 377),
                      self.W("косвенные признаки", 20, 100, 400))
        labR = VGroup(self.W("ПРОТИВ", 26, 500, 350, bold=True, color=GOLD), self.W("нет документов", 20, 500, 377),
                      self.W("о подмене", 20, 500, 400))
        foot = self.W("Спор не закончен", 26, 300, 535, bold=True)

        self.play(Write(title), FadeIn(base_sh), GrowFromEdge(base, DOWN), run_time=.4)
        self.play(GrowFromEdge(post, DOWN), run_time=.3)
        self.play(FadeIn(top), FadeIn(knob), FadeIn(b), FadeIn(lp), FadeIn(rp), run_time=.35)
        self.add(b, lp, rp, knob)
        anims = []
        for c, off in list(zip(lc, loff)):
            c.move_to(cube_spot(-1, off) + UP * 2.2)
        for c, off in list(zip(rc, roff)):
            c.move_to(cube_spot(1, off) + UP * 2.2)
        self.play(LaggedStart(*[c.animate(rate_func=rate_functions.ease_in_quad).move_to(cube_spot(-1, o)) for c, o in zip(lc, loff)],
                              *[c.animate(rate_func=rate_functions.ease_in_quad).move_to(cube_spot(1, o)) for c, o in zip(rc, roff)],
                              lag_ratio=.25), run_time=.6)
        for c, o in zip(lc, loff):
            c.add_updater(lambda m, o=o: m.move_to(cube_spot(-1, o)))
        for c, o in zip(rc, roff):
            c.add_updater(lambda m, o=o: m.move_to(cube_spot(1, o)))
        self.play(theta.animate(rate_func=rate_functions.ease_in_out_sine).set_value(0.08), run_time=.5)
        self.play(theta.animate(rate_func=rate_functions.ease_in_out_sine).set_value(0.0),
                  FadeIn(labL, shift=UP * .2), FadeIn(labR, shift=UP * .2), run_time=.45)
        self.play(FadeIn(foot, shift=UP * .2), run_time=.3)
        self.wait(.15)


class S7(Diagram):
    H = 540

    def construct(self):
        rows = [("lilac", "Характер царя", "усталость, вина, вера"),
                ("sky", "Легенда о Сибири", "внезапная смерть, старец"),
                ("sage", "Нет документов", "только косвенные признаки"),
                ("sand", "Спор продолжается", "тайна не разгадана")]
        y0, h, gap = 14, 96, 40
        for i, (pal, a, b) in enumerate(rows):
            y = y0 + i * (h + gap)
            plate = VGroup(self.card(50, y, 500, h, pal, r=22),
                           self.lines([(a, 29, DARK, True), (b, 22, DARK2, False)], 300, y + h / 2 - 1))
            anims = [FadeIn(plate, shift=UP * .45, scale=.92)]
            if i < 3:
                cy = y + h + gap / 2 + 3
                chev = VMobject(stroke_color=WHITE, stroke_width=6)
                chev.set_points_as_corners([self.P(282, cy - 8), self.P(300, cy + 8), self.P(318, cy - 8)])
                chev.set_stroke(WHITE, 6, .9)
                self.play(*anims, run_time=.42)
                self.play(Create(chev), run_time=.16)
            else:
                self.play(*anims, run_time=.42)
        self.wait(.2)
