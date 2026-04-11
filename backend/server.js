require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
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
app.use('/api/marketing',    require('./routes/marketing'));
app.use('/api/online-store', require('./routes/onlineStore'));
app.use('/api/portal',       require('./routes/consignorPortal'));
app.use('/api/reports',      require('./routes/reports'));
app.use('/api/analytics',    require('./routes/analytics'));
app.use('/api/dashboard',    require('./routes/dashboard'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', ts: new Date() }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`bjnhPOS API running on port ${PORT} [${process.env.NODE_ENV || 'development'}]`);
});

module.exports = app;
