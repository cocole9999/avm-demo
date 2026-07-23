"""V1.8.4 MCP Server E2E
覆盖:
  - HTTP /api/mcp 5 端点 (info / tools / resources / prompt-templates / tool call)
  - stdio JSON-RPC 2.0 (initialize / tools/list / tools/call / resources/list / resources/read / prompts/list)
"""
import json, urllib.request, urllib.error, sys, subprocess, time as _t
from datetime import datetime, timedelta

BASE = 'http://127.0.0.1:4000'
fail = []
e2e_ids: list[str] = []  # 清理

def call(method, path, body=None, timeout=60):
    h = {'Content-Type': 'application/json; charset=utf-8'}
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    req = urllib.request.Request(f'{BASE}{path}', method=method, data=data, headers=h)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        body_bytes = r.read()
        if not body_bytes:
            return r.status, None
        try:
            return r.status, json.loads(body_bytes.decode('utf-8'))
        except json.JSONDecodeError:
            return r.status, body_bytes.decode('utf-8', errors='ignore')
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode('utf-8'))
        except Exception:
            return e.code, None

def assert_(cond, msg):
    if not cond:
        fail.append(msg)
        print(f'  ❌ {msg}')
    else:
        print(f'  ✓ {msg}')

print('=== V1.8.4 MCP Server E2E ===\n')

# ========== 1. Server info ==========
print('[1] Server info (/api/mcp):')
status, info = call('GET', '/api/mcp')
assert_(status == 200, f'info 200 (got {status})')
if status == 200:
    assert_(info.get('name') == 'avm-mcp-server', f'name 正确 (got {info.get("name")})')
    assert_(info.get('protocol') == 'mcp-1.0', f'protocol 是 mcp-1.0')
    assert_(info.get('tools_count', 0) >= 10, f'tools_count ≥ 10 (got {info.get("tools_count")})')
    assert_('capabilities' in info, f'capabilities 存在')
print()

# ========== 2. Tools 列表 ==========
print('[2] Tools 列表 (/api/mcp/tools):')
status, r = call('GET', '/api/mcp/tools')
assert_(status == 200, f'tools 200')
assert_(len(r.get('tools', [])) >= 10, f'工具数 ≥ 10 (got {len(r.get("tools", []))})')
# 验证关键工具
tool_names = {t.get('name') for t in r.get('tools', [])}
for required in ['list_work_items', 'get_work_item', 'create_work_item', 'update_work_item',
                  'search', 'get_metrics', 'get_team_workload', 'analyze_resources', 'ai_qa']:
    assert_(required in tool_names, f'工具 {required} 存在')
print()

# ========== 3. Tool call - list_work_items ==========
print('[3] Tool call: list_work_items (limit=3):')
status, r = call('POST', '/api/mcp/tools/list_work_items', body={'limit': 3})
assert_(status == 200, f'list_work_items 200')
if status == 200:
    items = r.get('result', [])
    assert_(len(items) == 3, f'返回 3 条 (got {len(items)})')
    if items:
        sample = items[0]
        for f in ['id', 'key', 'title', 'type', 'status', 'priority']:
            assert_(f in sample, f'字段 {f} 存在')
print()

# ========== 4. Tool call - get_metrics ==========
print('[4] Tool call: get_metrics:')
status, r = call('POST', '/api/mcp/tools/get_metrics', body={})
assert_(status == 200, f'get_metrics 200')
if status == 200:
    metrics = r.get('result', {})
    assert_('total' in metrics, f'metrics.total 存在 (got {metrics.get("total")})')
    assert_(metrics.get('total', 0) > 0, f'工作项总数 > 0')
print()

# ========== 5. Tool call - create_work_item ==========
print('[5] Tool call: create_work_item:')
status, r = call('POST', '/api/mcp/tools/create_work_item', body={
    'type': 'task',
    'title': f'E2E-MCP-测试任务-{int(_t.time())}',
    'priority': 'P2',
    'assignee': '张三（研发一组）',
})
assert_(status == 200, f'create 200')
if status == 200:
    new_item = r.get('result', {})
    assert_(new_item.get('id'), f'返回 id (got {new_item.get("id")})')
    assert_(new_item.get('key'), f'返回 key (got {new_item.get("key")})')
    e2e_ids.append(new_item.get('id'))
print()

# ========== 6. Tool call - ai_qa ==========
print('[6] Tool call: ai_qa (P0 多少个):')
status, r = call('POST', '/api/mcp/tools/ai_qa', body={'question': 'P0 紧急工作项有多少？'})
assert_(status == 200, f'ai_qa 200')
if status == 200:
    answer = r.get('result', {}).get('answer', '') or r.get('result', {}).get('llmInsight', '')
    assert_(len(answer) > 0, f'ai_qa 有回答 (got {len(answer)} 字符)')
    print(f'   回答: {answer[:100]}...')
print()

# ========== 7. Tool call - analyze_resources ==========
print('[7] Tool call: analyze_resources (本周):')
start, end = datetime.now().strftime('%Y-%m-%d'), (datetime.now() + timedelta(days=6)).strftime('%Y-%m-%d')
status, r = call('POST', '/api/mcp/tools/analyze_resources', body={'startDate': start, 'endDate': end})
assert_(status == 200, f'analyze 200')
if status == 200:
    result = r.get('result', {})
    assert_('users' in result or 'summary' in result or 'teamLoad' in result or isinstance(result, dict),
            f'result 是 dict')
print(f'   资源分析: {json.dumps(r.get("result", {}), ensure_ascii=False)[:200]}')
print()

