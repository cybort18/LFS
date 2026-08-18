import { app, BrowserWindow, Tray, Menu, nativeImage, clipboard, Notification } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createLfsServer } from '../../core/server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow = null;
let tray = null;
let lfsServerInstance = null;
let isQuitting = false;
let hasShownTrayNotification = false;

// Ensure single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      // 1. Start the Core LFS Engine in-process
      lfsServerInstance = await createLfsServer({
        autoOpen: false // Desktop app handles opening window directly
      });

      // 2. Create the Desktop Window
      createMainWindow(lfsServerInstance.localhostUrl);

      // 3. Setup System Tray
      createSystemTray(lfsServerInstance);

    } catch (err) {
      console.error('[DESKTOP FATAL] Failed to initialize LFS Desktop:', err);
      app.quit();
    }
  });
}

function createMainWindow(url) {
  const iconPath = path.join(__dirname, '../../public/icons/icon.svg');

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 760,
    minWidth: 800,
    minHeight: 600,
    title: 'LocalFastShares (LFS)',
    backgroundColor: '#090d16',
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Remove default menu bar for clean app feel
  mainWindow.setMenuBarVisibility(false);

  mainWindow.loadURL(url);

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      if (!hasShownTrayNotification && Notification.isSupported()) {
        new Notification({
          title: 'LocalFastShares (LFS)',
          body: 'LFS is still running in the background in your System Tray.',
          icon: iconPath
        }).show();
        hasShownTrayNotification = true;
      }
    }
  });
}

function createSystemTray(serverInfo) {
  // Use SVG or generate 16x16 / 32x32 tray icon
  const iconPath = path.join(__dirname, '../../public/icons/icon.svg');
  let trayImage = nativeImage.createFromPath(iconPath);
  if (trayImage.isEmpty()) {
    trayImage = nativeImage.createEmpty();
  } else {
    trayImage = trayImage.resize({ width: 18, height: 18 });
  }

  tray = new Tray(trayImage);
  tray.setToolTip('LocalFastShares (LFS) - Running in Background');

  const updateContextMenu = () => {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'LocalFastShares (LFS)',
        enabled: false
      },
      {
        label: `Status: Online (Port ${serverInfo.port})`,
        enabled: false
      },
      { type: 'separator' },
      {
        label: 'Open Dashboard',
        click: () => {
          if (mainWindow) {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
      {
        label: 'Copy Mobile LAN URL',
        click: () => {
          clipboard.writeText(serverInfo.localUrl);
          if (Notification.isSupported()) {
            new Notification({
              title: 'LFS URL Copied',
              body: `Copied ${serverInfo.localUrl} to clipboard.`
            }).show();
          }
        }
      },
      { type: 'separator' },
      {
        label: 'Quit LocalFastShares',
        click: () => {
          isQuitting = true;
          if (lfsServerInstance) {
            lfsServerInstance.stop().finally(() => {
              app.quit();
            });
          } else {
            app.quit();
          }
        }
      }
    ]);

    tray.setContextMenu(contextMenu);
  };

  updateContextMenu();

  tray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // On Windows/Linux, don't quit automatically when all windows are closed if tray is running
  if (process.platform === 'darwin') {
    app.quit();
  }
});
