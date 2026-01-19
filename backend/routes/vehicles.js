const express = require('express');
const db = require('../db');
const { checkPermission } = require('../middleware/permissions');

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
  const { q, reg_number, vin, brand, model, vehicle_type, client_id } = req.query;

  let query = `
    SELECT v.*, c.name as client_name
    FROM vehicles v
    JOIN clients c ON v.client_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (q) {
    // Case-insensitive search (NOCASE)
    query += ' AND (v.reg_number LIKE ? COLLATE NOCASE OR v.brand LIKE ? COLLATE NOCASE OR v.model LIKE ? COLLATE NOCASE OR c.name LIKE ? COLLATE NOCASE)';
    const searchTerm = `%${q}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }

  if (reg_number) {
    query += ' AND v.reg_number LIKE ? COLLATE NOCASE';
    params.push(`%${reg_number}%`);
  }

  if (vin) {
    query += ' AND v.vin LIKE ? COLLATE NOCASE';
    params.push(`%${vin}%`);
  }

  if (brand) {
    query += ' AND v.brand LIKE ? COLLATE NOCASE';
    params.push(`%${brand}%`);
  }

  if (model) {
    query += ' AND v.model LIKE ? COLLATE NOCASE';
    params.push(`%${model}%`);
  }

  if (vehicle_type) {
    query += ' AND v.vehicle_type = ?';
    params.push(vehicle_type);
  }

  if (client_id) {
    query += ' AND v.client_id = ?';
    params.push(client_id);
  }

  query += ' ORDER BY v.brand, v.model';

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
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
    SELECT o.*, c.name as client_name
    FROM orders o
    JOIN clients c ON o.client_name = c.name
    WHERE o.reg_number = (
      SELECT reg_number FROM vehicles WHERE id = ?
    )
    ORDER BY o.created_at DESC
  `;

  db.all(query, [req.params.id], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

module.exports = router;
