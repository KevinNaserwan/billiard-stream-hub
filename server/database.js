const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// In-memory persistent table state and session store
const tablesPath = path.join(__dirname, '../config/tables.sample.json');
let tables = [];

try {
  const data = fs.readFileSync(tablesPath, 'utf8');
  tables = JSON.parse(data);
} catch (e) {
  tables = [
    { id: 1, name: "Table 01 - Standard Arena", streamPath: "table1", rtspUrl: "rtsp://localhost:8554/table1" },
    { id: 2, name: "Table 02 - Standard Arena", streamPath: "table2", rtspUrl: "rtsp://localhost:8554/table2" }
  ];
}

// In-memory active sessions
const activeSessions = new Map();
// F&B Orders store
const orders = [];

// Pre-seeded Admin / Cashier Users (Password: admin123 & kasir123)
// Menggunakan SHA256 hash salt untuk keamanan autentikasi
function hashPassword(password, salt = 'billiard_salt_2026') {
  return crypto.createHmac('sha256', salt).update(password).digest('hex');
}

const users = [
  {
    id: 1,
    username: 'admin',
    passwordHash: hashPassword('admin123'),
    fullName: 'Chief Operator Admin',
    role: 'superadmin'
  },
  {
    id: 2,
    username: 'kasir',
    passwordHash: hashPassword('kasir123'),
    fullName: 'Kasir Frontdesk',
    role: 'cashier'
  }
];

// F&B Menu Catalog
const menuCatalog = [
  { id: 1, category: 'Beverage', name: 'Iced Americano', price: 25000, stock: 50 },
  { id: 2, category: 'Beverage', name: 'Caramel Macchiato', price: 32000, stock: 40 },
  { id: 3, category: 'Beverage', name: 'Mineral Water 600ml', price: 8000, stock: 100 },
  { id: 4, category: 'Food', name: 'French Fries Platter', price: 28000, stock: 35 },
  { id: 5, category: 'Food', name: 'Crispy Chicken Wings (6pcs)', price: 38000, stock: 25 },
  { id: 6, category: 'Food', name: 'Billiard Club Sandwich', price: 35000, stock: 20 }
];

module.exports = {
  // Users & Auth
  validateUser: (username, password) => {
    const user = users.find(u => u.username === username);
    if (!user) return null;
    const incomingHash = hashPassword(password);
    if (user.passwordHash !== incomingHash) return null;
    return {
      id: user.id,
      username: user.username,
      fullName: user.fullName,
      role: user.role
    };
  },

  // Tables
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

  // F&B Catalog & Orders
  getMenuCatalog: () => menuCatalog,

  addOrder: (order) => {
    orders.unshift(order);
    return order;
  },

  getOrders: () => orders,

  updateOrderStatus: (orderId, newStatus) => {
    const order = orders.find(o => o.id === orderId);
    if (order) {
      order.status = newStatus;
      return order;
    }
    return null;
  }
};
