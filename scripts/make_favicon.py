"""Render favicon.svg to favicon-32.png and favicon-16.png via Pillow + Cairo-free raster (rsvg not required)."""

from pathlib import Path

# Minimal PNG writer using Pillow if available; else skip.
try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    raise SystemExit("Pillow required")

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT


def make_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    r = int(size * 0.22)
    # outer rounded square aubergine
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=r, fill=(44, 0, 30, 255))
    pad = max(1, size // 16)
    draw.rounded_rectangle(
        [pad, pad, size - 1 - pad, size - 1 - pad],
        radius=max(2, r - pad),
        fill=(24, 32, 41, 255),
    )
    text = "$_"
    # try monospaced fonts
    font = None
    for name in (
        "consola.ttf",
        "DejaVuSansMono.ttf",
        "arial.ttf",
        "Ubuntu-R.ttf",
    ):
        try:
            font = ImageFont.truetype(name, int(size * 0.42))
            break
        except OSError:
            continue
    if font is None:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    draw.text((x, y), text, fill=(233, 84, 32, 255), font=font)
    return img


for s in (32, 16, 180):
    path = OUT / (f"favicon-{s}.png" if s != 180 else "apple-touch-icon.png")
    make_icon(s).save(path)
    print("wrote", path.name, s)
