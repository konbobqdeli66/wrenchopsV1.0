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

    // Delete operational data (keep users, permissions, preferences, company_settings)
    const safeDelete = async (table) => {
      try {
        await run(db, `DELETE FROM ${table}`);
      } catch {
        // ignore missing tables
      }
    };

    await safeDelete('order_worktimes');
    await safeDelete('order_documents');
    await safeDelete('orders');
    await safeDelete('vehicles');
    await safeDelete('clients');
    await safeDelete('worktimes');

    // Reset AUTOINCREMENT counters for fresh IDs
    try {
      await run(
        db,
        "DELETE FROM sqlite_sequence WHERE name IN ('clients','vehicles','orders','worktimes','order_worktimes','order_documents')"
      );
    } catch {
      // ignore
    }

    // Reset invoice/protocol counters (so numbering starts from the beginning again)
    try {
      await run(
        db,
        'UPDATE company_settings SET invoice_last_number = 0, protocol_last_number = 0 WHERE id = 1'
      );
    } catch {
      // ignore if company_settings does not exist yet
    }

    await exec(db, 'COMMIT;');
    console.log('✅ Cleared clients, vehicles, worktimes, work orders, and invoices (documents)');
    console.log(`DB: ${DB_PATH}`);
  } catch (err) {
    try {
      await exec(db, 'ROLLBACK;');
    } catch {
      // ignore
    }
    console.error('❌ Clear failed:', err);
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

