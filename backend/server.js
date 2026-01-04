const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");

// Load environment variables from backend/.env (optional but recommended)
// This keeps SMTP credentials out of source code.
try {
  // eslint-disable-next-line global-require
  require('dotenv').config({ path: path.join(__dirname, '.env') });
} catch {
  // dotenv is optional; if not installed, rely on process.env provided by the runtime.
}

const nodemailer = require("nodemailer");
const bcrypt = require('bcrypt');
const authRoutes = require("./routes/authRoutes");
const clientsRoutes = require("./routes/clients");
const ordersRoutes = require("./routes/orders");
const worktimesRoutes = require("./routes/worktimes");
const preferencesRoutes = require("./routes/preferences");
const vehiclesRoutes = require("./routes/vehicles");
const adminRoutes = require("./routes/admin");
const passwordRecoveryRoutes = require("./routes/passwordRecovery");
const db = require("./db");

const app = express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
// Allow larger JSON payloads (e.g. base64 logos in company settings)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Root route
app.get('/', (req, res) => {
  res.json({
    message: 'Truck Service API Server',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      clients: '/clients',
      orders: '/orders',
      worktimes: '/worktimes',
      vehicles: '/vehicles',
      admin: '/admin',
      preferences: '/preferences'
    }
  });
});

// Public branding settings (used on Login/Register pages before auth)
app.get('/public/branding', (req, res) => {
  db.get(
    `
      SELECT
        logo_data_url,
        app_brand_name,
        app_tagline_short,
        app_tagline_secondary,
        app_brand_font,
        app_brand_font_size,
        login_show_branding,
        login_gradient
      FROM company_settings
      WHERE id = 1
    `,
    [],
    (err, row) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(
        row || {
          logo_data_url: null,
          app_brand_name: 'Truck Service',
          app_tagline_short: null,
          app_tagline_secondary: null,
          app_brand_font: 'Roboto',
          app_brand_font_size: 22,
          login_show_branding: 1,
          login_gradient: 'pink',
        }
      );
    }
  );
});

// --- PWA (install) manifest + icons ---
// Many browsers read the manifest BEFORE JS executes, so we must serve a correct
// manifest from the very first request (no runtime JS rewriting).

const FALLBACK_PWA_SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 24 24">
  <rect width="24" height="24" rx="4" fill="#ffffff"/>
  <path fill="#111" d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-4.7-2.4-7.1-1.4L9 5.7 5.7 9 1.6 4.9c-1 2.4-.6 5.1 1.4 7.1 1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l1.4-1.4c.4-.4.4-1 0-1.4z"/>
</svg>`;

const parseDataUrl = (dataUrl) => {
  const s = String(dataUrl || '');
  const match = s.match(/^data:([^;,]+)(;charset=[^;,]+)?(;base64)?,(.*)$/i);
  if (!match) return null;
  const mime = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[3]);
  const payload = match[4] || '';
  if (isBase64) {
    return { mime, buffer: Buffer.from(payload, 'base64') };
  }
  // Non-base64 payload is URL-encoded.
  return { mime, buffer: Buffer.from(decodeURIComponent(payload), 'utf8') };
};

const getCompanySettings = (cb) => {
  db.get(
    `SELECT logo_data_url, app_brand_name, company_name FROM company_settings WHERE id = 1`,
    [],
    (err, row) => {
      if (err) return cb(err);
      cb(null, row || null);
    }
  );
};

const sendPwaIcon = (req, res) => {
  getCompanySettings((err, row) => {
    if (err) return res.status(500).end();

    const parsed = parseDataUrl(row?.logo_data_url);
    if (!parsed?.buffer?.length) {
      res.setHeader('Content-Type', 'image/svg+xml');
      return res.send(FALLBACK_PWA_SVG);
    }

    res.setHeader('Content-Type', parsed.mime);
    // Keep caching conservative; branding can change.
    res.setHeader('Cache-Control', 'no-store');
    return res.send(parsed.buffer);
  });
};

// Icon endpoints (sizes are declared in the manifest; we return the stored logo as-is)
app.get('/public/pwa/icon-192.png', sendPwaIcon);
app.get('/public/pwa/icon-512.png', sendPwaIcon);
app.get('/public/pwa/icon.svg', sendPwaIcon);

// Dynamic web app manifest (same-origin via nginx/proxy in production)
app.get('/manifest.webmanifest', (req, res) => {
  getCompanySettings((err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }

    const appName =
      String(row?.app_brand_name || '').trim() ||
      String(row?.company_name || '').trim() ||
      'WrenchOps';

    const parsed = parseDataUrl(row?.logo_data_url);
    const mime = parsed?.mime || '';
    const isSvg = mime.includes('svg');

    const icons = row?.logo_data_url
      ? isSvg
        ? [
            {
              src: '/public/pwa/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml',
            },
          ]
        : [
            {
              src: '/public/pwa/icon-192.png',
              sizes: '192x192',
              type: mime || 'image/png',
            },
            {
              src: '/public/pwa/icon-512.png',
              sizes: '512x512',
              type: mime || 'image/png',
            },
          ]
      : [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
          },
        ];

    const manifest = {
      name: appName,
      short_name: appName,
      start_url: '/',
      display: 'standalone',
      theme_color: '#000000',
      background_color: '#ffffff',
      icons,
    };

    res.setHeader('Content-Type', 'application/manifest+json');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(JSON.stringify(manifest));
  });
});

app.use("/api/auth", authRoutes);
app.use("/password-recovery", passwordRecoveryRoutes);
app.use("/clients", clientsRoutes);
app.use("/orders", ordersRoutes);
app.use("/worktimes", worktimesRoutes);
app.use("/preferences", preferencesRoutes);
app.use("/vehicles", vehiclesRoutes);
app.use("/admin", adminRoutes);

// Ensure every user has a permissions row per module.
// IMPORTANT: This must NOT override admin-managed permissions.
// It should only:
// - create missing rows (INSERT OR IGNORE)
// - backfill NULL values (COALESCE)
//
// Default policy (can be changed from the Admin UI later):
// - Admins: full access to everything (including admin)
// - Non-admins: only Home is visible/accessible by default (read-only),
//   all other modules are disabled until an admin grants access.
const ensureDefaultPermissionsForAllUsers = () => {
  const modules = ['home', 'clients', 'orders', 'worktimes', 'vehicles', 'invoices', 'admin'];

  db.all('SELECT id, role FROM users', [], (err, users) => {
    if (err) {
      console.warn('Could not load users for permissions backfill:', err.message);
      return;
    }

    users.forEach((user) => {
      const isAdmin = user.role === 'admin';

      modules.forEach((module) => {
        const defaultPerms = (() => {
          if (isAdmin) {
            return { can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 };
          }
          if (module === 'home') {
            return { can_access_module: 1, can_read: 1, can_write: 0, can_delete: 0 };
          }
          return { can_access_module: 0, can_read: 0, can_write: 0, can_delete: 0 };
        })();

        // 1) Create row if missing (safe default)
        db.run(
          `INSERT OR IGNORE INTO permissions (user_id, module, can_access_module, can_read, can_write, can_delete)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            user.id,
            module,
            defaultPerms.can_access_module,
            defaultPerms.can_read,
            defaultPerms.can_write,
            defaultPerms.can_delete,
          ]
        );

        // 2) Backfill NULL values only (do NOT override existing admin-managed values)
        db.run(
          `UPDATE permissions
           SET
             can_access_module = COALESCE(can_access_module, ?),
             can_read = COALESCE(can_read, ?),
             can_write = COALESCE(can_write, ?),
             can_delete = COALESCE(can_delete, ?)
           WHERE user_id = ? AND module = ?`,
          [
            defaultPerms.can_access_module,
            defaultPerms.can_read,
            defaultPerms.can_write,
            defaultPerms.can_delete,
            user.id,
            module,
          ]
        );
      });
    });
  });
};

