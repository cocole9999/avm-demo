#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V1.18 工作项批量操作 E2E

- POST /api/work-items/batch-update
- 验证: 单字段批量改、多字段组合、字段白名单、上限 200、审计、活动日志
"""
import urllib.request
import urllib.parse
import json
import sys
import os

BASE = 'http://127.0.0.1:4000'
HEADERS = {}

PASS = 0
FAIL = 0
ERRORS = []

def check(name, cond, detail=''):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f'  ✅ {name}')
    else:
        FAIL += 1
        ERRORS.append(f'{name}: {detail}')
        print(f'  ❌ {name} {detail}')

def http(method, path, data=None, is_json=True, raw_data=None, content_type=None):
    url = f'{BASE}{path}'
    headers = dict(HEADERS)
    body = None
    if data is not None and is_json:
        body = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    elif raw_data is not None:
        body = raw_data
        if content_type:
            headers['Content-Type'] = content_type
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=15)
        return r.status, r.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')

# ============ E2E ============
print('=' * 60)
print('V1.18 工作项批量操作 E2E')
print('=' * 60)

# 1. 准备: 拿 N 个工作项 ID
print('\n【1. 准备数据 — 拉 N 个工作项】')
code, body = http('GET', '/api/work-items?type=task&limit=10')
items = json.loads(body) if code == 200 else []
check('拉工作项 200', code == 200)
check('至少 3 个工作项', len(items) >= 3, f'count={len(items)}')
target_ids = [i['id'] for i in items[:5]]
print(f'  目标 ids: {target_ids[:3]}...')

# 2. 批量改状态
print('\n【2. 批量改 status】')
code, body = http('POST', '/api/work-items/batch-update', {
    'ids': target_ids,
    'changes': {'status': '已完成'},
})
result = json.loads(body) if code == 200 else {}
check('批量改状态 200', code == 200, f'code={code} body={body[:200]}')
check('updated == 5', result.get('updated') == 5, f'updated={result.get("updated")}')
check('found == 5', result.get('found') == 5, f'found={result.get("found")}')

# 3. 验证: 拉单个工作项确认状态改了
print('\n【3. 验证状态已修改】')
code, body = http('GET', f'/api/work-items/{target_ids[0]}')
item = json.loads(body) if code == 200 else {}
check('拉单个 200', code == 200)
check('状态已改', item.get('status') == '已完成', f'status={item.get("status")}')

# 4. 批量改优先级
print('\n【4. 批量改 priority】')
code, body = http('POST', '/api/work-items/batch-update', {
    'ids': target_ids,
    'changes': {'priority': 'P0'},
})
result = json.loads(body) if code == 200 else {}
check('批量改优先级 200', code == 200)
check('updated == 5', result.get('updated') == 5, f'updated={result.get("updated")}')

# 5. 批量改负责人
print('\n【5. 批量改 assignee】')
code, body = http('POST', '/api/work-items/batch-update', {
    'ids': target_ids,
    'changes': {'assignee': 'admin'},
})
result = json.loads(body) if code == 200 else {}
check('批量改负责人 200', code == 200)
check('updated == 5', result.get('updated') == 5)

# 6. 多字段组合
print('\n【6. 多字段组合 (status + priority + module)】')
code, body = http('POST', '/api/work-items/batch-update', {
    'ids': target_ids[:3],
    'changes': {'status': '进行中', 'priority': 'P1', 'module': 'AVM批量测试'},
})
result = json.loads(body) if code == 200 else {}
check('多字段批量 200', code == 200)
check('updated == 3', result.get('updated') == 3, f'updated={result.get("updated")}')
check('changes 含 3 字段', len(result.get('changes', {})) == 3, f'changes={result.get("changes")}')

# 验证
code, body = http('GET', f'/api/work-items/{target_ids[0]}')
item = json.loads(body) if code == 200 else {}
check('状态=进行中', item.get('status') == '进行中', f'status={item.get("status")}')
check('优先级=P1', item.get('priority') == 'P1', f'priority={item.get("priority")}')
check('模块=AVM批量测试', item.get('module') == 'AVM批量测试', f'module={item.get("module")}')

# 7. 字段白名单: 非法字段应被拒
print('\n【7. 字段白名单保护】')
code, body = http('POST', '/api/work-items/batch-update', {
    'ids': target_ids,
    'changes': {'title': '批量改标题'},  # title 不在白名单
})
result = json.loads(body) if code in (200, 400) else {}
# 实际实现是过滤掉非法字段, 不报错 — 检查 title 是否真的没被改
code2, body2 = http('GET', f'/api/work-items/{target_ids[0]}')
item2 = json.loads(body2) if code2 == 200 else {}
check('title 没被改', item2.get('title') != '批量改标题', f'title={item2.get("title")}')

# 8. 必填参数校验
print('\n【8. 参数校验】')
code, body = http('POST', '/api/work-items/batch-update', {'ids': [], 'changes': {'status': 'X'}})
check('空 ids 400', code == 400, f'code={code}')
code, body = http('POST', '/api/work-items/batch-update', {'ids': target_ids, 'changes': {}})
check('空 changes 400', code == 400, f'code={code}')
code, body = http('POST', '/api/work-items/batch-update', {'ids': target_ids, 'changes': {'forbiddenField': 'X'}})
check('全非法字段 400', code == 400, f'code={code}')

# 9. 上限 200
print('\n【9. 上限保护】')
fake_ids = [f'fake_id_{i}' for i in range(201)]
code, body = http('POST', '/api/work-items/batch-update', {
    'ids': fake_ids,
    'changes': {'status': '已完成'},
})
check('201 个 id 应被拒', code == 400, f'code={code}')

# 10. 不存在的 ID (全部不存在)
print('\n【10. 全不存在的 id】')
code, body = http('POST', '/api/work-items/batch-update', {
    'ids': ['nonexistent_1', 'nonexistent_2'],
    'changes': {'status': '已完成'},
})
result = json.loads(body) if code in (200, 404) else {}
check('全不存在 404', code == 404, f'code={code}')

# 11. 部分不存在 (一半真一半假)
print('\n【11. 部分存在的 id】')
mixed = target_ids[:2] + ['nonexistent_3']
code, body = http('POST', '/api/work-items/batch-update', {
    'ids': mixed,
    'changes': {'status': '已完成'},
})
result = json.loads(body) if code == 200 else {}
check('部分存在 200', code == 200, f'code={code}')
check('updated 反映真实更新数', result.get('updated', 0) >= 2, f'updated={result.get("updated")}')

# 12. 审计日志
print('\n【12. 审计日志 (V1.13 兼容)】')
code, body = http('GET', '/api/audit-logs?entity=workItem&limit=20')
data = json.loads(body) if code == 200 else {}
logs = data.get('items', []) if isinstance(data, dict) else data
# summary 在 meta 里 (JSON 字符串)
def has_batch_summary(log):
    try:
        meta = json.loads(log.get('meta', '{}'))
        return '批量更新' in meta.get('summary', '')
    except: return False
batch_logs = [l for l in logs if has_batch_summary(l)]
check('有批量更新审计记录', len(batch_logs) >= 1, f'batch_logs={len(batch_logs)}')
if batch_logs:
    log = batch_logs[0]
    check('审计含 entity=workItem', log.get('entity') == 'workItem', f'entity={log.get("entity")}')
    check('审计含 action=update', log.get('action') == 'update', f'action={log.get("action")}')
    check('审计含 actor', 'actor' in log, f'log={list(log.keys())}')

# 13. 活动日志 (老的 activity)
print('\n【13. 活动日志 (旧 activity 表)】')
code, body = http('GET', f'/api/activities?workItemId={target_ids[0]}&limit=5')
data = json.loads(body) if code == 200 else {}
acts = data.get('items', data.get('rows', [])) if isinstance(data, dict) else data
field_change_logs = [a for a in acts if a.get('action') == 'field_changed']
check('有 field_changed 活动', len(field_change_logs) >= 1, f'count={len(field_change_logs)}')

# 14. iterationId 字段
print('\n【14. 批量改 iterationId (外键)】')
# 先拉一个 iteration
code, body = http('GET', '/api/iterations?limit=5')
iters = json.loads(body) if code == 200 else []
if iters:
    iter_id = iters[0]['id']
    code, body = http('POST', '/api/work-items/batch-update', {
        'ids': target_ids[:2],
        'changes': {'iterationId': iter_id},
    })
    result = json.loads(body) if code == 200 else {}
    check('改 iterationId 200', code == 200, f'code={code}')
    check('updated == 2', result.get('updated') == 2, f'updated={result.get("updated")}')

# 15. 清场 — 把状态恢复 (避免污染其他测试)
print('\n【15. 清理 — 状态恢复】')
code, body = http('POST', '/api/work-items/batch-update', {
    'ids': target_ids,
    'changes': {'status': '待处理', 'priority': 'P2', 'assignee': 'admin', 'module': ''},
})
result = json.loads(body) if code == 200 else {}
check('清场 200', code == 200)
print(f'  清理 {result.get("updated")} 条恢复原状')

# ============ 总结 ============
print('\n' + '=' * 60)
print(f'V1.18 批量操作 E2E: ✅ {PASS} passed, ❌ {FAIL} failed')
print('=' * 60)
if FAIL > 0:
    print('\n失败项:')
    for e in ERRORS:
        print(f'  - {e}')
sys.exit(0 if FAIL == 0 else 1)
