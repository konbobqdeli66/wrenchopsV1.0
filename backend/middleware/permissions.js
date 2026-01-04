const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../config');

// Verify JWT AND ensure it is not revoked (token_version check).
// This allows us to force-logout a user by incrementing users.token_version.
const verifyToken = (token, callback) => {
  if (!token) return callback(new Error('No token provided'), null);

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return callback(new Error('Invalid token'), null);
  }

  const getUserRow = (sql, cb) =>
    db.get(sql, [decoded.id], (err, row) => cb(err, row));

  const finalize = (row) => {
    if (!row) return callback(new Error('User not found'), null);

    // Older DBs may not have these columns yet.
    const isActive = row.is_active === undefined ? 1 : Number(row.is_active);
    const dbTokenVersion = row.token_version === undefined ? 0 : Number(row.token_version) || 0;

    if (isActive !== 1) {
      const e = new Error('Account inactive');
      e.code = 'USER_INACTIVE';
      return callback(e, null);
    }

    const jwtTokenVersion = Number(decoded.token_version) || 0;
    if (dbTokenVersion !== jwtTokenVersion) {
      const e = new Error('Session expired');
      e.code = 'TOKEN_REVOKED';
      return callback(e, null);
    }

    return callback(null, decoded);
  };

  // Try the modern schema first; fall back gracefully for older DBs.
  getUserRow('SELECT id, role, is_active, token_version FROM users WHERE id = ?', (err, row) => {
    if (!err) return finalize(row);

    const msg = String(err?.message || '').toLowerCase();
    if (!msg.includes('no such column')) {
      return callback(err, null);
    }

    // Fallback 1: schema without token_version
    getUserRow('SELECT id, role, is_active FROM users WHERE id = ?', (err2, row2) => {
      if (!err2) return finalize(row2);

      const msg2 = String(err2?.message || '').toLowerCase();
      if (!msg2.includes('no such column')) {
        return callback(err2, null);
      }

      // Fallback 2: schema without is_active + token_version
      getUserRow('SELECT id, role FROM users WHERE id = ?', (err3, row3) => {
        if (err3) return callback(err3, null);
        return finalize(row3);
      });
    });
  });
};

// Middleware to check permissions
const checkPermission = (module, action) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    verifyToken(token, (verifyErr, decoded) => {
      if (verifyErr) {
        const isRevoked = verifyErr.code === 'TOKEN_REVOKED';
        const isInactive = verifyErr.code === 'USER_INACTIVE';
        return res.status(401).json({
          error: isRevoked ? 'Session expired' : isInactive ? 'Account inactive' : 'Invalid token'
        });
      }

      if (decoded.role === 'admin') {
        req.user = decoded;
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

          // First check if user has access to the module at all
          if (Number(perm.can_access_module) !== 1) {
            return res.status(403).json({ error: `Access to ${module} module is disabled` });
          }

          // Then check specific action permissions
          const permissionMap = {
            read: perm.can_read,
            write: perm.can_write,
            delete: perm.can_delete,
          };

          if (Number(permissionMap[action]) !== 1) {
            return res.status(403).json({ error: `No ${action} permission for ${module}` });
          }

          req.user = decoded;
          next();
        }
      );
    });
  };
};

// Function to get user permissions for frontend navigation
const getUserPermissions = (userId, callback) => {
  db.all(
    'SELECT module, can_access_module, can_read, can_write, can_delete FROM permissions WHERE user_id = ?',
    [userId],
    (err, permissions) => {
      if (err) {
        return callback(err, null);
      }
      callback(null, permissions);
    }
  );
};

module.exports = {
  checkPermission,
  getUserPermissions,
  verifyToken,
};
