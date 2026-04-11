/**
 * db/index.js — mysql2 wrapper with pg-compatible interface
 *
 * Route files call:   db.query(sql, params)  and expect back { rows: [...] }
 *
 * This wrapper:
 *  1. Converts $1/$2/... placeholders to ?
 *  2. Strips PostgreSQL type casts (::numeric, ::text, etc.)
 *  3. Converts ILIKE to LIKE, INTERVAL syntax, date/time literals, booleans
 *  4. Converts json_agg() -> JSON_ARRAYAGG(), json_build_object() -> JSON_OBJECT()
 *  5. RETURNING on INSERT: pre-injects a UUID so the inserted row can be fetched back
 *  6. Auto-serializes Array/Object params to JSON strings for JSON columns
 */

const mysql = require('mysql2/promise');
const { v4: uuidv4 } = require('uuid');

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
      connectionLimit: 10,
      charset: 'utf8mb4',
    };
  }
  return {
    host:     process.env.DB_HOST     || 'localhost',
    port:     parseInt(process.env.DB_PORT) || 3306,
    user:     process.env.DB_USER     || process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME     || process.env.DB_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
  };
}

const pool = mysql.createPool(getConfig());

function transformSQL(sql) {
  let s = sql;
  s = s.replace(/\$\d+/g, '?');
  s = s.replace(/::(numeric|decimal|text|int|integer|bigint|boolean|uuid|date|timestamp|varchar|float|double|char)/gi, '');
  s = s.replace(/::timestamptz/gi, '');
  s = s.replace(/\bILIKE\b/gi, 'LIKE');
  s = s.replace(/INTERVAL\s+'(\d+)\s+(day|days|month|months|year|years|hour|hours|minute|minutes|second|seconds)'/gi,
    (_, n, unit) => `INTERVAL ${n} ${unit.toUpperCase().replace(/S$/, '')}`
  );
  s = s.replace(/\bCURRENT_DATE\b/gi, 'CURDATE()');
  s = s.replace(/\bCURRENT_TIMESTAMP\b/gi, 'NOW()');
  s = s.replace(/\bTRUE\b/g,  '1');
  s = s.replace(/\bFALSE\b/g, '0');
  s = s.replace(/EXTRACT\s*\(\s*HOUR\s+FROM\s+([^)]+)\)/gi,    'HOUR($1)');
  s = s.replace(/EXTRACT\s*\(\s*MINUTE\s+FROM\s+([^)]+)\)/gi,  'MINUTE($1)');
  s = s.replace(/EXTRACT\s*\(\s*SECOND\s+FROM\s+([^)]+)\)/gi,  'SECOND($1)');
  s = s.replace(/EXTRACT\s*\(\s*DOW\s+FROM\s+([^)]+)\)/gi,     '(DAYOFWEEK($1) - 1)');
  s = s.replace(/EXTRACT\s*\(\s*DOY\s+FROM\s+([^)]+)\)/gi,     'DAYOFYEAR($1)');
  s = s.replace(/EXTRACT\s*\(\s*MONTH\s+FROM\s+([^)]+)\)/gi,   'MONTH($1)');
  s = s.replace(/EXTRACT\s*\(\s*YEAR\s+FROM\s+([^)]+)\)/gi,    'YEAR($1)');
  s = s.replace(/EXTRACT\s*\(\s*DAY\s+FROM\s+([^)]+)\)/gi,     'DAY($1)');
  s = s.replace(/EXTRACT\s*\(\s*WEEK\s+FROM\s+([^)]+)\)/gi,    'WEEK($1)');
  s = s.replace(/EXTRACT\s*\(\s*QUARTER\s+FROM\s+([^)]+)\)/gi, 'QUARTER($1)');
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'Day'\s*\)/gi,      'DAYNAME($1)');
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'day'\s*\)/gi,      'LOWER(DAYNAME($1))');
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'Mon'\s*\)/gi,      "DATE_FORMAT($1, '%b')");
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'Month'\s*\)/gi,    'MONTHNAME($1)');
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'YYYY-MM'\s*\)/gi,  "DATE_FORMAT($1, '%Y-%m')");
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'YYYY'\s*\)/gi,     'YEAR($1)');
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'HH24:MI'\s*\)/gi,  "DATE_FORMAT($1, '%H:%i')");
  s = s.replace(/TO_CHAR\s*\(\s*([^,]+),\s*'DD'\s*\)/gi,       'DAY($1)');
  // PostgreSQL aggregate functions -> MySQL equivalents
  s = s.replace(/\bjson_agg\s*\(/gi,          'JSON_ARRAYAGG(');
  s = s.replace(/\bjson_build_object\s*\(/gi,  'JSON_OBJECT(');
  // Strip RETURNING — handled separately
  s = s.replace(/\s+RETURNING\s+.*/si, '');
  return s;
}

function extractReturning(sql) {
  const m = sql.match(/\s+RETURNING\s+(.*)/si);
  return m ? m[1].trim() : null;
}

/**
 * For INSERT + RETURNING on UUID-keyed tables:
 * Inject a pre-generated UUID so we can fetch the exact row back after insert.
 * Skips injection if the INSERT already specifies an `id` column.
 */
function injectUUID(sql, params) {
  const isInsert = /^\s*INSERT\s+INTO/i.test(sql);
  if (!isInsert) return null;
  const hasId = /INSERT\s+INTO\s+`?\w+`?\s*\(\s*`?id`?\s*[,)]/i.test(sql);
  if (hasId) return null;

  const id = uuidv4();
  const modifiedSQL = sql
    .replace(/(INSERT\s+INTO\s+`?\w+`?\s*\()/i, '$1id, ')
    .replace(/VALUES\s*\(/i,                      'VALUES (?, ');
  return { modifiedSQL, modifiedParams: [id, ...params], injectedId: id };
}

function serializeParams(params) {
  if (!params) return params;
  return params.map(p => {
    if (p === null || p === undefined) return p;
    if (Array.isArray(p) || (typeof p === 'object' && !(p instanceof Date))) return JSON.stringify(p);
    return p;
  });
}

async function query(sql, params = []) {
  const returning    = extractReturning(sql);
  let sqlToUse       = sql;
  let paramsToUse    = params;
  let injectedId     = null;

  if (returning && /^\s*INSERT\s+INTO/i.test(sql)) {
    const u = injectUUID(sql, params);
    if (u) { sqlToUse = u.modifiedSQL; paramsToUse = u.modifiedParams; injectedId = u.injectedId; }
  }

  const transformed = transformSQL(sqlToUse);
  const serialized  = serializeParams(paramsToUse);
  const conn        = await pool.getConnection();

  try {
    const [results] = await conn.execute(transformed, serialized);

    if (returning && /^\s*INSERT\s+INTO/i.test(sql)) {
      const tableMatch = sql.match(/INSERT\s+INTO\s+`?(\w+)`?/i);
      if (tableMatch) {
        const tbl = tableMatch[1];
        const lookupId = injectedId || (results.insertId > 0 ? results.insertId : null);
        if (lookupId) {
          const [rows] = await conn.execute(`SELECT * FROM \`${tbl}\` WHERE id = ?`, [lookupId]);
          conn.release();
          return { rows };
        }
      }
      conn.release();
      return { rows: [] };
    }

    if (returning && (/^\s*UPDATE/i.test(sql) || /^\s*DELETE/i.test(sql))) {
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
 * Transaction support via getClient().
 *   const client = await db.getClient();
 *   await client.query('BEGIN');
 *   ...
 *   await client.query('COMMIT');
 *   client.release();
 */
async function getClient() {
  const conn = await pool.getConnection();

  async function txQuery(sql, params = []) {
    if (sql.trim() === 'BEGIN')     { await conn.beginTransaction(); return { rows: [] }; }
    if (sql.trim() === 'COMMIT')    { await conn.commit();           return { rows: [] }; }
    if (sql.trim() === 'ROLLBACK')  { await conn.rollback();         return { rows: [] }; }

    const returning = extractReturning(sql);
    let sqlToUse    = sql;
    let paramsToUse = params;
    let injectedId  = null;

    if (returning && /^\s*INSERT\s+INTO/i.test(sql)) {
      const u = injectUUID(sql, params);
      if (u) { sqlToUse = u.modifiedSQL; paramsToUse = u.modifiedParams; injectedId = u.injectedId; }
    }

    const transformed = transformSQL(sqlToUse);
    const serialized  = serializeParams(paramsToUse);
    const [results]   = await conn.execute(transformed, serialized);

    if (returning && /^\s*INSERT\s+INTO/i.test(sql)) {
      const tableMatch = sql.match(/INSERT\s+INTO\s+`?(\w+)`?/i);
      if (tableMatch) {
        const tbl = tableMatch[1];
        const lookupId = injectedId || (results.insertId > 0 ? results.insertId : null);
        if (lookupId) {
          const [rows] = await conn.execute(`SELECT * FROM \`${tbl}\` WHERE id = ?`, [lookupId]);
          return { rows };
        }
      }
      return { rows: [] };
    }

    return { rows: Array.isArray(results) ? results : [] };
  }

  return { query: txQuery, release: () => conn.release() };
}

module.exports = { query, getClient, pool };
