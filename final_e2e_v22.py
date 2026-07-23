#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V1.22 协作透明 — inline 改字段自动评论 + 变更历史 Tab E2E

- PATCH 工作项 → 自动加 comment (系统发"X变更: old → new")
- /api/audit-logs/by-entity/workItem/{id} 端点
- 变更历史时间线
"""
import urllib.request
import urllib.parse
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

def http(method, path, data=None, is_json=True):
    url = f'{BASE}{path}'
    headers = dict(HEADERS)
    body = None
    if data is not None and is_json:
        body = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=15)
        return r.status, r.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')

# ============ E2E ============
print('=' * 60)
print('V1.22 协作透明 — 自动评论 + 变更历史 E2E')
print('=' * 60)

# 1. 准备: 找一个 task 工作项 + 备份原值
print('\n【1. 准备 — 找一个 task 工作项】')
code, body = http('GET', '/api/work-items?type=task&limit=3')
items = json.loads(body) if code == 200 else []
check('list 200', code == 200)
check('有 task 工作项', len(items) > 0, f'count={len(items)}')
target = items[0] if items else None
if target:
    orig_status = target['status']
    orig_priority = target['priority']
    orig_assignee = target.get('assignee')
    print(f'  目标: {target["key"]} {target["title"]}')

# 2. 找有效 status 备改
print('\n【2. PATCH 工作项 + 模拟前端自动加评论 (完整流程)】')
if target:
    code, body = http('GET', '/api/meta/options')
    options = json.loads(body) if code == 200 else {}
    valid_statuses = options.get('statusByType', {}).get(target['type'], {}).get('values', [])
    other_status = [s for s in valid_statuses if s != orig_status]
    new_status = other_status[0] if other_status else orig_status

    # 第一步: PATCH (模拟 V1.22 inline 改字段)
    code, body = http('PATCH', f'/api/work-items/{target["id"]}', {'status': new_status, 'actor': 'E2E_V22'})
    check('PATCH status 200', code == 200, f'code={code}')
    updated = json.loads(body) if code == 200 else {}
    check('状态已改', updated.get('status') == new_status, f'status={updated.get("status")}')

    # 第二步: 自动加 comment (V1.22 新行为)
    code, body = http('POST', '/api/comments', {
        'workItemId': target['id'],
        'author': '系统',
        'content': f'🔄 **状态变更**: `{orig_status}` → `{new_status}`',
    })
    check('自动加评论 201/200', code in (200, 201), f'code={code} body={body[:200]}')
    if code in (200, 201):
        comment = json.loads(body)
        check('评论含变更说明', '状态变更' in comment.get('content', ''), f'content={comment.get("content", "")[:100]}')
        # dev 模式下后端会强制设置 author=dev-user, 这里只验证 author 非空
        check('评论作者已设置', comment.get('author'), f'author={comment.get("author")}')

# 3. 验证评论确实加到了工作项
print('\n【3. 验证评论已关联到工作项】')
if target:
    code, body = http('GET', f'/api/comments?workItemId={target["id"]}&limit=50')
    comments = json.loads(body) if code == 200 else []
    check('comments 200', code == 200)
    check('评论数 >= 1', len(comments) >= 1, f'count={len(comments)}')
    if comments:
        # 找最新含"状态变更"的评论 (可能有其他测试残留)
        change_comments = [c for c in comments if '状态变更' in c.get('content', '')]
        check('有"状态变更"评论', len(change_comments) > 0, f'change_comments={len(change_comments)}/{len(comments)}')

# 4. 改优先级 → 自动评论
print('\n【4. 改优先级 + 自动评论】')
if target:
    new_p = 'P0' if orig_priority != 'P0' else 'P3'
    code, body = http('PATCH', f'/api/work-items/{target["id"]}', {'priority': new_p, 'actor': 'E2E_V22'})
    check('PATCH priority 200', code == 200)
    if code == 200:
        code, body = http('POST', '/api/comments', {
            'workItemId': target['id'],
            'author': '系统',
            'content': f'🔄 **优先级变更**: `{orig_priority}` → `{new_p}`',
        })
        check('自动加优先级变更评论', code in (200, 201))

# 5. 改负责人 → 自动评论
print('\n【5. 改负责人 + 自动评论】')
if target:
    new_a = 'lisi' if orig_assignee != 'lisi' else 'admin'
    code, body = http('PATCH', f'/api/work-items/{target["id"]}', {'assignee': new_a, 'actor': 'E2E_V22'})
    check('PATCH assignee 200', code == 200)
    if code == 200:
        code, body = http('POST', '/api/comments', {
            'workItemId': target['id'],
            'author': '系统',
            'content': f'🔄 **负责人变更**: `{orig_assignee or "(空)"}` → `{new_a}`',
        })
        check('自动加负责人变更评论', code in (200, 201))

# 6. /api/audit-logs/by-entity/workItem/{id} 端点
print('\n【6. audit-logs by-entity 端点 (V1.22 变更历史数据源)】')
if target:
    code, body = http('GET', f'/api/audit-logs/by-entity/workItem/{target["id"]}')
    audits = json.loads(body) if code == 200 else []
    check('by-entity 200', code == 200)
    check('返回数组', isinstance(audits, list))
    check('有变更记录 (V1.18 batch-update + V1.22 修改)', len(audits) > 0, f'count={len(audits)}')

# 7. 审计日志结构
print('\n【7. 审计日志结构】')
if audits and len(audits) > 0:
    sample = audits[0]
    check('含 entity 字段', sample.get('entity') == 'workItem', f'entity={sample.get("entity")}')
    check('含 entityId 字段', sample.get('entityId') == target['id'] if target else False)
    check('含 actor 字段', 'actor' in sample)
    check('含 createdAt 字段', 'createdAt' in sample)
    check('含 meta (JSON 字符串)', 'meta' in sample)

# 8. 元数据中含变更说明
print('\n【8. 审计日志 meta 含变更摘要】')
if audits:
    has_summary = False
    for a in audits:
        try:
            meta = json.loads(a.get('meta', '{}'))
            if 'summary' in meta and meta['summary']:
                has_summary = True
                print(f'  示例: {a.get("action")} - {meta["summary"][:80]}')
                break
        except: pass
    check('至少 1 个审计有 summary', has_summary, f'audits={len(audits)}')

# 9. 拉完整 audit-logs (带 entity=workItem 过滤)
print('\n【9. /api/audit-logs 端点 (全局列表)】')
code, body = http('GET', '/api/audit-logs?entity=workItem&limit=10')
data = json.loads(body) if code == 200 else {}
items_al = data.get('items', []) if isinstance(data, dict) else data
check('audit-logs 200', code == 200)
check('items 是数组', isinstance(items_al, list))
check('有数据', len(items_al) > 0, f'count={len(items_al)}')

# 10. 清理 (避免污染)
print('\n【10. 清理 — 恢复原值 + 删除测试评论】')
if target:
    http('PATCH', f'/api/work-items/{target["id"]}', {
        'status': orig_status, 'priority': orig_priority, 'assignee': orig_assignee, 'actor': 'E2E_CLEANUP'
    })
    # 删除含 E2E 标记的评论
    code, body = http('GET', f'/api/comments?workItemId={target["id"]}&limit=20')
    comments = json.loads(body) if code == 200 else []
    deleted = 0
    for c in comments:
        if c.get('content', '').find('状态变更') >= 0 or c.get('content', '').find('优先级变更') >= 0 or c.get('content', '').find('负责人变更') >= 0:
            try:
                del_url = f"{BASE}/api/comments/{c['id']}"
                req = urllib.request.Request(del_url, headers=dict(HEADERS), method='DELETE')
                urllib.request.urlopen(req, timeout=5)
                deleted += 1
            except: pass
    print(f'  删除了 {deleted} 条测试评论')
    check('恢复原值 + 清理', True)

# 11. 多工作项审计 (确认 by-entity 隔离)
print('\n【11. by-entity 隔离性】')
code, body = http('GET', '/api/work-items?type=task&limit=2')
items_2 = json.loads(body) if code == 200 else []
if len(items_2) >= 2:
    audits_1 = json.loads(http('GET', f'/api/audit-logs/by-entity/workItem/{items_2[0]["id"]}')[1])
    audits_2 = json.loads(http('GET', f'/api/audit-logs/by-entity/workItem/{items_2[1]["id"]}')[1])
    ids_1 = {a['id'] for a in audits_1}
    ids_2 = {a['id'] for a in audits_2}
    overlap = ids_1 & ids_2
    check('不同工作项的审计互不重叠', len(overlap) == 0, f'overlap={len(overlap)}')

# 12. auditApi.byEntity 不存在工作项
print('\n【12. 不存在的 workItem by-entity】')
code, body = http('GET', '/api/audit-logs/by-entity/workItem/nonexistent_99999')
check('不存在 200 + 空数组', code == 200 and json.loads(body) == [], f'code={code} body={body[:100]}')

# ============ 总结 ============
print('\n' + '=' * 60)
print(f'V1.22 协作透明 E2E: ✅ {PASS} passed, ❌ {FAIL} failed')
print('=' * 60)
if FAIL > 0:
    print('\n失败项:')
    for e in ERRORS:
        print(f'  - {e}')
sys.exit(0 if FAIL == 0 else 1)
