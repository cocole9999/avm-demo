/**
 * k6 工作项列表压测脚本
 *
 * 目标：先登录拿 token，再 GET /api/work-items 持续 1m
 *       并发 20 → 100 逐步加压（ramping stage）
 * 阈值：95% 响应 < 800ms
 *
 * 运行：k6 run perf/k6-workitems.js
 *
 * 注意：
 *   - 需要先启动后端 4000 + 已 seed 数据。
 *   - 工作项路由为 /api/work-items（连字符），不是 /api/workItems。
 *   - dev 模式无 token 默认 tenant_admin，但本脚本仍走真实登录拿 token，贴近生产行为。
 */

import http from 'k6/http';
import { check, sleep, group } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';
const USERNAME = __ENV.USERNAME || 'admin';
const PASSWORD = __ENV.PASSWORD || 'Admin@2026';

export const options = {
  stages: [
    // 阶段 1：20 并发，持续 20s（预热）
    { duration: '20s', target: 20 },
    // 阶段 2：线性加压到 100，持续 20s
    { duration: '20s', target: 100 },
    // 阶段 3：保持 100 并发，持续 20s（峰值）
    { duration: '20s', target: 100 },
    // 阶段 4：降压到 0，持续 10s（收尾）
    { duration: '10s', target: 0 },
  ],
  thresholds: {
    // 95% 的请求响应时间 < 800ms
    http_req_duration: ['p(95)<800'],
    // 业务错误率 < 5%（允许少量 5xx）
    http_req_failed: ['rate<0.05'],
  },
};

// setup 阶段：登录拿 token，所有 VU 共享同一个 token（模拟同一用户高频查询）
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
  };

  group('工作项列表', () => {
    // 1) 无筛选全量列表
    const res1 = http.get(`${BASE_URL}/api/work-items`, params);
    check(res1, {
      '全量列表 200': (r) => r.status === 200,
      '返回数组': (r) => {
        try {
          return Array.isArray(r.json());
        } catch {
          return false;
        }
      },
    });
  });

  sleep(0.2);

  group('工作项筛选查询', () => {
    // 2) 按 type 筛选
    const res2 = http.get(`${BASE_URL}/api/work-items?type=requirement`, params);
    check(res2, {
      'type 筛选 200': (r) => r.status === 200,
    });
  });

  sleep(0.2);

  group('工作项搜索', () => {
    // 3) 关键词搜索
    const res3 = http.get(`${BASE_URL}/api/work-items?q=AVM`, params);
    check(res3, {
      '搜索 200': (r) => r.status === 200,
    });
  });

  // 模拟用户浏览间隔
  sleep(0.5);
}
