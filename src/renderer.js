const pet = document.getElementById('lulu');
const canvas = document.getElementById('sprite');
const ctx = canvas.getContext('2d', { alpha: true });
const hotspots = [...document.querySelectorAll('.grab-zone')];

ctx.imageSmoothingEnabled = false;

let state = 'idle';
let grabbed = false;
let lastCursor = { x: 210, y: 210, t: performance.now() };
let cursorSpeed = 0;
let playSince = 0;
let dropTimer = 0;
let animationStart = performance.now();
let dragTilt = 0;
let pawSwing = 0;

const CENTER = { x: 210, y: 205 };
const NEAR_RADIUS = 165;
const PLAY_RADIUS = 112;
const LEAVE_CURSOR_GAP = 34;
const BASE_SIZE = 420;

const colors = {
  outline: '#5a3f2d',
  shadow: 'rgba(48, 34, 24, 0.2)',
  furDark: '#b98755',
  fur: '#dfbb82',
  furLight: '#f4dfae',
  cream: '#fff0c8',
  ear: '#e9a8a1',
  eye: '#71804c',
  pupil: '#1c2016',
  nose: '#c9807c',
  white: '#fff8dc'
};

function setState(next) {
  if (state === next) return;
  state = next;
  animationStart = performance.now();
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
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
  setState(d < NEAR_RADIUS && cursorSpeed < 1300 ? 'curious' : 'idle');
}

function toLogicalPoint(point) {
  const width = point.width || window.innerWidth || BASE_SIZE;
  const height = point.height || window.innerHeight || BASE_SIZE;
  return {
    x: point.x / width * BASE_SIZE,
    y: point.y / height * BASE_SIZE
  };
}

function setDragMotion(point) {
  const dx = point.x - lastCursor.x;
  dragTilt = clamp(dx * 0.36, -12, 12);
  pawSwing = clamp(dx * -0.18, -8, 8);
}

function px(x, y, w, h, color) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function box(x, y, w, h, color) {
  px(x, y, w, h, colors.outline);
  px(x + 1, y + 1, w - 2, h - 2, color);
}

function oval(cx, cy, rx, ry, color) {
  ctx.fillStyle = colors.outline;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx + 1.2, ry + 1.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function triangle(points, fill) {
  ctx.fillStyle = colors.outline;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (const point of points.slice(1)) ctx.lineTo(point[0], point[1]);
  ctx.closePath();
  ctx.fill();

  const cx = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const cy = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo((points[0][0] + cx) / 2, (points[0][1] + cy) / 2);
  for (const point of points.slice(1)) {
    ctx.lineTo((point[0] + cx) / 2, (point[1] + cy) / 2);
  }
  ctx.closePath();
  ctx.fill();
}

function line(x1, y1, x2, y2, color = colors.white) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
  ctx.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
  ctx.stroke();
}

function drawTail(frame, mode) {
  const sway = Math.sin(frame / 18) * 3;
  if (mode === 'grabbed') {
    oval(91 + dragTilt * 0.16, 81 + sway, 9, 35, colors.furLight);
    px(88, 52 + sway, 6, 28, colors.cream);
    return;
  }

  oval(92, 82 + sway, 16, 38, colors.furLight);
  oval(91, 64 + sway, 11, 23, colors.cream);
  line(88, 52 + sway, 96, 90 + sway, colors.furDark);
}

function drawBody(frame, mode) {
  const breathe = mode === 'idle' ? Math.sin(frame / 24) * 1.2 : 0;
  const drop = mode === 'grabbed' ? 13 : 0;
  const squash = mode === 'dropped' ? Math.max(0, 1 - (frame / 18)) * 5 : 0;

  oval(64, 82 + breathe + drop + squash, 36 + squash, 24 - squash * 0.25, colors.fur);
  oval(55, 83 + breathe + drop + squash, 22 + squash * 0.5, 24, colors.cream);

  for (let i = 0; i < 13; i += 1) {
    const x = 35 + i * 4;
    const y = 67 + ((i % 3) * 3) + breathe + drop;
    px(x, y, 2, 2, i % 2 ? colors.furLight : colors.furDark);
  }

  const legDrop = mode === 'grabbed' ? 17 : 0;
  box(39, 96 + legDrop + squash, 13, 8, colors.cream);
  box(73, 97 + legDrop + squash, 15, 8, colors.furLight);
}

