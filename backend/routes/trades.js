const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');
const axios = require('axios');

const DISCOGS_API_BASE = 'https://api.discogs.com';
const DISCOGS_TOKEN = process.env.DISCOGS_TOKEN || '';

// Helper: Search Discogs for an item and get estimated price
async function searchDiscogsPrice(title, condition) {
  try {
    if (\!DISCOGS_TOKEN) return null;
    
    const headers = { 'User-Agent': 'bjnhPOS/1.0 +http://bjnhpos.local' };
    if (DISCOGS_TOKEN) headers['Authorization'] = `Discogs token=${DISCOGS_TOKEN}`;

    const searchRes = await axios.get(`${DISCOGS_API_BASE}/database/search`, {
      params: { q: title, type: 'release' },
      headers,
      timeout: 5000
    });

    if (\!searchRes.data.results || searchRes.data.results.length === 0) {
      return null;
    }

    const release = searchRes.data.results[0];
    
    // Get marketplace data for price estimate
    const priceRes = await axios.get(
      `${DISCOGS_API_BASE}/releases/${release.id}/marketplace-items`,
      { headers, timeout: 5000 }
    );

    if (\!priceRes.data.items || priceRes.data.items.length === 0) {
      return null;
    }

    // Calculate median price from listings
    const prices = priceRes.data.items
      .filter(item => item.price)
      .map(item => item.price)
      .sort((a, b) => a - b);

    const medianPrice = prices[Math.floor(prices.length / 2)];
    
    return {
      discogs_id: release.id,
      discogs_title: release.title,
      estimated_price: parseFloat(medianPrice) || null
    };
  } catch (err) {
    console.error('Discogs API error:', err.message);
    return null;
  }
}

