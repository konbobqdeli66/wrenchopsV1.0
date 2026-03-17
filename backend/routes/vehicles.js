const express = require('express');
const db = require('../db');
const { checkPermission } = require('../middleware/permissions');
const { ciIncludes } = require('../utils/ciText');

const router = express.Router();

const isAdminUser = (req) => String(req.user?.role || '').trim() === 'admin';

const normalizeDateTime = (raw) => {
  // Accept:
  // - ISO: 2026-03-16T12:34:56.000Z
  // - SQLite: 2026-03-16 12:34:56
  // - Date-only: 2026-03-16
  const s = String(raw ?? '').trim();
  if (!s) return null;

  let iso = s;
  const sqliteFull = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/;
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/;

  if (dateOnly.test(s)) {
    // Treat date-only as UTC midnight to avoid timezone shifts.
    iso = `${s}T00:00:00Z`;
  } else if (sqliteFull.test(s)) {
    const withSeconds = s.length === 16 ? `${s}:00` : s; // YYYY-MM-DD HH:MM -> add :SS
    iso = `${withSeconds.replace(' ', 'T')}Z`;
  }

  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return undefined;
  // Store in SQLite-compatible UTC format.
  return d.toISOString().replace('T', ' ').slice(0, 19);
};

// Get all vehicles with client info
router.get('/', checkPermission('vehicles', 'read'), (req, res) => {
  const query = `
    SELECT
      v.*,
      c.name as client_name,
      (
        SELECT COUNT(1)
        FROM orders o
        WHERE UPPER(o.reg_number) = UPPER(v.reg_number)
      ) as history_count
    FROM vehicles v
    JOIN clients c ON v.client_id = c.id
    ORDER BY v.brand, v.model
  `;

  db.all(query, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Search vehicles by various criteria
router.get('/search', checkPermission('vehicles', 'read'), (req, res) => {
  const q = String(req.query?.q ?? '');
  const reg_number = String(req.query?.reg_number ?? '');
  const vin = String(req.query?.vin ?? '');
  const brand = String(req.query?.brand ?? '');
  const model = String(req.query?.model ?? '');
  const vehicle_type = String(req.query?.vehicle_type ?? '');
  const client_id = req.query?.client_id;

  // NOTE: SQLite NOCASE/LOWER/UPPER are ASCII-only by default.
  // To make searches ignore upper/lower for Cyrillic/Unicode, we filter in JS.
  const baseQuery = `
    SELECT
      v.*,
      c.name as client_name,
      (
        SELECT COUNT(1)
        FROM orders o
        WHERE UPPER(o.reg_number) = UPPER(v.reg_number)
      ) as history_count
    FROM vehicles v
    JOIN clients c ON v.client_id = c.id
    ORDER BY v.brand, v.model
  `;

  db.all(baseQuery, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const list = Array.isArray(rows) ? rows : [];
    const clientIdNum = client_id === undefined ? null : Number(client_id);

    const filtered = list.filter((v) => {
      if (vehicle_type) {
        const vt = String(v?.vehicle_type || '').trim().toLowerCase();
        const want = String(vehicle_type || '').trim().toLowerCase();
        if (vt !== want) return false;
      }

      if (clientIdNum !== null && Number.isFinite(clientIdNum)) {
        if (Number(v?.client_id) !== clientIdNum) return false;
      }

      if (q.trim()) {
        const ok =
          ciIncludes(v?.reg_number, q) ||
          ciIncludes(v?.brand, q) ||
          ciIncludes(v?.model, q) ||
          ciIncludes(v?.client_name, q);
        if (!ok) return false;
      }

      if (reg_number.trim() && !ciIncludes(v?.reg_number, reg_number)) return false;
      if (vin.trim() && !ciIncludes(v?.vin, vin)) return false;
      if (brand.trim() && !ciIncludes(v?.brand, brand)) return false;
      if (model.trim() && !ciIncludes(v?.model, model)) return false;

      return true;
    });

    res.json(filtered);
  });
});

// Get vehicles for a specific client
router.get('/client/:clientId', checkPermission('vehicles', 'read'), (req, res) => {
  const query = `
    SELECT
      v.*,
      c.name as client_name,
      (
        SELECT COUNT(1)
        FROM orders o
        WHERE UPPER(o.reg_number) = UPPER(v.reg_number)
      ) as history_count
    FROM vehicles v
    JOIN clients c ON v.client_id = c.id
    WHERE v.client_id = ?
    ORDER BY v.brand, v.model
  `;

  db.all(query, [req.params.clientId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get single vehicle by ID
router.get('/:id', checkPermission('vehicles', 'read'), (req, res) => {
  const query = `
    SELECT
      v.*,
      c.name as client_name,
      (
        SELECT COUNT(1)
        FROM orders o
        WHERE UPPER(o.reg_number) = UPPER(v.reg_number)
      ) as history_count
    FROM vehicles v
    JOIN clients c ON v.client_id = c.id
    WHERE v.id = ?
  `;

  db.get(query, [req.params.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Vehicle not found' });
    }
    res.json(row);
  });
});

// Add vehicle to client
router.post('/', checkPermission('vehicles', 'write'), (req, res) => {
  const { client_id, reg_number, vin, brand, model, vehicle_type, gear_box, axes, year } = req.body;

  db.run(
    'INSERT INTO vehicles (client_id, reg_number, vin, brand, model, vehicle_type, gear_box, axes, year) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [client_id, reg_number, vin, brand, model, vehicle_type, gear_box, axes, year],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      // Return the created vehicle with client info
      const query = `
        SELECT v.*, c.name as client_name
        FROM vehicles v
        JOIN clients c ON v.client_id = c.id
        WHERE v.id = ?
      `;

      db.get(query, [this.lastID], (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json(row);
      });
    }
  );
});

// Update vehicle
router.put('/:id', checkPermission('vehicles', 'write'), (req, res) => {
  const vehicleId = Number(req.params.id);
  if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
    return res.status(400).json({ error: 'Invalid vehicle id' });
  }

  // NOTE: Keep this route flexible (partial updates) so different UIs can update
  // only the fields they need.
  const body = req.body || {};

  const has = (k) => Object.prototype.hasOwnProperty.call(body, k);

  const updates = [];
  const params = [];
  const setField = (field, value) => {
    updates.push(`${field} = ?`);
    params.push(value);
  };

  // Validate reg_number if provided
  if (has('reg_number')) {
    const v = body.reg_number === null ? null : String(body.reg_number ?? '').trim();
    if (!v) {
      return res.status(400).json({ error: 'reg_number е задължително поле' });
    }
    if (v.length > 32) {
      return res.status(400).json({ error: 'reg_number е твърде дълъг' });
    }
    setField('reg_number', v);
  }

  if (has('vin')) {
    const v = body.vin === null ? null : String(body.vin ?? '').trim();
    if (v && v.length > 64) {
      return res.status(400).json({ error: 'vin е твърде дълъг' });
    }
    setField('vin', v || null);
  }

  // Keep compatibility with the older full-form update
  if (has('brand')) setField('brand', body.brand === null ? null : String(body.brand ?? '').trim() || null);
  if (has('model')) setField('model', body.model === null ? null : String(body.model ?? '').trim() || null);
  if (has('vehicle_type')) {
    const vt = String(body.vehicle_type ?? '').trim().toLowerCase();
    setField('vehicle_type', vt === 'trailer' ? 'trailer' : 'truck');
  }
  if (has('gear_box')) setField('gear_box', body.gear_box === null ? null : String(body.gear_box ?? '').trim() || null);
  if (has('axes')) {
    if (body.axes === null || body.axes === undefined || String(body.axes).trim() === '') setField('axes', null);
    else {
      const n = Number(body.axes);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'axes must be a non-negative number' });
      setField('axes', Math.round(n));
    }
  }
  if (has('year')) {
    if (body.year === null || body.year === undefined || String(body.year).trim() === '') setField('year', null);
    else {
      const n = Number(body.year);
      if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'year must be a non-negative number' });
      setField('year', Math.round(n));
    }
  }

  if (!updates.length) {
    return res.status(400).json({ error: 'Няма подадени полета за промяна.' });
  }

  // We need the old reg + client context to keep service history consistent if reg_number changes.
  db.get('SELECT id, client_id, reg_number FROM vehicles WHERE id = ?', [vehicleId], (getErr, oldRow) => {
    if (getErr) return res.status(500).json({ error: getErr.message });
    if (!oldRow) return res.status(404).json({ error: 'Vehicle not found' });

    const oldReg = String(oldRow.reg_number || '').trim();

    db.run(
      `UPDATE vehicles SET ${updates.join(', ')} WHERE id = ?`,
      [...params, vehicleId],
      function (updErr) {
        if (updErr) {
          return res.status(500).json({ error: updErr.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Vehicle not found' });
        }

        // If reg_number changed -> update past orders for this client.
        // This keeps /vehicles/:id/history stable.
        if (has('reg_number')) {
          const newReg = String(body.reg_number || '').trim();
          if (oldReg && newReg && oldReg.toUpperCase() !== newReg.toUpperCase()) {
            db.run(
              `
                UPDATE orders
                SET reg_number = ?
                WHERE UPPER(reg_number) = UPPER(?)
                  AND (
                    client_id = ?
                    OR (
                      client_id IS NULL
                      AND COALESCE(client_name, '') = (SELECT name FROM clients WHERE id = ?)
                    )
                  )
              `,
              [newReg, oldReg, oldRow.client_id, oldRow.client_id]
            );
          }
        }

        // Return the updated row with client info (useful for UI updates)
        const query = `
          SELECT
            v.*,
            c.name as client_name,
            (
              SELECT COUNT(1)
              FROM orders o
              WHERE UPPER(o.reg_number) = UPPER(v.reg_number)
            ) as history_count
          FROM vehicles v
          JOIN clients c ON v.client_id = c.id
          WHERE v.id = ?
        `;
        db.get(query, [vehicleId], (rowErr, row) => {
          if (rowErr) return res.status(500).json({ error: rowErr.message });
          return res.json(row || { message: 'Vehicle updated successfully' });
        });
      }
    );
  });
});

// Delete vehicle
router.delete('/:id', checkPermission('vehicles', 'delete'), (req, res) => {
  db.run('DELETE FROM vehicles WHERE id = ?', [req.params.id], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json({ message: 'Vehicle deleted successfully' });
  });
});

