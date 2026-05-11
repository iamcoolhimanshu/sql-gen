const mysql = require('mysql2/promise');
const { query, queryOne } = require('../models/appDb');
const { generateSQL } = require('../services/sqlGenerator');

function deobfuscate(encoded) {
  const key = process.env.JWT_SECRET || 'default-key';
  const nums = Buffer.from(encoded, 'base64').toString().split(',').map(Number);
  return nums.map((n, i) => String.fromCharCode(n ^ key.charCodeAt(i % key.length))).join('');
}

async function getTargetConnection(connectionId, userId) {
  const conn = await queryOne(
    'SELECT * FROM db_connections WHERE id = ? AND user_id = ?',
    [connectionId, userId]
  );
  if (!conn) throw Object.assign(new Error('Connection not found'), { status: 404 });

  return mysql.createConnection({
    host: conn.host,
    port: conn.port,
    database: conn.database_name,
    user: conn.username,
    password: deobfuscate(conn.password_encrypted),
    ssl: conn.ssl_enabled ? { rejectUnauthorized: false } : undefined,
    connectTimeout: 10000,
  });
}

async function generate(req, res, next) {
  try {
    const { naturalLanguage, connectionId } = req.body;
    if (!naturalLanguage || !connectionId)
      return res.status(400).json({ error: 'naturalLanguage and connectionId are required' });

    // Fetch schema for context
    const conn = await queryOne(
      'SELECT * FROM db_connections WHERE id = ? AND user_id = ?',
      [connectionId, req.user.userId]
    );
    if (!conn) return res.status(404).json({ error: 'Connection not found' });

    let schema = [];
    let schemaConn;
    try {
      schemaConn = await mysql.createConnection({
        host: conn.host, port: conn.port,
        database: conn.database_name, user: conn.username,
        password: deobfuscate(conn.password_encrypted),
        connectTimeout: 8000,
      });

      const [cols] = await schemaConn.execute(`
        SELECT c.TABLE_NAME, c.COLUMN_NAME, c.DATA_TYPE, c.COLUMN_KEY
        FROM INFORMATION_SCHEMA.COLUMNS c
        JOIN INFORMATION_SCHEMA.TABLES t ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
        WHERE c.TABLE_SCHEMA = ? AND t.TABLE_TYPE = 'BASE TABLE'
        ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
      `, [conn.database_name]);

      await schemaConn.end();

      const schemaMap = {};
      for (const row of cols) {
        if (!schemaMap[row.TABLE_NAME]) {
          schemaMap[row.TABLE_NAME] = { schema: conn.database_name, name: row.TABLE_NAME, columns: [] };
        }
        schemaMap[row.TABLE_NAME].columns.push({
          name: row.COLUMN_NAME,
          type: row.DATA_TYPE,
          isPrimaryKey: row.COLUMN_KEY === 'PRI',
          isForeignKey: row.COLUMN_KEY === 'MUL',
        });
      }
      schema = Object.values(schemaMap);
    } catch (e) {
      if (schemaConn) await schemaConn.end().catch(() => {});
      return res.status(400).json({ error: 'Could not fetch schema: ' + e.message });
    }

    const { sql, method } = await generateSQL(naturalLanguage, schema, 'mysql');
    res.json({ sql, method, naturalLanguage });
  } catch (err) { next(err); }
}

async function run(req, res, next) {
  try {
    const { sql, connectionId, page = 1, pageSize = 50 } = req.body;

    if (!sql || !connectionId)
      return res.status(400).json({ error: 'sql and connectionId are required' });

    // Security: only SELECT
    const cleanSQL = sql.trim().toLowerCase();
    if (!cleanSQL.startsWith('select') && !cleanSQL.startsWith('with'))
      return res.status(400).json({ error: 'Only SELECT queries are allowed' });

    const blocked = ['drop','delete','insert','update','truncate','alter','create','grant','revoke'];
    for (const word of blocked) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(sql))
        return res.status(400).json({ error: `Keyword "${word}" is not allowed` });
    }

    const targetConn = await getTargetConnection(connectionId, req.user.userId);
    const startTime = Date.now();

    try {
      // Get total count
      let total = null;
      try {
        const [countRows] = await targetConn.execute(
          `SELECT COUNT(*) as total FROM (${sql.replace(/;$/, '')}) AS _count_q`
        );
        total = parseInt(countRows[0].total);
      } catch (_) {}

      // Paginated query
      const offset = (page - 1) * pageSize;
      const paginatedSQL = `SELECT * FROM (${sql.replace(/;$/, '')}) AS _paged LIMIT ${pageSize} OFFSET ${offset}`;
      const [rows, fields] = await targetConn.execute(paginatedSQL);
      const executionTime = Date.now() - startTime;

      await targetConn.end();

      res.json({
        rows,
        fields: fields.map(f => ({ name: f.name, type: f.type })),
        rowCount: rows.length,
        total,
        page,
        pageSize,
        totalPages: total ? Math.ceil(total / pageSize) : null,
        executionTimeMs: executionTime,
      });
    } catch (queryErr) {
      await targetConn.end().catch(() => {});
      return res.status(400).json({ error: queryErr.message });
    }
  } catch (err) { next(err); }
}

async function saveQuery(req, res, next) {
  try {
    const { sql, naturalLanguage, connectionId, queryName, executionTimeMs, rowCount } = req.body;
    if (!sql) return res.status(400).json({ error: 'sql is required' });

    const result = await query(
      `INSERT INTO query_history (user_id, connection_id, natural_language, sql_query, query_name, execution_time_ms, row_count_result, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'saved')`,
      [req.user.userId, connectionId || null, naturalLanguage || null, sql, queryName || null, executionTimeMs || null, rowCount || null]
    );

    const saved = await queryOne('SELECT * FROM query_history WHERE id = ?', [result.insertId]);
    res.status(201).json({ query: saved });
  } catch (err) { next(err); }
}

async function getHistory(req, res, next) {
  try {
    const { limit = 50, offset = 0, connectionId } = req.query;

    let sql = `
      SELECT qh.*, dc.name as connection_name
      FROM query_history qh
      LEFT JOIN db_connections dc ON qh.connection_id = dc.id
      WHERE qh.user_id = ?
    `;
    const params = [req.user.userId];

    if (connectionId) {
      sql += ' AND qh.connection_id = ?';
      params.push(connectionId);
    }

    sql += ' ORDER BY qh.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const rows = await query(sql, params);
    const [countRows] = await require('../models/appDb').pool.execute(
      'SELECT COUNT(*) as total FROM query_history WHERE user_id = ?',
      [req.user.userId]
    );

    res.json({ history: rows, total: parseInt(countRows[0].total) });
  } catch (err) { next(err); }
}

async function updateQuery(req, res, next) {
  try {
    const { id } = req.params;
    const { sql, queryName, naturalLanguage } = req.body;

    await query(
      `UPDATE query_history
       SET sql_query = COALESCE(?, sql_query),
           query_name = COALESCE(?, query_name),
           natural_language = COALESCE(?, natural_language),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND user_id = ?`,
      [sql || null, queryName || null, naturalLanguage || null, id, req.user.userId]
    );

    const updated = await queryOne('SELECT * FROM query_history WHERE id = ?', [id]);
    if (!updated) return res.status(404).json({ error: 'Query not found' });
    res.json({ query: updated });
  } catch (err) { next(err); }
}

async function deleteQuery(req, res, next) {
  try {
    await query(
      'DELETE FROM query_history WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );
    res.json({ message: 'Query deleted' });
  } catch (err) { next(err); }
}

module.exports = { generate, run, saveQuery, getHistory, updateQuery, deleteQuery };
