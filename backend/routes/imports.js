const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../db');
const { auth, requireRole } = require('../middleware/auth');
const { log } = require('../middleware/logger');

// ── CSV helpers ──────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

function parseCSVData(csvData) {
  const lines = csvData.trim().split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return null;
  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/\s+/g, '_'));
  return { headers, dataLines: lines.slice(1) };
}

function rowFromLine(headers, line) {
  const values = parseCSVLine(line);
  const row = {};
  headers.forEach((h, i) => { row[h] = (values[i] || '').trim() || null; });
  return row;
}

// ── Validation ───────────────────────────────────────────────────────────────

function validateRow(type, row) {
  const errors = [];
  if (type === 'inventory') {
    if (!row.title) errors.push('title is required');
    if (!row.condition) errors.push('condition is required');
    if (!row.price || isNaN(parseFloat(row.price))) errors.push('price must be a valid number');
  } else if (type === 'customers') {
    if (!row.name) errors.push('name is required');
  } else if (type === 'consignors') {
    if (!row.name) errors.push('name is required');
    if (!row.split_percentage || isNaN(parseFloat(row.split_percentage)))
      errors.push('split_percentage must be a valid number');
  } else if (type === 'users' || type === 'staff') {
    if (!row.name) errors.push('name is required');
    if (!row.email) errors.push('email is required');
    if (!row.role) errors.push('role is required');
    const valid = ['admin', 'owner', 'manager', 'cashier'];
    if (row.role && !valid.includes(row.role.toLowerCase()))
      errors.push('role must be: admin, owner, manager, or cashier');
  } else if (type === 'work_orders') {
    if (!row.job_type) errors.push('job_type is required');
    if (!row.description) errors.push('description is required');
  }
  return errors;
}

// ── Job helpers ───────────────────────────────────────────────────────────────

async function createJob(userId, type, total) {
  const result = await db.query(
    `INSERT INTO import_jobs (user_id, import_type, total_records, status)
     VALUES ($1, $2, $3, 'processing') RETURNING *`,
    [userId, type, total]
  );
  return result.rows[0];
}

async function finishJob(jobId, success, failed) {
  await db.query(
    `UPDATE import_jobs
     SET status='complete', successful_records=$1, failed_records=$2, completed_at=NOW()
     WHERE id=$3`,
    [success, failed, jobId]
  );
}

async function addError(jobId, rowNum, field, msg) {
  await db.query(
    `INSERT INTO import_errors (import_job_id, row_number, field_name, error_message)
     VALUES ($1, $2, $3, $4)`,
    [jobId, rowNum, field || '', msg]
  );
}

// ── POST /api/imports/preview ─────────────────────────────────────────────────
router.post('/preview', auth, requireRole('owner', 'manager'), (req, res) => {
  const { csv_data, type } = req.body;
  if (!csv_data || !type) return res.status(400).json({ error: 'csv_data and type are required' });
  const parsed = parseCSVData(csv_data);
  if (!parsed) return res.status(400).json({ error: 'CSV needs a header row + at least one data row' });

  const { headers, dataLines } = parsed;
  const preview = [];
  const rowErrors = {};

  dataLines.forEach((line, i) => {
    const row = rowFromLine(headers, line);
    const errs = validateRow(type, row);
    if (i < 5) preview.push(row);
    if (errs.length) rowErrors[i + 2] = errs;
  });

  res.json({
    headers,
    preview,
    total_rows: dataLines.length,
    error_count: Object.keys(rowErrors).length,
    row_errors: rowErrors,
  });
});

// ── POST /api/imports/inventory ───────────────────────────────────────────────
router.post('/inventory', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { csv_data } = req.body;
  if (!csv_data) return res.status(400).json({ error: 'csv_data is required' });
  const parsed = parseCSVData(csv_data);
  if (!parsed) return res.status(400).json({ error: 'CSV needs header + data rows' });

  const { headers, dataLines } = parsed;
  const job = await createJob(req.user.id, 'inventory', dataLines.length);
  let ok = 0, fail = 0;
  const rowErrors = [];

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 2;
    const row = rowFromLine(headers, dataLines[i]);
    const errs = validateRow('inventory', row);
    if (errs.length) {
      fail++;
      for (const e of errs) await addError(job.id, rowNum, '', e);
      rowErrors.push({ row: rowNum, errors: errs });
      continue;
    }
    try {
      await db.query(
        `INSERT INTO inventory
           (title, description, artist, genre, format, sku, \`condition\`, category,
            price, original_price, cost_basis, consignor_id, expiration_date, barcode, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING id`,
        [
          row.title, row.description || null, row.artist || null,
          row.genre || null, row.format || null, row.sku || null,
          row.condition, row.category || null,
          parseFloat(row.price),
          row.original_price ? parseFloat(row.original_price) : null,
          row.cost_basis ? parseFloat(row.cost_basis) : 0,
          row.consignor_id || null, row.expiration_date || null,
          row.barcode || null, row.status || 'available',
        ]
      );
      ok++;
    } catch (err) {
      fail++;
      const msg = err.code === 'ER_DUP_ENTRY' ? 'Duplicate barcode — skipped' : err.message;
      await addError(job.id, rowNum, '', msg);
      rowErrors.push({ row: rowNum, errors: [msg] });
    }
  }

  await finishJob(job.id, ok, fail);
  await log(req.user.id, 'bulk_import', 'inventory', null, { successCount: ok, errorCount: fail });
  res.json({ job_id: job.id, successCount: ok, errorCount: fail, row_errors: rowErrors });
});

