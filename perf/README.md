# AVM 项目中心 k6 性能压测

本目录包含基于 [k6](https://k6.io) 的性能压测脚本，覆盖登录、工作项列表、AI 命令三个核心接口。

## 一、安装 k6

k6 是独立的性能测试工具（Go 编写，单二进制），**不需要 npm 安装**。

安装方式见官方文档：<https://k6.io/docs/getting-started/installation/>

### Windows

```powershell
# 方式 1：winget（推荐）
winget install grafana.k6

# 方式 2：choco
choco install k6

# 方式 3：scoop
scoop install k6
```

### macOS / Linux

```bash
# macOS
brew install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt update
sudo apt install k6
```

### Docker（免安装）

```bash
docker run --rm -i --network host grafana/k6 run - < perf/k6-login.js
```

验证安装：

```bash
k6 version
```

## 二、前置条件

1. **启动后端服务**（端口 4000）

   ```bash
   cd avm-demo/backend
   npm run dev
   # 确保看到: 🚀 AVM Backend listening at http://localhost:4000
   ```

2. **已执行 seed 初始化数据**

   ```bash
   cd avm-demo/backend
   npx prisma db seed
   # 演示账号: admin / Admin@2026
   ```

3. **AI 命令压测额外要求**：必须在「LLM 设置」页配置可用的 provider（如 DeepSeek / OpenAI）。
   未配置时 `/api/ai-command/command` 会返回 400「LLM 未配置」，无法压测。

## 三、运行脚本

所有脚本默认连接 `http://localhost:4000`，使用 `admin/Admin@2026` 账号。
可通过环境变量覆盖：

| 环境变量 | 默认值 | 说明 |
|---------|--------|------|
| `BASE_URL` | `http://localhost:4000` | 后端地址 |
| `USERNAME` | `admin` | 登录账号 |
| `PASSWORD` | `Admin@2026` | 登录密码 |

### 1. 登录压测

```bash
k6 run perf/k6-login.js
```

- **场景**：50 并发持续 30s，POST `/api/users/login`
- **阈值**：95% 响应 < 500ms，错误率 < 1%
- **说明**：后端 `loginLimiter`（5 次/分钟）对**成功登录不计入限流**（`skipSuccessfulRequests: true`），因此正确密码压测不会触发 429。

### 2. 工作项列表压测

```bash
k6 run perf/k6-workitems.js
```

- **场景**：ramping stage 20 → 100 并发，持续 1m，GET `/api/work-items`
- **阈值**：95% 响应 < 800ms
- **说明**：setup 阶段登录拿 token，所有 VU 共享。每次迭代执行全量列表 / type 筛选 / 关键词搜索三种查询。

### 3. AI 命令压测

```bash
k6 run perf/k6-ai-command.js
```

- **场景**：5 并发持续 2m，POST `/api/ai-command/command`
- **阈值**：成功率 > 95%
- **说明**：AI 接口依赖外部 LLM，耗时不稳定，不设响应时间阈值。并发限制为 5 是为了避免触发 LLM 厂商 RPM 限流（如 DeepSeek 默认 60 RPM）。

## 四、阈值说明

k6 在运行结束时会自动输出每个指标的达标情况：

```
✓ http_req_duration............: p(95)=412ms ✓ p(95)<500ms
✗ http_req_failed..............: rate=2.3%  ✗ rate<1%
```

- `✓` 表示达标，`✗` 表示未达标。
- 阈值未达标时 k6 退出码为非零，可集成到 CI/CD 做回归卡点。

### 各脚本阈值汇总

| 脚本 | 指标 | 阈值 | 含义 |
|------|------|------|------|
| k6-login.js | `http_req_duration` | `p(95)<500ms` | 95% 登录请求在 500ms 内完成 |
| k6-login.js | `http_req_failed` | `rate<0.01` | HTTP 错误率低于 1% |
| k6-login.js | `login_success_rate` | `rate>0.99` | 业务层登录成功率高于 99% |
| k6-workitems.js | `http_req_duration` | `p(95)<800ms` | 95% 列表请求在 800ms 内完成 |
| k6-workitems.js | `http_req_failed` | `rate<0.05` | HTTP 错误率低于 5% |
| k6-ai-command.js | `ai_command_success_rate` | `rate>0.95` | AI 命令成功率高于 95% |
| k6-ai-command.js | `http_req_failed` | `rate<0.10` | HTTP 错误率低于 10%（容忍 LLM 偶发超时） |

## 五、输出结果解读

```
execution: local
   script: perf/k6-login.js
   output: -

scenarios: (100.00%) 1 scenario, 50 max VUs, 30s max duration
   * default: 50 looping VUs for 30s (constant-vus)

     ✓ 状态码 200
     ✓ 返回 token
     ✓ 返回 user 对象

     checks.........................: 100.00% ✓ 5000  ✗ 0
     data_received..................: 2.1 MB  70 kB/s
     data_sent......................: 1.5 MB  50 kB/s
     http_req_blocked...............: avg=1.2ms   min=1µs   med=5µs   max=45ms
     http_req_connecting............: avg=0.8ms   min=0s    med=0s    max=12ms
     http_req_duration..............: avg=180ms   min=42ms  med=165ms max=890ms
       { expected_response:true }...: avg=180ms   min=42ms  med=165ms max=890ms
     http_req_failed................: 0.00%   ✓ 0     ✗ 5000
     http_req_receiving.............: avg=0.3ms   min=18µs  med=120µs max=15ms
     http_req_sending...............: avg=0.1ms   min=15µs  med=45µs  max=8ms
     http_req_tls_handshaking.......: avg=0s      min=0s    med=0s    max=0s
     http_req_waiting...............: avg=179ms   min=42ms  med=164ms max=890ms
     http_reqs......................: 5000    166.6/s
     iteration_duration.............: avg=480ms   min=442ms med=465ms max=1.29s
     iterations.....................: 5000    166.6/s
     login_success_rate.............: 100.00% ✓ 5000  ✗ 0
     vus............................: 50      min=50  max=50
     vus_max........................: 50      min=50  max=50
```

关键指标：

- **http_req_duration**：请求总耗时，关注 `p(95)` 是否达标
- **http_req_failed**：HTTP 错误率（非 2xx / 非 3xx）
- **checks**：业务断言通过率
- **iterations**：完成的迭代次数

## 六、进阶用法

### 输出 JSON 结果文件

```bash
k6 run --out json=results.json perf/k6-login.js
```

### 输出到 InfluxDB / Cloud

```bash
k6 run --out influxdb=http://localhost:8086/k6 perf/k6-workitems.js
```

### 调整并发与持续时间（不修改脚本）

```bash
k6 run --vus 100 --duration 1m perf/k6-login.js
```
