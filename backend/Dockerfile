# AVM Backend Dockerfile (V1.30)
# 多阶段构建: deps → build → runtime

# ============ 1. 依赖安装 ============
FROM node:20-alpine AS deps
WORKDIR /app
# 先 copy 锁文件, 利用 Docker 缓存
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev --no-audit --no-fund

# ============ 2. 编译 TS ============
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma ./prisma/
RUN npm install --no-audit --no-fund
COPY src ./src
RUN npx tsc

# ============ 3. 运行时 ============
FROM node:20-alpine AS runtime
# 安装 postgresql-client 用于健康检查 / 备份调试
RUN apk add --no-cache postgresql-client wget tini

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000

# 拷贝生产依赖 + 编译产物 + prisma schema
COPY --from=deps    /app/node_modules ./node_modules
COPY --from=builder /app/dist          ./dist
COPY --from=builder /app/prisma        ./prisma
COPY package.json ./

# 上传文件目录
RUN mkdir -p /app/uploads /app/data /app/logs && chown -R node:node /app
USER node

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# 使用 tinit 提供 PID 1 信号处理
ENTRYPOINT ["/sbin/tini", "--"]

# 启动前自动跑 prisma migrate deploy (幂等, 不丢数据), 然后启动服务
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
