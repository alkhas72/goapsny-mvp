#!/usr/bin/env python3
# Сборка единого изображения-сетки из 8 скриншотов бенча z.
# 4 строки (экраны) × 2 колонки (тёмная | светлая) + подписи.
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

BASE = Path("/Users/alkhas.abaza/repo/goapsny-mvp--bench-bg-logo-z/ais-artifacts/bench-bg-logo/z")

# Порядок: (файл, подпись строки, колонка)
# Колонка 0 = тёмная, 1 = светлая
ROWS = [
    ("01-welcome",              "1. Приветствие — крупный лого + подложка"),
    ("02-splash",               "1b. Сплэш GPS — крупный лого + подложка"),
    ("03-no-map-profile",       "2. Профиль (без карты) — фирменная подложка"),
    ("04-header",               "3. Шапка — компактный лого"),
]
COLS = [("dark", "Тёмная"), ("light", "Светлая")]

THUMB_W = 360              # ширина превью телефона
GAP = 16                   # зазор между ячейками
LABEL_H = 26               # высота подписи строки слева
COL_LABEL_H = 30           # высота подписи колонки сверху
LEFT_PAD = 200             # место под подписи строк слева
TOP_PAD = COL_LABEL_H + 12
BG = (24, 24, 28)          # тёмный фон листа
TXT = (235, 235, 240)
SUBTXT = (170, 170, 180)
ACCENT = (255, 159, 64)    # оранжевый, как акцент заголовков

def load_font(size, bold=False):
    candidates = [
        "/System/Library/Fonts/Helvetica.ttc",
        "/System/Library/Fonts/SFNSDisplay.ttf",
        "/Library/Fonts/Arial.ttf",
    ]
    for c in candidates:
        if Path(c).exists():
            try:
                return ImageFont.truetype(c, size)
            except Exception:
                pass
    return ImageFont.load_default()

def fit(img, w):
    ratio = w / img.width
    return img.resize((w, int(img.height * ratio)), Image.LANCZOS)

# Подготовим превью и узнаем высоту
thumbs = {}
max_h = 0
for row_key, _ in ROWS:
    for col_key, _ in COLS:
        f = BASE / f"{row_key}-{col_key}.png"
        if not f.exists():
            sys.exit(f"нет файла {f}")
        img = Image.open(f).convert("RGB")
        img = fit(img, THUMB_W)
        thumbs[(row_key, col_key)] = img
        if img.height > max_h:
            max_h = img.height

n_rows = len(ROWS)
n_cols = len(COLS)
W = LEFT_PAD + n_cols * THUMB_W + (n_cols - 1) * GAP + 24
H = TOP_PAD + n_rows * (max_h + LABEL_H) + (n_rows - 1) * GAP + 24

canvas = Image.new("RGB", (W, H), BG)
draw = ImageDraw.Draw(canvas)

font_title = load_font(22, bold=True)
font_col = load_font(16, bold=True)
font_row = load_font(13)
font_row_sub = load_font(11)

# Заголовок листа
draw.text((16, -2), "Бенч z — подложка + логотип GoApsny", fill=ACCENT, font=font_title)

# Подписи колонок
for ci, (_, col_label) in enumerate(COLS):
    x = LEFT_PAD + ci * (THUMB_W + GAP) + THUMB_W // 2
    bbox = draw.textbbox((0, 0), col_label, font=font_col)
    tw = bbox[2] - bbox[0]
    draw.text((x - tw // 2, 2), col_label, fill=TXT, font=font_col)

# Разбивка подписи строки на две строки (номер+название)
for ri, (row_key, row_label) in enumerate(ROWS):
    y_top = TOP_PAD + ri * (max_h + LABEL_H + GAP)
    # номер и название
    if ". " in row_label:
        num, name = row_label.split(". ", 1)
    else:
        num, name = "", row_label
    draw.text((16, y_top + 4), num, fill=ACCENT, font=font_col)
    draw.text((40, y_top + 6), name, fill=TXT, font=font_row)
    for ci, (col_key, _) in enumerate(COLS):
        x = LEFT_PAD + ci * (THUMB_W + GAP)
        img = thumbs[(row_key, col_key)]
        # тонкая рамка
        canvas.paste(img, (x, y_top + LABEL_H))
        draw.rectangle(
            [x - 1, y_top + LABEL_H - 1, x + img.width, y_top + LABEL_H + img.height],
            outline=(60, 60, 68), width=1,
        )

out = BASE / "montage-z.png"
canvas.save(out, "PNG", optimize=True)
print(f"OK: {out} ({out.stat().st_size // 1024} KB, {W}x{H})")
