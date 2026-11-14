"""Draw the logo images for places outside the app: the Microsoft Store listing and YouTube.

    uvx --from playwright playwright install chromium-headless-shell   # once
    uvx --from playwright python packages/brand/make_logos.py

Writes PNGs to packages/brand/assets/logos/. Each is a small HTML page (the mark from
assets/logo-icon.svg, the word in Geist, the brand's colours) photographed at its exact size,
so they stay in step with the logo. Avatars keep the mark inside the circle YouTube cuts out.
"""
import base64
import re
from pathlib import Path

from playwright.sync_api import sync_playwright

BRAND = Path(__file__).resolve().parent
ROOT = BRAND.parents[1]
OUT = BRAND / "assets" / "logos"
FONT = ROOT / "node_modules" / "next" / "dist" / "next-devtools" / "server" / "font" / "geist-latin.woff2"

GROUND, INK, INK_2, SPROUT = "#0e0e13", "#ececf3", "#a9a9bd", "#7abf50"
TAGLINE = "A dividend tracker that runs on your own computer"

# The mark, cropped to what's drawn (the file leaves room under the vault)
_svg = (BRAND / "assets" / "logo-icon.svg").read_text()
MARK = re.sub(r'viewBox="[^"]+"', 'viewBox="7.5 3 180 200"', _svg, count=1)


def page(width: int, height: int, body: str, *, transparent: bool = False) -> str:
    font = base64.b64encode(FONT.read_bytes()).decode()
    glow = "" if transparent else (
        # A little light behind the mark, like the app's ambient glow
        f"background: radial-gradient(60% 50% at 50% 42%, rgba(122,191,80,0.10), transparent 70%), {GROUND};"
    )
    return f"""<!doctype html><meta charset="utf-8"><style>
@font-face {{ font-family: Geist; src: url(data:font/woff2;base64,{font}) format("woff2"); font-weight: 100 900; }}
html, body {{ margin: 0; position: relative; width: {width}px; height: {height}px; overflow: hidden; }}
body {{ {glow} font-family: Geist, sans-serif; color: {INK}; display: flex; align-items: center;
  justify-content: center; }}
.stack {{ display: flex; flex-direction: column; align-items: center; }}
.row {{ display: flex; align-items: center; }}
.word {{ font-weight: 600; letter-spacing: -0.02em; line-height: 1; }}
.word b {{ font-weight: 600; color: {SPROUT}; }}
.tag {{ color: {INK_2}; font-weight: 400; letter-spacing: -0.005em; line-height: 1.2; }}
svg {{ display: block; flex: none; }}
</style><body>{body}</body>"""


def mark(height: float) -> str:
    return MARK.replace("<svg ", f'<svg style="height:{height}px;width:{height * 0.9}px" ', 1)


WORD = "<b>Dividend</b>Case"


def mark_only(size: int, fill: float) -> str:
    return mark(size * fill)


def stacked(width: int, height: int, mark_h: float, word_px: float, gap: float) -> str:
    return (f'<div class="stack" style="gap:{gap}px">{mark(mark_h)}'
            f'<div class="word" style="font-size:{word_px}px">{WORD}</div></div>')


def lockup(mark_h: float, word_px: float, tag_px: float = 0) -> str:
    tag = f'<div class="tag" style="font-size:{tag_px}px;margin-top:{tag_px * 0.55}px">{TAGLINE}</div>' if tag_px else ""
    return (f'<div class="row" style="gap:{mark_h * 0.28}px">{mark(mark_h)}'
            f'<div><div class="word" style="font-size:{word_px}px">{WORD}</div>{tag}</div></div>')


def placed(body: str, x: float, y: float) -> str:
    """`body` centred on a point given as fractions of the image, not on its middle."""
    return (f'<div style="position:absolute;left:{x * 100}%;top:{y * 100}%;'
            f'transform:translate(-50%,-50%)">{body}</div>')


# name, width, height, body, transparent
IMAGES = [
    # Microsoft Store: Store logos
    ("store-poster-720x1080", 720, 1080, stacked(720, 1080, 330, 78, 64), False),
    ("store-poster-1440x2160", 1440, 2160, stacked(1440, 2160, 660, 156, 128), False),
    ("store-box-1080x1080", 1080, 1080, stacked(1080, 1080, 400, 104, 72), False),
    ("store-box-2160x2160", 2160, 2160, stacked(2160, 2160, 800, 208, 144), False),
    # Microsoft Store: Store display images
    ("store-tile-300x300", 300, 300, mark_only(300, 0.66), False),
    ("store-tile-150x150", 150, 150, mark_only(150, 0.66), False),
    ("store-tile-71x71", 71, 71, mark_only(71, 0.70), False),
    # Microsoft Store: hero art across the top of the listing. No title allowed, and the Store
    # writes the app's name over the lower left, so the mark sits to the right
    ("store-hero-1920x1080", 1920, 1080, placed(mark(520), 0.68, 0.46), False),
    ("store-hero-3840x2160", 3840, 2160, placed(mark(1040), 0.68, 0.46), False),
    # Xbox images (the app isn't offered on Xbox; these slots can stay empty). Titles must be
    # in the top three quarters; the featured square must have none
    ("xbox-key-art-584x800", 584, 800, placed(stacked(584, 800, 250, 62, 44), 0.5, 0.42), False),
    ("xbox-titled-hero-1920x1080", 1920, 1080, placed(lockup(300, 190), 0.5, 0.42), False),
    ("xbox-featured-square-1080x1080", 1080, 1080, mark_only(1080, 0.58), False),
    # YouTube: the picture is shown as a circle, so the mark stays well inside it
    ("youtube-avatar-800x800", 800, 800, mark_only(800, 0.62), False),
    # YouTube banner: 2560x1440, of which only the middle 1546x423 shows on every device
    ("youtube-banner-2560x1440", 2560, 1440, lockup(250, 132, 44), False),
    ("youtube-watermark-150x150", 150, 150, mark_only(150, 0.92), True),
    # General use: square, circle-safe, and the logo with its word on dark and on nothing
    ("mark-square-1024", 1024, 1024, mark_only(1024, 0.62), False),
    ("mark-transparent-1024", 1024, 1024, mark_only(1024, 0.92), True),
    ("logo-horizontal-dark-1600x500", 1600, 500, lockup(230, 150), False),
    ("logo-horizontal-transparent-1600x500", 1600, 500, lockup(230, 150), True),
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name, width, height, body, transparent in IMAGES:
            tab = browser.new_page(viewport={"width": width, "height": height})
            tab.set_content(page(width, height, body, transparent=transparent))
            tab.evaluate("document.fonts.ready")
            tab.screenshot(path=str(OUT / f"{name}.png"), omit_background=transparent)
            tab.close()
            print(f"{name}.png")
        browser.close()


if __name__ == "__main__":
    main()
