/**
 * dashboard.js — Operational dashboard data
 * Fast, read-only queries for daily staff use.
 */
const router = require('express').Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

// GET /api/dashboard
router.get('/', auth, async (req, res) => {
  try {
    const [dailySummary, recentSales, upcomingEvents, openTasks, weekTrend] = await Promise.all([

      // Today's totals
      db.query(
        `SELECT
           COALESCE(SUM(total), 0)  AS daily_total,
           COUNT(*)                 AS transaction_count,
           COALESCE(AVG(total), 0)  AS avg_sale_value
         FROM sales
         WHERE voided = 0
           AND status = 'complete'
           AND DATE(created_at) = CURDATE()`
      ),

      // Recent 20 sales
      db.query(
        `SELECT s.id, s.total, s.created_at, s.status,
                COALESCE(c.name, 'Walk-in') AS customer_name,
                u.name AS staff_name
         FROM sales s
         LEFT JOIN customers c ON c.id = s.customer_id
         LEFT JOIN users u ON u.id = s.user_id
         WHERE s.voided = 0
         ORDER BY s.created_at DESC
         LIMIT 20`
      ),

      // Next 10 events
      db.query(
        `SELECT id, title, event_type, start_date, end_date, location, status, capacity, is_free, price
         FROM events
         WHERE start_date >= NOW() AND status != 'cancelled'
         ORDER BY start_date ASC
         LIMIT 10`
      ),

      // Open tasks
      db.query(
        `SELECT t.id, t.title, t.notes, t.due_date, t.created_at,
                u1.name AS assigned_to_name,
                u2.name AS assigned_by_name
         FROM tasks t
         LEFT JOIN users u1 ON u1.id = t.assigned_to_user_id
         LEFT JOIN users u2 ON u2.id = t.assigned_by_user_id
         WHERE t.completed = 0
         ORDER BY
           CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
           t.due_date ASC
         LIMIT 15`
      ),

      // 7-day trend
      db.query(
        `SELECT DATE(created_at) AS sale_date,
                COALESCE(SUM(total), 0) AS day_total,
                COUNT(*) AS day_count
         FROM sales
         WHERE voided = 0 AND status = 'complete'
           AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
         GROUP BY DATE(created_at)
         ORDER BY sale_date ASC`
      ),
    ]);

    const s = dailySummary.rows[0] || {};
    res.json({
      daily_total:       parseFloat(s.daily_total)   || 0,
      transaction_count: parseInt(s.transaction_count) || 0,
      avg_sale_value:    parseFloat(s.avg_sale_value) || 0,
      recent_sales:      recentSales.rows,
      upcoming_events:   upcomingEvents.rows,
      open_tasks:        openTasks.rows,
      week_trend:        weekTrend.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/sales-summary
// Today vs yesterday vs this-week vs last-week
router.get('/sales-summary', auth, async (req, res) => {
  try {
    const [today, yesterday, thisWeek, lastWeek, topItems] = await Promise.all([
      db.query(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM sales
                WHERE voided=0 AND status='complete' AND DATE(created_at)=CURDATE()`),
      db.query(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM sales
                WHERE voided=0 AND status='complete'
                  AND DATE(created_at)=DATE_SUB(CURDATE(),INTERVAL 1 DAY)`),
      db.query(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM sales
                WHERE voided=0 AND status='complete'
                  AND YEARWEEK(created_at,1)=YEARWEEK(NOW(),1)`),
      db.query(`SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM sales
                WHERE voided=0 AND status='complete'
                  AND YEARWEEK(created_at,1)=YEARWEEK(DATE_SUB(NOW(),INTERVAL 1 WEEK),1)`),
      db.query(
        `SELECT i.title, i.genre, i.format,
                COUNT(si.id) AS units_sold,
                SUM(si.price_at_sale) AS revenue
         FROM sale_items si
         JOIN inventory i ON i.id = si.inventory_id
         JOIN sales s ON s.id = si.sale_id
         WHERE s.voided=0 AND s.status='complete' AND DATE(s.created_at)=CURDATE()
         GROUP BY i.id, i.title, i.genre, i.format
         ORDER BY units_sold DESC
         LIMIT 5`
      ),
    ]);
    res.json({
      today:          today.rows[0],
      yesterday:      yesterday.rows[0],
      this_week:      thisWeek.rows[0],
      last_week:      lastWeek.rows[0],
      top_items_today: topItems.rows,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
