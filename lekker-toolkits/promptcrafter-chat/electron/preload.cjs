// Preload script: expose limited IPC for selecting data directory.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('promptcrafter', {
	getConfig: () => ipcRenderer.invoke('promptcrafter:getConfig'),
	isDbConfigured: () => ipcRenderer.invoke('promptcrafter:isDbConfigured'),
	chooseDataDir: () => ipcRenderer.invoke('promptcrafter:chooseDataDir'),
	getDbInfo: () => ipcRenderer.invoke('promptcrafter:getDbInfo')
});
