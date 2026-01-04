const express = require('express');
const db = require('../db');
const { JWT_SECRET } = require('../config');

const router = express.Router();

// Middleware to verify JWT token
const { verifyToken } = require('../middleware/permissions');
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Access token required' });

  verifyToken(token, (verifyErr, user) => {
    if (verifyErr) {
      const isRevoked = verifyErr.code === 'TOKEN_REVOKED';
      const isInactive = verifyErr.code === 'USER_INACTIVE';
      return res.status(401).json({ message: isRevoked ? 'Session expired' : isInactive ? 'Account inactive' : 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Get user preferences
router.get('/', authenticateToken, (req, res) => {
  db.get('SELECT * FROM user_preferences WHERE user_id = ?', [req.user.id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    if (!row) {
      // Create default preferences if none exist
      const defaultPrefs = {
        dark_mode: 0,
        language: 'bg',
        primary_color: '#1976d2',
        appbar_gradient: 'pink',
        invoice_prepared_by_name: ''
      };

      db.run(
        'INSERT INTO user_preferences (user_id, dark_mode, language, primary_color, appbar_gradient, invoice_prepared_by_name) VALUES (?, ?, ?, ?, ?, ?)',
        [
          req.user.id,
          defaultPrefs.dark_mode,
          defaultPrefs.language,
          defaultPrefs.primary_color,
          defaultPrefs.appbar_gradient,
          defaultPrefs.invoice_prepared_by_name
        ],
        function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          res.json(defaultPrefs);
        }
      );
    } else {
      res.json({
        dark_mode: row.dark_mode,
        language: row.language,
        primary_color: row.primary_color,
        appbar_gradient: row.appbar_gradient || 'pink',
        invoice_prepared_by_name: row.invoice_prepared_by_name || ''
      });
    }
  });
});

// Update user preferences
router.put('/', authenticateToken, (req, res) => {
  const { dark_mode, language, primary_color, appbar_gradient, invoice_prepared_by_name } = req.body;

  db.run(
    'UPDATE user_preferences SET dark_mode = ?, language = ?, primary_color = ?, appbar_gradient = ?, invoice_prepared_by_name = ? WHERE user_id = ?',
    [dark_mode ? 1 : 0, language, primary_color, appbar_gradient || 'pink', invoice_prepared_by_name || '', req.user.id],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (this.changes === 0) {
        // Preferences don't exist, create them
        db.run(
          'INSERT INTO user_preferences (user_id, dark_mode, language, primary_color, appbar_gradient, invoice_prepared_by_name) VALUES (?, ?, ?, ?, ?, ?)',
          [req.user.id, dark_mode ? 1 : 0, language, primary_color, appbar_gradient || 'pink', invoice_prepared_by_name || ''],
          function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            res.json({ message: 'Preferences updated successfully' });
          }
        );
      } else {
        res.json({ message: 'Preferences updated successfully' });
      }
    }
  );
});

// Public (authenticated) company settings for printing/invoicing
router.get('/company', authenticateToken, (req, res) => {
  db.get('SELECT * FROM company_settings WHERE id = 1', [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row || { id: 1, hourly_rate: 100, vat_rate: 20, payment_method: 'Банков път' });
  });
});

module.exports = router;
