# Fitness Check-in Server

Node.js + Fastify + Prisma + MySQL backend for the fitness check-in mini program.

Full frontend and backend deployment instructions are in `../DEPLOYMENT.md`.

## Local Development

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm dev
```

Run migrations against MySQL:

```bash
pnpm prisma:migrate
```

## API

- `GET /health`
- `POST /api/auth/wx-login`
- `GET /api/user/info`
- `POST /api/user/avatar`
- `PATCH /api/user/profile`
- `GET /api/checkins/today`
- `POST /api/checkins`
- `GET /api/checkins/stats`
- `GET /api/checkins/recent?limit=20`
- `GET /api/checkins/month?month=YYYY-MM`
- `DELETE /api/checkins/:id`

## Aliyun ECS Deployment

From the repository root:

```bash
WECHAT_APPID=your_appid WECHAT_SECRET=your_secret docker compose up -d --build
```

Expose the API through Nginx with HTTPS, then set the mini program request domain to that HTTPS domain.
