const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
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

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ---------------------- CASHIER API ----------------------

// 1. Get List of Tables
app.get('/api/tables', (req, res) => {
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

// 2. Create New Table Session & Generate QR
app.post('/api/sessions/create', async (req, res) => {
  try {
    const { tableId, durationMinutes, customerName } = req.body;
    if (!tableId || !durationMinutes) {
      return res.status(400).json({ error: 'tableId and durationMinutes are required' });
    }

    const session = sessionManager.createSession(Number(tableId), Number(durationMinutes), customerName);
    
    // Construct local player URL
    const host = req.get('host');
    const protocol = req.protocol;
    const playerUrl = `${protocol}://${host}/player.html?token=${session.token}`;
    const qrDataUrl = await QRCode.toDataURL(playerUrl);

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
app.post('/api/sessions/:sessionId/extend', (req, res) => {
  const { sessionId } = req.params;
  const { additionalMinutes } = req.body;
  const updated = sessionManager.extendSession(sessionId, Number(additionalMinutes) || 30);
  if (!updated) return res.status(404).json({ error: 'Session not found' });
  res.json({ status: 'success', session: updated });
});

// 4. Terminate Session
app.post('/api/sessions/:sessionId/terminate', (req, res) => {
  const { sessionId } = req.params;
  const ok = sessionManager.terminateSession(sessionId);
  if (!ok) return res.status(404).json({ error: 'Session not found' });
  res.json({ status: 'success', message: 'Session terminated' });
});

// ---------------------- PLAYER API ----------------------

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

// 4. Get F&B Orders (Cashier View)
app.get('/api/cashier/orders', (req, res) => {
  res.json({ status: 'success', orders: db.getOrders() });
});

// ---------------------- WEBSOCKET REALTIME ----------------------

const cashierClients = new Set();

function broadcastToAllCashiers(data) {
  const payload = JSON.stringify(data);
  for (const client of cashierClients) {
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
  console.log(`[BilliardStream Hub] Edge Server running on http://localhost:${PORT}`);
  console.log(`- Cashier Portal: http://localhost:${PORT}/cashier.html`);
  console.log(`- Guest Player:   http://localhost:${PORT}/player.html`);
});
