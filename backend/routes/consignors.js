const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// GET /api/consignors
router.get('/', auth, async (req, res) => {
  const { search } = req.query;
  try {
    let query = `SELECT c.*, cu.name as customer_name
                 FROM consignors c
                 LEFT JOIN customers cu ON cu.id = c.customer_id`;
    let params = [];
    if (search) {
      query += ' WHERE c.name ILIKE $1 OR c.email ILIKE $1';
      params = [`%${search}%`];
    }
    query += ' ORDER BY c.name';
    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/consignors/:id with items and payout history
router.get('/:id', auth, async (req, res) => {
  try {
    const consignor = await db.query('SELECT * FROM consignors WHERE id = $1', [req.params.id]);
    const items = await db.query(
      'SELECT * FROM inventory WHERE consignor_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    const payouts = await db.query(
      'SELECT * FROM consignor_payouts WHERE consignor_id = $1 ORDER BY created_at DESC',
      [req.params.id]
    );
    const booth = await db.query(
      'SELECT * FROM booth_rental_charges WHERE consignor_id = $1 ORDER BY period_start DESC',
      [req.params.id]
    );
    res.json({ ...consignor.rows[0], items: items.rows, payouts: payouts.rows, booth_charges: booth.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/consignors
router.post('/', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { name, email, phone, customer_id, split_percentage, booth_fee_monthly, contract_start, payout_schedule, minimum_payout_balance } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO consignors
       (name, email, phone, customer_id, split_percentage, booth_fee_monthly, contract_start, payout_schedule, minimum_payout_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [name, email, phone, customer_id || null, split_percentage, booth_fee_monthly || 0, contract_start || null, payout_schedule, minimum_payout_balance || 0]
    );
    await log(req.user.id, 'create_consignor', 'consignors', result.rows[0].id, { name });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/consignors/:id
router.patch('/:id', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { name, email, phone, split_percentage, booth_fee_monthly, payout_schedule, minimum_payout_balance, active } = req.body;
  try {
    const result = await db.query(
      `UPDATE consignors SET name=$1, email=$2, phone=$3, split_percentage=$4,
       booth_fee_monthly=$5, payout_schedule=$6, minimum_payout_balance=$7, active=$8
       WHERE id=$9 RETURNING *`,
      [name, email, phone, split_percentage, booth_fee_monthly, payout_schedule, minimum_payout_balance, active, req.params.id]
    );
    await log(req.user.id, 'update_consignor', 'consignors', req.params.id, req.body);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/consignors/bulk-import
router.post('/bulk-import', auth, requireRole('owner'), async (req, res) => {
  const { consignors } = req.body;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const imported = [];
    for (const c of consignors) {
      const result = await client.query(
        `INSERT INTO consignors (name, email, phone, split_percentage, booth_fee_monthly, contract_start, payout_schedule, minimum_payout_balance)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [c.name, c.email, c.phone, c.split_percentage || 50, c.booth_fee_monthly || 0, c.contract_start || null, c.payout_schedule || 'monthly', c.minimum_payout_balance || 0]
      );
      imported.push(result.rows[0]);
    }
    await client.query('COMMIT');
    await log(req.user.id, 'bulk_import_consignors', 'consignors', null, { count: imported.length });
    res.status(201).json({ imported: imported.length });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/consignors/:id/payout — process a payout
router.post('/:id/payout', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { method, triggered_by } = req.body;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const consignor = await client.query('SELECT * FROM consignors WHERE id = $1', [req.params.id]);
    const c = consignor.rows[0];
    if (c.balance <= 0) return res.status(400).json({ error: 'No balance to pay out' });

    const payout = await client.query(
      `INSERT INTO consignor_payouts (consignor_id, user_id, amount, method, triggered_by)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.params.id, req.user.id, c.balance, method, triggered_by || 'schedule']
    );

    if (method === 'store_credit') {
      await client.query(
        'UPDATE customers SET store_credit_balance = store_credit_balance + $1 WHERE id = $2',
        [c.balance, c.customer_id]
      );
    }

    await client.query('UPDATE consignors SET balance = 0 WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    await log(req.user.id, 'consignor_payout', 'consignors', req.params.id, { amount: c.balance, method });
    res.json(payout.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
