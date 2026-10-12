import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-6 sm:p-12 select-none relative overflow-hidden antialiased">
      <Head>
        <title>Customer Facing Display - BilliardStream Hub</title>
      </Head>

      {/* Ambient background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Venue Brand */}
      <header className="flex justify-between items-center z-10 border-b border-slate-800/80 pb-6">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center text-slate-950 font-black text-2xl shadow-xl shadow-emerald-500/20">
            🎱
          </div>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight">BILLIARD ARENA & LOUNGE</h1>
            <p className="text-xs text-slate-400 font-medium tracking-wide">Customer Self-Scan & Payment Counter</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-mono text-emerald-400">EDGE TERMINAL READY</span>
        </div>
      </header>

      {/* Main Content: Idle State vs Active QR Payment/Scan State */}
      <main className="my-auto max-w-4xl mx-auto w-full z-10">
        {status === 'active' && activeSession ? (
          <div className="bg-slate-900/90 border border-emerald-500/30 rounded-3xl p-8 sm:p-12 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 backdrop-blur-xl animate-fade-in">
            {/* Session & Payment Info */}
            <div className="space-y-6 text-center md:text-left flex-1">
              <div>
                <span className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full">
                  Pembayaran Diterima / Sesi Siap
                </span>
                <h2 className="text-3xl sm:text-4xl font-black text-white mt-3">
                  {activeSession.tableName}
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Atas Nama: <strong className="text-white">{activeSession.customerName || 'Pelanggan'}</strong>
                </p>
              </div>

              <div className="bg-slate-950/80 border border-slate-800 p-5 rounded-2xl space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Durasi Bermain:</span>
                  <span className="text-white font-black text-base">{activeSession.durationMinutes} Menit</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-slate-400">Total Tarif:</span>
                  <span className="text-amber-400 font-black text-lg">
                    Rp {((activeSession.durationMinutes / 60) * 50000).toLocaleString('id-ID')}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm pt-2 border-t border-slate-800">
                  <span className="text-slate-400">Status Pembayaran:</span>
                  <span className="text-emerald-400 font-bold uppercase text-xs bg-emerald-500/10 px-2.5 py-1 rounded-lg">
                    Lunas (Paid)
                  </span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                👉 <strong>Scan QR di samping menggunakan kamera HP Anda</strong> untuk langsung mengaktifkan siaran live streaming CCTV overhead meja dan tombol simpan rekaman 30 detik.
              </p>
            </div>

            {/* Giant QR Code for Customer */}
            <div className="flex flex-col items-center shrink-0">
              <div className="bg-white p-5 rounded-3xl shadow-2xl border-4 border-emerald-500/30">
                <img
                  src={activeSession.qrDataUrl}
                  alt="Akses Live CCTV Meja"
                  className="w-64 h-64 sm:w-72 sm:h-72 object-contain"
                />
              </div>
              <span className="text-[11px] text-slate-400 mt-3 font-medium">
                Pindai dengan Kamera iOS / Android
              </span>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-6 py-12">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-5xl shadow-xl">
              🎱
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white">Selamat Datang di Billiard Arena</h2>
              <p className="text-sm text-slate-400 max-w-md mx-auto">
                Silakan lakukan reservasi dan pembayaran meja di kasir. QR code akses live streaming CCTV overhead meja akan muncul otomatis di layar ini.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer Info */}
      <footer className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-500 pt-6 border-t border-slate-800/80 z-10 gap-2">
        <div>BilliardStream Hub On-Premise · Ultra-Low Latency WebRTC (&lt; 300ms)</div>
        <div>Zero Internet Quota · Local Wi-Fi Network</div>
      </footer>
    </div>
  );
}
