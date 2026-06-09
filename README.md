# 运动打卡小程序

微信小程序运动打卡应用，包含 uni-app 前端、Node.js 后端、MySQL 数据库和阿里云 ECS 部署配置。

## 功能

### 打卡

- 微信登录
- 每日打卡
- 每日多次打卡
- 今日记录
- 最近 12 次记录
- 月份切换
- 月度打卡日历
- 连续打卡天数
- 打卡动态效果
- 今日记录删除

### 我的

- 微信头像选择
- 微信昵称输入
- 头像上传
- 昵称保存
- 性别维护
- 生日维护

### 后端

- 微信登录换码
- JWT 鉴权
- 用户资料查询
- 用户资料更新
- 头像上传
- 头像静态访问
- 今日打卡统计
- 月度打卡统计
- 连续打卡统计
- 最近打卡查询
- 打卡记录创建
- 打卡记录删除

## 技术栈

- 前端：uni-app、Vue 3、TypeScript、UnoCSS
- 后端：Node.js、Fastify、Prisma、MySQL
- 部署：Docker Compose、Nginx HTTPS、阿里云 ECS

## 目录

```text
.
├─ src/                 小程序前端
├─ server/              后端 API
├─ env/                 前端环境变量
├─ docker-compose.yml   后端和 MySQL 编排
└─ README.md            项目文档
```

## 环境要求

- Node.js >= 20
- pnpm >= 9
- Docker
- Docker Compose
- Nginx
- 微信开发者工具

## 本地开发

### 前端

```bash
pnpm install
pnpm dev:h5
pnpm dev:mp-weixin
```

微信小程序开发时，导入：

```text
dist/dev/mp-weixin
```

### 后端

```bash
cd server
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm dev
```

执行数据库迁移：

```bash
pnpm prisma:migrate
```

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

### 1. 阿里云准备

- ECS：2 核 2G 起步
- 系统：Ubuntu 22.04 LTS 或 Debian 12
- 域名：`api.example.com`
- 安全组：开放 `80`、`443`、`22`
- SSL 证书：阿里云证书或 Certbot

### 2. 上传代码

```bash
git clone <your-repo-url> fitness-check-in
cd fitness-check-in
```

### 3. 配置后端变量

```bash
export WECHAT_APPID="你的微信小程序 AppID"
export WECHAT_SECRET="你的微信小程序 AppSecret"
```

生产环境修改 `docker-compose.yml`：

- `JWT_SECRET`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `DATABASE_URL`

### 4. 启动后端

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f api
curl http://127.0.0.1:3000/health
```

头像目录：

```text
/app/uploads/avatars
```

Docker volume：

```text
uploads_data
```

### 5. Nginx

```nginx
server {
  listen 80;
  server_name api.example.com;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:3000/uploads/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

```bash
nginx -t
systemctl reload nginx
```

配置 HTTPS 后验证：

```bash
curl https://api.example.com/health
```

微信公众平台配置 request 合法域名：

```text
https://api.example.com
```

### 6. 前端发布

修改 `env/.env.production`：

```bash
VITE_SERVER_BASEURL = 'https://api.example.com'
VITE_SERVER_BASEURL__WEIXIN_RELEASE = 'https://api.example.com'
```

构建：

```bash
pnpm install
pnpm build:mp-weixin
```

微信开发者工具导入：

```text
dist/build/mp-weixin
```

上传后在微信公众平台提交体验版或正式审核。

## 验证

### 后端

```bash
curl https://api.example.com/health
docker compose logs --tail=100 api
docker compose logs --tail=100 mysql
```

### 前端

- 自动微信登录
- 点击打卡后新增今日记录
- 打卡动态效果正常
- 右上角显示连续天数
- 月份切换正常
- 月历数据刷新正常
- 微信头像选择正常
- 微信昵称输入正常
- 资料保存正常
- 头像 URL 可访问

## 维护

### 更新

```bash
git pull
docker compose up -d --build
docker compose logs -f api
```

### 备份 MySQL

```bash
docker compose exec mysql mysqldump -u root -p fitness_check_in > backup.sql
```

### 恢复 MySQL

```bash
docker compose exec -T mysql mysql -u root -p fitness_check_in < backup.sql
```

### 备份头像

头像文件在 `uploads_data` volume 中。服务器迁移时同时备份该 volume。

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