// ── POST /api/imports/customers ───────────────────────────────────────────────
router.post('/customers', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { csv_data } = req.body;
  if (!csv_data) return res.status(400).json({ error: 'csv_data is required' });
  const parsed = parseCSVData(csv_data);
  if (!parsed) return res.status(400).json({ error: 'CSV needs header + data rows' });

  const { headers, dataLines } = parsed;
  const job = await createJob(req.user.id, 'customers', dataLines.length);
  let ok = 0, fail = 0;
  const rowErrors = [];

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 2;
    const row = rowFromLine(headers, dataLines[i]);
    const errs = validateRow('customers', row);
    if (errs.length) {
      fail++;
      for (const e of errs) await addError(job.id, rowNum, '', e);
      rowErrors.push({ row: rowNum, errors: errs });
      continue;
    }
    try {
      await db.query(
        `INSERT INTO customers (name, email, phone, notes, store_credit_balance, loyalty_points)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          row.name, row.email || null, row.phone || null, row.notes || null,
          row.store_credit_balance ? parseFloat(row.store_credit_balance) : 0,
          row.loyalty_points ? parseInt(row.loyalty_points) : 0,
        ]
      );
      ok++;
    } catch (err) {
      fail++;
      const msg = err.code === 'ER_DUP_ENTRY' ? 'Duplicate email — skipped' : err.message;
      await addError(job.id, rowNum, '', msg);
      rowErrors.push({ row: rowNum, errors: [msg] });
    }
  }

  await finishJob(job.id, ok, fail);
  await log(req.user.id, 'bulk_import', 'customers', null, { successCount: ok, errorCount: fail });
  res.json({ job_id: job.id, successCount: ok, errorCount: fail, row_errors: rowErrors });
});

// ── POST /api/imports/consignors ──────────────────────────────────────────────
router.post('/consignors', auth, requireRole('owner'), async (req, res) => {
  const { csv_data } = req.body;
  if (!csv_data) return res.status(400).json({ error: 'csv_data is required' });
  const parsed = parseCSVData(csv_data);
  if (!parsed) return res.status(400).json({ error: 'CSV needs header + data rows' });

  const { headers, dataLines } = parsed;
  const job = await createJob(req.user.id, 'consignors', dataLines.length);
  let ok = 0, fail = 0;
  const rowErrors = [];

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 2;
    const row = rowFromLine(headers, dataLines[i]);
    const errs = validateRow('consignors', row);
    if (errs.length) {
      fail++;
      for (const e of errs) await addError(job.id, rowNum, '', e);
      rowErrors.push({ row: rowNum, errors: errs });
      continue;
    }
    try {
      await db.query(
        `INSERT INTO consignors
           (name, email, phone, split_percentage, booth_fee_monthly, payout_schedule, contract_start, active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,1) RETURNING id`,
        [
          row.name, row.email || null, row.phone || null,
          parseFloat(row.split_percentage) || 50,
          row.booth_fee_monthly ? parseFloat(row.booth_fee_monthly) : 0,
          row.payout_schedule || 'monthly',
          row.contract_start || null,
        ]
      );
      ok++;
    } catch (err) {
      fail++;
      await addError(job.id, rowNum, '', err.message);
      rowErrors.push({ row: rowNum, errors: [err.message] });
    }
  }

  await finishJob(job.id, ok, fail);
  await log(req.user.id, 'bulk_import', 'consignors', null, { successCount: ok, errorCount: fail });
  res.json({ job_id: job.id, successCount: ok, errorCount: fail, row_errors: rowErrors });
});

// ── POST /api/imports/users  (staff) ─────────────────────────────────────────
router.post('/users', auth, requireRole('owner'), async (req, res) => {
  const { csv_data } = req.body;
  if (!csv_data) return res.status(400).json({ error: 'csv_data is required' });
  const parsed = parseCSVData(csv_data);
  if (!parsed) return res.status(400).json({ error: 'CSV needs header + data rows' });

  const { headers, dataLines } = parsed;
  const job = await createJob(req.user.id, 'users', dataLines.length);
  let ok = 0, fail = 0;
  const rowErrors = [];

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 2;
    const row = rowFromLine(headers, dataLines[i]);
    const errs = validateRow('users', row);
    if (errs.length) {
      fail++;
      for (const e of errs) await addError(job.id, rowNum, '', e);
      rowErrors.push({ row: rowNum, errors: errs });
      continue;
    }
    try {
      const rawPw = row.password || 'ChangeMe123!';
      const hash = await bcrypt.hash(rawPw, 10);
      await db.query(
        `INSERT INTO users (name, email, password_hash, role, active)
         VALUES ($1,$2,$3,$4,1) RETURNING id`,
        [row.name, row.email.toLowerCase().trim(), hash, row.role.toLowerCase()]
      );
      ok++;
    } catch (err) {
      fail++;
      const msg = err.code === 'ER_DUP_ENTRY' ? 'Email already exists — skipped' : err.message;
      await addError(job.id, rowNum, '', msg);
      rowErrors.push({ row: rowNum, errors: [msg] });
    }
  }

  await finishJob(job.id, ok, fail);
  await log(req.user.id, 'bulk_import', 'users', null, { successCount: ok, errorCount: fail });
  res.json({ job_id: job.id, successCount: ok, errorCount: fail, row_errors: rowErrors });
});

// ── POST /api/imports/work_orders ────────────────────────────────────────────
router.post('/work_orders', auth, requireRole('owner', 'manager'), async (req, res) => {
  const { csv_data } = req.body;
  if (!csv_data) return res.status(400).json({ error: 'csv_data is required' });
  const parsed = parseCSVData(csv_data);
  if (!parsed) return res.status(400).json({ error: 'CSV needs header + data rows' });

  const { headers, dataLines } = parsed;
  const job = await createJob(req.user.id, 'work_orders', dataLines.length);
  let ok = 0, fail = 0;
  const rowErrors = [];

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 2;
    const row = rowFromLine(headers, dataLines[i]);
    const errs = validateRow('work_orders', row);
    if (errs.length) {
      fail++;
      for (const e of errs) await addError(job.id, rowNum, '', e);
      rowErrors.push({ row: rowNum, errors: errs });
      continue;
    }
    try {
      await db.query(
        `INSERT INTO work_orders
           (customer_id, job_type, description, status, deposit_collected, estimated_completion_date, notes)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
        [
          row.customer_id || null, row.job_type, row.description,
          row.status || 'received',
          row.deposit_collected ? parseFloat(row.deposit_collected) : 0,
          row.estimated_completion_date || null,
          row.notes || null,
        ]
      );
      ok++;
    } catch (err) {
      fail++;
      await addError(job.id, rowNum, '', err.message);
      rowErrors.push({ row: rowNum, errors: [err.message] });
    }
  }

  await finishJob(job.id, ok, fail);
  await log(req.user.id, 'bulk_import', 'work_orders', null, { successCount: ok, errorCount: fail });
  res.json({ job_id: job.id, successCount: ok, errorCount: fail, row_errors: rowErrors });
});

