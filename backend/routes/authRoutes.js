const express = require("express");
const db = require("../db");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { getUserPermissions, verifyToken } = require("../middleware/permissions");
const { JWT_SECRET } = require('../config');

const router = express.Router();

// Регистрация
router.post("/register", (req, res) => {
  const { nickname, first_name, last_name, email, password, invitation_token } = req.body;

  // Validate invitation token
  if (!invitation_token) {
    return res.status(400).json({ message: "Покана е задължителна за регистрация" });
  }

  // Check if invitation token is valid
  db.get(
    "SELECT * FROM invitations WHERE token = ? AND used = 0 AND expires_at > datetime('now')",
    [invitation_token],
    (err, invitation) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!invitation) {
        return res.status(400).json({ message: "Невалидна или изтекла покана" });
      }

  // Proceed with registration
  bcrypt.hash(password, 10, (err, hashed) => {
    if (err) return res.status(500).json({ message: "Server error" });

    if (!String(first_name || '').trim() || !String(last_name || '').trim()) {
      return res.status(400).json({ message: 'Име и фамилия са задължителни' });
    }

    db.run(
      "INSERT INTO users (nickname, first_name, last_name, email, password, role, is_active, created_at) VALUES (?, ?, ?, ?, ?, 'user', 1, datetime('now'))",
      [nickname, String(first_name).trim(), String(last_name).trim(), email, hashed],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ message: "Потребителят вече съществува" });
          }
              return res.status(500).json({ message: "Server error" });
            }

            const userId = this.lastID;

            // Mark invitation as used
            db.run(
              "UPDATE invitations SET used = 1, used_at = datetime('now') WHERE id = ?",
              [invitation.id]
            );

            // Create default permissions for new user.
            // Requested behavior:
            // - New users have NO access by default (admin grants permissions later)
            // - Keep Home visible/accessible (read-only) so they can log in and see the UI
            const defaultPermissions = [
              { module: 'home', can_access_module: 1, can_read: 1, can_write: 0, can_delete: 0 },
              { module: 'clients', can_access_module: 0, can_read: 0, can_write: 0, can_delete: 0 },
              { module: 'orders', can_access_module: 0, can_read: 0, can_write: 0, can_delete: 0 },
              // Invoices use their own permission module for invoice-document deletion.
              { module: 'invoices', can_access_module: 0, can_read: 0, can_write: 0, can_delete: 0 },
              { module: 'worktimes', can_access_module: 0, can_read: 0, can_write: 0, can_delete: 0 },
              { module: 'vehicles', can_access_module: 0, can_read: 0, can_write: 0, can_delete: 0 },
              { module: 'admin', can_access_module: 0, can_read: 0, can_write: 0, can_delete: 0 },
            ];

            const stmt = db.prepare(`
              INSERT INTO permissions (user_id, module, can_access_module, can_read, can_write, can_delete)
              VALUES (?, ?, ?, ?, ?, ?)
            `);

            defaultPermissions.forEach(perm => {
              stmt.run([userId, perm.module, perm.can_access_module, perm.can_read, perm.can_write, perm.can_delete]);
            });

            stmt.finalize();
            res.json({ message: "Регистрация успешна!" });
          }
        );
      });
    }
  );
});

// Login
router.post("/login", (req, res) => {
  const { nickname, password } = req.body;
  db.get("SELECT * FROM users WHERE nickname = ?", [nickname], (err, user) => {
    if (err) return res.status(500).json({ message: "Server error" });
    if (!user) return res.status(400).json({ message: "Потребителят не съществува" });

    // Check if user is active
    if (user.is_active !== 1) {
      return res.status(403).json({ message: "Акаунтът е деактивиран. Свържете се с администратора." });
    }

    bcrypt.compare(password, user.password, (err, valid) => {
      if (err) return res.status(500).json({ message: "Server error" });
      if (!valid) return res.status(400).json({ message: "Грешна парола" });

      const full_name = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
      const token = jwt.sign(
        {
          id: user.id,
          nickname: user.nickname,
          role: user.role,
          first_name: user.first_name,
          last_name: user.last_name,
          full_name,
          token_version: Number(user.token_version) || 0,
        },
        JWT_SECRET
      );
      res.json({ token });
    });
  });
});

// Get user permissions for frontend navigation
router.get("/permissions", (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  verifyToken(token, (verifyErr, decoded) => {
    if (verifyErr) {
      const isRevoked = verifyErr.code === 'TOKEN_REVOKED';
      const isInactive = verifyErr.code === 'USER_INACTIVE';
      return res.status(401).json({ error: isRevoked ? 'Session expired' : isInactive ? 'Account inactive' : 'Invalid token' });
    }

    if (decoded.role === 'admin') {
      // Admin has access to all modules
      return res.json([
        { module: 'home', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 },
        { module: 'clients', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 },
        { module: 'orders', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 },
        { module: 'invoices', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 },
        { module: 'worktimes', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 },
        { module: 'vehicles', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 },
        { module: 'admin', can_access_module: 1, can_read: 1, can_write: 1, can_delete: 1 },
      ]);
    }

    getUserPermissions(decoded.id, (err, permissions) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(permissions);
    });
  });
});

module.exports = router;
