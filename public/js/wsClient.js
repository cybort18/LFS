/**
 * WebSocket Signaling Client for LocalFastShares (LFS)
 */

export function getOrCreateDeviceId() {
  let id = localStorage.getItem('lfs_device_id');
  if (!id) {
    id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    localStorage.setItem('lfs_device_id', id);
  }
  return id;
}

export function detectDeviceDetails() {
  const ua = navigator.userAgent;
  let os = 'PC';
  let isDesktop = true;

  if (/iphone/i.test(ua)) {
    os = 'iPhone';
    isDesktop = false;
  } else if (/ipad/i.test(ua)) {
    os = 'iPad';
    isDesktop = false;
  } else if (/android/i.test(ua)) {
    os = 'Android Device';
    isDesktop = false;
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'Mac';
  } else if (/windows/i.test(ua)) {
    os = 'Windows PC';
  } else if (/linux/i.test(ua)) {
    os = 'Linux PC';
  }

  // Detect browser brand
  let browser = '';
  if (navigator.brave && typeof navigator.brave.isBrave === 'function') {
    browser = 'Brave';
  } else if (/edg/i.test(ua)) {
    browser = 'Edge';
  } else if (/chrome|crios/i.test(ua)) {
    browser = 'Chrome';
  } else if (/firefox|fxios/i.test(ua)) {
    browser = 'Firefox';
  } else if (/safari/i.test(ua)) {
    browser = 'Safari';
  }

  const defaultName = browser ? `${os} (${browser})` : os;
  return { os, browser, isDesktop, defaultName };
}

export function getDeviceName() {
  const saved = localStorage.getItem('lfs_device_name');
  if (saved && saved.trim()) return saved.trim();
  const detected = detectDeviceDetails();
  return detected.defaultName;
}

export function setDeviceName(newName) {
  if (newName && newName.trim()) {
    localStorage.setItem('lfs_device_name', newName.trim());
  }
}

export class WSClient {
  constructor(onMessageCallback, onStatusCallback) {
    this.onMessage = onMessageCallback;
    this.onStatus = onStatusCallback;
    this.ws = null;
    this.peerId = null;
    this.deviceId = getOrCreateDeviceId();
    this.deviceInfo = null;
    this.reconnectTimer = null;

    // Graceful disconnect on tab close / reload
    window.addEventListener('beforeunload', () => {
      if (this.ws) {
        this.ws.close();
      }
    });
  }

  connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    this.onStatus('connecting', 'Connecting to LAN signaling server...');
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.onStatus('online', 'Connected to LAN Room');
      if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
      
      // Send deviceId and customized/detected device name
      this.send({
        type: 'register',
        deviceId: this.deviceId,
        deviceName: getDeviceName()
      });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'registered') {
          this.peerId = message.peerId;
          this.deviceInfo = message;
        }
        if (this.onMessage) {
          this.onMessage(message);
        }
      } catch (err) {
        console.error('Failed to parse WS message:', err);
      }
    };

    this.ws.onclose = () => {
      this.onStatus('offline', 'Disconnected (Retrying...)');
      this.reconnectTimer = setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (err) => {
      console.error('WebSocket Error:', err);
      this.onStatus('offline', 'Connection Error');
    };
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('Cannot send WS message: Socket not open.');
    }
  }

  updateDeviceName(newName) {
    setDeviceName(newName);
    this.send({
      type: 'register',
      deviceId: this.deviceId,
      deviceName: newName
    });
  }

  scanDevices() {
    this.send({ type: 'scan-devices' });
  }

  requestTransfer(targetPeerId, metadata) {
    this.send({
      type: 'transfer-request',
      targetPeerId,
      metadata
    });
  }

  respondTransfer(transferId, accepted) {
    this.send({
      type: 'transfer-response',
      transferId,
      accepted
    });
  }

  cancelTransfer(transferId) {
    this.send({
      type: 'transfer-cancel',
      transferId
    });
  }
}
