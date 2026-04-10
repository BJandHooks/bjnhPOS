const db = require('../db');

const log = async (userId, action, entityType, entityId, details) => {
  try {
    await db.query(
      `INSERT INTO activity_log (user_id, action, entity_type, entity_id, details)
       VALUES ($1, $2, $3, $4, $5)`,
      [userId, action, entityType, entityId, details ? JSON.stringify(details) : null]
    );
  } catch (err) {
    console.error('Activity log error:', err);
  }
};

module.exports = { log };
