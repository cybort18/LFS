import { WebSocketServer } from 'ws';
import crypto from 'crypto';

// In-memory room and client store
// clients: Map<peerId, { ws, peerId, deviceId, deviceName, deviceType, isDesktop, roomId, connectedAt }>
const clients = new Map();
// activeTransfers: Map<transferId, { transferId, senderId, receiverId, token, accepted, metadata, createdAt }>
const activeTransfers = new Map();

/**
 * Initializes the WebSocket signaling server attached to the HTTP server instance.
 * @param {import('http').Server} server 
 */
export function setupWebSocketSignaling(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('error', (err) => {
    if (err.code !== 'EADDRINUSE') {
      console.error('[ERROR] WebSocket Server Error:', err.message);
    }
  });

  // Active ping-pong heartbeat to purge dead/stale connections every 4 seconds
  const heartbeatInterval = setInterval(() => {
    for (const [peerId, client] of clients.entries()) {
      if (client.ws.readyState !== 1 || client.ws.isAlive === false) {
        try {
          client.ws.terminate();
        } catch (e) {}
        clients.delete(peerId);
        broadcastPeerList(client.roomId);
        continue;
      }
      client.ws.isAlive = false;
      client.ws.ping();
    }
  }, 4000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  wss.on('connection', (ws, req) => {
    const peerId = crypto.randomUUID();
    const userAgent = req.headers['user-agent'] || '';
    
    ws.isAlive = true;
    ws.on('pong', () => {
      ws.isAlive = true;
    });

    // Device detection from user agent
    let isDesktop = true;
    let deviceType = 'PC';
    if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) {
      isDesktop = false;
      deviceType = /iphone|ipad|ipod/i.test(userAgent) ? 'iOS' : 'Android';
    } else if (/macintosh|mac os x/i.test(userAgent)) {
      deviceType = 'Mac';
    } else if (/windows/i.test(userAgent)) {
      deviceType = 'Windows PC';
    } else if (/linux/i.test(userAgent)) {
      deviceType = 'Linux PC';
    }

    const clientInfo = {
      ws,
      peerId,
      deviceId: null,
      deviceName: deviceType,
      deviceType,
      isDesktop,
      roomId: 'default-room',
      connectedAt: Date.now()
    };

    clients.set(peerId, clientInfo);
    console.log(`[WS] Client connected: ${peerId} (${deviceType})`);

    // Send welcome message back to connected peer
    sendToPeer(ws, {
      type: 'registered',
      peerId,
      deviceName: clientInfo.deviceName,
      deviceType: clientInfo.deviceType,
      isDesktop: clientInfo.isDesktop
    });

    ws.on('message', (messageBuffer) => {
      try {
        const message = JSON.parse(messageBuffer.toString());
        handlePeerMessage(clientInfo, message);
      } catch (err) {
        console.error(`[ERROR] Invalid WS message from ${peerId}:`, err.message);
      }
    });

    ws.on('close', () => {
      console.log(`[WS] Client disconnected: ${peerId}`);
      clients.delete(peerId);
      broadcastPeerList(clientInfo.roomId);
    });

    ws.on('error', (err) => {
      console.error(`[ERROR] WS error on peer ${peerId}:`, err.message);
      clients.delete(peerId);
      broadcastPeerList(clientInfo.roomId);
    });
  });

  return wss;
}

