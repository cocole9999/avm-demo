/**
 * k6 AI 命令压测脚本
 *
 * 目标：登录后 POST /api/ai-command/command 发送简单问题
 *       并发 5（AI 接口限流），持续 2m
 * 阈值：成功率 > 95%
 *
 * 运行：k6 run perf/k6-ai-command.js
 *
 * 注意：
 *   - AI 命令依赖 LLM 配置！若后端未配置 API Key（provider 为 mock），
 *     /api/ai-command/command 会返回 400 「LLM 未配置」。
 *   - 压测前必须先在「LLM 设置」页配置可用 provider（如 DeepSeek / OpenAI）。
 *   - AI 接口耗时不稳定（LLM 调用 + 工具链），不设响应时间阈值，只看成功率。
 *   - 并发 5 是为了不触发 LLM 厂商的 RPM 限流（如 DeepSeek 默认 60 RPM）。
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const USERNAME = __ENV.USERNAME || 'admin';
const PASSWORD = __ENV.PASSWORD || 'Admin@2026';

// 自定义指标：AI 命令成功率
const aiSuccessRate = new Rate('ai_command_success_rate');

// 轮询使用的简单问题集（避免 LLM 缓存导致每次都命中缓存）
const COMMANDS = [
  'AVM 项目中心有几个项目？',
  '哪些项目风险最高？',
  '列出所有 P0 工作项',
  '当前团队有几个人？',
  '帮我统计一下需求总数',
];

export const options = {
  scenarios: {
    ai_command_low_concurrency: {
      executor: 'constant-vus',
      vus: 5,          // AI 接口低并发，避免 LLM 厂商限流
      duration: '2m',  // 持续 2 分钟
    },
  },
  thresholds: {
    // AI 命令成功率 > 95%
    ai_command_success_rate: ['rate>0.95'],
    // HTTP 层错误率 < 10%（允许 LLM 偶发超时/限流）
    http_req_failed: ['rate<0.10'],
  },
};

// setup：登录拿 token
export function setup() {
  const loginRes = http.post(
    `${BASE_URL}/api/users/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  if (loginRes.status !== 200) {
    throw new Error(`登录失败: status=${loginRes.status} body=${loginRes.body}`);
  }

  const body = loginRes.json();
  const token = body.token;
  if (!token) {
    throw new Error(`登录返回无 token: ${loginRes.body}`);
  }

  console.log(`✅ setup 登录成功，token: ${token.slice(0, 8)}...`);
  return { token };
}

export default function (data) {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${data.token}`,
    },
    // AI 接口耗时较长，单独放宽超时到 90s（k6 默认 60s）
    timeout: '90s',
  };

  // 每次迭代取一个不同的问题
  const cmd = COMMANDS[__ITER % COMMANDS.length];

  group('AI 命令', () => {
    const payload = JSON.stringify({
      command: cmd,
      maxSteps: 3,
    });

    const res = http.post(`${BASE_URL}/api/ai-command/command`, payload, params);

    const ok = check(res, {
      '状态码 200': (r) => r.status === 200,
      '返回 reply': (r) => {
        try {
          const body = r.json();
          return body && typeof body.reply === 'string' && body.reply.length > 0;
        } catch {
          return false;
        }
      },
      '返回 ok=true': (r) => {
        try {
          return r.json().ok === true;
        } catch {
          return false;
        }
      },
    });

    aiSuccessRate.add(ok);

    if (!ok) {
      console.warn(`❌ AI 命令失败: status=${res.status} cmd="${cmd}" body=${res.body?.slice(0, 200)}`);
    }
  });

  // AI 接口调用间隔，避免打爆 LLM 厂商 RPM
  sleep(1);
}
