const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const { JWT_SECRET } = require('../config');

const normalizePublicAppUrl = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  // Allow entering without protocol (example: app.example.com)
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  // Remove trailing slash for safe concatenation
  return withProto.replace(/\/+$/, '');
};

// Middleware to verify admin access
const requireAdmin = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Get all users
router.get('/users', requireAdmin, (req, res) => {
  const db = req.app.get('db');
  db.all(`
    SELECT
      u.id,
      u.nickname,
      u.role,
      u.is_active,
      u.created_at,
      u.last_login,
      COUNT(p.id) as permissions_count
    FROM users u
    LEFT JOIN permissions p ON u.id = p.user_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Get user permissions
router.get('/users/:id/permissions', requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const userId = req.params.id;

  db.all('SELECT * FROM permissions WHERE user_id = ?', [userId], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Update user role
router.put('/users/:id/role', requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const userId = req.params.id;
  const { role } = req.body;

  if (!['user', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  db.run('UPDATE users SET role = ? WHERE id = ?', [role, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'Role updated successfully' });
  });
});

// Update user permissions
router.put('/users/:id/permissions', requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const userId = req.params.id;
  const { permissions } = req.body;

  // Delete existing permissions
  db.run('DELETE FROM permissions WHERE user_id = ?', [userId], (err) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    // Insert new permissions
    const stmt = db.prepare(`
      INSERT INTO permissions (user_id, module, can_access_module, can_read, can_write, can_delete)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    permissions.forEach(perm => {
      stmt.run([
        userId,
        perm.module,
        perm.can_access_module ? 1 : 0,
        perm.can_read ? 1 : 0,
        perm.can_write ? 1 : 0,
        perm.can_delete ? 1 : 0
      ]);
    });

    stmt.finalize();
    res.json({ message: 'Permissions updated successfully' });
  });
});

// Toggle user active status
router.put('/users/:id/status', requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const userId = req.params.id;
  const { is_active } = req.body;

  db.run('UPDATE users SET is_active = ? WHERE id = ?', [is_active ? 1 : 0, userId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User status updated successfully' });
  });
});

// Delete user
router.delete('/users/:id', requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const userId = req.params.id;

  // Don't allow deleting admin users
  db.get('SELECT role FROM users WHERE id = ?', [userId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (row.role === 'admin') {
      return res.status(400).json({ error: 'Cannot delete admin user' });
    }

    db.run('DELETE FROM users WHERE id = ?', [userId], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json({ message: 'User deleted successfully' });
    });
  });
});

