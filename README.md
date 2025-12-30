# WrenchOps

Truck service management app.

## Local development

Backend:

- `cd backend`
- `npm install`
- `npm start`

Frontend:

- `cd frontend`
- `npm install`
- `npm start`

## Production / DigitalOcean droplet

Recommended: Nginx + PM2.

Deployment guide: see [`deploy/README.md`](deploy/README.md)

Detailed Bulgarian step-by-step: [`deploy/guide-bg.md`](deploy/guide-bg.md)

## Configuration

Backend env example: [`backend/.env.example`](backend/.env.example)

Ready copy/paste production template (placeholders): [`backend/.env.copyme`](backend/.env.copyme)

### Important (production)

- Set `JWT_SECRET` to a long random string.
- If you use email features (invitations, password reset, sending invoices), configure SMTP variables.