function handlePeerMessage(client, msg) {
  const { ws, peerId } = client;

  switch (msg.type) {
    case 'register': {
      console.log(`[WS] Client register: ${peerId}, deviceId: ${msg.deviceId}`);
      if (msg.deviceId) {
        client.deviceId = msg.deviceId;
        
        // Remove and close any previous stale socket from the SAME deviceId
        for (const [otherPeerId, otherClient] of clients.entries()) {
          if (otherPeerId !== peerId && otherClient.deviceId === msg.deviceId) {
            console.log(`[WS] Purging duplicate session for deviceId: ${msg.deviceId}, old peerId: ${otherPeerId}`);
            try {
              otherClient.ws.close();
            } catch (e) {}
            clients.delete(otherPeerId);
          }
        }
      }
      if (msg.deviceName) client.deviceName = msg.deviceName;
      if (msg.roomId) client.roomId = msg.roomId;
      
      // Broadcast updated peer list once client is fully registered
      broadcastPeerList(client.roomId);
      break;
    }

    case 'scan-devices': {
      const peers = getRoomPeers(client.roomId, peerId);
      console.log(`[WS] scan-devices requested by ${peerId} (${client.deviceId}), returning ${peers.length} peers:`, peers.map(p => `${p.deviceName} (${p.deviceId})`));
      sendToPeer(ws, {
        type: 'scan-results',
        peers,
        timestamp: Date.now()
      });
      break;
    }

    case 'transfer-request': {
      const { targetPeerId, metadata } = msg;
      console.log(`[WS] transfer-request from ${peerId} (${client.deviceName}) to target ${targetPeerId}`);
      const targetClient = clients.get(targetPeerId);

      if (!targetClient || targetClient.ws.readyState !== 1) {
        console.warn(`[WS] targetClient not found or disconnected: ${targetPeerId}`);
        sendToPeer(ws, {
          type: 'transfer-error',
          message: 'Target device is disconnected or offline.'
        });
        return;
      }

      const transferId = crypto.randomUUID();
      const token = crypto.randomBytes(16).toString('hex');

      activeTransfers.set(transferId, {
        transferId,
        senderId: peerId,
        receiverId: targetPeerId,
        token,
        accepted: false,
        metadata,
        createdAt: Date.now()
      });

      console.log(`[WS] Forwarding incoming-transfer-request to ${targetPeerId} for file: ${metadata?.name}`);
      // Notify target (receiver) with confirmation prompt
      sendToPeer(targetClient.ws, {
        type: 'incoming-transfer-request',
        transferId,
        token,
        senderId: peerId,
        senderDeviceName: client.deviceName,
        metadata
      });
      break;
    }

    case 'transfer-response': {
      const { transferId, accepted } = msg;
      console.log(`[WS] transfer-response for ${transferId}: accepted=${accepted}`);
      const transfer = activeTransfers.get(transferId);

      if (!transfer) {
        sendToPeer(ws, {
          type: 'transfer-error',
          message: 'Transfer session expired or invalid.'
        });
        return;
      }

      const senderClient = clients.get(transfer.senderId);
      if (!senderClient) {
        sendToPeer(ws, {
          type: 'transfer-error',
          message: 'Sender device has disconnected.'
        });
        activeTransfers.delete(transferId);
        return;
      }

      transfer.accepted = !!accepted;

      if (accepted) {
        sendToPeer(senderClient.ws, {
          type: 'transfer-accepted',
          transferId,
          token: transfer.token,
          receiverId: peerId,
          receiverDeviceName: client.deviceName
        });
      } else {
        sendToPeer(senderClient.ws, {
          type: 'transfer-rejected',
          transferId,
          receiverDeviceName: client.deviceName
        });
        activeTransfers.delete(transferId);
      }
      break;
    }

    case 'transfer-cancel': {
      const { transferId } = msg;
      const transfer = activeTransfers.get(transferId);
      if (transfer) {
        const otherId = transfer.senderId === peerId ? transfer.receiverId : transfer.senderId;
        const otherClient = clients.get(otherId);
        if (otherClient && otherClient.ws.readyState === 1) {
          sendToPeer(otherClient.ws, {
            type: 'transfer-cancelled',
            transferId
          });
        }
        activeTransfers.delete(transferId);
      }
      break;
    }

    case 'ping':
      sendToPeer(ws, { type: 'pong' });
      break;
  }
}

function getRoomPeers(roomId, currentPeerId) {
  const currentClient = clients.get(currentPeerId);
  const currentDeviceId = currentClient?.deviceId;
  const result = [];
  const seenDevices = new Set();
  
  if (currentDeviceId) {
    seenDevices.add(currentDeviceId);
  }

  for (const client of clients.values()) {
    // Client MUST have completed register with a valid deviceId and socket must be OPEN (1)
    if (!client.deviceId || client.ws.readyState !== 1) {
      continue;
    }

    // Exclude self peerId AND self deviceId (if known)
    const isSelf = client.peerId === currentPeerId || (currentDeviceId && client.deviceId === currentDeviceId);
    if (!isSelf && client.roomId === roomId) {
      if (!seenDevices.has(client.deviceId)) {
        seenDevices.add(client.deviceId);
        result.push({
          peerId: client.peerId,
          deviceId: client.deviceId,
          deviceName: client.deviceName,
          deviceType: client.deviceType,
          isDesktop: client.isDesktop
        });
      }
    }
  }
  return result;
}

function broadcastPeerList(roomId) {
  for (const client of clients.values()) {
    if (client.roomId === roomId && client.ws && client.ws.readyState === 1) {
      const peers = getRoomPeers(roomId, client.peerId);
      sendToPeer(client.ws, {
        type: 'peer-list-updated',
        peers
      });
    }
  }
}

function sendToPeer(ws, payload) {
  if (ws && ws.readyState === 1) {
    ws.send(JSON.stringify(payload));
  }
}

export function getTransferSession(transferId) {
  return activeTransfers.get(transferId);
}

export function removeTransferSession(transferId) {
  activeTransfers.delete(transferId);
}
