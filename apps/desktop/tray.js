import fs from 'fs';
import path from 'path';
import http from 'http';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import SysTrayPackage from 'systray2';
import { createLfsServer } from '../../core/server.js';
import { isAutostartEnabled, toggleAutostart } from './autostart.js';
import { openBrowser } from './browser.js';

const SysTray = SysTrayPackage.default || SysTrayPackage;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Safe standard I/O for Windows GUI subsystem
if (process.platform === 'win32') {
  const noop = () => {};
  try {
    if (!process.stdout || !process.stdout.write) {
      process.stdout = { write: noop };
    }
  } catch (e) {}
  try {
    if (!process.stderr || !process.stderr.write) {
      process.stderr = { write: noop };
    }
  } catch (e) {}
}

// Resolve application root directory where public/ and traybin/ live
let appDir = process.cwd();
const possibleDirs = [
  process.cwd(),
  __dirname,
  path.dirname(process.execPath),
  path.dirname(path.dirname(process.execPath))
];

for (const dir of possibleDirs) {
  if (fs.existsSync(path.join(dir, 'traybin')) && fs.existsSync(path.join(dir, 'public'))) {
    appDir = dir;
    break;
  }
}

try {
  process.chdir(appDir);
} catch (e) {}

function copyToClipboard(text) {
  if (process.platform === 'win32') {
    const proc = exec('clip');
    proc.stdin.write(text);
    proc.stdin.end();
  } else if (process.platform === 'darwin') {
    const proc = exec('pbcopy');
    proc.stdin.write(text);
    proc.stdin.end();
  } else {
    exec(`xclip -selection clipboard <<< "${text}"`);
  }
}

function getAutostartTitle(active) {
  return active ? '[x] Run on Windows Startup' : '[ ] Run on Windows Startup';
}

async function startTrayApp() {
  console.log('[LFS TRAY] Starting LocalFastShares Background Daemon...');

  let autostartActive = isAutostartEnabled();

  // 1. Start the Core LFS Engine
  const serverInfo = await createLfsServer({
    autoOpen: true // Open default browser on start
  });

  // 2. Load Tray Icon
  let icoPath = path.join(appDir, 'assets/icon.ico');
  if (!fs.existsSync(icoPath)) {
    icoPath = path.join(__dirname, 'assets/icon.ico');
  }

  // 3. Setup System Tray Menu
  const menuConfig = {
    icon: fs.existsSync(icoPath) ? icoPath : '',
    title: 'LFS',
    tooltip: `LocalFastShares (LFS) - Active on Port ${serverInfo.port}`,
    items: [
      {
        title: `LocalFastShares (Online - Port ${serverInfo.port})`,
        tooltip: 'Server Status',
        checked: false,
        enabled: false
      },
      {
        title: `Localhost: ${serverInfo.localhostUrl}`,
        tooltip: 'Click to open in default browser',
        checked: false,
        enabled: true
      },
      {
        title: `Mobile LAN: ${serverInfo.localUrl}`,
        tooltip: 'Click to copy LAN URL to clipboard',
        checked: false,
        enabled: true
      },
      SysTray.separator,
      {
        title: getAutostartTitle(autostartActive),
        tooltip: 'Toggle automatic launch on Windows boot',
        checked: autostartActive,
        enabled: true
      },
      {
        title: 'Open in Browser',
        tooltip: 'Open LFS dashboard',
        checked: false,
        enabled: true
      },
      {
        title: 'Exit LocalFastShares',
        tooltip: 'Stop server and quit',
        checked: false,
        enabled: true
      }
    ]
  };

  const systray = new SysTray({ menu: menuConfig });

  systray.onClick((action) => {
    switch (action.seq_id) {
      case 1: // Localhost link
      case 5: // Open in browser
        openBrowser(serverInfo.localhostUrl);
        break;

      case 2: // Mobile LAN link
        copyToClipboard(serverInfo.localUrl);
        console.log(`[LFS TRAY] Copied LAN URL to clipboard: ${serverInfo.localUrl}`);
        break;

      case 4: // Toggle Startup on Windows Boot
        autostartActive = toggleAutostart(process.execPath);
        console.log(`[LFS TRAY] Autostart on boot toggled: ${autostartActive}`);
        try {
          action.item.title = getAutostartTitle(autostartActive);
          action.item.checked = autostartActive;
          systray.sendAction({
            type: 'update-item',
            item: action.item,
            seq_id: action.seq_id
          });
        } catch (e) {}
        break;

      case 6: // Exit
        console.log('[LFS TRAY] Stopping server and exiting...');
        systray.kill();
        serverInfo.stop().finally(() => {
          process.exit(0);
        });
        break;
    }
  });

  const cleanup = () => {
    try {
      systray.kill();
    } catch (e) {}
    serverInfo.stop().finally(() => process.exit(0));
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('exit', () => {
    try {
      systray.kill();
    } catch (e) {}
  });

  console.log('[LFS TRAY] System Tray initialized successfully (Idle RAM: ~25 MB).');
}

startTrayApp().catch((err) => {
  try {
    fs.appendFileSync('lfs-error.log', `[${new Date().toISOString()}] Startup error: ${err.stack || err}\n`);
  } catch (e) {}
  process.exit(1);
});