// Create admin user (for initial setup)
router.post('/setup-admin', async (req, res) => {
  const db = req.app.get('db');
  const { nickname, password } = req.body;

  if (!nickname || !password) {
    return res.status(400).json({ error: 'Nickname and password required' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    db.run(`
      INSERT INTO users (nickname, password, role, is_active, created_at)
      VALUES (?, ?, 'admin', 1, datetime('now'))
    `, [nickname, hashedPassword], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(400).json({ error: 'Nickname already exists' });
        }
        return res.status(500).json({ error: err.message });
      }

      // Create default permissions for admin
      const userId = this.lastID;
      const defaultPermissions = [
        { module: 'home', can_access_module: 1, can_read: 1, can_write: 0, can_delete: 0 },
        { module: 'clients', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 },
        { module: 'orders', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 },
        { module: 'worktimes', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 },
        { module: 'vehicles', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 },
        { module: 'admin', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 }
      ];

      const stmt = db.prepare(`
        INSERT INTO permissions (user_id, module, can_access_module, can_read, can_write, can_delete)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      defaultPermissions.forEach(perm => {
        stmt.run([userId, perm.module, perm.can_access_module, perm.can_read, perm.can_write, perm.can_delete]);
      });

      stmt.finalize();
      res.json({ message: 'Admin user created successfully' });
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Company settings (supplier info, invoice settings)
router.get('/settings', requireAdmin, (req, res) => {
  const db = req.app.get('db');
  db.get('SELECT * FROM company_settings WHERE id = 1', [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(row || { id: 1 });
  });
});

router.put('/settings', requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const {
    company_name,
    eik,
    vat_number,
    city,
    address,
    phone,
    contact_email,
    mol,
    bank_name,
    bic,
    iban,
    logo_data_url,
    invoice_prefix,
    invoice_pad_length,
    invoice_offset,
    invoice_last_number,
    protocol_pad_length,
    protocol_offset,
    protocol_last_number,
    app_brand_name,
    app_tagline_short,
    app_tagline_secondary,
    app_brand_font,
    app_brand_font_size,
    login_show_branding,
    login_gradient,
    public_app_url,
    payment_method,
    hourly_rate,
    vat_rate,
    eur_rate,
    invoice_prepared_by_name
  } = req.body;

  // Ensure row exists
  db.run('INSERT OR IGNORE INTO company_settings (id) VALUES (1)');

  db.run(
    `
      UPDATE company_settings SET
        company_name = COALESCE(?, company_name),
        eik = COALESCE(?, eik),
        vat_number = COALESCE(?, vat_number),
        city = COALESCE(?, city),
        address = COALESCE(?, address),
        phone = COALESCE(?, phone),
        contact_email = COALESCE(?, contact_email),
        mol = COALESCE(?, mol),
        bank_name = COALESCE(?, bank_name),
        bic = COALESCE(?, bic),
        iban = COALESCE(?, iban),
        logo_data_url = COALESCE(?, logo_data_url),
        invoice_prefix = COALESCE(?, invoice_prefix),
        invoice_pad_length = COALESCE(?, invoice_pad_length),
        invoice_offset = COALESCE(?, invoice_offset),
        invoice_last_number = COALESCE(?, invoice_last_number),
        protocol_pad_length = COALESCE(?, protocol_pad_length),
        protocol_offset = COALESCE(?, protocol_offset),
        protocol_last_number = COALESCE(?, protocol_last_number),
        app_brand_name = COALESCE(?, app_brand_name),
        app_tagline_short = COALESCE(?, app_tagline_short),
        app_tagline_secondary = COALESCE(?, app_tagline_secondary),
        app_brand_font = COALESCE(?, app_brand_font),
        app_brand_font_size = COALESCE(?, app_brand_font_size),
        login_show_branding = COALESCE(?, login_show_branding),
        login_gradient = COALESCE(?, login_gradient),
        public_app_url = COALESCE(?, public_app_url),
        payment_method = COALESCE(?, payment_method),
        hourly_rate = COALESCE(?, hourly_rate),
        vat_rate = COALESCE(?, vat_rate),
      eur_rate = COALESCE(?, eur_rate),
        invoice_prepared_by_name = COALESCE(?, invoice_prepared_by_name)
      WHERE id = 1
    `,
    [
      company_name ?? null,
      eik ?? null,
      vat_number ?? null,
      city ?? null,
      address ?? null,
      phone ?? null,
      contact_email ?? null,
      mol ?? null,
      bank_name ?? null,
      bic ?? null,
      iban ?? null,
      logo_data_url ?? null,
      invoice_prefix ?? null,
      invoice_pad_length ?? null,
      invoice_offset ?? null,
      invoice_last_number ?? null,
      protocol_pad_length ?? null,
      protocol_offset ?? null,
      protocol_last_number ?? null,
      app_brand_name ?? null,
      app_tagline_short ?? null,
      app_tagline_secondary ?? null,
      app_brand_font ?? null,
      app_brand_font_size ?? null,
      login_show_branding ?? null,
      login_gradient ?? null,
      public_app_url === undefined ? null : normalizePublicAppUrl(public_app_url),
      payment_method ?? null,
      hourly_rate ?? null,
      vat_rate ?? null,
      eur_rate ?? null,
      invoice_prepared_by_name ?? null
    ],
    function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      db.get('SELECT * FROM company_settings WHERE id = 1', [], (err, row) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        res.json(row);
      });
    }
  );
});

// Generate invitation token
router.post('/invitations', requireAdmin, async (req, res) => {
  const db = req.app.get('db');
  const { email } = req.body;
  const createdBy = req.user.id;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  try {
    // Insert invitation into database
    await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO invitations (token, email, created_by, expires_at)
        VALUES (?, ?, ?, ?)
      `, [token, email, createdBy, expiresAt], function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            reject(new Error('Invitation already exists for this email'));
          } else {
            reject(err);
          }
        } else {
          resolve(this.lastID);
        }
      });
    });

    // Generate URL pointing to the public frontend URL.
    // Prefer company_settings.public_app_url if set; fallback to current host mapping.
    const publicAppUrl = await new Promise((resolve) => {
      db.get('SELECT public_app_url FROM company_settings WHERE id = 1', [], (err, row) => {
        if (err) return resolve('');
        return resolve(normalizePublicAppUrl(row?.public_app_url));
      });
    });

    const fallbackHost = req.get('host').replace(':5000', ':3000');
    const fallbackBase = `${req.protocol}://${fallbackHost}`;
    const baseUrl = publicAppUrl || fallbackBase;
    const invitationUrl = `${baseUrl}/register?token=${token}`;

    // Send email with invitation link
    const emailService = req.app.get('emailService');
    const emailSent = await emailService.sendInvitation(email, invitationUrl);

    if (!emailSent) {
      console.warn(`Failed to send invitation email to ${email}, but invitation was created`);
    }

    res.json({
      id: this.lastID,
      token,
      email,
      invitation_url: invitationUrl,
      expires_at: expiresAt,
      email_sent: emailSent
    });
  } catch (error) {
    if (error.message === 'Invitation already exists for this email') {
      return res.status(400).json({ error: error.message });
    }
    return res.status(500).json({ error: error.message });
  }
});

// Get all invitations
router.get('/invitations', requireAdmin, (req, res) => {
  const db = req.app.get('db');
  db.all(`
    SELECT
      i.*,
      u.nickname as created_by_name
    FROM invitations i
    LEFT JOIN users u ON i.created_by = u.id
    ORDER BY i.created_at DESC
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Delete invitation
router.delete('/invitations/:id', requireAdmin, (req, res) => {
  const db = req.app.get('db');
  const invitationId = req.params.id;

  db.run('DELETE FROM invitations WHERE id = ?', [invitationId], function(err) {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Invitation not found' });
    }
    res.json({ message: 'Invitation deleted successfully' });
  });
});

module.exports = router;
