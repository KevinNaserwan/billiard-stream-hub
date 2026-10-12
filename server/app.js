const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');

const db = require('./database');
const sessionManager = require('./sessionManager');
const clipper = require('./clipper');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;
const MEDIAMTX_WHEP_BASE = process.env.MEDIAMTX_WHEP || 'http://localhost:8889';
const AUTH_SECRET = process.env.AUTH_SECRET || 'billiard_admin_supersecret_jwt_2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ---------------------- AUTH MIDDLEWARE ----------------------
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Sesi login tidak sah atau tidak ditemukan' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, AUTH_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token login kadaluarsa atau tidak valid' });
  }
}

// ---------------------- AUTH API ----------------------

// 1. Admin/Cashier Login
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username dan password wajib diisi' });
  }

  const user = db.validateUser(username, password);
  if (!user) {
    return res.status(401).json({ error: 'Username atau password salah' });
  }

  const token = jwt.sign(
    { userId: user.id, username: user.username, role: user.role, fullName: user.fullName },
    AUTH_SECRET,
    { expiresIn: '12h' }
  );

  res.json({
    status: 'success',
    token,
    user
  });
});

// 2. Get Current Auth Profile
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({ status: 'success', user: req.user });
});

// ---------------------- DASHBOARD / CASHIER API (PROTECTED) ----------------------

// 1. Get Tables & Status
app.get('/api/tables', requireAuth, (req, res) => {
  const tables = db.getTables();
  const activeSessions = db.getAllActiveSessions();

  const result = tables.map(table => {
    const active = activeSessions.find(s => s.tableId === table.id);
    return {
      ...table,
      status: active ? 'active' : 'idle',
      activeSession: active || null
    };
  });

  res.json({ status: 'success', data: result });
});

// 2. Create Table Session & Generate QR
app.post('/api/sessions/create', requireAuth, async (req, res) => {
  try {
    const { tableId, durationMinutes, customerName } = req.body;
    if (!tableId || !durationMinutes) {
      return res.status(400).json({ error: 'tableId and durationMinutes are required' });
    }

    const session = sessionManager.createSession(Number(tableId), Number(durationMinutes), customerName);
    
    // Construct local player URL (Next.js route /play?token=...)
    const host = req.get('host');
    const protocol = req.protocol;
    const playerUrl = `${protocol}://${host}/play?token=${session.token}`;
    const qrDataUrl = await QRCode.toDataURL(playerUrl);

    // Broadcast ke Layar Kedua Kasir (Customer Facing Display)
    broadcastToCustomerDisplays({
      type: 'NEW_SESSION_QR',
      session: {
        ...session,
        playerUrl,
        qrDataUrl
      }
    });

    res.json({
      status: 'success',
      session,
      playerUrl,
      qrDataUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Extend Session
app.post('/api/sessions/:sessionId/extend', requireAuth, (req, res) => {
  const { sessionId } = req.params;
  const { additionalMinutes } = req.body;
  const updated = sessionManager.extendSession(sessionId, Number(additionalMinutes) || 30);
  if (!updated) return res.status(404).json({ error: 'Session not found' });
  res.json({ status: 'success', session: updated });
});

// 4. Terminate Session
app.post('/api/sessions/:sessionId/terminate', requireAuth, (req, res) => {
  const { sessionId } = req.params;
  const ok = sessionManager.terminateSession(sessionId);
  if (!ok) return res.status(404).json({ error: 'Session not found' });

  // Notifikasi terminate ke Customer Display
  broadcastToCustomerDisplays({
    type: 'SESSION_TERMINATED',
    sessionId
  });

  res.json({ status: 'success', message: 'Session terminated' });
});

// 5. Get F&B Orders (Cashier View)
app.get('/api/cashier/orders', requireAuth, (req, res) => {
  res.json({ status: 'success', orders: db.getOrders() });
});

// 6. Update F&B Order Status
app.patch('/api/cashier/orders/:orderId/status', requireAuth, (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const updated = db.updateOrderStatus(orderId, status);
  if (!updated) return res.status(404).json({ error: 'Order not found' });
  res.json({ status: 'success', order: updated });
});

// ---------------------- PLAYER PUBLIC API (TOKEN GUARDED) ----------------------

// 1. Validate Token & Get Stream Info
app.get('/api/player/session-info', (req, res) => {
  const token = req.query.token;
  if (!token) return res.status(401).json({ error: 'Token missing' });

  const session = sessionManager.verifyToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }

  res.json({
    status: 'success',
    tableId: session.tableId,
    tableName: session.tableName,
    remainingSeconds: session.remainingSeconds,
    whepUrl: `${MEDIAMTX_WHEP_BASE}/${session.streamPath}/whep`
  });
});

// 2. Request 30-Second Highlight Clip
app.post('/api/player/clip-30s', async (req, res) => {
  try {
    const { token } = req.body;
    const session = sessionManager.verifyToken(token);
    if (!session) {
      return res.status(401).json({ error: 'Token expired or invalid' });
    }

    const clipResult = await clipper.extractLast30Seconds(session.tableId);
    res.json({
      status: 'success',
      ...clipResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Submit In-Table F&B Order
app.post('/api/player/order', (req, res) => {
  const { token, items, notes } = req.body;
  const session = sessionManager.verifyToken(token);
  if (!session) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }

  const order = {
    id: `ORD_${Date.now()}`,
    tableId: session.tableId,
    tableName: session.tableName,
    customerName: session.customerName || 'Guest',
    items: items || [],
    notes: notes || '',
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  db.addOrder(order);

  // Broadcast to cashier via WebSocket
  broadcastToAllCashiers({
    type: 'NEW_ORDER',
    order
  });

  res.json({ status: 'success', order });
});

// 4. Get Menu Catalog (Public for Player)
app.get('/api/player/menu', (req, res) => {
  res.json({ status: 'success', menu: db.getMenuCatalog() });
});

// ---------------------- WEBSOCKET REALTIME ----------------------

const cashierClients = new Set();
const customerDisplayClients = new Set();

function broadcastToAllCashiers(data) {
  const payload = JSON.stringify(data);
  for (const client of cashierClients) {
    if (client.readyState === 1) client.send(payload);
  }
}

function broadcastToCustomerDisplays(data) {
  const payload = JSON.stringify(data);
  for (const client of customerDisplayClients) {
    if (client.readyState === 1) client.send(payload);
  }
}

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const role = url.searchParams.get('role');
  const token = url.searchParams.get('token');

  if (role === 'cashier') {
    cashierClients.add(ws);
    ws.on('close', () => cashierClients.delete(ws));
    return;
  }

  if (role === 'customer_display') {
    customerDisplayClients.add(ws);
    ws.on('close', () => customerDisplayClients.delete(ws));
    return;
  }

  // Player connection
  if (token) {
    const session = sessionManager.verifyToken(token);
    if (session) {
      sessionManager.registerWsClient(session.sessionId, ws);
      ws.send(JSON.stringify({
        type: 'CONNECTED',
        remainingSeconds: session.remainingSeconds
      }));
    } else {
      ws.send(JSON.stringify({ type: 'SESSION_EXPIRED', message: 'Token invalid' }));
      ws.close();
    }
  }
});

server.listen(PORT, () => {
  console.log(`[BilliardStream Hub] Secure Edge Server running on port ${PORT}`);
});
