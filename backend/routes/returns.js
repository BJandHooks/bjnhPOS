const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// POST /api/returns — process a return or exchange
router.post('/', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { original_sale_id, customer_id, items, refund_method, refund_amount, reason } = req.body;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO returns (original_sale_id, user_id, customer_id, reason, refund_method, refund_amount)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [original_sale_id, req.user.id, customer_id || null, reason, refund_method, refund_amount]
    );

    // Return items to active inventory
    for (const item_id of items) {
      await client.query("UPDATE inventory SET status = 'active' WHERE id = $1", [item_id]);
      // Reverse consignor balance if consigned item
      const item = await client.query(
        'SELECT * FROM sale_items WHERE inventory_id = $1 AND sale_id = $2',
        [item_id, original_sale_id]
      );
      if (item.rows[0]?.consignor_id && item.rows[0]?.consignor_cut) {
        await client.query(
          'UPDATE consignors SET balance = balance - $1 WHERE id = $2',
          [item.rows[0].consignor_cut, item.rows[0].consignor_id]
        );
      }
    }

    // Apply refund
    if (refund_method === 'store_credit' && customer_id) {
      await client.query(
        'UPDATE customers SET store_credit_balance = store_credit_balance + $1 WHERE id = $2',
        [refund_amount, customer_id]
      );
    }

    await client.query('COMMIT');
    await log(req.user.id, 'process_return', 'returns', result.rows[0].id, { refund_amount, refund_method });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
