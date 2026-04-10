const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/reports/sales-summary
// Query params: from, to, group_by (hour|day_of_week|day|month|quarter|year)
router.get('/sales-summary', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { from, to, group_by = 'day' } = req.query;
  try {
    let dateTrunc;
    switch (group_by) {
      case 'hour':        dateTrunc = "to_char(created_at, 'HH24:00')"; break;
      case 'day_of_week': dateTrunc = "to_char(created_at, 'Day')"; break;
      case 'month':       dateTrunc = "to_char(created_at, 'YYYY-MM')"; break;
      case 'quarter':     dateTrunc = "to_char(created_at, 'YYYY-\"Q\"Q')"; break;
      case 'year':        dateTrunc = "to_char(created_at, 'YYYY')"; break;
      default:            dateTrunc = "to_char(created_at, 'YYYY-MM-DD')";
    }
    const result = await db.query(
      `SELECT ${dateTrunc} as period,
              COUNT(*) as transaction_count,
              SUM(total) as total_revenue,
              AVG(total) as avg_sale
       FROM sales
       WHERE ($1::timestamp IS NULL OR created_at >= $1)
         AND ($2::timestamp IS NULL OR created_at <= $2)
         AND status = 'complete'
       GROUP BY period
       ORDER BY period`,
      [from || null, to || null]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/inventory
router.get('/inventory', auth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    const summary = await db.query(
      `SELECT status, COUNT(*) as count, SUM(price) as total_value
       FROM inventory GROUP BY status`
    );
    const by_category = await db.query(
      `SELECT category, COUNT(*) as count, SUM(price) as total_value
       FROM inventory WHERE status = 'active'
       GROUP BY category ORDER BY count DESC`
    );
    const expiring_soon = await db.query(
      `SELECT i.*, c.name as consignor_name
       FROM inventory i
       LEFT JOIN consignors c ON c.id = i.consignor_id
       WHERE i.status = 'active'
         AND i.expiration_date IS NOT NULL
         AND i.expiration_date <= NOW() + INTERVAL '30 days'
       ORDER BY i.expiration_date ASC`
    );
    res.json({ summary: summary.rows, by_category: by_category.rows, expiring_soon: expiring_soon.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/consignors
router.get('/consignors', auth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT c.id, c.name, c.balance, c.split_percentage, c.booth_fee_monthly,
              COUNT(i.id) FILTER (WHERE i.status = 'active') as active_items,
              COUNT(i.id) FILTER (WHERE i.status = 'sold') as sold_items,
              COALESCE(SUM(si.price_at_sale) FILTER (WHERE i.status = 'sold'), 0) as total_sold_value,
              COALESCE(SUM(cp.amount), 0) as total_paid_out
       FROM consignors c
       LEFT JOIN inventory i ON i.consignor_id = c.id
       LEFT JOIN sale_items si ON si.consignor_id = c.id
       LEFT JOIN consignor_payouts cp ON cp.consignor_id = c.id
       GROUP BY c.id, c.name, c.balance, c.split_percentage, c.booth_fee_monthly
       ORDER BY c.name`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/best-sellers
router.get('/best-sellers', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { from, to, limit = 20 } = req.query;
  try {
    const result = await db.query(
      `SELECT i.title, i.category, i.condition,
              COUNT(si.id) as times_sold,
              SUM(si.price_at_sale) as total_revenue
       FROM sale_items si
       JOIN inventory i ON i.id = si.inventory_id
       JOIN sales s ON s.id = si.sale_id
       WHERE ($1::timestamp IS NULL OR s.created_at >= $1)
         AND ($2::timestamp IS NULL OR s.created_at <= $2)
       GROUP BY i.id, i.title, i.category, i.condition
       ORDER BY total_revenue DESC
       LIMIT $3`,
      [from || null, to || null, limit]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/staff
router.get('/staff', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { from, to } = req.query;
  try {
    const result = await db.query(
      `SELECT u.id, u.name, u.role,
              COUNT(s.id) as sales_count,
              COALESCE(SUM(s.total), 0) as total_revenue,
              COALESCE(SUM(tc.total_minutes), 0) as total_minutes_worked
       FROM users u
       LEFT JOIN sales s ON s.user_id = u.id
         AND ($1::timestamp IS NULL OR s.created_at >= $1)
         AND ($2::timestamp IS NULL OR s.created_at <= $2)
       LEFT JOIN time_clock tc ON tc.user_id = u.id
         AND ($1::timestamp IS NULL OR tc.clocked_in_at >= $1)
         AND ($2::timestamp IS NULL OR tc.clocked_in_at <= $2)
       WHERE u.active = true
       GROUP BY u.id, u.name, u.role
       ORDER BY total_revenue DESC`,
      [from || null, to || null]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/reports/payment-methods
router.get('/payment-methods', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { from, to } = req.query;
  try {
    const result = await db.query(
      `SELECT p.method, COUNT(*) as count, SUM(p.amount) as total
       FROM payments p
       JOIN sales s ON s.id = p.sale_id
       WHERE ($1::timestamp IS NULL OR s.created_at >= $1)
         AND ($2::timestamp IS NULL OR s.created_at <= $2)
       GROUP BY p.method`,
      [from || null, to || null]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
