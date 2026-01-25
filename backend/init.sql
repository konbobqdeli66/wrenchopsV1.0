-- Create tables for truck service app

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nickname TEXT UNIQUE NOT NULL,
    first_name TEXT,
    last_name TEXT,
    email TEXT UNIQUE,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'user',
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT,
    -- Increment this to invalidate all existing JWTs for a user (force logout)
    token_version INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_preferences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    dark_mode INTEGER DEFAULT 0,
    language TEXT DEFAULT 'bg',
    primary_color TEXT DEFAULT '#1976d2',
    appbar_gradient TEXT DEFAULT 'pink',
    -- Per-user label used in printable invoices/protocols
    invoice_prepared_by_name TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    module TEXT NOT NULL, -- 'clients', 'orders', 'worktimes', 'vehicles', 'admin'
    can_access_module INTEGER DEFAULT 0, -- Whether user can access this module at all
    can_read INTEGER DEFAULT 0,
    can_write INTEGER DEFAULT 0,
    can_delete INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    UNIQUE(user_id, module)
);

CREATE TABLE IF NOT EXISTS invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    email TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    used INTEGER DEFAULT 0,
    used_at TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (created_by) REFERENCES users (id)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    token TEXT UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    email TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    used_at TEXT,
    expires_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    address TEXT,
    eik TEXT,
    phone TEXT,
    city TEXT,
    vat_number TEXT,
    mol TEXT,
    vehicles TEXT
);

CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER NOT NULL,
    reg_number TEXT NOT NULL,
    vin TEXT,
    brand TEXT,
    model TEXT,
    vehicle_type TEXT NOT NULL, -- 'truck' or 'trailer'
    gear_box TEXT, -- for trucks
    axes INTEGER, -- for trailers
    year INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (client_id) REFERENCES clients (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client_id INTEGER,
    client_name TEXT NOT NULL,
    reg_number TEXT NOT NULL,
    complaint TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS worktimes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    hours REAL NOT NULL,
    component_type TEXT DEFAULT 'cabin',
    vehicle_type TEXT DEFAULT 'truck' -- 'truck' or 'trailer'
);

CREATE TABLE IF NOT EXISTS order_worktimes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    worktime_id INTEGER NOT NULL,
    quantity INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
    FOREIGN KEY (worktime_id) REFERENCES worktimes (id) ON DELETE CASCADE
);

-- Note: Schema only. Use a separate seed script for demo data.
