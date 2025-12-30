module.exports = {
  apps: [
    {
      name: 'wrenchops-backend',
      script: './backend/server.js',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
      },
    },
  ],
};

