# AVM 项目中心 - 部署文档

> V1.12+ | 内部项目组 / 研发团队替代飞书项目

本文档覆盖 3 种部署方式：
1. **开发模式** — 前后端分别 `npm run dev`
2. **Docker Compose (推荐生产)** — 一键起 backend + frontend
3. **传统部署** — pm2/systemd 直接跑

---

## 1. 开发模式

适用：本地调试、二次开发

```bash
# 1. 装依赖
cd backend && npm install
cd ../frontend && npm install

# 2. 初始化数据库 (首次)
cd backend
npx prisma db push        # 建表
npx tsx src/seed.ts       # 导入种子数据 (7 个测试账号 + 6 客户 + 10 车型 + 7 项目 + 28 工作项 + 24 依赖)

# 3. 启后端 (端口 4000)
npm run dev

# 4. 启前端 (端口 9000) — 新窗口
cd ../frontend
npm run dev

# 5. 浏览器开 http://localhost:9000
#    登录: admin / admin123  (tenant_admin)
#           pm    / pm123     (space_admin)
#           lisi  / 123456    (member)
```

---

## 2. Docker Compose (推荐)

适用：内网部署 / 演示环境 / 准生产

### 2.1 启动

```bash
# 一键启动
docker compose up -d --build

# 查看日志
docker compose logs -f
docker compose logs -f backend    # 只看后端
docker compose logs -f frontend   # 只看前端

# 查看状态
docker compose ps
```

启动后：
- **前端**：http://localhost:8080
- **后端 API** (调试用)：http://localhost:4000
- 浏览器访问 8080，前端会把 `/api/*` 反代到 backend 容器

### 2.2 数据持久化

SQLite 文件挂载在 named volume `avm-data`：
- 容器内路径：`/app/data/data.db`
- 数据保留：升级 / 重启容器不丢
- 备份：`docker run --rm -v avm_avm-data:/data -v $(pwd):/backup alpine tar czf /backup/avm-$(date +%Y%m%d).tgz /data`

### 2.3 升级

```bash
git pull
docker compose down
docker compose up -d --build
# 数据 volume 保留
```

### 2.4 修改配置

环境变量在 `docker-compose.yml` 的 `services.backend.environment`：

```yaml
environment:
  NODE_ENV: production
  PORT: 4000
  DATABASE_URL: "file:/app/data/data.db"
  # 生产模式: 需要 TOKEN 才能调 API (无 token → 401)
  # NODE_ENV=development: 无 token 默认 dev-user tenant_admin (演示用)
```

**生产模式 (NODE_ENV=production)**：
- 所有 API 必须带 `Authorization: Bearer <token>` 头
- token 通过 `POST /api/users/login` 拿 (持久化到 db)
- role 层级: `member` < `space_admin` < `tenant_admin`
- 没有 admin role 时无法 DELETE

### 2.5 改前端 API 地址

如果 backend 不在 docker 网络里（比如分离部署），改 `docker-compose.yml`：

```yaml
services:
  frontend:
    build:
      args:
        VITE_API_BASE: https://api.your-company.com/api
```

`VITE_API_BASE` 会在 build 时注入到前端 bundle。**改完必须重新 build**：

```bash
docker compose build frontend
docker compose up -d
```

### 2.6 关闭

```bash
docker compose down              # 停服务 (保留 volume)
docker compose down -v           # 停服务 + 删 volume (数据会丢)
```

---

## 3. 传统部署 (pm2 + nginx)

适用：已有内网 K8s / VM 不想上 Docker

### 3.1 后端

```bash
cd backend
npm install
npm run build                    # tsc → dist/
npx prisma db push               # 建表 (首次)
npx tsx src/seed.ts              # 种子数据 (首次)
npx prisma generate              # client (每次 schema 改完跑)

# 用 pm2 跑
pm2 start dist/index.js --name avm-backend -i 1
pm2 save
pm2 startup
```

### 3.2 前端

```bash
cd frontend
npm install
npm run build                    # 输出到 dist/

# nginx 配置 (参考 frontend/nginx.conf)
# root 指向 /path/to/frontend/dist
# /api/* 反代到 http://127.0.0.1:4000
```

