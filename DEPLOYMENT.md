# 运动打卡小程序部署文档

本文档是本项目的上线部署指南，以阿里云 ECS、Ubuntu 24.04 64 位、Docker Compose、Nginx、Certbot 为默认部署方式，覆盖后端 API、MySQL、HTTPS 证书、微信小程序合法域名、发布验证和后续维护。

## 1. 部署架构

```text
微信小程序
  |
  | HTTPS
  v
Nginx / Certbot
  |
  | http://127.0.0.1:3000
  v
Docker Compose
  ├─ api  Node.js + Fastify + Prisma
  └─ mysql  MySQL 8.4
```

推荐使用独立 API 域名，例如：

```text
api.example.com
```

如果暂时只有一个域名，也可以让同一个域名同时服务 H5 和 API，但需要将 API 转发到 `/api/`、头像转发到 `/uploads/`，不要在同一个 Nginx `server` 中重复写两个 `location /`。

## 2. 服务器准备

### 2.1 ECS 和域名

- ECS：建议 2 核 2G 起步。
- 系统：Ubuntu 24.04 64 位。
- 域名：准备一个 API 域名，例如 `api.example.com`。
- DNS：将 API 域名的 A 记录解析到 ECS 公网 IP。
- 安全组：开放 `80`、`443`，按需开放 `22`。
- 数据库：不要把 MySQL `3306` 暴露到公网。

### 2.2 安装基础软件

```bash
sudo apt update
sudo apt install -y git curl nginx
```

安装 Docker 和 Docker Compose Plugin：

```bash
sudo apt install -y docker.io docker-compose-plugin
sudo systemctl enable --now docker
docker --version
docker compose version
```

如果当前用户需要直接执行 Docker 命令，可加入 `docker` 用户组：

```bash
sudo usermod -aG docker $USER
```

执行后重新登录 SSH。

## 3. 上传代码

```bash
git clone <your-repo-url> fitness-check-in
cd fitness-check-in
```

也可以使用 `scp`、`rsync` 或 CI 将代码同步到服务器，后续命令默认都在项目根目录执行。

## 4. 配置后端环境变量

`docker-compose.yml` 会读取当前环境变量中的微信配置：

```bash
export WECHAT_APPID="你的微信小程序 AppID"
export WECHAT_SECRET="你的微信小程序 AppSecret"
```

更推荐在项目根目录创建 `.env`，方便 Docker Compose 自动读取：

```bash
WECHAT_APPID=你的微信小程序 AppID
WECHAT_SECRET=你的微信小程序 AppSecret
```

生产环境还需要修改 `docker-compose.yml` 中的默认密钥和数据库密码：

- `JWT_SECRET`
- `MYSQL_PASSWORD`
- `MYSQL_ROOT_PASSWORD`
- `DATABASE_URL` 中的 MySQL 用户名、密码和库名

生成随机 `JWT_SECRET`：

```bash
openssl rand -base64 48
```

确认 `DATABASE_URL` 与 MySQL 配置一致，例如：

```text
mysql://fitness:fitness_password@mysql:3306/fitness_check_in
```

这里的 `mysql` 是 Docker Compose service 名称，不要改成 `127.0.0.1`。

## 5. 启动后端和数据库

```bash
docker compose up -d --build
docker compose ps
```

查看日志：

```bash
docker compose logs -f api
docker compose logs -f mysql
```

验证本机 API：

```bash
curl http://127.0.0.1:3000/health
```

正常响应应包含 `status: ok`。

头像上传文件保存在 API 容器内：

```text
/app/uploads/avatars
```

项目使用 Docker volume `uploads_data` 持久化上传文件。

## 6. Nginx 反向代理

### 6.1 推荐方式：独立 API 域名

创建 Nginx 配置：

```bash
sudo nano /etc/nginx/sites-available/api.example.com
```

写入：

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name api.example.com;

  client_max_body_size 10m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

启用站点：

```bash
sudo ln -s /etc/nginx/sites-available/api.example.com /etc/nginx/sites-enabled/api.example.com
sudo nginx -t
sudo systemctl reload nginx
```

