# LocalFastShares (LFS)

> **High-speed, 100% offline local peer-to-peer file transfer over LAN / Wi-Fi with zero-disk streaming, ultra-lightweight Desktop System Tray daemon (~25 MB RAM), and Mobile PWA/Capacitor.**

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B%20%7C%2022%2B-brightgreen.svg)
![Status](https://img.shields.io/badge/Tests-Playwright%20Passed-success.svg)
![PWA](https://img.shields.io/badge/PWA-100%25%20Offline%20Ready-brightgreen.svg)

---

## Overview

**LocalFastShares (LFS)** is a lightweight, local-first application designed for fast, seamless file transfers between PCs and mobile devices (PC-to-Mobile, Mobile-to-PC, and PC-to-PC) across the same Local Area Network (LAN) or Wi-Fi.

Unlike traditional cloud-based sharing services, LFS requires **zero internet access (0 KB Quota)**, **no cloud uploads**, and **no third-party server relay**. Files are transferred directly through high-speed Node.js `PassThrough` chunked HTTP streams without ever being written to the server's temporary disk.

---

## Download Standalone Windows Executable (.exe)

Users do **not** need to install Node.js or use terminal commands. You can download the portable standalone package directly:

* **Download Latest Release:** [GitHub Releases](https://github.com/cybort18/LFS/releases/latest)
* **Archive Name:** `LocalFastShares-v1.0.0-windows-x64.zip`
* **How to Run:**
  1. Download and extract `LocalFastShares-v1.0.0-windows-x64.zip`.
  2. Double-click **`LocalFastShares.exe`**.
  3. The application will start in your Windows System Tray (bottom-right taskbar) and automatically launch your default web browser to the dashboard.

---

## Key Features

- **100% Offline and Private:** Operates entirely within your local subnet. No data ever leaves your network.
- **Zero-Disk Streaming Engine:** Uses native Node.js HTTP `PassThrough` stream piping directly from the sender's upload socket to the receiver's download socket, eliminating server disk I/O bottlenecks and storage wear.
- **Ultra-Lightweight Desktop System Tray (~25 MB RAM):** Runs directly in the Windows System Tray with instant startup, zero Chromium overhead, automatic default browser launching, and quick-access LAN/Localhost IP display.
- **60 FPS Hardware-Accelerated UI:** Optimized rendering with RAF telemetry throttling, clean CSS surface layering, and instant asset caching.
- **Mobile PWA and 100% Offline Caching:** Mobile devices can install LFS to their Home Screen with 1 click; assets are cached offline via Service Worker.
- **1-Click Mobile QR Connect:** Generates dynamic local IP QR codes for instant mobile camera connection.
- **Device Discovery and Renaming:** Automatically detects connected devices with OS and browser detection, and allows users to set custom device nicknames (*e.g., "Work Laptop"*, *"Samsung S23"*).
- **Self-Exclusion Intelligence:** Persistent device fingerprinting prevents the host machine or multiple open tabs from detecting themselves.
- **Real-Time Stream Telemetry:** Live transfer speeds (`MB/s`), byte counters, percentage progress bar, and estimated time of arrival (`ETA`).
- **Automated E2E Testing:** Full end-to-end test suite verified via Playwright multi-device browser automation.

---

## Project Structure

The project is organized in a clean, modular architecture:

```text
LFS/
├── apps/
│   ├── desktop/                 # [DESKTOP] Lightweight System Tray Daemon
│   │   ├── tray.js              # Native Windows Tray daemon & browser launcher
│   │   ├── build.js             # Standalone SEA .exe & ZIP build compiler
│   │   ├── assets/              # Native .ico tray assets
│   │   └── package.json         # Desktop packaging & build scripts
│   │
│   └── mobile/                  # [MOBILE] Capacitor Native Wrapper
│       ├── capacitor.config.json# Capacitor mobile app configuration
│       └── package.json         # Mobile sync & native launch scripts
│
├── core/                        # [SHARED CORE] Streaming Engine & Server
│   ├── server.js                # Express & WS server factory
│   ├── signaling/
│   │   └── wsHandler.js         # WebSocket signaling server & deduplication
│   ├── transfer/
│   │   └── streamHandler.js     # Zero-Disk PassThrough HTTP stream pipeline
│   └── utils/
│       ├── network.js           # Local IPv4 physical network detection
│       ├── qr.js                # QR code Data URL generator
│       └── sanitize.js          # File & header sanitization
│
├── public/                      # [SHARED FRONTEND] Web UI & PWA Assets
│   ├── manifest.json            # PWA Web App Manifest
│   ├── sw.js                    # Service Worker for 100% offline caching (v3)
│   ├── icons/                   # Official vector icons (icon_1, landscape, transparent)
│   ├── css/
│   │   └── style.css            # Studio minimalist design system (GPU accelerated)
│   ├── js/
│   │   ├── app.js               # UI coordinator & Service Worker installer
│   │   ├── wsClient.js          # WebSocket client & persistent device ID
│   │   ├── qrClient.js          # QR code generator & LAN IP handler
│   │   └── transferEngine.js    # 60 FPS RAF-throttled stream uploader/downloader
│   └── index.html               # Main responsive user interface
│
├── dist/                        # [BUILD OUTPUT] Standalone Executable & Assets
│   ├── LocalFastShares.exe      # Compiled Windows Standalone Executable
│   └── LocalFastShares-v1.0.0-windows-x64.zip
│
├── tests/
│   └── e2e.spec.js              # Playwright multi-device E2E tests
├── playwright.config.js         # Playwright test configuration
├── package.json                 # Project manifest & scripts
└── README.md
```

---

## Getting Started

### Prerequisites (For Developers)

- [Node.js](https://nodejs.org/) (version 18.x, 20.x, or 22.x recommended)
- Connected to a Local Area Network (Wi-Fi or Ethernet)

### Installation

```bash
git clone https://github.com/your-username/localfastshares.git
cd localfastshares
npm install
```

### Running the Desktop App (Development Tray Mode)

```bash
npm run desktop
```
- Runs directly in the **Windows System Tray** with **~25 MB idle RAM**.
- Automatically opens the LFS dashboard in your default browser.
- Tray context menu displays **Localhost URL**, **Mobile LAN URL**, and **Quick Exit**.

### Building the Standalone Executable (.exe)

```bash
npm run desktop:build
```
- Bundles all backend modules with `esbuild`.
- Generates a native Single Executable Application (`dist/LocalFastShares.exe`) via Node.js SEA.
- Packages a portable release archive at `dist/LocalFastShares-v1.0.0-windows-x64.zip`.

### Running the Core Server (Web Mode)

```bash
npm start
```
- Opens `http://localhost:3000` in the browser.

---

## Testing

Run the automated Playwright End-to-End test suite:

```bash
npm test
```

---

## Security and Privacy Considerations

- **Local Scope Only:** The server binds to your local network interface (`0.0.0.0`) and is only accessible by devices connected to the same Wi-Fi router / subnet.
- **One-Time Transfer Tokens:** Every transfer session generates a cryptographically random token (`crypto.randomBytes(16)`) that expires upon transfer completion.
- **Explicit Consent Required:** Transfers require the receiving user to explicitly click **Accept & Download** before stream transmission begins.

---

## License

This project is licensed under the [MIT License](LICENSE).
