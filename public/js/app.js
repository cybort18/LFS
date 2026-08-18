import { WSClient, getOrCreateDeviceId, getDeviceName, setDeviceName } from './wsClient.js';
import { TransferEngine } from './transferEngine.js';
import { initQrClient } from './qrClient.js';

// Application State
const state = {
  myDeviceId: getOrCreateDeviceId(),
  myPeerId: null,
  myDeviceName: getDeviceName(),
  stagedFiles: [],
  selectedPeerId: null,
  activePeers: [],
  isScanning: false,
  scanTimer: null,
  currentTransferId: null,
  pendingIncomingTransfer: null
};

// UI Elements
const elements = {
  wsDot: document.getElementById('ws-dot'),
  wsStatusText: document.getElementById('ws-status-text'),
  myDeviceContainer: document.getElementById('my-device-container'),
  myDeviceBadge: document.getElementById('my-device-badge'),
  btnEditDeviceName: document.getElementById('btn-edit-device-name'),
  dropzone: document.getElementById('dropzone'),
  fileInput: document.getElementById('file-input'),
  stagedList: document.getElementById('staged-list'),
  stagedSummary: document.getElementById('staged-summary'),
  btnSendFiles: document.getElementById('btn-send-files'),
  btnScanDevices: document.getElementById('btn-scan-devices'),
  deviceList: document.getElementById('device-list'),
  radarAnimation: document.getElementById('radar-animation'),
  radarTimer: document.getElementById('radar-timer'),
  
  // Progress Panel
  progressCard: document.getElementById('progress-card'),
  transferStatusTitle: document.getElementById('transfer-status-title'),
  transferFileName: document.getElementById('transfer-file-name'),
  transferPercentage: document.getElementById('transfer-percentage'),
  progressFill: document.getElementById('progress-fill'),
  metricSpeed: document.getElementById('metric-speed'),
  metricBytes: document.getElementById('metric-bytes'),
  metricEta: document.getElementById('metric-eta'),
  btnCancelTransfer: document.getElementById('btn-cancel-transfer'),

  // Consent Modal
  consentModal: document.getElementById('consent-modal'),
  modalSenderTitle: document.getElementById('modal-sender-title'),
  modalSenderDesc: document.getElementById('modal-sender-desc'),
  modalFileList: document.getElementById('modal-file-list'),
  btnRejectTransfer: document.getElementById('btn-reject-transfer'),
  btnAcceptTransfer: document.getElementById('btn-accept-transfer'),

  btnInstallPwa: document.getElementById('btn-install-pwa'),
  toastContainer: document.getElementById('toast-container')
};

let wsClient = null;
let deferredInstallPrompt = null;

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  initQrClient();
  setupWebSocket();
  setupStagingArea();
  setupDeviceScanner();
  setupConsentModal();
  setupDeviceNameEditor();
  renderMyDeviceBadge();
  setupServiceWorker();
  setupPwaInstallPrompt();
});

// PWA Offline Service Worker Registration
function setupServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[LFS PWA] Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('[LFS PWA] Service Worker registration failed:', err);
        });
    });
  }
}

// PWA Install Prompt Handler
function setupPwaInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    if (elements.btnInstallPwa) {
      elements.btnInstallPwa.style.display = 'inline-flex';
      elements.btnInstallPwa.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          if (outcome === 'accepted') {
            showToast('LFS installed to home screen!');
          }
          deferredInstallPrompt = null;
          elements.btnInstallPwa.style.display = 'none';
        }
      });
    }
  });

  window.addEventListener('appinstalled', () => {
    showToast('LFS is now installed and ready offline!');
    if (elements.btnInstallPwa) elements.btnInstallPwa.style.display = 'none';
  });
}

function renderMyDeviceBadge() {
  if (elements.myDeviceBadge) {
    elements.myDeviceBadge.textContent = `${state.myDeviceName} (You)`;
  }
  if (elements.myDeviceContainer) {
    elements.myDeviceContainer.style.display = 'flex';
  }
}

