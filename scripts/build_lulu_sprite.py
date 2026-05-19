from pathlib import Path
import math

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    r"C:\Users\daiyuwei\.codex\generated_images\019e3ffc-3d3d-7c43-8844-dc2490b48576\ig_054528519faf27c3016a0c576800d88199a6ad1afa0a347ab8.png"
)
ASSET_DIR = ROOT / "src" / "assets"
FRAME_SIZE = 128
TARGET_SUBJECT_MAX = 84
BASELINE_Y = 116
BASE_COLS = 8
BASE_ROWS = 8
USED_ROWS = (0, 2, 3, 4, 5, 6, 7)


def remove_green_key(image: Image.Image) -> Image.Image:
    rgba = image.convert("RGBA")
    pixels = rgba.load()
    width, height = rgba.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            green_dominance = g - max(r, b)
            if g > 95 and green_dominance > 28 and g > r * 1.18 and g > b * 1.18:
                pixels[x, y] = (0, 0, 0, 0)
            elif g > 80 and green_dominance > 14:
                alpha = max(0, min(255, int((28 - green_dominance) / 14 * 255)))
                pixels[x, y] = (r, min(g, max(r, b) + 8), b, alpha)
            elif g > max(r, b) + 8:
                pixels[x, y] = (r, max(r, b) + 4, b, a)
    return rgba


def fit_frame(image: Image.Image, scale: float) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))

    cropped = image.crop(bbox)
    next_size = (
        max(1, round(cropped.width * scale)),
        max(1, round(cropped.height * scale)),
    )
    cropped = cropped.resize(next_size, Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = (FRAME_SIZE - cropped.width) // 2
    y = BASELINE_Y - cropped.height
    frame.alpha_composite(cropped, (x, y))
    return frame


def clamp(value, low, high):
    return max(low, min(high, value))


def main():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    source.save(ASSET_DIR / "lulu-generated-source.png")

    cell_w = source.width / BASE_COLS
    cell_h = source.height / BASE_ROWS
    keyed_cells = []
    bboxes = []
    for row in range(BASE_ROWS):
        if row not in USED_ROWS:
            continue
        for col in range(BASE_COLS):
            box = (
                round(col * cell_w),
                round(row * cell_h),
                round((col + 1) * cell_w),
                round((row + 1) * cell_h),
            )
            cell = remove_green_key(source.crop(box))
            keyed_cells.append(cell)
            bbox = cell.getchannel("A").getbbox()
            if bbox:
                bboxes.append((bbox[2] - bbox[0], bbox[3] - bbox[1]))

    max_w = max(width for width, _height in bboxes)
    max_h = max(height for _width, height in bboxes)
    shared_scale = min(TARGET_SUBJECT_MAX / max_w, TARGET_SUBJECT_MAX / max_h)

    base_frames = []
    for index, cell in enumerate(keyed_cells, start=1):
        frame = fit_frame(cell, shared_scale)
        base_frames.append(frame)
        frame.save(ASSET_DIR / f"lulu-base-{index:02d}.png")

    frames = base_frames
    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))
        frame.save(ASSET_DIR / f"lulu-frame-{index + 1:02d}.png")

    sheet.save(ASSET_DIR / "lulu-sprite-56.png")
    print(f"wrote {len(frames)} frames to {ASSET_DIR / 'lulu-sprite-56.png'}")


if __name__ == "__main__":
    main()
