const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const db = require('../db');

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

const WORKTIME_HEADERS_BG = ['ID', 'Заглавие*', 'Часове*', 'Компонент'];

const makeWorktimesWorkbook = (rows) => {
  const wb = XLSX.utils.book_new();
  const data = [WORKTIME_HEADERS_BG];

  (rows || []).forEach((r) => {
    data.push([
      r?.id ?? '',
      r?.title ?? '',
      r?.hours ?? '',
      r?.component_type ?? 'regular',
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Нормовремена');

  const instr = XLSX.utils.aoa_to_sheet([
    ['ИНСТРУКЦИИ'],
    ['1) Попълнете/редактирайте редовете в лист "Нормовремена".'],
    ['2) Колоните с * са задължителни.'],
    ['3) Ако има ID, записът ще се обнови. Ако ID е празно, ще се създаде ново нормовреме.'],
    ['4) Компонент е ключ (пример: regular, cabin, gearbox...).'],
  ]);
  XLSX.utils.book_append_sheet(wb, instr, 'ИНСТРУКЦИИ');
  return wb;
};

// Middleware to check permissions
const checkPermission = (module, action) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, 'secretkey');
      if (decoded.role === 'admin') {
        return next(); // Admin has all permissions
      }

      // Check user permissions
      db.get(
        'SELECT * FROM permissions WHERE user_id = ? AND module = ?',
        [decoded.id, module],
        (err, perm) => {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }

          if (!perm) {
            return res.status(403).json({ error: 'No permissions found' });
          }

          const permissionMap = {
            'read': perm.can_read,
            'write': perm.can_write,
            'delete': perm.can_delete
          };

          if (permissionMap[action] !== 1) {
            return res.status(403).json({ error: `No ${action} permission for ${module}` });
          }

          req.user = decoded;
          next();
        }
      );
    } catch (error) {
      res.status(401).json({ error: 'Invalid token' });
    }
  };
};

// Всички нормовремена
router.get('/', checkPermission('worktimes', 'read'), (req, res) => {
    db.all('SELECT * FROM worktimes', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// --- XLSX (template/export/import) ---
router.get('/xlsx/template', checkPermission('worktimes', 'read'), (req, res) => {
  try {
    const wb = makeWorktimesWorkbook([]);
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
    const rows = await allAsync('SELECT * FROM worktimes ORDER BY id ASC');
    const wb = makeWorktimesWorkbook(rows);
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', XLSX_MIME);
    res.setHeader('Content-Disposition', 'attachment; filename="worktimes_export.xlsx"');
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
    const expected = WORKTIME_HEADERS_BG;
    const headerOk = expected.every((h, i) => (header[i] || '') === h);
    if (!headerOk) {
      return res.status(400).json({
        error: 'Невалиден шаблон. Моля използвайте XLSX шаблона от системата.',
        expectedHeader: expected,
        gotHeader: header,
      });
    }

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
             SET title = ?, hours = ?, component_type = ?
             WHERE id = ?`,
            [title, hours, component_type, id]
          );
          if (result.changes > 0) updated++;
          else {
            await runAsync('INSERT INTO worktimes (title, hours, component_type) VALUES (?, ?, ?)', [title, hours, component_type]);
            inserted++;
          }
        } else {
          await runAsync('INSERT INTO worktimes (title, hours, component_type) VALUES (?, ?, ?)', [title, hours, component_type]);
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
    const { title, hours, component_type } = req.body;

    db.run(
        'INSERT INTO worktimes (title, hours, component_type) VALUES (?, ?, ?)',
        [title, hours, component_type || 'cabin'],
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