function setupDeviceNameEditor() {
  if (elements.btnEditDeviceName) {
    elements.btnEditDeviceName.addEventListener('click', () => {
      const current = state.myDeviceName || getDeviceName();
      const newName = prompt('Enter a custom name for this device:', current);
      if (newName && newName.trim() && newName.trim() !== current) {
        state.myDeviceName = newName.trim();
        setDeviceName(state.myDeviceName);
        renderMyDeviceBadge();
        if (wsClient) {
          wsClient.updateDeviceName(state.myDeviceName);
        }
        showToast(`Device renamed to "${state.myDeviceName}"`);
      }
    });
  }
}

// WebSocket Signaling Setup
function setupWebSocket() {
  wsClient = new WSClient(
    (msg) => handleWSMessage(msg),
    (status, text) => updateWSStatus(status, text)
  );
  wsClient.connect();
}

function updateWSStatus(status, text) {
  if (elements.wsStatusText) elements.wsStatusText.textContent = text;
  if (elements.wsDot) {
    elements.wsDot.className = 'dot ' + (status === 'online' ? 'online' : '');
  }
}

// Handle Incoming Signaling Messages
function handleWSMessage(msg) {
  switch (msg.type) {
    case 'registered':
      state.myPeerId = msg.peerId;
      renderMyDeviceBadge();
      showToast(`Connected as ${state.myDeviceName}`);
      wsClient.scanDevices();
      break;

    case 'scan-results':
    case 'peer-list-updated':
      // Strictly exclude any peer with same deviceId or same peerId
      state.activePeers = (msg.peers || []).filter(
        p => p.deviceId !== state.myDeviceId && p.peerId !== state.myPeerId
      );
      
      // Auto-select if 1 remote device is found
      if (state.activePeers.length === 1) {
        state.selectedPeerId = state.activePeers[0].peerId;
      } else if (!state.activePeers.some(p => p.peerId === state.selectedPeerId)) {
        state.selectedPeerId = null;
      }

      renderDeviceList();
      updateSendButtonState();
      break;

    case 'incoming-transfer-request':
      state.pendingIncomingTransfer = msg;
      showConsentModal(msg);
      break;

    case 'transfer-accepted':
      showToast(`Transfer accepted by ${msg.receiverDeviceName}! Starting stream...`);
      startSenderStream(msg.transferId, msg.token);
      break;

    case 'transfer-rejected':
      showToast(`Transfer rejected by ${msg.receiverDeviceName}`, 'error');
      resetProgressUI();
      break;

    case 'transfer-cancelled':
      showToast('Transfer session was cancelled', 'error');
      resetProgressUI();
      break;

    case 'transfer-error':
      showToast(msg.message || 'Transfer error', 'error');
      resetProgressUI();
      break;
  }
}

// Staging Area Handlers
function setupStagingArea() {
  const { dropzone, fileInput } = elements;

  dropzone.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', (e) => {
    addFilesToStaging(Array.from(e.target.files));
    fileInput.value = '';
  });

  ['dragenter', 'dragover'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzone.addEventListener(eventName, (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
    });
  });

  dropzone.addEventListener('drop', (e) => {
    const files = Array.from(e.dataTransfer.files);
    addFilesToStaging(files);
  });

  elements.btnSendFiles.addEventListener('click', initiateTransferRequest);
}

function addFilesToStaging(files) {
  if (!files || files.length === 0) return;

  // Filter out duplicates by name and size
  files.forEach(newFile => {
    if (!state.stagedFiles.some(f => f.name === newFile.name && f.size === newFile.size)) {
      state.stagedFiles.push(newFile);
    }
  });

  renderStagedList();
  updateSendButtonState();
}

