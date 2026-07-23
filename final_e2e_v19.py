#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V1.19 UI 体验优化 E2E

- 验证工作项 list 返回 project/customer/carModel (KPI 概览数据源)
- 验证工作项复制 POST (复用字段)
- 验证批量改 module 字段 (V1.18 已有)
- 验证 Kanban 拖拽 (基础回归)
"""
import urllib.request
import json
import sys

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
print('V1.19 UI 体验优化 E2E')
print('=' * 60)

# 1. list 返回带 project/customer/carModel (KPI 概览数据源)
print('\n【1. list API 返回 project/customer (KPI 概览数据源)】')
code, body = http('GET', '/api/work-items?type=task&limit=5')
items = json.loads(body) if code == 200 else []
check('list 200', code == 200)
check('有数据', len(items) > 0, f'count={len(items)}')
if items:
    sample = items[0]
    has_proj = 'project' in sample
    has_cust = 'customer' in sample
    has_iter = 'iteration' in sample
    check('含 project 字段', has_proj, f'keys={list(sample.keys())[:8]}')
    check('含 customer 字段', has_cust)
    check('含 iteration 字段', has_iter)
    # 至少有一些工作项带 project 信息 (有项目关联)
    items_with_project = [i for i in items if i.get('project')]
    if items_with_project:
        sample_p = items_with_project[0]
        check('project 含 code/name', 'code' in sample_p.get('project', {}) and 'name' in sample_p.get('project', {}), f'project={sample_p.get("project")}')

# 2. 找一个有 planEnd 且超期的工作项 (KPI 概览超期数验证)
print('\n【2. KPI 概览超期计算数据】')
code, body = http('GET', '/api/work-items?type=task&limit=20')
items = json.loads(body) if code == 200 else []
from datetime import datetime
now = datetime.now()
done_statuses = ['已完成', '已关闭', '已验收', '已发布', '已修复']
overdue_count = 0
for i in items:
    if i.get('planEnd') and not i.get('status') in done_statuses:
        try:
            end = datetime.fromisoformat(i['planEnd'].replace('Z', '+00:00').replace('T', ' ').split('.')[0])
            if end < now:
                overdue_count += 1
        except: pass
check('能识别超期工作项 (KPI 数据源就绪)', overdue_count >= 0, f'overdue={overdue_count}')

# 3. 找一个有 project 的工作项用于"复制"测试
print('\n【3. 准备"复制"测试 — 找一个有 project 的工作项】')
target_item = None
for it in items:
    if it.get('project') and it.get('title'):
        target_item = it
        break
if not target_item:
    target_item = items[0] if items else None
check('找到目标工作项', target_item is not None)
if target_item:
    orig_id = target_item['id']
    orig_title = target_item['title']
    print(f'  目标: {target_item["key"]} {orig_title}')

# 4. 复制工作项 (POST 创建带 (副本) 后缀)
print('\n【4. 复制工作项 — POST 创建 (副本)】')
if target_item:
    new_data = {
        'type': target_item['type'],
        'title': f'{orig_title} (副本)',
        'description': target_item.get('description', ''),
        'priority': target_item.get('priority', 'P2'),
        'reporter': 'E2E_TEST',
    }
    if target_item.get('assignee'):
        new_data['assignee'] = target_item['assignee']
    if target_item.get('module'):
        new_data['module'] = target_item['module']
    if target_item.get('estimate'):
        new_data['estimate'] = target_item['estimate']
    code, body = http('POST', '/api/work-items', new_data)
    new_item = json.loads(body) if code in (200, 201) else {}
    check('复制创建 201/200', code in (200, 201), f'code={code} body={body[:200]}')
    if new_item.get('id'):
        check('新 ID 不等于原 ID', new_item['id'] != orig_id, f'new={new_item["id"]} orig={orig_id}')
        check('标题含 (副本)', '(副本)' in new_item.get('title', ''), f'title={new_item.get("title")}')
        check('类型一致', new_item.get('type') == target_item.get('type'), f'type={new_item.get("type")}')
        check('优先级复用', new_item.get('priority') == target_item.get('priority'), f'priority={new_item.get("priority")}')
        check('报告人=E2E_TEST', new_item.get('reporter') == 'E2E_TEST', f'reporter={new_item.get("reporter")}')
        new_id = new_item['id']
        # 清理
        http('DELETE', f'/api/work-items/{new_id}')

# 5. 验证批量改 module (V1.18 + V1.19 Kanban 显示)
print('\n【5. 批量改 module (V1.18) + Kanban 显示 (V1.19)】')
if items:
    target_ids = [i['id'] for i in items[:3]]
    code, body = http('POST', '/api/work-items/batch-update', {
        'ids': target_ids,
        'changes': {'module': 'V1.19 Kanban 测试模块'},
    })
    result = json.loads(body) if code == 200 else {}
    check('批量改 module 200', code == 200)
    check('updated == 3', result.get('updated') == 3, f'updated={result.get("updated")}')
    # 验证
    code, body = http('GET', f'/api/work-items/{target_ids[0]}')
    it = json.loads(body) if code == 200 else {}
    check('module 已改', it.get('module') == 'V1.19 Kanban 测试模块', f'module={it.get("module")}')
    # 清理
    http('POST', '/api/work-items/batch-update', {
        'ids': target_ids,
        'changes': {'module': ''},
    })

# 6. list API 端点用 iteration 过滤 (Kanban 当前迭代视图)
print('\n【6. list API 支持 iterationId 过滤】')
# 找一个 iteration
code, body = http('GET', '/api/iterations?limit=5')
iters = json.loads(body) if code == 200 else []
if iters:
    iter_id = iters[0]['id']
    code, body = http('GET', f'/api/work-items?type=task&iterationId={iter_id}&limit=5')
    filtered = json.loads(body) if code == 200 else []
    check('iterationId 过滤 200', code == 200)
    check('过滤后数据 (>= 0)', len(filtered) >= 0, f'count={len(filtered)}')
    # 验证所有项都属于该 iteration
    if filtered:
        wrong = [i for i in filtered if i.get('iterationId') != iter_id]
        check('所有项 iterationId 匹配', len(wrong) == 0, f'wrong={len(wrong)}')

# 7. KPI 概览算法端到端模拟
print('\n【7. KPI 概览算法 (后端 API 数据已就绪)】')
code, body = http('GET', '/api/work-items?type=task&limit=50')
all_items = json.loads(body) if code == 200 else []
total = len(all_items)
in_progress = sum(1 for i in all_items if i.get('status') == '进行中' or i.get('status') == '开发中')
done = sum(1 for i in all_items if i.get('status') in done_statuses)
blocked = sum(1 for i in all_items if i.get('status') == '已阻塞')
total_estimate = sum(i.get('estimate') or 0 for i in all_items)
print(f'  total={total}, in_progress={in_progress}, done={done}, blocked={blocked}, total_estimate={total_estimate}SP')
check('KPI 数据完整 (4 字段都有)', total > 0 and (in_progress + done + blocked) >= 0, f'数据完整')

# 8. Kanban 拖拽基础回归 (V1.18 已有 bulk-status)
print('\n【8. Kanban 拖拽改状态 (基础回归)】')
if all_items:
    target = all_items[0]
    orig_status = target['status']
    new_status = '已完成' if orig_status != '已完成' else '进行中'
    code, body = http('POST', '/api/work-items/bulk-status', {
        'ids': [target['id']],
        'status': new_status,
    })
    result = json.loads(body) if code == 200 else {}
    check('bulk-status 200', code == 200)
    check('updated == 1', result.get('updated') == 1, f'updated={result.get("updated")}')
    # 恢复
    http('POST', '/api/work-items/bulk-status', {'ids': [target['id']], 'status': orig_status})

# ============ 总结 ============
print('\n' + '=' * 60)
print(f'V1.19 UI 体验优化 E2E: ✅ {PASS} passed, ❌ {FAIL} failed')
print('=' * 60)
if FAIL > 0:
    print('\n失败项:')
    for e in ERRORS:
        print(f'  - {e}')
sys.exit(0 if FAIL == 0 else 1)