### 3.3 systemd (备选)

```ini
# /etc/systemd/system/avm-backend.service
[Unit]
Description=AVM Backend
After=network.target

[Service]
Type=simple
User=avm
WorkingDirectory=/opt/avm/backend
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=4000
Environment=DATABASE_URL=file:/opt/avm/backend/data/data.db

[Install]
WantedBy=multi-user.target
```

```bash
systemctl daemon-reload
systemctl enable --now avm-backend
systemctl status avm-backend
```

---

## 4. 端口规划

| 服务 | 容器内 | 宿主机 (compose) | 内网部署 |
|------|--------|------------------|----------|
| 前端 (nginx) | 80 | 8080 | 80/443 |
| 后端 (Express) | 4000 | 4000 (可选) | 内网 4000 |

---

## 5. 数据库切换 (MySQL/PG)

默认 SQLite (单文件，零运维)。要切 MySQL/PG：

```bash
# 1. 改 backend/.env
DATABASE_URL="mysql://user:pwd@host:3306/avm"

# 2. 改 backend/prisma/schema.prisma
datasource db {
  provider = "mysql"   # 或 "postgresql"
  url      = env("DATABASE_URL")
}

# 3. 重建
npx prisma db push
npx prisma generate
npm run build
```

Docker 同样：在 `docker-compose.yml` 加 MySQL service 即可。

---

## 6. LLM 配置

进系统后 → **AI 设置** 页面，填入：
- OpenAI / Anthropic / DeepSeek / 通义千问 / 智谱 GLM / Ollama / 自定义 OpenAI 兼容
- API Key + baseUrl + model
- 点 "测试连接" 验证
- 选 "主 provider" 设为默认

`MiniMax` / `qwen` / `glm` / `kimi` / `豆包` 都内置支持，复制粘贴 baseUrl + key 即可。

---

## 7. MCP 集成 (LLM/IDE)

MCP Server 端点在 backend 容器内：
- **HTTP JSON-RPC**: `http://localhost:4000/api/mcp/info` (查工具列表)
- **Streamable HTTP** (Claude/Trae/Cursor): `http://backend:4000/api/mcp/stream`
- **stdio** (本地 LLM): 见 `MCP_SETUP.md` 配 `npx tsx backend/src/bin/mcp-stdio.ts`

详见 `MCP_SETUP.md`。

---

## 8. 升级 checklist

```bash
# 1. 备份数据
docker run --rm -v avm_avm-data:/d -v $(pwd):/b alpine tar czf /b/avm-backup-$(date +%Y%m%d).tgz /d

# 2. 拉代码
git pull

# 3. 重建 + 重启
docker compose up -d --build

# 4. 验证
docker compose ps
curl http://localhost:4000/api/health
# 浏览器测核心功能
```

---

## 9. 常见问题

### 9.1 启动后访问 502
backend 健康检查没过。`docker compose logs backend` 看错误。
常见原因：端口被占 / 权限 / prisma 路径错。

### 9.2 数据库锁
SQLite 单写者。高并发场景考虑切换到 MySQL/PG。

### 9.3 Prisma client EPERM
Windows 跑 `prisma generate` 时如果 backend 进程在，会报 EPERM。
解决：先停 backend，再 generate。

### 9.4 LLM 调用 400 "LLM 未配置"
进 AI 设置 配 key + 选主 provider。

### 9.5 MCP SSE 连不上
检查 nginx 是否启用了 `proxy_buffering off` 和较长 `proxy_read_timeout`。
MCP 长连接需要 30+ 分钟不超时。

---

## 10. 监控 / 日志

```bash
# 容器日志
docker compose logs --tail 100 backend
docker compose logs -f --since 1h

# 应用日志 (本地)
backend/backend.log
backend/backend.log.err

# 性能监控
# backend 已内置 LRU 缓存 + Prisma 索引
# 看 E2E: final_e2e_perf.py 基线 (35 API/329ms avg 9ms)
```
