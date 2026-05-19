from pathlib import Path
import math
import json

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(
    r"C:\Users\daiyuwei\.codex\generated_images\019e3ffc-3d3d-7c43-8844-dc2490b48576\ig_054528519faf27c3016a0c515935888199a021e3a4589d1ed3.png"
)
ASSET_DIR = ROOT / "src" / "assets"
ACTION_DIR = ASSET_DIR / "actions"
FRAME_SIZE = 128
BASE_COLS = 4
BASE_ROWS = 2
BASELINE_Y = 116
TARGET_SUBJECT_MAX = 104
STATE_TARGETS = {
    "idle": {"width": 104, "height": 82, "baseline": 116},
    "curious": {"width": 104, "height": 74, "baseline": 116},
    "walk": {"width": 104, "height": 86, "baseline": 116},
    "play": {"width": 106, "height": 88, "baseline": 116},
    "grabbed": {"width": 72, "height": 110, "baseline": 121},
    "dropped": {"width": 108, "height": 70, "baseline": 118},
    "recover": {"width": 102, "height": 84, "baseline": 116},
}
DIRECTIONS = ("e", "ne", "n", "nw", "w", "sw", "s", "se")


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


def remove_cursor_from_cell(image: Image.Image, cell_index: int) -> Image.Image:
    if cell_index not in (2, 4):
        return image

    rgba = image.copy()
    pixels = rgba.load()
    width, height = rgba.size
    # The reference sheet includes a drawn mouse cursor in two cells. Remove
    # only that lower-left cursor area, preserving white whiskers elsewhere.
    if cell_index == 2:
        region = (0, int(height * 0.52), int(width * 0.48), height)
    else:
        region = (0, int(height * 0.50), int(width * 0.36), height)

    x1, y1, x2, y2 = region
    for y in range(y1, y2):
        for x in range(x1, x2):
            r, g, b, a = pixels[x, y]
            bright_cursor = r > 210 and g > 210 and b > 210
            dark_cursor = r < 45 and g < 45 and b < 45
            if bright_cursor or dark_cursor:
                pixels[x, y] = (0, 0, 0, 0)
    return rgba


def clamp(value: int, low: int, high: int) -> int:
    return max(low, min(high, value))


def subject_bbox(image: Image.Image):
    return image.getchannel("A").getbbox()


def fit_frame(image: Image.Image, scale: float, x_bias: int = 0, y_bias: int = 0) -> Image.Image:
    bbox = subject_bbox(image)
    if not bbox:
        return Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))

    subject = image.crop(bbox)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.NEAREST,
    )
    return place_subject(subject, x_bias, y_bias)


