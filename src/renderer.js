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
const TRANSITION_MS = 120;
const STATE_MIN_MS = {
  idle: 500,
  curious: 360,
  walk: 520,
  play: 760,
  grabbed: 0,
  dropped: 0,
  recover: 620
};

const directions = ['e', 'ne', 'n', 'nw', 'w', 'sw', 's', 'se'];
let clips = {};
const images = {};

let state = 'idle';
let direction = 'e';
let grabbed = false;
let lastCursor = { x: 210, y: 210, t: performance.now() };
let cursorSpeed = 0;
let playSince = 0;
let animationStart = performance.now();
let stateChangedAt = performance.now();
let dropTimer = 0;
let transition = null;
let stateLockedUntil = 0;
let ready = false;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function clipKey(action = state, dir = direction) {
  if (action === 'curious' || action === 'walk' || action === 'play') {
    return `${action}-${dir}`;
  }
  if (action === 'grabbed') return 'grabbed-neck';
  return action;
}

async function loadClips() {
  const response = await fetch('./assets/actions/manifest.json');
  const manifest = await response.json();
  clips = manifest.clips;

  for (const [key, clip] of Object.entries(clips)) {
    images[key] = new Image();
    images[key].src = `./${clip.file}`;
  }
  ready = true;
}

function setState(next) {
  const now = performance.now();
  if (state === next) return;
  const minTime = STATE_MIN_MS[state] ?? 0;
  if (now < stateLockedUntil || (now - stateChangedAt < minTime && next !== 'grabbed' && next !== 'dropped')) {
    return;
  }
  transition = {
    key: clipKey(),
    frame: currentFrame(now),
    startedAt: now
  };
  state = next;
  animationStart = now;
  stateChangedAt = now;
}

function setDirection(next) {
  if (direction === next || grabbed || state === 'dropped') return;
  if ((state === 'curious' || state === 'walk' || state === 'play') && next !== direction) {
    transition = {
      key: clipKey(),
      frame: currentFrame(performance.now()),
      startedAt: performance.now()
    };
    animationStart = performance.now();
  }
  direction = next;
}

function toLogicalPoint(point) {
  const width = point.width || window.innerWidth || BASE_SIZE;
  const height = point.height || window.innerHeight || BASE_SIZE;
  return {
    x: point.x / width * BASE_SIZE,
    y: point.y / height * BASE_SIZE
  };
}

function directionFromPoint(point) {
  const dx = point.x - CENTER.x;
  const dy = point.y - CENTER.y;
  if (Math.hypot(dx, dy) < 24) return direction;
  const angle = Math.atan2(-dy, dx);
  const octant = Math.round(angle / (Math.PI / 4));
  return directions[(octant + 8) % 8];
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
  setDirection(directionFromPoint(point));

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

function currentFrame(time, key = clipKey()) {
  const clip = clips[key] || clips.idle;
  if (!clip) return 0;
  const elapsed = Math.max(0, time - animationStart);
  const raw = Math.floor(elapsed / (1000 / clip.fps));
  return clip.loop ? raw % clip.frames : Math.min(raw, clip.frames - 1);
}

function drawClipFrame(key, frame, alpha) {
  const image = images[key];
  if (!image || !image.complete || image.naturalWidth <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(
    image,
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

  if (ready) {
    const key = clipKey();
    const frame = currentFrame(time, key);
    if (transition) {
      const progress = clamp((time - transition.startedAt) / TRANSITION_MS, 0, 1);
      drawClipFrame(transition.key, transition.frame, 1 - progress);
      drawClipFrame(key, frame, progress);
      if (progress >= 1) transition = null;
    } else {
      drawClipFrame(key, frame, 1);
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

loadClips();
requestAnimationFrame(draw);
