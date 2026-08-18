import { PassThrough } from 'stream';
import { getTransferSession, removeTransferSession } from '../signaling/wsHandler.js';
import { sanitizeFilename } from '../utils/sanitize.js';

// Map storing pending stream pipes: Map<transferId, { passThrough, senderReq, receiverRes, metadata, createdAt }>
const pendingStreams = new Map();

/**
 * Handles incoming sender stream POST request.
 * Pipes sender request stream into the in-memory PassThrough stream.
 */
export function handlePushStream(req, res) {
  const { transferId, token } = req.query;

  if (!transferId || !token) {
    return res.status(400).json({ error: 'Missing transferId or token' });
  }

  const session = getTransferSession(transferId);
  if (!session || session.token !== token || !session.accepted) {
    return res.status(403).json({ error: 'Unauthorized or unaccepted transfer session' });
  }

  let streamObj = pendingStreams.get(transferId);

  if (!streamObj) {
    // Create new PassThrough stream bridge if receiver hasn't connected yet
    const passThrough = new PassThrough();
    streamObj = {
      passThrough,
      senderReq: req,
      senderRes: res,
      receiverRes: null,
      bytesTransferred: 0,
      createdAt: Date.now()
    };
    pendingStreams.set(transferId, streamObj);
  } else {
    streamObj.senderReq = req;
    streamObj.senderRes = res;
  }

  req.on('data', (chunk) => {
    streamObj.bytesTransferred += chunk.length;
  });

  req.on('error', (err) => {
    console.error(`Stream error on sender POST (${transferId}):`, err.message);
    if (streamObj.receiverRes && !streamObj.receiverRes.headersSent) {
      streamObj.receiverRes.status(500).json({ error: 'Sender connection error mid-stream' });
    }
    pendingStreams.delete(transferId);
  });

  // Pipe sender payload directly into passThrough stream
  req.pipe(streamObj.passThrough);

  req.on('end', () => {
    res.status(200).json({ success: true, message: 'Stream push completed' });
  });
}

/**
 * Handles incoming receiver download GET request.
 * Sets HTTP attachment headers and pipes the PassThrough stream to receiver response.
 */
export function handlePullStream(req, res) {
  const { transferId, token } = req.query;

  if (!transferId || !token) {
    return res.status(400).json({ error: 'Missing transferId or token' });
  }

  const session = getTransferSession(transferId);
  if (!session || session.token !== token || !session.accepted) {
    return res.status(403).json({ error: 'Unauthorized or unaccepted transfer session' });
  }

  let streamObj = pendingStreams.get(transferId);

  if (!streamObj) {
    // Receiver arrived first; create PassThrough stream
    const passThrough = new PassThrough();
    streamObj = {
      passThrough,
      senderReq: null,
      senderRes: null,
      receiverRes: res,
      bytesTransferred: 0,
      createdAt: Date.now()
    };
    pendingStreams.set(transferId, streamObj);
  } else {
    streamObj.receiverRes = res;
  }

  const safeName = sanitizeFilename(session.metadata?.name || 'transferred_file');
  const fileSize = session.metadata?.size;
  const mimeType = session.metadata?.type || 'application/octet-stream';

  res.setHeader('Content-Type', mimeType);
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(safeName)}"`);
  if (fileSize) {
    res.setHeader('Content-Length', fileSize);
  }

  // Pipe the PassThrough stream directly to receiver response
  streamObj.passThrough.pipe(res);

  res.on('finish', () => {
    pendingStreams.delete(transferId);
    removeTransferSession(transferId);
  });

  res.on('error', (err) => {
    console.error(`Stream error on receiver GET (${transferId}):`, err.message);
    pendingStreams.delete(transferId);
    removeTransferSession(transferId);
  });
}
