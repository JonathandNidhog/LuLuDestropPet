# Lulu Desktop Pet v0.1

Cream cameo Maine Coon boy Lulu as a desktop pet. This version uses a generated pixel-art sprite sheet instead of speech bubbles or code-drawn placeholder art.

- Mouse nearby: Lulu looks at it and gets curious.
- Mouse lingering nearby: Lulu plays with it using a paw animation.
- Cursor safety: Lulu never moves the real mouse or auto-clicks.
- Ear or neck drag: Lulu switches into a loose "picked up" pose.
- Drop: Lulu lands with a soft squash animation.
- No text bubbles by default.
- Tray size menu: Small / Medium / Large.
- 56 sprite frames are loaded from `src/assets/lulu-sprite-56.png`.

## Run

```powershell
npm install
npm start
```

## Check

```powershell
npm run check
```

## Interaction Rule

Lulu may chase, sniff, rub, or paw near the cursor, but he must never change the real mouse position. The pet reacts to a virtual target derived from the cursor.

## Git

This repository is connected to:

```text
https://github.com/JonathandNidhog/LuLuDestropPet.git
```

Useful commands:

```powershell
git status
git add .
git commit -m "Describe the change"
git push
```

## Sprite Assets

The current version uses a 56-frame sprite sheet generated from a richer 8x8 Lulu pixel-art action sheet. The second source row is skipped because it contains head-only closeups that do not work for a desktop pet body animation.

- `idle`: 8 frames
- `curious`: 8 frames
- `play`: 8 frames
- `walk`: 8 frames
- `grabbed`: 8 frames
- `dropped`: 8 frames
- `recover`: 8 frames

Regenerate the sprite assets with:

```powershell
C:\Users\daiyuwei\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe scripts\build_lulu_sprite.py
```
