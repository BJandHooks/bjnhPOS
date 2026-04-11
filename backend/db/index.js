/**
 * db/index.js — mysql2 wrapper with pg-compatible interface
 *
 * All route files call:  db.query(sql, params)
 * and expect back:       { rows: [...] }
 *
 * This wrapper:
 *  1. Converts $1/$2/... placeholders to ?
 *  2. Strips PostgreSQL type casts (::numeric, ::text, etc.)
 *  3. Converts ILIKE to LIKE
 *  4. Converts INTERVAL 'N unit' → INTERVAL N UNIT
 *  5. Converts CURRENT_DATE/CURRENT_TIMESTAMP
 *  6. Converts TRUE/FALSE literals → 1/0
 *  7. Handles RETURNING clauses by stripping and re-fetching
 *  8. Auto-serializes Array/Object params to JSON strings for JSON columns
 */

const mysql = require('mysql2/promise');

function getConfig() {
  const url = process.env.DATABASE_URL;
  if (url && url.startsWith('mysql://')) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: parseInt(u.port) || 3306,
      user: u.username,
      password: u.password,
      database: u.pathname.replace(/^\//, ''),
      waitForConnections: true,
      connectionLimit: 2,
      charset: 'utf8mb4',
    };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 2,
    charset: 'utf8mb4',
  };
}

const pool = mysql.createPool(getConfig());

function transformSQL(sql) {
  let s = sql;
  // $1, $2, ... → ?
  s = s.replace(/\$\d+/g, '?');
  // Strip type casts
  s = s.replace(/::(numeric|decimal|text|int|integer|bigint|boolean|uuid|date|timestamp|varchar|float|double|char)/gi, '');
  // ILIKE → LIKE
  s = s.replace(/\bILIKE\b/gi, 'LIKE');
  // INTERVAL 'N unit' → INTERVAL N UNIT
  s = s.replace(/INTERVAL\s+'(\d+)\s+(day|days|month|months|year|years|hour|hours|minute|minutes|second|seconds)'/gi,
    (_, n, unit) => `INTERVAL ${n} ${unit.toUpperCase().replace(/S$/, '')}`
  );
  // Date/time literals
  s = s.replace(/\bCURRENT_DATE\b/gi, 'CURDATE()');
  s = s.replace(/\bCURRENT_TIMESTAMP\b/gi, 'NOW()');
  // Boolean literals
  s = s.replace(/\bTRUE\b/g, '1');
  s = s.replace(/\bFALSE\b/g, '0');
  // EXTRACT transforms: EXTRACT(HOUR FROM x) → HOUR(x), etc.
  s = s.replace(/EXTRACT\s*\(\s*HOUR\s+FROM\s+([^)]+)\)/gi, 'HOUR($1)');
  s = s.replace(/EXTRACT\s*\(\s*MINUTE\s+FROM\s+([^)]+)\)/gi, 'MINUTE($1)');
  s = s.replace(/EXTRACT\s*\(\s*SECOND\s+FROM\s+([^)]+)\)/gi, 'SECOND($1)');
  s = s.replace(/EXTRACT\s*\(\s*DOW\s+FROM\s+([^)]+)\)/gi, '(DAYOFWEEK($1) - 1)');
  s = s.replace(/EXTRACT\s*\(\s*DOY\s+FROM\s+([^)]+)\)/gi, 'DAYOFYEAR($1)');
  s = s.replace(/EXTRACT\s*\(\s*MONTH\s+FROM\s+([^)]+)\)/gi, 'MONTH($1)');
  s = s.replace(/EXTRACT\s*\(\s*YEAR\s+FROM\s+([^)]+)\)/gi, 'YEAR($1)');
  s = s.replace(/EXTRACT\s*\(\s*DAY\s+FROM\s+([^)]+)\)/gi, 'DAY($1)');
  s = s.replace(/EXTRACT\s*\(\s*WEEK\s+FROM\s+([^)]+)\)/gi, 'WEEK($1)');
  s = s.replace(/EXTRACT\s*\(\s*QUARTER\s+FROM\s+([^)]+)\)/gi, 'QUARTER($1)');
  // EXTRACT(EPOCH FROM (a - b)) → TIMESTAMPDIFF(SECOND, b, a)  (handled manually in analytics.js)

  // TO_CHAR date formatting → DATE_FORMAT / MySQL equivalents
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'Day'\s*\)/gi, 'DAYNAME($1)');
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'day'\s*\)/gi, 'LOWER(DAYNAME($1))');
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'Mon'\s*\)/gi, "DATE_FORMAT($1, '%b')");
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'Month'\s*\)/gi, 'MONTHNAME($1)');
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'YYYY-MM'\s*\)/gi, "DATE_FORMAT($1, '%Y-%m')");
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'YYYY'\s*\)/gi, "YEAR($1)");
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'HH24:MI'\s*\)/gi, "DATE_FORMAT($1, '%H:%i')");
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'DD'\s*\)/gi, "DAY($1)");

  // ::timestamptz casts (missed by earlier cast strip since it has 'tz')
  s = s.replace(/::timestamptz/gi, '');

  // Strip RETURNING clause
  s = s.replace(/\s+RETURNING\s+.*/si, '');
  return s;
}

