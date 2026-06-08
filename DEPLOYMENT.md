# 运动打卡小程序部署文档

本文覆盖后端 API 和前端微信小程序部署。推荐部署形态是：阿里云 ECS 运行 Docker Compose，MySQL 和 API 服务在服务器内网通信，Nginx 对外提供 HTTPS，微信小程序请求 HTTPS API 域名。

## 1. 部署前准备

### 阿里云资源

- ECS：建议 2 核 2G 起步，系统使用 Ubuntu 22.04 LTS 或 Debian 12。
- 域名：准备一个 API 域名，例如 `api.example.com`，解析到 ECS 公网 IP。
- SSL 证书：可使用阿里云免费证书或 Certbot。
- 安全组：放行 `80`、`443`，如需 SSH 放行 `22`；不建议公网开放 MySQL `3306`。

### 本地和服务器软件

服务器需要安装：

```bash
docker --version
docker compose version
nginx -v
```

如果没有 Docker，可在 ECS 上安装 Docker Engine 和 Docker Compose Plugin。

## 2. 后端部署

### 2.1 上传代码

在服务器上拉取项目：

```bash
git clone <your-repo-url> fitness-check-in
cd fitness-check-in
```

### 2.2 配置后端环境变量

后端 Docker Compose 读取这些变量：

```bash
export WECHAT_APPID="你的微信小程序 AppID"
export WECHAT_SECRET="你的微信小程序 AppSecret"
```

生产环境必须修改 `docker-compose.yml` 中的 `JWT_SECRET`、MySQL 用户密码和 root 密码。修改后同时保持 `DATABASE_URL` 中的用户名、密码、数据库名一致。

### 2.3 启动服务

在项目根目录执行：

```bash
docker compose up -d --build
```

容器启动时会自动执行 Prisma migration，然后启动 API。

检查状态：

```bash
docker compose ps
docker compose logs -f api
curl http://127.0.0.1:3000/health
```

`/health` 返回 `code: 0` 且 `status: ok` 即后端正常。

### 2.4 头像上传目录

头像文件保存在 API 容器内：

```text
/app/uploads/avatars
```

`docker-compose.yml` 使用 `uploads_data` volume 持久化该目录。

查看 volume：

```bash
docker volume ls
docker compose exec api ls -lah /app/uploads/avatars
```

## 3. Nginx 和 HTTPS

### 3.1 Nginx 反向代理

示例配置：

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

启用配置后检查并重载：

```bash
nginx -t
systemctl reload nginx
```

### 3.2 配置 HTTPS

微信小程序正式环境必须使用 HTTPS。证书配置完成后验证：

```bash
curl https://api.example.com/health
```

确认返回正常后，在微信公众平台添加 request 合法域名：

```text
https://api.example.com
```

## 4. 前端小程序部署

### 4.1 配置生产 API 地址

修改 `env/.env.production`：

```bash
VITE_SERVER_BASEURL = 'https://api.example.com'
VITE_SERVER_BASEURL__WEIXIN_RELEASE = 'https://api.example.com'
```

体验版如需单独域名，可配置：

```bash
VITE_SERVER_BASEURL__WEIXIN_TRIAL = 'https://trial-api.example.com'
```

### 4.2 构建微信小程序

本地执行：

```bash
pnpm install
$env:SKIP_OPEN_DEVTOOLS='true'; pnpm build:mp-weixin
```

Windows PowerShell 使用上面的 `$env` 写法；macOS/Linux 使用：

```bash
SKIP_OPEN_DEVTOOLS=true pnpm build:mp-weixin
```

构建产物在：

```text
dist/build/mp-weixin
```

### 4.3 上传微信小程序

打开微信开发者工具：

1. 导入 `dist/build/mp-weixin`。
2. 确认 AppID 与 `env/.env` 中的 `VITE_WX_APPID` 一致。
3. 点击“上传”。
4. 到微信公众平台提交体验版或正式审核。

## 5. 验证清单

后端：

```bash
curl https://api.example.com/health
docker compose logs --tail=100 api
docker compose logs --tail=100 mysql
```

前端：

- 打开小程序后能自动微信登录。
- 点击“立即打卡”后出现动画并新增今日记录。
- 右上角显示连续天数。
- 月份可切换，月历数据正常刷新。
- “我的”页可选择微信头像、填写微信昵称、保存性别、生日。
- 头像 URL 可通过 `https://api.example.com/uploads/avatars/...` 访问。

## 6. 日常维护

### 更新后端

```bash
git pull
docker compose up -d --build
docker compose logs -f api
```

### 备份 MySQL

```bash
docker compose exec mysql mysqldump -u root -p fitness_check_in > backup.sql
```

头像文件由 Docker volume 保存。服务器迁移时同时备份 `uploads_data` volume。

### 恢复 MySQL

```bash
docker compose exec -T mysql mysql -u root -p fitness_check_in < backup.sql
```

### 常见问题

- 小程序请求失败：检查微信公众平台 request 合法域名是否配置 HTTPS API 域名。
- 登录失败：检查 `WECHAT_APPID` 和 `WECHAT_SECRET` 是否来自同一个小程序。
- 后端启动失败：查看 `docker compose logs api`，重点检查 `DATABASE_URL`、MySQL 密码和 migration。
- 浏览器能访问但小程序不能访问：确认 HTTPS 证书链完整，且域名没有使用 IP 或非标准端口。
