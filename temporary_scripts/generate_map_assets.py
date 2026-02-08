"""Generate base map WebP files and hi-res tiles from day/night sources.

Requires Pillow: pip install pillow

Usage (run from repo root):
    python scripts/generate_map_assets.py
"""
from pathlib import Path
from PIL import Image

BASE_SIZE = 2320
LEVELS = {
    1: {"size": BASE_SIZE},
    2: {"size": BASE_SIZE * 2, "grid": 3, "out_root": Path("map/tiles2x")},
    4: {"size": BASE_SIZE * 4, "grid": 5, "out_root": Path("map/tiles4x")},
}
SOURCES = {
    "light": Path("day.png"),
    "dark": Path("night.png"),
}
BASE_DIR = Path("map/base")
QUALITY = 90
WEBP_OPTS = {"format": "WEBP", "quality": QUALITY, "method": 6}

def center_square(img: Image.Image) -> Image.Image:
    w, h = img.size
    side = min(w, h)
    if w == h:
        return img
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))

def dist_sizes(total: int, parts: int):
    base = total // parts
    rem = total % parts
    return [base + 1 if i < rem else base for i in range(parts)]

def save_webp(img: Image.Image, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, **WEBP_OPTS)

def generate():
    for theme, src in SOURCES.items():
        img = Image.open(src)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGBA")
        img = center_square(img)

        scaled = {}
        for factor, cfg in LEVELS.items():
            size = cfg["size"]
            scaled[factor] = img.resize((size, size), Image.LANCZOS)

        save_webp(scaled[1], BASE_DIR / f"map_{theme}.webp")

        for factor, cfg in LEVELS.items():
            if factor == 1:
                continue
            grid = cfg["grid"]
            out_dir = cfg["out_root"] / theme
            widths = dist_sizes(scaled[factor].width, grid)
            heights = dist_sizes(scaled[factor].height, grid)
            y = 0
            for r, h in enumerate(heights):
                x = 0
                for c, w in enumerate(widths):
                    tile = scaled[factor].crop((x, y, x + w, y + h))
                    save_webp(tile, out_dir / f"map_{theme}@{factor}x_r{r}_c{c}.webp")
                    x += w
                y += h
    print("Generated base and tiles for:", ", ".join(SOURCES.keys()))

if __name__ == "__main__":
    generate()
