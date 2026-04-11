// Prevent Node 18 built-in fetch (undici) from loading its WASM on constrained hosting
delete globalThis.fetch;

require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Serve built React frontend from backend/public/
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/customers',    require('./routes/customers'));
app.use('/api/inventory',    require('./routes/inventory'));
app.use('/api/consignors',   require('./routes/consignors'));
app.use('/api/sales',        require('./routes/sales'));
app.use('/api/payments',     require('./routes/payments'));
app.use('/api/gift-cards',   require('./routes/giftCards'));
app.use('/api/returns',      require('./routes/returns'));
app.use('/api/timeclock',    require('./routes/timeclock'));
app.use('/api/tasks',        require('./routes/tasks'));
app.use('/api/schedules',    require('./routes/schedules'));
app.use('/api/activity',     require('./routes/activity'));
app.use('/api/work-orders',  require('./routes/workOrders'));
app.use('/api/trades',       require('./routes/trades'));
app.use('/api/imports',      require('./routes/imports'));
app.use('/api/events',       require('./routes/events'));
app.use('/api/media',        require('./routes/media'));
app.use('/api/online-store', require('./routes/onlineStore'));
app.use('/api/portal',       require('./routes/consignorPortal'));
app.use('/api/reports',      require('./routes/reports'));

// Lazy-load heavy routes (avoids startup memory spike on cPanel shared hosting)
app.use('/api/marketing', (req, res, next) => require('./routes/marketing')(req, res, next));
app.use('/api/analytics',  (req, res, next) => require('./routes/analytics')(req, res, next));

// React Router fallback — serve index.html for all non-API paths
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`bjnhPOS running on port ${PORT}`));