// Get service history for a vehicle
router.get('/:id/history', checkPermission('vehicles', 'read'), (req, res) => {
  const query = `
    SELECT
      o.*,
      COALESCE(c.name, o.client_name) as client_name,
      COALESCE(o.completed_at, o.created_at) as service_date
    FROM orders o
    LEFT JOIN clients c ON o.client_id = c.id
    WHERE o.reg_number = (
      SELECT reg_number FROM vehicles WHERE id = ?
    )
    ORDER BY datetime(COALESCE(o.completed_at, o.created_at)) DESC, o.id DESC
  `;

  db.all(query, [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Admin: create a manual service history entry for a vehicle
// Body: { service_date: 'YYYY-MM-DD' | ISO | sqlite, odometer_km?: number, complaint?: string }
router.post('/:id/history', checkPermission('vehicles', 'write'), (req, res) => {
  if (!isAdminUser(req)) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const vehicleId = req.params.id;
  const { service_date, odometer_km, complaint } = req.body || {};

  const dt = normalizeDateTime(service_date);
  if (dt === undefined || !dt) {
    return res.status(400).json({ error: 'Невалиден формат за service_date' });
  }

  const odo =
    odometer_km === undefined || odometer_km === null || String(odometer_km).trim() === ''
      ? null
      : Number(String(odometer_km).replace(',', '.'));

  if (odo !== null && (!Number.isFinite(odo) || odo < 0)) {
    return res.status(400).json({ error: 'odometer_km must be a non-negative number' });
  }

  const cleanComplaint = String(complaint ?? '').trim() || 'Ръчно добавен ремонт';

  // Load vehicle + client context
  db.get(
    `
      SELECT v.reg_number, v.client_id, c.name as client_name
      FROM vehicles v
      JOIN clients c ON v.client_id = c.id
      WHERE v.id = ?
    `,
    [vehicleId],
    (getErr, vrow) => {
      if (getErr) {
        return res.status(500).json({ error: getErr.message });
      }
      if (!vrow?.reg_number) {
        return res.status(404).json({ error: 'Vehicle not found' });
      }

      // Insert as a completed order so it appears in history.
      db.run(
        `
          INSERT INTO orders (client_id, client_name, reg_number, complaint, status, odometer_km, created_at, completed_at)
          VALUES (?, ?, ?, ?, 'completed', ?, ?, ?)
        `,
        [vrow.client_id || null, vrow.client_name || '', vrow.reg_number, cleanComplaint, odo, dt, dt],
        function (insErr) {
          if (insErr) {
            return res.status(500).json({ error: insErr.message });
          }
          db.get('SELECT * FROM orders WHERE id = ?', [this.lastID], (ordErr, orderRow) => {
            if (ordErr) {
              return res.status(500).json({ error: ordErr.message });
            }
            return res.json(orderRow);
          });
        }
      );
    }
  );
});

module.exports = router;
