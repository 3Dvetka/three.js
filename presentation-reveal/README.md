# Император и старец — презентация

8 слайдов (reveal.js 5.1.0 + GSAP 3.12.5 + three.js r160 + Manim Community 0.19.0), один офлайн-HTML.

Готовый файл: `dist/Prezentaciya_Aleksandr_I.html` (и ZIP для флешки с `KAK_OTKRYT.txt`).

Сборка:
1. `npm install`
2. Скачать исходные фото CC0 в `raw/` и выполнить `python3 tools/prepare_assets.py` (результат уже лежит в `src/assets/`).
3. Схемы: `python manim/render.py S2 S3 S4 S5 S6 S7` (Manim 0.19.0, нужен `libpango1.0-dev`; результат уже в `src/diagrams/`).
4. `python3 build.py` (для встраивания шрифта Carlito нужен `fonttools` + `brotli`).
5. Проверка: `node tools/check.js` (Playwright, Chromium).
