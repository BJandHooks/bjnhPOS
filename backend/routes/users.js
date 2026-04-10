const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// GET /api/users — manager/owner only
router.get('/', auth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, name, email, role, active, created_at FROM users ORDER BY name'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/users — owner only
router.post('/', auth, requireRole('owner'), async (req, res) => {
  const { name, email, password, role } = req.body;
  try {
    const password_hash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, role`,
      [name, email, password_hash, role]
    );
    await log(req.user.id, 'create_user', 'users', result.rows[0].id, { name, role });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/users/:id — owner only
router.patch('/:id', auth, requireRole('owner'), async (req, res) => {
  const { name, email, role, active } = req.body;
  try {
    const result = await db.query(
      `UPDATE users SET name=$1, email=$2, role=$3, active=$4 WHERE id=$5
       RETURNING id, name, email, role, active`,
      [name, email, role, active, req.params.id]
    );
    await log(req.user.id, 'update_user', 'users', req.params.id, req.body);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