HTTP 验证：

```bash
curl http://api.example.com/health
```

### 6.2 单域名同时部署 H5 和 API

如果使用 `fitness.jiandandian.top` 同时放 H5 和 API，可以参考：

```nginx
server {
  listen 80;
  listen [::]:80;
  server_name fitness.jiandandian.top;

  root /var/www/fitness.jiandandian.top/dist;
  index index.html;
  client_max_body_size 10m;

  location = /health {
    proxy_pass http://127.0.0.1:3000/health;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /api/ {
    proxy_pass http://127.0.0.1:3000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /uploads/ {
    proxy_pass http://127.0.0.1:3000/uploads/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

注意：同一个 `server` 里只能有一个 `location /`。如果 `location /` 已经用于 H5 静态页面，就不要再把另一个 `location /` 写成 API 代理。

## 7. 使用 Certbot 配置 HTTPS

Certbot 官方推荐大多数用户通过 snap 安装。下面以 Nginx 插件自动配置 HTTPS 为主流程。

### 7.1 安装 Certbot

如果系统里已经通过 `apt` 安装过 Certbot，先移除旧版本：

```bash
sudo apt remove -y certbot python3-certbot-nginx
```

安装 snapd 和 Certbot：

```bash
sudo apt install -y snapd
sudo snap install core
sudo snap refresh core
sudo snap install --classic certbot
sudo ln -s /snap/bin/certbot /usr/bin/certbot
```

确认版本：

```bash
certbot --version
```

### 7.2 自动申请证书并改写 Nginx

先确认域名已经解析到当前服务器，并且 HTTP 可以访问：

```bash
curl http://api.example.com/health
```

执行：

```bash
sudo certbot --nginx -d api.example.com
```

按提示输入邮箱、同意服务条款，并选择是否将 HTTP 自动跳转到 HTTPS。生产环境建议开启 HTTP 到 HTTPS 跳转。

申请成功后，Certbot 会自动在 Nginx 配置中加入证书路径，通常类似：

```nginx
ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;
```

重新检查：

```bash
sudo nginx -t
sudo systemctl reload nginx
curl https://api.example.com/health
```

### 7.3 单域名示例

如果证书域名是 `fitness.jiandandian.top`：

```bash
sudo certbot --nginx -d fitness.jiandandian.top
curl https://fitness.jiandandian.top/health
```

如果该域名的 `/` 用于 H5 页面，后端健康检查应使用实际 API 路径或独立 API 域名。推荐生产环境使用 `api.fitness.jiandandian.top` 作为 API 域名。

### 7.4 续期验证

Certbot 通过 systemd timer 自动续期。检查定时器：

```bash
systemctl list-timers | grep certbot
```

执行续期演练：

```bash
sudo certbot renew --dry-run
```

查看证书：

```bash
sudo certbot certificates
```

### 7.5 手动 webroot 方式

如果不希望 Certbot 自动改写 Nginx，可以使用 webroot：

```bash
sudo mkdir -p /var/www/certbot
```

在 Nginx 的 `server` 中加入：

```nginx
location /.well-known/acme-challenge/ {
  root /var/www/certbot;
}
```

重载 Nginx：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

申请证书：

```bash
sudo certbot certonly --webroot -w /var/www/certbot -d api.example.com
```

然后手动给 Nginx 增加 HTTPS `server`：

```nginx
server {
  listen 443 ssl http2;
  listen [::]:443 ssl http2;
  server_name api.example.com;

  ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

  client_max_body_size 10m;

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
  }
}

