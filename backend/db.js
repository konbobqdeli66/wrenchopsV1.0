const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// IMPORTANT:
// Use an absolute path so the DB location does NOT depend on the process CWD.
// In production, PM2/systemd may start Node with a different working directory,
// which can silently create a NEW empty DB (e.g. backend/truck.db) and make data
// "disappear" (vehicles, client portal links, etc.).
//
// Default DB location: project root `truck.db`.
// Override via env: SQLITE_DB_PATH=/absolute/path/to/truck.db
const DB_PATH = process.env.SQLITE_DB_PATH
  ? path.resolve(String(process.env.SQLITE_DB_PATH))
  : path.resolve(__dirname, '..', 'truck.db');

const db = new sqlite3.Database(DB_PATH);

module.exports = db;
