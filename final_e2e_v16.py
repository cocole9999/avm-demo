"""AVM V1.6 E2E 测试 - 测试管理 / 基线对比 / MCP stdio / LLM / SSO"""
import json
import sys
import urllib.request
import urllib.error
import time
import os
import subprocess
from pathlib import Path

BASE = 'http://localhost:4000'
RESULTS = []
FAILED = 0

def req(method, path, body=None, expect=200):
    url = BASE + path
    data = json.dumps(body).encode('utf-8') if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
                                headers={'Content-Type': 'application/json'} if body else {})
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            status = resp.status
            text = resp.read().decode('utf-8')
            data = json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        status = e.code
        text = e.read().decode('utf-8')
        try: data = json.loads(text)
        except: data = text
    ok = status == expect
    return ok, status, data

def test(name, ok, detail=''):
    global FAILED
    mark = '[PASS]' if ok else '[FAIL]'
    if not ok: FAILED += 1
    line = f"{mark} {name}"
    if detail and not ok: line += f" :: {detail}"
    print(line)
    RESULTS.append(ok)

print('========== V1.6 E2E 测试 ==========\n')

# ========== 1. 测试管理 ==========
print('--- 1. 测试管理 ---')
ok, _, cases = req('GET', '/api/tests/cases')
test('test 1.1 测试用例列表', ok and isinstance(cases, list) and len(cases) > 0, f'count={len(cases) if isinstance(cases, list) else 0}')

case = cases[0] if cases else None
if case:
    ok, _, detail = req('GET', f'/api/tests/cases/{case["id"]}')
    test('test 1.2 测试用例详情', ok and detail.get('id') == case['id'])

    ok, _, _ = req('POST', '/api/tests/cases', {
        'code': f'TC-E2E-{int(time.time())}', 'title': 'E2E 测试创建用例',
        'caseType': 'functional', 'priority': 'P1', 'module': 'E2E',
    }, expect=201)
    test('test 1.3 创建测试用例', ok)

# 测试计划
ok, _, plans = req('GET', '/api/tests/plans')
test('test 1.4 测试计划列表', ok and isinstance(plans, list))

if plans:
    plan = plans[0]
    ok, _, detail = req('GET', f'/api/tests/plans/{plan["id"]}')
    test('test 1.5 测试计划详情', ok and 'planCases' in (detail or {}))

# 测试执行
ok, _, runs = req('GET', '/api/tests/runs')
test('test 1.6 测试执行记录', ok and isinstance(runs, list))

# 测试统计
ok, _, stats = req('GET', '/api/tests/stats')
test('test 1.7 测试统计', ok and isinstance(stats, dict) and 'totalCases' in stats)

# 缺陷关联
bug_items = req('GET', '/api/work-items?type=bug&limit=1')[2]
if bug_items and case:
    # 先删可能存在的同 caseId+bugId 关联
    req('DELETE', f'/api/tests/cases/{case["id"]}/bugs/{bug_items[0]["id"]}')
    ok, _, _ = req('POST', f'/api/tests/cases/{case["id"]}/bugs', {
        'bugId': bug_items[0]['id'], 'bugKey': bug_items[0].get('key', ''),
        'bugTitle': bug_items[0].get('title', ''), 'relationType': 'found_by',
    }, expect=201)
    test('test 1.8 用例关联缺陷', ok)

print()

# ========== 2. 基线对比 ==========
print('--- 2. 基线对比 ---')
ok, _, baselines = req('GET', '/api/baselines')
test('test 2.1 基线列表', ok and isinstance(baselines, list))

if baselines:
    bid = baselines[0]['id']
    ok, _, diff = req('GET', f'/api/baselines/{bid}/compare')
    test('test 2.2 基线 diff', ok and 'baseline' in (diff or {}) and 'stats' in (diff or {}))

    # 验证 diff 结构
    if diff:
        s = diff.get('stats', {})
        test('test 2.3 diff 摘要字段', 'totalItems' in s and 'changed' in s)

print()

# ========== 3. MCP HTTP + stdio ==========
print('--- 3. MCP ---')
ok, _, info = req('GET', '/api/mcp')
test('test 3.1 MCP info', ok and info.get('tools_count', 0) >= 13)

ok, _, tools = req('GET', '/api/mcp/tools')
test('test 3.2 MCP 工具列表', ok and len(tools.get('tools', [])) >= 13)

ok, _, r = req('POST', '/api/mcp/tools/get_metrics', {})
test('test 3.3 MCP 调用 get_metrics', ok and r.get('result', {}).get('total', 0) > 0)

ok, _, r = req('POST', '/api/mcp/tools/search', { 'q': 'P0' })
test('test 3.4 MCP search', ok and isinstance(r.get('result'), list))

ok, _, r = req('POST', '/api/mcp/tools/ai_qa', { 'question': 'P0 多少个？' })
test('test 3.5 MCP ai_qa', ok and 'answer' in (r.get('result') or {}))

ok, _, res = req('GET', '/api/mcp/resources')
test('test 3.6 MCP resources', ok and len(res.get('resources', [])) > 0)

