# Panduan Integrasi RTSP / ONVIF IP Camera: Hikvision & TP-Link VIGI

Dokumen standar operasional dan konfigurasi teknis pemasangan IP Camera overhead meja billiard untuk dihubungkan ke **Local Streaming Server (Mini PC)** tanpa menyedot kuota internet luar kafe.

---

## 1. Zero-Internet Topology (100% On-Premise LAN)

```
[ IP Camera Hikvision / TP-Link VIGI ]
               │
               ▼ (Kabel UTP Cat6 PoE)
     [ Switch PoE Gigabit ]
               │
         ┌─────┴────────────────────────────────┐
         │ (Kabel LAN Gigabit)                  │ (Kabel LAN Gigabit)
         ▼                                      ▼
[ Mini PC Server Lokal ]            [ Dedicated Wi-Fi AP 5GHz ]
(MediaMTX + Fastify/NestJS + NextJS)  (SSID: "Billiard-Arena-Guest")
         │                                      │
         └───────────── WebRTC (WHEP) ──────────┘
                                                │
                                                ▼ (Koneksi Wi-Fi Lokal Tanpa Kuota)
                                      [ Smartphone Pelanggan ]
```

### Kenapa Bebas Kuota Internet Luar?
1. **IP Kamera** mengirim data stream RTSP murni melalui kabel LAN lokal ke Mini PC (`192.168.1.x`).
2. **Mini PC** mengubah RTSP menjadi WebRTC WHEP dan menyiarkannya melalui Wi-Fi Access Point lokal.
3. **HP Pelanggan** yang terhubung ke Wi-Fi kafe langsung menarik stream dari IP lokal Mini PC (`http://192.168.1.100:8889/...`).
4. **Paket Data Internet ISP (Indihome / Biznet / dsb) = 0 KB/s**. Bahkan jika kabel fiber optik internet kafe dicabut/mati, sistem live stream meja dan pemotongan klip **tetap bekerja 100% normal**.

---

## 2. Standar Konfigurasi IP Camera Hikvision

### A. Pengaturan Jaringan (Network)
* **IP Address:** Statik (e.g., Meja 1 = `192.168.1.101`, Meja 2 = `192.168.1.102`, dst.)
* **Subnet:** `255.255.255.0`
* **RTSP Port Default:** `554`
* **HTTP Port:** `80`

### B. Format URL RTSP Hikvision
* **Main Stream (Full HD 1080p - Untuk Streaming Meja & Rekaman Klip):**
  ```
  rtsp://<username>:<password>@<IP_CAMERA>:554/Streaming/Channels/101
  ```
* **Sub Stream (Resolusi Rendah - Opsional untuk Thumbnail Grid Kasir):**
  ```
  rtsp://<username>:<password>@<IP_CAMERA>:554/Streaming/Channels/102
  ```

### C. Pengaturan Video & Audio di Web Admin Hikvision
1. Masuk ke IP kamera via browser -> **Configuration** -> **Video/Audio**:
   * **Stream Type:** Main Stream (Normal)
   * **Video Type:** Video Stream (atau Video & Audio jika ada mic)
   * **Resolution:** `1920*1080` (1080p)
   * **Bitrate Type:** Variable (VBR)
   * **Video Quality:** Higher
   * **Frame Rate:** `25 fps` atau `30 fps`
   * **Max Bitrate:** `2560 Kbps` hingga `3072 Kbps`
   * **Video Encoding:** **H.264** *(PENTING: Jangan aktifkan H.264+ atau H.265 Smart Codec karena merusak kestabilan slicing FFmpeg)*
   * **I Frame Interval (GOP):** `25` atau `30` (wajib 1 detik agar pemotongan klip 30 detik instan dan presisi).

---

## 3. Standar Konfigurasi IP Camera TP-Link VIGI

### A. Pengaturan Jaringan (Network)
* **IP Address:** Statik (e.g., `192.168.1.102`)
* **ONVIF Port:** `2020`
* **RTSP Port Default:** `554`

### B. Format URL RTSP TP-Link VIGI
* **Main Stream (Full HD 1080p):**
  ```
  rtsp://<username>:<password>@<IP_CAMERA>:554/stream1
  ```
* **Sub Stream (Resolusi Rendah):**
  ```
  rtsp://<username>:<password>@<IP_CAMERA>:554/stream2
  ```

### C. Pengaturan Video di Web Admin TP-Link VIGI / VIGI App
1. Masuk ke **Settings** -> **Camera** -> **Stream**:
   * **Video Coding:** **H.264** (Matikan opsi *Smart Coding / VIGI Smart+*)
   * **Resolution:** `1920x1080` (1080p)
   * **Frame Rate:** `25 fps` atau `30 fps`
   * **Bit Rate Control:** VBR
   * **Keyframe Interval (GOP):** `1 s` (1 detik)

---

## 4. Setup Local Streaming Gateway di Mini PC (MediaMTX)

File konfigurasi MediaMTX di `config/mediamtx.yml` telah dipersiapkan untuk menarik stream RTSP dari kedua brand kamera ini:

```yaml
paths:
  table1:
    source: rtsp://admin:password123@192.168.1.101:554/Streaming/Channels/101  # Hikvision
    sourceOnDemand: true
    sourceProtocol: tcp

  table2:
    source: rtsp://admin:password123@192.168.1.102:554/stream1                # TP-Link VIGI
    sourceOnDemand: true
    sourceProtocol: tcp
```

* **`sourceOnDemand: true`**: Menghemat penggunaan RAM dan CPU Mini PC. Kamera hanya ditarik stream-nya ketika ada pelanggan di meja yang aktif menonton atau merekam.
* **`sourceProtocol: tcp`**: Mencegah artefak gambar pecah (*green screen / glitch*) akibat paket UDP yang hilang di kabel jaringan.
