const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// GET /api/inventory
router.get('/', auth, async (req, res) => {
  const { search, status, category, consignor_id } = req.query;
  try {
    let conditions = ['1=1'];
    let params = [];
    let i = 1;

    if (search) {
      conditions.push(`(i.title ILIKE $${i} OR i.barcode ILIKE $${i})`);
      params.push(`%${search}%`); i++;
    }
    if (status) { conditions.push(`i.status = $${i}`); params.push(status); i++; }
    if (category) { conditions.push(`i.category = $${i}`); params.push(category); i++; }
    if (consignor_id) { conditions.push(`i.consignor_id = $${i}`); params.push(consignor_id); i++; }

    const result = await db.query(
      `SELECT i.*, c.name as consignor_name
       FROM inventory i
       LEFT JOIN consignors c ON c.id = i.consignor_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY i.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT i.*, c.name as consignor_name
       FROM inventory i
       LEFT JOIN consignors c ON c.id = i.consignor_id
       WHERE i.id = $1`,
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/inventory/barcode/:barcode
router.get('/barcode/:barcode', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT i.*, c.name as consignor_name
       FROM inventory i
       LEFT JOIN consignors c ON c.id = i.consignor_id
       WHERE i.barcode = $1 AND i.status = 'active'`,
      [req.params.barcode]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Item not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory
router.post('/', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { title, description, condition, category, price, original_price, consignor_id, expiration_date, barcode } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO inventory
       (title, description, condition, category, price, original_price, consignor_id, expiration_date, barcode)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [title, description, condition, category, price, original_price || price, consignor_id || null, expiration_date || null, barcode || null]
    );
    await log(req.user.id, 'create_item', 'inventory', result.rows[0].id, { title, price });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/inventory/:id
router.patch('/:id', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { title, description, condition, category, price, status, expiration_date, barcode } = req.body;
  try {
    const result = await db.query(
      `UPDATE inventory SET title=$1, description=$2, condition=$3, category=$4,
       price=$5, status=$6, expiration_date=$7, barcode=$8
       WHERE id=$9 RETURNING *`,
      [title, description, condition, category, price, status, expiration_date, barcode, req.params.id]
    );
    await log(req.user.id, 'update_item', 'inventory', req.params.id, req.body);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/inventory/bulk-import
router.post('/bulk-import', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { items } = req.body;
  const client = await db.getClient();
  try {
    await client.query('BEGIN');
    const imported = [];
    for (const item of items) {
      const result = await client.query(
        `INSERT INTO inventory
         (title, description, condition, category, price, original_price, consignor_id, expiration_date, barcode)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON DUPLICATE KEY UPDATE barcode=barcode RETURNING *`,
        [item.title, item.description, item.condition, item.category, item.price,
         item.original_price || item.price, item.consignor_id || null, item.expiration_date || null, item.barcode || null]
      );
      if (result.rows[0]) imported.push(result.rows[0]);
    }
    await client.query('COMMIT');
    await log(req.user.id, 'bulk_import_inventory', 'inventory', null, { count: imported.length });
    res.status(201).json({ imported: imported.length, items: imported });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
