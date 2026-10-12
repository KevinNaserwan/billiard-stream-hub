# Panduan Spesifikasi Perangkat Keras & Pemasangan Lapangan (Hardware Setup)

## 1. Spesifikasi Kamera CCTV Overhead
Untuk mendapatkan sudut pandang meja billiard terbaik tanpa distorsi cembung berlebih:
* **Brand Rekomendasi:** Hikvision (seri DS-2CD2143G2-I) atau TP-Link VIGI (seri C440).
* **Focal Length Lensa:** 
  * Tinggi plafon **2.8m - 3.2m**: Gunakan lensa **2.8 mm** (Field of View lebar, mencakup meja 7/8/9 feet dan ruang gerak stik).
  * Tinggi plafon **> 3.5m**: Gunakan lensa **4.0 mm**.
* **Resolusi & Bitrate:** 
  * Resolusi: **1080p (1920x1080)** pada 25/30 FPS.
  * Bitrate: VBR (Variable Bitrate) 2048 - 3072 Kbps.
  * Encoding: **H.264 Main Profile** (PENTING: Jangan aktifkan H.264+ atau H.265 Smart Codec karena membuat stream slicing FFmpeg tidak stabil).
  * I-Frame / Keyframe Interval: **1 detik** (setara 25-30 frames).

---

## 2. Spesifikasi Local Edge Server (Mini PC)

Untuk melayani hingga 12 meja billiard aktif bersamaan:
* **Prosesor:** Intel Core i5 Gen 11/12 (contoh: Intel NUC, Beelink, atau ASUS Mini PC) atau AMD Ryzen 5 5600H.
* **RAM:** **16 GB DDR4/DDR5** (Sangat disarankan karena circular buffer video disimpan di RAM-Disk `/dev/shm`).
* **Penyimpanan:** 512 GB M.2 NVMe SSD (untuk OS, backend, dan arsip pesanan).
* **Network Interface:** 1x Gigabit Ethernet (1000 Mbps RJ45).

---

## 3. Wi-Fi Access Point Khusus Pelanggan
* Jangan gunakan router bawaan ISP (Indihome/Biznet/FirstMedia) untuk streaming video lokal.
* Pasang **Dedicated Wi-Fi 6 Access Point (AP)** di area meja billiard:
  * Rekomendasi: **TP-Link Omada EAP610** atau **Ubiquiti UniFi U6+** atau **Ruijie RG-RAP2260(E)**.
  * Buat SSID khusus: e.g. `Billiard-Arena-Guest`.
  * Frekuensi: Prioritaskan pita **5 GHz** (channel width 40/80 MHz) untuk interferensi minim dan throughput tinggi.
