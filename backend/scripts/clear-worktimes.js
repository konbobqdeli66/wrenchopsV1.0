/* eslint-disable no-console */
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'truck.db');

const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      return resolve(this);
    });
  });

const exec = (db, sql) =>
  new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) return reject(err);
      return resolve();
    });
  });

async function main() {
  const db = new sqlite3.Database(DB_PATH);
  db.configure('busyTimeout', 10_000);

  try {
    await exec(db, 'PRAGMA foreign_keys = OFF;');
    await exec(db, 'BEGIN;');

    // Remove dependent rows first
    await run(db, 'DELETE FROM order_worktimes').catch(() => {});
    await run(db, 'DELETE FROM worktimes').catch(() => {});

    // Reset counters
    try {
      await run(db, "DELETE FROM sqlite_sequence WHERE name IN ('worktimes','order_worktimes')");
    } catch {
      // ignore
    }

    await exec(db, 'COMMIT;');
    console.log('✅ Cleared worktimes (нормовремена)');
  } catch (err) {
    try {
      await exec(db, 'ROLLBACK;');
    } catch {
      // ignore
    }
    console.error('❌ Clear worktimes failed:', err);
    process.exitCode = 1;
  } finally {
    try {
      await exec(db, 'PRAGMA foreign_keys = ON;');
    } catch {
      // ignore
    }
    db.close();
  }
}

main();

