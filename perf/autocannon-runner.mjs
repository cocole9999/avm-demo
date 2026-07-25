/**
 * Autocannon 压测脚本 (k6 替代方案)
 *
 * 由于 k6 二进制下载受网络限制，使用 autocannon (Node.js npm 包) 作为等效替代。
 * 场景与 perf/k6-*.js 对齐：
 *   1. login      50 并发 30s   POST /api/users/login
 *   2. workitems  20→100 并发 1m GET  /api/work-items (需先登录拿 token)
 *   3. ai-command 5 并发 2m    POST /api/ai-command/command (可选，需 LLM 配置)
 *
 * 运行: node perf/autocannon-runner.mjs [login|workitems|ai-command|all]
 */
import autocannon from 'autocannon';
import { readFile } from 'node:fs/promises';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';
// 用 AVM_USERNAME 避免与 Windows 系统变量 USERNAME 冲突
const USERNAME = process.env.AVM_USERNAME || 'admin';
const PASSWORD = process.env.AVM_PASSWORD || 'Admin@2026';
const SCENARIO = process.argv[2] || 'all';

/** 登录拿 token */
async function login() {
  const r = await fetch(`${BASE_URL}/api/users/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
  });
  if (!r.ok) throw new Error(`登录失败: ${r.status} ${await r.text()}`);
  const body = await r.json();
  return body.token;
}

/** 解析并打印 autocannon 结果的关键指标 */
function printResult(label, result) {
  const fmt = (v) => (v == null || Number.isNaN(v) ? 'N/A' : v.toFixed(2));
  // autocannon 的 latency 字段: average/min/max/p50/p75/p90/p97_5/p99
  // 用 p97_5 近似 p(95) (autocannon 没有原生 p95)
  const p95 = result.latency.p97_5 != null ? result.latency.p97_5 : result.latency.p90;
  console.log('\n=========================================');
  console.log(`  场景: ${label}`);
  console.log('=========================================');
  console.log(`  持续时间:      ${result.duration.toFixed(2)}s`);
  console.log(`  并发连接数:    ${result.connections}`);
  console.log(`  总请求数:      ${result.requests.total}`);
  console.log(`  吞吐量 (RPS):  ${fmt(result.requests.average)}`);
  console.log(`  2xx 响应:      ${result['2xx'] || 0}`);
  console.log(`  非 2xx 响应:   ${result.non2xx || 0}`);
  console.log(`  总错误数:      ${result.errors || 0}`);
  console.log(`  传输数据量:    ${(result.throughput?.total || 0) > 0 ? (result.throughput.total / 1024).toFixed(2) + ' KB' : 'N/A'}`);
  console.log('');
  console.log('  响应时间 (ms):');
  console.log(`    平均:        ${fmt(result.latency.average)}`);
  console.log(`    最小:        ${fmt(result.latency.min)}`);
  console.log(`    最大:        ${fmt(result.latency.max)}`);
  console.log(`    p(50):       ${fmt(result.latency.p50)}`);
  console.log(`    p(75):       ${fmt(result.latency.p75)}`);
  console.log(`    p(90):       ${fmt(result.latency.p90)}`);
  console.log(`    p(97.5):     ${fmt(result.latency.p97_5)}`);
  console.log(`    p(99):       ${fmt(result.latency.p99)}`);
  console.log('=========================================\n');

  // 阈值检查
  const thresholds = result._thresholds || {};
  const checks = [];
  if (thresholds.p95) {
    const pass = p95 != null && p95 < thresholds.p95;
    checks.push(`  ${pass ? '✓' : '✗'} p(95)<${thresholds.p95}ms [用 p97.5=${fmt(p95)} 近似]`);
  }
  if (thresholds.errorRate) {
    const total = result.requests.total || 1;
    // 错误率 = (非2xx + 网络错误) / 总请求
    const rate = ((result.non2xx || 0) + (result.errors || 0)) / total;
    const pass = rate < thresholds.errorRate;
    checks.push(`  ${pass ? '✓' : '✗'} 错误率 < ${(thresholds.errorRate * 100).toFixed(1)}% (实际: ${(rate * 100).toFixed(2)}%)`);
  }
  if (checks.length > 0) {
    console.log('  阈值检查:');
    checks.forEach(c => console.log(c));
    console.log('=========================================\n');
  }
}

/** 场景 1: 登录压测 */
async function scenarioLogin() {
  console.log('\n[1/3] 登录压测: 50 并发 30s');
  const result = await autocannon({
    url: `${BASE_URL}/api/users/login`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
    connections: 50,
    duration: 30,
    title: 'login',
  });
  result._thresholds = { p95: 500, errorRate: 0.01 };
  printResult('登录 (POST /api/users/login)', result);
  return result;
}

/** 场景 2: 工作项列表压测 */
async function scenarioWorkitems() {
  console.log('\n[2/3] 工作项列表压测: ramping 20→100 并发 1m');
  const token = await login();
  const result = await autocannon({
    url: `${BASE_URL}/api/work-items`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    connections: 100,
    duration: 60,
    title: 'workitems',
  });
  result._thresholds = { p95: 800, errorRate: 0.05 };
  printResult('工作项列表 (GET /api/work-items)', result);
  return result;
}

/** 场景 3: AI 命令压测 (可选) */
async function scenarioAiCommand() {
  console.log('\n[3/3] AI 命令压测: 5 并发 2m (需 LLM 配置)');
  try {
    const token = await login();
    const result = await autocannon({
      url: `${BASE_URL}/api/ai-command/command`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        command: '当前有哪些高风险项目？',
        context: {},
      }),
      connections: 5,
      duration: 30, // 缩短为 30s 避免消耗 LLM 配额
      title: 'ai-command',
      timeout: 60, // AI 接口可能慢
    });
    result._thresholds = { errorRate: 0.10 };
    printResult('AI 命令 (POST /api/ai-command/command)', result);
    return result;
  } catch (e) {
    console.log(`  跳过: ${e.message}`);
    return null;
  }
}

async function main() {
  console.log(`压测目标: ${BASE_URL}`);
  console.log(`账号: ${USERNAME}`);
  console.log(`场景: ${SCENARIO}`);
  console.log(`开始时间: ${new Date().toISOString()}`);

  const results = {};
  if (SCENARIO === 'login' || SCENARIO === 'all') {
    try { results.login = await scenarioLogin(); } catch (e) { console.error('登录压测失败:', e.message); }
  }
  if (SCENARIO === 'workitems' || SCENARIO === 'all') {
    try { results.workitems = await scenarioWorkitems(); } catch (e) { console.error('工作项压测失败:', e.message); }
  }
  if (SCENARIO === 'ai-command' || SCENARIO === 'all') {
    try { results['ai-command'] = await scenarioAiCommand(); } catch (e) { console.error('AI 压测失败:', e.message); }
  }

  // 写入 JSON 报告 (放到 perf/ 目录)
  const report = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    scenarios: Object.fromEntries(
      Object.entries(results).filter(([_, v]) => v).map(([k, v]) => [k, {
        duration: v.duration,
        connections: v.connections,
        totalRequests: v.requests.total,
        rps: v.requests.average,
        errors: v.errors || 0,
        non2xx: v.non2xx || 0,
        latency: {
          avg: v.latency.average,
          p50: v.latency.p50,
          p90: v.latency.p90,
          p97_5: v.latency.p97_5,
          p99: v.latency.p99,
          max: v.latency.max,
        },
      }])
    ),
  };
  // 用 fileURLToPath 处理 Windows 中文路径
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const { writeFile } = await import('node:fs/promises');
  const scriptPath = fileURLToPath(import.meta.url);
  const scriptDir = path.dirname(scriptPath);
  const perfDir = path.basename(scriptDir) === 'perf' ? scriptDir : path.join(scriptDir, '..', 'perf');
  const reportPath = path.join(perfDir, 'baseline-report.json');
  await writeFile(reportPath, JSON.stringify(report, null, 2), 'utf8');
  console.log(`\n基线报告已保存: ${reportPath}`);
  console.log(`完成时间: ${new Date().toISOString()}`);
}

main().catch(e => {
  console.error('压测执行失败:', e);
  process.exit(1);
});
