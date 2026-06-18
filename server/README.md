# 后端服务

Node.js + Fastify + Prisma + MySQL。

完整项目功能见根目录 `README.md`，服务器部署见根目录 `DEPLOYMENT.md`。

## 本地开发

### 1. 前置要求

- Node.js >= 20
- pnpm >= 9
- MySQL

### 2. 初始化 MySQL

创建数据库和用户：

```sql
CREATE DATABASE IF NOT EXISTS fitness_check_in
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'fitness'@'127.0.0.1'
  IDENTIFIED BY 'fitness_password';

GRANT ALL PRIVILEGES ON fitness_check_in.* TO 'fitness'@'127.0.0.1';

FLUSH PRIVILEGES;
```

### 3. 配置环境变量

```bash
cp .env.example .env
```

本地开发默认配置：

```bash
DATABASE_URL="mysql://fitness:fitness_password@127.0.0.1:3306/fitness_check_in?connection_limit=5"
JWT_SECRET="change-this-long-random-secret"
WECHAT_APPID=""
WECHAT_SECRET=""
PORT=3000
HOST="127.0.0.1"
NODE_OPTIONS="--max-old-space-size=256"
```

调试微信登录时需要填写 `WECHAT_APPID` 和 `WECHAT_SECRET`。

### 4. 安装依赖和初始化 Prisma

```bash
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
```

### 5. 启动开发服务

```bash
pnpm dev
```

服务默认监听：

```text
http://127.0.0.1:3000
```

验证：

```bash
curl http://127.0.0.1:3000/health
```

## PM2 运行

生产环境使用 PM2 启动编译后的后端：

```bash
pnpm build
pm2 start ecosystem.config.cjs --env production
```

从项目根目录启动也可以：

```bash
pm2 start server/ecosystem.config.cjs --env production
```

PM2 配置会读取 `server/.env`。

常用命令：

```bash
pm2 status
pm2 logs fitness-check-in-api
pm2 restart fitness-check-in-api --update-env
pm2 stop fitness-check-in-api
pm2 save
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

## 数据库

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

主要表：

- `users`
- `check_ins`

## 头像文件

本地和生产环境都使用：

```text
server/uploads/avatars
```

该目录已被 Git 忽略。

## 测试

```bash
pnpm test
pnpm build
```

## 常见问题

### 数据库连接失败

检查：

```bash
mysql -h 127.0.0.1 -u fitness -p fitness_check_in
```

确认 `server/.env` 中 `DATABASE_URL` 的用户名、密码、端口和数据库名正确。

### 微信登录失败

检查 `server/.env` 是否填写：

```bash
WECHAT_APPID="你的微信小程序 AppID"
WECHAT_SECRET="你的微信小程序 AppSecret"
```

### PM2 启动失败

检查：

```bash
pnpm build
pm2 logs fitness-check-in-api --lines 100
```
