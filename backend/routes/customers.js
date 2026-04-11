const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// GET /api/customers
router.get('/', auth, async (req, res) => {
  const { search } = req.query;
  try {
    let sql = 'SELECT * FROM customers';
    let params = [];
    if (search) {
      sql += ' WHERE name LIKE $1 OR email LIKE $1 OR phone LIKE $1';
      params = [`%${search}%`];
    }
    sql += ' ORDER BY name';
    const result = await db.query(sql, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id with full purchase history
router.get('/:id', auth, async (req, res) => {
  try {
    const customerRes = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    if (\!customerRes.rows[0]) return res.status(404).json({ error: 'Customer not found' });

    const salesRes = await db.query(
      `SELECT s.*, u.name as staff_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       WHERE s.customer_id = $1
       ORDER BY s.created_at DESC`,
      [req.params.id]
    );

    // Attach items to each sale separately (avoids MySQL GROUP BY / JSON_ARRAYAGG issues)
    const sales = await Promise.all(salesRes.rows.map(async (sale) => {
      const itemsRes = await db.query(
        `SELECT si.*, i.title, i.barcode
         FROM sale_items si
         LEFT JOIN inventory i ON i.id = si.inventory_id
         WHERE si.sale_id = $1`,
        [sale.id]
      );
      return { ...sale, items: itemsRes.rows };
    }));

    const loyalty = await db.query(
      'SELECT * FROM loyalty_transactions WHERE customer_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json({ ...customerRes.rows[0], sales, loyalty: loyalty.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/customers
router.post('/', auth, async (req, res) => {
  const { name, email, phone, notes } = req.body;
  try {
    const result = await db.query(
      'INSERT INTO customers (name, email, phone, notes) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, email || null, phone || null, notes || null]
    );
    await log(req.user.id, 'create_customer', 'customers', result.rows[0].id, { name });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/customers/:id
router.patch('/:id', auth, async (req, res) => {
  const { name, email, phone, notes, vip } = req.body;
  try {
    await db.query(
      'UPDATE customers SET name=$1, email=$2, phone=$3, notes=$4, vip=$5 WHERE id=$6',
      [name, email || null, phone || null, notes || null, vip ? 1 : 0, req.params.id]
    );
    const result = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
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
    await db.query(
      'UPDATE customers SET store_credit_balance = store_credit_balance + $1 WHERE id = $2',
      [amount, req.params.id]
    );
    const result = await db.query('SELECT * FROM customers WHERE id = $1', [req.params.id]);
    await log(req.user.id, 'adjust_store_credit', 'customers', req.params.id, { amount, reason });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
