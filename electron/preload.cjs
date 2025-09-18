// Preload script: expose limited IPC for selecting data directory.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('promptcrafter', {
	getConfig: () => ipcRenderer.invoke('promptcrafter:getConfig'),
	isDbConfigured: () => ipcRenderer.invoke('promptcrafter:isDbConfigured'),
	chooseDataDir: () => ipcRenderer.invoke('promptcrafter:chooseDataDir'),
	getDbInfo: () => ipcRenderer.invoke('promptcrafter:getDbInfo'),
	resetDataDir: () => ipcRenderer.invoke('promptcrafter:resetDataDir')
	,
	getEnvSafety: () => ipcRenderer.invoke('promptcrafter:getEnvSafety')
	,
	restartApp: () => ipcRenderer.invoke('promptcrafter:restartApp')
	,
	window: {
		minimize: () => ipcRenderer.invoke('promptcrafter:window:minimize'),
		maximizeToggle: () => ipcRenderer.invoke('promptcrafter:window:maximizeToggle'),
		close: () => ipcRenderer.invoke('promptcrafter:window:close')
	}
});