// Bootstrap an initial admin account if the DB has no admins.
// This avoids a deadlock where registration requires an invitation,
// but invitations can only be created by an admin.
const ensureBootstrapAdminUser = (callback) => {
  db.get("SELECT id FROM users WHERE role = 'admin' LIMIT 1", [], (err, row) => {
    if (err) {
      console.warn('Could not check for admin user:', err.message);
      callback?.();
      return;
    }
    if (row?.id) {
      callback?.();
      return;
    }

    const nickname = process.env.BOOTSTRAP_ADMIN_NICKNAME || 'admin';
    const passwordPlain = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'admin';

    bcrypt.hash(passwordPlain, 10, (hashErr, hashed) => {
      if (hashErr) {
        console.warn('Could not hash bootstrap admin password:', hashErr.message);
        callback?.();
        return;
      }

      db.run(
        "INSERT INTO users (nickname, first_name, last_name, email, password, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, 'admin', 1, datetime('now'))",
        [nickname, 'Admin', 'User', null, hashed],
        function (insErr) {
          if (insErr) {
            console.warn('Could not create bootstrap admin user:', insErr.message);
            callback?.();
            return;
          }

          const adminUserId = this.lastID;

          // Create default preferences
          db.run(
            'INSERT OR IGNORE INTO user_preferences (user_id, dark_mode, language, primary_color, appbar_gradient) VALUES (?, 0, \'bg\', \'#1976d2\', \'pink\')',
            [adminUserId]
          );

          // Create full permissions for admin
           const modules = ['home', 'clients', 'orders', 'worktimes', 'vehicles', 'invoices', 'admin'];
          const stmt = db.prepare(
            `INSERT OR IGNORE INTO permissions (user_id, module, can_access_module, can_read, can_write, can_delete)
             VALUES (?, ?, 1, 1, 1, 1)`
          );
          modules.forEach((m) => stmt.run([adminUserId, m]));
          stmt.finalize();

          console.log(`✅ Bootstrap admin created (nickname: ${nickname}, password: ${passwordPlain})`);
          callback?.();
        }
      );
    });
  });
};

