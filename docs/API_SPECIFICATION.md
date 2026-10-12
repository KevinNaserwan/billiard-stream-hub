# BilliardStream Hub API & WebSocket Protocol Reference

Base URL: `http://<SERVER_IP>:3000`

---

## 1. REST Endpoints

### Cashier: Ambil Semua Meja & Status Sesi
* **Method:** `GET /api/tables`
* **Response (200 OK):**
```json
{
  "status": "success",
  "data": [
    {
      "id": 1,
      "name": "Table 01 - Standard Arena",
      "streamPath": "table1",
      "status": "active",
      "activeSession": {
        "sessionId": "sess_a8b9c0",
        "customerName": "Kevin",
        "durationMinutes": 60,
        "expiresAt": 1728734200000
      }
    }
  ]
}
```

### Cashier: Buka Sesi Meja Baru & Generate QR
* **Method:** `POST /api/sessions/create`
* **Payload:**
```json
{
  "tableId": 1,
  "durationMinutes": 60,
  "customerName": "Kevin"
}
```
* **Response (200 OK):**
```json
{
  "status": "success",
  "session": { "sessionId": "sess_a8b9c0", "token": "..." },
  "playerUrl": "http://192.168.1.100:3000/player.html?token=...",
  "qrDataUrl": "data:image/png;base64,..."
}
```

### Player: Request Simpan Klip 30 Detik Terakhir
* **Method:** `POST /api/player/clip-30s`
* **Payload:** `{ "token": "<JWT_SESSION_TOKEN>" }`
* **Response (200 OK):**
```json
{
  "status": "success",
  "downloadUrl": "/clips/clip_table1_1728734500.mp4",
  "filename": "clip_table1_1728734500.mp4",
  "fileSize": 4915200
}
```

### Player: Kirim Pesanan F&B dari Meja
* **Method:** `POST /api/player/order`
* **Payload:**
```json
{
  "token": "<JWT_SESSION_TOKEN>",
  "items": [
    { "name": "Iced Americano", "price": 25000, "qty": 2 }
  ],
  "notes": "Jangan terlalu manis"
}
```

---

## 2. WebSocket Events

Endpoint: `ws://<SERVER_IP>:3000?token=<TOKEN>` (untuk player) atau `ws://<SERVER_IP>:3000?role=cashier` (untuk kasir)

### Server -> Player Events:
* `TIME_UPDATE`: `{ "type": "TIME_UPDATE", "remainingSeconds": 3420 }`
* `SESSION_EXPIRED`: `{ "type": "SESSION_EXPIRED", "message": "Waktu bermain habis" }`
* `SESSION_EXTENDED`: `{ "type": "SESSION_EXTENDED", "remainingSeconds": 5220 }`

### Server -> Cashier Events:
* `NEW_ORDER`: `{ "type": "NEW_ORDER", "order": { ... } }`
