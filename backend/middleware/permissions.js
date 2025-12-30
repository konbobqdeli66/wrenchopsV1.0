const jwt = require('jsonwebtoken');
const db = require('../db');
const { JWT_SECRET } = require('../config');

// Middleware to check permissions
const checkPermission = (module, action) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET);
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

          // First check if user has access to the module at all
          if (perm.can_access_module !== 1) {
            return res.status(403).json({ error: `Access to ${module} module is disabled` });
          }

          // Then check specific action permissions
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
  getUserPermissions
};
