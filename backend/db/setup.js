/**
 * db/setup.js — Run schema.sql against MySQL
 * Usage: node db/setup.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function setup() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');

  // Split on semicolons to run statement by statement
  // (mysql2 doesn't support multi-statement by default)
  const statements = schema
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && \!s.startsWith('--'));

  const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || process.env.DB_DATABASE,
    multipleStatements: true,
  };

  console.log(`Connecting to MySQL at ${config.host}:${config.port}/${config.database}...`);
  const conn = await mysql.createConnection(config);

  let ok = 0;
  let skip = 0;
  for (const stmt of statements) {
    try {
      await conn.execute(stmt);
      ok++;
    } catch (err) {
      // Ignore "table already exists" and similar idempotent errors
      if (err.code === 'ER_TABLE_EXISTS_ERROR' || err.code === 'ER_DUP_KEYNAME') {
        skip++;
      } else {
        console.error('Error running statement:', stmt.substring(0, 80));
        console.error(err.message);
      }
    }
  }

  await conn.end();
  console.log(`Schema setup complete. ${ok} statements executed, ${skip} skipped (already exist).`);
}

setup().catch(err => {
  console.error('Fatal setup error:', err.message);
  process.exit(1);
});
