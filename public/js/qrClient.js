/**
 * Desktop QR Code & Local LAN Info Client
 */
export async function initQrClient() {
  const qrImageElem = document.getElementById('qr-image');
  const lanUrlTextElem = document.getElementById('lan-url-text');
  const copyBtnElem = document.getElementById('btn-copy-ip');

  try {
    const response = await fetch('/api/info');
    const data = await response.json();

    if (data.success) {
      if (qrImageElem) qrImageElem.src = data.qrDataUrl;
      if (lanUrlTextElem) lanUrlTextElem.textContent = data.localUrl;

      if (copyBtnElem) {
        copyBtnElem.addEventListener('click', async () => {
          try {
            await navigator.clipboard.writeText(data.localUrl);
            showToast('Copied LAN URL to clipboard!');
          } catch (err) {
            console.error('Clipboard copy failed:', err);
          }
        });
      }
    }
  } catch (err) {
    console.error('Failed to load server info / QR Code:', err);
  }
}

function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
