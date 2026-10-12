const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const db = require('./database');

const JWT_SECRET = process.env.JWT_SECRET || 'billiard_edge_secret_key_2026';

class SessionManager {
  constructor() {
    this.wsClients = new Map(); // sessionId -> Set of WebSocket clients
    this.intervalId = setInterval(() => this.tick(), 1000);
  }

  createSession(tableId, durationMinutes, customerName = 'Guest') {
    const table = db.getTableById(tableId);
    if (!table) throw new Error('Table not found');

    const sessionId = `sess_${crypto.randomBytes(4).toString('hex')}`;
    const startTime = Date.now();
    const durationSeconds = durationMinutes * 60;
    const expiresAt = startTime + (durationSeconds * 1000);

    const tokenPayload = {
      sessionId,
      tableId: table.id,
      tableName: table.name,
      streamPath: table.streamPath,
      exp: Math.floor(expiresAt / 1000)
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET);

    const session = {
      sessionId,
      tableId: table.id,
      tableName: table.name,
      customerName,
      startTime,
      durationMinutes,
      expiresAt,
      token,
      status: 'active'
    };

    return db.createSession(session);
  }

  verifyToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const session = db.getSession(decoded.sessionId);
      if (!session) return null;
      if (Date.now() >= session.expiresAt) {
        return null;
      }
      return { ...decoded, remainingSeconds: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000)) };
    } catch (e) {
      return null;
    }
  }

  extendSession(sessionId, additionalMinutes) {
    const session = db.getSession(sessionId);
    if (!session) return null;

    session.expiresAt += (additionalMinutes * 60 * 1000);
    session.durationMinutes += additionalMinutes;
    
    // Broadcast update to connected table player
    this.broadcastToSession(sessionId, {
      type: 'SESSION_EXTENDED',
      remainingSeconds: Math.max(0, Math.floor((session.expiresAt - Date.now()) / 1000))
    });

    return session;
  }

  terminateSession(sessionId) {
    const session = db.getSession(sessionId);
    if (!session) return false;

    session.status = 'terminated';
    session.expiresAt = Date.now();

    this.broadcastToSession(sessionId, {
      type: 'SESSION_EXPIRED',
      message: 'Waktu bermain Anda telah habis atau sesi telah diakhiri oleh kasir.'
    });

    db.deleteSession(sessionId);
    return true;
  }

  registerWsClient(sessionId, ws) {
    if (!this.wsClients.has(sessionId)) {
      this.wsClients.set(sessionId, new Set());
    }
    this.wsClients.get(sessionId).add(ws);

    ws.on('close', () => {
      const clientSet = this.wsClients.get(sessionId);
      if (clientSet) {
        clientSet.delete(ws);
        if (clientSet.size === 0) this.wsClients.delete(sessionId);
      }
    });
  }

  broadcastToSession(sessionId, data) {
    const clients = this.wsClients.get(sessionId);
    if (clients) {
      const payload = JSON.stringify(data);
      for (const client of clients) {
        if (client.readyState === 1) { // OPEN
          client.send(payload);
        }
      }
    }
  }

  tick() {
    const now = Date.now();
    const sessions = db.getAllActiveSessions();

    for (const session of sessions) {
      const remainingSec = Math.floor((session.expiresAt - now) / 1000);
      if (remainingSec <= 0) {
        this.terminateSession(session.sessionId);
      } else {
        // Send heartbeat remaining time
        this.broadcastToSession(session.sessionId, {
          type: 'TIME_UPDATE',
          remainingSeconds: remainingSec
        });
      }
    }
  }
}

module.exports = new SessionManager();
