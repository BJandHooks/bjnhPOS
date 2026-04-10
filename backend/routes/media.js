const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// POST /api/media/upload
router.post('/upload', auth, async (req, res) => {
  const { inventory_id, file_path, file_type, file_size } = req.body;

  try {
    if (\!inventory_id || \!file_path || \!file_type) {
      return res.status(400).json({ error: 'inventory_id, file_path, and file_type are required' });
    }

    const result = await db.query(
      `INSERT INTO media_files (inventory_id, file_path, file_type, file_size)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [inventory_id, file_path, file_type, file_size || null]
    );

    await log(req.user.id, 'upload_media', 'media_files', result.rows[0].id);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/media/inventory/:inventory_id
router.get('/inventory/:inventory_id', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM media_files WHERE inventory_id = $1 ORDER BY created_at DESC',
      [req.params.inventory_id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/media/to-queue
router.post('/to-queue', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { media_file_id, title, caption } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO social_content_queue (media_file_id, title, caption)
       VALUES ($1, $2, $3) RETURNING *`,
      [media_file_id, title || null, caption || null]
    );

    await log(req.user.id, 'queue_content', 'social_content_queue', result.rows[0].id);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/media/queue
router.get('/queue', auth, async (req, res) => {
  const { approved_only } = req.query;

  try {
    let query = `SELECT scq.*, mf.file_path, mf.file_type, i.title as inventory_title
                 FROM social_content_queue scq
                 LEFT JOIN media_files mf ON mf.id = scq.media_file_id
                 LEFT JOIN inventory i ON i.id = mf.inventory_id
                 WHERE scq.in_queue = true`;
    let params = [];

    if (approved_only === 'true') {
      query += ' AND scq.approved = true';
    }

    query += ' ORDER BY scq.created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/media/queue/:id/approve
router.patch('/queue/:id/approve', auth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE social_content_queue SET approved = true, approved_by_user_id = $1, approved_at = NOW()
       WHERE id = $2 RETURNING *`,
      [req.user.id, req.params.id]
    );

    if (\!result.rows[0]) return res.status(404).json({ error: 'Content not found' });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/media/queue/:id/remove
router.patch('/queue/:id/remove', auth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE social_content_queue SET in_queue = false WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (\!result.rows[0]) return res.status(404).json({ error: 'Content not found' });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/media/schedule-post
router.post('/schedule-post', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { platform, track, content_id, scheduled_at, caption } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO social_posts (platform, track, content_id, scheduled_at, caption)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [platform, track, content_id || null, scheduled_at, caption || null]
    );

    await log(req.user.id, 'schedule_social_post', 'social_posts', result.rows[0].id, { platform, track });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/media/posts
router.get('/posts', auth, async (req, res) => {
  const { platform, status } = req.query;

  try {
    let conditions = ['1=1'];
    let params = [];
    let i = 1;

    if (platform) { conditions.push(`sp.platform = $${i}`); params.push(platform); i++; }
    if (status) { conditions.push(`sp.status = $${i}`); params.push(status); i++; }

    const result = await db.query(
      `SELECT sp.*, scq.title
       FROM social_posts sp
       LEFT JOIN social_content_queue scq ON scq.id = sp.content_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sp.scheduled_at DESC`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/media/posts/:id/update-performance
router.patch('/posts/:id/update-performance', auth, async (req, res) => {
  const { views, likes } = req.body;

  try {
    const result = await db.query(
      `UPDATE social_posts SET views = $1, likes = $2 WHERE id = $3 RETURNING *`,
      [views || 0, likes || 0, req.params.id]
    );

    if (\!result.rows[0]) return res.status(404).json({ error: 'Post not found' });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/media/captions/upload-bulk
router.post('/captions/upload-bulk', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { captions, platform } = req.body;

  try {
    const inserted = [];

    for (const caption of captions) {
      const result = await db.query(
        `INSERT INTO social_captions_pool (caption, platform) VALUES ($1, $2) RETURNING *`,
        [caption, platform || null]
      );
      inserted.push(result.rows[0]);
    }

    await log(req.user.id, 'bulk_upload_captions', 'social_captions_pool', null, { count: captions.length });

    res.status(201).json({ count: inserted.length, captions: inserted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/media/captions
router.get('/captions', auth, async (req, res) => {
  const { approved_only } = req.query;

  try {
    let query = 'SELECT * FROM social_captions_pool';
    let params = [];

    if (approved_only === 'true') {
      query += ' WHERE approved = true';
    }

    query += ' ORDER BY created_at DESC';

    const result = await db.query(query, params);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/media/captions/:id/approve
router.patch('/captions/:id/approve', auth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE social_captions_pool SET approved = true WHERE id = $1 RETURNING *',
      [req.params.id]
    );

    if (\!result.rows[0]) return res.status(404).json({ error: 'Caption not found' });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/media/platform-connections
router.get('/platform-connections', auth, requireRole('owner'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT pc.*, u.name as connected_by_name
       FROM platform_connections pc
       LEFT JOIN users u ON u.id = pc.connected_by_user_id
       ORDER BY pc.platform`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/media/platform-connect
router.post('/platform-connect', auth, requireRole('owner'), async (req, res) => {
  const { platform, access_token, business_account_id, page_id } = req.body;

  try {
    const existing = await db.query(
      'SELECT id FROM platform_connections WHERE platform = $1',
      [platform]
    );

    if (existing.rows.length > 0) {
      const result = await db.query(
        `UPDATE platform_connections 
         SET access_token = $1, business_account_id = $2, page_id = $3, connected = true, 
             connected_by_user_id = $4, connected_at = NOW()
         WHERE platform = $5 RETURNING *`,
        [access_token || null, business_account_id || null, page_id || null, req.user.id, platform]
      );
      return res.json(result.rows[0]);
    }

    const result = await db.query(
      `INSERT INTO platform_connections (platform, access_token, business_account_id, page_id, connected, connected_by_user_id, connected_at)
       VALUES ($1, $2, $3, $4, true, $5, NOW()) RETURNING *`,
      [platform, access_token || null, business_account_id || null, page_id || null, req.user.id]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/media/autopilot-schedules
router.get('/autopilot-schedules', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM social_autopilot_schedules ORDER BY platform, post_time'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/media/autopilot-schedule
router.post('/autopilot-schedule', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { platform, post_time, randomize_caption } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO social_autopilot_schedules (platform, post_time, randomize_caption)
       VALUES ($1, $2, $3) RETURNING *`,
      [platform, post_time, randomize_caption \!== false]
    );

    await log(req.user.id, 'create_autopilot_schedule', 'social_autopilot_schedules', result.rows[0].id);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
