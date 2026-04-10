const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

// GET /api/tasks
router.get('/', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT t.*, u1.name as assigned_to_name, u2.name as assigned_by_name
       FROM tasks t
       LEFT JOIN users u1 ON u1.id = t.assigned_to_user_id
       LEFT JOIN users u2 ON u2.id = t.assigned_by_user_id
       WHERE t.assigned_to_user_id = $1 OR $2 = 'owner' OR $2 = 'manager'
       ORDER BY t.due_date ASC /* MySQL: NULLs sort first on ASC */, t.created_at DESC`,
      [req.user.id, req.user.role]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/tasks
router.post('/', auth, async (req, res) => {
  const { assigned_to_user_id, title, notes, due_date } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO tasks (assigned_to_user_id, assigned_by_user_id, title, notes, due_date)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [assigned_to_user_id, req.user.id, title, notes || null, due_date || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/tasks/:id/complete
router.patch('/:id/complete', auth, async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE tasks SET completed = true, completed_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    await db.query('DELETE FROM tasks WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