server {
  listen 80;
  listen [::]:80;
  server_name api.example.com;

  location /.well-known/acme-challenge/ {
    root /var/www/certbot;
  }

  location / {
    return 301 https://$host$request_uri;
  }
}
```

## 8. 配置微信小程序合法域名

进入微信公众平台：

```text
开发管理 -> 开发设置 -> 服务器域名
```

添加 request 合法域名：

```text
https://api.example.com
```

如果头像 URL 也走同一个域名，`/uploads/avatars/...` 会通过同一个 HTTPS 域名访问，不需要额外域名。

微信小程序要求：

- 必须是 HTTPS。
- 证书必须有效且链完整。
- 域名需要备案并配置到对应小程序。
- 开发者工具可以临时勾选“不校验合法域名”，但体验版和正式版必须配置合法域名。

## 9. 前端生产配置和上传

修改 `env/.env.production`：

```bash
VITE_SERVER_BASEURL = 'https://api.example.com'
VITE_SERVER_BASEURL__WEIXIN_RELEASE = 'https://api.example.com'
```

如果使用单域名并把 API 放在 `/api` 下，前端请求地址仍建议配置为域名根地址：

```bash
VITE_SERVER_BASEURL = 'https://fitness.jiandandian.top'
```

项目接口路径本身以 `/api/...` 开头，因此不要配置成 `https://fitness.jiandandian.top/api`，否则可能出现 `/api/api/...`。

构建微信小程序：

```bash
pnpm install
pnpm build:mp-weixin
```

微信开发者工具导入：

```text
dist/build/mp-weixin
```

上传后，在微信公众平台提交体验版或正式审核。

## 10. 验证清单

### 后端

```bash
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 mysql
curl https://api.example.com/health
```

检查点：

- `/health` 正常返回。
- API 日志无数据库连接错误。
- MySQL 容器状态为 healthy。
- `https://api.example.com/uploads/avatars/...` 可访问已上传头像。

### 小程序

- 可以完成微信登录。
- 点击打卡后出现今日记录。
- 最近记录和月历数据能刷新。
- 连续打卡天数正常。
- 头像选择、上传和保存正常。
- 昵称、性别、生日保存正常。

## 11. 更新和回滚

### 更新服务

```bash
git pull
docker compose up -d --build
docker compose logs -f api
```

### 查看当前镜像和容器

```bash
docker compose images
docker compose ps
```

### 回滚代码

如果上一版本有 Git tag：

```bash
git checkout <tag-or-commit>
docker compose up -d --build
```

## 12. 备份和恢复

### 备份 MySQL

```bash
docker compose exec mysql mysqldump -u root -p fitness_check_in > backup.sql
```

### 恢复 MySQL

```bash
docker compose exec -T mysql mysql -u root -p fitness_check_in < backup.sql
```

### 备份头像文件

查看 volume：

```bash
docker volume ls
docker volume inspect fitness-check-in_uploads_data
```

迁移服务器时，需要同时备份 `uploads_data` volume。

## 13. 常见问题

### Certbot 提示域名验证失败

检查：

- 域名 A 记录是否指向当前 ECS 公网 IP。
- 阿里云安全组是否开放 `80`。
- Nginx 是否正常监听 `80`。
- `curl http://你的域名/health` 是否可访问。

### Nginx reload 失败

执行：

```bash
sudo nginx -t
```

根据错误行号检查配置。常见原因是同一个 `server` 中重复定义了 `location /`，或者证书路径域名写错。

### 小程序提示 request 域名不合法

检查：

- 微信公众平台是否添加 `https://api.example.com`。
- 前端 `env/.env.production` 是否改成 HTTPS 地址。
- 构建后是否重新上传小程序。
- 开发者工具本地预览和体验版环境是否一致。

### 接口出现 502

检查：

```bash
docker compose ps
docker compose logs --tail=100 api
curl http://127.0.0.1:3000/health
```

如果本机 `3000` 不通，优先看 API 容器日志；如果本机通但域名不通，优先看 Nginx 配置。

### 数据库连接失败

检查 `docker-compose.yml`：

- `DATABASE_URL` 的用户名、密码、数据库名是否与 MySQL 环境变量一致。
- `DATABASE_URL` 主机名是否为 `mysql`。
- MySQL 容器是否 healthy。

## 14. 参考链接

- [Certbot Nginx 官方说明](https://certbot.eff.org/instructions?os=snap&tab=standard&ws=nginx)
- [Certbot 官方文档](https://eff-certbot.readthedocs.io/)
