const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// POST /api/timeclock/in
router.post('/in', auth, async (req, res) => {
  try {
    const open = await db.query(
      'SELECT * FROM time_clock WHERE user_id = $1 AND clocked_out_at IS NULL',
      [req.user.id]
    );
    if (open.rows.length > 0) return res.status(400).json({ error: 'Already clocked in' });
    const result = await db.query(
      'INSERT INTO time_clock (user_id, clocked_in_at) VALUES ($1, NOW()) RETURNING *',
      [req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/timeclock/out
router.post('/out', auth, async (req, res) => {
  try {
    const open = await db.query(
      'SELECT * FROM time_clock WHERE user_id = $1 AND clocked_out_at IS NULL',
      [req.user.id]
    );
    if (!open.rows[0]) return res.status(400).json({ error: 'Not clocked in' });

    const entry = open.rows[0];
    const now = new Date();
    const minutes = Math.round((now - new Date(entry.clocked_in_at)) / 60000);

    const result = await db.query(
      'UPDATE time_clock SET clocked_out_at = $1, total_minutes = $2 WHERE id = $3 RETURNING *',
      [now, minutes, entry.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/timeclock — manager/owner view all
router.get('/', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { user_id, from, to } = req.query;
  try {
    let conditions = ['1=1'];
    let params = [];
    let i = 1;
    if (user_id) { conditions.push(`tc.user_id = $${i}`); params.push(user_id); i++; }
    if (from) { conditions.push(`tc.clocked_in_at >= $${i}`); params.push(from); i++; }
    if (to) { conditions.push(`tc.clocked_in_at <= $${i}`); params.push(to); i++; }

    const result = await db.query(
      `SELECT tc.*, u.name as staff_name
       FROM time_clock tc
       LEFT JOIN users u ON u.id = tc.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY tc.clocked_in_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