def place_subject(subject: Image.Image, x_bias: int = 0, y_bias: int = 0, baseline: int = BASELINE_Y) -> Image.Image:
    if subject.width > FRAME_SIZE - 10 or subject.height > FRAME_SIZE - 10:
        subject.thumbnail((FRAME_SIZE - 10, FRAME_SIZE - 10), Image.Resampling.NEAREST)

    frame = Image.new("RGBA", (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
    x = clamp((FRAME_SIZE - subject.width) // 2 + x_bias, 4, FRAME_SIZE - subject.width - 4)
    y = clamp(baseline - subject.height + y_bias, 4, FRAME_SIZE - subject.height - 4)
    frame.alpha_composite(subject, (x, y))
    return frame


def normalize_for_state(frame: Image.Image, state_name: str, dx: int = 0, dy: int = 0) -> Image.Image:
    bbox = subject_bbox(frame)
    if not bbox:
        return frame.copy()

    subject = frame.crop(bbox)
    target = STATE_TARGETS[state_name]
    scale = min(target["width"] / subject.width, target["height"] / subject.height)
    subject = subject.resize(
        (max(1, round(subject.width * scale)), max(1, round(subject.height * scale))),
        Image.Resampling.NEAREST,
    )
    return place_subject(subject, dx, dy, target["baseline"])


def mirror_frame(frame: Image.Image) -> Image.Image:
    return frame.transpose(Image.Transpose.FLIP_LEFT_RIGHT)


def offset_frame(frame: Image.Image, dx: int = 0, dy: int = 0) -> Image.Image:
    bbox = subject_bbox(frame)
    if not bbox:
        return frame.copy()
    subject = frame.crop(bbox)
    return place_subject(subject, dx, dy, bbox[3] + dy)


def direction_frame(frame: Image.Image, direction: str) -> Image.Image:
    next_frame = mirror_frame(frame) if "w" in direction else frame.copy()
    offsets = {
        "e": (1, 0),
        "ne": (1, -2),
        "n": (0, -3),
        "nw": (-1, -2),
        "w": (-1, 0),
        "sw": (-1, 2),
        "s": (0, 3),
        "se": (1, 2),
    }
    dx, dy = offsets[direction]
    return offset_frame(next_frame, dx, dy)


def pingpong(values):
    return values + values[-2:0:-1]


def make_frames(base):
    idle_open, _idle_blink, crouch, stretch, reach, grabbed, flat, loaf = base
    frames = []

    # 0-31 idle: use the same source pose every frame to prevent visual scale flicker.
    for i in range(32):
        frames.append(normalize_for_state(idle_open, "idle"))

    # 32-47 curious: crouch/look-near, gentle forward interest.
    for i in range(16):
        dx = round(math.sin(i / 16 * math.tau) * 1)
        dy = -1 if 4 <= i <= 10 else 0
        frames.append(normalize_for_state(crouch, "curious", dx=dx, dy=dy))

    # 48-67 approach: actual walking/creeping pose sequence, not idle.
    walk_steps = pingpong([-5, -3, 0, 3, 5])
    for i in range(20):
        pose = stretch if i % 2 else reach
        frames.append(normalize_for_state(pose, "walk", dx=walk_steps[i % len(walk_steps)], dy=0 if i % 2 else 1))

    # 68-91 play: reach and paw tap loop.
    for i in range(24):
        pose = reach if i % 6 < 3 else stretch
        tap = -3 if i % 6 in (1, 2) else 0
        frames.append(normalize_for_state(pose, "play", dx=round(math.sin(i / 24 * math.tau) * 2), dy=tap))

    # 92-107 grabbed: held by back of neck, subtle body sway only.
    for i in range(16):
        frames.append(normalize_for_state(grabbed, "grabbed", dx=round(math.sin(i / 16 * math.tau) * 2), dy=round(math.cos(i / 16 * math.tau) * 1)))

    # 108-119 dropped: soft landing using flat/squash.
    for i in range(12):
        frames.append(normalize_for_state(flat, "dropped", dy=3 - min(i, 5)))

    # 120-127 recover: loaf settles back into idle.
    for i in range(8):
        pose = loaf if i < 5 else idle_open
        frames.append(normalize_for_state(pose, "recover", dy=round(math.sin(i / 8 * math.tau) * 1)))

    assert len(frames) == 128
    return frames


def save_sheet(name: str, frames: list[Image.Image]) -> dict:
    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))
    out = ACTION_DIR / f"{name}.png"
    sheet.save(out)
    return {"file": f"assets/actions/{name}.png", "frames": len(frames)}


def save_action_sheets(frames: list[Image.Image]):
    ACTION_DIR.mkdir(parents=True, exist_ok=True)
    manifest = {
        "frameSize": FRAME_SIZE,
        "clips": {
            "idle": {**save_sheet("idle", frames[0:32]), "fps": 8, "loop": True},
            "grabbed-neck": {**save_sheet("grabbed-neck", frames[92:108]), "fps": 10, "loop": True},
            "dropped": {**save_sheet("dropped", frames[108:120]), "fps": 12, "loop": False},
            "recover": {**save_sheet("recover", frames[120:128]), "fps": 7, "loop": True},
        },
    }

    directional_ranges = {
        "curious": (32, 48, 9, True),
        "walk": (48, 68, 10, True),
        "play": (68, 92, 12, True),
    }
    for action, (start, end, fps, loop) in directional_ranges.items():
        for direction in DIRECTIONS:
            directed = [direction_frame(frame, direction) for frame in frames[start:end]]
            key = f"{action}-{direction}"
            manifest["clips"][key] = {**save_sheet(key, directed), "fps": fps, "loop": loop}

    (ACTION_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


def main():
    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    source.save(ASSET_DIR / "lulu-generated-source.png")

    cell_w = source.width / BASE_COLS
    cell_h = source.height / BASE_ROWS
    keyed_cells = []
    bboxes = []
    for row in range(BASE_ROWS):
        for col in range(BASE_COLS):
            index = row * BASE_COLS + col
            box = (
                round(col * cell_w),
                round(row * cell_h),
                round((col + 1) * cell_w),
                round((row + 1) * cell_h),
            )
            cell = remove_green_key(source.crop(box))
            cell = remove_cursor_from_cell(cell, index)
            keyed_cells.append(cell)
            bbox = subject_bbox(cell)
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

    frames = make_frames(base_frames)
    sheet = Image.new("RGBA", (FRAME_SIZE * len(frames), FRAME_SIZE), (0, 0, 0, 0))
    for index, frame in enumerate(frames):
        sheet.alpha_composite(frame, (index * FRAME_SIZE, 0))
        frame.save(ASSET_DIR / f"lulu-frame-{index + 1:03d}.png")

    sheet.save(ASSET_DIR / "lulu-sprite-128.png")
    save_action_sheets(frames)
    print(f"wrote {len(frames)} frames to {ASSET_DIR / 'lulu-sprite-128.png'}")


if __name__ == "__main__":
    main()
