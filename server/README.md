# 后端服务

Node.js + Fastify + Prisma + MySQL。

完整项目功能、前端发布、后端部署见根目录 `README.md`。

## 本地开发

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm dev
```

执行迁移：

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
- `GET /uploads/avatars/:file`

## 环境变量

```bash
DATABASE_URL="mysql://fitness:fitness_password@localhost:3306/fitness_check_in"
JWT_SECRET="change-this-long-random-secret"
WECHAT_APPID=""
WECHAT_SECRET=""
PORT=3000
HOST="0.0.0.0"
```

## 数据库

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

主要表：

- `users`
- `check_ins`

## 头像文件

本地目录：

```text
server/uploads/avatars
```

容器目录：

```text
/app/uploads/avatars
```

生产环境使用 Docker volume：

```text
uploads_data
```

## 测试

```bash
pnpm test
pnpm build
```

## Docker

从项目根目录执行：

```bash
WECHAT_APPID=your_appid WECHAT_SECRET=your_secret docker compose up -d --build
```

## 生产要求

- API 使用 HTTPS
- 微信公众平台配置 request 合法域名
- `JWT_SECRET` 使用随机强密钥
- MySQL 不开放公网访问
- 备份 MySQL 和 `uploads_data`
