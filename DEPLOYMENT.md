# 运动打卡小程序部署文档

本文档是本项目的服务器部署指南，后端使用 PM2 运行，数据库使用宿主机 MySQL，公网入口使用 Nginx。

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
PM2
  |
  v
Node.js API
  |
  v
宿主机 MySQL
```

推荐使用独立 API 域名，例如：

```text
api.example.com
```

前端小程序不部署到服务器，通过微信开发者工具上传发布。

## 2. 安装运行环境

### 2.1 安装基础工具

```bash
sudo apt update
sudo apt install -y git curl
```

检查：

```bash
git --version
curl --version
```

### 2.2 安装 Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v
npm -v
```

### 2.3 安装 pnpm

```bash
sudo corepack enable
sudo corepack prepare pnpm@10.10.0 --activate
pnpm -v
```

### 2.4 安装 PM2

```bash
sudo npm install -g pm2
pm2 -v
```

### 2.5 安装 MySQL

```bash
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
sudo systemctl status mysql
mysql --version
```

MySQL 不要开放公网 `3306`。

初始化 MySQL 安全配置：

```bash
sudo mysql_secure_installation
```

按提示设置 root 密码、移除匿名用户、关闭远程 root 登录并移除测试库。

### 2.6 安装 Nginx

```bash
sudo apt install -y nginx
sudo systemctl enable --now nginx
sudo systemctl status nginx
nginx -v
```

### 2.7 安装 Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
certbot --version
```

## 3. 上传代码

```bash
git clone <your-repo-url> fitness-check-in
cd fitness-check-in
```

后续命令默认在项目根目录执行。

## 4. 初始化 MySQL

进入 MySQL：

```bash
sudo mysql
```

创建数据库和业务用户：

```sql
CREATE DATABASE IF NOT EXISTS fitness_check_in
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'fitness'@'127.0.0.1'
  IDENTIFIED BY 'replace-with-mysql-password';

GRANT ALL PRIVILEGES ON fitness_check_in.* TO 'fitness'@'127.0.0.1';

FLUSH PRIVILEGES;
```

退出：

```sql
EXIT;
```

验证业务用户：

```bash
mysql -h 127.0.0.1 -u fitness -p fitness_check_in
```

## 5. 配置后端环境变量

后端运行配置统一放在：

```text
server/.env
```

复制示例文件：

```bash
cp server/.env.example server/.env
```

编辑：

```bash
nano server/.env
```

示例：

```bash
DATABASE_URL="mysql://fitness:replace-with-mysql-password@127.0.0.1:3306/fitness_check_in?connection_limit=5"
JWT_SECRET="replace-with-a-long-random-secret"
WECHAT_APPID="your_wechat_mini_program_appid"
WECHAT_SECRET="your_wechat_mini_program_appsecret"
PORT=3000
HOST="127.0.0.1"
NODE_OPTIONS="--max-old-space-size=256"
```

变量说明：

| 变量 | 作用 |
| --- | --- |
| `DATABASE_URL` | 宿主机 MySQL 连接地址 |
| `JWT_SECRET` | 登录 token 签名密钥 |
| `WECHAT_APPID` | 微信小程序 AppID |
| `WECHAT_SECRET` | 微信小程序 AppSecret |
| `PORT` | 后端监听端口 |
| `HOST` | 后端监听地址 |
| `NODE_OPTIONS` | Node.js 运行参数 |

生成随机 `JWT_SECRET`：

```bash
openssl rand -base64 48
```

微信配置获取位置：

```text
微信公众平台 -> 小程序后台 -> 开发管理 -> 开发设置 -> AppID / AppSecret
```

## 6. 安装依赖、构建和迁移

进入后端目录：

```bash
cd server
pnpm install --prod=false
pnpm prisma:generate
pnpm build
pnpm prisma:migrate
```

回到项目根目录：

```bash
cd ..
```

## 7. 使用 PM2 启动后端

启动：

```bash
pm2 start server/ecosystem.config.cjs --env production
```

查看状态：

```bash
pm2 status
```

查看日志：

```bash
pm2 logs fitness-check-in-api
```

保存进程列表：

```bash
pm2 save
```

配置开机自启：

```bash
pm2 startup
```

执行 `pm2 startup` 输出的 `sudo env ...` 命令后，再执行：

```bash
pm2 save
```

本机验证：

```bash
curl http://127.0.0.1:3000/health
```

正常响应：

```json
{
  "code": 0,
  "data": {
    "status": "ok"
  },
  "message": "ok",
  "msg": "ok"
}
```

## 8. 配置 Nginx

创建站点配置：

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

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/api.example.com /etc/nginx/sites-enabled/api.example.com
sudo nginx -t
sudo systemctl reload nginx
```

验证：

```bash
curl http://api.example.com/health
```

## 9. 配置 HTTPS

申请证书：

```bash
sudo certbot --nginx -d api.example.com
```

验证：

```bash
curl https://api.example.com/health
```

## 10. 配置微信小程序合法域名

进入微信公众平台：

```text
开发管理 -> 开发设置 -> 服务器域名
```

配置：

```text
request 合法域名：https://api.example.com
uploadFile 合法域名：https://api.example.com
downloadFile 合法域名：https://api.example.com
```

## 11. 配置前端生产接口

修改：

```text
env/.env.production
```

示例：

```bash
VITE_SERVER_BASEURL__WEIXIN_RELEASE=https://api.example.com
```

构建微信小程序：

```bash
pnpm build:mp-weixin
```

微信开发者工具导入：

```text
dist/build/mp-weixin
```

上传代码后在微信公众平台提交审核。

## 12. 更新发布

拉取代码：

```bash
git pull
```

更新后端：

```bash
cd server
pnpm install --prod=false
pnpm prisma:generate
pnpm build
pnpm prisma:migrate
cd ..
pm2 restart fitness-check-in-api --update-env
pm2 save
```

查看状态：

```bash
pm2 status
pm2 logs fitness-check-in-api --lines 100
```

## 13. 运维命令

重启后端：

```bash
pm2 restart fitness-check-in-api --update-env
```

停止后端：

```bash
pm2 stop fitness-check-in-api
```

查看后端日志：

```bash
pm2 logs fitness-check-in-api
```

查看 Nginx 状态：

```bash
sudo systemctl status nginx
```

查看 MySQL 状态：

```bash
sudo systemctl status mysql
```

备份数据库：

```bash
mysqldump -h 127.0.0.1 -u fitness -p fitness_check_in > fitness_check_in.sql
```

恢复数据库：

```bash
mysql -h 127.0.0.1 -u fitness -p fitness_check_in < fitness_check_in.sql
```

头像文件目录：

```text
server/uploads/avatars
```

## 14. 排查

### 后端本机不通

```bash
pm2 status
pm2 logs fitness-check-in-api --lines 100
curl http://127.0.0.1:3000/health
```

检查 `server/.env` 中的 `DATABASE_URL`、`JWT_SECRET`、`WECHAT_APPID`、`WECHAT_SECRET`。

### 数据库连接失败

```bash
sudo systemctl status mysql
mysql -h 127.0.0.1 -u fitness -p fitness_check_in
```

确认 `DATABASE_URL` 的用户名、密码、端口和数据库名与 MySQL 初始化配置一致。

### 域名访问失败

```bash
sudo nginx -t
sudo systemctl status nginx
curl http://127.0.0.1:3000/health
curl https://api.example.com/health
```

如果本机地址正常但域名失败，优先检查 Nginx 配置、域名解析和 HTTPS 证书。
