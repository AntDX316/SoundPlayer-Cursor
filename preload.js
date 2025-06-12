const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    saveFile: (filePath, content) => ipcRenderer.invoke('save-file', filePath, content),
    loadFile: (filePath) => ipcRenderer.invoke('load-file', filePath),
    showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
    showOpenDialog: (options) => ipcRenderer.invoke('show-open-dialog', options),
    showDirectoryDialog: (options) => ipcRenderer.invoke('show-directory-dialog', options),
    checkFileExists: (filePath) => ipcRenderer.invoke('check-file-exists', filePath)
});