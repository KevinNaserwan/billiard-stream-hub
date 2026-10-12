import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

export default function PlayerPage() {
  const router = useRouter();
  const { token } = router.query;
  const [session, setSession] = useState<any>(null);
  const [remaining, setRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState<boolean>(false);
  const [clipLoading, setClipLoading] = useState<boolean>(false);
  const [clipUrl, setClipUrl] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/player/session-info?token=${encodeURIComponent(token as string)}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === 'success') {
          setSession(data);
          setRemaining(data.remainingSeconds);
        } else {
          setIsExpired(true);
        }
      })
      .catch(() => setIsExpired(true));
  }, [token]);

  useEffect(() => {
    if (remaining <= 0) return;
    const interval = setInterval(() => {
      setRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsExpired(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [remaining]);

  const handleClip30s = async () => {
    if (!token) return;
    setClipLoading(true);
    setClipUrl(null);
    try {
      const res = await fetch('/api/player/clip-30s', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setClipUrl(data.downloadUrl);
      }
    } catch (e) {
      alert('Gagal mengambil rekaman klip');
    } finally {
      setClipLoading(false);
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between p-2 sm:p-4 md:p-6 lg:p-8 select-none">
      <Head>
        <title>Live Table Stream - BilliardStream Hub</title>
      </Head>

      {/* Top Floating HUD: Responsive Header */}
      <header className="max-w-7xl mx-auto w-full flex justify-between items-center bg-slate-950/90 backdrop-blur p-3 sm:p-4 rounded-2xl border border-slate-800 shadow-xl z-20">
        <div>
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Overhead Live Feed</span>
          <h1 className="text-sm sm:text-base font-black text-white">{session?.tableName || 'Meja Billiard'}</h1>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="bg-slate-900 border border-emerald-500/30 px-3 sm:px-4 py-1.5 rounded-xl text-right">
            <span className="text-[9px] text-slate-400 block font-medium">Sisa Waktu</span>
            <span className="text-sm sm:text-lg font-black text-emerald-400 font-mono tracking-tight">{formatTimer(remaining)}</span>
          </div>
        </div>
      </header>

      {/* Main Responsive Video Area: Full on Mobile, Large Cinema View on Desktop */}
      <main className="my-auto w-full max-w-7xl mx-auto flex flex-col items-center justify-center p-0 sm:p-2 md:p-4">
        
        <div className="w-full relative rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center aspect-video max-h-[82vh]">
          
          {/* Live Badge */}
          <div className="absolute top-3 left-3 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-bold text-white flex items-center space-x-1.5 border border-white/10 z-20">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>LIVE CAM (1080p)</span>
          </div>

          {/* WebRTC Video Element / Viewport */}
          <video
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Stream Information Overlay */}
          <div className="absolute bottom-3 right-3 bg-black/60 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-mono text-emerald-400 border border-white/10">
            LATENCY: &lt; 300ms (LAN)
          </div>

          {/* Expiry Hard Disconnect Overlay */}
          {isExpired && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-md z-30 flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center text-2xl">
                ⏳
              </div>
              <h2 className="text-xl font-black text-white">Waktu Bermain Habis</h2>
              <p className="text-xs text-slate-400 max-w-xs">
                Akses live streaming telah dihentikan secara otomatis. Silakan hubungi kasir jika ingin menambah durasi.
              </p>
            </div>
          )}
        </div>

        {/* Action Controls: Fixed width on Desktop, Full Width on Mobile */}
        <div className="w-full max-w-xl mt-4 sm:mt-6 space-y-3">
          <button
            onClick={handleClip30s}
            disabled={clipLoading || isExpired}
            className="w-full bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black py-3.5 sm:py-4 rounded-2xl text-sm sm:text-base shadow-xl shadow-amber-500/20 active:scale-[0.99] transition-all flex items-center justify-center space-x-2"
          >
            <span>{clipLoading ? 'Memotong Rekaman Pukulan... ⏳' : '✂️ SIMPAN 30 DETIK TERAKHIR'}</span>
          </button>

          {clipUrl && (
            <a
              href={clipUrl}
              download
              className="block text-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all"
            >
              📥 Download Video ke Galeri HP
            </a>
          )}
        </div>

      </main>

      <footer className="text-center text-[10px] sm:text-xs text-slate-500 py-2">
        BilliardStream Hub On-Premise · Ultra-Low Latency WebRTC
      </footer>
    </div>
  );
}
