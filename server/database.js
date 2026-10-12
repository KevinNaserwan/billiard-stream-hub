const fs = require('fs');
const path = require('path');

// In-memory persistent table state and session store
const tablesPath = path.join(__dirname, '../config/tables.sample.json');
let tables = [];

try {
  const data = fs.readFileSync(tablesPath, 'utf8');
  tables = JSON.parse(data);
} catch (e) {
  tables = [
    { id: 1, name: "Table 01", streamPath: "table1" },
    { id: 2, name: "Table 02", streamPath: "table2" }
  ];
}

// In-memory active sessions
const activeSessions = new Map();
// F&B Orders store
const orders = [];

module.exports = {
  getTables: () => tables,
  getTableById: (id) => tables.find(t => t.id === Number(id)),
  
  createSession: (sessionData) => {
    activeSessions.set(sessionData.sessionId, sessionData);
    return sessionData;
  },

  getSession: (sessionId) => {
    return activeSessions.get(sessionId);
  },

  getAllActiveSessions: () => {
    return Array.from(activeSessions.values());
  },

  deleteSession: (sessionId) => {
    return activeSessions.delete(sessionId);
  },

  addOrder: (order) => {
    orders.unshift(order);
    return order;
  },

  getOrders: () => orders
};
