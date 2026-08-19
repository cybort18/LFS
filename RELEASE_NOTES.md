# LocalFastShares (LFS) v1.0.0 - Release Notes

## What's New

We are excited to announce the initial release of **LocalFastShares (LFS) v1.0.0** — an ultra-lightweight, 100% offline peer-to-peer local file transfer tool designed for high-speed sharing over LAN and Wi-Fi without internet or cables.

---

## Key Highlights

- **Ultra-Lightweight Standalone Windows Executable:** Runs directly as a native System Tray daemon with only ~25 MB idle RAM (zero Electron/Chromium overhead).
- **100% Offline with Zero Data Quota:** Operates completely inside your local Wi-Fi / Ethernet subnet.
- **Zero-Disk Streaming Engine:** Uses Node.js PassThrough stream piping to stream data directly from sender to receiver with no temporary server disk storage.
- **60 FPS Hardware-Accelerated Web UI:** Butter-smooth rendering and real-time transfer telemetry.
- **Mobile PWA & 1-Click QR Connection:** Instant connection on smartphones and tablets by scanning the dynamic QR code with native offline caching.
- **Privacy First:** Every transfer session uses dynamic, one-time cryptographically random tokens and requires explicit receiver consent.

---

## Download & Installation (Windows)

No installation or Node.js runtime required!

1. Download **`LocalFastShares-v1.0.0-windows-x64.zip`** from the Assets section below.
2. Extract the ZIP archive anywhere on your PC.
3. **To Run Instantly (Portable Mode):** Double-click **`LFS.exe`**.
4. **To Install Permanently (Desktop & Start Menu Shortcuts + Auto-start):** Double-click **`install.bat`**.
5. The application will run silently in your Windows System Tray (bottom right corner) and immediately open your default browser to `http://localhost:3000`.

---

## System Requirements

- **Operating System:** Windows 10 / Windows 11 (64-bit)
- **Network:** Connected to the same Wi-Fi router or LAN network as other devices
- **RAM:** Minimum 50 MB available RAM
