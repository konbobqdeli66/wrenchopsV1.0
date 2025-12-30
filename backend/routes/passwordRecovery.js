const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const router = express.Router();
const db = require('../db');

const normalizePublicAppUrl = (raw) => {
  const s = String(raw || '').trim();
  if (!s) return '';
  const withProto = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  return withProto.replace(/\/+$/, '');
};

// Request password reset
router.post('/request-reset', async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  // Temporary policy: when EMAIL_MODE=manual, disable self-service password reset.
  // Admins can generate reset links from the Admin panel.
  const emailService = req.app.get('emailService');
  if (emailService?.isManual) {
    return res.status(403).json({
      error: 'Password reset via email is temporarily disabled. Please contact an administrator.'
    });
  }

  try {
    // Find user by email
    db.get('SELECT id, nickname FROM users WHERE email = ? AND is_active = 1', [email], (err, user) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!user) {
        // Don't reveal if email exists or not for security.
        return res.json({ message: 'If the email exists, a password reset link has been sent' });
      }

      // Generate reset token
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(); // 1 hour

      // Save token to database
      db.run(`
        INSERT INTO password_reset_tokens (token, user_id, email, expires_at)
        VALUES (?, ?, ?, ?)
      `, [token, user.id, email, expiresAt], async function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to create reset token' });
        }

        // Generate reset URL.
        // Prefer company_settings.public_app_url if set; fallback to current host mapping.
        db.get('SELECT public_app_url FROM company_settings WHERE id = 1', [], async (settingsErr, settingsRow) => {
          const publicAppUrl = settingsErr ? '' : normalizePublicAppUrl(settingsRow?.public_app_url);
          const fallbackBase = `${req.protocol}://${req.get('host').replace(':5000', ':3000')}`;
          const baseUrl = publicAppUrl || fallbackBase;
          const resetUrl = `${baseUrl}/reset-password?token=${token}`;

          // Attempt email delivery.
          const emailSent = await emailService.sendPasswordReset(email, user.nickname, resetUrl);

          if (!emailSent) {
            console.warn(`Failed to send password reset email to ${email}`);
          }

          return res.json({ message: 'If the email exists, a password reset link has been sent' });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Reset password
router.post('/reset-password', async (req, res) => {
  const { token, newPassword, confirmPassword } = req.body;

  if (!token || !newPassword || !confirmPassword) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (newPassword !== confirmPassword) {
    return res.status(400).json({ error: 'Passwords do not match' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  try {
    // Find valid reset token
    db.get(`
      SELECT prt.*, u.nickname
      FROM password_reset_tokens prt
      JOIN users u ON prt.user_id = u.id
      WHERE prt.token = ? AND prt.used = 0 AND prt.expires_at > datetime('now')
    `, [token], async (err, resetToken) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      if (!resetToken) {
        return res.status(400).json({ error: 'Invalid or expired reset token' });
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update user password
      db.run('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, resetToken.user_id], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Failed to update password' });
        }

        // Mark token as used
        db.run(`
          UPDATE password_reset_tokens
          SET used = 1, used_at = datetime('now')
          WHERE id = ?
        `, [resetToken.id], function(err) {
          if (err) {
            console.warn('Failed to mark reset token as used');
          }

          res.json({ message: 'Password has been reset successfully' });
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify reset token (for frontend validation)
router.get('/verify-token/:token', (req, res) => {
  const { token } = req.params;

  db.get(`
    SELECT prt.*, u.nickname
    FROM password_reset_tokens prt
    JOIN users u ON prt.user_id = u.id
    WHERE prt.token = ? AND prt.used = 0 AND prt.expires_at > datetime('now')
  `, [token], (err, resetToken) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }

    if (!resetToken) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    res.json({
      valid: true,
      nickname: resetToken.nickname,
      email: resetToken.email
    });
  });
});

module.exports = router;
