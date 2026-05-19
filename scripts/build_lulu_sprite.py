from pathlib import Path
import math

from PIL import Image, ImageChops


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    r"C:\Users\daiyuwei\.codex\generated_images\019e3ffc-3d3d-7c43-8844-dc2490b48576\ig_054528519faf27c3016a0c515935888199a021e3a4589d1ed3.png"
)
ASSET_DIR = ROOT / "src" / "assets"
FRAME_SIZE = 128
BASE_COLS = 4
BASE_ROWS = 2


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


def fit_frame(image: Image.Image) -> Image.Image:
    alpha = image.getchannel("A")
    bbox = alpha.getbbox()
    if not bbox:
        return Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))

    cropped = image.crop(bbox)
    cropped.thumbnail((108, 108), Image.Resampling.NEAREST)
    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = (FRAME_SIZE - cropped.width) // 2
    y = FRAME_SIZE - cropped.height - 10
    frame.alpha_composite(cropped, (x, y))
    return frame


def transform_frame(
    frame: Image.Image,
    dx: int = 0,
    dy: int = 0,
    rotate: float = 0,
    scale_x: float = 1,
    scale_y: float = 1,
) -> Image.Image:
    bbox = frame.getchannel("A").getbbox()
    if not bbox:
        return frame.copy()

    subject = frame.crop(bbox)
    next_size = (
        max(1, round(subject.width * scale_x)),
        max(1, round(subject.height * scale_y)),
    )
    subject = subject.resize(next_size, Image.Resampling.NEAREST)
    if rotate:
        subject = subject.rotate(rotate, resample=Image.Resampling.NEAREST, expand=True)

    result = Image.new("RGBA", frame.size, (0, 0, 0, 0))
    x = (FRAME_SIZE - subject.width) // 2 + dx
    y = FRAME_SIZE - subject.height - 10 + dy
    result.alpha_composite(subject, (x, y))
    return result


def make_frames(base):
    frames = []

    for i in range(12):
        blink = base[1] if i in (5, 6) else base[0]
        frames.append(transform_frame(blink, dy=round(math.sin(i / 12 * math.tau) * 1)))

    for i in range(8):
        frames.append(transform_frame(base[2], dx=round(math.sin(i / 8 * math.tau) * 2), rotate=math.sin(i / 8 * math.tau) * 1.5))

    for i in range(12):
        pose = base[3] if i % 4 < 2 else base[4]
        frames.append(transform_frame(pose, dx=round(math.sin(i / 12 * math.tau) * 3), dy=-1 if i % 4 < 2 else 1))

    for i in range(10):
        frames.append(transform_frame(base[5], dx=round(math.sin(i / 10 * math.tau) * 3), dy=round(math.cos(i / 10 * math.tau) * 2), rotate=math.sin(i / 10 * math.tau) * 4))

    for i in range(6):
        squeeze = 1 - abs(2.5 - i) / 16
        frames.append(transform_frame(base[6], dy=3 - i, scale_x=1.03 + squeeze * 0.04, scale_y=0.94 - squeeze * 0.02))

    for i in range(8):
        frames.append(transform_frame(base[7], dy=round(math.sin(i / 8 * math.tau) * 1)))

    return frames


def main():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    source.save(ASSET_DIR / "lulu-generated-source.png")

    cell_w = source.width / BASE_COLS
    cell_h = source.height / BASE_ROWS
    base_frames = []
    for row in range(BASE_ROWS):
        for col in range(BASE_COLS):
            box = (
                round(col * cell_w),
                round(row * cell_h),
                round((col + 1) * cell_w),
                round((row + 1) * cell_h),
            )
            cell = remove_green_key(source.crop(box))
            frame = fit_frame(cell)
            base_frames.append(frame)
            frame.save(ASSET_DIR / f"lulu-base-{len(base_frames):02d}.png")

    frames = make_frames(base_frames)
    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))
        frame.save(ASSET_DIR / f"lulu-frame-{index + 1:02d}.png")

    sheet.save(ASSET_DIR / "lulu-sprite-56.png")
    print(f"wrote {len(frames)} frames to {ASSET_DIR / 'lulu-sprite-56.png'}")


if __name__ == "__main__":
    main()
