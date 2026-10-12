import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

interface TableItem {
  id: number;
  name: string;
  streamPath: string;
  rtspUrl: string;
  status: 'active' | 'idle';
  activeSession: any;
}

interface OrderItem {
  id: string;
  tableId: number;
  tableName: string;
  items: { name: string; price: number; qty: number }[];
  notes?: string;
  status: string;
}

interface ToastNotification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'success' | 'error';
}

export default function DashboardPage() {
  const router = useRouter();
  const [tables, setTables] = useState<TableItem[]>([]);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [user, setUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'cameras'>('overview');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  
  // Custom Toast notifications (No default browser alert!)
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState(1);
  const [duration, setDuration] = useState(60);
  const [customerName, setCustomerName] = useState('');
  const [qrModalData, setQrModalData] = useState<{ tableName: string; qrUrl: string; duration: number } | null>(null);

  // Live View Stream Modal (Interactive Live Player in Dashboard)
  const [previewTable, setPreviewTable] = useState<TableItem | null>(null);

  const addToast = (title: string, message: string, type: 'order' | 'success' | 'error' = 'success') => {
    const id = `toast_${Date.now()}`;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  useEffect(() => {
    // Theme initialization
    const savedTheme = (localStorage.getItem('billiard_theme') as 'dark' | 'light') || 'dark';
    setTheme(savedTheme);
    applyThemeClass(savedTheme);

    const token = localStorage.getItem('billiard_auth_token');
    const savedUser = localStorage.getItem('billiard_auth_user');
    if (!token) {
      router.push('/login');
      return;
    }
    if (savedUser) setUser(JSON.parse(savedUser));
    fetchTables(token);
    fetchOrders(token);
    setupRealtimeOrders();
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('billiard_theme', next);
    applyThemeClass(next);
  };

  const applyThemeClass = (t: 'dark' | 'light') => {
    if (typeof document !== 'undefined') {
      if (t === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const setupRealtimeOrders = () => {
    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.hostname}:3055?role=cashier`);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NEW_ORDER') {
            addToast(
              `🔔 Pesanan Masuk: ${data.order.tableName}`,
              data.order.items.map((i: any) => `${i.name} (x${i.qty})`).join(', '),
              'order'
            );
            fetchOrders();
          }
        } catch (e) {}
      };
    } catch (e) {}
  };

  const authFetch = (url: string, options: any = {}) => {
    const token = localStorage.getItem('billiard_auth_token');
    const headers = options.headers || {};
    headers['Authorization'] = `Bearer ${token}`;
    return fetch(url, { ...options, headers });
  };

  const fetchTables = async (token?: string) => {
    try {
      const res = await authFetch('/api/tables');
      if (res.status === 401 || res.status === 403) {
        handleLogout();
        return;
      }
      const data = await res.json();
      setTables(data.data || []);
    } catch (e) {}
  };

  const fetchOrders = async (token?: string) => {
    try {
      const res = await authFetch('/api/cashier/orders');
      const data = await res.json();
      setOrders(data.orders || []);
    } catch (e) {}
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await authFetch('/api/sessions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableId: selectedTableId, durationMinutes: duration, customerName })
      });
      const data = await res.json();
      if (data.status === 'success') {
        setIsCreateOpen(false);
        setQrModalData({ tableName: data.session.tableName, qrUrl: data.qrDataUrl, duration });
        addToast('Sesi Berhasil Dibuat', `Akses meja ${data.session.tableName} aktif selama ${duration} menit.`);
        fetchTables();
      } else {
        addToast('Gagal Membuka Sesi', data.error || 'Server error', 'error');
      }
    } catch (e: any) {
      addToast('Kesalahan Jaringan', e.message, 'error');
    }
  };

  const handleExtend = async (sessionId: string) => {
    try {
      const res = await authFetch(`/api/sessions/${sessionId}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ additionalMinutes: 30 })
      });
      if (res.ok) {
        addToast('Durasi Ditambahkan', 'Waktu bermain ditambah 30 menit.');
        fetchTables();
      }
    } catch (e) {}
  };

  const handleTerminate = async (sessionId: string) => {
    try {
      const res = await authFetch(`/api/sessions/${sessionId}/terminate`, { method: 'POST' });
      if (res.ok) {
        addToast('Sesi Dihentikan', 'Live streaming meja telah dinonaktifkan.');
        fetchTables();
      }
    } catch (e) {}
  };

  const handleMarkOrderComplete = async (orderId: string) => {
    try {
      await authFetch(`/api/cashier/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' })
      });
      addToast('Pesanan Selesai', 'Status pesanan diperbarui.');
      fetchOrders();
    } catch (e) {}
  };

  // Bersihkan token saat logout
  const handleLogout = () => {
    localStorage.removeItem('billiard_auth_token');
    localStorage.removeItem('billiard_auth_user');
    router.push('/login');
  };

  const activeTablesCount = tables.filter(t => t.status === 'active').length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex antialiased transition-colors duration-200">
      <Head>
        <title>Dashboard - BilliardStream Hub Enterprise</title>
      </Head>

      {/* ================= TOAST NOTIFICATION CONTAINER ================= */}
      <div className="fixed top-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start space-x-3 p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all duration-300 ${
              toast.type === 'order'
                ? 'bg-amber-50 dark:bg-amber-950/90 border-amber-300 dark:border-amber-500/40 text-amber-900 dark:text-amber-200'
                : toast.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200'
                : 'bg-white dark:bg-slate-900/90 border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <div className="text-lg shrink-0">
              {toast.type === 'order' ? '🍔' : toast.type === 'error' ? '⚠️' : '✅'}
            </div>
            <div className="flex-1 text-xs">
              <div className="font-bold text-slate-900 dark:text-white text-[13px]">{toast.title}</div>
              <div className="text-slate-600 dark:text-slate-300 mt-0.5 leading-snug">{toast.message}</div>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-xs shrink-0 p-1"
            >
              &times;
            </button>
          </div>
        ))}
      </div>

      {/* Modern Sidebar */}
      <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between shrink-0 shadow-sm transition-colors duration-200">
        <div>
          <div className="p-6 flex items-center space-x-3 border-b border-slate-200 dark:border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-emerald-500 flex items-center justify-center text-slate-950 font-black text-lg shadow-md shadow-emerald-500/20">
              🎱
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight text-slate-900 dark:text-white leading-tight">BilliardStream</h1>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">Enterprise Suite v2.0</span>
            </div>
          </div>

          <nav className="p-4 space-y-1.5">
            <button
              onClick={() => setActiveTab('overview')}
              className={`w-full text-left flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'overview'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>Arena & Meja Live</span>
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full text-left flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'orders'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>Pesanan F&B</span>
              {orders.length > 0 && (
                <span className="bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {orders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('cameras')}
              className={`w-full text-left flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'cameras'
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <span>CCTV RTSP Topology</span>
            </button>
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div className="flex items-center justify-between bg-slate-100 dark:bg-slate-950 p-3 rounded-2xl border border-slate-200 dark:border-slate-800">
            <div className="overflow-hidden">
              <div className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.fullName || 'Kasir Frontdesk'}</div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 capitalize">{user?.role || 'Operator'}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Logout dari sistem"
              className="bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 text-xs font-bold px-2.5 py-1.5 rounded-xl transition-colors shrink-0"
            >
              Keluar
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/60 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30 transition-colors">
          <h2 className="text-sm font-bold text-slate-900 dark:text-white capitalize">Monitoring Arena Meja Live</h2>
          
          <div className="flex items-center space-x-3">
            {/* Theme Toggle Button (Light/Dark Mode) */}
            <button
              onClick={toggleTheme}
              className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all border border-slate-200 dark:border-slate-700"
            >
              <span>{theme === 'dark' ? '☀️ Mode Terang' : '🌙 Mode Gelap'}</span>
            </button>

            <button
              onClick={() => fetchTables()}
              className="text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-3.5 py-1.5 rounded-xl text-slate-700 dark:text-slate-300 font-medium transition-colors border border-slate-200 dark:border-slate-700"
            >
              Refresh Data
            </button>
          </div>
        </header>

        <main className="p-6 space-y-6 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <>
              {/* Quick Opener Banner */}
              <div className="bg-gradient-to-r from-emerald-500/10 via-slate-100 to-white dark:from-slate-900 dark:to-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm dark:shadow-xl">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Quick Dispatcher</span>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">Buka Sesi Meja & Tampilkan QR Code</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Pilih nomor meja dan durasi untuk mengaktifkan live feed kamera overhead.</p>
                </div>
                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-5 py-2.5 rounded-2xl text-xs shadow-lg shadow-emerald-500/20 transition-all shrink-0"
                >
                  + Buka Meja Baru
                </button>
              </div>

              {/* Metric Highlights */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{activeTablesCount}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Meja Sedang Main</div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{tables.length - activeTablesCount}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Meja Tersedia / Kosong</div>
                </div>
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
                  <div className="text-2xl font-black text-slate-900 dark:text-white">{orders.length}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Pesanan F&B Masuk</div>
                </div>
              </div>

              {/* Tables Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {tables.map(table => {
                  const isActive = table.status === 'active';
                  return (
                    <div
                      key={table.id}
                      className={`bg-white dark:bg-slate-900 border ${
                        isActive
                          ? 'border-emerald-400 dark:border-emerald-500/40 bg-gradient-to-b from-emerald-50/30 to-white dark:from-slate-900 dark:to-emerald-950/20'
                          : 'border-slate-200 dark:border-slate-800'
                      } rounded-2xl p-5 flex flex-col justify-between shadow-sm dark:shadow-lg transition-all`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">{table.name}</h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                          }`}>
                            {isActive ? 'SEDANG MAIN' : 'TERSEDIA'}
                          </span>
                        </div>
                        {isActive && (
                          <div className="bg-slate-50 dark:bg-slate-950/80 p-3 rounded-xl border border-slate-200 dark:border-slate-800 text-xs space-y-1 mb-4">
                            <div className="flex justify-between text-slate-500 dark:text-slate-400">
                              <span>Pelanggan:</span>
                              <span className="text-slate-900 dark:text-white font-semibold">{table.activeSession?.customerName}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 dark:text-slate-400">
                              <span>Durasi:</span>
                              <span className="text-slate-900 dark:text-white font-semibold">{table.activeSession?.durationMinutes} Menit</span>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 mt-2">
                        {/* Live CCTV Stream Preview Button */}
                        <button
                          onClick={() => setPreviewTable(table)}
                          className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold py-2 rounded-xl transition-colors flex items-center justify-center space-x-1.5"
                        >
                          <span>📹 Pantau Live Video</span>
                        </button>

                        {isActive ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleExtend(table.activeSession?.sessionId)}
                              className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold py-2 rounded-xl text-slate-700 dark:text-slate-200 transition-colors"
                            >
                              +30 Menit
                            </button>
                            <button
                              onClick={() => handleTerminate(table.activeSession?.sessionId)}
                              className="bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 text-[11px] font-semibold py-2 rounded-xl border border-rose-200 dark:border-rose-500/20 transition-colors"
                            >
                              Stop Sesi
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setSelectedTableId(table.id); setIsCreateOpen(true); }}
                            className="w-full bg-emerald-50 dark:bg-slate-800/80 hover:bg-emerald-100 dark:hover:bg-slate-800 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-transparent text-xs font-semibold py-2 rounded-xl transition-colors"
                          >
                            Buka Meja Ini
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'orders' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tiket Pesanan Makanan & Minuman</h3>
              {orders.length === 0 ? (
                <p className="text-xs text-slate-500 italic p-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  Belum ada pesanan F&B baru dari meja pelanggan.
                </p>
              ) : (
                orders.map(o => (
                  <div key={o.id} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs shadow-sm dark:shadow-md">
                    <div>
                      <span className="font-bold text-amber-600 dark:text-amber-400">[{o.tableName}]</span>
                      <div className="text-slate-900 dark:text-white mt-1 font-medium">{o.items.map(i => `${i.name} (x${i.qty})`).join(', ')}</div>
                      {o.notes && <div className="text-[11px] text-slate-500 italic mt-0.5">Catatan: "{o.notes}"</div>}
                    </div>
                    <div className="flex items-center space-x-2">
                      {o.status === 'pending' ? (
                        <button
                          onClick={() => handleMarkOrderComplete(o.id)}
                          className="bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 px-3 py-1.5 rounded-xl font-bold transition-colors"
                        >
                          Tandai Selesai
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase">{o.status}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'cameras' && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm dark:shadow-xl">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Topologi IP Camera & WebRTC WHEP</h3>
              <div className="space-y-3">
                {tables.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 text-xs">
                    <div>
                      <div className="font-bold text-slate-900 dark:text-white">{t.name}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{t.rtspUrl}</div>
                    </div>
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[10px] bg-emerald-100 dark:bg-emerald-500/10 px-2.5 py-1 rounded-lg">WHEP ACTIVE</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ================= MODAL: RESPONSIVE LIVE CCTV PREVIEW ================= */}
      {previewTable && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 lg:p-10">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 w-full max-w-5xl shadow-2xl space-y-4 flex flex-col max-h-[95vh]">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">Overhead Live Feed</span>
                <h3 className="text-base font-bold text-white">{previewTable.name}</h3>
              </div>
              <button
                onClick={() => setPreviewTable(null)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 w-8 h-8 rounded-full flex items-center justify-center text-sm"
              >
                &times;
              </button>
            </div>

            {/* Video Viewport: Large on Desktop, Responsive on Mobile/Tablet */}
            <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-slate-800 shadow-inner flex items-center justify-center">
              <div className="absolute top-3 left-3 bg-black/60 backdrop-blur px-2.5 py-1 rounded-full text-[10px] font-bold text-white flex items-center space-x-1.5 border border-white/10 z-20">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>OVERHEAD 1080p</span>
              </div>

              {/* Placeholder/Live Feed text */}
              <div className="text-center p-6 space-y-2">
                <div className="text-3xl">🎱</div>
                <div className="text-slate-400 font-mono text-xs">
                  WebRTC WHEP Stream Active: http://localhost:8889/{previewTable.streamPath}/whep
                </div>
                <div className="text-[11px] text-emerald-400 font-mono">
                  Latency: &lt; 300ms (On-Premise LAN)
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-400 pt-1">
              <span>RTSP Target: <code className="text-slate-300">{previewTable.rtspUrl}</code></span>
              <button
                onClick={() => setPreviewTable(null)}
                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs"
              >
                Tutup Monitor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: BUKA SESI MEJA ================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Buka Sesi Meja Baru</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white text-lg">&times;</button>
            </div>
            <form onSubmit={handleCreateSession} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Pilih Meja</label>
                <select
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Durasi Bermain</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={30}>30 Menit</option>
                  <option value={60}>60 Menit (1 Jam)</option>
                  <option value={120}>120 Menit (2 Jam)</option>
                  <option value={180}>180 Menit (3 Jam)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1">Nama / Panggilan Pelanggan</label>
                <input
                  type="text"
                  placeholder="Contoh: Mas Kevin"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button type="submit" className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 rounded-xl text-xs mt-2 shadow-lg shadow-emerald-500/20 transition-all">
                Generate & Tampilkan QR
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: POPUP QR CODE ================= */}
      {qrModalData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-sm w-full text-center space-y-4 shadow-2xl">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">QR Code Akses {qrModalData.tableName}</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Scan QR Code ini menggunakan kamera HP untuk menonton streaming overhead meja:</p>
            <div className="bg-white p-4 rounded-2xl inline-block shadow-inner border border-slate-200">
              <img src={qrModalData.qrUrl} alt="QR Code" className="w-56 h-56 mx-auto" />
            </div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Durasi Sesi: {qrModalData.duration} Menit</div>
            <div className="flex space-x-2 pt-2">
              <button onClick={() => window.print()} className="flex-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs py-2.5 rounded-xl font-bold transition-colors">
                Cetak Slip
              </button>
              <button onClick={() => setQrModalData(null)} className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs py-2.5 rounded-xl font-bold transition-colors">
                Selesai / Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
