const { app, BrowserWindow, Tray, Menu, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');

let win;
let tray;
let dragging = false;
let clickThrough = false;
let currentSize = 'medium';

const PET_SIZES = {
  small: 240,
  medium: 300,
  large: 360
};

function getWindowSize() {
  const size = PET_SIZES[currentSize];
  return { width: size, height: size };
}

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const { width, height } = display.workAreaSize;
  const windowSize = getWindowSize();

  win = new BrowserWindow({
    width: windowSize.width,
    height: windowSize.height,
    x: width - windowSize.width - 40,
    y: height - windowSize.height - 30,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.setAlwaysOnTop(true, 'screen-saver');
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
}

function setPetSize(sizeName) {
  if (!PET_SIZES[sizeName] || !win || win.isDestroyed()) return;

  currentSize = sizeName;
  const bounds = win.getBounds();
  const nextSize = getWindowSize();
  win.setBounds({
    x: bounds.x + bounds.width - nextSize.width,
    y: bounds.y + bounds.height - nextSize.height,
    width: nextSize.width,
    height: nextSize.height
  });
  createTray();
}

function createTrayIcon() {
  return nativeImage.createFromDataURL(
    'data:image/svg+xml;utf8,' +
    encodeURIComponent(`
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle cx="16" cy="18" r="10" fill="#efd19f"/>
        <path d="M8 14 6 5l8 6M24 14l2-9-8 6" fill="#e4bd87"/>
        <circle cx="12.5" cy="18" r="1.8" fill="#60703e"/>
        <circle cx="19.5" cy="18" r="1.8" fill="#60703e"/>
        <path d="M15 21c1-1 2-1 3 0-1 1.6-2 1.6-3 0Z" fill="#bd7c7a"/>
      </svg>
    `)
  );
}

function createTray() {
  if (tray) tray.destroy();
  tray = new Tray(createTrayIcon());
  tray.setToolTip('Lulu Desktop Pet');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show Lulu', click: () => win && win.show() },
    { label: 'Hide Lulu', click: () => win && win.hide() },
    {
      label: 'Size',
      submenu: [
        { label: 'Small', type: 'radio', checked: currentSize === 'small', click: () => setPetSize('small') },
        { label: 'Medium', type: 'radio', checked: currentSize === 'medium', click: () => setPetSize('medium') },
        { label: 'Large', type: 'radio', checked: currentSize === 'large', click: () => setPetSize('large') }
      ]
    },
    {
      label: 'Click Through',
      type: 'checkbox',
      checked: clickThrough,
      click: (item) => {
        clickThrough = item.checked;
        if (win) win.setIgnoreMouseEvents(clickThrough, { forward: true });
      }
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]));
}

function startCursorLoop() {
  setInterval(() => {
    if (!win || win.isDestroyed()) return;

    const cursor = screen.getCursorScreenPoint();
    const bounds = win.getBounds();

    if (dragging) {
      win.setPosition(
        Math.round(cursor.x - dragAnchor.x),
        Math.round(cursor.y - dragAnchor.y),
        false
      );
    }

    win.webContents.send('cursor:update', {
      screen: cursor,
      local: {
        x: cursor.x - bounds.x,
        y: cursor.y - bounds.y,
        width: bounds.width,
        height: bounds.height
      },
      dragging
    });
  }, 33);
}

let dragAnchor = { x: PET_SIZES.medium / 2, y: PET_SIZES.medium * 0.22 };

ipcMain.on('pet:drag-start', (_event, anchor) => {
  dragging = true;
  dragAnchor = {
    x: Number.isFinite(anchor?.x) ? anchor.x : PET_SIZES[currentSize] / 2,
    y: Number.isFinite(anchor?.y) ? anchor.y : PET_SIZES[currentSize] * 0.22
  };
});

ipcMain.on('pet:drag-end', () => {
  dragging = false;
  if (win && !win.isDestroyed()) {
    win.webContents.send('pet:dropped');
  }
});

ipcMain.on('pet:set-ignore-mouse', (_event, ignore) => {
  clickThrough = Boolean(ignore);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(clickThrough, { forward: true });
  }
});

app.whenReady().then(() => {
  createWindow();
  createTray();
  startCursorLoop();
});

app.on('window-all-closed', (event) => {
  event.preventDefault();
});
