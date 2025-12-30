// Centralized runtime configuration.
// Keep secrets OUT of source code; in production set them via environment variables.

const JWT_SECRET = String(process.env.JWT_SECRET || 'dev_secret_change_me').trim();

if (!process.env.JWT_SECRET) {
  // eslint-disable-next-line no-console
  console.warn('⚠️ JWT_SECRET is not set. Using an insecure default (dev only). Set JWT_SECRET in backend/.env on production.');
}

module.exports = {
  JWT_SECRET,
};

