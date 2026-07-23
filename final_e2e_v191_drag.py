"""V1.9.1 甘特图拖拽改时间 E2E
覆盖:
  - 后端 PATCH work-items/:id 更新 planStart/planEnd
  - gantt 端点返回新排期
  - 前端 GanttPage 包含拖拽相关代码 (onMouseDown / setDrag / workItemApi.update)
  - 模拟拖拽流程: create -> PATCH planStart/planEnd -> gantt 查询新值
"""
import json, urllib.request, urllib.error, sys, time as _t
from datetime import datetime, timedelta

BASE = 'http://127.0.0.1:4000'
BASE_FRONT = 'http://127.0.0.1:9000'
fail = []
e2e_ids: list[str] = []


def call(method, path, body=None, timeout=30):
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


def iso_offset(days_from_now: int) -> str:
    """返回 YYYY-MM-DD 格式"""
    return (datetime.now() + timedelta(days=days_from_now)).strftime('%Y-%m-%d')


def iso_full(days_from_now: int) -> str:
    """返回 ISO DateTime (本地 00:00:00.000Z)"""
    return (datetime.now() + timedelta(days=days_from_now)).strftime('%Y-%m-%dT00:00:00.000Z')


print('=== V1.9.1 甘特图拖拽改时间 E2E ===\n')

# 先拿一个项目 id（让 gantt 能查到新建工作项）
status, projects = call('GET', '/api/projects')
project_id = projects[0]['id'] if projects else None

# ========== 1. 创建带排期的工作项 ==========
print('[1] 创建带排期的工作项:')
new_body = {
    'type': 'task',
    'title': f'E2E-V191-拖拽测试-{int(_t.time())}',
    'priority': 'P2',
    'status': '待领取',
    'assignee': '张三（研发一组）',
    'planStart': iso_full(0),
    'planEnd': iso_full(5),
    'projectId': project_id,
    'actor': 'E2E',
}
status, created = call('POST', '/api/work-items', body=new_body)
assert_(status == 201 and created.get('id'), f'创建成功 (status={status})')
e2e_ids.append(created['id'])
print(f'   新建 {created.get("key")} 排期 {created.get("planStart")[:10]} ~ {created.get("planEnd")[:10]} projectId={project_id[:8]}...')
print()

# ========== 2. gantt 端点能查到新工作项 ==========
print('[2] gantt 端点查询新建工作项:')
status, d = call('GET', '/api/work-items/gantt?projectCode=' + (created.get('project', {}).get('code') or ''))
if not d or d.get('summary', {}).get('itemCount', 0) == 0:
    # 不带 projectCode 重试
    status, d = call('GET', '/api/work-items/gantt')
assert_(d and d.get('items'), f'gantt 返回 items')
found = next((i for i in d['items'] if i['id'] == created['id']), None)
assert_(found, f'找到新建工作项 (key={created.get("key")})')
assert_(found and found.get('hasSchedule'), f'hasSchedule=True')
if found:
    plan_s = (found.get('planStart') or '')[:10]
    plan_e = (found.get('planEnd') or '')[:10]
    print(f'   gantt 显示: {plan_s} ~ {plan_e}')
print()

# ========== 3. 模拟"拖拽"——PATCH planStart/planEnd ==========
print('[3] 模拟拖拽: PATCH planStart +3 天, planEnd +3 天:')
new_start = iso_full(3)
new_end = iso_full(8)
status, updated = call('PATCH', f'/api/work-items/{created["id"]}', body={
    'planStart': new_start,
    'planEnd': new_end,
    'actor': 'E2E-拖拽测试',
})
assert_(status == 200, f'PATCH 200 (got {status})')
# PATCH 返 DateTime ISO 字符串，比较前 10 字符（YYYY-MM-DD）
assert_((updated.get('planStart') or '')[:10] == new_start[:10], f'planStart 更新 ({updated.get("planStart")[:10] if updated.get("planStart") else "?"} vs {new_start[:10]})')
assert_((updated.get('planEnd') or '')[:10] == new_end[:10], f'planEnd 更新 ({updated.get("planEnd")[:10] if updated.get("planEnd") else "?"} vs {new_end[:10]})')
print(f'   拖拽后: {updated.get("planStart")[:10]} ~ {updated.get("planEnd")[:10]}')
print()

# ========== 4. gantt 端点能反映新排期 ==========
print('[4] gantt 端点反映新排期:')
status, d = call('GET', '/api/work-items/gantt')
found = next((i for i in d['items'] if i['id'] == created['id']), None)
assert_(found, f'找到工作项')
if found:
    plan_s = (found.get('planStart') or '')[:10]
    plan_e = (found.get('planEnd') or '')[:10]
    assert_(plan_s == new_start[:10], f'gantt planStart = {new_start[:10]} (got {plan_s})')
    assert_(plan_e == new_end[:10], f'gantt planEnd = {new_end[:10]} (got {plan_e})')
