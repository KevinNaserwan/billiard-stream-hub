let tablesData = [];
let ws = null;

async function init() {
  await fetchTables();
  setupWebSocket();
  fetchOrders();
}

function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${window.location.host}?role=cashier`);

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'NEW_ORDER') {
        alert(`🔔 Pesanan Baru dari ${data.order.tableName}!`);
        fetchOrders();
      }
    } catch (e) {}
  };

  ws.onclose = () => {
    setTimeout(setupWebSocket, 3000);
  };
}

async function fetchTables() {
  try {
    const res = await fetch('/api/tables');
    const json = await res.json();
    tablesData = json.data;
    renderTablesDropdown();
    renderTablesGrid();
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
      <div class="bg-slate-900 border ${isActive ? 'border-emerald-500/40 bg-emerald-950/10' : 'border-slate-800'} rounded-2xl p-5 shadow-lg relative overflow-hidden">
        <div class="flex items-center justify-between mb-3">
          <h3 class="text-base font-bold text-white">${t.name}</h3>
          <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${isActive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-slate-800 text-slate-400'}">
            ${isActive ? 'Sedang Main' : 'Tersedia'}
          </span>
        </div>

        ${isActive ? `
          <div class="space-y-2 mb-4 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            <div class="flex justify-between text-xs text-slate-400">
              <span>Pelanggan:</span>
              <span class="text-white font-medium">${t.activeSession.customerName || 'Guest'}</span>
            </div>
            <div class="flex justify-between text-xs text-slate-400">
              <span>Durasi:</span>
              <span class="text-white font-medium">${t.activeSession.durationMinutes} Menit</span>
            </div>
          </div>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="extendSession('${t.activeSession.sessionId}', 30)" class="bg-slate-800 hover:bg-slate-700 text-xs py-2 rounded-lg text-slate-200">
              +30 Menit
            </button>
            <button onclick="terminateSession('${t.activeSession.sessionId}')" class="bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs py-2 rounded-lg border border-rose-500/30">
              Stop Sesi
            </button>
          </div>
        ` : `
          <p class="text-xs text-slate-500 mb-4">Meja kosong. Siap dibuka sesi baru.</p>
          <button onclick="quickOpenTable(${t.id})" class="w-full bg-slate-800 hover:bg-slate-700 text-emerald-400 text-xs font-semibold py-2 rounded-lg">
            Buka Meja Ini
          </button>
        `}
      </div>
    `;
  }).join('');

  document.getElementById('activeCount').innerText = `${activeCount} Meja Aktif`;
}

async function handleCreateSession(e) {
  e.preventDefault();
  const tableId = document.getElementById('selectTables').value;
  const durationMinutes = document.getElementById('selectDuration').value;
  const customerName = document.getElementById('inputCustomer').value;

  try {
    const res = await fetch('/api/sessions/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tableId, durationMinutes, customerName })
    });
    const result = await res.json();
    if (result.status === 'success') {
      showQrModal(result.session.tableName, result.session.durationMinutes, result.qrDataUrl);
      fetchTables();
    }
  } catch (err) {
    alert('Gagal membuat sesi meja: ' + err.message);
  }
}

function quickOpenTable(id) {
  document.getElementById('selectTables').value = id;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function extendSession(sessionId, mins) {
  await fetch(`/api/sessions/${sessionId}/extend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ additionalMinutes: mins })
  });
  fetchTables();
}

async function terminateSession(sessionId) {
  if (confirm('Yakin ingin mematikan sesi meja ini sekarang?')) {
    await fetch(`/api/sessions/${sessionId}/terminate`, { method: 'POST' });
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

async function fetchOrders() {
  try {
    const res = await fetch('/api/cashier/orders');
    const json = await res.json();
    const container = document.getElementById('ordersContainer');
    if (!json.orders || json.orders.length === 0) {
      container.innerHTML = `<p class="text-sm text-slate-500 italic">Belum ada pesanan F&B baru.</p>`;
      return;
    }
    container.innerHTML = json.orders.map(o => `
      <div class="bg-slate-950 p-4 rounded-xl border border-slate-800 flex justify-between items-center">
        <div>
          <span class="text-xs font-bold text-amber-400">[${o.tableName}]</span>
          <span class="text-xs text-slate-300 ml-2">${o.items.map(i => `${i.name} (x${i.qty})`).join(', ')}</span>
          ${o.notes ? `<p class="text-xs text-slate-500 mt-1 italic">Catatan: "${o.notes}"</p>` : ''}
        </div>
        <span class="text-xs px-2.5 py-1 rounded bg-amber-500/20 text-amber-300">${o.status}</span>
      </div>
    `).join('');
  } catch (e) {}
}

window.onload = init;
