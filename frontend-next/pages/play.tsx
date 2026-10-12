import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { 
  Video, 
  Clock, 
  Bell, 
  Scissors, 
  Download, 
  Trophy, 
  UtensilsCrossed, 
  Check, 
  Plus, 
  Minus, 
  X, 
  AlertCircle
} from 'lucide-react';

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

      {/* Top Floating HUD: Responsive Clean Header */}
      <header className="max-w-7xl mx-auto w-full flex justify-between items-center bg-[#111622]/90 backdrop-blur-md px-4 py-3 rounded-xl border border-slate-800 shadow-sm z-20">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
            {session?.tableName ? session.tableName.replace(/[^0-9]/g, '') || '01' : '01'}
          </div>
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Overhead Camera</span>
            </div>
            <h1 className="text-xs sm:text-sm font-semibold text-white tracking-tight">{session?.tableName || 'Meja Billiard'}</h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Quick Call Waiter Button */}
          <button
            onClick={handleCallWaiter}
            disabled={waiterCalled}
            className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all border flex items-center space-x-1.5 ${
              waiterCalled
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                : 'bg-slate-900 text-slate-300 border-slate-800 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>{waiterCalled ? 'Kru Dipanggil' : 'Panggil Waiter'}</span>
          </button>

          {/* Sisa Waktu Display */}
          <div className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg text-right flex items-center space-x-2">
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
            <div>
              <span className="text-[9px] text-slate-500 block leading-tight font-medium">Sisa Waktu</span>
              <span className="text-xs sm:text-sm font-semibold text-emerald-400 font-mono tracking-tight">{formatTimer(remaining)}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Responsive Video Area: Full on Mobile, Large Cinema View on Desktop */}
      <main className="my-auto w-full max-w-7xl mx-auto flex flex-col items-center justify-center p-0 sm:p-2 md:p-4 space-y-3.5">
        
        {/* Live Video Viewport */}
        <div className="w-full relative rounded-xl sm:rounded-2xl overflow-hidden bg-black border border-slate-800/80 shadow-2xl flex items-center justify-center aspect-video max-h-[75vh]">
          
          {/* Live Badge */}
          <div className="absolute top-3 left-3 bg-slate-950/80 backdrop-blur px-2.5 py-1 rounded-md text-[10px] font-medium text-white flex items-center space-x-1.5 border border-white/10 z-20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
            <span>LIVE 1080p</span>
          </div>

          {/* WebRTC Video Element / Viewport */}
          <video
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />

          {/* Stream Information Overlay */}
          <div className="absolute bottom-3 right-3 bg-slate-950/80 backdrop-blur px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 border border-white/10">
            LAN Latency &lt; 300ms
          </div>

          {/* Expiry Hard Disconnect Overlay */}
          {isExpired && (
            <div className="absolute inset-0 bg-[#090d14]/95 backdrop-blur-sm z-30 flex flex-col items-center justify-center p-6 text-center space-y-2.5">
              <div className="w-10 h-10 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center border border-rose-500/20">
                <AlertCircle className="w-5 h-5" />
              </div>
              <h2 className="text-sm font-semibold text-white">Sesi Waktu Telah Berakhir</h2>
              <p className="text-xs text-slate-400 max-w-xs">
                Akses video streaming overhead telah ditutup otomatis oleh edge server. Silakan hubungi kasir untuk perpanjangan.
              </p>
            </div>
          )}
        </div>

        {/* Action Controls Toolbar (Simpan Klip, Digital Scoreboard, Order F&B) */}
        <div className="w-full max-w-xl space-y-2.5">
          
          {/* Primary Action: Simpan 30 Detik Terakhir */}
          <button
            onClick={handleClip30s}
            disabled={clipLoading || isExpired}
            className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium py-3 rounded-xl text-xs sm:text-sm shadow-sm transition-colors flex items-center justify-center space-x-2"
          >
            <Scissors className="w-4 h-4" />
            <span>{clipLoading ? 'Memproses klip video...' : 'Simpan 30 Detik Terakhir (Trickshot)'}</span>
          </button>

          {clipUrl && (
            <a
              href={clipUrl}
              download
              className="flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/30 font-medium py-2.5 rounded-xl text-xs transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Unduh Video ke Galeri</span>
            </a>
          )}

          {/* Secondary Features Toolbar: Scoreboard & F&B Menu */}
          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => setShowScoreboard(!showScoreboard)}
              className="bg-[#111622] hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium py-2 rounded-lg text-xs flex items-center justify-center space-x-1.5 transition-colors"
            >
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              <span>{showScoreboard ? 'Tutup Papan Skor' : 'Papan Skor Game'}</span>
            </button>

            <button
              onClick={() => setShowFnbModal(true)}
              className="bg-[#111622] hover:bg-slate-800 border border-slate-800 text-slate-300 font-medium py-2 rounded-lg text-xs flex items-center justify-center space-x-1.5 transition-colors"
            >
              <UtensilsCrossed className="w-3.5 h-3.5 text-emerald-400" />
              <span>Pesan Snack & Minum</span>
            </button>
          </div>


          {/* Interactive Digital Scoreboard Component */}
          {showScoreboard && (
            <div className="bg-[#111622] border border-slate-800 p-4 rounded-xl space-y-3 shadow-md">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                  Digital Frame Scoreboard
                </span>
                <button
                  onClick={() => { setPlayer1Score(0); setPlayer2Score(0); }}
                  className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors"
                >
                  Reset Skor
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                {/* Player 1 */}
                <div className="bg-[#090d14] p-3 rounded-lg border border-slate-800 space-y-2">
                  <input
                    type="text"
                    value={player1Name}
                    onChange={(e) => setPlayer1Name(e.target.value)}
                    className="w-full text-center bg-transparent text-xs font-medium text-slate-200 border-b border-slate-800 pb-1 focus:outline-none focus:border-emerald-500"
                  />
                  <div className="text-3xl font-bold text-emerald-400 font-mono">{player1Score}</div>
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={() => setPlayer1Score(Math.max(0, player1Score - 1))}
                      className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setPlayer1Score(player1Score + 1)}
                      className="w-7 h-7 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Player 2 */}
                <div className="bg-[#090d14] p-3 rounded-lg border border-slate-800 space-y-2">
                  <input
                    type="text"
                    value={player2Name}
                    onChange={(e) => setPlayer2Name(e.target.value)}
                    className="w-full text-center bg-transparent text-xs font-medium text-slate-200 border-b border-slate-800 pb-1 focus:outline-none focus:border-amber-500"
                  />
                  <div className="text-3xl font-bold text-amber-400 font-mono">{player2Score}</div>
                  <div className="flex justify-center space-x-2">
                    <button
                      onClick={() => setPlayer2Score(Math.max(0, player2Score - 1))}
                      className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs flex items-center justify-center transition-colors"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => setPlayer2Score(player2Score + 1)}
                      className="w-7 h-7 rounded bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs flex items-center justify-center transition-colors"
                    >
                      <Plus className="w-3 h-3" />
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-[#111622] border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 max-w-md w-full max-h-[85vh] flex flex-col justify-between shadow-2xl">
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-3 mb-3">
                <div className="flex items-center space-x-2">
                  <UtensilsCrossed className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-semibold text-white uppercase tracking-wider">Menu F&amp;B Meja</h3>
                </div>
                <button onClick={() => setShowFnbModal(false)} className="text-slate-400 hover:text-white p-1">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Menu List */}
              <div className="space-y-2 overflow-y-auto max-h-[48vh] pr-1">
                {menuItems.map(item => (
                  <div key={item.id} className="flex justify-between items-center p-2.5 bg-[#090d14] rounded-lg border border-slate-800 text-xs">
                    <div>
                      <div className="font-medium text-slate-200">{item.name}</div>
                      <div className="text-slate-400 text-[11px]">Rp {item.price.toLocaleString('id-ID')}</div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => updateCart(item.id, -1)}
                        className="w-6 h-6 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-5 text-center font-medium text-white font-mono">{cart[item.id] || 0}</span>
                      <button
                        onClick={() => updateCart(item.id, 1)}
                        className="w-6 h-6 rounded bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cart Footer */}
            <div className="border-t border-slate-800 pt-3 mt-3 space-y-2">
              <div className="flex justify-between text-xs font-medium text-slate-300">
                <span>Total Estimasi:</span>
                <span className="text-white font-semibold">Rp {totalCartPrice.toLocaleString('id-ID')}</span>
              </div>
              <button
                onClick={handleSendFnbOrder}
                disabled={totalCartPrice === 0 || orderSent}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-medium py-2 rounded-lg text-xs transition-colors flex items-center justify-center space-x-1.5"
              >
                {orderSent ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Pesanan Berhasil Dikirim</span>
                  </>
                ) : (
                  <span>Kirim Pesanan ke Kasir</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="text-center text-[10px] text-slate-600 py-1">
        BilliardStream Hub On-Premise · Ultra-Low Latency WebRTC
      </footer>
    </div>
  );
}

