const router = require('express').Router();
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// Helper: Parse CSV line
function parseCSV(line) {
  const result = [];
  let current = '';
  let insideQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      insideQuotes = \!insideQuotes;
    } else if (char === ',' && \!insideQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// Helper: Validate row data
function validateImportRow(type, row, headers) {
  const errors = [];

  if (type === 'consignors') {
    if (\!row.name) errors.push('Name is required');
    if (\!row.split_percentage) errors.push('Split percentage is required');
  } else if (type === 'inventory') {
    if (\!row.title) errors.push('Title is required');
    if (\!row.condition) errors.push('Condition is required');
    if (\!row.price) errors.push('Price is required');
  } else if (type === 'customers') {
    if (\!row.name) errors.push('Name is required');
  } else if (type === 'sales') {
    if (\!row.customer_id) errors.push('Customer ID is required');
    if (\!row.total) errors.push('Total is required');
  }

  return errors;
}

// Helper: Create import job record
async function createImportJob(userId, type, totalRecords, status = 'pending') {
  const result = await db.query(
    `INSERT INTO import_jobs (user_id, import_type, total_records, status)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, type, totalRecords, status]
  );
  return result.rows[0];
}

// Helper: Log import error
async function logImportError(jobId, rowNum, fieldName, error) {
  await db.query(
    `INSERT INTO import_errors (import_job_id, row_number, field_name, error_message)
     VALUES ($1, $2, $3, $4)`,
    [jobId, rowNum, fieldName, error]
  );
}

// POST /api/imports/consignors
router.post('/consignors', auth, requireRole('owner'), async (req, res) => {
  const { csv_data } = req.body;

  try {
    const lines = csv_data.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have header row and at least one data row' });
    }

    const headers = parseCSV(lines[0]).map(h => h.toLowerCase());
    const job = await createImportJob(req.user.id, 'consignors', lines.length - 1, 'processing');

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSV(lines[i]);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || null;
      });

      const errors = validateImportRow('consignors', row, headers);
      if (errors.length > 0) {
        errorCount++;
        for (const err of errors) {
          await logImportError(job.id, i, '', err);
        }
        continue;
      }

      try {
        const custResult = await db.query(
          `INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3) RETURNING id`,
          [row.name, row.email || null, row.phone || null]
        );

        const consResult = await db.query(
          `INSERT INTO consignors (customer_id, name, email, phone, split_percentage, booth_fee_monthly, payout_schedule, contract_start)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
          [custResult.rows[0].id, row.name, row.email || null, row.phone || null,
           parseFloat(row.split_percentage) || 50, parseFloat(row.booth_fee_monthly) || 0,
           row.payout_schedule || 'monthly', row.contract_start || null]
        );

        results.push(consResult.rows[0]);
        successCount++;
      } catch (err) {
        errorCount++;
        await logImportError(job.id, i, '', err.message);
      }
    }

    await db.query(
      `UPDATE import_jobs SET status = 'complete', successful_records = $1, failed_records = $2 WHERE id = $3`,
      [successCount, errorCount, job.id]
    );

    await log(req.user.id, 'bulk_import', 'consignors', null, { successCount, errorCount });

    res.json({ job_id: job.id, successCount, errorCount, records: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/imports/inventory
router.post('/inventory', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { csv_data } = req.body;

  try {
    const lines = csv_data.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have header row and at least one data row' });
    }

    const headers = parseCSV(lines[0]).map(h => h.toLowerCase());
    const job = await createImportJob(req.user.id, 'inventory', lines.length - 1, 'processing');

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSV(lines[i]);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || null;
      });

      const errors = validateImportRow('inventory', row, headers);
      if (errors.length > 0) {
        errorCount++;
        for (const err of errors) {
          await logImportError(job.id, i, '', err);
        }
        continue;
      }

      try {
        const invResult = await db.query(
          `INSERT INTO inventory (title, description, condition, category, price, original_price, consignor_id, expiration_date, barcode)
           VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8) RETURNING *`,
          [row.title, row.description || null, row.condition, row.category || null,
           parseFloat(row.price), row.consignor_id || null, row.expiration_date || null, row.barcode || null]
        );

        results.push(invResult.rows[0]);
        successCount++;
      } catch (err) {
        errorCount++;
        await logImportError(job.id, i, '', err.message);
      }
    }

    await db.query(
      `UPDATE import_jobs SET status = 'complete', successful_records = $1, failed_records = $2 WHERE id = $3`,
      [successCount, errorCount, job.id]
    );

    await log(req.user.id, 'bulk_import', 'inventory', null, { successCount, errorCount });

    res.json({ job_id: job.id, successCount, errorCount, records: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/imports/customers
router.post('/customers', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { csv_data } = req.body;

  try {
    const lines = csv_data.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have header row and at least one data row' });
    }

    const headers = parseCSV(lines[0]).map(h => h.toLowerCase());
    const job = await createImportJob(req.user.id, 'customers', lines.length - 1, 'processing');

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSV(lines[i]);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || null;
      });

      const errors = validateImportRow('customers', row, headers);
      if (errors.length > 0) {
        errorCount++;
        for (const err of errors) {
          await logImportError(job.id, i, '', err);
        }
        continue;
      }

      try {
        const custResult = await db.query(
          `INSERT INTO customers (name, email, phone) VALUES ($1, $2, $3) RETURNING *`,
          [row.name, row.email || null, row.phone || null]
        );

        results.push(custResult.rows[0]);
        successCount++;
      } catch (err) {
        errorCount++;
        await logImportError(job.id, i, '', err.message);
      }
    }

    await db.query(
      `UPDATE import_jobs SET status = 'complete', successful_records = $1, failed_records = $2 WHERE id = $3`,
      [successCount, errorCount, job.id]
    );

    await log(req.user.id, 'bulk_import', 'customers', null, { successCount, errorCount });

    res.json({ job_id: job.id, successCount, errorCount, records: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/imports/sales
router.post('/sales', auth, requireRole('owner'), async (req, res) => {
  const { csv_data } = req.body;

  try {
    const lines = csv_data.trim().split('\n');
    if (lines.length < 2) {
      return res.status(400).json({ error: 'CSV must have header row and at least one data row' });
    }

    const headers = parseCSV(lines[0]).map(h => h.toLowerCase());
    const job = await createImportJob(req.user.id, 'sales', lines.length - 1, 'processing');

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (let i = 1; i < lines.length; i++) {
      const values = parseCSV(lines[i]);
      const row = {};
      headers.forEach((h, idx) => {
        row[h] = values[idx] || null;
      });

      const errors = validateImportRow('sales', row, headers);
      if (errors.length > 0) {
        errorCount++;
        for (const err of errors) {
          await logImportError(job.id, i, '', err);
        }
        continue;
      }

      try {
        const saleResult = await db.query(
          `INSERT INTO sales (customer_id, user_id, total, status, created_at)
           VALUES ($1, $2, $3, 'complete', $4) RETURNING *`,
          [row.customer_id, row.user_id || req.user.id, parseFloat(row.total), row.created_at || new Date()]
        );

        results.push(saleResult.rows[0]);
        successCount++;
      } catch (err) {
        errorCount++;
        await logImportError(job.id, i, '', err.message);
      }
    }

    await db.query(
      `UPDATE import_jobs SET status = 'complete', successful_records = $1, failed_records = $2 WHERE id = $3`,
      [successCount, errorCount, job.id]
    );

    await log(req.user.id, 'bulk_import', 'sales', null, { successCount, errorCount });

    res.json({ job_id: job.id, successCount, errorCount, records: results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/imports/templates/:type
router.get('/templates/:type', auth, (req, res) => {
  const templates = {
    consignors: 'name,email,phone,split_percentage,booth_fee_monthly,payout_schedule,contract_start\nExample Name,example@email.com,555-1234,50,100,monthly,2024-01-01',
    inventory: 'title,description,condition,category,price,barcode,consignor_id,expiration_date\nVintage Guitar,1970s acoustic,good,instruments,250.00,SKU123,cid-here,2024-12-31',
    customers: 'name,email,phone\nJohn Doe,john@example.com,555-1234\nJane Smith,jane@example.com,555-5678',
    sales: 'customer_id,user_id,total,created_at\ncid-here,uid-here,75.50,2024-01-15'
  };

  const template = templates[req.params.type];
  if (\!template) {
    return res.status(404).json({ error: 'Template not found' });
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="import-${req.params.type}.csv"`);
  res.send(template);
});

// GET /api/imports/history
router.get('/history', auth, requireRole('owner'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT j.*, u.name as user_name
       FROM import_jobs j
       LEFT JOIN users u ON u.id = j.user_id
       ORDER BY j.created_at DESC
       LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/imports/history/:id/errors
router.get('/history/:id/errors', auth, requireRole('owner'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM import_errors WHERE import_job_id = $1 ORDER BY row_number',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
