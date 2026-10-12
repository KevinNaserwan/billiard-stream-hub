import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import {
  LayoutDashboard,
  UtensilsCrossed,
  Film,
  Video,
  BarChart3,
  Monitor,
  Sun,
  Moon,
  RefreshCw,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Plus,
  Play,
  Clock,
  User,
  CheckCircle2,
  AlertCircle,
  X,
  Printer,
  SlidersHorizontal,
  ChevronDown,
  Info
} from 'lucide-react';

interface TableItem {
  id: number;
  name: string;
  brand?: string;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'cameras' | 'highlights' | 'analytics'>('overview');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  
  // Custom Toast notifications (Non-browser alert)
  const [toasts, setToasts] = useState<ToastNotification[]>([]);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedTableId, setSelectedTableId] = useState(1);
  const [duration, setDuration] = useState(60);
  const [customerName, setCustomerName] = useState('');
  const [qrModalData, setQrModalData] = useState<{ tableName: string; qrUrl: string; duration: number } | null>(null);

  // Live CCTV Stream Modal
  const [previewTable, setPreviewTable] = useState<TableItem | null>(null);

  // Gallery of clips
  const [recentClips, setRecentClips] = useState<any[]>([
    { id: 1, table: 'Table 03 - VIP Diamond', time: '18:22', player: 'Kevin N.', file: 'clip_table3_1791804141.mp4', size: '4.8 MB' },
    { id: 2, table: 'Table 01 - Standard Arena', time: '17:45', player: 'Rian S.', file: 'clip_table1_1791802100.mp4', size: '5.2 MB' },
    { id: 3, table: 'Table 05 - Pro Tournament', time: '16:10', player: 'Dimas A.', file: 'clip_table5_1791798500.mp4', size: '4.5 MB' },
  ]);

  const addToast = (title: string, message: string, type: 'order' | 'success' | 'error' = 'success') => {
    const id = `toast_${Date.now()}`;
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4500);
  };

  useEffect(() => {
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
              `Pesanan Masuk: ${data.order.tableName}`,
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
        addToast('Sesi Berhasil Dibuka', `Akses meja ${data.session.tableName} aktif selama ${duration} menit.`);
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
      addToast('Pesanan Selesai', 'Status pesanan berhasil diperbarui.');
      fetchOrders();
    } catch (e) {}
  };

  const handleLogout = () => {
    localStorage.removeItem('billiard_auth_token');
    localStorage.removeItem('billiard_auth_user');
    router.push('/login');
  };

  const activeTablesCount = tables.filter(t => t.status === 'active').length;

  return (
    <div className="min-h-screen bg-slate-100/70 dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 flex antialiased transition-colors duration-150">
      <Head>
        <title>BilliardStream Hub - Cashier & Arena Console</title>
      </Head>

      {/* ================= TOAST NOTIFICATION CONTAINER ================= */}
      <div className="fixed top-5 right-5 z-50 flex flex-col space-y-2 pointer-events-none max-w-sm w-full">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start space-x-3 p-3.5 rounded-lg shadow-lg border backdrop-blur-md transition-all duration-200 ${
              toast.type === 'order'
                ? 'bg-amber-50 dark:bg-amber-950/90 border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-200'
                : toast.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/90 border-rose-200 dark:border-rose-800/80 text-rose-900 dark:text-rose-200'
                : 'bg-white dark:bg-slate-900/95 border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100'
            }`}
          >
            <div className="shrink-0 mt-0.5">
              {toast.type === 'order' ? (
                <UtensilsCrossed className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              ) : toast.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              )}
            </div>
            <div className="flex-1 text-xs">
              <div className="font-semibold">{toast.title}</div>
              <div className="text-slate-600 dark:text-slate-400 mt-0.5 leading-snug">{toast.message}</div>
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* ================= REFINED SIDEBAR ================= */}
      <aside
        className={`${
          isSidebarOpen ? 'w-60' : 'w-16'
        } bg-white dark:bg-[#111622] border-r border-slate-200 dark:border-slate-800/80 flex flex-col justify-between shrink-0 transition-all duration-200 ease-in-out`}
      >
        <div>
          {/* Header Brand */}
          <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/80">
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                B
              </div>
              {isSidebarOpen && (
                <div className="truncate">
                  <h1 className="text-sm font-semibold tracking-tight leading-none text-slate-900 dark:text-white">BilliardStream</h1>
                  <span className="text-[11px] text-slate-500 font-normal">Arena Edge Console</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-2 space-y-1">
            <button
              onClick={() => setActiveTab('overview')}
              title="Arena & Meja Live"
              className={`w-full text-left flex items-center ${
                isSidebarOpen ? 'space-x-2.5 px-3' : 'justify-center px-0'
              } py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-slate-100 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <LayoutDashboard className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Meja & Live Session</span>}
            </button>

            <button
              onClick={() => setActiveTab('orders')}
              title="Pesanan F&B"
              className={`w-full text-left flex items-center ${
                isSidebarOpen ? 'justify-between px-3' : 'justify-center px-0 relative'
              } py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'orders'
                  ? 'bg-slate-100 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <UtensilsCrossed className="w-4 h-4 shrink-0" />
                {isSidebarOpen && <span>Pesanan F&B</span>}
              </div>
              {orders.length > 0 && (
                <span
                  className={`${
                    isSidebarOpen ? 'relative' : 'absolute -top-1 -right-1'
                  } bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-semibold px-1.5 py-0.2 rounded`}
                >
                  {orders.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('highlights')}
              title="Klip Rekaman 30s"
              className={`w-full text-left flex items-center ${
                isSidebarOpen ? 'space-x-2.5 px-3' : 'justify-center px-0'
              } py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'highlights'
                  ? 'bg-slate-100 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <Film className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Arsip Klip 30s</span>}
            </button>

            <button
              onClick={() => setActiveTab('cameras')}
              title="Topologi Kamera"
              className={`w-full text-left flex items-center ${
                isSidebarOpen ? 'space-x-2.5 px-3' : 'justify-center px-0'
              } py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'cameras'
                  ? 'bg-slate-100 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <Video className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Topologi Kamera</span>}
            </button>

            <button
              onClick={() => setActiveTab('analytics')}
              title="Estimasi & Durasi"
              className={`w-full text-left flex items-center ${
                isSidebarOpen ? 'space-x-2.5 px-3' : 'justify-center px-0'
              } py-2 rounded-lg text-xs font-medium transition-colors ${
                activeTab === 'analytics'
                  ? 'bg-slate-100 dark:bg-slate-800/80 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-800/40'
              }`}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              {isSidebarOpen && <span>Estimasi & Durasi</span>}
            </button>
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="p-3 border-t border-slate-200 dark:border-slate-800/80">
          {isSidebarOpen ? (
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <div className="overflow-hidden">
                <div className="text-xs font-medium text-slate-900 dark:text-white truncate">{user?.fullName || 'Kasir'}</div>
                <div className="text-[10px] text-slate-500 capitalize">{user?.role || 'Operator'}</div>
              </div>
              <button
                onClick={handleLogout}
                title="Keluar dari sistem"
                className="text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 p-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              title="Logout"
              className="w-full flex justify-center p-2 rounded-lg text-slate-400 hover:text-rose-500"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </aside>

      {/* ================= MAIN WORKSPACE ================= */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="h-16 border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#111622]/80 backdrop-blur px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {activeTab === 'overview' && 'Meja & Live Session'}
              {activeTab === 'orders' && 'Antrean Pesanan F&B'}
              {activeTab === 'highlights' && 'Arsip Klip 30 Detik'}
              {activeTab === 'cameras' && 'Topologi RTSP / ONVIF IP Camera'}
              {activeTab === 'analytics' && 'Estimasi Sewa & Jam Main'}
            </h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <a
              href="/customer-display"
              target="_blank"
              rel="noreferrer"
              className="hidden md:inline-flex items-center space-x-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/80 transition-colors"
            >
              <Monitor className="w-3.5 h-3.5" />
              <span>Customer Screen</span>
            </a>

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Toggle Mode"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={() => fetchTables()}
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="p-6 space-y-6 max-w-7xl w-full mx-auto">
          {activeTab === 'overview' && (
            <>
              {/* Metric Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white dark:bg-[#111622] p-4 rounded-xl border border-slate-200 dark:border-slate-800/80 shadow-sm">
                <div className="flex items-center divide-x divide-slate-200 dark:divide-slate-800 text-xs">
                  <div className="pr-4">
                    <span className="text-slate-500 block text-[11px]">Meja Aktif</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-base">{activeTablesCount} Meja</span>
                  </div>
                  <div className="px-4">
                    <span className="text-slate-500 block text-[11px]">Meja Kosong</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-base">{tables.length - activeTablesCount} Meja</span>
                  </div>
                  <div className="pl-4">
                    <span className="text-slate-500 block text-[11px]">Tiket Order</span>
                    <span className="font-semibold text-slate-900 dark:text-white text-base">{orders.length} Tiket</span>
                  </div>
                </div>

                <button
                  onClick={() => setIsCreateOpen(true)}
                  className="inline-flex items-center justify-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-xs px-4 py-2 rounded-lg transition-colors shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Buka Sesi Meja</span>
                </button>
              </div>

              {/* Tables Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tables.map(table => {
                  const isActive = table.status === 'active';
                  return (
                    <div
                      key={table.id}
                      className={`bg-white dark:bg-[#111622] border ${
                        isActive
                          ? 'border-emerald-500/50 dark:border-emerald-500/40 ring-1 ring-emerald-500/10'
                          : 'border-slate-200 dark:border-slate-800/80'
                      } rounded-xl p-4 flex flex-col justify-between shadow-sm transition-all`}
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2.5">
                          <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{table.name}</h4>
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                              isActive
                                ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {isActive ? 'Aktif' : 'Kosong'}
                          </span>
                        </div>

                        {isActive ? (
                          <div className="bg-slate-50 dark:bg-slate-900/80 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800/80 text-xs space-y-1 mb-3">
                            <div className="flex justify-between text-slate-500 dark:text-slate-400">
                              <span>Pemain:</span>
                              <span className="font-medium text-slate-900 dark:text-white">{table.activeSession?.customerName}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 dark:text-slate-400">
                              <span>Durasi Sesi:</span>
                              <span className="font-medium text-slate-900 dark:text-white">{table.activeSession?.durationMinutes} Menit</span>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400 mb-4 py-2">
                            Meja idle. Siap menerima reservasi & booking live stream.
                          </div>
                        )}
                      </div>

                      <div className="space-y-2 pt-1 border-t border-slate-100 dark:border-slate-800/60">
                        {/* Live CCTV Stream Preview Button */}
                        <button
                          onClick={() => setPreviewTable(table)}
                          className="w-full inline-flex items-center justify-center space-x-1.5 text-xs text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700/60 transition-colors"
                        >
                          <Play className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Pantau Kamera Meja</span>
                        </button>

                        {isActive ? (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleExtend(table.activeSession?.sessionId)}
                              className="text-[11px] font-medium py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors text-center"
                            >
                              +30 Menit
                            </button>
                            <button
                              onClick={() => handleTerminate(table.activeSession?.sessionId)}
                              className="text-[11px] font-medium py-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20 transition-colors text-center"
                            >
                              Stop Sesi
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setSelectedTableId(table.id); setIsCreateOpen(true); }}
                            className="w-full text-xs font-medium py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 transition-colors"
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
              <div className="flex justify-between items-center">
                <h3 className="text-xs font-semibold text-slate-900 dark:text-white uppercase tracking-wider">Antrean Tiket Pesanan Masuk</h3>
                <span className="text-xs text-slate-500">{orders.length} pesanan total</span>
              </div>

              {orders.length === 0 ? (
                <div className="text-xs text-slate-500 italic p-6 bg-white dark:bg-[#111622] rounded-xl border border-slate-200 dark:border-slate-800 text-center">
                  Belum ada pesanan F&B baru dari meja pelanggan.
                </div>
              ) : (
                orders.map(o => (
                  <div key={o.id} className="bg-white dark:bg-[#111622] p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex justify-between items-center text-xs shadow-sm">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{o.tableName}</span>
                        <span className="text-slate-400">· Order #{o.id.slice(-6)}</span>
                      </div>
                      <div className="text-slate-800 dark:text-slate-200 mt-1 font-medium">{o.items.map(i => `${i.name} (x${i.qty})`).join(', ')}</div>
                      {o.notes && <div className="text-[11px] text-slate-500 italic mt-0.5">Catatan: "{o.notes}"</div>}
                    </div>
                    <div className="flex items-center space-x-2">
                      {o.status === 'pending' ? (
                        <button
                          onClick={() => handleMarkOrderComplete(o.id)}
                          className="bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          Tandai Selesai
                        </button>
                      ) : (
                        <span className="px-2.5 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[10px] font-medium uppercase">{o.status}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'highlights' && (
            <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Arsip Rekaman Klip 30 Detik</h3>
                  <p className="text-xs text-slate-500">Momen trickshot yang di-generate oleh pelanggan dari meja.</p>
                </div>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md">
                  {recentClips.length} File Klip
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentClips.map(clip => (
                  <div key={clip.id} className="py-3 flex justify-between items-center text-xs">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{clip.table} — {clip.player}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">Waktu: {clip.time} WIB · Ukuran: {clip.size}</div>
                    </div>
                    <a
                      href={`/clips/${clip.file}`}
                      download
                      className="text-xs font-medium bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                    >
                      Unduh Klip
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'cameras' && (
            <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800 rounded-xl p-5 space-y-4 shadow-sm">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Topologi IP Camera (RTSP / ONVIF)</h3>
                <p className="text-xs text-slate-500">Koneksi overhead CCTV meja ke Local Streaming Server (MediaMTX / go2rtc).</p>
              </div>

              <div className="space-y-2">
                {tables.map(t => (
                  <div key={t.id} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900/60 rounded-lg border border-slate-200 dark:border-slate-800 text-xs">
                    <div>
                      <div className="font-semibold text-slate-900 dark:text-white">{t.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono mt-0.5">{t.rtspUrl}</div>
                    </div>
                    <span className="text-emerald-700 dark:text-emerald-400 font-mono text-[10px] bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-2 py-0.5 rounded">
                      RTSP ONLINE
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-xl p-3.5 text-xs text-slate-600 dark:text-slate-400 flex items-start space-x-2.5">
                <Info className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
                <div>
                  <strong className="text-slate-900 dark:text-white font-medium">Transparansi Operasional:</strong> Angka di bawah adalah estimasi operasional sewa meja berdasarkan durasi booking live stream (Rp 50.000/jam) dan pesanan F&B mandiri, terpisah dari pembukuan kasir POS utama.
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                  <span className="text-xs text-slate-500">Estimasi Nilai Sewa Meja</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">Rp 1.450.000</div>
                  <span className="text-[11px] text-slate-400">Total 18 Jam Sesi Aktif</span>
                </div>
                <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                  <span className="text-xs text-slate-500">Meja Paling Sering Digunakan</span>
                  <div className="text-base font-semibold text-slate-900 dark:text-white mt-1">Table 03 (VIP Diamond)</div>
                  <span className="text-[11px] text-slate-400">5 Jam Penggunaan</span>
                </div>
                <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
                  <span className="text-xs text-slate-500">Klip Trickshot Diunduh</span>
                  <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">24 Video</div>
                  <span className="text-[11px] text-slate-400">Highlight 30 Detik Tersimpan</span>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* ================= MODAL: LIVE CCTV PREVIEW ================= */}
      {previewTable && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 w-full max-w-4xl shadow-2xl space-y-3">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">Live Overhead Feed</span>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{previewTable.name}</h3>
              </div>
              <button
                onClick={() => setPreviewTable(null)}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black flex items-center justify-center">
              <div className="absolute top-3 left-3 bg-black/60 px-2.5 py-1 rounded-full text-[10px] font-medium text-white flex items-center space-x-1.5 border border-white/10 z-20">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <span>OVERHEAD 1080p</span>
              </div>
              <div className="text-center p-6 space-y-1 text-xs text-slate-400">
                <div>WebRTC WHEP Stream Active: http://localhost:8889/{previewTable.streamPath}/whep</div>
                <div className="text-emerald-400 font-mono text-[11px]">Latency: &lt; 300ms (On-Premise LAN)</div>
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
              <span>RTSP Target: <code className="text-slate-700 dark:text-slate-300">{previewTable.rtspUrl}</code></span>
              <button
                onClick={() => setPreviewTable(null)}
                className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs px-3 py-1.5 rounded-lg font-medium"
              >
                Tutup Monitor
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: BUKA SESI MEJA ================= */}
      {isCreateOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-2.5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Buka Sesi Meja Baru</h3>
              <button onClick={() => setIsCreateOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleCreateSession} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Pilih Meja</label>
                <select
                  value={selectedTableId}
                  onChange={(e) => setSelectedTableId(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  {tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Durasi Bermain</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={30}>30 Menit</option>
                  <option value={60}>60 Menit (1 Jam)</option>
                  <option value={120}>120 Menit (2 Jam)</option>
                  <option value={180}>180 Menit (3 Jam)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Pemain (Opsional)</label>
                <input
                  type="text"
                  placeholder="Contoh: Mas Kevin"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-emerald-500"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-lg text-xs transition-colors mt-2"
              >
                Generate & Tampilkan QR
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL: POPUP QR CODE ================= */}
      {qrModalData && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#111622] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 max-w-xs w-full text-center space-y-3 shadow-xl">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Akses {qrModalData.tableName}</h3>
            <p className="text-xs text-slate-500">Scan QR Code dengan kamera HP:</p>
            <div className="bg-white p-3 rounded-xl inline-block border border-slate-200 shadow-sm">
              <img src={qrModalData.qrUrl} alt="QR Code" className="w-52 h-52 mx-auto" />
            </div>
            <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Durasi: {qrModalData.duration} Menit</div>
            <div className="flex space-x-2 pt-1">
              <button
                onClick={() => window.print()}
                className="flex-1 inline-flex items-center justify-center space-x-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-white text-xs py-2 rounded-lg font-medium transition-colors"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak Slip</span>
              </button>
              <button
                onClick={() => setQrModalData(null)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs py-2 rounded-lg font-medium transition-colors"
              >
                Selesai
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