function extractReturning(sql) {
  const match = sql.match(/\s+RETURNING\s+(.*)/si);
  return match ? match[1].trim() : null;
}

/**
 * Auto-serialize any Array or plain Object params to JSON strings.
 * MySQL's JSON columns need strings, not native JS arrays/objects.
 */
function serializeParams(params) {
  if (!params) return params;
  return params.map(p => {
    if (p === null || p === undefined) return p;
    if (Array.isArray(p) || (typeof p === 'object' && !(p instanceof Date))) {
      return JSON.stringify(p);
    }
    return p;
  });
}

async function query(sql, params = []) {
  const returning = extractReturning(sql);
  const transformed = transformSQL(sql);
  const serialized = serializeParams(params);

  const conn = await pool.getConnection();
  try {
    const [results] = await conn.execute(transformed, serialized);

    if (returning && sql.trim().toUpperCase().startsWith('INSERT')) {
      const insertId = results.insertId;
      if (insertId && insertId > 0) {
        const tableMatch = sql.match(/INSERT\s+INTO\s+[`]?(\w+)[`]?/i);
        if (tableMatch) {
          const table = tableMatch[1];
          const [rows] = await conn.execute(`SELECT * FROM \`${table}\` WHERE id = LAST_INSERT_ID()`);
          conn.release();
          return { rows };
        }
      }
      conn.release();
      return { rows: Array.isArray(results) ? results : [results] };
    }

    if (returning && (sql.trim().toUpperCase().startsWith('UPDATE') || sql.trim().toUpperCase().startsWith('DELETE'))) {
      conn.release();
      return { rows: results.affectedRows > 0 ? [{ affected: results.affectedRows }] : [] };
    }

    conn.release();
    return { rows: Array.isArray(results) ? results : [] };
  } catch (err) {
    conn.release();
    throw err;
  }
}

/**
 * Transaction support.
 * const client = await db.getClient();
 * await client.query('BEGIN');
 * await client.query('COMMIT');
 * client.release();
 */
async function getClient() {
  const conn = await pool.getConnection();
  return {
    query: async (sql, params = []) => {
      if (sql.trim() === 'BEGIN') { await conn.beginTransaction(); return { rows: [] }; }
      if (sql.trim() === 'COMMIT') { await conn.commit(); return { rows: [] }; }
      if (sql.trim() === 'ROLLBACK') { await conn.rollback(); return { rows: [] }; }
      const returning = extractReturning(sql);
      const transformed = transformSQL(sql);
      const serialized = serializeParams(params);
      const [results] = await conn.execute(transformed, serialized);
      if (returning && sql.trim().toUpperCase().startsWith('INSERT')) {
        const tableMatch = sql.match(/INSERT\s+INTO\s+[`]?(\w+)[`]?/i);
        if (tableMatch) {
          const table = tableMatch[1];
          const [rows] = await conn.execute(`SELECT * FROM \`${table}\` WHERE id = LAST_INSERT_ID()`);
          return { rows };
        }
      }
      return { rows: Array.isArray(results) ? results : [] };
    },
    release: () => conn.release(),
  };
}

module.exports = { query, getClient, pool };
