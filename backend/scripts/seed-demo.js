/* eslint-disable no-console */
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const DB_PATH = path.join(__dirname, '..', 'truck.db');
const INIT_SQL_PATH = path.join(__dirname, '..', 'init.sql');

const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[randInt(0, arr.length - 1)];

const pad2 = (n) => String(n).padStart(2, '0');

const randomVin = () => {
  const chars = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
  let vin = '';
  for (let i = 0; i < 17; i += 1) vin += chars[randInt(0, chars.length - 1)];
  return vin;
};

const toSqliteDateTime = (d) => {
  // SQLite uses 'YYYY-MM-DD HH:MM:SS'
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(
    d.getMinutes()
  )}:${pad2(d.getSeconds())}`;
};

const randomPastDate = (daysBack) => {
  const now = new Date();
  const d = new Date(now);
  d.setDate(now.getDate() - randInt(0, daysBack));
  d.setHours(randInt(7, 19), randInt(0, 59), randInt(0, 59), 0);
  return d;
};

const run = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      return resolve(this);
    });
  });

const all = (db, sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      return resolve(rows);
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
    const initSql = fs.readFileSync(INIT_SQL_PATH, 'utf8');

    await exec(db, 'PRAGMA foreign_keys = OFF;');
    await exec(db, initSql);
    await exec(db, 'PRAGMA foreign_keys = ON;');

    await exec(db, 'BEGIN;');

    // Clear operational data (keep users/permissions/invitations/preferences)
    const safeDelete = async (table) => {
      try {
        await run(db, `DELETE FROM ${table}`);
      } catch (e) {
        // ignore missing tables
      }
    };

    await safeDelete('order_worktimes');
    await safeDelete('order_documents');
    await safeDelete('orders');
    await safeDelete('vehicles');
    await safeDelete('clients');
    await safeDelete('worktimes');

    try {
      await run(
        db,
        "DELETE FROM sqlite_sequence WHERE name IN ('clients','vehicles','orders','worktimes','order_worktimes','order_documents')"
      );
    } catch {
      // ignore
    }

    // Seed worktimes (small but diverse set)
    const worktimesSeed = [
      { title: 'Смяна на моторно масло', hours: 1.5, component_type: 'engine' },
      { title: 'Диагностика на двигателя', hours: 2.0, component_type: 'engine' },
      { title: 'Смяна на горивен филтър', hours: 0.8, component_type: 'engine' },
      { title: 'Ремонт на турбокомпресор', hours: 6.0, component_type: 'engine' },
      { title: 'Смяна на масло в скоростна кутия', hours: 2.0, component_type: 'transmission' },
      { title: 'Смяна на съединител', hours: 4.0, component_type: 'transmission' },
      { title: 'Ремонт на скоростна кутия', hours: 8.0, component_type: 'transmission' },
      { title: 'Смяна на гуми (комплект)', hours: 2.0, component_type: 'chassis' },
      { title: 'Балансиране на гуми', hours: 0.5, component_type: 'chassis' },
      { title: 'Ремонт на спирачки', hours: 3.0, component_type: 'chassis' },
      { title: 'Ремонт на окачване', hours: 4.5, component_type: 'chassis' },
      { title: 'Ремонт на преден мост', hours: 5.0, component_type: 'front_axle' },
      { title: 'Ремонт на заден мост', hours: 6.0, component_type: 'rear_axle' },
      { title: 'Ремонт на климатик', hours: 3.0, component_type: 'cabin' },
      { title: 'Ремонт на електрика', hours: 4.0, component_type: 'cabin' },
    ];

    for (const wt of worktimesSeed) {
      await run(db, 'INSERT INTO worktimes (title, hours, component_type) VALUES (?, ?, ?)', [
        wt.title,
        wt.hours,
        wt.component_type,
      ]);
    }

    const worktimeRows = await all(db, 'SELECT id, hours FROM worktimes');
    const worktimeIds = worktimeRows.map((r) => r.id);
    const hoursByWorktimeId = Object.fromEntries(worktimeRows.map((r) => [r.id, Number(r.hours) || 0]));

    const clientSeed = Array.from({ length: 10 }).map((_, idx) => {
      const n = idx + 1;
      return {
        name: `Клиент ${n}`,
        city: pick(['София', 'Пловдив', 'Варна', 'Бургас', 'Русе', 'Стара Загора', 'Плевен', 'Шумен', 'Добрич', 'Перник']),
        address: `ул. Примерна ${n}, №${randInt(1, 120)}`,
        eik: String(100000000 + n),
        vat_number: `BG${100000000 + n}`,
        mol: pick(['Иван Иванов', 'Георги Георгиев', 'Петър Петров', 'Димитър Димитров', 'Николай Николов']),
        phone: `08${randInt(70, 99)}${randInt(1000000, 9999999)}`,
      };
    });

    const truckBrands = [
      { brand: 'Mercedes-Benz', models: ['Actros', 'Arocs'] },
      { brand: 'MAN', models: ['TGX', 'TGS'] },
      { brand: 'Scania', models: ['R450', 'S500'] },
      { brand: 'Volvo', models: ['FH', 'FM'] },
      { brand: 'DAF', models: ['XF', 'CF'] },
      { brand: 'Iveco', models: ['S-Way', 'Stralis'] },
      { brand: 'Renault Trucks', models: ['T', 'C'] },
    ];

    const trailerBrands = [
      { brand: 'Krone', models: ['Cool Liner', 'Profi Liner'] },
      { brand: 'Schmitz', models: ['S.KO', 'S.CS'] },
      { brand: 'Kögel', models: ['Cargo', 'Mega'] },
      { brand: 'Wielton', models: ['Curtainsider', 'Tipper'] },
      { brand: 'Benalu', models: ['Bulk', 'Tipper'] },
    ];

    const gearBoxes = ['PowerShift', 'TipMatic', 'Opticruise', 'I-Shift', 'AS Tronic'];
    const complaints = [
      'Теч на масло',
      'Шум от двигателя',
      'Проблем със спирачки',
      'Смяна на гуми',
      'Диагностика след грешка на табло',
      'Проблем със скоростна кутия',
      'Проблем с окачване',
      'Електрически проблем',
      'Смяна на филтри',
      'Проверка преди път',
    ];

    const regSeries = ['CA', 'CB', 'CC', 'CH', 'CT', 'PA', 'PB', 'PP', 'BA', 'BH', 'CO', 'TX', 'EH'];
    let regCounter = 1000;
    const nextReg = () => {
      regCounter += 1;
      const series = pick(regSeries);
      const letters = 'ABEKMHOPCTYX';
      const l1 = letters[randInt(0, letters.length - 1)];
      const l2 = letters[randInt(0, letters.length - 1)];
      return `${series}${regCounter}${l1}${l2}`;
    };

    let insertedClients = 0;
    let insertedVehicles = 0;
    let insertedOrders = 0;
    let insertedOrderWorktimes = 0;

    for (const c of clientSeed) {
      const insClient = await run(
        db,
        'INSERT INTO clients (name, address, eik, phone, city, vat_number, mol, vehicles) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [c.name, c.address, c.eik, c.phone, c.city, c.vat_number, c.mol, null]
      );
      insertedClients += 1;
      const clientId = insClient.lastID;

      // 5 trucks + 5 trailers
      const vehicles = [];

      for (let i = 0; i < 5; i += 1) {
        const bm = pick(truckBrands);
        vehicles.push({
          vehicle_type: 'truck',
          brand: bm.brand,
          model: pick(bm.models),
          reg_number: nextReg(),
          vin: randomVin(),
          gear_box: pick(gearBoxes),
          axes: null,
          year: randInt(2014, 2024),
        });
      }

      for (let i = 0; i < 5; i += 1) {
        const bm = pick(trailerBrands);
        vehicles.push({
          vehicle_type: 'trailer',
          brand: bm.brand,
          model: pick(bm.models),
          reg_number: nextReg(),
          vin: randomVin(),
          gear_box: null,
          axes: randInt(2, 3),
          year: randInt(2013, 2024),
        });
      }

      for (const v of vehicles) {
        await run(
          db,
          'INSERT INTO vehicles (client_id, reg_number, vin, brand, model, vehicle_type, gear_box, axes, year, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime(\'now\'))',
          [
            clientId,
            v.reg_number,
            v.vin,
            v.brand,
            v.model,
            v.vehicle_type,
            v.gear_box,
            v.axes,
            v.year,
          ]
        );
        insertedVehicles += 1;

        // 5 completed repairs per vehicle
        for (let r = 0; r < 5; r += 1) {
          const createdAt = randomPastDate(365);
          const completedAt = new Date(createdAt);
          completedAt.setDate(createdAt.getDate() + randInt(0, 3));
          completedAt.setHours(randInt(8, 19), randInt(0, 59), randInt(0, 59), 0);

          const insOrder = await run(
            db,
            `INSERT INTO orders (client_id, client_name, reg_number, complaint, status, created_at, completed_at)
             VALUES (?, ?, ?, ?, 'completed', ?, ?)` ,
            [clientId, c.name, v.reg_number, pick(complaints), toSqliteDateTime(createdAt), toSqliteDateTime(completedAt)]
          );
          insertedOrders += 1;
          const orderId = insOrder.lastID;

          const itemsCount = randInt(2, 6);
          const chosen = new Set();
          while (chosen.size < itemsCount) chosen.add(pick(worktimeIds));

          for (const worktimeId of chosen) {
            const qty = randInt(1, 3);
            const note = Math.random() < 0.25 ? pick(['Спешно', 'Повторна проверка', 'С клиента', 'Гаранционно', 'Външен оглед']) : '';

            await run(
              db,
              'INSERT INTO order_worktimes (order_id, worktime_id, quantity, notes, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))',
              [orderId, worktimeId, qty, note]
            );
            insertedOrderWorktimes += 1;
          }

          // Optional: keep complaint a bit more realistic by adding total time info (not stored)
          // total time is derived from order_worktimes and worktimes table.
          void hoursByWorktimeId; // keep linter happy
        }
      }
    }

    await exec(db, 'COMMIT;');

    console.log('✅ Demo seed completed');
    console.log({
      dbPath: DB_PATH,
      clients: insertedClients,
      vehicles: insertedVehicles,
      completedOrders: insertedOrders,
      orderWorktimesRows: insertedOrderWorktimes,
    });
  } catch (err) {
    try {
      await exec(db, 'ROLLBACK;');
    } catch {
      // ignore
    }
    console.error('❌ Seed failed:', err);
    process.exitCode = 1;
  } finally {
    db.close();
  }
}

main();

