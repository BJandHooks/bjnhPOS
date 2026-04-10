// payments.js
const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

router.get('/sale/:sale_id', auth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM payments WHERE sale_id = $1', [req.params.sale_id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
