# Deep-Dive System Architecture: BilliardStream Hub

## 1. Zero-Bandwidth On-Premise Philosophy
Untuk arena billiard komersial (4 hingga 20 meja), streaming langsung resolusi 1080p@30fps ke banyak smartphone pelanggan akan mengonsumsi **2.5 Mbps hingga 4 Mbps per stream**. Jika disalurkan lewat internet/cloud publik:
* 10 meja aktif x 3 orang per meja = 30 concurrent viewer.
* Total bandwidth internet: **~90 Mbps terus-menerus**.
* Hal ini akan menyebabkan biaya kuota bengkak, latency buffering > 5 detik, dan internet kasir lag.

**Solusi Arsitektur BilliardStream Hub:**
Semua alur data tertutup rapat di dalam **Local Area Network (LAN)**:
```
[IP Camera CCTV] --(RTSP H.264)--> [Mini PC Edge Server] --(WebRTC WHEP)--> [HP Pelanggan via Wi-Fi 5GHz]
```
Kebutuhan kuota internet keluar = **0 KB/s**.

---

## 2. Kenapa Memilih WebRTC WHEP Dibandingkan HLS / RTMP?

| Metrik | HLS Tradisional | LL-HLS | WebRTC (WHEP) |
| :--- | :--- | :--- | :--- |
| **Latency Rata-Rata** | 6 - 15 Detik | 1.5 - 3 Detik | **150 - 400 Millidetik** |
| **Pengalaman Pengguna** | Pukulan bola sudah selesai, video baru muncul (tidak berguna) | Kurang sinkron | **Real-time instant** (pemain melihat layar persis bersamaan dengan pukulan fisik) |
| **Overhead Protokol** | HTTP Chunk polling | HTTP Chunked transfer | UDP / DTLS-SRTP P2P streaming |
| **Dukungan Mobile Browser** | Native iOS, perlu hls.js di Android | Sebagian browser modern | **100% Native di Safari iOS & Chrome Android** |

---

## 3. Strategi Buffer RAM-Disk untuk "Clip Last 30s"

Salah satu kendala server lokal jika 5 meja sekaligus memencet tombol *"Clip Last 30s"* adalah **CPU Spike 100%** jika video harus di-encode ulang (`libx264`).

### Solusi: Direct Stream Slicing (`-c copy`)
1. IP Camera dikonfigurasi langsung mengirim stream berformat **H.264 video + AAC audio** dengan GOP (*Group of Pictures*) / Keyframe Interval = **1 detik**.
2. Daemon server menuliskan segment file berdurasi 3 detik ke Linux RAM-Disk:
   ```bash
   # Disimpan di /dev/shm (Shared Memory RAM) bukan di SSD untuk mencegah umur SSD cepat aus
   ffmpeg -i rtsp://... -c copy -f segment -segment_time 3 -segment_wrap 20 /dev/shm/table_1/%03d.ts
   ```
3. Saat tombol diklik:
   - Server membaca 10 segmen terakhir (10 x 3 detik = 30 detik).
   - Menjalankan concat demuxer:
     ```bash
     ffmpeg -f concat -safe 0 -i list.txt -c copy -movflags +faststart clip.mp4
     ```
   - **Waktu proses:** Hanya **300ms - 800ms** karena tidak ada proses encoding CPU sama sekali. Video langsung siap di-download.
