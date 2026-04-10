const express = require('express');
const router = express.Router();
const db = require('../db');
const { auth } = require('../middleware/auth');

function dateRange(query) {
  const end = query.end ? new Date(query.end) : new Date();
  const start = query.start ? new Date(query.start) : new Date(end.getFullYear(), 0, 1);
  return { start, end };
}

// Sales velocity by genre
router.get('/sales-velocity', auth, async (req, res) => {
  try {
    const { start, end } = dateRange(req.query);
    const result = await db.query(`
      SELECT
        COALESCE(i.genre, 'Unknown') AS genre,
        COUNT(si.id) AS units_sold,
        ROUND(COUNT(si.id)::numeric /
          NULLIF(TIMESTAMPDIFF(SECOND, $1, $2) / 604800, 0), 2
        ) AS units_per_week,
        SUM(si.sale_price) AS total_revenue
      FROM sale_items si
      JOIN sales s ON si.sale_id = s.id
      JOIN inventory i ON si.inventory_id = i.id
      WHERE s.created_at BETWEEN $1 AND $2 AND s.status = 'complete'
      GROUP BY genre ORDER BY units_per_week DESC
    `, [start, end]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Customer demographics
router.get('/customer-demographics', auth, async (req, res) => {
  try {
    const { start, end } = dateRange(req.query);
    const [spendBuckets, frequency, topGenres, vip] = await Promise.all([
      db.query(`
        SELECT CASE WHEN total_spend < 25 THEN 'Under $25' WHEN total_spend < 100 THEN '$25-$100'
          WHEN total_spend < 500 THEN '$100-$500' ELSE '$500+' END AS spend_bucket,
          COUNT(*) AS customer_count
        FROM (SELECT c.id, COALESCE(SUM(s.total), 0) AS total_spend FROM customers c
          LEFT JOIN sales s ON s.customer_id = c.id AND s.created_at BETWEEN $1 AND $2 AND s.status = 'complete'
          GROUP BY c.id) sub GROUP BY spend_bucket
      `, [start, end]),
      db.query(`
        SELECT CASE WHEN visit_count = 0 THEN 'Never purchased' WHEN visit_count = 1 THEN 'One-time'
          WHEN visit_count BETWEEN 2 AND 5 THEN 'Occasional (2-5)' ELSE 'Regular (6+)' END AS frequency_bucket,
          COUNT(*) AS customer_count
        FROM (SELECT c.id, COUNT(s.id) AS visit_count FROM customers c
          LEFT JOIN sales s ON s.customer_id = c.id AND s.created_at BETWEEN $1 AND $2 AND s.status = 'complete'
          GROUP BY c.id) sub GROUP BY frequency_bucket
      `, [start, end]),
      db.query(`
        SELECT COALESCE(i.genre, 'Unknown') AS genre, COUNT(DISTINCT s.customer_id) AS unique_customers
        FROM sale_items si JOIN sales s ON si.sale_id = s.id JOIN inventory i ON si.inventory_id = i.id
        WHERE s.created_at BETWEEN $1 AND $2 AND s.status = 'complete' AND s.customer_id IS NOT NULL
        GROUP BY genre ORDER BY unique_customers DESC LIMIT 10
      `, [start, end]),
      db.query(`SELECT CASE WHEN vip = true THEN 'VIP' ELSE 'Standard' END AS tier, COUNT(*) AS count FROM customers GROUP BY vip`),
    ]);
    res.json({ spend_distribution: spendBuckets.rows, frequency_distribution: frequency.rows, top_genres_by_customers: topGenres.rows, vip_vs_standard: vip.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Peak times
router.get('/peak-times', auth, async (req, res) => {
  try {
    const { start, end } = dateRange(req.query);
    const [byHour, byDay, byMonth] = await Promise.all([
      db.query(`SELECT EXTRACT(HOUR FROM created_at) AS hour, COUNT(*) AS transaction_count, ROUND(AVG(total)::numeric,2) AS avg_transaction FROM sales WHERE created_at BETWEEN $1 AND $2 AND status='complete' GROUP BY hour ORDER BY hour`, [start, end]),
      db.query(`SELECT DAYNAME(created_at) AS day_name, EXTRACT(DOW FROM created_at) AS day_num, COUNT(*) AS transaction_count, ROUND(AVG(total)::numeric,2) AS avg_transaction FROM sales WHERE created_at BETWEEN $1 AND $2 AND status='complete' GROUP BY day_name,day_num ORDER BY day_num`, [start, end]),
      db.query(`SELECT DATE_FORMAT(created_at, '%b') AS month_name, EXTRACT(MONTH FROM created_at) AS month_num, COUNT(*) AS transaction_count, ROUND(SUM(total)::numeric,2) AS total_revenue FROM sales WHERE created_at BETWEEN $1 AND $2 AND status='complete' GROUP BY month_name,month_num ORDER BY month_num`, [start, end]),
    ]);
    res.json({ by_hour: byHour.rows, by_day: byDay.rows, by_month: byMonth.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Conversion rate
router.get('/conversion-rate', auth, async (req, res) => {
  try {
    const { start, end } = dateRange(req.query);
    const result = await db.query(`
      WITH all_interactions AS (
        SELECT customer_id FROM sales WHERE created_at BETWEEN $1 AND $2 AND customer_id IS NOT NULL
        UNION SELECT customer_id FROM trades WHERE created_at BETWEEN $1 AND $2 AND customer_id IS NOT NULL
        UNION SELECT customer_id FROM work_orders WHERE created_at BETWEEN $1 AND $2 AND customer_id IS NOT NULL
      ), purchasers AS (
        SELECT DISTINCT customer_id FROM sales WHERE created_at BETWEEN $1 AND $2 AND status='complete' AND customer_id IS NOT NULL
      )
      SELECT COUNT(DISTINCT ai.customer_id) AS total_interactions, COUNT(DISTINCT p.customer_id) AS total_purchasers,
        ROUND(COUNT(DISTINCT p.customer_id)::numeric / NULLIF(COUNT(DISTINCT ai.customer_id),0)*100,2) AS conversion_rate_pct
      FROM all_interactions ai LEFT JOIN purchasers p USING (customer_id)
    `, [start, end]);
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Average transaction value
router.get('/avg-transaction', auth, async (req, res) => {
  try {
    const { start, end } = dateRange(req.query);
    const result = await db.query(`
      SELECT COUNT(*) AS total_transactions,
        ROUND(AVG(total),2) AS avg_transaction_value,
        ROUND(MIN(total),2) AS min_transaction,
        ROUND(MAX(total),2) AS max_transaction,
        ROUND(SUM(total),2) AS total_revenue
      FROM sales WHERE created_at BETWEEN $1 AND $2 AND status='complete'
    `, [start, end]);
    // MySQL median: AVG of middle row(s)
    const medianResult = await db.query(`
      SELECT ROUND(AVG(t.total),2) AS median_transaction FROM (
        SELECT total FROM sales
        WHERE created_at BETWEEN $1 AND $2 AND status='complete'
        ORDER BY total
        LIMIT 2 - (SELECT COUNT(*) FROM sales WHERE created_at BETWEEN $1 AND $2 AND status='complete') % 2
        OFFSET FLOOR((SELECT COUNT(*) FROM sales WHERE created_at BETWEEN $1 AND $2 AND status='complete') / 2)
      ) t
    `, [start, end, start, end, start, end]);
    res.json({ ...result.rows[0], median_transaction: medianResult.rows[0]?.median_transaction });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Basket analysis
router.get('/basket-analysis', auth, async (req, res) => {
  try {
    const { start, end } = dateRange(req.query);
    const result = await db.query(`
      SELECT a.category AS category_a, b.category AS category_b, COUNT(*) AS co_occurrence_count
      FROM sale_items sa JOIN sale_items sb ON sa.sale_id=sb.sale_id AND sa.id < sb.id
      JOIN inventory a ON sa.inventory_id=a.id JOIN inventory b ON sb.inventory_id=b.id
      JOIN sales s ON sa.sale_id=s.id
      WHERE s.created_at BETWEEN $1 AND $2 AND s.status='complete'
        AND a.category IS NOT NULL AND b.category IS NOT NULL AND a.category<>b.category
      GROUP BY category_a,category_b ORDER BY co_occurrence_count DESC LIMIT 20
    `, [start, end]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Seasonal trends
router.get('/seasonal-trends', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT EXTRACT(YEAR FROM created_at) AS year, EXTRACT(QUARTER FROM created_at) AS quarter,
        CONCAT(YEAR(created_at), '-', QUARTER(created_at)) AS label, COUNT(*) AS transactions,
        ROUND(SUM(total)::numeric,2) AS revenue, ROUND(AVG(total)::numeric,2) AS avg_sale
      FROM sales WHERE status='complete' GROUP BY year,quarter,label ORDER BY year,quarter
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Year over year
router.get('/year-over-year', auth, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT EXTRACT(YEAR FROM created_at) AS year, EXTRACT(MONTH FROM created_at) AS month,
        DATE_FORMAT(created_at, '%b') AS month_name, COUNT(*) AS transactions, ROUND(SUM(total)::numeric,2) AS revenue
      FROM sales WHERE status='complete' GROUP BY year,month,month_name ORDER BY year,month
    `);
    const byMonth = {};
    for (const row of result.rows) {
      const key = `${row.month}-${row.month_name}`;
      if (!byMonth[key]) byMonth[key] = { month: row.month, month_name: row.month_name, years: {} };
      byMonth[key].years[row.year] = { transactions: row.transactions, revenue: row.revenue };
    }
    res.json(Object.values(byMonth).sort((a,b) => a.month - b.month));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Inventory turnover
router.get('/inventory-turnover', auth, async (req, res) => {
  try {
    const { start, end } = dateRange(req.query);
    const result = await db.query(`
      SELECT COALESCE(inv.category,'Unknown') AS category,
        COUNT(DISTINCT si.inventory_id) AS units_sold,
        COUNT(DISTINCT inv.id) AS current_stock,
        ROUND(COUNT(DISTINCT si.inventory_id)::numeric / NULLIF(COUNT(DISTINCT inv.id),0),2) AS turnover_ratio,
        ROUND(AVG(TIMESTAMPDIFF(SECOND, inv.created_at, s.created_at)/86400),1) AS avg_days_to_sell
      FROM inventory inv
      LEFT JOIN sale_items si ON si.inventory_id=inv.id
      LEFT JOIN sales s ON si.sale_id=s.id AND s.created_at BETWEEN $1 AND $2 AND s.status='complete'
      GROUP BY inv.category ORDER BY turnover_ratio DESC /* MySQL: NULLs sort first on ASC */
    `, [start, end]);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shrinkage — get
router.get('/shrinkage', auth, async (req, res) => {
  try {
    const { start, end } = dateRange(req.query);
    const [byReason, total] = await Promise.all([
      db.query(`SELECT reason, COUNT(*) AS item_count, ROUND(SUM(cost_basis)::numeric,2) AS estimated_value_lost FROM shrinkage_log WHERE recorded_at BETWEEN $1 AND $2 GROUP BY reason ORDER BY item_count DESC`, [start, end]),
      db.query(`SELECT COUNT(*) AS total_items, ROUND(SUM(cost_basis)::numeric,2) AS total_value FROM shrinkage_log WHERE recorded_at BETWEEN $1 AND $2`, [start, end]),
    ]);
    res.json({ by_reason: byReason.rows, totals: total.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Shrinkage — log
router.post('/shrinkage', auth, async (req, res) => {
  const { inventory_id, reason, cost_basis, notes } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO shrinkage_log (inventory_id, reason, cost_basis, notes, recorded_by) VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [inventory_id, reason, cost_basis, notes, req.user.id]
    );
    await db.query(`UPDATE inventory SET status='shrinkage' WHERE id=$1`, [inventory_id]);
    res.status(201).json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Predictive inventory suggestions
router.get('/predictive-inventory', auth, async (req, res) => {
  try {
    const result = await db.query(`
      WITH velocity AS (
        SELECT COALESCE(i.genre,'Unknown') AS genre, COALESCE(i.category,'Unknown') AS category,
          COUNT(si.id) AS sold_last_90_days, ROUND(COUNT(si.id)::numeric/13,2) AS units_per_week
        FROM sale_items si JOIN sales s ON si.sale_id=s.id JOIN inventory i ON si.inventory_id=i.id
        WHERE s.created_at >= NOW()-INTERVAL '90 days' AND s.status='complete'
        GROUP BY genre,category
      ), stock AS (
        SELECT COALESCE(genre,'Unknown') AS genre, COALESCE(category,'Unknown') AS category, COUNT(*) AS current_stock
        FROM inventory WHERE status='available' GROUP BY genre,category
      )
      SELECT v.genre, v.category, v.sold_last_90_days, v.units_per_week,
        COALESCE(s.current_stock,0) AS current_stock,
        ROUND(COALESCE(s.current_stock,0)::numeric/NULLIF(v.units_per_week,0),1) AS weeks_of_stock_remaining,
        CASE WHEN COALESCE(s.current_stock,0)=0 THEN 'Out of stock'
          WHEN COALESCE(s.current_stock,0)::numeric/NULLIF(v.units_per_week,0)<2 THEN 'Critical - restock soon'
          WHEN COALESCE(s.current_stock,0)::numeric/NULLIF(v.units_per_week,0)<4 THEN 'Low - watch this'
          ELSE 'OK' END AS suggestion
      FROM velocity v LEFT JOIN stock s USING (genre,category)
      WHERE v.units_per_week > 0 ORDER BY weeks_of_stock_remaining ASC /* MySQL: NULLs sort last on DESC */
    `);
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Seasonal demand — current month historical comparison
router.get('/seasonal-demand', auth, async (req, res) => {
  try {
    const currentMonth = req.query.month ? parseInt(req.query.month) : new Date().getMonth() + 1;
    const result = await db.query(`
      SELECT COALESCE(i.genre,'Unknown') AS genre, EXTRACT(YEAR FROM s.created_at) AS year,
        COUNT(si.id) AS units_sold, ROUND(SUM(si.sale_price)::numeric,2) AS revenue
      FROM sale_items si JOIN sales s ON si.sale_id=s.id JOIN inventory i ON si.inventory_id=i.id
      WHERE EXTRACT(MONTH FROM s.created_at)=$1 AND s.status='complete'
      GROUP BY genre,year ORDER BY genre,year
    `, [currentMonth]);
    const byGenre = {};
    for (const row of result.rows) {
      if (!byGenre[row.genre]) byGenre[row.genre] = { genre: row.genre, years: {} };
      byGenre[row.genre].years[row.year] = { units_sold: row.units_sold, revenue: row.revenue };
    }
    res.json({ month: currentMonth, genres: Object.values(byGenre) });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Genre and artist trends
router.get('/genre-artist-trends', auth, async (req, res) => {
  try {
    const { start, end } = dateRange(req.query);
    const [genres, artists] = await Promise.all([
      db.query(`
        SELECT COALESCE(i.genre,'Unknown') AS genre, COUNT(si.id) AS units_sold,
          ROUND(SUM(si.sale_price)::numeric,2) AS revenue, ROUND(AVG(si.sale_price)::numeric,2) AS avg_price
        FROM sale_items si JOIN sales s ON si.sale_id=s.id JOIN inventory i ON si.inventory_id=i.id
        WHERE s.created_at BETWEEN $1 AND $2 AND s.status='complete'
        GROUP BY genre ORDER BY units_sold DESC LIMIT 20
      `, [start, end]),
      db.query(`
        SELECT COALESCE(i.artist,'Unknown') AS artist, COUNT(si.id) AS units_sold, ROUND(SUM(si.sale_price)::numeric,2) AS revenue
        FROM sale_items si JOIN sales s ON si.sale_id=s.id JOIN inventory i ON si.inventory_id=i.id
        WHERE s.created_at BETWEEN $1 AND $2 AND s.status='complete' AND i.artist IS NOT NULL
        GROUP BY artist ORDER BY units_sold DESC LIMIT 20
      `, [start, end]),
    ]);
    res.json({ top_genres: genres.rows, top_artists: artists.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Customer purchase patterns
router.get('/customer-purchase-patterns', auth, async (req, res) => {
  try {
    const { start, end } = dateRange(req.query);
    const [repeatRate, avgGap, topCustomers, churnRisk] = await Promise.all([
      db.query(`
        SELECT COUNT(DISTINCT customer_id) AS total_customers,
          COUNT(DISTINCT CASE WHEN visit_count>1 THEN customer_id END) AS repeat_customers,
          ROUND(COUNT(DISTINCT CASE WHEN visit_count>1 THEN customer_id END)::numeric/NULLIF(COUNT(DISTINCT customer_id),0)*100,2) AS repeat_rate_pct
        FROM (SELECT customer_id, COUNT(*) AS visit_count FROM sales
          WHERE created_at BETWEEN $1 AND $2 AND status='complete' AND customer_id IS NOT NULL GROUP BY customer_id) sub
      `, [start, end]),
      db.query(`
        SELECT ROUND(AVG(gap_days)::numeric,1) AS avg_days_between_purchases
        FROM (SELECT customer_id,
          TIMESTAMPDIFF(SECOND, LAG(created_at) OVER (PARTITION BY customer_id ORDER BY created_at), created_at)/86400 AS gap_days
          FROM sales WHERE status='complete' AND customer_id IS NOT NULL) sub WHERE gap_days IS NOT NULL
      `),
      db.query(`
        SELECT c.id, c.first_name, c.last_name, COUNT(s.id) AS total_purchases,
          ROUND(SUM(s.total)::numeric,2) AS lifetime_value, MAX(s.created_at) AS last_purchase
        FROM customers c JOIN sales s ON s.customer_id=c.id
        WHERE s.created_at BETWEEN $1 AND $2 AND s.status='complete'
        GROUP BY c.id,c.first_name,c.last_name ORDER BY lifetime_value DESC LIMIT 20
      `, [start, end]),
      db.query(`
        SELECT COUNT(DISTINCT customer_id) AS at_risk_customers FROM sales
        WHERE status='complete' AND customer_id IS NOT NULL
          AND created_at BETWEEN DATE_SUB($1, INTERVAL TIMESTAMPDIFF(SECOND, $1, $2) SECOND) AND $1
          AND customer_id NOT IN (
            SELECT DISTINCT customer_id FROM sales WHERE status='complete' AND customer_id IS NOT NULL AND created_at BETWEEN $1 AND $2
          )
      `, [start, end]),
    ]);
    res.json({ repeat_rate: repeatRate.rows[0], avg_purchase_gap: avgGap.rows[0], top_customers: topCustomers.rows, churn_risk: churnRisk.rows[0] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Theft prevention
router.get('/theft-prevention', auth, async (req, res) => {
  try {
    const { start, end } = dateRange(req.query);
    const [shrinkage, voidedSales, refunds, staffActivity] = await Promise.all([
      db.query(`SELECT reason, COUNT(*) AS count, ROUND(SUM(cost_basis)::numeric,2) AS value_lost FROM shrinkage_log WHERE recorded_at BETWEEN $1 AND $2 GROUP BY reason ORDER BY count DESC`, [start, end]),
      db.query(`SELECT COUNT(*) AS voided_count, ROUND(SUM(total)::numeric,2) AS voided_value FROM sales WHERE status='voided' AND created_at BETWEEN $1 AND $2`, [start, end]),
      db.query(`SELECT COUNT(*) AS refund_count, ROUND(SUM(refund_amount)::numeric,2) AS total_refunded FROM returns WHERE created_at BETWEEN $1 AND $2`, [start, end]),
      db.query(`
        SELECT u.first_name, u.last_name, u.role, COUNT(*) AS action_count, al.action_type
        FROM activity_log al JOIN users u ON al.user_id=u.id
        WHERE al.created_at BETWEEN $1 AND $2
          AND al.action_type IN ('void_sale','process_return','override_price','log_shrinkage')
        GROUP BY u.first_name,u.last_name,u.role,al.action_type ORDER BY action_count DESC LIMIT 20
      `, [start, end]),
    ]);
    res.json({ shrinkage_by_reason: shrinkage.rows, voided_sales: voidedSales.rows[0], refunds: refunds.rows[0], staff_flag_activity: staffActivity.rows });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
