const express = require('express');
const router = express.Router();
const db = require('../db');
const { checkPermission, verifyToken } = require('../middleware/permissions');

const XLSX = require('xlsx');
const multer = require('multer');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB
  },
});

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

const runAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const allAsync = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });

const normalize = (v) => String(v ?? '').trim();

// Authentication (any active user with a valid JWT)
const authenticateToken = (req, res, next) => {
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
    req.user = decoded;
    next();
  });
};

const FREE_OPS_COMPONENT_TYPE = 'free_ops';

const WORKTIME_HEADERS_BG_V1 = ['ID', 'Заглавие*', 'Часове*', 'Компонент'];
const WORKTIME_HEADERS_BG_V2 = ['ID', 'Заглавие*', 'Часове*', 'Компонент', 'Тип'];

const makeWorktimesWorkbook = (rows, { includeVehicleType = true } = {}) => {
  const wb = XLSX.utils.book_new();
  const header = includeVehicleType ? WORKTIME_HEADERS_BG_V2 : WORKTIME_HEADERS_BG_V1;
  const data = [header];

  (rows || []).forEach((r) => {
    const base = [
      r?.id ?? '',
      r?.title ?? '',
      r?.hours ?? '',
      r?.component_type ?? 'regular',
    ];
    if (includeVehicleType) {
      base.push(r?.vehicle_type ?? 'truck');
    }
    data.push(base);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Нормовремена');

  const instr = XLSX.utils.aoa_to_sheet([
    ['ИНСТРУКЦИИ'],
    ['1) Попълнете/редактирайте редовете в лист "Нормовремена".'],
    ['2) Колоните с * са задължителни.'],
    ['3) Ако има ID, записът ще се обнови. Ако ID е празно, ще се създаде ново нормовреме.'],
    ['4) Компонент е ключ (пример: regular, cabin, gearbox...) или подменю код (пример: 21, 30).'],
    ['5) Тип: truck или trailer (по подразбиране: truck).'],
  ]);
  XLSX.utils.book_append_sheet(wb, instr, 'ИНСТРУКЦИИ');
  return wb;
};

// Всички нормовремена
router.get('/', checkPermission('worktimes', 'read'), (req, res) => {
    const vt = String(req.query.vehicle_type || '').trim().toLowerCase();
    const isValidVt = vt === 'truck' || vt === 'trailer';
    const sql = isValidVt ? 'SELECT * FROM worktimes WHERE vehicle_type = ?' : 'SELECT * FROM worktimes';
    const params = isValidVt ? [vt] : [];

    db.all(sql, params, (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// --- Free operations (editable by ALL authenticated users) ---
// These are stored in the same table (worktimes) with component_type = 'free_ops' and hours = 0.
router.get('/free_ops', authenticateToken, (req, res) => {
  const vt = String(req.query.vehicle_type || '').trim().toLowerCase();
  const isValidVt = vt === 'truck' || vt === 'trailer';
  const sql =
    'SELECT * FROM worktimes WHERE component_type = ?' + (isValidVt ? ' AND vehicle_type = ?' : '');
  const params = isValidVt ? [FREE_OPS_COMPONENT_TYPE, vt] : [FREE_OPS_COMPONENT_TYPE];

  db.all(sql, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    return res.json(rows || []);
  });
});

router.post('/free_ops', authenticateToken, (req, res) => {
  const { title, vehicle_type } = req.body || {};
  const cleanTitle = normalize(title);

  if (!cleanTitle) {
    return res.status(400).json({ error: 'title is required' });
  }

  const vt = String(vehicle_type || '').trim().toLowerCase();
  const safeVehicleType = vt === 'trailer' ? 'trailer' : 'truck';

  db.run(
    'INSERT INTO worktimes (title, hours, component_type, vehicle_type) VALUES (?, ?, ?, ?)',
    [cleanTitle, 0, FREE_OPS_COMPONENT_TYPE, safeVehicleType],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      db.get('SELECT * FROM worktimes WHERE id = ?', [this.lastID], (getErr, row) => {
        if (getErr) {
          return res.status(500).json({ error: getErr.message });
        }
        return res.json(row);
      });
    }
  );
});

router.put('/free_ops/:id', authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  const { title, vehicle_type } = req.body || {};
  const cleanTitle = normalize(title);
  const vt = String(vehicle_type || '').trim().toLowerCase();
  const safeVehicleType = vt ? (vt === 'trailer' ? 'trailer' : 'truck') : null;

  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  if (!cleanTitle && !safeVehicleType) {
    return res.status(400).json({ error: 'Nothing to update' });
  }

  db.run(
    `UPDATE worktimes
     SET
       title = COALESCE(?, title),
       vehicle_type = COALESCE(?, vehicle_type),
       hours = 0,
       component_type = ?
     WHERE id = ? AND component_type = ?`,
    [cleanTitle || null, safeVehicleType, FREE_OPS_COMPONENT_TYPE, id, FREE_OPS_COMPONENT_TYPE],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Free operation not found' });
      }
      db.get('SELECT * FROM worktimes WHERE id = ?', [id], (getErr, row) => {
        if (getErr) {
          return res.status(500).json({ error: getErr.message });
        }
        return res.json(row);
      });
    }
  );
});

router.delete('/free_ops/:id', authenticateToken, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ error: 'Invalid id' });
  }

  db.run(
    'DELETE FROM worktimes WHERE id = ? AND component_type = ?',
    [id, FREE_OPS_COMPONENT_TYPE],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Free operation not found' });
      }
      return res.json({ message: 'Free operation deleted.' });
    }
  );
});

