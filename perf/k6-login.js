/**
 * k6 登录压测脚本
 *
 * 目标：POST /api/users/login，50 并发持续 30s
 * 阈值：95% 响应 < 500ms，错误率 < 1%
 *
 * 运行：k6 run perf/k6-login.js
 *
 * 注意：
 *   - 后端登录限流 loginLimiter = 5 次/分钟/IP，但 skipSuccessfulRequests: true，
 *     即「成功登录不计入限流」。本脚本用正确密码登录，不会触发限流。
 *   - 若用错误密码压测，会被限流返回 429。
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// 自定义指标：登录成功率
const loginSuccessRate = new Rate('login_success_rate');

// 可通过环境变量覆盖目标地址与账号（默认指向本地 dev 环境）
const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const USERNAME = __ENV.USERNAME || 'admin';
const PASSWORD = __ENV.PASSWORD || 'Admin@2026';

export const options = {
  scenarios: {
    login_burst: {
      executor: 'constant-vus',
      vus: 50,          // 50 个并发虚拟用户
      duration: '30s',  // 持续 30 秒
    },
  },
  thresholds: {
    // 95% 的请求响应时间 < 500ms
    http_req_duration: ['p(95)<500'],
    // 错误率 < 1%
    http_req_failed: ['rate<0.01'],
    // 登录成功率 > 99%（自定义指标）
    login_success_rate: ['rate>0.99'],
  },
};

export default function () {
  const payload = JSON.stringify({
    username: USERNAME,
    password: PASSWORD,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const res = http.post(`${BASE_URL}/api/users/login`, payload, params);

  const ok = check(res, {
    '状态码 200': (r) => r.status === 200,
    '返回 token': (r) => {
      try {
        const body = r.json();
        return body && typeof body.token === 'string' && body.token.length > 0;
      } catch {
        return false;
      }
    },
    '返回 user 对象': (r) => {
      try {
        const body = r.json();
        return body && body.user && typeof body.user.username === 'string';
      } catch {
        return false;
      }
    },
  });

  loginSuccessRate.add(ok);

  // 模拟用户思考时间，避免无间断打满 CPU
  sleep(0.3);
}