const ensureCompanySettingsSQL = `
  CREATE TABLE IF NOT EXISTS company_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    company_name TEXT,
    eik TEXT,
    vat_number TEXT,
    city TEXT,
    address TEXT,
    phone TEXT,
    contact_email TEXT,
    mol TEXT,
    bank_name TEXT,
    bic TEXT,
    iban TEXT,
    logo_data_url TEXT,
    invoice_prefix TEXT DEFAULT '09',
    invoice_pad_length INTEGER DEFAULT 8,
    invoice_offset INTEGER DEFAULT 0,
    invoice_last_number INTEGER DEFAULT 0,
    protocol_pad_length INTEGER DEFAULT 10,
    protocol_offset INTEGER DEFAULT 0,
    protocol_last_number INTEGER DEFAULT 0,
    app_brand_name TEXT,
    app_tagline_short TEXT,
    app_tagline_secondary TEXT,
    app_brand_font TEXT,
    app_brand_font_size INTEGER,
    login_show_branding INTEGER DEFAULT 1,
    login_gradient TEXT DEFAULT 'pink',
    -- Public URL used to generate links in emails (invitations/password reset)
    -- Example: https://app.yourdomain.com
    public_app_url TEXT,
    payment_method TEXT DEFAULT 'Банков път',
    hourly_rate REAL DEFAULT 100,
    vat_rate REAL DEFAULT 20,
    eur_rate REAL DEFAULT 1.95583,
    -- Global label shown as "Съставил" in printed/emailed invoices
    invoice_prepared_by_name TEXT,
    -- Price multipliers used before invoicing (configured by admin)
    price_multiplier_out_of_hours REAL DEFAULT 1,
    price_multiplier_holiday REAL DEFAULT 1,
    price_multiplier_out_of_service REAL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS order_documents (
    order_id INTEGER PRIMARY KEY,
    protocol_no TEXT,
    invoice_no TEXT,
    -- Multipliers applied to the base amount at the moment of invoicing
    mult_out_of_hours REAL DEFAULT 1,
    mult_holiday REAL DEFAULT 1,
    mult_out_of_service REAL DEFAULT 1,
    is_paid INTEGER DEFAULT 0,
    paid_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE
  );
`;

const ensureCompanySettings = (callback) => {
  const isIgnorableAlterError = (err) => {
    const msg = String(err?.message || '').toLowerCase();
    return msg.includes('duplicate column') || msg.includes('no such table');
  };

  const execAsync = (sql) =>
    new Promise((resolve, reject) => {
      db.exec(sql, (err) => (err ? reject(err) : resolve()));
    });

  const runAsync = (sql, params = []) =>
    new Promise((resolve) => {
      db.run(sql, params, (err) => {
        if (err && !isIgnorableAlterError(err)) {
          console.warn(`Migration step failed (${sql}):`, err.message);
        }
        resolve();
      });
    });

  (async () => {
    try {
      await execAsync(ensureCompanySettingsSQL);

      // Lightweight migrations for existing DBs.
      // (CREATE TABLE IF NOT EXISTS does not add new columns)

      // 1) company_settings.eur_rate
      await runAsync("ALTER TABLE company_settings ADD COLUMN eur_rate REAL DEFAULT 1.95583");

      // 1b) company_settings.invoice_prepared_by_name
      await runAsync("ALTER TABLE company_settings ADD COLUMN invoice_prepared_by_name TEXT");

      // 1c) price multipliers
      await runAsync('ALTER TABLE company_settings ADD COLUMN price_multiplier_out_of_hours REAL DEFAULT 1');
      await runAsync('ALTER TABLE company_settings ADD COLUMN price_multiplier_holiday REAL DEFAULT 1');
      await runAsync('ALTER TABLE company_settings ADD COLUMN price_multiplier_out_of_service REAL DEFAULT 1');

      // Ensure the singleton row exists with sensible defaults.
      await runAsync(
        "INSERT OR IGNORE INTO company_settings (id, hourly_rate, vat_rate, payment_method, eur_rate) VALUES (1, 100, 20, 'Банков път', 1.95583)"
      );

      // Backfill eur_rate for existing rows (ALTER TABLE keeps existing rows as NULL).
      await runAsync('UPDATE company_settings SET eur_rate = COALESCE(eur_rate, 1.95583) WHERE id = 1');

      // Backfill invoice_prepared_by_name to empty string (avoid NULL surprises)
      await runAsync("UPDATE company_settings SET invoice_prepared_by_name = COALESCE(invoice_prepared_by_name, '') WHERE id = 1");

      // Backfill multipliers to 1
      await runAsync('UPDATE company_settings SET price_multiplier_out_of_hours = COALESCE(price_multiplier_out_of_hours, 1) WHERE id = 1');
      await runAsync('UPDATE company_settings SET price_multiplier_holiday = COALESCE(price_multiplier_holiday, 1) WHERE id = 1');
      await runAsync('UPDATE company_settings SET price_multiplier_out_of_service = COALESCE(price_multiplier_out_of_service, 1) WHERE id = 1');

      // 2) company_settings contact columns
      await runAsync('ALTER TABLE company_settings ADD COLUMN phone TEXT');
      await runAsync('ALTER TABLE company_settings ADD COLUMN contact_email TEXT');

      // 2b) company_settings public_app_url (used for invitation/reset links)
      await runAsync('ALTER TABLE company_settings ADD COLUMN public_app_url TEXT');
      await runAsync("UPDATE company_settings SET public_app_url = COALESCE(public_app_url, '') WHERE id = 1");

      // 3) order_documents paid-tracking columns
      await runAsync('ALTER TABLE order_documents ADD COLUMN is_paid INTEGER DEFAULT 0');
      await runAsync('ALTER TABLE order_documents ADD COLUMN paid_at TEXT');
      await runAsync('UPDATE order_documents SET is_paid = COALESCE(is_paid, 0)');

      // 3b) order_documents multipliers
      await runAsync('ALTER TABLE order_documents ADD COLUMN mult_out_of_hours REAL DEFAULT 1');
      await runAsync('ALTER TABLE order_documents ADD COLUMN mult_holiday REAL DEFAULT 1');
      await runAsync('ALTER TABLE order_documents ADD COLUMN mult_out_of_service REAL DEFAULT 1');
      await runAsync('UPDATE order_documents SET mult_out_of_hours = COALESCE(mult_out_of_hours, 1)');
      await runAsync('UPDATE order_documents SET mult_holiday = COALESCE(mult_holiday, 1)');
      await runAsync('UPDATE order_documents SET mult_out_of_service = COALESCE(mult_out_of_service, 1)');
    } catch (err) {
      console.warn('Could not ensure company_settings table:', err?.message || String(err));
    } finally {
      callback?.();
    }
  })();
};

