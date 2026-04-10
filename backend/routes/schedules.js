const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/schedules
router.get('/', auth, async (req, res) => {
  const { from, to } = req.query;
  try {
    const result = await db.query(
      `SELECT ss.*, u.name as staff_name
       FROM staff_schedules ss
       LEFT JOIN users u ON u.id = ss.user_id
       WHERE ($1::timestamp IS NULL OR ss.shift_start >= $1)
         AND ($2::timestamp IS NULL OR ss.shift_end <= $2)
       ORDER BY ss.shift_start ASC`,
      [from || null, to || null]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedules
router.post('/', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { user_id, shift_start, shift_end, notes } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO staff_schedules (user_id, shift_start, shift_end, notes)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [user_id, shift_start, shift_end, notes || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/schedules/:id
router.delete('/:id', auth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    await db.query('DELETE FROM staff_schedules WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
