import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import open from 'open';

import { getLocalIpAddresses } from './utils/network.js';
import { generateQrDataUrl } from './utils/qr.js';
import { setupWebSocketSignaling } from './signaling/wsHandler.js';
import { handlePushStream, handlePullStream } from './transfer/streamHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

let currentPort = parseInt(process.env.PORT || '3000', 10);

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Server network info API endpoint
app.get('/api/info', async (req, res) => {
  try {
    const { primaryIp, allIps } = getLocalIpAddresses();
    const port = server.address()?.port || currentPort;
    const localUrl = `http://${primaryIp}:${port}`;
    const qrDataUrl = await generateQrDataUrl(localUrl);

    res.json({
      success: true,
      primaryIp,
      port,
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
setupWebSocketSignaling(server);

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
  }
});

server.listen(currentPort, () => {
  const { primaryIp } = getLocalIpAddresses();
  const actualPort = server.address().port;
  const localUrl = `http://${primaryIp}:${actualPort}`;
  const localhostUrl = `http://localhost:${actualPort}`;

  console.log('\n==================================================');
  console.log('LocalFastShares (LFS) Server Running');
  console.log('--------------------------------------------------');
  console.log(`PC Local Host:  ${localhostUrl}`);
  console.log(`Mobile LAN URL: ${localUrl}`);
  console.log('==================================================\n');

  // Auto-open browser on host PC in background without blocking
  if (process.env.NODE_ENV !== 'test') {
    open(localhostUrl, { wait: false }).catch(() => {
      console.log(`Auto-browser launch info: Open ${localhostUrl} manually.`);
    });
  }
});

// Graceful error handling
process.on('uncaughtException', (err) => {
  console.error('[ERROR] Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[ERROR] Unhandled Rejection:', reason);
});
