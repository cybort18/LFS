/**
 * High-Speed HTTP Chunked Transfer Engine for LocalFastShares (LFS)
 * Uses standard XMLHttpRequest upload progress with RAF-throttled 60 FPS telemetry.
 */
export class TransferEngine {
  /**
   * Uploads a file via HTTP POST to the backend memory bridge with real-time speed tracking.
   * @param {File} file File object to send
   * @param {string} transferId Transfer Session ID
   * @param {string} token Consent Token
   * @param {Function} onProgress Progress callback ({ bytesTransferred, totalBytes, percent, speedMBps, etaSeconds })
   * @returns {Promise<void>}
   */
  static uploadFile(file, transferId, token, onProgress) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const url = `/api/transfer/push?transferId=${encodeURIComponent(transferId)}&token=${encodeURIComponent(token)}`;

      const startTime = Date.now();
      let lastTime = startTime;
      let lastBytes = 0;
      let rafPending = false;
      let latestStats = null;

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const now = Date.now();
          const timeDiffSec = (now - lastTime) / 1000;

          if (timeDiffSec >= 0.1 || e.loaded === e.total) {
            const bytesDiff = e.loaded - lastBytes;
            const currentSpeedMBps = (bytesDiff / (1024 * 1024)) / (timeDiffSec || 0.001);
            const percent = Math.min(100, Math.round((e.loaded / e.total) * 100));

            const remainingBytes = e.total - e.loaded;
            const avgSpeedMBps = (e.loaded / (1024 * 1024)) / ((now - startTime) / 1000 || 0.001);
            const etaSeconds = avgSpeedMBps > 0 ? Math.round((remainingBytes / (1024 * 1024)) / avgSpeedMBps) : 0;

            latestStats = {
              bytesTransferred: e.loaded,
              totalBytes: e.total,
              percent,
              speedMBps: currentSpeedMBps.toFixed(1),
              etaSeconds
            };

            if (!rafPending && onProgress) {
              rafPending = true;
              requestAnimationFrame(() => {
                if (latestStats && onProgress) {
                  onProgress(latestStats);
                }
                rafPending = false;
              });
            }

            lastTime = now;
            lastBytes = e.loaded;
          }
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during file upload stream'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload transfer aborted by user'));
      });

      xhr.open('POST', url, true);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.send(file);
    });
  }

  /**
   * Triggers native browser file download via attachment GET stream.
   * @param {string} transferId Transfer Session ID
   * @param {string} token Consent Token
   */
  static downloadFile(transferId, token) {
    const downloadUrl = `/api/transfer/pull?transferId=${encodeURIComponent(transferId)}&token=${encodeURIComponent(token)}`;

    // Create an invisible anchor to trigger browser native download manager
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = downloadUrl;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
    }, 1000);
  }
}
