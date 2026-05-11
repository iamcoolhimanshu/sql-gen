const mysql = require('mysql2/promise');
const { query, queryOne } = require('../models/appDb');

// Simple obfuscation for storing passwords
function obfuscate(text) {
  const key = process.env.JWT_SECRET || 'default-key';
  return Buffer.from(
    text.split('').map((c, i) => c.charCodeAt(0) ^ key.charCodeAt(i % key.length)).join(',')
  ).toString('base64');
}

function deobfuscate(encoded) {
  const key = process.env.JWT_SECRET || 'default-key';
  const nums = Buffer.from(encoded, 'base64').toString().split(',').map(Number);
  return nums.map((n, i) => String.fromCharCode(n ^ key.charCodeAt(i % key.length))).join('');
}

async function getConnections(req, res, next) {
  try {
    const rows = await query(
      'SELECT id, name, host, port, database_name, username, ssl_enabled, is_active, created_at FROM db_connections WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json({ connections: rows });
  } catch (err) { next(err); }
}

async function addConnection(req, res, next) {
  try {
    const { name, host, port, database_name, username, password, ssl_enabled } = req.body;

    if (!name || !host || !database_name || !username)
      return res.status(400).json({ error: 'Name, host, database, and username are required' });

    const encryptedPassword = obfuscate(password || '');

    const result = await query(
      `INSERT INTO db_connections (user_id, name, host, port, database_name, username, password_encrypted, ssl_enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.userId, name, host, parseInt(port) || 3306, database_name, username, encryptedPassword, ssl_enabled ? 1 : 0]
    );

    const conn = await queryOne(
      'SELECT id, name, host, port, database_name, username, ssl_enabled, created_at FROM db_connections WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ connection: conn, message: 'Connection saved' });
  } catch (err) { next(err); }
}

async function testConnection(req, res, next) {
  try {
    const { host, port, database_name, username, password, ssl_enabled } = req.body;

    let testConn;
    try {
      testConn = await mysql.createConnection({
        host,
        port: parseInt(port) || 3306,
        database: database_name,
        user: username,
        password: password || '',
        ssl: ssl_enabled ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 5000,
      });

      const [rows] = await testConn.execute('SELECT VERSION() as version');
      await testConn.end();
      res.json({ success: true, version: 'MySQL ' + rows[0].version });
    } catch (connErr) {
      if (testConn) await testConn.end().catch(() => {});
      res.status(400).json({ success: false, error: connErr.message });
    }
  } catch (err) { next(err); }
}

async function deleteConnection(req, res, next) {
  try {
    await query(
      'DELETE FROM db_connections WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.userId]
    );
    res.json({ message: 'Connection deleted' });
  } catch (err) { next(err); }
}

async function getSchema(req, res, next) {
  try {
    const { connectionId } = req.params;

    const conn = await queryOne(
      'SELECT * FROM db_connections WHERE id = ? AND user_id = ?',
      [connectionId, req.user.userId]
    );
    if (!conn) return res.status(404).json({ error: 'Connection not found' });

    const password = deobfuscate(conn.password_encrypted);

    let schemaConn;
    try {
      schemaConn = await mysql.createConnection({
        host: conn.host,
        port: conn.port,
        database: conn.database_name,
        user: conn.username,
        password,
        ssl: conn.ssl_enabled ? { rejectUnauthorized: false } : undefined,
        connectTimeout: 8000,
      });

      // Get tables and columns for MySQL
      const [cols] = await schemaConn.execute(`
        SELECT
          c.TABLE_NAME       AS table_name,
          c.TABLE_SCHEMA     AS table_schema,
          c.COLUMN_NAME      AS column_name,
          c.DATA_TYPE        AS data_type,
          c.IS_NULLABLE      AS is_nullable,
          c.COLUMN_DEFAULT   AS column_default,
          c.CHARACTER_MAXIMUM_LENGTH AS char_max_length,
          c.COLUMN_KEY       AS column_key
        FROM INFORMATION_SCHEMA.COLUMNS c
        JOIN INFORMATION_SCHEMA.TABLES t
          ON c.TABLE_NAME = t.TABLE_NAME AND c.TABLE_SCHEMA = t.TABLE_SCHEMA
        WHERE c.TABLE_SCHEMA = ?
          AND t.TABLE_TYPE = 'BASE TABLE'
        ORDER BY c.TABLE_NAME, c.ORDINAL_POSITION
      `, [conn.database_name]);

      await schemaConn.end();

      // Build structured schema
      const schemaMap = {};
      for (const row of cols) {
        const key = row.table_name;
        if (!schemaMap[key]) {
          schemaMap[key] = {
            schema: row.table_schema,
            name: row.table_name,
            columns: [],
          };
        }
        schemaMap[key].columns.push({
          name: row.column_name,
          type: row.data_type,
          nullable: row.is_nullable === 'YES',
          default: row.column_default,
          maxLength: row.char_max_length,
          isPrimaryKey: row.column_key === 'PRI',
          isForeignKey: row.column_key === 'MUL',
        });
      }

      res.json({ schema: Object.values(schemaMap) });
    } catch (schemaErr) {
      if (schemaConn) await schemaConn.end().catch(() => {});
      res.status(400).json({ error: schemaErr.message });
    }
  } catch (err) { next(err); }
}

module.exports = { getConnections, addConnection, testConnection, deleteConnection, getSchema };
