const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:     process.env.APP_DB_HOST || 'localhost',
  port:     parseInt(process.env.APP_DB_PORT) || 3306,
  database: process.env.APP_DB_NAME || 'sqlgen_app',
  user:     process.env.APP_DB_USER || 'root',
  password: process.env.APP_DB_PASSWORD || '',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initAppDB() {
  const conn = await pool.getConnection();
  try {
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id            BIGINT AUTO_INCREMENT PRIMARY KEY,
        email         VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name          VARCHAR(255),
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS db_connections (
        id                  BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id             BIGINT NOT NULL,
        name                VARCHAR(255) NOT NULL,
        host                VARCHAR(255) NOT NULL,
        port                INT DEFAULT 3306,
        database_name       VARCHAR(255) NOT NULL,
        username            VARCHAR(255) NOT NULL,
        password_encrypted  TEXT NOT NULL,
        ssl_enabled         TINYINT(1) DEFAULT 0,
        is_active           TINYINT(1) DEFAULT 1,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);

    await conn.execute(`
      CREATE TABLE IF NOT EXISTS query_history (
        id                BIGINT AUTO_INCREMENT PRIMARY KEY,
        user_id           BIGINT NOT NULL,
        connection_id     BIGINT,
        natural_language  TEXT,
        sql_query         TEXT NOT NULL,
        query_name        VARCHAR(255),
        execution_time_ms INT,
        row_count_result  INT,
        status            VARCHAR(50) DEFAULT 'saved',
        created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (connection_id) REFERENCES db_connections(id) ON DELETE SET NULL
      )
    `);

    console.log('✅ MySQL App database initialized');
  } finally {
    conn.release();
  }
}

// Helper: run query and return rows
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

// Helper: get single row
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

module.exports = { pool, query, queryOne, initAppDB };
