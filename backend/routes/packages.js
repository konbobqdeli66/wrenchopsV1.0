const express = require('express');
const router = express.Router();
const db = require('../db');
const { checkPermission } = require('../middleware/permissions');

const normalizeTitle = (v) => String(v ?? '').trim();
const toNumber = (v) => {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
};

// List packages
router.get('/', checkPermission('packages', 'read'), (req, res) => {
  db.all('SELECT * FROM packages ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    return res.json(rows || []);
  });
});

// Create package
router.post('/', checkPermission('packages', 'write'), (req, res) => {
  const title = normalizeTitle(req.body?.title);
  const hours = toNumber(req.body?.hours);
  if (!title) return res.status(400).json({ error: 'title е задължително поле' });
  if (!Number.isFinite(hours) || hours < 0) return res.status(400).json({ error: 'hours е невалидно' });

  db.run(
    'INSERT INTO packages (title, hours) VALUES (?, ?)',
    [title, hours],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      db.get('SELECT * FROM packages WHERE id = ?', [this.lastID], (gErr, row) => {
        if (gErr) return res.status(500).json({ error: gErr.message });
        return res.json(row);
      });
    }
  );
});

// Update package
router.put('/:id', checkPermission('packages', 'write'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });

  const title = req.body?.title === undefined ? null : normalizeTitle(req.body?.title);
  const hoursRaw = req.body?.hours;
  const hours = hoursRaw === undefined ? null : toNumber(hoursRaw);
  if (title !== null && !title) return res.status(400).json({ error: 'title е задължително поле' });
  if (hours !== null && (!Number.isFinite(hours) || hours < 0)) return res.status(400).json({ error: 'hours е невалидно' });

  db.run(
    'UPDATE packages SET title = COALESCE(?, title), hours = COALESCE(?, hours) WHERE id = ?',
    [title, hours, id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
      db.get('SELECT * FROM packages WHERE id = ?', [id], (gErr, row) => {
        if (gErr) return res.status(500).json({ error: gErr.message });
        return res.json(row);
      });
    }
  );
});

// Delete package
router.delete('/:id', checkPermission('packages', 'delete'), (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ error: 'Invalid id' });
  db.run('DELETE FROM packages WHERE id = ?', [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ success: true });
  });
});

module.exports = router;