ok, _, p = req('GET', '/api/mcp/prompt-templates')
test('test 3.7 MCP 提示词模板', ok and len(p.get('templates', [])) >= 4)

# stdio 测试
print('test 3.8 MCP stdio JSON-RPC ... ', end='', flush=True)
try:
    test_jsonl = Path('D:/AI/飞书项目/avm-demo/backend/test-e2e-stdio.jsonl')
    test_jsonl.write_text(
        '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\n'
        '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n'
        '{"jsonrpc":"2.0","id":3,"method":"prompts/list","params":{}}\n',
        encoding='utf-8',
    )
    # Windows 上 npx.cmd，subprocess 在 cwd 找不到 .cmd；直接调 tsx
    tsx_exe = Path('D:/AI/飞书项目/avm-demo/backend/node_modules/.bin/tsx.cmd')
    cmd = [str(tsx_exe), 'src/bin/mcp-stdio.ts'] if tsx_exe.exists() else ['npx.cmd', 'tsx', 'src/bin/mcp-stdio.ts']
    proc = subprocess.run(
        cmd,
        input=test_jsonl.read_bytes(),
        capture_output=True, timeout=30, cwd='D:/AI/飞书项目/avm-demo/backend',
        shell=True,
    )
    out_lines = [l for l in proc.stdout.decode('utf-8', errors='ignore').splitlines() if l.strip()]
    ok = len(out_lines) >= 3 and all('"jsonrpc":"2.0"' in l for l in out_lines[:3])
    test('test 3.8 MCP stdio 3 个请求 3 个响应', ok, f'got {len(out_lines)} lines, err={proc.stderr[:100]!r}')
    test_jsonl.unlink(missing_ok=True)
except Exception as e:
    test('test 3.8 MCP stdio', False, str(e)[:100])

print()

# ========== 4. LLM ==========
print('--- 4. LLM 抽象层 ---')
ok, _, st = req('GET', '/api/ai/llm-status')
test('test 4.1 LLM 状态端点', ok and 'provider' in st and 'available' in st)

ok, _, r = req('POST', '/api/ai/qa', { 'question': '这是一个无模板匹配的测试问题' })
test('test 4.2 自由文本问答', ok and 'answer' in r)

# 即使无 LLM，也应 fallback 到启发式或 mock
test('test 4.3 启发式 fallback 正常', 'answer' in r or 'error' not in r)

print()

# ========== 5. SSO / 企业管理 ==========
print('--- 5. 企业版 SSO ---')
ok, _, tenants = req('GET', '/api/sso/tenants')
test('test 5.1 租户列表', ok and isinstance(tenants, list))

ok, _, t = req('POST', '/api/sso/tenants', {
    'code': f'e2e_{int(time.time()*1000)}', 'name': 'E2E 测试企业',
    'plan': 'pro', 'maxUsers': 50,
}, expect=201)
test('test 5.2 创建租户', ok and 'id' in t)

if t:
    tid = t['id']
    ok, _, s = req('PUT', f'/api/sso/tenants/{tid}/settings/feishu', {
        'enabled': True, 'appId': 'cli_e2e', 'appSecret': 'secret',
        'redirectUri': 'http://localhost:5173/sso/feishu/callback',
    })
    test('test 5.3 配置飞书 SSO', ok and s.get('provider') == 'feishu')

    ok, _, settings = req('GET', f'/api/sso/tenants/{tid}/settings')
    test('test 5.4 读取 SSO 配置', ok and len(settings) > 0 and settings[0].get('appSecret', '').endswith('cret'))

    ok, _, r = req('GET', f'/api/sso/oauth/feishu/login?tenantId={tid}')
    test('test 5.5 生成飞书登录 URL', ok and 'authUrl' in r and 'state' in r)

    ok, _, login = req('POST', f'/api/sso/oauth/feishu/demo-login', {
        'tenantId': tid, 'openId': f'ou_e2e_{int(time.time()*1000)}', 'userName': 'E2E测试用户',
    })
    test('test 5.6 飞书 demo 登录', ok and 'token' in login and 'user' in login)

    ok, _, stats = req('GET', f'/api/sso/tenants/{tid}/stats')
    test('test 5.7 租户统计', ok and 'userCount' in stats and 'recentLogs' in stats)

    ok, _, logs = req('GET', f'/api/sso/logs?tenantId={tid}')
    test('test 5.8 SSO 登录日志', ok and isinstance(logs, list) and len(logs) > 0)

    # 用户绑定 SSO
    ok, _, users = req('GET', '/api/users')
    if users:
        u = users[0]
        ok2, _, _ = req('POST', f'/api/sso/users/{u["id"]}/bind-sso', {
            'provider': 'feishu', 'openId': f'ou_bound_{int(time.time())}',
        })
        test('test 5.9 用户绑定 SSO', ok2)

print()

# ========== 总结 ==========
total = len(RESULTS)
passed = sum(RESULTS)
print(f'========== 完成: {passed}/{total} 通过 ==========')
if FAILED > 0:
    print(f'!!! {FAILED} 个测试失败 !!!')
    sys.exit(1)
else:
    print('全部通过！')
    sys.exit(0)
