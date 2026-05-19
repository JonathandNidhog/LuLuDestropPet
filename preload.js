const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('luluPet', {
  onCursorUpdate(callback) {
    ipcRenderer.on('cursor:update', (_event, payload) => callback(payload));
  },
  onDropped(callback) {
    ipcRenderer.on('pet:dropped', callback);
  },
  startDrag(anchor) {
    ipcRenderer.send('pet:drag-start', anchor);
  },
  endDrag() {
    ipcRenderer.send('pet:drag-end');
  },
  setIgnoreMouse(ignore) {
    ipcRenderer.send('pet:set-ignore-mouse', ignore);
  }
});
