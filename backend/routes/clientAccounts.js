const express = require('express');
const db = require('../db');
const { verifyToken } = require('../middleware/permissions');

const router = express.Router();

const requireClient = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  verifyToken(token, (verifyErr, decoded) => {
    if (verifyErr) {
      const isRevoked = verifyErr.code === 'TOKEN_REVOKED';
      const isInactive = verifyErr.code === 'USER_INACTIVE';
      return res.status(401).json({
        error: isRevoked ? 'Session expired' : isInactive ? 'Account inactive' : 'Invalid token',
      });
    }

    if (String(decoded?.role || '').trim() !== 'client') {
      return res.status(403).json({ error: 'Client access required' });
    }

    const clientId = Number(decoded?.client_id);
    if (!Number.isFinite(clientId) || clientId <= 0) {
      return res.status(403).json({ error: 'Client account is not linked to a client profile' });
    }

    req.user = decoded;
    return next();
  });
};

// Client: session (own client + vehicles/trailers)
router.get('/session', requireClient, (req, res) => {
  const clientId = Number(req.user.client_id);

  db.get('SELECT id, name, email, phone, address FROM clients WHERE id = ?', [clientId], (cErr, client) => {
    if (cErr) return res.status(500).json({ error: cErr.message });
    if (!client) return res.status(404).json({ error: 'Client not found' });

    db.all(
      `
        SELECT
          v.*,
          (
            SELECT COUNT(1)
            FROM orders o
            WHERE UPPER(o.reg_number) = UPPER(v.reg_number)
          ) as history_count
        FROM vehicles v
        WHERE v.client_id = ?
        ORDER BY
          CASE WHEN v.vehicle_type = 'truck' THEN 0 ELSE 1 END,
          v.brand,
          v.model,
          v.reg_number
      `,
      [clientId],
      (vErr, rows) => {
        if (vErr) return res.status(500).json({ error: vErr.message });
        return res.json({
          client,
          vehicles: rows || [],
        });
      }
    );
  });
});

// Client: service history for a vehicle (scoped by logged-in client account)
router.get('/vehicles/:id/history', requireClient, (req, res) => {
  const clientId = Number(req.user.client_id);
  const vehicleId = Number(req.params.id);
  if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
    return res.status(400).json({ error: 'Invalid vehicle id' });
  }

  db.get(
    'SELECT id, client_id, reg_number FROM vehicles WHERE id = ?',
    [vehicleId],
    (vErr, vrow) => {
      if (vErr) return res.status(500).json({ error: vErr.message });
      if (!vrow) return res.status(404).json({ error: 'Vehicle not found' });
      if (Number(vrow.client_id) !== clientId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      db.all(
        `
          SELECT
            o.*,
            COALESCE(c.name, o.client_name) as client_name,
            COALESCE(o.completed_at, o.created_at) as service_date
          FROM orders o
          LEFT JOIN clients c ON o.client_id = c.id
          WHERE UPPER(o.reg_number) = UPPER(?)
          ORDER BY datetime(COALESCE(o.completed_at, o.created_at)) DESC, o.id DESC
        `,
        [vrow.reg_number],
        (hErr, rows) => {
          if (hErr) return res.status(500).json({ error: hErr.message });
          return res.json(rows || []);
        }
      );
    }
  );
});

module.exports = router;

