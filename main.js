const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle file operations
ipcMain.handle('save-file', async (event, filePath, data) => {
    try {
        await fs.writeFile(filePath, Buffer.from(data));
        return true;
    } catch (err) {
        console.error('Failed to save file:', err);
        throw err;
    }
});

ipcMain.handle('load-file', async (event, filePath) => {
    try {
        const data = await fs.readFile(filePath);
        return data;
    } catch (err) {
        console.error('Failed to load file:', err);
        throw err;
    }
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(options);
    return result.filePath;
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(options);
    return result.filePaths[0];
});

// Add directory browse dialog handler
ipcMain.handle('show-directory-dialog', async (event) => {
    const result = await dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    return result.filePaths[0];
});

// Add file existence check handler
ipcMain.handle('check-file-exists', async (event, filePath) => {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}); 