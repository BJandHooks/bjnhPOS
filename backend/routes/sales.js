const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// GET /api/sales
router.get('/', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { from, to, customer_id } = req.query;
  try {
    let conditions = ['1=1'];
    let params = [];
    let i = 1;
    if (from) { conditions.push(`s.created_at >= $${i}`); params.push(from); i++; }
    if (to) { conditions.push(`s.created_at <= $${i}`); params.push(to); i++; }
    if (customer_id) { conditions.push(`s.customer_id = $${i}`); params.push(customer_id); i++; }

    const result = await db.query(
      `SELECT s.*, u.name as staff_name, cu.name as customer_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN customers cu ON cu.id = s.customer_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sales/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const sale = await db.query(
      `SELECT s.*, u.name as staff_name, cu.name as customer_name
       FROM sales s
       LEFT JOIN users u ON u.id = s.user_id
       LEFT JOIN customers cu ON cu.id = s.customer_id
       WHERE s.id = $1`,
      [req.params.id]
    );
    const items = await db.query(
      `SELECT si.*, i.title, i.barcode
       FROM sale_items si
       LEFT JOIN inventory i ON i.id = si.inventory_id
       WHERE si.sale_id = $1`,
      [req.params.id]
    );
    const payments = await db.query(
      'SELECT * FROM payments WHERE sale_id = $1',
      [req.params.id]
    );
    res.json({ ...sale.rows[0], items: items.rows, payments: payments.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sales — process a sale
router.post('/', auth, async (req, res) => {
  const { customer_id, items, payments: paymentData, event_id } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Calculate total
    const total = items.reduce((sum, item) => sum + parseFloat(item.price_at_sale), 0);

    // Create the sale
    const saleResult = await client.query(
      `INSERT INTO sales (customer_id, user_id, event_id, total)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [customer_id || null, req.user.id, event_id || null, total]
    );
    const sale = saleResult.rows[0];

    // Process each item
    for (const item of items) {
      let consignor_cut = null;

      if (item.consignor_id) {
        // Get consignor split
        const consignorResult = await client.query(
          'SELECT split_percentage FROM consignors WHERE id = $1',
          [item.consignor_id]
        );
        const split = consignorResult.rows[0]?.split_percentage || 50;
        consignor_cut = (item.price_at_sale * split) / 100;

        // Add to consignor balance
        await client.query(
          'UPDATE consignors SET balance = balance + $1 WHERE id = $2',
          [consignor_cut, item.consignor_id]
        );
      }

      // Insert sale item
      await client.query(
        `INSERT INTO sale_items
         (sale_id, inventory_id, price_at_sale, consignor_id, consignor_cut, item_type)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [sale.id, item.inventory_id || null, item.price_at_sale,
         item.consignor_id || null, consignor_cut, item.item_type || 'retail']
      );

      // Mark inventory as sold
      if (item.inventory_id) {
        await client.query(
          "UPDATE inventory SET status = 'sold' WHERE id = $1",
          [item.inventory_id]
        );
      }
    }

    // Process payments
    for (const payment of paymentData) {
      await client.query(
        'INSERT INTO payments (sale_id, method, amount, stripe_payment_id) VALUES ($1, $2, $3, $4)',
        [sale.id, payment.method, payment.amount, payment.stripe_payment_id || null]
      );

      // Deduct store credit if used
      if (payment.method === 'store_credit' && customer_id) {
        await client.query(
          'UPDATE customers SET store_credit_balance = store_credit_balance - $1 WHERE id = $2',
          [payment.amount, customer_id]
        );
      }

      // Deduct gift card balance if used
      if (payment.method === 'gift_card' && payment.gift_card_code) {
        await client.query(
          'UPDATE gift_cards SET current_balance = current_balance - $1 WHERE code = $2',
          [payment.amount, payment.gift_card_code]
        );
      }
    }

    // Add loyalty points (1 point per dollar)
    if (customer_id) {
      const points = Math.floor(total);
      await client.query(
        'UPDATE customers SET loyalty_points = loyalty_points + $1 WHERE id = $2',
        [points, customer_id]
      );
      await client.query(
        'INSERT INTO loyalty_transactions (customer_id, sale_id, points_change, reason) VALUES ($1, $2, $3, $4)',
        [customer_id, sale.id, points, 'purchase']
      );
    }

    await client.query('COMMIT');
    await log(req.user.id, 'create_sale', 'sales', sale.id, { total, item_count: items.length });
    res.status(201).json({ sale_id: sale.id, total });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// POST /api/sales/bulk-import — import historical sales
router.post('/bulk-import', auth, requireRole('owner'), async (req, res) => {
  const { sales } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    let count = 0;
    for (const s of sales) {
      await client.query(
        `INSERT INTO sales (customer_id, user_id, total, status, created_at)
         VALUES ($1, $2, $3, $4, $5)`,
        [s.customer_id || null, s.user_id || null, s.total, s.status || 'complete', s.created_at || new Date()]
      );
      count++;
    }
    await client.query('COMMIT');
    await log(req.user.id, 'bulk_import_sales', 'sales', null, { count });
    res.status(201).json({ imported: count });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
