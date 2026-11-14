"""Draw the Windows app's icons from the brand logo.

    uv run --no-project --with resvg-py --with pillow python packaging/windows/make_icons.py

Writes packaging/windows/assets/ (the tiles and icons the Microsoft Store package names in
its manifest, at each scale Windows asks for) and src/dividendcase/assets/tray.png (the
notification-area icon). The PNGs are committed; run this again only when the logo changes.
"""
import io
from pathlib import Path

import resvg_py
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LOGO = ROOT / "packages" / "brand" / "assets" / "logo-icon.svg"
ASSETS = Path(__file__).parent / "assets"
TRAY = ROOT / "src" / "dividendcase" / "assets" / "tray.png"

SCALES = (100, 125, 150, 200, 400)
TARGET_SIZES = (16, 24, 32, 48, 256)


def logo() -> Image.Image:
    """The logo, large, cropped to what's drawn."""
    png = resvg_py.svg_to_bytes(svg_string=LOGO.read_text(), width=1600)
    image = Image.open(io.BytesIO(bytes(png))).convert("RGBA")
    return image.crop(image.getbbox())


def square(source: Image.Image, size: int, fill: float) -> Image.Image:
    """The logo centred on a transparent square, its longer side `fill` of the square's."""
    scale = size * fill / max(source.size)
    w, h = (max(1, round(d * scale)) for d in source.size)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(source.resize((w, h), Image.LANCZOS), ((size - w) // 2, (size - h) // 2))
    return canvas


def main() -> None:
    source = logo()
    ASSETS.mkdir(parents=True, exist_ok=True)
    for old in ASSETS.glob("*.png"):
        old.unlink()
    for scale in SCALES:
        # Tiles leave room around the logo; the small icon nearly fills its square
        square(source, round(150 * scale / 100), 0.62).save(ASSETS / f"Square150x150Logo.scale-{scale}.png")
        square(source, round(44 * scale / 100), 0.86).save(ASSETS / f"Square44x44Logo.scale-{scale}.png")
        square(source, round(50 * scale / 100), 0.86).save(ASSETS / f"StoreLogo.scale-{scale}.png")
    for size in TARGET_SIZES:
        icon = square(source, size, 0.94)
        # Taskbar, Start and Alt+Tab use these; "unplated" means no coloured tile behind them,
        # on dark and on light taskbars
        for suffix in ("", "_altform-unplated", "_altform-lightunplated"):
            icon.save(ASSETS / f"Square44x44Logo.targetsize-{size}{suffix}.png")
    TRAY.parent.mkdir(parents=True, exist_ok=True)
    square(source, 64, 0.96).save(TRAY)
    print(f"{len(list(ASSETS.glob('*.png')))} icons in {ASSETS}, and {TRAY}")


if __name__ == "__main__":
    main()
