let sessionToken = null;
let remainingSeconds = 0;
let timerInterval = null;
let cart = [];
let peerConnection = null;

async function init() {
  const urlParams = new URLSearchParams(window.location.search);
  sessionToken = urlParams.get('token');

  if (!sessionToken) {
    alert('Token akses meja tidak valid atau belum di-scan.');
    return;
  }

  await loadSessionInfo();
  setupWebSocket();
}

async function loadSessionInfo() {
  try {
    const res = await fetch(`/api/player/session-info?token=${encodeURIComponent(sessionToken)}`);
    const data = await res.json();

    if (data.status !== 'success') {
      triggerSessionExpired();
      return;
    }

    document.getElementById('tableNameDisplay').innerText = data.tableName;
    remainingSeconds = data.remainingSeconds;
    startCountdown();
    connectWebRTC(data.whepUrl);
  } catch (err) {
    console.error('Session load failed:', err);
  }
}

function startCountdown() {
  if (timerInterval) clearInterval(timerInterval);
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    remainingSeconds--;
    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      triggerSessionExpired();
    } else {
      updateTimerDisplay();
    }
  }, 1000);
}

function updateTimerDisplay() {
  const hrs = Math.floor(remainingSeconds / 3600);
  const mins = Math.floor((remainingSeconds % 3600) / 60);
  const secs = remainingSeconds % 60;
  
  const pad = (n) => String(n).padStart(2, '0');
  document.getElementById('countdownTimer').innerText = 
    hrs > 0 ? `${pad(hrs)}:${pad(mins)}:${pad(secs)}` : `${pad(mins)}:${pad(secs)}`;
}

function triggerSessionExpired() {
  document.getElementById('countdownTimer').innerText = '00:00';
  document.getElementById('expiredOverlay').classList.remove('hidden');
  document.getElementById('expiredOverlay').classList.add('flex');
  
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  const video = document.getElementById('streamVideo');
  video.pause();
  video.srcObject = null;
}

function setupWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const ws = new WebSocket(`${protocol}//${window.location.host}?token=${encodeURIComponent(sessionToken)}`);

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'TIME_UPDATE') {
        remainingSeconds = msg.remainingSeconds;
        updateTimerDisplay();
      } else if (msg.type === 'SESSION_EXPIRED') {
        triggerSessionExpired();
      } else if (msg.type === 'SESSION_EXTENDED') {
        remainingSeconds = msg.remainingSeconds;
        updateTimerDisplay();
      }
    } catch (e) {}
  };
}

async function connectWebRTC(whepUrl) {
  try {
    peerConnection = new RTCPeerConnection();
    const video = document.getElementById('streamVideo');

    peerConnection.ontrack = (event) => {
      video.srcObject = event.streams[0];
    };

    peerConnection.addTransceiver('video', { direction: 'recvonly' });
    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    // Kirim SDP Offer ke MediaMTX WHEP endpoint
    const response = await fetch(whepUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body: offer.sdp
    });

    if (response.ok) {
      const answerSdp = await response.text();
      await peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    }
  } catch (err) {
    console.warn('WebRTC WHEP connect fallback (MediaMTX might not be running in dev):', err);
  }
}

async function requestClip30s() {
  const btn = document.getElementById('btnClip');
  const msg = document.getElementById('clipStatusMsg');
  const dwnBtn = document.getElementById('downloadLinkBtn');

  btn.disabled = true;
  btn.classList.add('opacity-50');
  msg.classList.remove('hidden');
  dwnBtn.classList.add('hidden');

  try {
    const res = await fetch('/api/player/clip-30s', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken })
    });
    const result = await res.json();

    if (result.status === 'success' && result.downloadUrl) {
      msg.classList.add('hidden');
      dwnBtn.href = result.downloadUrl;
      dwnBtn.classList.remove('hidden');
    } else {
      alert('Gagal mengambil klip: ' + (result.error || 'Server error'));
      msg.classList.add('hidden');
    }
  } catch (e) {
    alert('Koneksi terputus saat mengambil rekaman klip.');
    msg.classList.add('hidden');
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-50');
  }
}

// ---------------------- F&B ORDERING ----------------------

function toggleFnbModal() {
  const modal = document.getElementById('fnbModal');
  modal.classList.toggle('hidden');
}

function addToCart(name, price) {
  const existing = cart.find(i => i.name === name);
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ name, price, qty: 1 });
  }
  updateCartUI();
}

function updateCartUI() {
  const summary = document.getElementById('cartSummary');
  const btn = document.getElementById('btnSubmitOrder');

  if (cart.length === 0) {
    summary.innerText = 'Keranjang masih kosong.';
    btn.disabled = true;
    return;
  }

  const total = cart.reduce((acc, curr) => acc + (curr.price * curr.qty), 0);
  summary.innerHTML = cart.map(i => `
    <div class="flex justify-between py-1">
      <span>${i.name} (x${i.qty})</span>
      <span class="font-bold text-white">Rp ${(i.price * i.qty).toLocaleString('id-ID')}</span>
    </div>
  `).join('') + `
    <div class="border-t border-slate-700 mt-2 pt-2 flex justify-between font-bold text-amber-400">
      <span>Total:</span>
      <span>Rp ${total.toLocaleString('id-ID')}</span>
    </div>
  `;
  btn.disabled = false;
}

async function submitOrder() {
  if (cart.length === 0) return;
  try {
    const res = await fetch('/api/player/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: sessionToken, items: cart })
    });
    const json = await res.json();
    if (json.status === 'success') {
      alert('Pesanan F&B berhasil dikirim ke kasir!');
      cart = [];
      updateCartUI();
      toggleFnbModal();
    }
  } catch (e) {
    alert('Gagal mengirim pesanan: ' + e.message);
  }
}

window.onload = init;
