const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const { log } = require('../middleware/logger');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase();
  const password = String(req.body?.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const result = await db.query(
      'SELECT * FROM users WHERE LOWER(email) = $1 AND active = 1 LIMIT 1',
      [email]
    );

    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const valid = await bcrypt.compare(password, user.password_hash || '');

    if (!valid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, name: user.name, role: user.role },
      process.env.JWT_SECRET || 'fallback-secret',
      { expiresIn: '12h' }
    );

    try {
      await log(user.id, 'login', 'users', user.id, null);
    } catch (e) {
      console.error('Log error:', e.message);
    }

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;