# 运动打卡小程序

运动打卡小程序，包含微信小程序前端和 Node.js 后端服务。

## 文档

- [功能介绍](./PROJECT_FEATURES.md)
- [部署文档](./DEPLOYMENT.md)

## 技术栈

- 前端：uni-app、Vue 3、TypeScript、UnoCSS
- 后端：Node.js、Fastify、Prisma、MySQL
- 部署：Docker Compose、Nginx HTTPS

## 环境要求

- Node.js >= 20
- pnpm >= 9

## 安装依赖

```bash
pnpm install
```

## 本地开发

```bash
# H5
pnpm dev:h5

# 微信小程序
pnpm dev:mp
```

微信小程序开发时，将生成的 `dist/dev/mp-weixin` 目录导入微信开发者工具。

## 构建

```bash
# H5
pnpm build:h5

# 微信小程序
pnpm build:mp
```

构建产物默认输出到 `dist/build` 目录。

## 后端服务

后端代码位于 `server` 目录。生产部署可参考 [部署文档](./DEPLOYMENT.md) 使用 Docker Compose 启动 API、MySQL 等服务。

## 常用命令

```bash
pnpm lint
pnpm type-check
pnpm test:run
```

## License

[MIT](https://opensource.org/license/mit/)
