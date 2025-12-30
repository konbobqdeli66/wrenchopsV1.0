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

const get = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      return resolve(row || null);
    });
  });

async function main() {
  const db = new sqlite3.Database(DB_PATH);
  db.configure('busyTimeout', 10_000);

  const seed = [
    // Engine
    { title: 'Смяна на моторно масло + филтър', hours: 1.5, component_type: 'engine' },
    { title: 'Смяна на горивен филтър', hours: 0.8, component_type: 'engine' },
    { title: 'Смяна на въздушен филтър', hours: 0.5, component_type: 'engine' },
    { title: 'Диагностика на двигателя', hours: 2.0, component_type: 'engine' },
    { title: 'Ремонт на турбокомпресор', hours: 6.0, component_type: 'engine' },
    { title: 'Смяна на ремък/ролки', hours: 2.5, component_type: 'engine' },

    // Transmission
    { title: 'Смяна на масло в скоростна кутия', hours: 2.0, component_type: 'transmission' },
    { title: 'Смяна на съединител', hours: 4.0, component_type: 'transmission' },
    { title: 'Диагностика скоростна кутия', hours: 2.0, component_type: 'transmission' },
    { title: 'Ремонт на скоростна кутия', hours: 8.0, component_type: 'transmission' },

    // Chassis / brakes
    { title: 'Смяна на гуми (комплект)', hours: 2.0, component_type: 'chassis' },
    { title: 'Балансиране на гуми', hours: 0.5, component_type: 'chassis' },
    { title: 'Реглаж мостове/геометрия', hours: 2.5, component_type: 'chassis' },
    { title: 'Ремонт на спирачки (ос)', hours: 3.0, component_type: 'chassis' },
    { title: 'Смяна накладки (ос)', hours: 2.0, component_type: 'chassis' },
    { title: 'Смяна дискове (ос)', hours: 2.5, component_type: 'chassis' },
    { title: 'Ремонт на окачване', hours: 4.5, component_type: 'chassis' },

    // Axles
    { title: 'Ремонт на преден мост', hours: 5.0, component_type: 'front_axle' },
    { title: 'Ремонт на заден мост', hours: 6.0, component_type: 'rear_axle' },
    { title: 'Смяна лагер главина', hours: 3.0, component_type: 'front_axle' },

    // Cabin / electrical
    { title: 'Диагностика електроника', hours: 2.0, component_type: 'cabin' },
    { title: 'Ремонт на електрика', hours: 4.0, component_type: 'cabin' },
    { title: 'Ремонт на климатик', hours: 3.0, component_type: 'cabin' },
    { title: 'Зареждане климатик', hours: 1.0, component_type: 'cabin' },

    // Trailer
    { title: 'Ремонт ремарке – ос/спирачки', hours: 3.5, component_type: 'chassis' },
    { title: 'Смяна въздушни възглавници', hours: 2.5, component_type: 'chassis' },
  ];

  try {
    await run(db, 'PRAGMA foreign_keys = ON;');

    let inserted = 0;
    let skipped = 0;

    for (const item of seed) {
      const exists = await get(db, 'SELECT id FROM worktimes WHERE title = ? LIMIT 1', [item.title]);
      if (exists?.id) {
        skipped += 1;
        continue;
      }
      await run(db, 'INSERT INTO worktimes (title, hours, component_type) VALUES (?, ?, ?)', [
        item.title,
        item.hours,
        item.component_type,
      ]);
      inserted += 1;
    }

    console.log('✅ Worktimes seeded');
    console.log({ dbPath: DB_PATH, inserted, skipped });
  } catch (err) {
    console.error('❌ Worktimes seed failed:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();

