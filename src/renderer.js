const pet = document.getElementById('lulu');
const canvas = document.getElementById('sprite');
const ctx = canvas.getContext('2d', { alpha: true });
const hotspots = [...document.querySelectorAll('.grab-zone')];

ctx.imageSmoothingEnabled = false;

const FRAME_SIZE = 128;
const BASE_SIZE = 420;
const CENTER = { x: 210, y: 205 };
const NEAR_RADIUS = 165;
const PLAY_RADIUS = 112;
const APPROACH_RADIUS = 380;
const LEAVE_CURSOR_GAP = 34;
const TRANSITION_MS = 140;
const FACING_DEAD_ZONE = 36;
const STATE_MIN_MS = {
  idle: 500,
  curious: 360,
  walk: 520,
  play: 760,
  grabbed: 0,
  dropped: 0,
  recover: 620
};

const animations = {
  idle: { start: 0, count: 32, fps: 8, loop: true },
  curious: { start: 32, count: 16, fps: 9, loop: true },
  walk: { start: 48, count: 20, fps: 10, loop: true },
  play: { start: 68, count: 24, fps: 12, loop: true },
  grabbed: { start: 92, count: 16, fps: 10, loop: true },
  dropped: { start: 108, count: 12, fps: 12, loop: false },
  recover: { start: 120, count: 8, fps: 7, loop: true }
};

const sprite = new Image();
sprite.src = './assets/lulu-sprite-128.png';

let state = 'idle';
let grabbed = false;
let lastCursor = { x: 210, y: 210, t: performance.now() };
let cursorSpeed = 0;
let playSince = 0;
let animationStart = performance.now();
let stateChangedAt = performance.now();
let dropTimer = 0;
let facing = 1;
let transition = null;
let stateLockedUntil = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setState(next) {
  if (state === next) return;
  const now = performance.now();
  const minTime = STATE_MIN_MS[state] ?? 0;
  if (now < stateLockedUntil || (now - stateChangedAt < minTime && next !== 'grabbed' && next !== 'dropped')) {
    return;
  }
  transition = {
    fromFrame: currentFrame(now),
    fromFacing: facing,
    startedAt: now
  };
  state = next;
  animationStart = now;
  stateChangedAt = now;
}

function toLogicalPoint(point) {
  const width = point.width || window.innerWidth || BASE_SIZE;
  const height = point.height || window.innerHeight || BASE_SIZE;
  return {
    x: point.x / width * BASE_SIZE,
    y: point.y / height * BASE_SIZE
  };
}

function distanceToCat(point) {
  const dx = point.x - CENTER.x;
  const dy = point.y - CENTER.y;
  return Math.hypot(dx, dy);
}

function protectCursor(point) {
  const dx = point.x - CENTER.x;
  const dy = point.y - CENTER.y;
  const dist = Math.max(1, Math.hypot(dx, dy));

  if (dist > LEAVE_CURSOR_GAP || grabbed) {
    pet.style.transform = '';
    return;
  }

  const push = (LEAVE_CURSOR_GAP - dist) / LEAVE_CURSOR_GAP;
  const x = clamp((-dx / dist) * push * 18, -18, 18);
  const y = clamp((-dy / dist) * push * 12, -12, 12);
  pet.style.transform = `translate(${x}px, ${y}px)`;
}

function updatePlayState(point) {
  if (grabbed) return;

  const now = performance.now();
  const d = distanceToCat(point);
  updateFacing(point);

  if (d < PLAY_RADIUS && cursorSpeed < 900) {
    if (!playSince) playSince = now;
    setState(now - playSince > 580 ? 'play' : 'curious');
    protectCursor(point);
    return;
  }

  playSince = 0;
  pet.style.transform = '';
  if (d < NEAR_RADIUS && cursorSpeed < 1300) {
    setState('curious');
  } else if (d < APPROACH_RADIUS && cursorSpeed < 1300) {
    setState('walk');
  } else {
    setState('idle');
  }
}

function updateFacing(point) {
  const dx = point.x - CENTER.x;
  if (Math.abs(dx) < FACING_DEAD_ZONE || state === 'grabbed' || state === 'dropped') return;
  facing = dx >= 0 ? 1 : -1;
}

function currentFrame(time) {
  const animation = animations[state] || animations.idle;
  const elapsed = Math.max(0, time - animationStart);
  const raw = Math.floor(elapsed / (1000 / animation.fps));
  const local = animation.loop ? raw % animation.count : Math.min(raw, animation.count - 1);
  return animation.start + local;
}

function drawFrame(frame, alpha, drawFacing) {
  ctx.save();
  ctx.globalAlpha = alpha;
  if (drawFacing < 0) {
    ctx.translate(FRAME_SIZE, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(
    sprite,
    frame * FRAME_SIZE,
    0,
    FRAME_SIZE,
    FRAME_SIZE,
    0,
    0,
    FRAME_SIZE,
    FRAME_SIZE
  );
  ctx.restore();
}

function draw(time) {
  ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);

  if (sprite.complete && sprite.naturalWidth > 0) {
    const frame = currentFrame(time);
    if (transition) {
      const progress = clamp((time - transition.startedAt) / TRANSITION_MS, 0, 1);
      drawFrame(transition.fromFrame, 1 - progress, transition.fromFacing);
      drawFrame(frame, progress, facing);
      if (progress >= 1) transition = null;
    } else {
      drawFrame(frame, 1, facing);
    }
  }

  requestAnimationFrame(draw);
}

window.luluPet.onCursorUpdate((payload) => {
  const now = performance.now();
  const point = toLogicalPoint(payload.local);
  const dt = Math.max(16, now - lastCursor.t);
  cursorSpeed = Math.hypot(point.x - lastCursor.x, point.y - lastCursor.y) / dt * 1000;

  updatePlayState(point);
  lastCursor = { x: point.x, y: point.y, t: now };
});

window.luluPet.onDropped(() => {
  grabbed = false;
  setState('dropped');
  stateLockedUntil = performance.now() + 900;
  clearTimeout(dropTimer);
  dropTimer = setTimeout(() => {
    stateLockedUntil = 0;
    setState('recover');
  }, 900);
});

for (const hotspot of hotspots) {
  hotspot.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    grabbed = true;
    setState('grabbed');
    hotspot.setPointerCapture(event.pointerId);
    const zone = hotspot.dataset.zone;
    const anchor = zone === 'neck'
      ? { x: window.innerWidth * 0.5, y: window.innerHeight * 0.34 }
      : { x: event.clientX, y: event.clientY };
    window.luluPet.startDrag(anchor);
  });

  hotspot.addEventListener('pointerup', () => {
    if (grabbed) window.luluPet.endDrag();
  });

  hotspot.addEventListener('pointercancel', () => {
    if (grabbed) window.luluPet.endDrag();
  });
}

window.addEventListener('blur', () => {
  if (grabbed) window.luluPet.endDrag();
});

window.addEventListener('pointerup', () => {
  if (grabbed) window.luluPet.endDrag();
});

requestAnimationFrame(draw);
