const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// GET /api/customers
router.get('/', auth, async (req, res) => {
  const { search } = req.query;
  try {
    let query = 'SELECT * FROM customers';
    let params = [];
    if (search) {
      query += ' WHERE name ILIKE $1 OR email ILIKE $1 OR phone ILIKE $1';
      params = [`%${search}%`];
    }
    query += ' ORDER BY name';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id with full purchase history
router.get('/:id', auth, async (req, res) => {
  try {
    const customer = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    const sales = await db.query(
      `SELECT s.*, json_agg(si.*) as items
       FROM sales s
       LEFT JOIN sale_items si ON si.sale_id = s.id
       WHERE s.customer_id = $1
       GROUP BY s.id
       ORDER BY s.created_at DESC`,
      [req.params.id]
    );
    const loyalty = await db.query(
      'SELECT * FROM loyalty_transactions WHERE customer_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ ...customer.rows[0], sales: sales.rows, loyalty: loyalty.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers
router.post('/', auth, async (req, res) => {
  const { name, email, phone } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3) RETURNING *',
      [name, email, phone]
    );
    await log(req.user.id, 'create_customer', 'customers', result.rows[0].id, { name });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/customers/:id
router.patch('/:id', auth, async (req, res) => {
  const { name, email, phone } = req.body;
  try {
    const result = await db.query(
      'UPDATE customers SET name=$1, email=$2, phone=$3 WHERE id=$4 RETURNING *',
      [name, email, phone, req.params.id]
    );
    await log(req.user.id, 'update_customer', 'customers', req.params.id, req.body);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers/:id/store-credit
router.post('/:id/store-credit', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { amount, reason } = req.body;
  try {
    const result = await db.query(
      'UPDATE customers SET store_credit_balance = store_credit_balance + $1 WHERE id = $2 RETURNING *',
      [amount, req.params.id]
    );
    await log(req.user.id, 'adjust_store_credit', 'customers', req.params.id, { amount, reason });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