function renderStagedList() {
  const { stagedList, stagedSummary } = elements;
  stagedList.innerHTML = '';

  let totalBytes = 0;

  state.stagedFiles.forEach((file, index) => {
    totalBytes += file.size;

    const item = document.createElement('div');
    item.className = 'file-item';
    item.innerHTML = `
      <div class="file-meta">
        <div class="file-icon">
          <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
        </div>
        <div>
          <div class="file-name">${escapeHtml(file.name)}</div>
          <div class="file-size mono">${formatBytes(file.size)}</div>
        </div>
      </div>
      <button class="btn-icon btn-remove" data-index="${index}" title="Remove file">
        <svg width="16" height="16" fill="none" stroke="var(--accent-rose)" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
      </button>
    `;
    stagedList.appendChild(item);
  });

  // Attach delete handlers
  stagedList.querySelectorAll('.btn-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      state.stagedFiles.splice(idx, 1);
      renderStagedList();
      updateSendButtonState();
    });
  });

  // Update summary
  const count = state.stagedFiles.length;
  stagedSummary.textContent = `${count} ${count === 1 ? 'file' : 'files'} (${formatBytes(totalBytes)})`;
}

function updateSendButtonState() {
  const count = state.stagedFiles.length;
  elements.btnSendFiles.disabled = !(count > 0 && state.selectedPeerId);
}

// Device Scanner Handlers
function setupDeviceScanner() {
  elements.btnScanDevices.addEventListener('click', () => {
    startScanningSession();
  });
}

function startScanningSession() {
  if (state.isScanning) return;

  state.isScanning = true;
  elements.radarAnimation.style.display = 'flex';
  elements.btnScanDevices.disabled = true;
  wsClient.scanDevices();

  let secondsLeft = 60;
  elements.radarTimer.textContent = `${secondsLeft}s remaining`;

  state.scanTimer = setInterval(() => {
    secondsLeft--;
    elements.radarTimer.textContent = `${secondsLeft}s remaining`;

    if (secondsLeft <= 0) {
      stopScanningSession();
    }
  }, 1000);
}

function stopScanningSession() {
  state.isScanning = false;
  if (state.scanTimer) clearInterval(state.scanTimer);
  elements.radarAnimation.style.display = 'none';
  elements.btnScanDevices.disabled = false;
}

function renderDeviceList() {
  const { deviceList } = elements;
  deviceList.innerHTML = '';

  const validPeers = state.activePeers.filter(
    p => p.deviceId !== state.myDeviceId && p.peerId !== state.myPeerId
  );

  if (validPeers.length === 0) {
    deviceList.innerHTML = `
      <div style="text-align: center; padding: 1.25rem 0.5rem;">
        <p class="dropzone-text" style="font-size: 0.875rem; margin-bottom: 0.25rem;">No other devices detected</p>
        <p class="dropzone-sub" style="font-size: 0.75rem;">Scan the QR code with your mobile device to join.</p>
      </div>
    `;
    return;
  }

  validPeers.forEach(peer => {
    const isSelected = state.selectedPeerId === peer.peerId;
    const item = document.createElement('div');
    item.className = `device-item ${isSelected ? 'selected' : ''}`;
    item.innerHTML = `
      <div class="device-info">
        <div class="device-badge-icon">
          <svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${peer.isDesktop ? 'M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z' : 'M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z'}"></path></svg>
        </div>
        <div>
          <div class="device-name">${escapeHtml(peer.deviceName || peer.deviceType)}</div>
          <div class="device-sub">${peer.isDesktop ? 'PC Desktop' : 'Mobile Device'}</div>
        </div>
      </div>
    `;

    item.addEventListener('click', () => {
      state.selectedPeerId = peer.peerId;
      renderDeviceList();
      updateSendButtonState();
    });

    deviceList.appendChild(item);
  });
}

// Initiate Transfer
function initiateTransferRequest() {
  if (!state.selectedPeerId || state.stagedFiles.length === 0) return;

  const targetPeer = state.activePeers.find(p => p.peerId === state.selectedPeerId);
  const targetName = targetPeer ? targetPeer.deviceName : 'Target Device';

  const firstFile = state.stagedFiles[0];
  const totalSize = state.stagedFiles.reduce((acc, f) => acc + f.size, 0);

  const metadata = {
    name: firstFile.name,
    size: firstFile.size,
    totalSize,
    fileCount: state.stagedFiles.length,
    type: firstFile.type
  };

  showProgressUI(`Requesting transfer to ${targetName}...`, firstFile.name);
  wsClient.requestTransfer(state.selectedPeerId, metadata);
}

