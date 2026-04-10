const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// Helper: Generate ticket code
function generateTicketCode() {
  return 'TKT-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 5).toUpperCase();
}

// Helper: Create recurring event instances
async function createRecurringInstances(eventId, startDate, pattern, endDate) {
  const instances = [];
  let current = new Date(startDate);
  const recurEnd = new Date(endDate);

  const intervalMap = {
    daily: { days: 1 },
    weekly: { days: 7 },
    biweekly: { days: 14 },
    monthly: { days: 30 }
  };

  const interval = intervalMap[pattern];
  while (current < recurEnd) {
    const nextDate = new Date(current);
    nextDate.setDate(nextDate.getDate() + interval.days);

    await db.query(
      'INSERT INTO recurring_event_instances (parent_event_id, instance_start, instance_end) VALUES ($1, $2, $3)',
      [eventId, current, nextDate]
    );

    instances.push({ start: new Date(current), end: new Date(nextDate) });
    current = nextDate;
  }
  return instances;
}

// GET /api/events
router.get('/', auth, async (req, res) => {
  const { type, status, start_after, start_before } = req.query;
  try {
    let conditions = ['1=1'];
    let params = [];
    let i = 1;

    if (type) { conditions.push(`e.event_type = $${i}`); params.push(type); i++; }
    if (status) { conditions.push(`e.status = $${i}`); params.push(status); i++; }
    if (start_after) { conditions.push(`e.start_date >= $${i}`); params.push(start_after); i++; }
    if (start_before) { conditions.push(`e.start_date <= $${i}`); params.push(start_before); i++; }

    const result = await db.query(
      `SELECT e.*, h.name as host_name, p.name as performer_name
       FROM events e
       LEFT JOIN customers h ON h.id = e.host_id
       LEFT JOIN customers p ON p.id = e.performer_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY e.start_date ASC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const eventRes = await db.query(
      `SELECT e.*, h.name as host_name, p.name as performer_name
       FROM events e
       LEFT JOIN customers h ON h.id = e.host_id
       LEFT JOIN customers p ON p.id = e.performer_id
       WHERE e.id = $1`,
      [req.params.id]
    );

    if (\!eventRes.rows[0]) return res.status(404).json({ error: 'Event not found' });

    const event = eventRes.rows[0];

    // Get registrations
    const regsRes = await db.query(
      `SELECT er.*, c.name as customer_name
       FROM event_registrations er
       LEFT JOIN customers c ON c.id = er.customer_id
       WHERE er.event_id = $1
       ORDER BY er.created_at DESC`,
      [req.params.id]
    );

    // Get revenue splits
    const splitsRes = await db.query(
      'SELECT * FROM event_revenue_splits WHERE event_id = $1 ORDER BY split_percentage DESC',
      [req.params.id]
    );

    // Get linked sales
    const salesRes = await db.query(
      `SELECT es.*, s.total FROM event_sales es
       LEFT JOIN sales s ON s.id = es.sale_id
       WHERE es.event_id = $1`,
      [req.params.id]
    );

    res.json({
      ...event,
      registrations: regsRes.rows,
      revenue_splits: splitsRes.rows,
      linked_sales: salesRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events
router.post('/', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { title, description, event_type, start_date, end_date, location, capacity, price, 
          is_free, is_recurring, recurring_pattern, recurring_end_date, host_id, performer_id, revenue_splits } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO events
       (title, description, event_type, start_date, end_date, location, capacity, price, is_free, is_recurring, recurring_pattern, recurring_end_date, host_id, performer_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) RETURNING *`,
      [title, description || null, event_type, start_date, end_date || null, location || null,
       capacity || null, price || 0, is_free || false, is_recurring || false, recurring_pattern || null,
       recurring_end_date || null, host_id || null, performer_id || null]
    );

    const eventId = result.rows[0].id;

    // Create recurring instances if applicable
    if (is_recurring && recurring_pattern && recurring_end_date) {
      await createRecurringInstances(eventId, start_date, recurring_pattern, recurring_end_date);
    }

    // Add revenue splits
    if (revenue_splits && Array.isArray(revenue_splits)) {
      for (const split of revenue_splits) {
        await db.query(
          `INSERT INTO event_revenue_splits (event_id, recipient_id, recipient_name, split_percentage, split_type, amount)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [eventId, split.recipient_id || null, split.recipient_name, split.split_percentage,
           split.split_type || 'flat_percentage', split.amount || null]
        );
      }
    }

    await log(req.user.id, 'create_event', 'events', eventId, { title, event_type });

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/events/:id
router.patch('/:id', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { title, description, start_date, end_date, location, capacity, price, status } = req.body;

  try {
    const result = await db.query(
      `UPDATE events SET title=$1, description=$2, start_date=$3, end_date=$4, 
              location=$5, capacity=$6, price=$7, status=$8, updated_at=NOW()
       WHERE id=$9 RETURNING *`,
      [title, description, start_date, end_date, location, capacity, price, status, req.params.id]
    );

    if (\!result.rows[0]) return res.status(404).json({ error: 'Event not found' });

    await log(req.user.id, 'update_event', 'events', req.params.id);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/register
router.post('/:id/register', auth, async (req, res) => {
  const { customer_id, registration_type } = req.body; // 'reserved' or 'door'

  try {
    const eventRes = await db.query('SELECT * FROM events WHERE id = $1', [req.params.id]);
    if (\!eventRes.rows[0]) return res.status(404).json({ error: 'Event not found' });

    const event = eventRes.rows[0];

    // Check capacity
    if (event.capacity) {
      const regCount = await db.query(
        'SELECT COUNT(*) as cnt FROM event_registrations WHERE event_id = $1',
        [req.params.id]
      );
      if (parseInt(regCount.rows[0].cnt) >= event.capacity) {
        return res.status(400).json({ error: 'Event is at capacity' });
      }
    }

    // Create registration
    const regRes = await db.query(
      `INSERT INTO event_registrations (event_id, customer_id, registration_type, payment_status)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, customer_id, registration_type, event.is_free ? 'free' : 'unpaid']
    );

    // Generate ticket for non-door registrations
    if (registration_type === 'reserved') {
      const ticketCode = generateTicketCode();
      await db.query(
        `INSERT INTO event_tickets (event_id, customer_id, registration_id, ticket_code)
         VALUES ($1, $2, $3, $4)`,
        [req.params.id, customer_id, regRes.rows[0].id, ticketCode]
      );
    }

    await log(req.user.id, 'register_event', 'event_registrations', regRes.rows[0].id);

    res.status(201).json(regRes.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/check-in/:registration_id
router.post('/:id/check-in/:registration_id', auth, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const result = await db.query(
      `UPDATE event_registrations SET checked_in = true, checked_in_at = NOW()
       WHERE id = $1 AND event_id = $2 RETURNING *`,
      [req.params.registration_id, req.params.id]
    );

    if (\!result.rows[0]) return res.status(404).json({ error: 'Registration not found' });

    await log(req.user.id, 'check_in_event', 'event_registrations', req.params.registration_id);

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/link-sale
router.post('/:id/link-sale', auth, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const { sale_id } = req.body;

  try {
    const result = await db.query(
      `INSERT INTO event_sales (event_id, sale_id)
       SELECT $1, $2
       WHERE NOT EXISTS (SELECT 1 FROM event_sales WHERE event_id = $1 AND sale_id = $2)
       RETURNING *`,
      [req.params.id, sale_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Sale already linked to this event' });
    }

    await log(req.user.id, 'link_event_sale', 'event_sales', result.rows[0].id);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/events/:id/pay-splits
router.post('/:id/pay-splits', auth, requireRole('owner'), async (req, res) => {
  const { payment_method } = req.body; // 'cash' or 'store_credit'

  try {
    const splitsRes = await db.query(
      'SELECT * FROM event_revenue_splits WHERE event_id = $1 AND paid = false',
      [req.params.id]
    );

    const splits = splitsRes.rows;
    if (splits.length === 0) {
      return res.status(400).json({ error: 'No unpaid splits for this event' });
    }

    // Mark as paid and update customer balances if store credit
    for (const split of splits) {
      await db.query(
        `UPDATE event_revenue_splits SET paid = true, paid_at = NOW(), paid_method = $1
         WHERE id = $2`,
        [payment_method, split.id]
      );

      if (payment_method === 'store_credit' && split.recipient_id) {
        await db.query(
          `UPDATE customers SET store_credit_balance = store_credit_balance + $1
           WHERE id = $2`,
          [split.amount || 0, split.recipient_id]
        );
      }
    }

    await log(req.user.id, 'pay_event_splits', 'events', req.params.id, { payment_method, count: splits.length });

    res.json({ success: true, splits_paid: splits.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/events/calendar (for iCal export)
router.get('/calendar/export', auth, (req, res) => {
  // Placeholder for iCal generation - would need calendar library
  res.json({ message: 'iCal export not yet implemented' });
});

module.exports = router;