function drawPaws(frame, mode) {
  let leftX = 48;
  let leftY = 76;
  let rightX = 70;
  let rightY = 76;

  if (mode === 'play') {
    const tap = Math.sin(frame / 5) > 0 ? -9 : -2;
    leftX -= 9;
    leftY += tap;
  }

  if (mode === 'grabbed') {
    leftY += 30;
    rightY += 30;
    leftX += pawSwing * 0.25;
    rightX += pawSwing * 0.25;
  }

  box(leftX, leftY, 10, 24, colors.cream);
  box(rightX, rightY, 10, 24, colors.furLight);
  line(leftX + 3, leftY + 18, leftX + 3, leftY + 23, colors.furDark);
  line(rightX + 6, rightY + 18, rightX + 6, rightY + 23, colors.furDark);
}

function drawHead(frame, mode, eyeOffset) {
  const curiousLean = mode === 'curious' || mode === 'play' ? Math.sin(frame / 10) * 1.2 : 0;
  const grabDrop = mode === 'grabbed' ? -3 : 0;

  ctx.save();
  ctx.translate(62, 45 + grabDrop);
  ctx.rotate((curiousLean + (mode === 'grabbed' ? dragTilt * 0.12 : 0)) * Math.PI / 180);
  ctx.translate(-62, -45);

  const earFold = mode === 'grabbed' ? 6 : 0;
  triangle([[36, 42 + earFold], [32, 15 + earFold], [53, 35]], colors.furLight);
  triangle([[85, 42 + earFold], [96, 17 + earFold], [70, 35]], colors.fur);
  triangle([[40, 34 + earFold], [36, 23 + earFold], [48, 34]], colors.ear);
  triangle([[83, 34 + earFold], [91, 25 + earFold], [74, 34]], colors.ear);

  oval(62, 49, 29, 24, colors.furLight);
  px(47, 36, 31, 8, colors.fur);
  px(54, 31, 14, 4, colors.furDark);
  px(41, 45, 7, 10, colors.cream);
  px(77, 45, 7, 10, colors.cream);

  const blink = mode === 'idle' && frame % 118 > 112;
  const annoyed = mode === 'grabbed';
  const eyeH = blink ? 1 : annoyed ? 2 : 4;
  const eyeY = annoyed ? 52 : 50;
  box(48, eyeY, 9, eyeH + 2, colors.eye);
  box(68, eyeY, 9, eyeH + 2, colors.eye);
  if (!blink) {
    px(52 + eyeOffset.x, eyeY + 1 + eyeOffset.y, 2, eyeH, colors.pupil);
    px(72 + eyeOffset.x, eyeY + 1 + eyeOffset.y, 2, eyeH, colors.pupil);
  }

  px(58, 58, 11, 7, colors.cream);
  px(62, 57, 4, 3, colors.nose);
  px(60, 64, 2, 2, colors.outline);
  px(67, 64, 2, 2, colors.outline);

  line(58, 61, 34, 56);
  line(58, 64, 35, 68);
  line(69, 61, 94, 56);
  line(69, 64, 93, 69);

  ctx.restore();
}

function drawPixelLulu(time) {
  const frame = Math.floor((time - animationStart) / 48);
  const mode = grabbed ? 'grabbed' : state;
  const eyeOffset = {
    x: clamp((lastCursor.x - CENTER.x) / 70, -2, 2),
    y: clamp((lastCursor.y - CENTER.y) / 90, -1, 1)
  };

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();

  px(29, 105, 73, 8, colors.shadow);
  drawTail(frame, mode);
  drawBody(frame, mode);
  drawPaws(frame, mode);
  drawHead(frame, mode, eyeOffset);

  if (mode === 'play') {
    const sparkle = frame % 12 < 6;
    px(27, 58, 3, 3, sparkle ? colors.white : colors.furLight);
    px(31, 62, 2, 2, colors.furDark);
  }

  ctx.restore();
  requestAnimationFrame(drawPixelLulu);
}

window.luluPet.onCursorUpdate((payload) => {
  const now = performance.now();
  const point = toLogicalPoint(payload.local);
  const dt = Math.max(16, now - lastCursor.t);
  cursorSpeed = Math.hypot(point.x - lastCursor.x, point.y - lastCursor.y) / dt * 1000;

  if (grabbed) {
    setDragMotion(point);
  } else {
    updatePlayState(point);
  }

  lastCursor = { x: point.x, y: point.y, t: now };
});

window.luluPet.onDropped(() => {
  grabbed = false;
  setState('dropped');
  clearTimeout(dropTimer);
  dropTimer = setTimeout(() => setState('idle'), 520);
});

for (const hotspot of hotspots) {
  hotspot.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    grabbed = true;
    setState('grabbed');
    hotspot.setPointerCapture(event.pointerId);
    window.luluPet.startDrag({ x: event.clientX, y: event.clientY });
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

requestAnimationFrame(drawPixelLulu);
