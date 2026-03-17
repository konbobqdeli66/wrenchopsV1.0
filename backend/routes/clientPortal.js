const express = require('express');
const db = require('../db');

const router = express.Router();

const normalize = (v) => String(v ?? '').trim();

const loadClientByToken = (token, cb) => {
  const t = normalize(token);
  if (!t) return cb(null, null);

  db.get(
    `
      SELECT
        l.id as link_id,
        l.client_id,
        l.is_active,
        l.created_at,
        l.revoked_at,
        l.last_used_at,
        c.name as client_name
      FROM client_portal_links l
      JOIN clients c ON c.id = l.client_id
      WHERE l.token = ?
      LIMIT 1
    `,
    [t],
    (err, row) => {
      if (err) return cb(err, null);
      if (!row) return cb(null, null);
      if (Number(row.is_active) !== 1) return cb(null, { inactive: true, ...row });
      return cb(null, row);
    }
  );
};

// Public: validate token and return client + vehicles/trailers
router.get('/session', (req, res) => {
  const token = req.query?.token;

  loadClientByToken(token, (err, link) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!link) return res.status(401).json({ error: 'Невалиден линк.' });
    if (link.inactive) return res.status(403).json({ error: 'Линкът е деактивиран.' });

    // Best-effort: update last_used_at
    db.run(
      `UPDATE client_portal_links SET last_used_at = datetime('now') WHERE id = ?`,
      [link.link_id]
    );

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
      [link.client_id],
      (listErr, rows) => {
        if (listErr) return res.status(500).json({ error: listErr.message });
        return res.json({
          client: { id: link.client_id, name: link.client_name },
          vehicles: rows || [],
        });
      }
    );
  });
});

