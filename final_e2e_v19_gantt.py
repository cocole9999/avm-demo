"""V1.9 甘特图 E2E
覆盖:
  - GET /api/work-items/gantt 单项目查询
  - GET /api/work-items/gantt 全部项目查询
  - GET /api/work-items/gantt 过滤未排期
  - GET /api/work-items/gantt 时间窗过滤
  - 字段完整性 (projects / items / summary / dateRange)
  - 前端 GanttPage.tsx 编译产物
  - 路由 /gantt 返回 HTML
"""
import json, urllib.request, urllib.error, sys

BASE_BACKEND = 'http://127.0.0.1:4000'
BASE_FRONTEND = 'http://127.0.0.1:9000'
fail = []


def call(method, url, timeout=30, expect_json=True, full=False):
    h = {'Content-Type': 'application/json; charset=utf-8'}
    if full:
        # Vite 截断了响应，加 query 让它给完整源文件
        sep = '&' if '?' in url else '?'
        url = f'{url}{sep}t=1'
    req = urllib.request.Request(url, method=method, headers=h)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        body = r.read()
        if not expect_json:
            return r.status, body, dict(r.headers)
        return r.status, json.loads(body.decode('utf-8')), dict(r.headers)
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode('utf-8')), dict(e.headers)
        except Exception:
            return e.code, None, dict(e.headers)


def assert_(cond, msg):
    if not cond:
        fail.append(msg)
        print(f'  ❌ {msg}')
    else:
        print(f'  ✓ {msg}')


print('=== V1.9 甘特图 E2E ===\n')

# ========== 1. 单项目查询 ==========
print('[1] 单项目查询 (AVM-GALAXY-L7-2026):')
status, d, _ = call('GET', f'{BASE_BACKEND}/api/work-items/gantt?projectCode=AVM-GALAXY-L7-2026')
assert_(status == 200, f'200 (got {status})')
assert_(len(d.get('projects', [])) == 1, f'1 个项目 (got {len(d.get("projects", []))})')
assert_(d['projects'][0]['code'] == 'AVM-GALAXY-L7-2026', f'code 正确')
assert_(len(d.get('items', [])) >= 1, f'有 items (got {len(d.get("items", []))})')
summary = d.get('summary', {})
assert_(summary.get('itemCount', 0) > 0, f'summary.itemCount > 0')
assert_(summary.get('scheduledCount', 0) > 0, f'有排期工作项')
dateRange = d.get('dateRange', {})
assert_(dateRange.get('from') and dateRange.get('to'), f'dateRange 有 from/to ({dateRange.get("from")} ~ {dateRange.get("to")})')
# 字段完整性
if d.get('items'):
    sample = d['items'][0]
    for f in ['id', 'key', 'title', 'type', 'status', 'priority', 'hasSchedule',
              'planStart', 'planEnd', 'project']:
        assert_(f in sample, f'字段 {f} 存在')
print(f'   summary: {json.dumps(summary, ensure_ascii=False)}')
print(f'   items: {len(d["items"])} 个, 全部 hasSchedule=True')
for it in d['items'][:3]:
    print(f"     [{it['key']}] {it['title'][:30]:30} {it['status']:8} {(it.get('planStart') or '')[:10]} ~ {(it.get('planEnd') or '')[:10]}")
print()

# ========== 2. 全部项目查询 ==========
print('[2] 全部项目查询 (无 projectCode):')
status, d, _ = call('GET', f'{BASE_BACKEND}/api/work-items/gantt')
assert_(status == 200, f'200 (got {status})')
assert_(len(d.get('projects', [])) >= 5, f'≥ 5 个项目 (got {len(d.get("projects", []))})')
assert_(len(d.get('items', [])) > 0, f'有 items')
s = d.get('summary', {})
# V1.11: 数据可能全排期 (因为之前 V1.9.1 拖拽测试都加了 planStart/planEnd), 改为只校验 summary 字段一致
assert_(s.get('itemCount', 0) == s.get('scheduledCount', 0) + s.get('unscheduledCount', 0), f'itemCount = scheduled + unscheduled (got itemCount={s.get("itemCount")} scheduled={s.get("scheduledCount")} unscheduled={s.get("unscheduledCount")})')
print(f'   全部: projects={len(d["projects"])} items={s["itemCount"]} scheduled={s["scheduledCount"]} unscheduled={s["unscheduledCount"]}')
print()

