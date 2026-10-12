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

  // Nilai Plus 1: Digital Scoreboard State (Pencatat Skor Game)
  const [player1Score, setPlayer1Score] = useState<number>(0);
  const [player2Score, setPlayer2Score] = useState<number>(0);
  const [player1Name, setPlayer1Name] = useState<string>('Pemain 1');
  const [player2Name, setPlayer2Name] = useState<string>('Pemain 2');
  const [showScoreboard, setShowScoreboard] = useState<boolean>(false);

  // Nilai Plus 2: In-Table F&B Order Modal & Cart
  const [showFnbModal, setShowFnbModal] = useState<boolean>(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);
  const [cart, setCart] = useState<{ [id: number]: number }>({});
  const [orderSent, setOrderSent] = useState<boolean>(false);

  // Nilai Plus 3: Call Waiter / Panggil Pelayan
  const [waiterCalled, setWaiterCalled] = useState<boolean>(false);

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

    // Ambil menu F&B
    fetch('/api/player/menu')
      .then(res => res.json())
      .then(data => setMenuItems(data.menu || []))
      .catch(() => {});
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

  const handleCallWaiter = async () => {
    setWaiterCalled(true);
    try {
      await fetch('/api/player/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          items: [{ name: '🔔 PANGGIL PELAYAN / BANTUAN MEJA', price: 0, qty: 1 }],
          notes: 'Pelanggan memanggil kru kafe ke meja'
        })
      });
      setTimeout(() => setWaiterCalled(false), 5000);
    } catch (e) {}
  };

  const handleSendFnbOrder = async () => {
    const selected = Object.entries(cart)
      .filter(([_, qty]) => qty > 0)
      .map(([id, qty]) => {
        const item = menuItems.find(m => m.id === Number(id));
        return { name: item.name, price: item.price, qty };
      });

    if (selected.length === 0) return;

    try {
      const res = await fetch('/api/player/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, items: selected, notes: 'Pesanan mandiri dari Web Player Meja' })
      });
      if (res.ok) {
        setOrderSent(true);
        setCart({});
        setTimeout(() => {
          setOrderSent(false);
          setShowFnbModal(false);
        }, 2000);
      }
    } catch (e) {}
  };

  const updateCart = (id: number, delta: number) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      return { ...prev, [id]: next };
    });
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(mins).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const totalCartPrice = Object.entries(cart).reduce((acc, [id, qty]) => {
    const item = menuItems.find(m => m.id === Number(id));
    return acc + (item ? item.price * qty : 0);
  }, 0);

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
        
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Quick Call Waiter Button */}
          <button
            onClick={handleCallWaiter}
            disabled={waiterCalled}
            className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all border ${
              waiterCalled
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white'
            }`}
          >
            {waiterCalled ? '✓ Dipanggil' : '🔔 Panggil Waiter'}
          </button>

          <div className="bg-slate-900 border border-emerald-500/30 px-3 sm:px-4 py-1.5 rounded-xl text-right">
            <span className="text-[9px] text-slate-400 block font-medium">Sisa Waktu</span>
            <span className="text-sm sm:text-lg font-black text-emerald-400 font-mono tracking-tight">{formatTimer(remaining)}</span>
          </div>
        </div>
      </header>

      {/* Main Responsive Video Area: Full on Mobile, Large Cinema View on Desktop */}
      <main className="my-auto w-full max-w-7xl mx-auto flex flex-col items-center justify-center p-0 sm:p-2 md:p-4 space-y-4">
        
        {/* Live Video Viewport */}
        <div className="w-full relative rounded-2xl sm:rounded-3xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex items-center justify-center aspect-video max-h-[75vh]">
          
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

        {/* Action Controls Toolbar (Simpan Klip, Digital Scoreboard, Order F&B) */}
        <div className="w-full max-w-2xl space-y-3">
          
          {/* Primary Action: Simpan 30 Detik Terakhir */}
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
              className="block text-center bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-2xl text-xs sm:text-sm shadow-lg shadow-emerald-500/20 transition-all animate-bounce"
            >
              📥 Download Video ke Galeri HP
            </a>
          )}

          {/* Secondary Features Toolbar: Scoreboard & F&B Menu */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => setShowScoreboard(!showScoreboard)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors"
            >
              <span>🎯 {showScoreboard ? 'Tutup Papan Skor' : 'Papan Skor Game'}</span>
            </button>

            <button
              onClick={() => setShowFnbModal(true)}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-amber-400 font-bold py-2.5 rounded-xl text-xs flex items-center justify-center space-x-2 transition-colors"
            >
              <span>🍔 Pesan Snack & Minum</span>
            </button>
          </div>

          {/* Interactive Digital Scoreboard Component */}
          {showScoreboard && (
            <div className="bg-slate-900/95 border border-slate-800 p-4 rounded-2xl space-y-3 backdrop-blur animate-fade-in">
              <div className="text-center text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Digital Frame Scorekeeper
              </div>
              <div className="grid grid-cols-2 gap-4 text-center">
                {/* Player 1 */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <input
                    type="text"
                    value={player1Name}
                    onChange={(e) => setPlayer1Name(e.target.value)}
                    className="w-full text-center bg-transparent text-xs font-bold text-white border-b border-slate-800 pb-1 focus:outline-none"
                  />
                  <div className="text-3xl font-black text-emerald-400 font-mono">{player1Score}</div>
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={() => setPlayer1Score(Math.max(0, player1Score - 1))}
                      className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs"
                    >
                      -
                    </button>
                    <button
                      onClick={() => setPlayer1Score(player1Score + 1)}
                      className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Player 2 */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <input
                    type="text"
                    value={player2Name}
                    onChange={(e) => setPlayer2Name(e.target.value)}
                    className="w-full text-center bg-transparent text-xs font-bold text-white border-b border-slate-800 pb-1 focus:outline-none"
                  />
                  <div className="text-3xl font-black text-amber-400 font-mono">{player2Score}</div>
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={() => setPlayer2Score(Math.max(0, player2Score - 1))}
                      className="w-7 h-7 rounded-lg bg-slate-800 text-slate-300 font-bold text-xs"
                    >
                      -
                    </button>
                    <button
                      onClick={() => setPlayer2Score(player2Score + 1)}
                      className="w-7 h-7 rounded-lg bg-amber-500 text-slate-950 font-bold text-xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </main>

      {/* Modal Pemesanan Menu F&B */}
      {showFnbModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-3xl p-6 max-w-md w-full max-h-[85vh] flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-4">
                <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                  <span>🍔 Menu Makanan & Minuman Meja</span>
                </h3>
                <button onClick={() => setShowFnbModal(false)} className="text-slate-400 hover:text-white text-lg">&times;</button>
              </div>

              {/* Menu List */}
              <div className="space-y-3 overflow-y-auto max-h-[48vh] pr-1">
                {menuItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                    <div>
                      <div className="font-bold text-white">{item.name}</div>
                      <div className="text-amber-400 font-medium">Rp {item.price.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateCart(item.id, -1)}
                        className="w-6 h-6 rounded bg-slate-800 text-slate-300 font-bold flex items-center justify-center"
                      >
                        -
                      </button>
                      <span className="w-5 text-center font-bold text-white font-mono">{cart[item.id] || 0}</span>
                      <button
                        onClick={() => updateCart(item.id, 1)}
                        className="w-6 h-6 rounded bg-emerald-500 text-slate-950 font-bold flex items-center justify-center"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart Footer */}
            <div className="border-t border-slate-800 pt-3 mt-3 space-y-2">
              <div className="flex justify-between text-xs font-bold text-white">
                <span>Total Pesanan:</span>
                <span className="text-amber-400">Rp {totalCartPrice.toLocaleString('id-ID')}</span>
              </div>
              <button
                onClick={handleSendFnbOrder}
                disabled={totalCartPrice === 0 || orderSent}
                className="w-full bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 text-slate-950 font-bold py-3 rounded-xl text-xs transition-all"
              >
                {orderSent ? '✓ Pesanan Berhasil Dikirim!' : 'Kirim Pesanan ke Kasir'}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-[10px] sm:text-xs text-slate-500 py-2">
        BilliardStream Hub On-Premise · Ultra-Low Latency WebRTC
      </footer>
    </div>
  );
}
