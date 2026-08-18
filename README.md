# LocalFastShares (LFS)

> **High-speed, 100% offline local peer-to-peer file transfer over LAN / Wi-Fi with zero-disk streaming, Desktop System Tray support, and Mobile PWA/Capacitor.**

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18%2B%20%7C%2020%2B%20%7C%2022%2B-brightgreen.svg)
![Status](https://img.shields.io/badge/Tests-Playwright%20Passed-success.svg)
![PWA](https://img.shields.io/badge/PWA-100%25%20Offline%20Ready-brightgreen.svg)

---

## Overview

**LocalFastShares (LFS)** is a lightweight, local-first application designed for fast, seamless file transfers between PCs and mobile devices (PC-to-Mobile, Mobile-to-PC, and PC-to-PC) across the same Local Area Network (LAN) or Wi-Fi.

Unlike traditional cloud-based sharing services, LFS requires **zero internet access (0 KB Quota)**, **no cloud uploads**, and **no third-party server relay**. Files are transferred directly through high-speed Node.js `PassThrough` chunked HTTP streams without ever being written to the server's temporary disk.

---

## Key Features

- **100% Offline and Private:** Operates entirely within your local subnet. No data ever leaves your network.
- **Zero-Disk Streaming Engine:** Uses native Node.js HTTP `PassThrough` stream piping directly from the sender's upload socket to the receiver's download socket, eliminating server disk I/O bottlenecks and storage wear.
- **Desktop Executable with System Tray:** Runs in the background on Windows/Mac/Linux with minimize-to-tray, tray quick actions, and native desktop notifications.
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
│   ├── desktop/                 # [DESKTOP] Electron System Tray Wrapper
│   │   ├── main.js              # Tray control, window management & daemon
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
│   ├── sw.js                    # Service Worker for 100% offline caching
│   ├── icons/                   # App vector icons (SVG)
│   ├── css/
│   │   └── style.css            # Studio minimalist design system
│   ├── js/
│   │   ├── app.js               # UI coordinator & Service Worker installer
│   │   ├── wsClient.js          # WebSocket client & persistent device ID
│   │   ├── qrClient.js          # QR code generator & LAN IP handler
│   │   └── transferEngine.js    # Zero-disk HTTP stream uploader/downloader
│   └── index.html               # Main responsive user interface
│
├── tests/
│   └── e2e.spec.js              # Playwright multi-device E2E tests
├── playwright.config.js         # Playwright test configuration
├── package.json                 # Project manifest & scripts
└── README.md
```

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18.x, 20.x, or 22.x recommended)
- Connected to a Local Area Network (Wi-Fi or Ethernet)

### Installation

```bash
git clone https://github.com/your-username/localfastshares.git
cd localfastshares
npm install
```

### Running the Core Server (Web Mode)

```bash
npm start
```
- **On PC:** Automatically opens `http://localhost:3000`
- **On Mobile:** Scan the QR code or navigate to `http://<YOUR_LOCAL_IP>:3000`

### Running the Desktop App (System Tray Mode)

```bash
npm run desktop
```
- Opens as a native desktop window.
- When closed, it minimizes to the **System Tray** and continues running in the background.

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
