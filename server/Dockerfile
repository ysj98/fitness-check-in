FROM node:20-bookworm-slim AS deps

WORKDIR /app
RUN corepack enable
COPY package.json ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile=false

FROM node:20-bookworm-slim AS build

WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm prisma:generate && pnpm build

FROM node:20-bookworm-slim

WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
EXPOSE 3000
CMD ["sh", "-c", "pnpm prisma:migrate && pnpm start"]
