let authToken = localStorage.getItem('billiard_auth_token') || null;
let tablesData = [];
let ordersData = [];
let ws = null;
let activeTab = 'overview';

async function init() {
  if (!authToken) {
    showLoginView();
  } else {
    hideLoginView();
    await verifyAuthProfile();
    await fetchTables();
    await fetchOrders();
    setupWebSocket();
  }
}

// ---------------------- AUTHENTICATION ----------------------

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value;
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError');

  errBox.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.status === 'success' && data.token) {
      authToken = data.token;
      localStorage.setItem('billiard_auth_token', authToken);
      hideLoginView();
      setUserProfile(data.user);
      await fetchTables();
      await fetchOrders();
      setupWebSocket();
    } else {
      errBox.innerText = data.error || 'Username atau password salah.';
      errBox.classList.remove('hidden');
    }
  } catch (err) {
    errBox.innerText = 'Koneksi ke edge server gagal: ' + err.message;
    errBox.classList.remove('hidden');
  }
}

async function verifyAuthProfile() {
  try {
    const res = await authFetch('/api/auth/me');
    if (res.ok) {
      const data = await res.json();
      setUserProfile(data.user);
    } else {
      handleLogout();
    }
  } catch (e) {
    handleLogout();
  }
}

function setUserProfile(user) {
  if (user) {
    document.getElementById('userFullName').innerText = user.fullName || user.username;
    document.getElementById('userRoleBadge').innerText = user.role || 'operator';
  }
}

function handleLogout() {
  localStorage.removeItem('billiard_auth_token');
  authToken = null;
  showLoginView();
}

function showLoginView() {
  document.getElementById('loginView').classList.remove('hidden');
}

function hideLoginView() {
  document.getElementById('loginView').classList.add('hidden');
}

function authFetch(url, options = {}) {
  const headers = options.headers || {};
  headers['Authorization'] = `Bearer ${authToken}`;
  return fetch(url, { ...options, headers });
}

// ---------------------- TAB NAVIGATION ----------------------

function switchTab(tabName) {
  activeTab = tabName;
  const tabs = ['overview', 'orders', 'cameras', 'settings'];
  
  tabs.forEach(t => {
    const content = document.getElementById(`tab-${t}`);
    const nav = document.getElementById(`nav-${t}`);
    if (t === tabName) {
      content.classList.remove('hidden');
      nav.className = 'flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 transition-all';
    } else {
      content.classList.add('hidden');
      nav.className = 'flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all';
    }
  });

  const titles = {
    overview: 'Monitoring Arena Meja Live',
    orders: 'Tiket Pesanan F&B Masuk',
    cameras: 'CCTV Topology & Stream Gateway',
    settings: 'Parameter Sistem & Keamanan'
  };
  document.getElementById('pageTitle').innerText = titles[tabName] || 'Dashboard';
}

// ---------------------- WEBSOCKET REALTIME ----------------------

function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}?role=cashier`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_ORDER') {
        alert(`🔔 Pesanan Baru dari ${data.order.tableName}: ${data.order.items.map(i => i.name).join(', ')}`);
        fetchOrders();
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    setTimeout(setupWebSocket, 3000);
  };
}

// ---------------------- TABLES & METRICS ----------------------

async function fetchTables() {
  try {
    const res = await authFetch('/api/tables');
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) handleLogout();
      return;
    }
    const json = await res.json();
    tablesData = json.data;
    renderTablesDropdown();
    renderTablesGrid();
    renderCctvTopology();
  } catch (err) {
    console.error('Gagal mengambil data meja:', err);
  }
}

function renderTablesDropdown() {
  const select = document.getElementById('selectTables');
  select.innerHTML = tablesData.map(t => `
    <option value="${t.id}">${t.name} (${t.status.toUpperCase()})</option>
  `).join('');
}

function renderTablesGrid() {
  const grid = document.getElementById('tablesGrid');
  let activeCount = 0;

  grid.innerHTML = tablesData.map(t => {
    const isActive = t.status === 'active';
    if (isActive) activeCount++;

    return `
      <div class="bg-slate-900 border ${isActive ? 'border-emerald-500/40 bg-gradient-to-b from-slate-900 to-emerald-950/20' : 'border-slate-800'} rounded-2xl p-5 shadow-lg relative overflow-hidden flex flex-col justify-between">
        <div>
          <div class="flex items-center justify-between mb-3">
            <h4 class="text-sm font-bold text-white">${t.name}</h4>
            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold ${isActive ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}">
              ${isActive ? 'AKTIF BERMAIN' : 'TERSEDIA'}
            </span>
          </div>

          ${isActive ? `
            <div class="space-y-1.5 mb-4 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
              <div class="flex justify-between text-slate-400">
                <span>Pelanggan:</span>
                <span class="text-white font-semibold">${t.activeSession.customerName || 'Guest'}</span>
              </div>
              <div class="flex justify-between text-slate-400">
                <span>Durasi:</span>
                <span class="text-white font-semibold">${t.activeSession.durationMinutes} Menit</span>
              </div>
            </div>
          ` : `
            <p class="text-xs text-slate-500 mb-4">Meja siap untuk pelanggan baru.</p>
          `}
        </div>

        <div>
          ${isActive ? `
            <div class="grid grid-cols-2 gap-2">
              <button onclick="extendSession('${t.activeSession.sessionId}', 30)" class="bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold py-2 rounded-xl text-slate-200 transition-colors">
                +30 Menit
              </button>
              <button onclick="terminateSession('${t.activeSession.sessionId}')" class="bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 text-[11px] font-semibold py-2 rounded-xl border border-rose-500/20 transition-colors">
                Stop Sesi
              </button>
            </div>
          ` : `
            <button onclick="quickOpenTable(${t.id})" class="w-full bg-slate-800/80 hover:bg-slate-800 text-emerald-400 text-xs font-semibold py-2 rounded-xl transition-colors">
              Buka Meja Ini
            </button>
          `}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('statActiveTables').innerText = activeCount;
  document.getElementById('statIdleTables').innerText = tablesData.length - activeCount;
}

