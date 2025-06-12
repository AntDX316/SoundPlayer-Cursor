const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs').promises;

function createWindow() {
    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadFile('index.html');
    
    // Create menu
    createMenu();
}

function createMenu() {
    const template = [
        {
            label: 'File',
            submenu: [
                {
                    label: 'Exit',
                    accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About Sound Player',
                    click: () => {
                        showAboutDialog();
                    }
                }
            ]
        }
    ];

    // macOS specific menu adjustments
    if (process.platform === 'darwin') {
        template.unshift({
            label: app.getName(),
            submenu: [
                {
                    label: 'About Sound Player',
                    click: () => {
                        showAboutDialog();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quit',
                    accelerator: 'Command+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        });
        
        // Remove About from Help menu on macOS since it's in the app menu
        template[2].submenu = template[2].submenu.filter(item => item.label !== 'About Sound Player');
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function showAboutDialog() {
    dialog.showMessageBox({
        type: 'info',
        title: 'About Sound Player',
        message: 'Sound Player',
        detail: `Version: 1.0.0\n\nA modern audio player with spectrum visualization and library management.\n\nCreated by @AntDX316\nTwitter/X: https://x.com/AntDX316\n\nBuilt with Electron and Web Technologies\n\n© 2024 Sound Player`,
        buttons: ['OK'],
        defaultId: 0
    });
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