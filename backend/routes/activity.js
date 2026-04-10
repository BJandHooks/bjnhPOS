const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');

// GET /api/activity
router.get('/', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { user_id, entity_type, from, to, limit = 100 } = req.query;
  try {
    let conditions = ['1=1'];
    let params = [];
    let i = 1;
    if (user_id) { conditions.push(`al.user_id = $${i}`); params.push(user_id); i++; }
    if (entity_type) { conditions.push(`al.entity_type = $${i}`); params.push(entity_type); i++; }
    if (from) { conditions.push(`al.created_at >= $${i}`); params.push(from); i++; }
    if (to) { conditions.push(`al.created_at <= $${i}`); params.push(to); i++; }
    params.push(limit);

    const result = await db.query(
      `SELECT al.*, u.name as staff_name
       FROM activity_log al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY al.created_at DESC
       LIMIT $${i}`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
