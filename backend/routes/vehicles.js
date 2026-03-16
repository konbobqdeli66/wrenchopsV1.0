const express = require('express');
const db = require('../db');
const { checkPermission } = require('../middleware/permissions');
const { ciIncludes } = require('../utils/ciText');

const router = express.Router();

// Get all vehicles with client info
router.get('/', checkPermission('vehicles', 'read'), (req, res) => {
  const query = `
    SELECT v.*, c.name as client_name
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
    SELECT v.*, c.name as client_name
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
    SELECT v.*, c.name as client_name
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
    SELECT v.*, c.name as client_name
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
  const { reg_number, vin, brand, model, vehicle_type, gear_box, axes, year } = req.body;

  db.run(
    'UPDATE vehicles SET reg_number = ?, vin = ?, brand = ?, model = ?, vehicle_type = ?, gear_box = ?, axes = ?, year = ? WHERE id = ?',
    [reg_number, vin, brand, model, vehicle_type, gear_box, axes, year, req.params.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'Vehicle updated successfully' });
    }
  );
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

module.exports = router;
