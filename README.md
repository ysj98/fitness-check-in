# 运动打卡小程序

微信小程序运动打卡应用，包含 uni-app 前端、Node.js 后端和 MySQL 数据库。

## 功能

### 打卡

- 微信登录
- 每日打卡、每日多次打卡
- 今日记录、最近 12 次记录
- 月份切换、月度打卡日历
- 连续打卡天数
- 打卡动态效果
- 今日记录删除

### 我的

- 微信头像选择和上传
- 微信昵称输入和保存
- 性别、生日维护

### 后端

- 微信登录换码
- JWT 鉴权
- 用户资料查询和更新
- 头像上传和静态访问
- 今日、月度、连续打卡统计
- 打卡记录创建、查询和删除

## 技术栈

- 前端：uni-app、Vue 3、TypeScript、UnoCSS
- 后端：Node.js、Fastify、Prisma、MySQL
- 工程化：pnpm、Vite、Vitest、ESLint
- 部署：Docker Compose、Nginx、Certbot

## 目录

```text
.
├─ src/                 小程序前端
├─ server/              后端 API
├─ env/                 前端环境变量
├─ docker-compose.yml   后端和 MySQL 编排
├─ DEPLOYMENT.md        服务器部署文档
└─ README.md            项目说明
```

## 环境要求

- Node.js >= 20
- pnpm >= 9
- Docker 和 Docker Compose
- 微信开发者工具

## 本地开发

### 1. 安装前端依赖

```bash
pnpm install
```

### 2. 启动本地 MySQL

```bash
docker compose up -d mysql
```

### 3. 启动后端

```bash
cd server
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

后端默认启动在：

```text
http://localhost:3000
```

### 4. 启动前端

H5 开发：

```bash
pnpm dev:h5
```

微信小程序开发：

```bash
pnpm dev:mp-weixin
```

微信开发者工具导入：

```text
dist/dev/mp-weixin
```

本地开发默认接口地址在 `env/.env.development` 中配置：

```bash
VITE_SERVER_BASEURL = 'http://localhost:3000'
```

微信开发者工具本地调试时，如未配置 HTTPS 域名，可临时勾选“不校验合法域名、web-view 域名、TLS 版本以及 HTTPS 证书”。

## 构建

### 前端小程序

```bash
pnpm build:mp-weixin
```

产物目录：

```text
dist/build/mp-weixin
```

### 后端

```bash
cd server
pnpm build
pnpm start
```

## 后端 API

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

## 部署

服务器上线、Ubuntu 24.04 64 位环境、Docker Compose、Nginx、Certbot、HTTPS、微信小程序合法域名、发布验证和维护步骤见 [部署文档](./DEPLOYMENT.md)。

## 常用命令

```bash
pnpm lint
pnpm type-check
pnpm test:run
pnpm build:mp-weixin
```

```bash
cd server
pnpm test
pnpm build
```

## License

MIT
