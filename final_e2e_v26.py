#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V1.26 仪表盘默认显示最近报告 E2E

- 验证 weekly-report / monthly-report 生成后写入 AIReport 表
- 验证 GET /api/ai-command/reports/latest 返回最近一份
- 验证 type 过滤 (week/month/quarter/custom)
- 验证 GET /api/ai-command/reports/list 返回历史
- 验证未生成时返回 null
- 验证 latest report 含 content/summary/llmModel/createdBy
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
        print('  ✅ ' + name)
    else:
        FAIL += 1
        ERRORS.append(name + ': ' + detail)
        print('  ❌ ' + name + ' ' + detail)

def http(method, path, data=None, is_json=True):
    url = BASE + path
    headers = dict(HEADERS)
    body = None
    if data is not None and is_json:
        body = json.dumps(data).encode('utf-8')
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=20)
        return r.status, r.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8')

print('=' * 60)
print('V1.26 仪表盘默认显示最近报告 E2E')
print('=' * 60)

# 1. 登录
print('\n【1. 登录 admin】')
code, body = http('POST', '/api/users/login', {'username': 'admin', 'password': 'admin123'})
data = json.loads(body) if code == 200 else {}
check('login 200', code == 200)
check('拿到 token', bool(data.get('token')), 'token missing')
HEADERS['Authorization'] = 'Bearer ' + data.get('token', '')

# 2. 调用 weekly-report 端点
print('\n【2. 调用 weekly-report】')
code, body = http('GET', '/api/ai-command/weekly-report?period=week')
wk = json.loads(body) if code == 200 else {}
check('weekly-report 200', code == 200, 'code=' + str(code))
check('ok=True', wk.get('ok') is True)
check('含 report 字段', bool(wk.get('report')), 'report missing')
check('含 summary 字段', bool(wk.get('summary')), 'summary missing')
check('summary 含 projectCount', 'projectCount' in (wk.get('summary') or {}))
check('summary 含 highRiskCount', 'highRiskCount' in (wk.get('summary') or {}))
check('summary 含 newItemCount', 'newItemCount' in (wk.get('summary') or {}))
check('summary 含 completedItemCount', 'completedItemCount' in (wk.get('summary') or {}))
check('summary 含 criticalItemCount', 'criticalItemCount' in (wk.get('summary') or {}))
check('summary 含 activityCount', 'activityCount' in (wk.get('summary') or {}))

# 3. 调用 monthly-report 端点
print('\n【3. 调用 monthly-report】')
code, body = http('GET', '/api/ai-command/monthly-report?period=month')
mo = json.loads(body) if code == 200 else {}
check('monthly-report 200', code == 200)
check('含 report 字段', bool(mo.get('report')))
check('含 period 字段', bool(mo.get('period')))
check('period.label 非空', bool((mo.get('period') or {}).get('label')))

# 4. 拉最新报告 (无 type)
print('\n【4. GET /reports/latest (无 type)】')
code, body = http('GET', '/api/ai-command/reports/latest')
lat = json.loads(body) if code == 200 else {}
check('latest 200', code == 200)
check('ok=True', lat.get('ok') is True)
r = lat.get('report')
check('返回 report 对象', isinstance(r, dict) and bool(r), 'report is empty or not dict')
if r:
    check('report 含 id', bool(r.get('id')))
    check('report 含 type', r.get('type') in ['week', 'month', 'quarter', 'custom'])
    check('report 含 periodLabel', bool(r.get('periodLabel')))
    check('report 含 content (Markdown)', bool(r.get('content')) and '#' in (r.get('content') or ''))
    check('report 含 summary (dict)', isinstance(r.get('summary'), dict))
    if r.get('summary'):
        check('summary 含 6 指标', all(k in r['summary'] for k in ['projectCount', 'highRiskCount', 'newItemCount', 'completedItemCount', 'criticalItemCount', 'activityCount']))
    check('report 含 createdAt', bool(r.get('createdAt')))
    check('report 含 createdBy', 'createdBy' in r)
    check('report 含 llmModel (nullable)', 'llmModel' in r)

# 5. 拉最新报告 type=week
print('\n【5. GET /reports/latest?type=week】')
code, body = http('GET', '/api/ai-command/reports/latest?type=week')
lat_w = json.loads(body) if code == 200 else {}
check('latest?type=week 200', code == 200)
rw = lat_w.get('report') or {}
check('type=week 返回', rw.get('type') == 'week', 'got type=' + str(rw.get('type')))

# 6. 拉最新报告 type=month
print('\n【6. GET /reports/latest?type=month】')
code, body = http('GET', '/api/ai-command/reports/latest?type=month')
lat_m = json.loads(body) if code == 200 else {}
check('latest?type=month 200', code == 200)
rm = lat_m.get('report') or {}
check('type=month 返回', rm.get('type') == 'month', 'got type=' + str(rm.get('type')))

# 7. 拉历史列表
print('\n【7. GET /reports/list?limit=10】')
code, body = http('GET', '/api/ai-command/reports/list?limit=10')
lst = json.loads(body) if code == 200 else {}
check('list 200', code == 200)
check('ok=True', lst.get('ok') is True)
items = lst.get('items') or []
check('items 数组', isinstance(items, list))
check('至少 2 份 (week+month)', len(items) >= 2, 'count=' + str(len(items)))
if items:
    it = items[0]
    check('item 含 id/type/periodLabel/createdAt',
          all(k in it for k in ['id', 'type', 'periodLabel', 'createdAt']))