// --- XLSX (template/export/import) ---
router.get('/xlsx/template', checkPermission('worktimes', 'read'), (req, res) => {
  try {
    const wb = makeWorktimesWorkbook([], { includeVehicleType: true });
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="worktimes_template.xlsx"');
    return res.send(buf);
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'XLSX export failed' });
  }
});

router.get('/xlsx/export', checkPermission('worktimes', 'read'), async (req, res) => {
  try {
    const vt = String(req.query.vehicle_type || '').trim().toLowerCase();
    const isValidVt = vt === 'truck' || vt === 'trailer';
    const rows = isValidVt
      ? await allAsync('SELECT * FROM worktimes WHERE vehicle_type = ? ORDER BY id ASC', [vt])
      : await allAsync('SELECT * FROM worktimes ORDER BY id ASC');

    const wb = makeWorktimesWorkbook(rows, { includeVehicleType: true });
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', XLSX_MIME);
    const fileSuffix = isValidVt ? `_${vt}` : '';
    res.setHeader('Content-Disposition', `attachment; filename="worktimes_export${fileSuffix}.xlsx"`);
    return res.send(buf);
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'XLSX export failed' });
  }
});

router.post('/xlsx/import', checkPermission('worktimes', 'write'), upload.single('file'), async (req, res) => {
  try {
    const file = req.file;
    if (!file?.buffer?.length) {
      return res.status(400).json({ error: 'Missing XLSX file (field: file)' });
    }

    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const sheetName = wb.SheetNames.includes('Нормовремена') ? 'Нормовремена' : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    if (!ws) return res.status(400).json({ error: 'No worksheet found in XLSX' });

    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    const header = (aoa[0] || []).map((x) => String(x || '').trim());
    const matchesV1 = WORKTIME_HEADERS_BG_V1.every((h, i) => (header[i] || '') === h);
    const matchesV2 = WORKTIME_HEADERS_BG_V2.every((h, i) => (header[i] || '') === h);
    if (!matchesV1 && !matchesV2) {
      return res.status(400).json({
        error: 'Невалиден шаблон. Моля използвайте XLSX шаблона от системата.',
        expectedHeader: WORKTIME_HEADERS_BG_V2,
        gotHeader: header,
      });
    }

    const hasVehicleTypeCol = matchesV2;

    const dataRows = aoa.slice(1).filter((r) => (r || []).some((cell) => String(cell || '').trim() !== ''));
    if (dataRows.length === 0) {
      return res.json({ success: true, inserted: 0, updated: 0, skipped: 0, errors: [] });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    await runAsync('BEGIN IMMEDIATE TRANSACTION');
    try {
      for (let idx = 0; idx < dataRows.length; idx++) {
        const r = dataRows[idx] || [];
        const rowNo = idx + 2;

        const idRaw = r[0];
        const title = normalize(r[1]);
        const hoursRaw = normalize(r[2]);
        const component_type = normalize(r[3]) || 'regular';
        const vehicle_type = hasVehicleTypeCol ? (normalize(r[4]) || 'truck') : 'truck';

        const vt = String(vehicle_type || '').trim().toLowerCase();
        const safeVehicleType = vt === 'trailer' ? 'trailer' : 'truck';

        const hours = Number(String(hoursRaw).replace(',', '.'));

        if (!title) {
          skipped++;
          errors.push(`Ред ${rowNo}: липсва задължително поле "Заглавие*".`);
          continue;
        }
        if (!Number.isFinite(hours) || hours < 0) {
          skipped++;
          errors.push(`Ред ${rowNo}: невалидна стойност за "Часове*".`);
          continue;
        }

        const id = Number(String(idRaw || '').trim());
        if (Number.isFinite(id) && id > 0) {
          const result = await runAsync(
            `UPDATE worktimes
             SET title = ?, hours = ?, component_type = ?, vehicle_type = ?
             WHERE id = ?`,
            [title, hours, component_type, safeVehicleType, id]
          );
          if (result.changes > 0) updated++;
          else {
            await runAsync(
              'INSERT INTO worktimes (title, hours, component_type, vehicle_type) VALUES (?, ?, ?, ?)',
              [title, hours, component_type, safeVehicleType]
            );
            inserted++;
          }
        } else {
          await runAsync(
            'INSERT INTO worktimes (title, hours, component_type, vehicle_type) VALUES (?, ?, ?, ?)',
            [title, hours, component_type, safeVehicleType]
          );
          inserted++;
        }
      }

      await runAsync('COMMIT');
    } catch (e) {
      await runAsync('ROLLBACK').catch(() => null);
      throw e;
    }

    return res.json({ success: true, inserted, updated, skipped, errors });
  } catch (e) {
    return res.status(500).json({ error: e?.message || 'XLSX import failed' });
  }
});

// Създаване на нормовреме
router.post('/', checkPermission('worktimes', 'write'), (req, res) => {
    const { title, hours, component_type, vehicle_type } = req.body;

    const vt = String(vehicle_type || '').trim().toLowerCase();
    const safeVehicleType = vt === 'trailer' ? 'trailer' : 'truck';

    const cleanTitle = normalize(title);
    const componentTypeRaw = normalize(component_type) || 'cabin';

    // Free operations templates can be created from the main worktimes endpoint too.
    // Rule: when component_type is 'free_ops', hours are OPTIONAL and always stored as 0.
    // All other worktimes require a valid non-negative hours value.
    const isFreeOps = componentTypeRaw === FREE_OPS_COMPONENT_TYPE;
    const parsedHours = isFreeOps ? 0 : Number(String(hours ?? '').replace(',', '.'));

    if (!cleanTitle) {
      return res.status(400).json({ error: 'title is required' });
    }
    if (!isFreeOps) {
      if (!Number.isFinite(parsedHours) || parsedHours < 0) {
        return res.status(400).json({ error: 'hours must be a non-negative number' });
      }
    }

    db.run(
        'INSERT INTO worktimes (title, hours, component_type, vehicle_type) VALUES (?, ?, ?, ?)',
        [cleanTitle, parsedHours, componentTypeRaw, safeVehicleType],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            db.get('SELECT * FROM worktimes WHERE id = ?', [this.lastID], (err, row) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }
                res.json(row);
            });
        }
    );
});

// Изтриване
router.delete('/:id', checkPermission('worktimes', 'delete'), (req, res) => {
    db.run('DELETE FROM worktimes WHERE id = ?', [req.params.id], function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ message: 'Нормовремето е изтрито.' });
    });
});

module.exports = router;
