/* Splash preload — deliberately tiny and separate from the main preload. The splash window has no
   business being able to reach the database, the Squarespace credentials or the OpenAI key, so it
   gets its own bridge exposing three things and nothing else. */
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('studioflowSplash', {
  onStage: fn => ipcRenderer.on('splash:stage', (_e, payload) => fn(payload)),
  onDismiss: fn => ipcRenderer.on('splash:dismiss', () => fn()),
  skip: () => ipcRenderer.send('splash:skip')
});