// Consent Modal Handlers
function setupConsentModal() {
  elements.btnRejectTransfer.addEventListener('click', () => {
    if (state.pendingIncomingTransfer) {
      wsClient.respondTransfer(state.pendingIncomingTransfer.transferId, false);
      state.pendingIncomingTransfer = null;
    }
    hideConsentModal();
  });

  elements.btnAcceptTransfer.addEventListener('click', () => {
    if (state.pendingIncomingTransfer) {
      const { transferId, token, metadata, senderDeviceName } = state.pendingIncomingTransfer;
      wsClient.respondTransfer(transferId, true);
      hideConsentModal();

      showToast(`Downloading ${metadata.name} from ${senderDeviceName}...`);
      startReceiverDownload(transferId, token);
      state.pendingIncomingTransfer = null;
    }
  });
}

function showConsentModal(msg) {
  const { metadata, senderDeviceName } = msg;
  elements.modalSenderTitle.textContent = `Incoming File from ${senderDeviceName}`;
  elements.modalSenderDesc.textContent = `Wants to send ${metadata.fileCount || 1} file(s) (${formatBytes(metadata.totalSize || metadata.size)}). Accept?`;

  elements.modalFileList.innerHTML = `
    <div class="file-item">
      <div class="file-meta">
        <div class="file-name">${escapeHtml(metadata.name)}</div>
        <div class="file-size mono">${formatBytes(metadata.size)}</div>
      </div>
    </div>
  `;

  elements.consentModal.classList.add('active');
}

function hideConsentModal() {
  elements.consentModal.classList.remove('active');
}

// Stream Pipeline Execution
async function startSenderStream(transferId, token) {
  if (state.stagedFiles.length === 0) return;
  const file = state.stagedFiles[0];

  try {
    state.currentTransferId = transferId;
    await TransferEngine.uploadFile(
      file,
      transferId,
      token,
      (stats) => updateProgressUI(stats)
    );

    showToast('File transfer sent successfully!');
    resetProgressUI();
    state.stagedFiles.shift(); // remove transferred file from staging
    renderStagedList();
    updateSendButtonState();
  } catch (err) {
    console.error('Sender stream error:', err);
    showToast('Transfer failed during streaming', 'error');
    resetProgressUI();
  }
}

function startReceiverDownload(transferId, token) {
  try {
    state.currentTransferId = transferId;
    TransferEngine.downloadFile(transferId, token);
    resetProgressUI();
  } catch (err) {
    console.error('Receiver download error:', err);
    showToast('Download failed', 'error');
    resetProgressUI();
  }
}

// Progress Panel UI Helpers
function showProgressUI(title, filename) {
  elements.progressCard.style.display = 'flex';
  elements.transferStatusTitle.textContent = title;
  elements.transferFileName.textContent = filename;
  elements.progressFill.style.width = '0%';
  elements.transferPercentage.textContent = '0%';
  elements.metricSpeed.textContent = '0.0 MB/s';
  elements.metricBytes.textContent = '0 MB / 0 MB';
  elements.metricEta.textContent = '--:--';
}

function updateProgressUI(stats) {
  const { bytesTransferred, totalBytes, percent, speedMBps, etaSeconds } = stats;
  elements.progressFill.style.width = `${percent}%`;
  elements.transferPercentage.textContent = `${percent}%`;
  elements.metricSpeed.textContent = `${speedMBps} MB/s`;
  elements.metricBytes.textContent = `${formatBytes(bytesTransferred)} / ${formatBytes(totalBytes)}`;
  
  const min = Math.floor(etaSeconds / 60);
  const sec = etaSeconds % 60;
  elements.metricEta.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function resetProgressUI() {
  elements.progressCard.style.display = 'none';
  state.currentTransferId = null;
}

// Utilities
function formatBytes(bytes, decimals = 1) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3500);
}
