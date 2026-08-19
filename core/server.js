import express from 'express';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

import { getLocalIpAddresses } from './utils/network.js';
import { generateQrDataUrl } from './utils/qr.js';
import { setupWebSocketSignaling } from './signaling/wsHandler.js';
import { handlePushStream, handlePullStream } from './transfer/streamHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function openBrowser(url) {
  if (process.platform === 'win32') {
    exec(`start "" "${url}"`, { windowsHide: true, shell: 'cmd.exe' }, () => {});
  } else if (process.platform === 'darwin') {
    exec(`open "${url}"`, () => {});
  } else {
    exec(`xdg-open "${url}"`, () => {});
  }
}

/**
 * Creates and starts the LFS Express + WebSocket Server.
 * @param {object} options
 * @param {number} [options.port=3000] Initial port to listen on
 * @param {boolean} [options.autoOpen=true] Whether to auto-open the browser on PC
 * @param {string} [options.staticDir] Custom static assets directory (defaults to ../public)
 * @param {Function} [options.onListening] Callback when server successfully starts listening
 * @returns {Promise<{ app: express.Express, server: http.Server, port: number, localUrl: string, localhostUrl: string, stop: () => Promise<void> }>}
 */
export function createLfsServer(options = {}) {
  let defaultStaticDir = path.join(__dirname, '../public');
  if (process.pkg) {
    const externalPublic = path.join(path.dirname(process.execPath), 'public');
    if (fs.existsSync(externalPublic)) {
      defaultStaticDir = externalPublic;
    }
  }

  const {
    port = parseInt(process.env.PORT || '3000', 10),
    autoOpen = process.env.NODE_ENV !== 'test',
    staticDir = defaultStaticDir,
    onListening = null
  } = options;

  return new Promise((resolve, reject) => {
    const app = express();
    const server = http.createServer(app);
    let currentPort = port;

    app.use(express.json());

    // Disable caching for HTML and Service Worker so updates are immediate
    app.use((req, res, next) => {
      if (req.path === '/' || req.path === '/index.html' || req.path === '/sw.js' || req.path === '/manifest.json') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      next();
    });

    app.use(express.static(staticDir));

    // Server network info API endpoint
    app.get('/api/info', async (req, res) => {
      try {
        const { primaryIp, allIps } = getLocalIpAddresses();
        const actualPort = server.address()?.port || currentPort;
        const localUrl = `http://${primaryIp}:${actualPort}`;
        const qrDataUrl = await generateQrDataUrl(localUrl);

        res.json({
          success: true,
          primaryIp,
          port: actualPort,
          localUrl,
          qrDataUrl,
          allIps
        });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    // Stream endpoints
    app.post('/api/transfer/push', handlePushStream);
    app.get('/api/transfer/pull', handlePullStream);

    // Initialize WebSocket Signalling
    const wss = setupWebSocketSignaling(server);

    // Server error handler for dynamic port fallback
    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[WARN] Port ${currentPort} is in use. Retrying on port ${currentPort + 1}...`);
        currentPort++;
        setTimeout(() => {
          server.close(() => {
            server.listen(currentPort);
          });
        }, 200);
      } else {
        console.error('[ERROR] Server error:', err.message);
        reject(err);
      }
    });

    let browserOpened = false;

    server.listen(currentPort, () => {
      const { primaryIp } = getLocalIpAddresses();
      const actualPort = server.address().port;
      const localUrl = `http://${primaryIp}:${actualPort}`;
      const localhostUrl = `http://localhost:${actualPort}`;

      console.log('\n==================================================');
      console.log('LocalFastShares (LFS) Core Engine Running');
      console.log('--------------------------------------------------');
      console.log(`PC Local Host:  ${localhostUrl}`);
      console.log(`Mobile LAN URL: ${localUrl}`);
      console.log('==================================================\n');

      if (autoOpen && !browserOpened) {
        browserOpened = true;
        openBrowser(localhostUrl);
      }

      const serverHandle = {
        app,
        server,
        wss,
        port: actualPort,
        localUrl,
        localhostUrl,
        stop: () => new Promise((res) => {
          wss.close(() => {
            server.close(() => res());
          });
        })
      };

      if (onListening) onListening(serverHandle);
      resolve(serverHandle);
    });
  });
}

// Auto-start only when executed directly: node core/server.js
const isDirectExecution = process.argv[1] && path.basename(process.argv[1]) === 'server.js';
if (isDirectExecution) {
  createLfsServer().catch(err => {
    console.error('[FATAL] Failed to start LFS Server:', err);
    process.exit(1);
  });
}