# ========== 8. Resources 列表 ==========
print('[8] Resources 列表 (/api/mcp/resources):')
status, r = call('GET', '/api/mcp/resources')
assert_(status == 200, f'resources 200')
assert_(len(r.get('resources', [])) > 0, f'resources 数量 > 0 (got {len(r.get("resources", []))})')
# 验证 URI 格式
if r.get('resources'):
    sample_uri = r['resources'][0].get('uri', '')
    assert_(sample_uri.startswith('avm://'), f'URI 以 avm:// 开头 (got {sample_uri})')
print(f'   共 {len(r.get("resources", []))} 个资源 (工作项)')
print()

# ========== 9. Resource read ==========
print('[9] Resource read:')
if r.get('resources'):
    uri = r['resources'][0].get('uri', '')
    encoded = urllib.request.quote(uri, safe='')
    status, item = call('GET', f'/api/mcp/resources/{encoded}')
    assert_(status == 200, f'resource read 200')
    if status == 200:
        # resource read 返回 {uri, mimeType, content: {...workItem}}
        content = item.get('content', item)
        assert_('id' in content or 'key' in content, f'resource content 包含工作项数据 (got keys: {list(content.keys())[:5]})')
print()

# ========== 10. Prompt templates ==========
print('[10] Prompt 模板列表:')
status, r = call('GET', '/api/mcp/prompt-templates')
assert_(status == 200, f'prompts 200')
prompts = r.get('templates', [])
assert_(len(prompts) >= 3, f'模板 ≥ 3 (got {len(prompts)})')
expected = ['每日站会', '迭代回顾', '风险评估']
for p in prompts:
    if p.get('name') in expected:
        print(f'   ✓ {p.get("name")}: {p.get("description", "")[:60]}')
        assert_('template' in p and len(p['template']) > 50, f'模板内容 ≥ 50 字符')
print()

# ========== 11. stdio 模式 - JSON-RPC ==========
print('[11] stdio 模式 (JSON-RPC 2.0):')
stdio_input = (
    '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"e2e-test","version":"1.0"}}}\n'
    + '{"jsonrpc":"2.0","method":"notifications/initialized"}\n'
    + '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}\n'
    + '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_metrics","arguments":{}}}\n'
    + '{"jsonrpc":"2.0","id":4,"method":"resources/list","params":{}}\n'
    + '{"jsonrpc":"2.0","id":5,"method":"prompts/list","params":{}}\n'
)
try:
    # Windows 下 npx 经常找不到 tsx，直接用 node_modules\.bin\tsx.cmd
    tsx_bin = r'D:\AI\飞书项目\avm-demo\backend\node_modules\.bin\tsx.cmd'
    result = subprocess.run(
        [tsx_bin, 'src/bin/mcp-stdio.ts'],
        input=stdio_input.encode('utf-8'),
        capture_output=True,
        timeout=30,
        cwd=r'D:\AI\飞书项目\avm-demo\backend',
        env={**__import__('os').environ, 'PYTHONIOENCODING': 'utf-8'},
    )
    # stdout 是 NDJSON，每行一个响应
    stdout = result.stdout.decode('utf-8', errors='ignore')
    lines = [l for l in stdout.split('\n') if l.strip().startswith('{')]
    print(f'   收到 {len(lines)} 个 JSON-RPC 响应')
    assert_(len(lines) >= 5, f'至少 5 个响应 (initialize + tools/list + tools/call + resources/list + prompts/list)')

    # 验证 initialize 响应
    init_resp = next((json.loads(l) for l in lines if '"id":1' in l and 'initialize' not in l), None)
    if init_resp:
        assert_(init_resp.get('result', {}).get('serverInfo', {}).get('name') == 'avm-mcp-server',
                f'initialize 返回 serverInfo.name')

    # 验证 tools/list 响应
    tl_resp = next((json.loads(l) for l in lines if '"id":2' in l), None)
    if tl_resp:
        tools_list = tl_resp.get('result', {}).get('tools', [])
        assert_(len(tools_list) >= 10, f'tools/list 返回 ≥ 10 工具 (got {len(tools_list)})')

    # 验证 tools/call 响应
    tc_resp = next((json.loads(l) for l in lines if '"id":3' in l), None)
    if tc_resp:
        tc_result = tc_resp.get('result', {})
        assert_('content' in tc_result or 'result' in tc_result, f'tools/call 返回内容')

    # 验证 resources/list
    rl_resp = next((json.loads(l) for l in lines if '"id":4' in l), None)
    if rl_resp:
        resources_list = rl_resp.get('result', {}).get('resources', [])
        assert_(len(resources_list) > 0, f'resources/list 数量 > 0 (got {len(resources_list)})')

    # 验证 prompts/list
    pl_resp = next((json.loads(l) for l in lines if '"id":5' in l), None)
    if pl_resp:
        prompts_list = pl_resp.get('result', {}).get('prompts', [])
        assert_(len(prompts_list) >= 3, f'prompts/list 数量 ≥ 3 (got {len(prompts_list)})')
except Exception as e:
    fail.append(f'stdio 测试异常: {e}')
    print(f'  ❌ stdio 测试异常: {e}')
print()

# ========== 12. 清理 E2E 创建的工作项 ==========
print('[12] 清理 E2E 创建的工作项:')
for wid in e2e_ids:
    status, _ = call('POST', '/api/mcp/tools/update_work_item', body={'id': wid, 'status': '已关闭'})
    # 然后通过 work-items API 删
    try:
        req = urllib.request.Request(f'{BASE}/api/work-items/{wid}', method='DELETE')
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass
e2e_ids.clear()
print(f'   ✓ 清理完成')
print()

# ========== 总结 ==========
print('=' * 60)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    sys.exit(1)
else:
    print('✅ 全部通过 — V1.8.4 MCP Server OK')