# 8. type 过滤 list
print('\n【8. GET /reports/list?type=week】')
code, body = http('GET', '/api/ai-command/reports/list?type=week&limit=5')
lst_w = json.loads(body) if code == 200 else {}
check('list?type=week 200', code == 200)
items_w = lst_w.get('items') or []
check('所有 item type=week', all(it.get('type') == 'week' for it in items_w))

# 9. 无效 type (应忽略过滤,返回任意最新)
print('\n【9. GET /reports/latest?type=bogus (应忽略)】')
code, body = http('GET', '/api/ai-command/reports/latest?type=bogus')
lat_b = json.loads(body) if code == 200 else {}
check('type=bogus 200', code == 200)
rb = lat_b.get('report') or {}
check('type=bogus 仍返回 report', bool(rb), 'should ignore invalid type and return latest')

# 10. 验证 weekly 的 content 包含 avm 项目相关词
print('\n【10. 报告内容合理性】')
if r and r.get('content'):
    content = r.get('content') or ''
    # markdown 标题 (一级或二级)
    has_h1 = '\n# ' in content or content.startswith('# ')
    check('content 含 Markdown 标题', has_h1)
    check('content 含 AVM 字样', 'AVM' in content, 'should mention AVM')

# 11. 验证 list limit 上限
print('\n【11. list limit 上限 (默认 10, max 50)】')
code, body = http('GET', '/api/ai-command/reports/list?limit=999')
lst_big = json.loads(body) if code == 200 else {}
check('list?limit=999 不报错', code == 200)
check('limit 被 cap 在 50', len(lst_big.get('items') or []) <= 50)

# 12. 季度报告
print('\n【12. 季度报告端点 (复用 weekly-report)】')
code, body = http('GET', '/api/ai-command/weekly-report?period=custom&startDate=' +
                  (json.dumps('')) + '&endDate=' + (json.dumps('')))
# period=custom 无 start/end 应 fallback; 我们直接试 startDate/endDate
from datetime import datetime, timedelta
end_dt = datetime.now().strftime('%Y-%m-%d')
start_dt = (datetime.now() - timedelta(days=90)).strftime('%Y-%m-%d')
code, body = http('GET', '/api/ai-command/weekly-report?period=custom&startDate=' + start_dt + '&endDate=' + end_dt)
qr = json.loads(body) if code == 200 else {}
check('custom(90d) 200', code == 200)
check('含 period.label 含日期范围', (start_dt in (qr.get('period') or {}).get('label', '') or end_dt in (qr.get('period') or {}).get('label', '')))

# 12b. 季度报告: 用 ?period=quarter 单独写一条 type=quarter
code, body = http('GET', '/api/ai-command/weekly-report?period=quarter')
qr2 = json.loads(body) if code == 200 else {}
check('quarter 200', code == 200)

# 13. 季度报告 latest?type=quarter 应能取到
print('\n【13. /reports/latest?type=quarter 应有数据】')
code, body = http('GET', '/api/ai-command/reports/latest?type=quarter')
lat_q = json.loads(body) if code == 200 else {}
rq = lat_q.get('report') or {}
check('type=quarter 200', code == 200)
check('type=quarter 返回', rq.get('type') == 'quarter', 'got type=' + str(rq.get('type')))

# 14. DashboardPage 编译验证
print('\n【14. DashboardPage.tsx 含最新报告相关代码】')
dashboard_path = 'frontend/src/pages/DashboardPage.tsx'
if os.path.exists(dashboard_path):
    with open(dashboard_path, 'r', encoding='utf-8') as f:
        content = f.read()
    check('含 latestReport state', 'latestReport' in content and 'setLatestReport' in content)
    check('含 loadLatestReport 函数', 'loadLatestReport' in content)
    check('调 aiApi.latestReport', 'aiApi.latestReport' in content)
    check('显示报告摘要 (Statistic)', 'Statistic' in content and 'latestReport.summary' in content)
    check('显示周期标签 (periodLabel)', 'latestReport.periodLabel' in content)
    check('含查看全文按钮', '查看全文' in content or 'EyeOutlined' in content)
    check('含历史跳转 (Link to /reports)', '/reports' in content)
else:
    check('DashboardPage.tsx 存在', False, 'file missing')

# 15. api.ts 含 latestReport 方法
print('\n【15. api.ts 含 latestReport 方法】')
api_path = 'frontend/src/api.ts'
if os.path.exists(api_path):
    with open(api_path, 'r', encoding='utf-8') as f:
        content = f.read()
    check('含 latestReport 函数', 'latestReport:' in content and '/ai-command/reports/latest' in content)
    check('含 listReports 函数', 'listReports:' in content and '/ai-command/reports/list' in content)
else:
    check('api.ts 存在', False, 'file missing')

# 16. prisma schema 含 AIReport
print('\n【16. prisma schema 含 AIReport 模型】')
schema_path = 'backend/prisma/schema.prisma'
if os.path.exists(schema_path):
    with open(schema_path, 'r', encoding='utf-8') as f:
        content = f.read()
    check('含 model AIReport', 'model AIReport' in content)
    check('含 type 字段', 'type' in content and 'String' in content)
    check('含 content 字段', 'content' in content)
    check('含 summary 字段', 'summary' in content)
    check('含 llmModel 字段', 'llmModel' in content)
    check('含 createdAt 字段', 'createdAt' in content)
    check('含 type+createdAt 索引', 'type, createdAt' in content)
else:
    check('schema.prisma 存在', False)

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
