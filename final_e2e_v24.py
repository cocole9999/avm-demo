#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V1.24 评论快捷模板 + emoji E2E

- 评论支持 emoji 和中文字符 (UTF-8 完整支持)
- 模板文案能完整保存到 DB
- 多种 emoji 长度测试
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
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
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

print('=' * 60)
print('V1.24 评论 emoji + 模板 E2E')
print('=' * 60)

# 1. 准备
print('\n【1. 准备 — 找一个工作项】')
code, body = http('GET', '/api/work-items?type=task&limit=1')
items = json.loads(body) if code == 200 else []
target = items[0] if items else None
check('list 200', code == 200)
check('有工作项', target is not None)
if target:
    print(f'  目标: {target["key"]} {target["title"]}')

# 2. 模板评论 1: "已修复 ✅"
print('\n【2. 模板 "已修复 ✅"】')
if target:
    code, body = http('POST', '/api/comments', {
        'workItemId': target['id'],
        'content': '已修复 ✅',
    })
    c = json.loads(body) if code in (200, 201) else {}
    check('评论创建 201', code in (200, 201), f'code={code}')
    check('内容含 emoji', '✅' in c.get('content', ''), f'content={c.get("content")}')

# 3. 模板评论 2: "等 review"
print('\n【3. 模板 "等 review"】')
if target:
    code, body = http('POST', '/api/comments', {
        'workItemId': target['id'],
        'content': '等 review @admin 👀',
    })
    c = json.loads(body) if code in (200, 201) else {}
    check('评论含多个 emoji', '👀' in c.get('content', '') and 'review' in c.get('content', ''), f'content={c.get("content")}')

# 4. 多 emoji 长内容
print('\n【4. 长内容 + 多 emoji + 模板】')
if target:
    long_content = '''V1.24 模板测试 🎉
- 已修复 ✅
- 已合并 🚀
- @张三 👀 请 review
- 进度 80% 💪'''
    code, body = http('POST', '/api/comments', {
        'workItemId': target['id'],
        'content': long_content,
    })
    c = json.loads(body) if code in (200, 201) else {}
    check('长评论创建', code in (200, 201))
    check('内容完整保存 (含所有 emoji)', c.get('content', '') == long_content, f'len={len(c.get("content", ""))}/{len(long_content)}')

# 5. 纯 emoji
print('\n【5. 纯 emoji 评论】')
if target:
    code, body = http('POST', '/api/comments', {
        'workItemId': target['id'],
        'content': '👍👍👍',
    })
    c = json.loads(body) if code in (200, 201) else {}
    check('纯 emoji 评论', code in (200, 201))
    check('emoji 完整保存', c.get('content', '') == '👍👍👍', f'content={c.get("content")}')

# 6. 拉评论确认所有 emoji 都正常返回
print('\n【6. 拉评论确认 emoji 完整】')
if target:
    code, body = http('GET', f'/api/comments?workItemId={target["id"]}&limit=200')
    comments = json.loads(body) if code == 200 else []
    v124 = [c for c in comments if 'V1.24' in c.get('content', '') or '已修复' in c.get('content', '') or '等 review' in c.get('content', '') or '👍👍👍' in c.get('content', '')]
    check('GET 200', code == 200)
    check('V1.24 测试评论 >= 4', len(v124) >= 4, f'count={len(v124)}')
    for c in v124[:3]:
        print(f'  示例: {c["content"][:60]}')

# 7. 清理
print('\n【7. 清理 V1.24 测试评论】')
if target:
    code, body = http('GET', f'/api/comments?workItemId={target["id"]}&limit=200')
    comments = json.loads(body) if code == 200 else []
    v124 = [c for c in comments if 'V1.24' in c.get('content', '') or '已修复' in c.get('content', '') or '等 review' in c.get('content', '') or '👍👍👍' in c.get('content', '')]
    deleted = 0
    for c in v124:
        try:
            del_url = f"{BASE}/api/comments/{c['id']}"
            req = urllib.request.Request(del_url, headers=dict(HEADERS), method='DELETE')
            urllib.request.urlopen(req, timeout=5)
            deleted += 1
        except: pass
    print(f'  删除了 {deleted} 条 V1.24 测试评论')

# ============ 总结 ============
print('\n' + '=' * 60)
print(f'V1.24 评论 emoji + 模板 E2E: ✅ {PASS} passed, ❌ {FAIL} failed')
print('=' * 60)
if FAIL > 0:
    print('\n失败项:')
    for e in ERRORS:
        print(f'  - {e}')
sys.exit(0 if FAIL == 0 else 1)
