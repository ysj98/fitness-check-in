# 后端服务

Node.js + Fastify + Prisma + MySQL。

完整项目功能、前端启动见根目录 `README.md`，服务器上线部署见根目录 `DEPLOYMENT.md`。

## 本地开发

### 1. 前置要求

- Node.js >= 20
- pnpm >= 9
- Docker 和 Docker Compose

### 2. 启动本地 MySQL

根目录 `docker-compose.yml` 面向服务器部署，默认不把 MySQL `3306` 暴露到宿主机。

如果本地后端使用 `pnpm dev` 运行，并希望连接容器里的 MySQL，可以在项目根目录临时创建 `docker-compose.override.yml`：

```yaml
services:
  mysql:
    ports:
      - '127.0.0.1:3306:3306'
```

再从项目根目录执行：

```bash
docker compose up -d mysql
docker compose ps
```

本地后端通过 `localhost:3306` 连接 MySQL。默认连接信息是：

```text
数据库：fitness_check_in
用户：fitness
密码：fitness_password
root 密码：root_password
```

生产部署不要开放 MySQL `3306` 到公网。

### 3. 配置环境变量

进入后端目录：

```bash
cd server
cp .env.example .env
```

本地开发默认配置：

```bash
DATABASE_URL="mysql://fitness:fitness_password@localhost:3306/fitness_check_in"
JWT_SECRET="change-this-long-random-secret"
WECHAT_APPID=""
WECHAT_SECRET=""
PORT=3000
HOST="0.0.0.0"
```

说明：

- `DATABASE_URL` 本地使用 `localhost`，因为后端服务直接跑在本机。
- Docker 部署时使用 `mysql` 作为数据库主机名，见根目录 `docker-compose.yml`。
- 调试微信登录时必须填写 `WECHAT_APPID` 和 `WECHAT_SECRET`。
- 只调试健康检查、资料接口结构或数据库流程时，可以先保持微信配置为空。

### 4. 安装依赖和初始化 Prisma

```bash
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
```

`pnpm prisma:migrate` 会执行 `prisma/migrations` 中已经提交的迁移，创建本地表结构。

### 5. 启动后端

```bash
pnpm dev
```

服务默认监听：

```text
http://localhost:3000
```

验证：

```bash
curl http://localhost:3000/health
```

正常响应应包含：

```json
{
  "code": 0,
  "data": {
    "status": "ok"
  }
}
```

### 6. 本地联调前端

根目录 `env/.env.development` 默认指向本地后端：

```bash
VITE_SERVER_BASEURL = 'http://localhost:3000'
```

启动前端：

```bash
cd ..
pnpm dev:h5
```

或启动微信小程序：

```bash
pnpm dev:mp-weixin
```

微信开发者工具本地调试时，如未配置 HTTPS 域名，可临时勾选“不校验合法域名、web-view 域名、TLS 版本以及 HTTPS 证书”。

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

## 常见问题

### 端口 3306 被占用

如果 `docker compose up -d mysql` 失败，先检查本机是否已有 MySQL：

```bash
docker compose logs mysql
```

可以停掉本机 MySQL，或修改根目录 `docker-compose.yml`：

```yaml
ports:
  - '3307:3306'
```

同时把 `server/.env` 改为：

```bash
DATABASE_URL="mysql://fitness:fitness_password@localhost:3307/fitness_check_in"
```

### 数据库连接失败

检查：

```bash
docker compose ps
docker compose logs mysql
```

确认 `server/.env` 中的用户名、密码、端口和数据库名与 `docker-compose.yml` 一致。

### 微信登录失败

检查 `server/.env` 是否填写：

```bash
WECHAT_APPID="你的微信小程序 AppID"
WECHAT_SECRET="你的微信小程序 AppSecret"
```

如果未填写，调用 `POST /api/auth/wx-login` 会失败，这是预期行为。

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
