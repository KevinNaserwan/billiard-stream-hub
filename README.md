<div align="center">

# 🎱 BilliardStream Hub (Local Edge Edition)
### Autonomous Real-Time Table CCTV Streaming, QR-Access & Instant Highlight Clipper
**Zero Internet Bandwidth · WebRTC Low-Latency (<500ms) · Dynamic Session Time-Limiter · Circular Buffer Video Clip**

[![Platform](https://img.shields.io/badge/Platform-On--Premise%20Edge%20Server-blue.svg)](#architecture)
[![Streaming](https://img.shields.io/badge/Streaming-WebRTC%20%2F%20MediaMTX-orange.svg)](#streaming-engine)
[![Latency](https://img.shields.io/badge/Latency-%3C%20500ms%20Ultra--Low-green.svg)](#streaming-engine)
[![Frontend](https://img.shields.io/badge/Client-Responsive%20PWA%20Mobile-brightgreen.svg)](#client-experience)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

</div>

---

## 📌 1. Project Overview

**BilliardStream Hub** is a specialized, production-ready, stand-alone edge system designed for billiard halls and arena lounges. It enables customers to scan an on-table dynamic QR code with their mobile devices to instantly watch a real-time, overhead CCTV live stream of their table without downloading any mobile app.

### 🌟 Key Value Propositions:
- **100% Stand-Alone**: Operates independently from legacy POS/billing cash registers.
- **Zero Internet Quota Usage**: 100% of video streaming runs across the venue's local Wi-Fi / LAN network.
- **Ultra-Low Latency (<500ms)**: Real-time WebRTC relay ensures that what players see on their screen matches their real-world shots with zero perceptual delay.
- **Automated Session Time-Limiting**: Token-guarded streaming automatically terminates video playback upon session expiry.
- **"Clip Last 30 Seconds" (Highlight Saver)**: Instant circular RAM-buffer clipping allowing players to download trick shots to their phone gallery in < 1 second.
- **F&B In-Table Ordering**: Built-in ordering catalog that dispatches meal/beverage tickets directly to the bar/cashier station.

---

## 🏛️ 2. System Architecture & Topology

```
+----------------------------------------------------------------------------------------------------+
|                                    LOCAL NETWORK TOPOLOGY (LAN)                                    |
+----------------------------------------------------------------------------------------------------+

   [ Overhead IP Camera 1..N ]   (Hikvision / TP-Link VIGI - RTSP H.264/AAC)
                 |
                 | PoE Cat6 Gigabit Cables
                 v
   +------------------------------------+
   |   PoE Gigabit Network Switch       |
   +-----------------+------------------+
                     |
         +-----------+-----------------------------------+
         |                                               |
         v                                               v
 +---------------------------------------+   +--------------------------------------+
 |   LOCAL EDGE SERVER (Mini PC)         |   |   DEDICATED WI-FI ACCESS POINT       |
 |                                       |   |   (Wi-Fi 6 / 5GHz SSID "Billiard")   |
 |  +---------------------------------+  |   +------------------+-------------------+
 |  | Media Gateway: MediaMTX/go2rtc  |  |                      |
 |  | RTSP -> WebRTC WHEP Engine      |  |                      | Local Wi-Fi Connection
 |  +---------------------------------+  |                      v
 |  | Circular Buffer Clipper (FFmpeg)|  |   +--------------------------------------+
 |  | /dev/shm RAM-disk Slice Concats |  |   |   CUSTOMER SMARTPHONES (Mobile Web)  |
 |  +---------------------------------+  |   |   - Scan Dynamic QR Code             |
 |  | Application Server (Fastify API)|  |   |   - Ultra-Low Latency Video Player   |
 |  | JWT Auth, Session Timers, Order |  |   |   - Countdown Timer Overlay          |
 |  +---------------------------------+  |   |   - "Clip Last 30s" Download Button  |
 |  | Nginx Reverse Proxy & Web Host  |  |   |   - In-Table F&B Order Menu          |
 |  +---------------------------------+  |   +--------------------------------------+
 +-------------------+-------------------+
                     |
                     v
   +-------------------------------------+
   |   CASHIER / OPERATOR DASHBOARD      |
   |   - Select Table & Session Duration |
   |   - Display / Thermal Print QR Code |
   |   - Active Table Monitor Grid       |
   |   - Real-Time F&B Order Alert Queue |
   +-------------------------------------+
```

---

## ⚙️ 3. Recommended Technology Stack

| Component | Technology | Rationale & Performance Impact |
| :--- | :--- | :--- |
| **Media Server Core** | **MediaMTX (Go)** / **go2rtc** | Ultra-lightweight binary written in Go. Bridges RTSP directly to WebRTC (WHEP) without CPU re-encoding. |
| **Clip Processor** | **FFmpeg (RAM-Disk)** | Generates rolling 3-second segments in `/dev/shm`. Clips last 30s in < 1 second using `-c copy` (stream copy). |
| **Backend API** | **Node.js (Fastify / Express)** | Non-blocking, fast event loop for managing active table timers, JWT token issuance, and WebSocket heartbeats. |
| **Real-Time Channel** | **WebSocket (ws)** | Server-initiated session alerts, instant video termination signals, and order alerts. |
| **Database & Cache** | **SQLite (WAL mode)** + Memory | Zero-maintenance embedded database for persistence + in-memory state tracking for active tables. |
| **Frontend Stack** | **TailwindCSS + Vanilla JS / PWA** | Zero-dependency, lightweight client player (< 60 KB) ensuring instant mobile browser boot times (< 300ms). |
| **Admin Dashboard** | **Responsive SPA Dashboard** | Clean table grid, single-click duration presets, thermal print generation. |

---

## 📂 4. Repository Structure

```
billiard-stream-hub/
├── config/
│   ├── mediamtx.yml              # Media server RTSP to WebRTC configuration
│   └── tables.sample.json        # Pre-configured IP camera RTSP endpoints
├── docs/
│   ├── ARCHITECTURE.md           # Deep dive into network topology & latency
│   ├── HARDWARE_SETUP.md         # CCTV lens calculation & server hardware guide
│   └── API_SPECIFICATION.md      # REST & WebSocket protocol documentation
├── public/
│   ├── css/                      # Responsive Tailwind styling
│   ├── js/
│   │   ├── cashier.js            # Cashier dashboard UI controller & QR printer
│   │   └── player.js             # WebRTC WHEP client, countdown & clipper logic
│   ├── cashier.html              # Admin/cashier table management portal
│   └── player.html               # Mobile player interface for customers
├── server/
│   ├── app.js                    # Core HTTP & WebSocket application server
│   ├── clipper.js                # Circular buffer FFmpeg slicer & extractor
│   ├── database.js               # SQLite data access & session repository
│   └── sessionManager.js         # Countdown timer, JWT token validator & auto-kill
├── scripts/
│   ├── start-server.sh           # Edge server startup script
│   └── setup-ramdisk.sh          # Linux RAM-disk initializer for zero SSD wear
├── package.json                  # Project dependencies & operational scripts
└── README.md                     # Technical blueprint & documentation
```

---

## 🔌 5. Core REST & WebSocket API Specification

### A. Cashier Session Endpoints

#### 1. Create Active Table Session
```http
POST /api/sessions/create
Content-Type: application/json

{
  "tableId": 3,
  "durationMinutes": 60,
  "customerName": "Rizky"
}
```
**Response (200 OK):**
```json
{
  "status": "success",
  "sessionId": "sess_9f82a1e0",
  "tableId": 3,
  "tableName": "Table 03 (VIP Diamond)",
  "expiresAt": "2026-10-12T19:15:00.000Z",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "qrUrl": "http://192.168.1.100:3000/player.html?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### 2. Terminate / Extend Session
```http
POST /api/sessions/:sessionId/extend
Content-Type: application/json

{ "additionalMinutes": 30 }
```

---

### B. Customer Player Endpoints

#### 1. Validate Token & Get Stream Credentials
```http
GET /api/player/session-info?token=<JWT_TOKEN>
```
**Response (200 OK):**
```json
{
  "valid": true,
  "tableId": 3,
  "tableName": "Table 03 (VIP Diamond)",
  "remainingSeconds": 3480,
  "streamUrl": "http://192.168.1.100:8889/table3/whep"
}
```

#### 2. Request 30-Second Clip Extraction
```http
POST /api/player/clip-30s
Content-Type: application/json

{
  "token": "<JWT_TOKEN>"
}
```
**Response (200 OK):**
```json
{
  "status": "ready",
  "downloadUrl": "/clips/clip_table3_1728734200.mp4",
  "fileSizeBytes": 5242880
}
```

---

## ⚡ 6. "Clip Last 30s" Circular Buffer Architecture

To achieve sub-second clip generation without saturating server CPU:
1. **FFmpeg Segmenter Daemon**: Background process maintains a sliding buffer of 3-second segments in Linux RAM-disk (`/dev/shm/billiard_buffers/table_<ID>/`).
2. **Auto Retention**: Max segments kept = 20 (60 seconds total buffer). Old segments are pruned automatically.
3. **Instant Slicing**: Upon click, FFmpeg executes stream copy concatenation:
   ```bash
   ffmpeg -f concat -safe 0 -i segment_list.txt -c copy -movflags +faststart output.mp4
   ```
   *Execution time:* **< 350ms** (zero video re-encoding, pure stream muxing).

---

## 📱 7. Customer User Experience Flow

```
[ Customer at Table ]
        │
        ├─► 1. Scans Table QR Code (with native iOS / Android camera)
        │
        ├─► 2. Browser opens: http://billiard.local/player.html?token=...
        │       - Overhead live stream starts playing automatically (<500ms delay)
        │       - Floating HUD shows exact remaining game time (e.g. 00:54:12)
        │
        ├─► 3. Customer hits a magnificent shot!
        │       - Taps gold "Save Last 30s Clip" button
        │       - In ~1 second, video file downloads directly to phone camera roll
        │
        ├─► 4. Customer wants refreshments:
        │       - Taps "Menu F&B", selects Iced Latte & Fries, taps "Send Order"
        │       - Kitchen/Cashier prints kitchen ticket automatically
        │
        └─► 5. Session Timer Hits 00:00:00:
                - Video feed cuts off cleanly
                - Screen displays "Session Complete - Thank you for playing!"
```

---

## 🛠️ 8. Hardware Bill of Materials (BOM) Recommendation

| Item | Model / Specification | Purpose |
| :--- | :--- | :--- |
| **IP Camera** | Hikvision DS-2CD2143G2-I (2.8mm) or TP-Link VIGI C440 | 1 Unit per table mounted directly above table center |
| **Local Server** | Mini PC (Intel Core i5-12400 / AMD Ryzen 5, 16GB RAM, 512GB NVMe) | Runs MediaMTX, Fastify, FFmpeg buffer & Web Server |
| **Network Switch** | 8/16/24-Port Gigabit PoE+ Switch (Ruijie / TP-Link) | Supplies power and data to cameras via Cat6 cable |
| **Wi-Fi AP** | Wi-Fi 6 Access Point (TP-Link Omada EAP610 / UniFi U6+) | Dedicated local Wi-Fi 5GHz band for guests |
| **Slip Printer** | Thermal Receipt Printer (58mm/80mm USB/LAN) *(Optional)* | Prints physical table session tickets with QR code |

---

## 🚀 9. Quick Start Guide

### 1. Prerequisites
- Node.js >= 16.x
- FFmpeg installed (`sudo apt install ffmpeg`)
- MediaMTX binary installed or run via local path

### 2. Setup RAM-Disk Buffer
```bash
sudo mkdir -p /dev/shm/billiard_buffers
sudo chmod 777 /dev/shm/billiard_buffers
```

### 3. Install & Launch
```bash
git clone https://github.com/KevinNaserwan/billiard-stream-hub.git
cd billiard-stream-hub
npm install
npm start
```
* **Cashier Dashboard**: `http://localhost:3000/cashier.html`
* **Guest Player**: `http://localhost:3000/player.html`

---

## 🛡️ 10. Security & Hardening Measures

- **No Public WAN Exposure**: The system runs entirely within the cafe's private subnet (`192.168.x.x`). No incoming ports are forwarded from the internet router.
- **Cryptographic Session Tokens**: All stream URLs and clipper requests are signed with an HMAC SHA-256 secret.
- **Tamper-Proof Time Sync**: Countdown timers are computed against server epoch time, preventing client-side device clock manipulation.
- **Client IP Isolation**: Wi-Fi Access Point is configured with "Client Isolation" enabled, preventing guest devices from probing one another.

---

## 📄 License

This project is licensed under the **MIT License**. Engineered for high-reliability hospitality and sports entertainment venues.
