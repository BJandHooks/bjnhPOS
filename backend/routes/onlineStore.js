const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// GET /api/online-store/settings
router.get('/settings', auth, requireRole('owner'), async (req, res) => {
  try {
    let result = await db.query('SELECT * FROM online_store_settings LIMIT 1');
    
    if (result.rows.length === 0) {
      result = await db.query(
        'INSERT INTO online_store_settings DEFAULT VALUES RETURNING *'
      );
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/online-store/settings
router.patch('/settings', auth, requireRole('owner'), async (req, res) => {
  const { store_enabled, store_url, store_theme } = req.body;

  try {
    const result = await db.query(
      `UPDATE online_store_settings SET store_enabled = $1, store_url = $2, store_theme = $3, updated_at = NOW()
       RETURNING *`,
      [store_enabled, store_url || null, store_theme || null]
    );

    await log(req.user.id, 'update_store_settings', 'online_store_settings', null);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/online-store/list-item
router.post('/list-item', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { inventory_id, platforms } = req.body; // platforms: ['discogs', 'ebay']

  try {
    // Update online status
    const statusRes = await db.query(
      `INSERT INTO inventory_online_status (inventory_id, is_online, online_platforms)
       VALUES ($1, true, $2)
       ON DUPLICATE KEY UPDATE is_online = 1, online_platforms = VALUES(online_platforms), updated_at = NOW()
       RETURNING *`,
      [inventory_id, (platforms || []).join(',')]
    );

    // Log action
    for (const platform of platforms || []) {
      await db.query(
        `INSERT INTO inventory_sync_log (inventory_id, action, platform)
         VALUES ($1, $2, $3)`,
        [inventory_id, 'listed', platform]
      );
    }

    await log(req.user.id, 'list_item_online', 'inventory_online_status', inventory_id);

    res.status(201).json(statusRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/online-store/delist-item
router.post('/delist-item', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { inventory_id } = req.body;

  try {
    const statusRes = await db.query(
      'UPDATE inventory_online_status SET is_online = false, updated_at = NOW() WHERE inventory_id = $1 RETURNING *',
      [inventory_id]
    );

    if (statusRes.rows[0]) {
      await db.query(
        `INSERT INTO inventory_sync_log (inventory_id, action, platform)
         VALUES ($1, $2, $3)`,
        [inventory_id, 'delisted', 'all']
      );
    }

    await log(req.user.id, 'delist_item_online', 'inventory_online_status', inventory_id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/online-store/inventory-status
router.get('/inventory-status', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT ios.*, i.title, i.price, i.status as inventory_status
       FROM inventory_online_status ios
       LEFT JOIN inventory i ON i.id = ios.inventory_id
       WHERE ios.is_online = true
       ORDER BY ios.updated_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/online-store/listings
router.get('/listings', auth, async (req, res) => {
  const { platform } = req.query;

  try {
    let conditions = ['1=1'];
    let params = [];
    let i = 1;

    if (platform) { conditions.push(`pl.platform = $${i}`); params.push(platform); i++; }

    const result = await db.query(
      `SELECT pl.*, i.title, i.price
       FROM platform_listings pl
       LEFT JOIN inventory i ON i.id = pl.inventory_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY pl.created_at DESC`,
      params
    );

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/online-store/sync
router.post('/sync', auth, requireRole('owner'), async (req, res) => {
  const { platform, sync_type } = req.body; // sync_type: 'inventory', 'orders', 'full'

  try {
    const jobRes = await db.query(
      `INSERT INTO platform_sync_jobs (platform, sync_type, status)
       VALUES ($1, $2, 'running') RETURNING *`,
      [platform, sync_type || 'full']
    );

    const jobId = jobRes.rows[0].id;

    // Simulate sync (in production, this would call actual platform APIs)
    // For now, mark as complete
    const completeRes = await db.query(
      `UPDATE platform_sync_jobs SET status = 'complete', completed_at = NOW(), records_synced = 0
       WHERE id = $1 RETURNING *`,
      [jobId]
    );

    await log(req.user.id, 'sync_platform', 'platform_sync_jobs', jobId, { platform, sync_type });

    res.status(201).json(completeRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/online-store/sync-history
router.get('/sync-history', auth, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM platform_sync_jobs ORDER BY created_at DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/online-store/google-feed
router.get('/google-feed', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM google_shopping_feed WHERE in_stock = true ORDER BY updated_at DESC`
    );

    // Return as CSV or XML for Google Shopping
    let feed = 'id,title,description,price,image_url,product_url,category,availability,condition\n';
    result.rows.forEach(row => {
      feed += `${row.id},"${row.product_title}","${row.product_description}",${row.price},"${row.image_url}","${row.product_url}","${row.category}","${row.in_stock ? 'in stock' : 'out of stock'}","${row.condition}"\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="google-shopping-feed.csv"');
    res.send(feed);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/online-store/regenerate-feed
router.post('/regenerate-feed', auth, requireRole('owner'), async (req, res) => {
  try {
    // Delete old feed
    await db.query('DELETE FROM google_shopping_feed');

    // Regenerate from inventory
    const inventory = await db.query(
      `SELECT * FROM inventory WHERE status = 'active' AND id IN 
       (SELECT inventory_id FROM inventory_online_status WHERE is_online = true)`
    );

    for (const item of inventory.rows) {
      await db.query(
        `INSERT INTO google_shopping_feed 
         (inventory_id, product_title, product_description, price, image_url, category, in_stock, condition)
         VALUES ($1, $2, $3, $4, $5, $6, true, $7)`,
        [item.id, item.title, item.description || '', item.price, null, item.category || 'Used Music', item.condition]
      );
    }

    await log(req.user.id, 'regenerate_google_feed', 'google_shopping_feed', null);

    res.json({ success: true, items_generated: inventory.rows.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/online-store/monitoring
router.get('/monitoring', auth, requireRole('owner'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM website_monitoring ORDER BY check_type'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/online-store/run-health-check
router.post('/run-health-check', auth, requireRole('owner'), async (req, res) => {
  try {
    // Simulate health checks
    const checks = [
      { type: 'uptime', status: 'ok' },
      { type: 'ssl_cert', status: 'ok' },
      { type: 'broken_links', status: 'ok' },
      { type: 'sitemaps', status: 'ok' }
    ];

    for (const check of checks) {
      await db.query(
        `INSERT INTO website_monitoring (check_type, status, last_checked_at)
         VALUES ($1, $2, NOW())
         ON DUPLICATE KEY UPDATE status = VALUES(status), last_checked_at = NOW()`,
        [check.type, check.status]
      );
    }

    await log(req.user.id, 'run_health_check', 'website_monitoring', null);

    res.json({ success: true, checks_run: checks.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/online-store/backup
router.post('/backup', auth, requireRole('owner'), async (req, res) => {
  const { backup_type } = req.body; // 'database' or 'files'

  try {
    // In production, this would trigger actual backup
    const result = await db.query(
      `INSERT INTO backups (backup_type, status, backup_date)
       VALUES ($1, 'complete', NOW()) RETURNING *`,
      [backup_type || 'database']
    );

    await log(req.user.id, 'create_backup', 'backups', result.rows[0].id);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/online-store/backups
router.get('/backups', auth, requireRole('owner'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM backups ORDER BY backup_date DESC LIMIT 50'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
