from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
ACTION_DIR = ROOT / "src" / "assets" / "actions"
OUT = ROOT / "src" / "assets" / "lulu-action-overview.png"
FRAME = 128
CELL_W = 152
CELL_H = 164
LABEL_H = 28
BG = (28, 30, 32, 255)
FG = (230, 230, 230, 255)
DIRECTIONS = ["e", "ne", "n", "nw", "w", "sw", "s", "se"]


def first_frame(path: Path) -> Image.Image:
    sheet = Image.open(path).convert("RGBA")
    return sheet.crop((0, 0, FRAME, FRAME))


def main():
    rows = [
        ["idle", "grabbed-neck", "dropped", "recover"],
        [f"curious-{d}" for d in DIRECTIONS],
        [f"walk-{d}" for d in DIRECTIONS],
        [f"play-{d}" for d in DIRECTIONS],
    ]
    cols = max(len(row) for row in rows)
    width = cols * CELL_W
    height = len(rows) * CELL_H
    canvas = Image.new("RGBA", (width, height), BG)
    draw = ImageDraw.Draw(canvas)

    for y, row in enumerate(rows):
        for x, name in enumerate(row):
            path = ACTION_DIR / f"{name}.png"
            if not path.exists():
                continue
            frame = first_frame(path)
            left = x * CELL_W + (CELL_W - FRAME) // 2
            top = y * CELL_H + LABEL_H
            canvas.alpha_composite(frame, (left, top))
            draw.text((x * CELL_W + 8, y * CELL_H + 6), name, fill=FG)

    canvas.save(OUT)
    print(OUT)


if __name__ == "__main__":
    main()
