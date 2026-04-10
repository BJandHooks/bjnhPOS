const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// GET /api/work-orders
router.get('/', auth, async (req, res) => {
  const { status, customer_id, assigned_to } = req.query;
  try {
    let conditions = ['1=1'];
    let params = [];
    let i = 1;

    if (status) { conditions.push(`wo.status = $${i}`); params.push(status); i++; }
    if (customer_id) { conditions.push(`wo.customer_id = $${i}`); params.push(customer_id); i++; }
    if (assigned_to) { conditions.push(`wo.assigned_to_user_id = $${i}`); params.push(assigned_to); i++; }

    const result = await db.query(
      `SELECT wo.*, c.name as customer_name, c.phone, c.email,
              assigned_user.name as assigned_to_name
       FROM work_orders wo
       LEFT JOIN customers c ON c.id = wo.customer_id
       LEFT JOIN users assigned_user ON assigned_user.id = wo.assigned_to_user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY wo.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/work-orders/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const woResult = await db.query(
      `SELECT wo.*, c.name as customer_name, c.phone, c.email,
              assigned_user.name as assigned_to_name,
              created_user.name as created_by_name
       FROM work_orders wo
       LEFT JOIN customers c ON c.id = wo.customer_id
       LEFT JOIN users assigned_user ON assigned_user.id = wo.assigned_to_user_id
       LEFT JOIN users created_user ON created_user.id = wo.user_id
       WHERE wo.id = $1`,
      [req.params.id]
    );

    if (\!woResult.rows[0]) return res.status(404).json({ error: 'Work order not found' });

    const itemsResult = await db.query(
      'SELECT * FROM work_order_items WHERE work_order_id = $1 ORDER BY created_at',
      [req.params.id]
    );

    const timelineResult = await db.query(
      `SELECT wot.*, u.name as user_name
       FROM work_order_timeline wot
       LEFT JOIN users u ON u.id = wot.user_id
       WHERE wot.work_order_id = $1
       ORDER BY wot.created_at DESC`,
      [req.params.id]
    );

    res.json({
      ...woResult.rows[0],
      items: itemsResult.rows,
      timeline: timelineResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/work-orders
router.post('/', auth, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const { customer_id, job_type, description, deposit_collected, deposit_method, 
          estimated_completion_date, notes, items } = req.body;
  try {
    // Create work order
    const woResult = await db.query(
      `INSERT INTO work_orders
       (customer_id, user_id, job_type, description, deposit_collected, deposit_method, estimated_completion_date, notes, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'received') RETURNING *`,
      [customer_id, req.user.id, job_type, description, deposit_collected || 0, 
       deposit_method || null, estimated_completion_date || null, notes || null]
    );

    const workOrderId = woResult.rows[0].id;

    // Add items if provided
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await db.query(
          'INSERT INTO work_order_items (work_order_id, description, quantity) VALUES ($1, $2, $3)',
          [workOrderId, item.description, item.quantity || 1]
        );
      }
    }

    // Add timeline entry
    await db.query(
      'INSERT INTO work_order_timeline (work_order_id, user_id, status_change, notes) VALUES ($1, $2, $3, $4)',
      [workOrderId, req.user.id, 'received', 'Work order created']
    );

    await log(req.user.id, 'create_work_order', 'work_orders', workOrderId, 
              { customer_id, job_type, description });

    res.status(201).json(woResult.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/work-orders/:id
router.patch('/:id', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { status, assigned_to_user_id, notes, estimated_completion_date, completed_date } = req.body;
  try {
    const result = await db.query(
      `UPDATE work_orders 
       SET status=$1, assigned_to_user_id=$2, notes=$3, 
           estimated_completion_date=$4, completed_date=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [status, assigned_to_user_id || null, notes, estimated_completion_date || null, 
       completed_date || null, req.params.id]
    );

    if (\!result.rows[0]) return res.status(404).json({ error: 'Work order not found' });

    // Add timeline entry
    if (status) {
      await db.query(
        'INSERT INTO work_order_timeline (work_order_id, user_id, status_change, notes) VALUES ($1, $2, $3, $4)',
        [req.params.id, req.user.id, status, notes || 'Status updated']
      );
    }

    await log(req.user.id, 'update_work_order', 'work_orders', req.params.id, req.body);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/work-orders/:id/mark-ready
router.post('/:id/mark-ready', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { send_notification } = req.body;
  try {
    const woResult = await db.query(
      'SELECT * FROM work_orders WHERE id = $1',
      [req.params.id]
    );

    if (\!woResult.rows[0]) return res.status(404).json({ error: 'Work order not found' });

    const wo = woResult.rows[0];

    // Update status to ready
    await db.query(
      'UPDATE work_orders SET status=$1, updated_at=NOW() WHERE id=$2',
      ['ready', req.params.id]
    );

    // Add timeline entry
    await db.query(
      'INSERT INTO work_order_timeline (work_order_id, user_id, status_change, notes) VALUES ($1, $2, $3, $4)',
      [req.params.id, req.user.id, 'ready', 'Item ready for pickup']
    );

    // Log notification sent if requested
    if (send_notification && wo.customer_id) {
      const notification_method = req.body.method || 'email';
      await db.query(
        'INSERT INTO work_order_notifications (work_order_id, customer_id, notification_type, method) VALUES ($1, $2, $3, $4)',
        [req.params.id, wo.customer_id, 'ready', notification_method]
      );
    }

    await log(req.user.id, 'mark_work_order_ready', 'work_orders', req.params.id);

    res.json({ success: true, message: 'Work order marked as ready' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/work-orders/:id/pickup
router.post('/:id/pickup', auth, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const result = await db.query(
      'UPDATE work_orders SET status=$1, completed_date=NOW(), updated_at=NOW() WHERE id=$2 RETURNING *',
      ['picked_up', req.params.id]
    );

    if (\!result.rows[0]) return res.status(404).json({ error: 'Work order not found' });

    // Add timeline entry
    await db.query(
      'INSERT INTO work_order_timeline (work_order_id, user_id, status_change, notes) VALUES ($1, $2, $3, $4)',
      [req.params.id, req.user.id, 'picked_up', 'Customer picked up']
    );

    await log(req.user.id, 'pickup_work_order', 'work_orders', req.params.id);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/work-orders/:id/history
router.get('/:id/history', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT wot.*, u.name as user_name
       FROM work_order_timeline wot
       LEFT JOIN users u ON u.id = wot.user_id
       WHERE wot.work_order_id = $1
       ORDER BY wot.created_at DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/work-orders/:id (only if not yet in progress)
router.delete('/:id', auth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    const woResult = await db.query('SELECT * FROM work_orders WHERE id = $1', [req.params.id]);
    if (\!woResult.rows[0]) return res.status(404).json({ error: 'Work order not found' });
    
    const wo = woResult.rows[0];
    if (wo.status \!== 'received') {
      return res.status(400).json({ error: 'Cannot delete work orders that have been started' });
    }

    await db.query('DELETE FROM work_orders WHERE id = $1', [req.params.id]);
    await log(req.user.id, 'delete_work_order', 'work_orders', req.params.id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
