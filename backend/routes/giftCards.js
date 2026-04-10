const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');
const { v4: uuidv4 } = require('uuid');

// GET /api/gift-cards/:code — look up by code
router.get('/:code', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM gift_cards WHERE code = $1', [req.params.code]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Gift card not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/gift-cards — sell a new gift card
router.post('/', auth, async (req, res) => {
  const { amount, customer_id } = req.body;
  const code = uuidv4().replace(/-/g, '').substring(0, 16).toUpperCase();
  try {
    const result = await db.query(
      `INSERT INTO gift_cards (code, original_balance, current_balance, issued_to_customer_id)
       VALUES ($1, $2, $2, $3) RETURNING *`,
      [code, amount, customer_id || null]
    );
    await log(req.user.id, 'sell_gift_card', 'gift_cards', result.rows[0].id, { amount, code });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