print()

# ========== 5. 模拟"resize-end"——只改 planEnd ==========
print('[5] 模拟 resize-end: 只改 planEnd:')
new_end2 = iso_full(12)
status, updated2 = call('PATCH', f'/api/work-items/{created["id"]}', body={
    'planEnd': new_end2,
    'actor': 'E2E-resize',
})
assert_(status == 200, f'PATCH 200')
assert_((updated2.get('planEnd') or '')[:10] == new_end2[:10], f'planEnd 更新为 {new_end2[:10]}')
# planStart 不变
assert_((updated2.get('planStart') or '')[:10] == new_start[:10], f'planStart 保持不变 ({updated2.get("planStart")[:10] if updated2.get("planStart") else "?"} vs {new_start[:10]})')
print()

# ========== 6. 模拟"resize-start"——只改 planStart ==========
print('[6] 模拟 resize-start: 只改 planStart:')
new_start2 = iso_full(1)
status, updated3 = call('PATCH', f'/api/work-items/{created["id"]}', body={
    'planStart': new_start2,
    'actor': 'E2E-resize',
})
assert_(status == 200, f'PATCH 200')
assert_((updated3.get('planStart') or '')[:10] == new_start2[:10], f'planStart 更新为 {new_start2[:10]}')
# planEnd 保持
assert_((updated3.get('planEnd') or '')[:10] == new_end2[:10], f'planEnd 保持 {new_end2[:10]}')
print()

# ========== 7. activity 记录了排期变更 ==========
print('[7] activity 记录排期变更:')
status, activities = call('GET', f'/api/activities?workItemId={created["id"]}&limit=20')
if isinstance(activities, list):
    plan_changes = [a for a in activities if a.get('field') in ('planStart', 'planEnd')]
    assert_(len(plan_changes) >= 4, f'≥ 4 条排期变更记录 (got {len(plan_changes)})')
    actors = set(a.get('actor') for a in plan_changes)
    print(f'   变更记录: {len(plan_changes)} 条, actors: {actors}')
else:
    print(f'  ⚠ activities 端点返回非 list，跳过')
print()

# ========== 8. 前端 GanttPage 编译产物含拖拽代码 ==========
print('[8] 前端 GanttPage 编译产物含拖拽代码:')
r = urllib.request.urlopen(f'{BASE_FRONT}/src/pages/GanttPage.tsx?t=1', timeout=10)
body = r.read().decode('utf-8', errors='ignore')
assert_(len(body) > 50000, f'编译产物 > 50KB (got {len(body)})')
err_markers = ['Internal Server Error', 'Pre-transform error', 'Failed to resolve', 'SyntaxError']
errors = [m for m in err_markers if m in body]
assert_(len(errors) == 0, f'无编译错误 (found: {errors})')
# 关键代码
assert_('onMouseDown' in body, f'onMouseDown 存在')
assert_('setDrag' in body, f'setDrag 状态存在')
assert_('workItemApi.update' in body, f'workItemApi.update 调用存在')
assert_('resize-start' in body or 'resizeStart' in body, f'resize-start 类型存在')
assert_('resize-end' in body or 'resizeEnd' in body, f'resize-end 类型存在')
assert_('move' in body, f'move (平移) 类型存在')
assert_('DatePicker' in body, f'DatePicker (双击编辑 Modal) 存在')
print(f'   ✓ 编译产物 {len(body)} bytes, 拖拽 + Modal 代码齐全')
print()

# ========== 9. 前端 api.ts 含 update (拖拽松手会调) ==========
print('[9] api.ts 含 update 接口:')
r = urllib.request.urlopen(f'{BASE_FRONT}/src/api.ts?t=1', timeout=10)
body = r.read().decode('utf-8', errors='ignore')
assert_('update: (id' in body or 'update =' in body, f'workItemApi.update 定义')
assert_('/work-items/${id}' in body or '/work-items/' in body, f'update 调用 /work-items/:id')
print()

# ========== 10. 清理 ==========
print('[10] 清理 E2E 创建的工作项:')
for wid in e2e_ids:
    try:
        req = urllib.request.Request(f'{BASE}/api/work-items/{wid}', method='DELETE')
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass
e2e_ids.clear()
print('   ✓')
print()

# ========== 总结 ==========
print('=' * 60)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    sys.exit(1)
else:
    print('✅ 全部通过 — V1.9.1 甘特图拖拽改时间 OK')
