# Lulu Desktop Pet v0.1

Cream cameo Maine Coon boy Lulu as a desktop pet. This version uses a pixel-art animated canvas instead of speech bubbles or static images.

- Mouse nearby: Lulu looks at it and gets curious.
- Mouse lingering nearby: Lulu plays with it using a paw animation.
- Cursor safety: Lulu never moves the real mouse or auto-clicks.
- Ear or neck drag: Lulu switches into a loose "picked up" pose.
- Drop: Lulu lands with a soft squash animation.
- No text bubbles by default.
- Tray size menu: Small / Medium / Large.

## 运行

```powershell
npm install
npm start
```

## 开发检查

```powershell
npm run check
```

## Interaction Rule

Lulu may chase, sniff, rub, or paw near the cursor, but he must never change the real mouse position. The pet reacts to a virtual target derived from the cursor.

## Git Setup

This folder is already a Git repository. First commit:

```powershell
git add .
git commit -m "Create Lulu desktop pet prototype"
```

After creating an empty remote repository:

```powershell
git remote add origin <your-repo-url>
git branch -M main
git push -u origin main
```

## Asset Plan

The current version draws Lulu as pixel art in code. Later we can replace or augment it with a real sprite sheet:

- `idle`: lying down, blinking, slow tail motion
- `curious`: looking at the mouse
- `play`: pawing near the mouse
- `grabbed`: ear or neck held, body hanging
- `dropped`: soft landing and recovery