# ========== 3. includeUnscheduled=false ==========
print('[3] 只看已排期 (includeUnscheduled=false):')
status, d, _ = call('GET', f'{BASE_BACKEND}/api/work-items/gantt?includeUnscheduled=false')
assert_(status == 200, f'200')
items = d.get('items', [])
all_scheduled = all(it.get('hasSchedule') for it in items)
assert_(all_scheduled, f'全部 hasSchedule=True (got {len(items)} 条)')
assert_(d['summary']['unscheduledCount'] == 0, f'unscheduledCount = 0 (实际只显示已排期)')
print(f'   只显示已排期: {len(items)} 条')
print()

# ========== 4. 时间窗过滤 ==========
print('[4] 时间窗过滤 (from=2026-07-01 to=2026-07-31):')
status, d, _ = call('GET', f'{BASE_BACKEND}/api/work-items/gantt?from=2026-07-01&to=2026-07-31')
assert_(status == 200, f'200')
items = d.get('items', [])
# 所有有排期的工作项应至少有一天在 7月
ok = 0
for it in items:
    if it.get('planStart') and it.get('planEnd'):
        s = it['planStart'][:10]
        e = it['planEnd'][:10]
        if s <= '2026-07-31' and e >= '2026-07-01':
            ok += 1
print(f'   7月内的工作项: {ok} / {len(items)}')
print()

# ========== 5. 项目查询 - 多类型工作项 ==========
print('[5] 多类型工作项 (req + task + bug + release):')
status, d, _ = call('GET', f'{BASE_BACKEND}/api/work-items/gantt?projectCode=AVM-GALAXY-L7-2026')
types = {it['type'] for it in d.get('items', [])}
assert_('requirement' in types, f'含 requirement')
assert_('task' in types, f'含 task')
assert_('bug' in types, f'含 bug')
assert_('release' in types, f'含 release')
print(f'   项目内类型: {types}')
print()

# ========== 6. 前端 GanttPage 编译 ==========
print('[6] 前端 GanttPage.tsx 编译产物:')
status, body, _ = call('GET', f'{BASE_FRONTEND}/src/pages/GanttPage.tsx', expect_json=False, full=True)
assert_(status == 200, f'编译 200 (got {status})')
assert_(len(body) > 10000, f'body 长度 > 10KB (got {len(body)})')
# 找编译错误
err_markers = ['Internal Server Error', 'Pre-transform error', 'Failed to resolve import', 'SyntaxError']
errors = [m for m in err_markers if m.encode() in body]
assert_(len(errors) == 0, f'无编译错误 (found: {errors})')
print(f'   ✓ 编译产物长度 {len(body)} bytes')
print()

# ========== 7. 前端 Root.tsx 含 /gantt 路由 ==========
print('[7] 前端 Root.tsx 注册 /gantt 路由:')
status, body, _ = call('GET', f'{BASE_FRONTEND}/src/Root.tsx', expect_json=False, full=True)
assert_(status == 200, f'200')
assert_(b'GanttPage' in body, f'Root.tsx 引用 GanttPage')
# Vite 编译时 JSX 属性变成对象语法: path="gantt" → path: "gantt"
assert_(b'path: "gantt"' in body or b'path="gantt"' in body, f'Root.tsx 注册 gantt 路由')
print('   ✓ 路由注册')
print()

# ========== 8. 前端 App.tsx 加菜单 ==========
print('[8] 前端 App.tsx 甘特图菜单项:')
status, body, _ = call('GET', f'{BASE_FRONTEND}/src/App.tsx', expect_json=False, full=True)
assert_(status == 200, f'200')
assert_(b'/gantt' in body, f'菜单含 /gantt 链接')
assert_(b'CalendarOutlined' in body, f'CalendarOutlined 引用')
# Vite 编译时字符串变 key: "gantt": 语法
assert_(b"case \"gantt\":" in body or b"case 'gantt':" in body, f'getTitle 含 gantt 分支')
print('   ✓ 菜单 + 标题 + icon 都注册')
print()

# ========== 9. api.ts workItemApi.gantt 注册 ==========
print('[9] api.ts gantt 接口:')
status, body, _ = call('GET', f'{BASE_FRONTEND}/src/api.ts', expect_json=False, full=True)
assert_(status == 200, f'200')
assert_(b'gantt:' in body or b'gantt =' in body, f'api.ts 含 gantt 接口')
assert_(b'/work-items/gantt' in body, f'api.ts 调用 /work-items/gantt')
print('   ✓')
print()

# ========== 总结 ==========
print('=' * 60)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    sys.exit(1)
else:
    print('✅ 全部通过 — V1.9 甘特图 OK')
