#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
V1.28 P0 全功能 E2E

- P0-1 键盘快捷键 (前端) — 检查 .tsx 文件含相关代码
- P0-2 工作量趋势图 — /api/work-items/:id/estimate-history
- P0-3 评论 reactions — /api/comments/:id/react
- P0-4 燃尽图 — /api/iterations/:id/burndown
- P0-5 依赖图谱 DAG — /api/work-items/:id/dependency-graph
- P0-6 客户/车型维度 — /api/meta/health?by=customer|carModel
- P0-7 迭代回顾 — /api/iterations/:id/retrospective
- pre-commit hook — scripts/check-missing-imports.cjs
"""
import urllib.request, urllib.error, json, sys, os

BASE = 'http://127.0.0.1:4000'
PASS = 0
FAIL = 0
ERRORS = []

def login():
    r = urllib.request.Request(BASE + '/api/users/login',
        data=json.dumps({'username':'admin','password':'admin123'}).encode(),
        headers={'Content-Type':'application/json'}, method='POST')
    with urllib.request.urlopen(r, timeout=10) as resp:
        return json.loads(resp.read().decode('utf-8'))['token']

def http(method, path, body=None, token=None, expect_status=None, accept_status=None, label=''):
    url = BASE + path
    headers = {}
    if token: headers['Authorization'] = 'Bearer ' + token
    data = json.dumps(body).encode() if body is not None else None
    if data: headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            code, txt = resp.status, resp.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        code, txt = e.code, e.read().decode('utf-8')
    ok = (expect_status is not None and code == expect_status) or (accept_status and code in accept_status)
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
print('V1.28 P0 全功能 E2E')
print('=' * 60)

token = login()

# 拿测试样本
code, body = http('GET', '/api/work-items?type=task&limit=1', token=token, expect_status=200)
items = json.loads(body) if code == 200 else []
if not items:
    print('❌ 无法获取 workItem 测试样本'); sys.exit(1)
target = items[0]
tid = target['id']
print(f'\n测试样本: {target["key"]} (id={tid[:15]}...)')

# 拿一个 comment (P0-3 reactions 测试用 — 自建一个新 comment 避免状态污染)
code, body = http('POST', '/api/comments', body={'workItemId': tid, 'content': 'E2E V1.28 reactions 测试', 'author': 'admin'}, token=token, expect_status=201)
new_comment = json.loads(body) if code == 201 else {}
comment_id = new_comment.get('id') if new_comment else None

# 拿一个 iteration
code, body = http('GET', '/api/iterations', token=token, expect_status=200)
iterations = json.loads(body) if code == 200 else []
iid = iterations[0]['id'] if iterations else None
print(f'测试迭代: {iterations[0]["name"] if iterations else "无"}')

# ========================================
# P0-2 工作量趋势图
# ========================================
print('\n【P0-2】工作量趋势图 /estimate-history')
code, body = http('GET', f'/api/work-items/{tid}/estimate-history', token=token, expect_status=200)
data = json.loads(body) if code == 200 else {}
check_data = data if code == 200 else {}
http('GET', f'/api/work-items/{tid}/estimate-history?depth=invalid', token=token, accept_status=[200, 400], label='非数字 depth 应忽略/400')
http('GET', f'/api/work-items/non-existent/estimate-history', token=token, expect_status=404, label='不存在 ID 404')
if check_data:
    check = lambda n, c: (globals().__setitem__('PASS', globals()['PASS']+1) if c else (globals().__setitem__('FAIL', globals()['FAIL']+1), ERRORS.append('P0-2 ' + n)), print('    ✅ ' + n if c else '    ❌ ' + n))[1]
    check('含 workItemId', check_data.get('workItemId') == tid)
    check('含 points 数组', isinstance(check_data.get('points'), list))
    check('points 至少 1 个起点', len(check_data.get('points', [])) >= 1)
    if check_data.get('points'):
        p0 = check_data['points'][0]
        check('point 含 date', 'date' in p0)
        check('point 含 estimate', 'estimate' in p0)
        check('point 含 actualHours', 'actualHours' in p0)
        check('point 含 action', 'action' in p0)

# ========================================
# P0-3 评论 reactions
# ========================================
print('\n【P0-3】评论 reactions /comments/:id/react')
if comment_id:
    # 加 reaction
    code, body = http('POST', f'/api/comments/{comment_id}/react', body={'emoji': '👍', 'user': 'admin'}, token=token, expect_status=200)
    r1 = json.loads(body) if code == 200 else {}
    check = lambda n, c: (globals().__setitem__('PASS', globals()['PASS']+1) if c else (globals().__setitem__('FAIL', globals()['FAIL']+1), ERRORS.append('P0-3 ' + n)), print('    ✅ ' + n if c else '    ❌ ' + n))[1]
    check('ok=True', r1.get('ok') is True)
    check('action=added', r1.get('action') == 'added')
    check('reactions 含 👍', '👍' in r1.get('reactions', {}))
    check('reactions.👍 含 admin', 'admin' in r1.get('reactions', {}).get('👍', []))
    # 再次点同一个 emoji → 取消
    code, body = http('POST', f'/api/comments/{comment_id}/react', body={'emoji': '👍', 'user': 'admin'}, token=token, expect_status=200)
    r2 = json.loads(body) if code == 200 else {}
    check('取消后 action=removed', r2.get('action') == 'removed')
    check('取消后 👍 不含 admin', 'admin' not in r2.get('reactions', {}).get('👍', []))
    # 不同 emoji 累加
    http('POST', f'/api/comments/{comment_id}/react', body={'emoji': '❤️', 'user': 'admin'}, token=token, expect_status=200)
    http('POST', f'/api/comments/{comment_id}/react', body={'emoji': '🎉', 'user': 'admin'}, token=token, expect_status=200)
    code, body = http('POST', f'/api/comments/{comment_id}/react', body={'emoji': '❤️', 'user': 'pm'}, token=token, expect_status=200)
    r3 = json.loads(body) if code == 200 else {}
    check('❤️ 含 2 人', len(r3.get('reactions', {}).get('❤️', [])) == 2)
    # 非法 emoji
    http('POST', f'/api/comments/{comment_id}/react', body={'emoji': '💩', 'user': 'admin'}, token=token, expect_status=400, label='非法 emoji → 400')
    http('POST', f'/api/comments/{comment_id}/react', body={'user': 'admin'}, token=token, expect_status=400, label='缺 emoji → 400')
    http('POST', f'/api/comments/non-existent/react', body={'emoji': '👍', 'user': 'admin'}, token=token, expect_status=404, label='不存在评论 → 404')
else:
    print('  ⚠️  无评论样本, 跳过部分测试')
    http('POST', '/api/comments/non-existent-id/react', body={'emoji': '👍', 'user': 'admin'}, token=token, expect_status=404)

# ========================================
# P0-4 燃尽图
# ========================================
print('\n【P0-4】燃尽图 /iterations/:id/burndown')
if iid:
    code, body = http('GET', f'/api/iterations/{iid}/burndown', token=token, expect_status=200)
    bd = json.loads(body) if code == 200 else {}
    check = lambda n, c: (globals().__setitem__('PASS', globals()['PASS']+1) if c else (globals().__setitem__('FAIL', globals()['FAIL']+1), ERRORS.append('P0-4 ' + n)), print('    ✅ ' + n if c else '    ❌ ' + n))[1]
    check('含 iteration', isinstance(bd.get('iteration'), dict))
    check('含 daily 数组', isinstance(bd.get('daily'), list))
    if bd.get('daily'):
        check('daily 第 1 项含 date', 'date' in bd['daily'][0])
        check('daily 含 plannedRemaining', 'plannedRemaining' in bd['daily'][0])
        check('daily 含 actualRemaining', 'actualRemaining' in bd['daily'][0])
        # planned 应该是单调递减 (理想线)
        vals = [d['plannedRemaining'] for d in bd['daily']]
        decreasing = all(vals[i] >= vals[i+1] for i in range(len(vals)-1))
        check('planned 理想线单调递减', decreasing)
    http('GET', f'/api/iterations/non-existent/burndown', token=token, expect_status=404)
else:
    print('  ⚠️  无迭代样本')

# ========================================
# P0-5 依赖图谱
# ========================================
print('\n【P0-5】依赖图谱 /work-items/:id/dependency-graph')
code, body = http('GET', f'/api/work-items/{tid}/dependency-graph?depth=2', token=token, expect_status=200)
dg = json.loads(body) if code == 200 else {}
check = lambda n, c: (globals().__setitem__('PASS', globals()['PASS']+1) if c else (globals().__setitem__('FAIL', globals()['FAIL']+1), ERRORS.append('P0-5 ' + n)), print('    ✅ ' + n if c else '    ❌ ' + n))[1]
check('含 rootId', dg.get('rootId') == tid)
check('含 nodes 数组', isinstance(dg.get('nodes'), list))
check('含 edges 数组', isinstance(dg.get('edges'), list))
check('nodes 至少 1 个 (root)', len(dg.get('nodes', [])) >= 1)
if dg.get('nodes'):
    n0 = dg['nodes'][0]
    check('node 含 id', 'id' in n0)
    check('node 含 key', 'key' in n0)
    check('node 含 title', 'title' in n0)
    check('node 含 status', 'status' in n0)
    check('node 含 type', 'type' in n0)
if dg.get('edges'):
    e0 = dg['edges'][0]
    check('edge 含 from', 'from' in e0)
    check('edge 含 to', 'to' in e0)
    check('edge 含 relationType', 'relationType' in e0)
http('GET', f'/api/work-items/{tid}/dependency-graph?depth=99', token=token, expect_status=200, label='depth 超过 6 自动 cap')
http('GET', '/api/work-items/non-existent/dependency-graph', token=token, expect_status=404)

# ========================================
# P0-6 客户/车型维度仪表盘
# ========================================
print('\n【P0-6】客户/车型维度 /meta/health')
code, body = http('GET', '/api/meta/health?by=customer', token=token, expect_status=200)
hc = json.loads(body) if code == 200 else {}
check = lambda n, c: (globals().__setitem__('PASS', globals()['PASS']+1) if c else (globals().__setitem__('FAIL', globals()['FAIL']+1), ERRORS.append('P0-6 ' + n)), print('    ✅ ' + n if c else '    ❌ ' + n))[1]
check('by=customer', hc.get('by') == 'customer')
check('含 items 数组', isinstance(hc.get('items'), list))
if hc.get('items'):
    it = hc['items'][0]
    check('item 含 name', 'name' in it)
    check('item 含 projectCount', 'projectCount' in it)
    check('item 含 workItemCount', 'workItemCount' in it)
    check('item 含 highRiskCount', 'highRiskCount' in it)

code, body = http('GET', '/api/meta/health?by=carModel', token=token, expect_status=200)
hm = json.loads(body) if code == 200 else {}
check('by=carModel', hm.get('by') == 'carModel')
check('含 items 数组 (carModel)', isinstance(hm.get('items'), list))

code, body = http('GET', '/api/meta/health?by=invalid', token=token, expect_status=400, label='by=invalid → 400')

# ========================================
# P0-7 迭代回顾
# ========================================
print('\n【P0-7】迭代回顾 /iterations/:id/retrospective')
if iid:
    code, body = http('GET', f'/api/iterations/{iid}/retrospective', token=token, expect_status=200)
    re_data = json.loads(body) if code == 200 else {}
    check = lambda n, c: (globals().__setitem__('PASS', globals()['PASS']+1) if c else (globals().__setitem__('FAIL', globals()['FAIL']+1), ERRORS.append('P0-7 ' + n)), print('    ✅ ' + n if c else '    ❌ ' + n))[1]
    check('含 iteration', isinstance(re_data.get('iteration'), dict))
    check('含 summary', isinstance(re_data.get('summary'), dict))
    if re_data.get('summary'):
        check('summary 含 totalItems', 'totalItems' in re_data['summary'])
        check('summary 含 doneCount', 'doneCount' in re_data['summary'])
        check('summary 含 overdueCount', 'overdueCount' in re_data['summary'])
        check('summary 含 completionRate', 'completionRate' in re_data['summary'])
    check('含 byAssignee', isinstance(re_data.get('byAssignee'), dict))
    check('含 byType', isinstance(re_data.get('byType'), dict))
    check('含 report (Markdown)', isinstance(re_data.get('report'), str) and len(re_data.get('report', '')) > 100)
    if re_data.get('report'):
        check('report 含 # 标题', '\n# ' in re_data['report'] or re_data['report'].startswith('# '))
        check('report 含完成率', '完成率' in re_data['report'] or '完成' in re_data['report'])
        check('report 含表格', '|' in re_data['report'])
    http('GET', '/api/iterations/non-existent/retrospective', token=token, expect_status=404)
else:
    print('  ⚠️  无迭代样本')

# ========================================
# pre-commit hook 验证
# ========================================
print('\n【pre-commit】scripts/check-missing-imports.cjs')
import subprocess
r = subprocess.run(['node', 'frontend/scripts/check-missing-imports.cjs'], capture_output=True, text=True, timeout=30)
check = lambda n, c: (globals().__setitem__('PASS', globals()['PASS']+1) if c else (globals().__setitem__('FAIL', globals()['FAIL']+1), ERRORS.append('pre-commit ' + n)), print('    ✅ ' + n if c else '    ❌ ' + n))[1]
check('脚本存在', os.path.exists('frontend/scripts/check-missing-imports.cjs'))
check('退出码 0', r.returncode == 0)
check('输出含 ✅', '✅' in r.stdout)
check('.githooks/pre-commit 存在', os.path.exists('.githooks/pre-commit'))
check('package.json 含 lint script', '"lint"' in open('frontend/package.json').read())

# ========================================
# 前端组件存在性 + esbuild 编译通过
# ========================================
print('\n【前端】7 个 P0 组件 + 集成')
def check_file(label, path, must_contain=[]):
    if not os.path.exists(path):
        check(f'{label} 存在', False, f'文件不存在: {path}')
        return
    content = open(path, 'r', encoding='utf-8').read()
    for kw in must_contain:
        check(f'{label} 含 {kw!r}', kw in content)

check_file('WorkloadTrend', 'frontend/src/components/WorkloadTrend.tsx', ['estimateHistory', 'ReactECharts'])
check_file('DependencyGraph', 'frontend/src/components/DependencyGraph.tsx', ['dependency-graph', 'force'])
check_file('BurndownChart', 'frontend/src/components/BurndownChart.tsx', ['burndown', 'ReactECharts'])
check_file('App.tsx 键盘快捷键', 'frontend/src/App.tsx', ['keydown', 'g d', 'g w', 'setHelpOpen', 'Modal'])
check_file('GanttPage.tsx retrospective', 'frontend/src/pages/GanttPage.tsx', ['retrospective', 'openRetrospective', 'downloadRetro'])
check_file('DashboardPage 健康度维度', 'frontend/src/pages/DashboardPage.tsx', ['HealthDimensionCard', 'metaApi.health'])
check_file('WorkItemDetailPage reactions', 'frontend/src/pages/WorkItemDetailPage.tsx', ['CommentReactions', 'REACTION_EMOJIS', 'commentApi.react'])

# esbuild 编译
print('\n【esbuild】7 个核心 .tsx 编译')
r = subprocess.run(['node', '-e', '''
const esbuild = require("esbuild");
const fs = require("fs");
const files = [
  "src/components/WorkloadTrend.tsx",
  "src/components/DependencyGraph.tsx",
  "src/components/BurndownChart.tsx",
  "src/pages/GanttPage.tsx",
  "src/pages/DashboardPage.tsx",
  "src/pages/WorkItemDetailPage.tsx",
  "src/App.tsx",
];
let ok = true;
for (const f of files) {
  try {
    esbuild.transformSync(fs.readFileSync(f, "utf-8"), { loader: "tsx", sourcefile: f });
  } catch (e) {
    console.log("ERR", f, e.message);
    ok = false;
  }
}
process.exit(ok ? 0 : 1);
'''], capture_output=True, text=True, cwd='frontend', timeout=30)
check('esbuild 7 个文件全部编译通过', r.returncode == 0)

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