// Helper: Check if item already in inventory (duplicate detection)
async function checkDuplicate(title, condition) {
  try {
    const result = await db.query(
      `SELECT id FROM inventory 
       WHERE LOWER(title) LIKE LOWER($1) AND condition = $2 AND status = 'active'
       LIMIT 1`,
      [`%${title}%`, condition]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

// Helper: Check if customer is banned
async function isCustomerBanned(customerId) {
  try {
    const result = await db.query(
      'SELECT id FROM banned_customers WHERE customer_id = $1',
      [customerId]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

// Helper: Detect fraud patterns
async function detectFraudPatterns(customerId, offeredAmount, itemCount) {
  const flags = [];

  // High-value trade flag
  if (offeredAmount > 500) {
    flags.push({ flag_type: 'high_value', severity: 'medium', description: `High offer amount: $${offeredAmount}` });
  }

  // Repeat trader pattern
  try {
    const tradeCount = await db.query(
      `SELECT COUNT(*) as cnt FROM trades WHERE customer_id = $1 AND created_at > NOW() - INTERVAL '30 days'`,
      [customerId]
    );
    if (parseInt(tradeCount.rows[0].cnt) > 10) {
      flags.push({ flag_type: 'repeat_trader', severity: 'low', description: 'Multiple trades in short period' });
    }
  } catch {}

  return flags;
}

// GET /api/trades
router.get('/', auth, async (req, res) => {
  const { customer_id, status } = req.query;
  try {
    let conditions = ['1=1'];
    let params = [];
    let i = 1;

    if (customer_id) { conditions.push(`t.customer_id = $${i}`); params.push(customer_id); i++; }
    if (status === 'accepted') { conditions.push('t.offer_accepted = true'); }
    if (status === 'rejected') { conditions.push('t.offer_accepted = false'); }

    const result = await db.query(
      `SELECT t.*, c.name as customer_name
       FROM trades t
       LEFT JOIN customers c ON c.id = t.customer_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY t.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trades/:id
router.get('/:id', auth, async (req, res) => {
  try {
    const tradeRes = await db.query('SELECT * FROM trades WHERE id = $1', [req.params.id]);
    if (\!tradeRes.rows[0]) return res.status(404).json({ error: 'Trade not found' });

    const itemsRes = await db.query('SELECT * FROM trade_items WHERE trade_id = $1', [req.params.id]);

    res.json({
      ...tradeRes.rows[0],
      items: itemsRes.rows
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trades (create trade evaluation)
router.post('/', auth, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const { customer_id, items } = req.body;

  try {
    // Check if customer is banned
    if (await isCustomerBanned(customer_id)) {
      return res.status(403).json({ error: 'Customer is banned from trading' });
    }

    // Separate logic for >25 items vs <=25 items
    const itemCount = items.length;
    let itemsToEvaluate = items;
    let selectedIndices = null;

    if (itemCount > 25) {
      // Random sample of 10
      selectedIndices = new Set();
      while (selectedIndices.size < 10) {
        selectedIndices.add(Math.floor(Math.random() * itemCount));
      }
      itemsToEvaluate = items.filter((_, i) => selectedIndices.has(i));
    }

    // Lookup Discogs prices for all items and calculate offer
    let totalEstimatedValue = 0;
    const itemsWithPrices = [];

    for (const item of itemsToEvaluate) {
      const discogs = await searchDiscogsPrice(item.title, item.condition);
      const isDuplicate = await checkDuplicate(item.title, item.condition);

      const estimatedPrice = discogs?.estimated_price || 0;
      totalEstimatedValue += estimatedPrice;

      itemsWithPrices.push({
        ...item,
        discogs_id: discogs?.discogs_id,
        estimated_value: estimatedPrice,
        is_duplicate: isDuplicate
      });
    }

    // Calculate offer: 30% of estimated value × total item count
    const offerAmount = (totalEstimatedValue * 0.30) * itemCount;

    // Create trade record
    const tradeRes = await db.query(
      `INSERT INTO trades
       (customer_id, user_id, total_items, items_evaluated, offer_amount)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [customer_id, req.user.id, itemCount, itemsToEvaluate.length, offerAmount]
    );

    const tradeId = tradeRes.rows[0].id;

    // Insert items
    for (const item of itemsWithPrices) {
      await db.query(
        `INSERT INTO trade_items
         (trade_id, title, description, condition, category, estimated_value, 
          discogs_id, is_duplicate)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [tradeId, item.title, item.description || null, item.condition, 
         item.category || null, item.estimated_value, item.discogs_id || null, item.is_duplicate]
      );
    }

    // Track popular items
    for (const item of items) {
      try {
        const existing = await db.query(
          `SELECT id FROM popular_trade_items WHERE LOWER(title) = LOWER($1)`,
          [item.title]
        );
        if (existing.rows.length > 0) {
          await db.query(
            `UPDATE popular_trade_items SET trade_count = trade_count + 1, last_traded_at = NOW() WHERE id = $1`,
            [existing.rows[0].id]
          );
        } else {
          await db.query(
            `INSERT INTO popular_trade_items (title, category, trade_count) VALUES ($1, $2, 1)`,
            [item.title, item.category || null]
          );
        }
      } catch {}
    }

    // Detect fraud patterns
    const fraudFlags = await detectFraudPatterns(customer_id, offerAmount, itemCount);
    for (const flag of fraudFlags) {
      await db.query(
        `INSERT INTO trade_fraud_flags (trade_id, flag_type, severity, description)
         VALUES ($1, $2, $3, $4)`,
        [tradeId, flag.flag_type, flag.severity, flag.description]
      );
    }

    await log(req.user.id, 'create_trade', 'trades', tradeId, { customer_id, itemCount, offerAmount });

    res.status(201).json({
      ...tradeRes.rows[0],
      items: itemsWithPrices,
      fraud_flags: fraudFlags
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/trades/:id/accept
router.patch('/:id/accept', auth, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  const { method } = req.body; // 'cash' or 'store_credit'
  
  try {
    const tradeRes = await db.query('SELECT * FROM trades WHERE id = $1', [req.params.id]);
    if (\!tradeRes.rows[0]) return res.status(404).json({ error: 'Trade not found' });

    const trade = tradeRes.rows[0];

    // Update trade as accepted
    const updated = await db.query(
      `UPDATE trades SET offer_accepted = true, accepted_at = NOW(), 
              trade_credit_method = $1, trade_credit_issued = $2
       WHERE id = $3 RETURNING *`,
      [method, trade.offer_amount, req.params.id]
    );

    // Update customer's store credit or cash balance
    if (method === 'store_credit') {
      await db.query(
        `UPDATE customers SET store_credit_balance = store_credit_balance + $1
         WHERE id = $2`,
        [trade.offer_amount, trade.customer_id]
      );
    }

    // Record in trade history
    await db.query(
      `INSERT INTO trade_history (customer_id, trade_id, total_items, offer_amount, offer_accepted)
       VALUES ($1, $2, $3, $4, true)`,
      [trade.customer_id, req.params.id, trade.total_items, trade.offer_amount]
    );

    await log(req.user.id, 'accept_trade', 'trades', req.params.id);

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/trades/:id/reject
router.patch('/:id/reject', auth, requireRole('owner', 'manager', 'cashier'), async (req, res) => {
  try {
    const updated = await db.query(
      `UPDATE trades SET offer_accepted = false, accepted_at = NOW()
       WHERE id = $1 RETURNING *`,
      [req.params.id]
    );

    if (\!updated.rows[0]) return res.status(404).json({ error: 'Trade not found' });

    // Record in trade history
    const trade = updated.rows[0];
    await db.query(
      `INSERT INTO trade_history (customer_id, trade_id, total_items, offer_amount, offer_accepted)
       VALUES ($1, $2, $3, $4, false)`,
      [trade.customer_id, req.params.id, trade.total_items, trade.offer_amount]
    );

    await log(req.user.id, 'reject_trade', 'trades', req.params.id);

    res.json(updated.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trades/:id/reject-item
router.post('/:trade_id/reject-item/:item_id', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { reason, notes } = req.body;
  
  try {
    await db.query(
      `INSERT INTO trade_rejections (trade_item_id, reason, notes)
       VALUES ($1, $2, $3)`,
      [req.params.item_id, reason, notes || null]
    );

    await db.query(
      'UPDATE trade_items SET included_in_offer = false, rejection_reason = $1 WHERE id = $2',
      [reason, req.params.item_id]
    );

    await log(req.user.id, 'reject_trade_item', 'trade_items', req.params.item_id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trades/popular-items
router.get('/popular-items', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT title, category, trade_count, last_traded_at
       FROM popular_trade_items
       ORDER BY trade_count DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/trades/ban-customer
router.post('/ban-customer/:customer_id', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { reason } = req.body;
  
  try {
    const existing = await db.query(
      'SELECT id FROM banned_customers WHERE customer_id = $1',
      [req.params.customer_id]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Customer already banned' });
    }

    await db.query(
      `INSERT INTO banned_customers (customer_id, reason, banned_by_user_id)
       VALUES ($1, $2, $3)`,
      [req.params.customer_id, reason || null, req.user.id]
    );

    await log(req.user.id, 'ban_customer', 'banned_customers', req.params.customer_id);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/trades/banned-customers
router.get('/banned-customers', auth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT bc.*, c.name as customer_name, u.name as banned_by_name
       FROM banned_customers bc
       LEFT JOIN customers c ON c.id = bc.customer_id
       LEFT JOIN users u ON u.id = bc.banned_by_user_id
       ORDER BY bc.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
