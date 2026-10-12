import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { QrCode, Monitor, CheckCircle2, Wifi, Sparkles } from 'lucide-react';

export default function CustomerDisplayPage() {
  const router = useRouter();
  const [activeSession, setActiveSession] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'active'>('idle');

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimeout: any = null;

    const connectWS = () => {
      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        // Hubungkan ke port backend core 3055
        ws = new WebSocket(`${protocol}//${window.location.hostname}:3055?role=customer_display`);

        ws.onopen = () => {
          console.log('[Customer Display] Connected to Edge POS Gateway');
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'NEW_SESSION_QR') {
              setActiveSession(data.session);
              setStatus('active');
            } else if (data.type === 'SESSION_TERMINATED') {
              if (activeSession && activeSession.sessionId === data.sessionId) {
                setStatus('idle');
                setActiveSession(null);
              }
            }
          } catch (e) {}
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(connectWS, 2500);
        };
      } catch (err) {
        reconnectTimeout = setTimeout(connectWS, 3000);
      }
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#0b0f17] text-slate-100 flex flex-col justify-between p-6 sm:p-10 select-none relative overflow-hidden antialiased">
      <Head>
        <title>Customer Facing Display - BilliardStream Hub</title>
      </Head>

      {/* Header Venue Brand */}
      <header className="flex justify-between items-center z-10 border-b border-slate-800 pb-5">
        <div className="flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            B
          </div>
          <div>
            <h1 className="text-base font-semibold text-white tracking-tight">Billiard Arena &amp; Lounge</h1>
            <p className="text-xs text-slate-400 font-normal">Customer Self-Scan &amp; Live Overhead CCTV</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3.5 py-1.5 rounded-lg">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-mono text-emerald-400">EDGE GATEWAY CONNECTED</span>
        </div>
      </header>


      {/* Main Content: Idle State vs Active QR Payment/Scan State */}
      <main className="my-auto max-w-4xl mx-auto w-full z-10">
        {status === 'active' && activeSession ? (
          <div className="bg-[#111622] border border-slate-800 rounded-2xl p-8 sm:p-10 shadow-lg flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Session & Payment Info */}
            <div className="space-y-5 text-center md:text-left flex-1">
              <div>
                <span className="inline-flex items-center space-x-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Sesi Aktif &amp; Terverifikasi</span>
                </span>
                <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2.5">
                  {activeSession.tableName}
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Atas Nama: <strong className="text-slate-200">{activeSession.customerName || 'Pelanggan'}</strong>
                </p>
              </div>

              <div className="bg-[#090d14] border border-slate-800 p-4 rounded-xl space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Durasi Bermain</span>
                  <span className="text-white font-semibold">{activeSession.durationMinutes} Menit</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400">Estimasi Tarif</span>
                  <span className="text-emerald-400 font-semibold font-mono text-sm">
                    Rp {((activeSession.durationMinutes / 60) * 50000).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-800/80">
                  <span className="text-slate-400">Status Pembayaran</span>
                  <span className="text-emerald-400 font-medium text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Lunas di Kasir
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                Pindai QR code di samping dengan kamera HP untuk langsung menyambungkan live streaming CCTV meja dan mengaktifkan tombol rekam trickshot 30 detik.
              </p>
            </div>

            {/* Giant QR Code for Customer */}
            <div className="flex flex-col items-center shrink-0">
              <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-200">
                <img
                  src={activeSession.qrDataUrl}
                  alt="Akses Live CCTV Meja"
                  className="w-56 h-56 sm:w-64 sm:h-64 object-contain"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-2.5 font-medium">
                Pindai menggunakan Kamera HP (iOS / Android)
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4 py-16">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shadow-sm">
              <Monitor className="w-8 h-8 text-emerald-400" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Selamat Datang di Arena Billiard</h2>
              <p className="text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
                Silakan lakukan reservasi dan pembayaran meja di kasir. QR code live overhead camera akan otomatis muncul di layar ini.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 pt-5 border-t border-slate-800 z-10 gap-2">
        <div>BilliardStream Hub On-Premise · Ultra-Low Latency WebRTC (&lt; 300ms)</div>
        <div>100% Local Wi-Fi Network · Hemat Kuota Internet</div>
      </footer>
    </div>
  );
}