// ── GET /api/imports/templates/:type ─────────────────────────────────────────
const TEMPLATES = {
  inventory: [
    'title,description,artist,genre,format,sku,condition,category,price,original_price,cost_basis,barcode,consignor_id,expiration_date,status',
    '"Dark Side of the Moon","1973 UK Press","Pink Floyd","Rock","Vinyl LP","HARVEST-DSOTM","Good","Records",24.99,30.00,10.00,LP-001,,,"available"',
    '"Abbey Road","1969 Original","The Beatles","Rock","Vinyl LP","APPLE-AR","Very Good","Records",34.99,45.00,15.00,LP-002,,,"available"',
  ].join('\n'),
  customers: [
    'name,email,phone,notes,store_credit_balance,loyalty_points',
    'John Smith,john@example.com,207-555-1234,"Regular customer",0,0',
    'Jane Doe,jane@example.com,207-555-5678,,10.00,25',
  ].join('\n'),
  consignors: [
    'name,email,phone,split_percentage,booth_fee_monthly,payout_schedule,contract_start',
    'Alice Vendor,alice@example.com,207-555-9999,60,0,monthly,2024-01-01',
    'Bob Booth,bob@example.com,207-555-8888,50,50,monthly,2024-03-15',
  ].join('\n'),
  users: [
    'name,email,role,password',
    'Sam Staff,sam@store.com,cashier,ChangeMe123!',
    'Mia Manager,mia@store.com,manager,ChangeMe123!',
  ].join('\n'),
  work_orders: [
    'customer_id,job_type,description,status,deposit_collected,estimated_completion_date,notes',
    ',vinyl_cleaning,"Clean 10 LPs",received,0,2024-06-01,"Handle with care"',
    ',repair,"Repair turntable needle",received,25.00,2024-06-15,',
  ].join('\n'),
};

router.get('/templates/:type', auth, (req, res) => {
  const template = TEMPLATES[req.params.type];
  if (!template) return res.status(404).json({ error: 'No template for: ' + req.params.type });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="import-template-${req.params.type}.csv"`);
  res.send(template);
});

// ── GET /api/imports/history ──────────────────────────────────────────────────
router.get('/history', auth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT j.*, u.name as user_name
       FROM import_jobs j
       LEFT JOIN users u ON u.id = j.user_id
       ORDER BY j.created_at DESC LIMIT 50`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/imports/history/:id/errors ──────────────────────────────────────
router.get('/history/:id/errors', auth, requireRole('owner', 'manager'), async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM import_errors WHERE import_job_id = $1 ORDER BY row_number ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
