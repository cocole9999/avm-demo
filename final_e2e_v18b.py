"""V1.8 B/C E2E: AI 帮我填 + AI 推荐负责人"""
import json, urllib.request, sys
BASE = 'http://127.0.0.1:4000'
fail = []

def call(method, path, body=None, timeout=60):
    h = {'Content-Type': 'application/json; charset=utf-8'}
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    req = urllib.request.Request(f'{BASE}{path}', method=method, data=data, headers=h)
    return json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8'))

def assert_(cond, msg):
    if not cond:
        fail.append(msg); print(f'  ❌ {msg}')
    else:
        print(f'  ✓ {msg}')

print('=== V1.8 B+C: 表单 AI 辅助 ===\n')

# B1: AI 帮我填
print('[B1] "实现 AVM 透明底盘相机标定":')
r = call('POST', '/api/ai-command/fill-work-item', {
    'title': '实现 AVM 透明底盘相机标定',
    'type': 'task',
    'hint': '需要银河L7实车',
})
filled = r.get('filled', {})
assert_(filled.get('type') in ('requirement', 'task', 'bug', 'release'), f'type 有效 (got {filled.get("type")})')
assert_(filled.get('priority') in ('P0', 'P1', 'P2', 'P3'), f'priority 有效 (got {filled.get("priority")})')
assert_(len(filled.get('description', '')) > 20, f'description 至少 20 字 (got {len(filled.get("description", ""))})')
assert_(filled.get('estimate', 0) > 0, f'estimate > 0 (got {filled.get("estimate")})')
assert_(filled.get('assignee', ''), f'推荐了 assignee (got {filled.get("assignee")})')
assert_(filled.get('projectCode', '').startswith('AVM-'), f'推荐了 project (got {filled.get("projectCode")})')
assert_(filled.get('projectId'), f'解析了 projectId (got {filled.get("projectId")})')
print(f'   reasoning: {r.get("reasoning", "")[:120]}')
print()

# B2: AI 帮我填（只给标题）
print('[B2] 只给标题"修复登录bug":')
r = call('POST', '/api/ai-command/fill-work-item', {'title': '修复登录bug'})
filled = r.get('filled', {})
assert_(filled.get('type') in ('requirement', 'task', 'bug', 'release'), f'type 自动推断 (got {filled.get("type")})')
# bug 关键词 → 应该推荐 bug 类型
assert_(filled.get('type') == 'bug', f'bug 关键词识别为 bug (got {filled.get("type")})')
print(f'   自动填: {filled.get("type")} {filled.get("priority")} {filled.get("assignee")}')
print()

# C1: AI 推荐负责人
print('[C1] "修复 AVM 全景影像黑屏" P0 bug:')
r = call('POST', '/api/ai-command/suggest-assignee', {
    'title': '修复 AVM 全景影像黑屏',
    'type': 'bug',
    'priority': 'P0',
    'projectCode': 'AVM-GALAXY-L7-2026',
})
assert_(r.get('assignee'), f'推荐了 assignee (got {r.get("assignee")})')
assert_(r.get('reasoning', ''), f'给了 reasoning')
print(f'   assignee: {r.get("assignee")}')
print(f'   reasoning: {r.get("reasoning", "")[:200]}')
print()

# C2: 推荐 requirement
print('[C2] "实现 AVM 透明底盘功能" requirement:')
r = call('POST', '/api/ai-command/suggest-assignee', {
    'title': '实现 AVM 透明底盘功能',
    'type': 'requirement',
    'priority': 'P1',
})
assert_(r.get('assignee'), f'推荐了 assignee (got {r.get("assignee")})')
print(f'   assignee: {r.get("assignee")}')
print(f'   reasoning: {r.get("reasoning", "")[:200]}')
print()

# 总结
print('=' * 50)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    sys.exit(1)
else:
    print(f'✅ 全部通过 — V1.8 B+C 表单 AI 辅助 OK')
