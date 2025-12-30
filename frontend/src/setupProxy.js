const { createProxyMiddleware } = require('http-proxy-middleware');

// Get the backend URL dynamically
const getBackendUrl = () => {
  // In development, use localhost
  // In production or when HOST is set to 0.0.0.0, try to detect network IP
  if (process.env.NODE_ENV === 'production' || process.env.HOST === '0.0.0.0') {
    // For mobile access, we need to use the network IP
    // This will be handled by the frontend's API base URL detection
    return 'http://localhost:5000'; // Fallback
  }
  return 'http://localhost:5000';
};

const backendUrl = getBackendUrl();

console.log('=== PROXY CONFIG ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('HOST:', process.env.HOST);
console.log('Using backend URL:', backendUrl);
console.log('===================');

module.exports = function(app) {
  // PWA manifest + icons (must be same-origin)
  app.use(
    ['/manifest.webmanifest', '/public'],
    createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
    })
  );

  app.use(
    '/api',
    createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
    })
  );

  app.use(
    ['/clients', '/orders', '/vehicles', '/worktimes', '/preferences', '/admin'],
    createProxyMiddleware({
      target: backendUrl,
      changeOrigin: true,
    })
  );
};