function renderCctvTopology() {
  const container = document.getElementById('cctvStatusList');
  container.innerHTML = tablesData.map(t => `
    <div class="flex items-center justify-between p-3.5 bg-slate-950 rounded-xl border border-slate-800/80 text-xs">
      <div class="flex items-center space-x-3">
        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
        <div>
          <div class="font-bold text-white">${t.name} (RTSP Stream)</div>
          <div class="text-[10px] text-slate-500 font-mono">${t.rtspUrl}</div>
        </div>
      </div>
      <span class="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">WHEP ACTIVE</span>
    </div>
  `).join('');
}

// ---------------------- SESSIONS ----------------------

function openCreateModal() {
  document.getElementById('createSessionModal').classList.remove('hidden');
}

function closeCreateModal() {
  document.getElementById('createSessionModal').classList.add('hidden');
}

function quickOpenTable(tableId) {
  document.getElementById('selectTables').value = tableId;
  openCreateModal();
}

async function handleCreateSession(e) {
  e.preventDefault();
  const tableId = document.getElementById('selectTables').value;
  const durationMinutes = document.getElementById('selectDuration').value;
  const customerName = document.getElementById('inputCustomer').value;

  try {
    const res = await authFetch('/api/sessions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, durationMinutes, customerName })
    });
    const result = await res.json();
    if (result.status === 'success') {
      closeCreateModal();
      showQrModal(result.session.tableName, result.session.durationMinutes, result.qrDataUrl);
      fetchTables();
    }
  } catch (err) {
    alert('Gagal membuat sesi meja: ' + err.message);
  }
}

async function extendSession(sessionId, mins) {
  await authFetch(`/api/sessions/${sessionId}/extend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ additionalMinutes: mins })
  });
  fetchTables();
}

async function terminateSession(sessionId) {
  if (confirm('Yakin ingin mematikan live streaming sesi meja ini?')) {
    await authFetch(`/api/sessions/${sessionId}/terminate`, { method: 'POST' });
    fetchTables();
  }
}

function showQrModal(tableName, duration, qrDataUrl) {
  document.getElementById('modalTableName').innerText = `QR Akses ${tableName}`;
  document.getElementById('modalDurationText').innerText = `Durasi Sesi: ${duration} Menit`;
  document.getElementById('modalQrImg').src = qrDataUrl;
  document.getElementById('qrModal').classList.remove('hidden');
}

function closeQrModal() {
  document.getElementById('qrModal').classList.add('hidden');
}

// ---------------------- ORDERS ----------------------

async function fetchOrders() {
  try {
    const res = await authFetch('/api/cashier/orders');
    if (!res.ok) return;
    const json = await res.json();
    ordersData = json.orders || [];

    const badge = document.getElementById('badgeOrderCount');
    const pendingOrders = ordersData.filter(o => o.status === 'pending');
    if (pendingOrders.length > 0) {
      badge.innerText = pendingOrders.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }

    document.getElementById('statActiveOrders').innerText = pendingOrders.length;

    const container = document.getElementById('ordersContainer');
    if (ordersData.length === 0) {
      container.innerHTML = `<p class="text-xs text-slate-500 italic p-4 bg-slate-900 rounded-2xl border border-slate-800">Belum ada pesanan F&B baru dari meja pelanggan.</p>`;
      return;
    }

    container.innerHTML = ordersData.map(o => `
      <div class="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex justify-between items-center text-xs">
        <div>
          <div class="flex items-center space-x-2">
            <span class="font-bold text-amber-400">[${o.tableName}]</span>
            <span class="text-slate-400">#${o.id}</span>
          </div>
          <div class="text-slate-200 mt-1 font-medium">
            ${o.items.map(i => `${i.name} (x${i.qty})`).join(', ')}
          </div>
          ${o.notes ? `<div class="text-[11px] text-slate-500 italic mt-0.5">Catatan: "${o.notes}"</div>` : ''}
        </div>
        <div class="flex items-center space-x-2">
          ${o.status === 'pending' ? `
            <button onclick="updateOrderStatus('${o.id}', 'completed')" class="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1.5 rounded-xl font-bold">
              Tandai Selesai
            </button>
          ` : `
            <span class="px-2.5 py-1 rounded-xl bg-slate-800 text-slate-400 text-[10px] font-semibold uppercase">${o.status}</span>
          `}
        </div>
      </div>
    `).join('');
  } catch (e) {}
}

async function updateOrderStatus(orderId, status) {
  await authFetch(`/api/cashier/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });
  fetchOrders();
}

window.onload = init;
