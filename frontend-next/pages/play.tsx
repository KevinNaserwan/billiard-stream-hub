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
    <div className="min-h-screen bg-black text-slate-100 flex flex-col justify-between p-4">
      <Head>
        <title>Live Table Stream - BilliardStream Hub</title>
      </Head>

      {/* Top HUD */}
      <header className="flex justify-between items-center bg-slate-950 p-4 rounded-2xl border border-slate-800">
        <div>
          <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">Overhead Live Feed</span>
          <h1 className="text-sm font-black text-white">{session?.tableName || 'Meja Billiard'}</h1>
        </div>
        <div className="bg-slate-900 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-right">
          <span className="text-[9px] text-slate-400 block">Sisa Waktu</span>
          <span className="text-base font-black text-emerald-400 font-mono">{formatTimer(remaining)}</span>
        </div>
      </header>

      {/* Video Player Viewport */}
      <main className="my-auto max-w-xl mx-auto w-full space-y-4">
        <div className="relative aspect-video bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
          <div className="absolute top-3 left-3 bg-black/60 px-2.5 py-1 rounded-full text-[10px] font-bold text-white flex items-center space-x-1.5 border border-white/10 z-20">
            <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
            <span>LIVE CAM</span>
          </div>

          <div className="text-center p-6 text-slate-500 text-xs">
            [ WebRTC WHEP Stream Active: {session?.whepUrl || 'Connecting...'} ]
          </div>

          {isExpired && (
            <div className="absolute inset-0 bg-slate-950/95 backdrop-blur z-30 flex flex-col items-center justify-center p-6 text-center space-y-2">
              <div className="w-12 h-12 rounded-full bg-rose-500/20 text-rose-500 flex items-center justify-center text-xl">
                ⏳
              </div>
              <h2 className="text-lg font-bold text-white">Waktu Bermain Habis</h2>
              <p className="text-xs text-slate-400">Siaran video telah diputus secara otomatis.</p>
            </div>
          )}
        </div>

        {/* Action Button: Clip 30s */}
        <button
          onClick={handleClip30s}
          disabled={clipLoading || isExpired}
          className="w-full bg-gradient-to-r from-amber-400 to-amber-600 hover:from-amber-300 hover:to-amber-500 disabled:opacity-50 text-slate-950 font-black py-4 rounded-2xl text-sm shadow-xl shadow-amber-500/20"
        >
          {clipLoading ? 'Memotong Rekaman Pukulan... ⏳' : 'SIMPAN 30 DETIK TERAKHIR'}
        </button>

        {clipUrl && (
          <a
            href={clipUrl}
            download
            className="block text-center bg-emerald-500 text-slate-950 font-bold py-3 rounded-2xl text-xs"
          >
            Download Video ke Galeri HP
          </a>
        )}
      </main>

      <footer className="text-center text-[10px] text-slate-500 py-2">
        BilliardStream Hub On-Premise · Ultra-Low Latency WebRTC
      </footer>
    </div>
  );
}