const startServer = () => {
  const port = Number(process.env.PORT || 5000);
  app.listen(port, '0.0.0.0', () => console.log(`Server running on port ${port}`));
};

// Initialize database (and only start listening after required tables exist)
const initSQL = fs.readFileSync(path.join(__dirname, 'init.sql'), 'utf8');
db.exec(initSQL, (err) => {
  if (err) {
    console.error('Error initializing database:', err);
  } else {
    console.log('Database initialized successfully');
  }

  // Ensure branding/settings tables exist BEFORE accepting requests.
  ensureCompanySettings(() => {
    ensureBootstrapAdminUser(() => {
      // Apply permissions backfill after base schema is ensured.
      ensureDefaultPermissionsForAllUsers();
      startServer();
    });
  });
});

// Lightweight migrations for existing SQLite DBs
// (CREATE TABLE IF NOT EXISTS does not add new columns)
db.run("ALTER TABLE orders ADD COLUMN completed_at TEXT", (err) => {
  // Ignore if the column already exists
  if (err && !String(err.message || '').toLowerCase().includes('duplicate column')) {
    console.warn('Could not add completed_at column:', err.message);
  }
});

db.run("ALTER TABLE orders ADD COLUMN client_id INTEGER", (err) => {
  // Ignore if the column already exists
  if (err && !String(err.message || '').toLowerCase().includes('duplicate column')) {
    console.warn('Could not add client_id column:', err.message);
  }
});

db.run("ALTER TABLE permissions ADD COLUMN can_access_module INTEGER DEFAULT 1", (err) => {
  // Ignore if the column already exists
  if (err && !String(err.message || '').toLowerCase().includes('duplicate column')) {
    console.warn('Could not add can_access_module column:', err.message);
  }
});

db.run("ALTER TABLE users ADD COLUMN first_name TEXT", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add users.first_name column:', err.message);
  }
});

db.run("ALTER TABLE users ADD COLUMN last_name TEXT", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add users.last_name column:', err.message);
  }
});

db.run("ALTER TABLE users ADD COLUMN token_version INTEGER DEFAULT 0", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add users.token_version column:', err.message);
  }
});

// Backfill token_version for existing rows (ALTER TABLE keeps existing rows as NULL)
db.run('UPDATE users SET token_version = COALESCE(token_version, 0)', (err) => {
  // Ignore if the column doesn't exist yet (older DB, race with migrations)
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('no such column') && !msg.includes('no such table')) {
    console.warn('Could not backfill users.token_version:', err.message);
  }
});

db.run("ALTER TABLE user_preferences ADD COLUMN appbar_gradient TEXT", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add user_preferences.appbar_gradient column:', err.message);
  }
});

db.run("ALTER TABLE user_preferences ADD COLUMN invoice_prepared_by_name TEXT", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add user_preferences.invoice_prepared_by_name column:', err.message);
  }
});

