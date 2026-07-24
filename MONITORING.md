# AVM 项目中心监控集成指南

> 监控栈：Prometheus（指标）+ Loki（日志）+ Grafana（可视化）+ Sentry（错误追踪）
> 适用版本：V1.46+

## 一、架构总览

```
┌─────────────────────────────────────────────────────┐
│  AVM Backend (port 4000)                            │
│  ├── /metrics       ← Prometheus 抓取（自实现）     │
│  ├── /api/health    ← 健康检查                     │
│  └── stdout JSON    ← Promtail 采集 → Loki          │
└─────────────────────────────────────────────────────┘
         │                        │
         ▼                        ▼
┌─────────────────┐     ┌─────────────────┐
│  Prometheus     │     │  Loki           │
│  (port 9090)    │     │  (port 3100)    │
│  指标存储 30d   │     │  日志存储       │
└─────────────────┘     └─────────────────┘
         │                        │
         └──────────┬─────────────┘
                    ▼
          ┌─────────────────┐
          │  Grafana        │
          │  (port 3000)    │
          │  统一可视化     │
          └─────────────────┘
```

## 二、后端指标端点（已内置，无需额外依赖）

后端通过 [metrics.ts](backend/src/utils/metrics.ts) 自实现 Prometheus exposition format，**无需安装 prom-client**。

### 采集的指标

| 指标 | 类型 | 说明 |
|------|------|------|
| `http_requests_total` | counter | HTTP 请求总数（method/route/status） |
| `http_request_duration_seconds` | histogram | HTTP 请求耗时分布 |
| `nodejs_memory_heap_used_bytes` | gauge | 堆内存已用 |
| `nodejs_memory_heap_total_bytes` | gauge | 堆内存总量 |
| `nodejs_memory_rss_bytes` | gauge | 进程常驻内存 |
| `nodejs_process_cpu_user_microseconds` | counter | 用户态 CPU |
| `nodejs_process_cpu_system_microseconds` | counter | 内核态 CPU |
| `nodejs_process_uptime_seconds` | gauge | 进程运行时长 |
| `avm_slow_queries_total` | counter | 慢查询总数 |
| `avm_db_errors_total` | counter | 数据库错误总数 |

### 验证

```bash
# 后端启动后访问
curl http://localhost:4000/metrics
```

## 三、启动监控栈

### 1. 前置条件

主服务已通过 `docker compose up -d` 启动（监控栈依赖 `avm-demo_default` 网络）。

### 2. 启动监控栈

```bash
cd avm-demo

# 启动 Prometheus + Loki + Promtail + Grafana
docker compose -f monitoring/docker-compose.monitoring.yml up -d

# 查看状态
docker compose -f monitoring/docker-compose.monitoring.yml ps
```

### 3. 访问

| 服务 | 地址 | 默认账号 |
|------|------|---------|
| Grafana | http://localhost:3000 | admin / admin（或环境变量 GRAFANA_USER/GRAFANA_PASSWORD） |
| Prometheus | http://localhost:9090 | 无 |
| Loki | http://localhost:3100 | 无 |

### 4. Grafana 配置

数据源（Prometheus + Loki）已通过 [grafana-datasources.yml](monitoring/grafana-datasources.yml) 自动注入，无需手动添加。

**推荐创建的 Dashboard 面板**：

1. **API 性能面板**
   - QPS：`rate(http_requests_total[5m])`
   - P95 延迟：`histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))`
   - 错误率：`rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])`

2. **资源监控面板**
   - 堆内存：`nodejs_memory_heap_used_bytes`
   - 运行时长：`nodejs_process_uptime_seconds`
   - 慢查询：`rate(avm_slow_queries_total[5m])`

3. **日志面板（Loki）**
   - 错误日志：`{job="avm-logs", level="error"}`
   - 慢查询：`{job="avm-logs", level="warn"} |= "慢查询"`

## 四、日志收集说明

后端日志（[logger.ts](backend/src/utils/logger.ts)）生产环境已输出 JSON 行格式到 stdout，Promtail 自动采集容器 stdout 并发送到 Loki。

**日志标签**（来自 Promtail pipeline）：
- `level`：error/warn/info/debug
- `module`：auth/db/api/ai
- `container`：容器名
- `service`：服务名

**查询示例（LogQL）**：
```
# 最近 1 小时错误日志
{job="avm-logs", level="error"}

# 慢查询日志
{job="avm-logs", level="warn"} |= "慢查询"

# AI 模块日志
{job="avm-logs", module="ai"}
```

## 五、Nginx 安全加固（/metrics 限制内网）

`/metrics` 端点不鉴权（Prometheus 不带 token），建议在 Nginx 层限制仅内网访问：

```nginx
location /metrics {
    allow 10.0.0.0/8;       # 内网网段
    allow 172.16.0.0/12;
    allow 192.168.0.0/16;
    deny all;
    proxy_pass http://avm_backend;
}
```

## 六、环境变量

```bash
# 数据库性能
PRISMA_CONNECTION_LIMIT=10    # 连接池大小（生产默认 10）
SLOW_QUERY_MS=500             # 慢查询阈值（生产默认 500ms）

# 监控栈
GRAFANA_USER=admin
GRAFANA_PASSWORD=<强密码>

# CSRF（可选，Cookie 认证场景启用）
ENABLE_CSRF_PROTECTION=false
```

## 七、停止监控栈

```bash
docker compose -f monitoring/docker-compose.monitoring.yml down
# 清除数据卷
docker compose -f monitoring/docker-compose.monitoring.yml down -v
```
