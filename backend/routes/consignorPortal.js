const express = require('express');
const router = express.Router();
const db = require('../db');
const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'bjnhpos-secret';

function portalAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (\!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.type \!== 'consignor') return res.status(403).json({ error: 'Not a consignor token' });
    req.consignor = decoded;
    next();
  } catch { res.status(401).json({ error: 'Invalid token' }); }
}

// POST /api/portal/login
router.post('/login', async (req, res) => {
  const { email, pin } = req.body;
  if (\!email || \!pin) return res.status(400).json({ error: 'Email and PIN required' });
  try {
    const result = await db.query('SELECT * FROM consignors WHERE LOWER(email)=LOWER($1)', [email.trim()]);
    if (result.rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    const consignor = result.rows[0];
    if (\!consignor.portal_pin_hash) return res.status(401).json({ error: 'Portal access not set up. Contact the store.' });
    const bcrypt = require('bcryptjs');
    const match = await bcrypt.compare(String(pin), consignor.portal_pin_hash);
    if (\!match) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ type: 'consignor', id: consignor.id, name: consignor.name, email: consignor.email }, SECRET, { expiresIn: '8h' });
    res.json({ token, consignor: { id: consignor.id, name: consignor.name, email: consignor.email } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/portal/me
router.get('/me', portalAuth, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id,name,email,phone,split_percentage,booth_fee_monthly,contract_start,payout_schedule,minimum_payout_balance,active FROM consignors WHERE id=$1`,
      [req.consignor.id]
    );
    if (\!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/portal/items
router.get('/items', portalAuth, async (req, res) => {
  try {
    const items = await db.query(
      `SELECT id,sku,title,artist,format,condition,price,status,category,genre,created_at,expiration_date FROM inventory WHERE consignor_id=$1 ORDER BY created_at DESC`,
      [req.consignor.id]
    );
    const summary = await db.query(
      `SELECT COUNT(*) FILTER (WHERE status='available') AS available,
        COUNT(*) FILTER (WHERE status='sold') AS sold,
        COUNT(*) FILTER (WHERE status='expired') AS expired,
        COUNT(*) FILTER (WHERE expiration_date < NOW() AND status='available') AS expiring_soon,
        ROUND(SUM(price) FILTER (WHERE status='available')::numeric,2) AS inventory_value,
        ROUND(SUM(price) FILTER (WHERE status='sold')::numeric,2) AS sold_value
       FROM inventory WHERE consignor_id=$1`,
      [req.consignor.id]
    );
    res.json({ items: items.rows, summary: summary.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/portal/earnings
router.get('/earnings', portalAuth, async (req, res) => {
  try {
    const sales = await db.query(
      `SELECT i.sku,i.title,i.artist,i.format,i.price AS listed_price,si.sale_price,
        ROUND(si.sale_price*(c.split_percentage/100.0)::numeric,2) AS consignor_share,s.created_at AS sold_at
       FROM inventory i JOIN sale_items si ON si.inventory_id=i.id JOIN sales s ON si.sale_id=s.id
       JOIN consignors c ON i.consignor_id=c.id
       WHERE i.consignor_id=$1 AND s.status='complete' ORDER BY s.created_at DESC`,
      [req.consignor.id]
    );
    const totals = await db.query(
      `SELECT ROUND(SUM(si.sale_price*(c.split_percentage/100.0))::numeric,2) AS total_earned
       FROM inventory i JOIN sale_items si ON si.inventory_id=i.id JOIN sales s ON si.sale_id=s.id
       JOIN consignors c ON i.consignor_id=c.id WHERE i.consignor_id=$1 AND s.status='complete'`,
      [req.consignor.id]
    );
    const paidOut = await db.query(`SELECT ROUND(SUM(amount)::numeric,2) AS total_paid FROM consignor_payouts WHERE consignor_id=$1 AND status='paid'`, [req.consignor.id]);
    const boothDeducted = await db.query(`SELECT ROUND(SUM(amount)::numeric,2) AS total_booth FROM booth_rental_charges WHERE consignor_id=$1`, [req.consignor.id]);
    const totalEarned = parseFloat(totals.rows[0]?.total_earned || 0);
    const totalPaid = parseFloat(paidOut.rows[0]?.total_paid || 0);
    const totalBooth = parseFloat(boothDeducted.rows[0]?.total_booth || 0);
    res.json({ sales: sales.rows, summary: { total_earned: totalEarned.toFixed(2), total_paid_out: totalPaid.toFixed(2), total_booth_fees: totalBooth.toFixed(2), current_balance: (totalEarned - totalPaid - totalBooth).toFixed(2) } });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/portal/payouts
router.get('/payouts', portalAuth, async (req, res) => {
  try {
    const result = await db.query(`SELECT id,amount,method,status,notes,created_at,paid_at FROM consignor_payouts WHERE consignor_id=$1 ORDER BY created_at DESC`, [req.consignor.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/portal/booth-charges
router.get('/booth-charges', portalAuth, async (req, res) => {
  try {
    const result = await db.query(`SELECT id,amount,period_start,period_end,status,created_at FROM booth_rental_charges WHERE consignor_id=$1 ORDER BY period_start DESC`, [req.consignor.id]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/portal/admin/set-pin  (staff only — owner/manager)
router.post('/admin/set-pin', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (\!token) return res.status(401).json({ error: 'No token' });
  try {
    const decoded = jwt.verify(token, SECRET);
    if (\!['owner','manager'].includes(decoded.role)) return res.status(403).json({ error: 'Insufficient role' });
    const { consignor_id, pin } = req.body;
    if (\!consignor_id || \!pin || String(pin).length < 4) return res.status(400).json({ error: 'consignor_id and 4+ digit PIN required' });
    const bcrypt = require('bcryptjs');
    const hash = await bcrypt.hash(String(pin), 10);
    await db.query('UPDATE consignors SET portal_pin_hash=$1 WHERE id=$2', [hash, consignor_id]);
    res.json({ message: 'PIN set successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