db.run("ALTER TABLE clients ADD COLUMN city TEXT", (err) => {
  if (err && !String(err.message || '').toLowerCase().includes('duplicate column')) {
    console.warn('Could not add clients.city column:', err.message);
  }
});
db.run("ALTER TABLE clients ADD COLUMN email TEXT", (err) => {
  if (err && !String(err.message || '').toLowerCase().includes('duplicate column')) {
    console.warn('Could not add clients.email column:', err.message);
  }
});
db.run("ALTER TABLE clients ADD COLUMN vat_number TEXT", (err) => {
  if (err && !String(err.message || '').toLowerCase().includes('duplicate column')) {
    console.warn('Could not add clients.vat_number column:', err.message);
  }
});
db.run("ALTER TABLE clients ADD COLUMN mol TEXT", (err) => {
  if (err && !String(err.message || '').toLowerCase().includes('duplicate column')) {
    console.warn('Could not add clients.mol column:', err.message);
  }
});
db.run("ALTER TABLE clients ADD COLUMN vehicles TEXT", (err) => {
  if (err && !String(err.message || '').toLowerCase().includes('duplicate column')) {
    console.warn('Could not add clients.vehicles column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN logo_data_url TEXT", (err) => {
  // Ignore if the column already exists or the table doesn't exist yet
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.logo_data_url column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN invoice_prefix TEXT", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.invoice_prefix column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN invoice_pad_length INTEGER", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.invoice_pad_length column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN invoice_offset INTEGER", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.invoice_offset column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN protocol_pad_length INTEGER", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.protocol_pad_length column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN protocol_offset INTEGER", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.protocol_offset column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN invoice_last_number INTEGER", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.invoice_last_number column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN protocol_last_number INTEGER", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.protocol_last_number column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN app_brand_name TEXT", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.app_brand_name column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN app_tagline_short TEXT", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.app_tagline_short column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN app_tagline_secondary TEXT", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.app_tagline_secondary column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN app_brand_font TEXT", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.app_brand_font column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN app_brand_font_size INTEGER", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.app_brand_font_size column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN login_show_branding INTEGER", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.login_show_branding column:', err.message);
  }
});

db.run("ALTER TABLE company_settings ADD COLUMN login_gradient TEXT", (err) => {
  const msg = String(err?.message || '').toLowerCase();
  if (err && !msg.includes('duplicate column') && !msg.includes('no such table')) {
    console.warn('Could not add company_settings.login_gradient column:', err.message);
  }
});

// company_settings/order_documents are ensured in ensureCompanySettings() above.

// Email transporter (configure via env vars; no hardcoded credentials)
const getEmailMode = () => {
  // Supported values:
  // - smtp   (default) -> try to send real emails via SMTP
  // - manual -> NEVER attempt SMTP; routes will still generate links so they can be copied/sent manually
  const raw = String(process.env.EMAIL_MODE || process.env.EMAIL_DELIVERY_MODE || 'smtp').trim().toLowerCase();
  return raw === 'manual' ? 'manual' : 'smtp';
};

const emailMode = getEmailMode();
const isManualEmailMode = emailMode === 'manual';

console.log(
  `📧 Email mode: ${emailMode}` +
    (isManualEmailMode ? ' (SMTP disabled; links must be shared manually)' : '')
);

const getSmtpSettings = () => {
  const host = String(process.env.SMTP_HOST || '').trim() || 'smtp.gmail.com';
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true';
  const user = String(process.env.SMTP_USER || '').trim();
  // Gmail App Passwords are often shown with spaces; accept both formats.
  const pass = String(process.env.SMTP_PASS || '').replace(/\s+/g, '').trim();
  const from = String(process.env.SMTP_FROM || '').trim();

  return { host, port: Number.isFinite(port) ? port : 587, secure, user, pass, from };
};

const smtp = getSmtpSettings();

let emailTransporter = null;
if (!isManualEmailMode && smtp.user && smtp.pass) {
  emailTransporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
    // Keep timeouts short so blocked SMTP ports (e.g. DigitalOcean 587) don't hang requests.
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS || 7000),
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS || 7000),
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS || 10000),
  });

  // Best-effort verification at startup (doesn't block server start)
  emailTransporter.verify()
    .then(() => console.log('✅ SMTP transporter ready'))
    .catch((err) => {
      console.warn('⚠️ SMTP transporter could not be verified:', err?.message || String(err));
    });
} else {
  if (isManualEmailMode) {
    console.warn('📧 EMAIL_MODE=manual -> SMTP init is skipped (temporary workaround).');
  } else {
    console.warn(
      '⚠️ SMTP is not configured (SMTP_USER/SMTP_PASS missing). Email features (invoices/invitations/password reset) will fail until configured.'
    );
  }
}

