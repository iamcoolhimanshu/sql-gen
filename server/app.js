require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initAppDB } = require('./models/appDb');

const authRoutes  = require('./routes/auth');
const dbRoutes    = require('./routes/db');
const queryRoutes = require('./routes/query');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

app.use('/auth',  authRoutes);
app.use('/db',    dbRoutes);
app.use('/query', queryRoutes);

app.get('/health', (req, res) =>
  res.json({ status: 'ok', db: 'MySQL', timestamp: new Date().toISOString() })
);

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

const PORT = process.env.PORT || 5000;

async function start() {
  try {
    await initAppDB();
    app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log(`📦 Database: MySQL @ ${process.env.APP_DB_HOST}:${process.env.APP_DB_PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
}

start();
