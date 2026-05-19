# Lulu Animation Architecture

## Current Runtime Model

The renderer uses one canvas and selects a sprite clip by state.

Runtime input:

- Cursor local position
- Cursor speed
- Cursor direction relative to Lulu
- Drag state from ear / neck hit zones

Current state machine:

- `idle`
- `curious`
- `walk`
- `play`
- `grabbed`
- `dropped`
- `recover`

Current directional states:

- `curious-{e,ne,n,nw,w,sw,s,se}`
- `walk-{e,ne,n,nw,w,sw,s,se}`
- `play-{e,ne,n,nw,w,sw,s,se}`

Non-directional states:

- `idle`
- `grabbed-neck`
- `dropped`
- `recover`

## Current Asset Layout

```text
src/assets/actions/
  idle.png
  grabbed-neck.png
  dropped.png
  recover.png
  curious-e.png
  curious-ne.png
  curious-n.png
  curious-nw.png
  curious-w.png
  curious-sw.png
  curious-s.png
  curious-se.png
  walk-e.png
  walk-ne.png
  walk-n.png
  walk-nw.png
  walk-w.png
  walk-sw.png
  walk-s.png
  walk-se.png
  play-e.png
  play-ne.png
  play-n.png
  play-nw.png
  play-w.png
  play-sw.png
  play-s.png
  play-se.png
  manifest.json
```

## Known Problems

The current action files are split correctly by name, but the visual source is not good enough yet.

1. Mouse-direction files are algorithmic variants, not true eight-direction artwork.
2. Some source cells contained neighboring sprite fragments after grid cutting.
3. Tail is baked into the body, so it cannot react physically to movement or drag.
4. State transitions are crossfades, not authored transition animations.
5. `walk` and `play` are semantically too close because they share limited source poses.

## Next Architecture

Use layered animation instead of one flattened body sprite.

Layers:

- Body layer
- Head / ear layer
- Front paw layer for mouse play
- Tail layer split into three connected segments

Tail segments:

- `tail-root`
- `tail-mid`
- `tail-tip`

Tail behavior:

- Root follows body instantly.
- Mid follows root with delay.
- Tip follows mid with more delay.
- Dragging adds inertial sway.
- Idle adds slow breathing sway.
- Mouse play adds alert upward curl.

## Correct Asset Plan

Per action, keep separate sprite files:

```text
idle/body.png
idle/tail-root.png
idle/tail-mid.png
idle/tail-tip.png

mouse-play/e/body.png
mouse-play/e/paw.png
mouse-play/e/tail-root.png
...
mouse-play/ne/...
...

approach/e/...
approach/ne/...
...

grab-neck/body.png
grab-neck/tail-root.png
grab-neck/tail-mid.png
grab-neck/tail-tip.png
```

Required first-pass actions:

- `idle`: 16 frames
- `approach`: 8 directions x 12 frames
- `mouse-play`: 8 directions x 12 frames
- `stalk`: 8 directions x 8 frames
- `grab-neck`: 16 frames
- `drop-recover`: 20 frames

## Implementation Plan

1. Clean source extraction using connected components so neighboring sprite fragments are removed.
2. Stop generating fake eight directions from mirrored/offset frames.
3. Generate or draw real directional source sheets per action.
4. Split tail from body into three segments.
5. Add a simple verlet/spring tail controller in `renderer.js`.
6. Add state transition clips such as `idle-to-walk`, `walk-to-play`, and `play-to-idle`.
7. Replace hardcoded clip definitions with `manifest.json` loading.

## Acceptance Criteria

- No frame contains neighboring sprite fragments.
- Within each animation clip, visible bbox height and foot baseline stay stable.
- No animation clip may contain consecutive duplicate frames; generation fails if duplicates are detected.
- Do not pad animation length by copying a frame. If an action has only 6 meaningful frames, the manifest must say 6 frames.
- Mouse interaction chooses correct direction among eight directions.
- Tail moves independently and never stretches away from body.
- Idle does not spin, scale, or visibly flicker.
- Dragging neck pins cursor to neck anchor.