// Email service
const emailService = {
  mode: emailMode,
  isManual: isManualEmailMode,
  sendInvitation: async (to, invitationUrl) => {
    try {
      if (isManualEmailMode) {
        console.warn(`[EMAIL:manual] Invitation email skipped for ${to}. Copy & send this link manually: ${invitationUrl}`);
        return false;
      }
      if (!emailTransporter) throw new Error('SMTP is not configured');
      const dbGet = (sql, params) =>
        new Promise((resolve, reject) => {
          db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
          });
        });

      const escapeHtml = (unsafe) =>
        String(unsafe ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#039;');

      const settings = await dbGet(
        'SELECT company_name, contact_email, phone, logo_data_url FROM company_settings WHERE id = 1',
        []
      ).catch(() => null);

      const companyName = String(settings?.company_name || '').trim() || 'Truck Service';
      const contactEmail = String(settings?.contact_email || '').trim();
      const contactPhone = String(settings?.phone || '').trim();
      const logoDataUrl = String(settings?.logo_data_url || '').trim();

      const safeUrlHtml = escapeHtml(invitationUrl);
      const safeCompanyName = escapeHtml(companyName);

      const subject = `Покана за регистрация в ${companyName}`;

      const contactLine = [contactPhone ? `Телефон: ${escapeHtml(contactPhone)}` : '', contactEmail ? `Email: ${escapeHtml(contactEmail)}` : '']
        .filter(Boolean)
        .join(' • ');

      // Gmail and many email clients do not render data: URLs reliably.
      // Use CID inline attachment for the company logo when possible.
      const parseDataUrl = (dataUrl) => {
        const s = String(dataUrl || '');
        const match = s.match(/^data:([^;,]+)(;charset=[^;,]+)?(;base64)?,(.*)$/i);
        if (!match) return null;
        const mime = match[1] || 'application/octet-stream';
        const isBase64 = Boolean(match[3]);
        const payload = match[4] || '';
        if (isBase64) {
          return { mime, buffer: Buffer.from(payload, 'base64') };
        }
        return { mime, buffer: Buffer.from(decodeURIComponent(payload), 'utf8') };
      };

      const parsedLogo = parseDataUrl(logoDataUrl);
      const canInlineLogo = Boolean(parsedLogo?.buffer?.length) && !String(parsedLogo?.mime || '').includes('svg');
      const logoCid = 'companylogo';
      const logoBlock = canInlineLogo
        ? `
          <div style="background: rgba(255,255,255,0.92); padding: 10px 14px; border-radius: 999px; box-shadow: 0 10px 28px rgba(0,0,0,0.28);">
            <img src="cid:${logoCid}" alt="Logo" style="max-width:180px; max-height:90px; object-fit:contain; display:block;" />
          </div>
        `
        : '';

      const text =
        `Здравейте,\n\nПолучавате покана за регистрация в ${companyName}.\n\nЛинк за регистрация:\n${invitationUrl}\n\nВажно: линкът е валиден 7 дни.\nАко не очаквате тази покана, игнорирайте имейла.`;

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color:#0f172a; line-height:1.55;">
          <div style="border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; background: #ffffff;">
            <div style="background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 55%, #ec4899 100%); padding: 18px 20px;">
              <div style="display:flex; align-items:center; gap: 14px; justify-content: space-between; flex-wrap: wrap;">
                <div style="color:#fff; font-weight: 900; font-size: 16px; letter-spacing: 0.2px; text-shadow: 0 2px 10px rgba(0,0,0,0.25);">Покана за регистрация</div>
                ${logoBlock ? `<div>${logoBlock}</div>` : ''}
              </div>
            </div>

            <div style="padding: 20px 20px 18px 20px;">
              <p style="margin: 0 0 10px 0;">Здравейте,</p>
              <p style="margin: 0 0 16px 0;">Получавате покана за регистрация в <strong>${safeCompanyName}</strong>.</p>

              <div style="margin: 14px 0 18px 0; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc;">
                <div style="font-weight: 800; margin-bottom: 10px;">Регистрация</div>
                <a href="${safeUrlHtml}"
                  style="display:inline-block; background:#1976d2; color:#fff; padding: 12px 16px; text-decoration:none; border-radius: 10px; font-weight: 800;">
                  Отвори линка
                </a>
                <div style="margin-top: 10px; font-size: 12px; color: #475569; word-break: break-all;">${safeUrlHtml}</div>
                <div style="margin-top: 10px; font-size: 12px; color: #64748b;">Важно: линкът е валиден 7 дни.</div>
              </div>

              <div style="margin-top: 10px; font-size: 12px; color: #64748b;">
                Ако не очаквате тази покана, игнорирайте това съобщение.
              </div>
            </div>

            <div style="padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e5e7eb; font-size: 12px; color: #64748b;">
              <div>${escapeHtml(companyName)}${contactLine ? ` • ${contactLine}` : ''}</div>
              <div style="margin-top: 6px; font-size: 11px; text-transform: lowercase;">изпратено от wrenchops • автоматизирано съобщение • моля не отговаряйте на този имейл</div>
              <div style="margin-top: 4px; font-size: 11px;">при въпроси използвайте контактите на фирмата по-горе</div>
            </div>
          </div>
        </div>
      `;

      const mailOptions = {
        from: smtp.from || smtp.user || 'noreply@truckservice.com',
        to: to,
        subject,
        text,
        html,
        attachments: canInlineLogo
          ? [
              {
                filename: 'logo',
                content: parsedLogo.buffer,
                contentType: parsedLogo.mime,
                cid: logoCid,
                contentDisposition: 'inline',
              },
            ]
          : [],
      };

      await emailTransporter.sendMail(mailOptions);
      console.log(`Invitation email sent to ${to}`);
      return true;
    } catch (error) {
      console.error('Error sending invitation email:', {
        message: error?.message || String(error),
        code: error?.code,
        command: error?.command,
        responseCode: error?.responseCode,
      });
      return false;
    }
  },

  sendPasswordReset: async (to, nickname, resetUrl) => {
    try {
      if (isManualEmailMode) {
        // For password reset we will expose the URL to the caller (see passwordRecovery route)
        // so they can copy/paste it manually.
        console.warn(`[EMAIL:manual] Password reset email skipped for ${to} (${nickname}).`);
        return false;
      }
      if (!emailTransporter) throw new Error('SMTP is not configured');

      const dbGet = (sql, params) =>
        new Promise((resolve, reject) => {
          db.get(sql, params, (err, row) => {
            if (err) return reject(err);
            resolve(row || null);
          });
        });

      const escapeHtml = (unsafe) =>
        String(unsafe ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#039;');

      const settings = await dbGet(
        'SELECT company_name, contact_email, phone, logo_data_url FROM company_settings WHERE id = 1',
        []
      ).catch(() => null);

      const companyName = String(settings?.company_name || '').trim() || 'Truck Service';
      const contactEmail = String(settings?.contact_email || '').trim();
      const contactPhone = String(settings?.phone || '').trim();
      const logoDataUrl = String(settings?.logo_data_url || '').trim();

      const parsedLogo = parseDataUrl(logoDataUrl);
      const canInlineLogo = Boolean(parsedLogo?.buffer?.length) && !String(parsedLogo?.mime || '').includes('svg');
      const logoCid = 'companylogo';
      const logoBlock = canInlineLogo
        ? `
          <div style="background: rgba(255,255,255,0.92); padding: 10px 14px; border-radius: 999px; box-shadow: 0 10px 28px rgba(0,0,0,0.28);">
            <img src="cid:${logoCid}" alt="Logo" style="max-width:180px; max-height:90px; object-fit:contain; display:block;" />
          </div>
        `
        : '';

      const contactLine = [
        contactPhone ? `тел.: ${escapeHtml(contactPhone)}` : '',
        contactEmail ? `email: ${escapeHtml(contactEmail)}` : '',
      ].filter(Boolean).join(' • ');

      const footerNote = 'изпратено от wrenchops • автоматизирано съобщение • моля не отговаряйте на този имейл';

      const mailOptions = {
        from: smtp.from || smtp.user || 'noreply@truckservice.com',
        to: to,
        subject: `Възстановяване на парола - ${companyName}`,
        text: `Здравейте ${nickname},\n\nЗа да възстановите паролата си, отворете линка:\n${resetUrl}\n\nВажно: линкът е валиден 1 час.\n\n---\n${footerNote}${contactLine ? `\nпри въпроси: ${contactLine}` : ''}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color:#0f172a; line-height:1.55;">
            <div style="border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; background: #ffffff;">
              <div style="background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 55%, #ec4899 100%); padding: 18px 20px; display:flex; align-items:center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                <div style="color:#fff; font-weight: 900; font-size: 16px; text-shadow: 0 2px 10px rgba(0,0,0,0.25);">Възстановяване на парола</div>
                ${logoBlock ? `<div>${logoBlock}</div>` : ''}
              </div>
              <div style="padding: 20px 20px 18px 20px;">
                <p style="margin: 0 0 10px 0;">Здравейте <strong>${escapeHtml(nickname)}</strong>,</p>
                <p style="margin: 0 0 14px 0;">Получавате това съобщение, защото беше поискано възстановяване на парола за вашия акаунт.</p>
                <div style="margin: 14px 0 18px 0; padding: 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc;">
                  <div style="font-weight: 800; margin-bottom: 10px;">Възстановяване</div>
                  <a href="${escapeHtml(resetUrl)}" style="display:inline-block; background:#ff6b35; color:#fff; padding: 12px 16px; text-decoration:none; border-radius: 10px; font-weight: 800;">Възстанови парола</a>
                  <div style="margin-top: 10px; font-size: 12px; color: #475569; word-break: break-all;">${escapeHtml(resetUrl)}</div>
                  <div style="margin-top: 10px; font-size: 12px; color: #64748b;">Важно: линкът е валиден 1 час.</div>
                </div>
                <div style="margin-top: 10px; font-size: 12px; color: #64748b;">Ако не сте поискали възстановяване на парола, игнорирайте това съобщение.</div>
              </div>
              <div style="padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e5e7eb; font-size: 12px; color: #64748b;">
                <div style="font-size: 11px; text-transform: lowercase;">${escapeHtml(footerNote)}</div>
                ${contactLine ? `<div style="margin-top: 4px; font-size: 11px;">при въпроси: ${contactLine}</div>` : '<div style="margin-top: 4px; font-size: 11px;">при въпроси използвайте контактите на фирмата</div>'}
              </div>
            </div>
          </div>
        `,
        attachments: canInlineLogo
          ? [
              {
                filename: 'logo',
                content: parsedLogo.buffer,
                contentType: parsedLogo.mime,
                cid: logoCid,
                contentDisposition: 'inline',
              },
            ]
          : [],
      };

      await emailTransporter.sendMail(mailOptions);
      console.log(`Password reset email sent to ${to} (${nickname})`);
      return true;
    } catch (error) {
      console.error('Error sending password reset email:', {
        message: error?.message || String(error),
        code: error?.code,
        command: error?.command,
        responseCode: error?.responseCode,
      });
      return false;
    }
  },

  // Send invoice/document email with PDF attachment(s).
  // - Either provide a single { pdfBuffer, filename }
  // - Or provide { attachments: [{ filename, content, contentType }] }
  // Optional: include a nicer signature/footer.
  sendInvoiceEmail: async ({
    to,
    subject,
    pdfBuffer,
    filename,
    attachments,
    senderName,
    company,
    assetLabel,
    regNumber,
  }) => {
    try {
      if (isManualEmailMode) {
        console.warn(`[EMAIL:manual] Invoice email skipped for ${to}.`);
        return false;
      }
      if (!emailTransporter) throw new Error('SMTP is not configured');
      if (!to) throw new Error('Missing recipient email');
      const safeSubject = subject || 'Фактура';
      const safeFilename = filename || 'invoice.pdf';

      const resolvedAttachments = Array.isArray(attachments) && attachments.length
        ? attachments
        : [
            {
              filename: safeFilename,
              content: pdfBuffer,
              contentType: 'application/pdf',
            },
          ];

      if (!resolvedAttachments[0]?.content) throw new Error('Missing attachment content');

      const escapeHtml = (unsafe) =>
        String(unsafe ?? '')
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;')
          .replaceAll('"', '&quot;')
          .replaceAll("'", '&#039;');

      const sender = String(senderName || '').trim() || '—';
      const companyName = String(company?.company_name || '').trim() || '—';
      const companyAddress = String(company?.address || '').trim();
      const companyCity = String(company?.city || '').trim();
      const companyPhone = String(company?.phone || process.env.COMPANY_PHONE || '').trim();
      const companyEmail = String(company?.contact_email || process.env.COMPANY_EMAIL || '').trim();
      const logoDataUrl = String(company?.logo_data_url || '').trim();

      const companyLine = [companyName, [companyCity, companyAddress].filter(Boolean).join(', ')].filter(Boolean).join(' — ');
      const companyPhoneLine = companyPhone ? `Телефон: ${escapeHtml(companyPhone)}` : '';

      // Inline logo via CID attachment (data: URLs are often blocked by Gmail)
      const parsedLogo = parseDataUrl(logoDataUrl);
      const canInlineLogo = Boolean(parsedLogo?.buffer?.length) && !String(parsedLogo?.mime || '').includes('svg');
      const logoCid = 'companylogo';

      const logoBlock = canInlineLogo
        ? `
          <div style="margin-top: 14px; display:flex; justify-content:flex-start;">
            <div style="background: rgba(255,255,255,0.92); padding: 10px 14px; border-radius: 999px; box-shadow: 0 10px 28px rgba(0,0,0,0.28);">
              <img src="cid:${logoCid}" alt="Logo" style="max-width:180px; max-height:90px; object-fit:contain; display:block;" />
            </div>
          </div>
        `
        : '';

      const footerNote =
        'изпратено от wrenchops • автоматизирано съобщение • моля не отговаряйте на този имейл';

      const footerContacts = [
        companyPhone ? `тел.: ${companyPhone}` : '',
        companyEmail ? `email: ${companyEmail}` : '',
      ].filter(Boolean).join(' • ');

      const subjectTitle = escapeHtml(safeSubject);
      const safeReg = escapeHtml(String(regNumber || '').trim());
      const safeAsset = escapeHtml(String(assetLabel || '').trim());

      const finalSubject = safeSubject;

      const finalText =
        `Здравейте,\n\nПрикачено изпращаме документите във формат PDF.\n${regNumber ? `\nРег. №: ${regNumber}` : ''}${assetLabel ? `\nПревозно средство: ${assetLabel}` : ''}\n\nPozdrav! | Best regards!\n${sender}\n${companyLine}${companyPhone ? `\nТелефон: ${companyPhone}` : ''}${companyEmail ? `\nEmail: ${companyEmail}` : ''}\n\n---\n${footerNote}${footerContacts ? `\nпри въпроси: ${footerContacts}` : ''}`;

      const finalHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 720px; margin: 0 auto; color: #0f172a; line-height: 1.55;">
          <div style="border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; background:#ffffff;">
            <div style="background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 55%, #ec4899 100%); padding: 18px 20px;">
              <div style="display:flex; align-items:center; justify-content: space-between; gap: 12px; flex-wrap: wrap;">
                <div style="color: #ffffff; font-size: 16px; font-weight: 900; letter-spacing: 0.2px; text-shadow: 0 2px 10px rgba(0,0,0,0.25);">${subjectTitle}</div>
                ${logoBlock ? `<div>${logoBlock}</div>` : ''}
              </div>
            </div>

            <div style="padding: 20px 20px 18px 20px;">
              <p style="margin: 0 0 10px 0;">Здравейте,</p>
              <p style="margin: 0 0 14px 0;">Прикачено изпращаме документите във формат <strong>PDF</strong>.</p>

              ${(safeReg || safeAsset) ? `
                <div style="margin: 14px 0 18px 0; padding: 14px 16px; border: 1px solid #e2e8f0; border-radius: 12px; background: #f8fafc;">
                  ${safeReg ? `<div><strong>Рег. №:</strong> ${safeReg}</div>` : ''}
                  ${safeAsset ? `<div style="margin-top: 6px;"><strong>Превозно средство:</strong> ${safeAsset}</div>` : ''}
                </div>
              ` : ''}

              <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid #e5e7eb;">
                <div style="font-weight: 900;">Pozdrav! | Best regards!</div>
                <div style="margin-top: 6px; font-weight: 800;">${escapeHtml(sender)}</div>
                <div style="margin-top: 10px; color: #334155; font-size: 13px;">
                  <div>${escapeHtml(companyLine)}</div>
                  ${companyPhoneLine ? `<div style="margin-top: 2px;">${companyPhoneLine}</div>` : ''}
                  ${companyEmail ? `<div style="margin-top: 2px;">Email: ${escapeHtml(companyEmail)}</div>` : ''}
                </div>
              </div>
            </div>

            <div style="padding: 14px 20px; background: #f8fafc; border-top: 1px solid #e5e7eb; font-size: 12px; color: #64748b;">
              <div style="font-size: 11px; text-transform: lowercase;">${escapeHtml(footerNote)}</div>
              ${footerContacts ? `<div style="margin-top: 4px; font-size: 11px;">при въпроси: ${escapeHtml(footerContacts)}</div>` : '<div style="margin-top: 4px; font-size: 11px;">при въпроси използвайте контактите на фирмата</div>'}
            </div>
          </div>
        </div>
      `;

      const mailOptions = {
        from: smtp.from || smtp.user || 'noreply@truckservice.com',
        to,
        subject: finalSubject,
        text: finalText,
        html: finalHtml,
        attachments: [
          ...(canInlineLogo
            ? [
                {
                  filename: 'logo',
                  content: parsedLogo.buffer,
                  contentType: parsedLogo.mime,
                  cid: logoCid,
                  contentDisposition: 'inline',
                },
              ]
            : []),
          ...resolvedAttachments,
        ],
      };

      await emailTransporter.sendMail(mailOptions);
      console.log(`Invoice email sent to ${to} (${safeSubject})`);
      return true;
    } catch (error) {
      console.error('Error sending invoice email:', {
        message: error?.message || String(error),
        code: error?.code,
        command: error?.command,
        responseCode: error?.responseCode,
      });
      return false;
    }
  },
};

// Make services available to routes
app.set('db', db);
app.set('emailService', emailService);

// NOTE: startServer() is called after DB init/DDL in the initSQL callback.
