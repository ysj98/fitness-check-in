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

## 发布包

本地生成后端发布包：

```bash
pnpm build:release
```

发布包路径：

```text
server/release/fitness-check-in-server.zip
```

发布包包含：

- `dist/`
- `prisma/`
- `package.json`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`
- `ecosystem.config.cjs`
- `.env.example`

发布包不包含：

- `src/`
- `node_modules/`
- `.env`
- 测试文件
- 上传头像目录

服务器解压发布包后执行：

```bash
cp .env.example .env
pnpm install
pnpm prisma:generate
pnpm prisma:migrate
pm2 start ecosystem.config.cjs --env production
```

先编辑 `.env`，再启动服务。这里使用完整 `pnpm install`，因为迁移命令需要 Prisma CLI。

## API

- `GET /health`
- `POST /api/auth/wx-login`
- `GET /api/user/info`
- `POST /api/user/avatar`
- `PATCH /api/user/profile`
- `PATCH /api/user/weight-settings`
- `GET /api/checkins/today`
- `POST /api/checkins`
- `POST /api/checkins/backfill`
- `GET /api/checkins/stats`
- `GET /api/checkins/recent?limit=20`
- `GET /api/checkins/month?month=YYYY-MM`
- `DELETE /api/checkins/:id`
- `GET /api/achievements`
- `GET /api/reports/month?month=YYYY-MM`
- `GET /api/weights?page=1&pageSize=20`
- `GET /api/weights/stats?days=7|30|90`
- `POST /api/weights`
- `PATCH /api/weights/:id`
- `DELETE /api/weights/:id`
- `GET /uploads/avatars/:file`

### 用户目标说明

`PATCH /api/user/profile` 支持维护周目标 / 月目标：

```json
{
  "nickname": "Alex",
  "goalPeriod": "week",
  "goalMode": "both",
  "goalCount": 2,
  "goalDuration": 60
}
```

- `goalPeriod` 支持 `none`、`week`、`month`。`none` 表示不设置目标。
- `goalMode` 支持 `count`、`duration`、`both`。
- 周目标：`goalCount` 范围为 1-14 次，`goalDuration` 范围为 30-1500 分钟。
- 月目标：`goalCount` 范围为 1-60 次，`goalDuration` 范围为 100-6000 分钟。
- 新用户默认不设置目标；开启周目标时推荐默认值为 4 次、180 分钟，月目标推荐默认值为 20 次、800 分钟。

### 打卡接口说明

`POST /api/checkins` 创建正常打卡记录，请求体：

```json
{
  "sportType": "跑步",
  "durationMinutes": 45
}
```

字段说明：

- `sportType`：运动类型，支持 `散步`、`跑步`、`健身`、`骑行`、`游泳`、`瑜伽`、`其他`。
- `durationMinutes`：运动时长，正整数，范围 `1-300` 分钟。

打卡记录响应包含：

```json
{
  "id": 1,
  "checkedAt": "2026-06-27T04:00:00.000Z",
  "isBackfill": false,
  "backfillReason": "",
  "sportType": "跑步",
  "durationMinutes": 45
}
```

### 补签接口说明

`POST /api/checkins/backfill` 创建补签记录，请求体：

```json
{
  "date": "2026-06-26",
  "reason": "忘记打卡",
  "sportType": "跑步",
  "durationMinutes": 45
}
```

补签规则：

- 只能补签过去 30 天内的未打卡日期。
- 今天和未来日期不能补签。
- 已有打卡记录的日期不能补签。
- 每个自然月最多补签 3 次。
- 补签成功后计入月度热力、最近 7 天、连续打卡、累计打卡和成就统计。
- `reason` 支持 `忘记打卡`、`已运动未记录`、`其他`。
- `sportType` 和 `durationMinutes` 规则与正常打卡一致。

`GET /api/checkins/month?month=YYYY-MM` 会额外返回补签统计：

```json
{
  "month": "2026-06",
  "days": {
    "2026-06-26": 1
  },
  "backfillDays": {
    "2026-06-26": 1
  },
  "backfillUsed": 1,
  "backfillLimit": 3
}
```

`GET /api/checkins/stats` 返回当前周期目标进度。未设置目标时 `goalProgress` 为 `null`；`both` 模式下，当前周或当前月的次数和时长都达成时 `goalCompleted` 才为 `true`，成就中的“目标达成”也使用该规则：

```json
{
  "todayCount": 2,
  "todayDurationMinutes": 60,
  "goalCount": 2,
  "goalDurationMinutes": 60,
  "goalProgress": {
    "period": "week",
    "mode": "both",
    "countGoal": 2,
    "durationGoal": 60,
    "completed": true,
    "percent": 100
  },
  "goalCompleted": true
}
```

### 成就接口说明

`GET /api/achievements` 返回阶段式成就系列。成就系列包括：

- 累计打卡
- 连续打卡
- 体重记录
- 个人资料

每个系列包含当前冲刺阶段、全部阶段详情、已完成阶段数和总阶段数。总进度按 `已完成阶段数 / 全部阶段数` 计算，阶段展示进度会限制在目标值以内，避免出现 `30/10` 这类超过目标值的展示。

### 月报接口说明

`GET /api/reports/month?month=YYYY-MM` 按中国自然月汇总打卡天数、打卡次数、运动时长和体重变化：

```json
{
  "month": "2026-06",
  "checkin": {
    "days": 8,
    "count": 12,
    "durationMinutes": 360,
    "averageDurationMinutes": 45
  },
  "weight": {
    "recordCount": 2,
    "startWeightKg": 70,
    "endWeightKg": 69.5,
    "changeKg": -0.5,
    "weightUnit": "kg"
  }
}
```

## 数据库

```bash
pnpm prisma:generate
pnpm prisma:migrate
```

主要表：

- `users`
- `check_ins`
- `weight_records`

`check_ins` 记录正常打卡和补签打卡，包含：

- `checkedAt`：打卡时间
- `isBackfill`：是否补签
- `backfillReason`：补签原因
- `sportType`：运动类型
- `durationMinutes`：运动时长，单位分钟

体重统一以公斤保存。BMI 由体重和用户当前身高实时计算，不单独写入数据库。

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
pnpm build:release
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
