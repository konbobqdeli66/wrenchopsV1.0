# WrenchOps deployment (DigitalOcean droplet)

This project consists of:

- React frontend (static build)
- Node/Express backend (API, PWA manifest, email)
- SQLite database file (`truck.db`) created on first run

## Recommended setup: Nginx + PM2

### 1) Install runtime dependencies on the droplet

- Node.js (LTS)
- Nginx
- PM2

### 2) Copy code to the server

Example:

1. `git clone` the repo to `/var/www/wrenchops`
2. `cd /var/www/wrenchops`

### 3) Configure backend environment

1. Copy [`backend/.env.example`](backend/.env.example) to `backend/.env`
2. Set at least `JWT_SECRET` (required in production)

### 4) Install dependencies and build frontend

- `npm run install:all`
- `npm run build:frontend`

This produces `frontend/build`.

### 5) Run backend with PM2

- `npm --global install pm2`
- `pm2 start deploy/pm2/ecosystem.config.cjs`
- `pm2 save`
- `pm2 startup` (follow the printed instructions to enable auto-start on reboot)

### 6) Configure Nginx

1. Copy [`deploy/nginx/wrenchops.conf`](deploy/nginx/wrenchops.conf) to `/etc/nginx/sites-available/wrenchops.conf`
2. Symlink to `sites-enabled`
3. Reload Nginx

### 7) DNS + HTTPS (recommended)

- Point your domain A record to your droplet IP.
  Example used in this repo config: viatransport-service.xyz -> 207.154.208.13
- After DNS propagates, enable HTTPS via Certbot (Let's Encrypt).

## Notes

- Frontend API base URL is same-origin by default, so the Nginx reverse proxy is the expected production setup.
- SQLite file location depends on where you run the backend from. When running from `/var/www/wrenchops`, the DB file ends up under `/var/www/wrenchops/backend/truck.db`.

