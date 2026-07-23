#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V1.27 Bug 修复 E2E

- BUG1 (严重): PATCH /radas/work-items/:id 收到非法日期 (e.g. 'infinity') 导致 Prisma 报 Invalid Date → unhandled rejection → 进程崩溃
  修复: 整个端点 try-catch + 校验 isNaN(date) → 400
- BUG2 (中危): POST /api/webhooks/inbox/:token 任意 token 都接受 (TODO 留着的)
  修复: 校验 secret/id 匹配, 不匹配 → 401
- BUG3 (小): estimate 字段无上限 (接受 999999999)
  修复: 限制 0-10000 小时
- BUG4 (小): weekly-report / monthly-report 非法日期 → 500
  修复: 校验 startDate/endDate → 400
- BUG5: /imports/template/work-items (我之前 URL 写错, 正确名 work_items)
"""
import urllib.request
import urllib.error
import json
import sys

BASE = 'http://127.0.0.1:4000'

PASS = 0
FAIL = 0
ERRORS = []

def login():
    r = urllib.request.Request(BASE + '/api/users/login',
        data=json.dumps({'username':'admin','password':'admin123'}).encode(),
        headers={'Content-Type':'application/json'}, method='POST')
    with urllib.request.urlopen(r, timeout=60) as resp:
        return json.loads(resp.read().decode('utf-8'))['token']

def http(method, path, body=None, token=None, expect_status=None, accept_status=None, label=''):
    url = BASE + path
    headers = {}
    if token: headers['Authorization'] = 'Bearer ' + token
    data = json.dumps(body).encode() if body is not None else None
    if data: headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            code, txt = resp.status, resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        code, txt = e.code, e.read().decode('utf-8')
    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        # V1.27 修复: weekly-report/monthly-report 调 DeepSeek 可能慢, 视为超时 (500)
        code, txt = 500, f'TIMEOUT: {type(e).__name__}'
    ok = False
    if expect_status is not None: ok = (code == expect_status)
    if accept_status is not None: ok = (code in accept_status)
    mark = '✅' if ok else '❌'
    extra = f' (期望 {expect_status})' if expect_status else (f' (接受 {accept_status})' if accept_status else '')
    print(f'  {mark} [{code}] {label or path}{extra}', '|', txt[:120] if not ok else '')
    if not ok:
        global FAIL
        FAIL += 1
        ERRORS.append(label + f': got {code} expected {expect_status or accept_status} | ' + txt[:100])
    else:
        global PASS
        PASS += 1
    return code, txt

print('=' * 60)
print('V1.27 Bug 修复 E2E')
print('=' * 60)

token = login()
H = {'Authorization': 'Bearer ' + token}

# ========================================
# BUG1: PATCH 非法日期导致进程崩溃
# ========================================
print('\n【BUG1】PATCH 工作项 非法日期不应崩溃')
# 拿一个 task
code, body = http('GET', '/api/work-items?type=task&limit=1', token=token, expect_status=200)
items = json.loads(body) if code == 200 else []
if not items:
    print('  ❌ 无法获取 workItem 测试样本'); sys.exit(1)
target = items[0]
tid = target['id']

# 关键: 各种非法日期
http('PATCH', f'/api/work-items/{tid}', body={'planStart': 'infinity'}, token=token, expect_status=400, label='planStart=infinity')
http('PATCH', f'/api/work-items/{tid}', body={'planEnd': 'not-a-date'}, token=token, expect_status=400, label='planEnd=not-a-date')
http('PATCH', f'/api/work-items/{tid}', body={'actualStart': 'NaN'}, token=token, expect_status=400, label='actualStart=NaN')
http('PATCH', f'/api/work-items/{tid}', body={'actualEnd': 'undefined'}, token=token, expect_status=400, label='actualEnd=undefined')

# 合法日期仍 OK
http('PATCH', f'/api/work-items/{tid}', body={'planStart': '2026-12-01'}, token=token, expect_status=200, label='planStart=2026-12-01 (合法)')
http('PATCH', f'/api/work-items/{tid}', body={'planStart': None}, token=token, expect_status=200, label='planStart=null (清空)')

# 关键: 后端还活着 (即没崩溃)
code, body = http('GET', '/api/health', expect_status=200, label='后端 health (进程没崩)')

# ========================================
# BUG2: Webhook inbox 鉴权
# ========================================
print('\n【BUG2】POST /api/webhooks/inbox/:token 鉴权')

# 短 token (< 8 字符) → 401
http('POST', '/api/webhooks/inbox/ab', body={'e': 1}, token=token, expect_status=401, label='短 token (2 字符) → 401')

# 长度 OK 但不存在的 token → 401
http('POST', '/api/webhooks/inbox/nonexistent-token-but-long-enough-1234', body={'e': 1}, token=token, expect_status=401, label='不存在 token → 401')

# 创建 webhook config with secret
code, body = http('POST', '/api/webhooks/configs', body={
    'name': 'V1.27 测试 webhook',
    'url': 'https://example.com/hook',
    'events': 'workitem.created',
    'secret': 'test-secret-1234567890abcdef',
}, token=token, expect_status=201, label='创建 webhook config with secret')
cfg = json.loads(body) if code in [200, 201] else {}
secret = cfg.get('secret')
cid = cfg.get('id')

# 用真实 secret → 200
code, body = http('POST', '/api/webhooks/inbox/' + secret, body={'event': 'ping'}, token=token, expect_status=200, label='用真实 secret → 200 (含 configId)')

# 用 config id 当 token → 200 (cuid 长度 > 20)
code, body = http('POST', '/api/webhooks/inbox/' + cid, body={'event': 'ping'}, token=token, expect_status=200, label='用 config id → 200')

# 错 secret → 401
http('POST', '/api/webhooks/inbox/wrong-secret-but-long-enough-1234', body={}, token=token, expect_status=401, label='错 secret → 401')

# ========================================
# BUG3: estimate 范围
# ========================================
print('\n【BUG3】PATCH estimate 范围限制')

http('PATCH', f'/api/work-items/{tid}', body={'estimate': 999999999}, token=token, expect_status=400, label='estimate=999999999 (超 10000) → 400')
http('PATCH', f'/api/work-items/{tid}', body={'estimate': 10001}, token=token, expect_status=400, label='estimate=10001 (边界+1) → 400')
http('PATCH', f'/api/work-items/{tid}', body={'estimate': -1}, token=token, expect_status=400, label='estimate=-1 (负数) → 400')
http('PATCH', f'/api/work-items/{tid}', body={'estimate': 0}, token=token, expect_status=200, label='estimate=0 (合法) → 200')
http('PATCH', f'/api/work-items/{tid}', body={'estimate': 10000}, token=token, expect_status=200, label='estimate=10000 (边界) → 200')
http('PATCH', f'/api/work-items/{tid}', body={'estimate': None}, token=token, expect_status=200, label='estimate=null (清空) → 200')

# 同样适用于 actualHours
http('PATCH', f'/api/work-items/{tid}', body={'actualHours': 99999}, token=token, expect_status=400, label='actualHours=99999 (超 10000) → 400')
http('PATCH', f'/api/work-items/{tid}', body={'actualHours': 5.5}, token=token, expect_status=200, label='actualHours=5.5 (合法小数) → 200')

# 顺便: title/description 长度限制
http('PATCH', f'/api/work-items/{tid}', body={'title': 'X' * 500}, token=token, expect_status=400, label='title 500 字符 (超 200) → 400')
http('PATCH', f'/api/work-items/{tid}', body={'title': '正常标题'}, token=token, expect_status=200, label='title 正常 → 200')
http('PATCH', f'/api/work-items/{tid}', body={'description': 'X' * 20000}, token=token, expect_status=400, label='description 20000 字符 (超 10000) → 400')

# ========================================
# BUG4: AI 报告非法日期
# ========================================
print('\n【BUG4】AI 报告非法日期应返回 400 而非 500')
http('GET', '/api/ai-command/weekly-report?startDate=not-a-date&endDate=also-bad', token=token, expect_status=400, label='weekly-report 非法日期 → 400')
http('GET', '/api/ai-command/weekly-report?startDate=2020-01-01&endDate=2010-01-01', token=token, expect_status=400, label='weekly-report start>end → 400')
http('GET', '/api/ai-command/weekly-report?period=week', token=token, expect_status=200, label='weekly-report 正常 → 200')
http('GET', '/api/ai-command/weekly-report?startDate=2026-01-01&endDate=2026-12-31', token=token, expect_status=200, label='weekly-report 合法日期范围 → 200')

http('GET', '/api/ai-command/monthly-report?startDate=not-a-date', token=token, expect_status=400, label='monthly-report 非法日期 → 400')
http('GET', '/api/ai-command/monthly-report?startDate=2030-01-01&endDate=2020-01-01', token=token, expect_status=400, label='monthly-report start>end → 400')
http('GET', '/api/ai-command/monthly-report?period=month', token=token, expect_status=200, label='monthly-report 正常 → 200')

# 顺便: 关键 — 后端还活着
http('GET', '/api/health', expect_status=200, label='最终 health (确认进程没崩)')

# ========================================
# 验证代码改动到位
# ========================================
print('\n【代码审查】workItems.ts 关键改动')
with open('backend/src/routes/workItems.ts', 'r', encoding='utf-8') as f:
    src = f.read()
check = lambda n, c: (globals().__setitem__('PASS', globals()['PASS']+1) if c else (globals().__setitem__('FAIL', globals()['FAIL']+1), ERRORS.append(n)), print('  ✅ ' + n if c else '  ❌ ' + n))[1]
check('PATCH 端点 try-catch 包裹', 'try {' in src and 'catch (e: any)' in src)
check('parseDate 辅助函数', 'parseDate' in src)
check('isNaN(d.getTime()) 日期有效性校验', 'isNaN(d.getTime())' in src)
check('estimate 范围 0-10000', '0-10000' in src or '0 && estimate' in src or 'n < 0 || n > 10000' in src)
check('title 长度上限 200', 'title 长度不能超过 200' in src or 'title.length > 200' in src)
check('description 长度上限 10000', 'description.length > 10000' in src or 'description 长度不能超过 10000' in src)

print('\n【代码审查】webhooks.ts 关键改动')
with open('backend/src/routes/webhooks.ts', 'r', encoding='utf-8') as f:
    src = f.read()
check = lambda n, c: (globals().__setitem__('PASS', globals()['PASS']+1) if c else (globals().__setitem__('FAIL', globals()['FAIL']+1), ERRORS.append(n)), print('  ✅ ' + n if c else '  ❌ ' + n))[1]
check('inbox 校验 token 长度 >= 8', 'token.length < 8' in src)
check('查 WebhookConfig by secret OR id', 'secret: token' in src and 'id: token' in src)
check('不匹配返回 401', "status(401)" in src)
check('TODO 注释已删', 'TODO: token' not in src)

print('\n【代码审查】aiCommand.ts 关键改动')
with open('backend/src/routes/aiCommand.ts', 'r', encoding='utf-8') as f:
    src = f.read()
check = lambda n, c: (globals().__setitem__('PASS', globals()['PASS']+1) if c else (globals().__setitem__('FAIL', globals()['FAIL']+1), ERRORS.append(n)), print('  ✅ ' + n if c else '  ❌ ' + n))[1]
check('weekly-report 校验 startDate 格式', 'startDate 格式无效' in src)
check('weekly-report 校验 endDate 格式', 'endDate 格式无效' in src)
check('校验 startDate < endDate', 'startDate 必须早于 endDate' in src)
check('monthly-report 同样校验', src.count('startDate 格式无效') >= 2)

# Summary
print('\n' + '=' * 60)
print(f'PASS: {PASS}    FAIL: {FAIL}')
print('=' * 60)
if FAIL > 0:
    print('\n失败项:')
    for e in ERRORS:
        print('  - ' + e)
    sys.exit(1)
else:
    print('🎉 全部通过！')
    sys.exit(0)
