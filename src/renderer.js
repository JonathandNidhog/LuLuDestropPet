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

const animations = {
  idle: { start: 0, count: 8, fps: 7, loop: true },
  curious: { start: 8, count: 8, fps: 9, loop: true },
  play: { start: 16, count: 8, fps: 12, loop: true },
  walk: { start: 24, count: 8, fps: 10, loop: true },
  grabbed: { start: 32, count: 8, fps: 10, loop: true },
  dropped: { start: 40, count: 8, fps: 12, loop: false },
  recover: { start: 48, count: 8, fps: 7, loop: true }
};

const sprite = new Image();
sprite.src = './assets/lulu-sprite-56.png';

let state = 'idle';
let grabbed = false;
let lastCursor = { x: 210, y: 210, t: performance.now() };
let cursorSpeed = 0;
let playSince = 0;
let animationStart = performance.now();
let dropTimer = 0;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setState(next) {
  if (state === next) return;
  state = next;
  animationStart = performance.now();
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

function currentFrame(time) {
  const animation = animations[state] || animations.idle;
  const elapsed = Math.max(0, time - animationStart);
  const raw = Math.floor(elapsed / (1000 / animation.fps));
  const local = animation.loop ? raw % animation.count : Math.min(raw, animation.count - 1);
  return animation.start + local;
}

function draw(time) {
  ctx.clearRect(0, 0, FRAME_SIZE, FRAME_SIZE);

  if (sprite.complete && sprite.naturalWidth > 0) {
    const frame = currentFrame(time);
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
  clearTimeout(dropTimer);
  dropTimer = setTimeout(() => setState('recover'), 460);
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