// Public: service history for a vehicle (scoped by client link)
router.get('/vehicles/:id/history', (req, res) => {
  const token = req.query?.token;
  const vehicleId = req.params.id;

  loadClientByToken(token, (err, link) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!link) return res.status(401).json({ error: 'Невалиден линк.' });
    if (link.inactive) return res.status(403).json({ error: 'Линкът е деактивиран.' });

    db.get(
      'SELECT id, client_id, reg_number FROM vehicles WHERE id = ?',
      [vehicleId],
      (vErr, vrow) => {
        if (vErr) return res.status(500).json({ error: vErr.message });
        if (!vrow) return res.status(404).json({ error: 'Vehicle not found' });
        if (Number(vrow.client_id) !== Number(link.client_id)) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        db.all(
          `
            SELECT
              o.*,
              COALESCE(o.completed_at, o.created_at) as service_date
            FROM orders o
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
});

// Public: operations (worktimes) for a completed order in the service history
// Scoped by client link token: an order is visible only if its reg_number matches
// a vehicle owned by the client linked to the token.
router.get('/orders/:orderId/worktimes', (req, res) => {
  const token = req.query?.token;
  const orderId = Number(req.params.orderId);

  if (!Number.isFinite(orderId) || orderId <= 0) {
    return res.status(400).json({ error: 'Invalid order id' });
  }

  loadClientByToken(token, (err, link) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!link) return res.status(401).json({ error: 'Невалиден линк.' });
    if (link.inactive) return res.status(403).json({ error: 'Линкът е деактивиран.' });

    // Hourly rate is configured in Admin -> Company settings.
    // We use it to convert "Свободни Операции" (free_ops) prices into equivalent labor hours:
    // hours = unit_price_bgn / hourly_rate.
    db.get(
      'SELECT hourly_rate FROM company_settings WHERE id = 1',
      [],
      (rateErr, rateRow) => {
        // Safe fallback if the table is missing / not initialized yet.
        const hourlyRate = rateErr ? 100 : (Number(rateRow?.hourly_rate) || 100);

    db.get(
      `
        SELECT o.id, o.reg_number
        FROM orders o
        WHERE o.id = ?
        LIMIT 1
      `,
      [orderId],
      (oErr, orderRow) => {
        if (oErr) return res.status(500).json({ error: oErr.message });
        if (!orderRow) return res.status(404).json({ error: 'Order not found' });

        // Ownership check: order reg_number must match one of the client's vehicles.
        db.get(
          `
            SELECT v.id
            FROM vehicles v
            WHERE v.client_id = ?
              AND UPPER(v.reg_number) = UPPER(?)
            LIMIT 1
          `,
          [link.client_id, orderRow.reg_number],
          (vErr, vrow) => {
            if (vErr) return res.status(500).json({ error: vErr.message });
            if (!vrow) return res.status(403).json({ error: 'Forbidden' });

            db.all(
              `
                SELECT
                  ow.id,
                  ow.order_id,
                  ow.worktime_id,
                  ow.quantity,
                  ow.unit_price_bgn,
                  ow.notes,
                  ow.created_at,
                  w.title as worktime_title,
                  w.hours,
                  w.component_type
                FROM order_worktimes ow
                JOIN worktimes w ON w.id = ow.worktime_id
                WHERE ow.order_id = ?
                ORDER BY datetime(ow.created_at) ASC, ow.id ASC
              `,
              [orderId],
              (wtErr, rows) => {
                if (wtErr) return res.status(500).json({ error: wtErr.message });

                const safeRate = Math.max(0, Number(hourlyRate) || 0);
                const mapped = (rows || []).map((r) => {
                  const component = String(r?.component_type || '').trim();
                  const isFreeOps = component === 'free_ops';
                  const qty = Number(r?.quantity) || 0;
                  const baseHoursPerUnit = Number(r?.hours) || 0;
                  const unitPrice = Number(r?.unit_price_bgn) || 0;

                  const effectiveHoursPerUnit = isFreeOps
                    ? (safeRate > 0 ? unitPrice / safeRate : 0)
                    : baseHoursPerUnit;
                  const effectiveTotalHours = effectiveHoursPerUnit * qty;

                  return {
                    ...r,
                    effective_hours_per_unit: effectiveHoursPerUnit,
                    effective_total_hours: effectiveTotalHours,
                  };
                });

                return res.json(mapped);
              }
            );
          }
        );
      }
    );
      }
    );
  });
});

// Public: update reg_number / vin only (scoped by client link)
router.put('/vehicles/:id', (req, res) => {
  const token = req.query?.token;
  const vehicleId = req.params.id;

  loadClientByToken(token, (err, link) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!link) return res.status(401).json({ error: 'Невалиден линк.' });
    if (link.inactive) return res.status(403).json({ error: 'Линкът е деактивиран.' });

    const newReg = normalize(req.body?.reg_number);
    const newVin = normalize(req.body?.vin);

    if (!newReg) {
      return res.status(400).json({ error: 'reg_number е задължително поле' });
    }
    if (newReg.length > 32) {
      return res.status(400).json({ error: 'reg_number е твърде дълъг' });
    }
    if (newVin && newVin.length > 64) {
      return res.status(400).json({ error: 'vin е твърде дълъг' });
    }

    db.get(
      'SELECT id, client_id, reg_number, vin FROM vehicles WHERE id = ?',
      [vehicleId],
      (vErr, vrow) => {
        if (vErr) return res.status(500).json({ error: vErr.message });
        if (!vrow) return res.status(404).json({ error: 'Vehicle not found' });
        if (Number(vrow.client_id) !== Number(link.client_id)) {
          return res.status(403).json({ error: 'Forbidden' });
        }

        const oldReg = normalize(vrow.reg_number);

        db.run(
          'UPDATE vehicles SET reg_number = ?, vin = ? WHERE id = ? AND client_id = ?',
          [newReg, newVin || null, vehicleId, link.client_id],
          function (updErr) {
            if (updErr) return res.status(500).json({ error: updErr.message });
            if (this.changes === 0) return res.status(404).json({ error: 'Vehicle not found' });

            // Keep service history mapping consistent: if reg number changes, update past orders
            // for this client and the previous reg number.
            if (oldReg && oldReg.toUpperCase() !== newReg.toUpperCase()) {
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
                [newReg, oldReg, link.client_id, link.client_id]
              );
            }

            db.get('SELECT * FROM vehicles WHERE id = ?', [vehicleId], (getErr, row) => {
              if (getErr) return res.status(500).json({ error: getErr.message });
              return res.json(row);
            });
          }
        );
      }
    );
  });
});

// Public: add new vehicle/trailer (scoped by client link)
router.post('/vehicles', (req, res) => {
  const token = req.query?.token;

  loadClientByToken(token, (err, link) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!link) return res.status(401).json({ error: 'Невалиден линк.' });
    if (link.inactive) return res.status(403).json({ error: 'Линкът е деактивиран.' });

    const vehicle_type = normalize(req.body?.vehicle_type).toLowerCase() === 'trailer' ? 'trailer' : 'truck';
    const reg_number = normalize(req.body?.reg_number);
    const vin = normalize(req.body?.vin);

    if (!reg_number) {
      return res.status(400).json({ error: 'reg_number е задължително поле' });
    }
    if (reg_number.length > 32) {
      return res.status(400).json({ error: 'reg_number е твърде дълъг' });
    }
    if (vin && vin.length > 64) {
      return res.status(400).json({ error: 'vin е твърде дълъг' });
    }

    db.run(
      `
        INSERT INTO vehicles (client_id, reg_number, vin, vehicle_type, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `,
      [link.client_id, reg_number, vin || null, vehicle_type],
      function (insErr) {
        if (insErr) return res.status(500).json({ error: insErr.message });
        db.get('SELECT * FROM vehicles WHERE id = ?', [this.lastID], (getErr, row) => {
          if (getErr) return res.status(500).json({ error: getErr.message });
          return res.json(row);
        });
      }
    );
  });
});

module.exports = router;

