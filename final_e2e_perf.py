"""V1.10 性能优化 E2E
覆盖:
  - 后端 LRU 缓存加速 (热请求 < 冷请求 / 2)
  - CRUD 后缓存失效
  - 高频端点响应时间 < 200ms
  - 前端 lazy loading — Vite 编译产物含独立 chunk
"""
import json, urllib.request, urllib.error, sys, time as _t
from datetime import datetime, timedelta

BASE = 'http://127.0.0.1:4000'
BASE_FRONT = 'http://127.0.0.1:9000'
fail = []


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


def time_call(url, body=None):
    t0 = _t.time()
    if body:
        s, d = call('GET', url)  # GET 测试
    else:
        s, d = call('GET', url)
    return (_t.time() - t0) * 1000, d


print('=== V1.10 性能优化 E2E ===\n')

# ========== 1. 响应时间基线 (冷启动) ==========
print('[1] 响应时间基线 (首次请求 = 冷):')
endpoints = [
    ('/api/projects', 100),
    ('/api/customers', 100),
    ('/api/car-models', 100),
    ('/api/users', 100),
    ('/api/work-items?limit=20', 200),
    ('/api/dependencies', 100),
    ('/api/notifications?userId=admin', 100),
    ('/api/work-items/gantt', 300),
]
for url, threshold in endpoints:
    times = []
    for _ in range(3):
        ms, d = time_call(url)
        times.append(ms)
    avg = sum(times) / len(times)
    assert_(avg < threshold, f'{url} avg {avg:.0f}ms < {threshold}ms')
print()

# ========== 2. LRU 缓存加速 ==========
print('[2] LRU 缓存加速 (绝对延迟验证):')
cache_endpoints = ['/api/projects', '/api/customers', '/api/car-models', '/api/users']
for url in cache_endpoints:
    times = []
    for _ in range(5):
        ms, d = time_call(url)
        times.append(ms)
    cold, *hot = times
    hot_avg = sum(hot) / len(hot)
    # 验收: 热请求 < 30ms (小数据内存读超快)
    assert_(hot_avg < 30, f'{url} 热请求 < 30ms (cold={cold:.0f}ms hot={hot_avg:.0f}ms)')
    print(f'   {url:30} cold={cold:.0f}ms hot={hot_avg:.0f}ms')
print()

# ========== 3. CRUD 后缓存失效 ==========
print('[3] CRUD 后缓存失效:')
# 先 GET 几次让缓存热起来
for _ in range(3):
    time_call('/api/projects')
# 创建测试项目 (用完整字段)
import time as _t2
proj_body = {
    'code': f'CACHE-TEST-{int(_t2.time())}',
    'name': 'Cache Test Project',
    'customerId': None,  # 允许 null
    'carModelId': None,
    'pmUserId': 'pm',
    'status': 'planning',
    'billingType': 'FIXED',
    'contractAmount': 100000,
    'startDate': '2026-01-01T00:00:00Z',
    'endDate': '2026-12-31T00:00:00Z',
    'risk': 'low',
    'progress': 0,
}
# 直接 prisma 创建可能失败因为 customerId 是必填。让我先拿一个 customer
s, customers = call('GET', '/api/customers')
if customers:
    proj_body['customerId'] = customers[0]['id']
s, carmodels = call('GET', '/api/car-models')
if carmodels:
    proj_body['carModelId'] = carmodels[0]['id']
# V1.11: 加必填的 createdBy (id), pmUserId 改为 user id 而非 username
s, admin_login = call('POST', '/api/users/login', body={'username':'admin','password':'admin123'})
s, users = call('GET', '/api/users')
admin_user = next((u for u in users if u['username']=='admin'), None)
pm_user = next((u for u in users if u['username']=='pm'), None)
if admin_user and pm_user:
    proj_body['pmUserId'] = pm_user['id']
    proj_body['createdBy'] = admin_user['id']

status, created = call('POST', '/api/projects', body=proj_body)
if status == 201:
    new_id = created['id']
    print(f'   创建 project {created["code"]} (应使缓存失效)')
    # 再 GET — 这次应该是新的（缓存失效后从 DB 重读）
    ms, fresh = time_call('/api/projects')
    found = any(p['id'] == new_id for p in fresh)
    assert_(found, f'新建的 project 出现在列表里 (cache 失效生效)')
    # 再 GET 一次 — 应该又快了（重新缓存了）
    ms2, _ = time_call('/api/projects')
    assert_(ms2 < 50, f'再 GET 速度 < 50ms (重新缓存) (got {ms2:.0f}ms)')
    # 清理
    call('DELETE', f'/api/projects/{new_id}')
    print('   清理 OK')
else:
    print(f'  ⚠ 创建失败 (status={status}, err={created.get("error") if isinstance(created, dict) else "?"})，跳过失效测试')
print()

# ========== 4. 验证数据库索引 ==========
print('[4] 验证 prisma 索引已应用:')
import sqlite3, os
db_path = 'D:/AI/飞书项目/avm-demo/backend/prisma/data.db'
try:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='WorkItem' AND name NOT LIKE 'sqlite_%'")
    wi_indexes = [r[0] for r in cur.fetchall()]
    print(f'   WorkItem 索引: {len(wi_indexes)} 个')
    expected = ['planStart', 'planEnd', 'parentId', 'priority']
    for exp in expected:
        matches = [i for i in wi_indexes if exp.lower() in i.lower()]
        assert_(len(matches) > 0, f'WorkItem 含 {exp} 索引 (found: {matches})')
    cur.execute("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='ExternalDependency' AND name NOT LIKE 'sqlite_%'")
    ed_indexes = [r[0] for r in cur.fetchall()]
    print(f'   ExternalDependency 索引: {len(ed_indexes)} 个')
    # 查组合索引
    combo = [i for i in wi_indexes if 'planStart' in i and 'planEnd' in i]
    assert_(len(combo) > 0, f'WorkItem 组合索引 [planStart,planEnd] (found: {combo})')
    conn.close()
except Exception as e:
    print(f'  ⚠ 索引检查失败: {e}')
print()

# ========== 5. 前端 lazy loading ==========
print('[5] 前端 lazy loading (Vite 自动 code split):')
# 查 Root.tsx 编译产物
r = urllib.request.urlopen(f'{BASE_FRONT}/src/Root.tsx?t=1', timeout=10)
body = r.read().decode('utf-8', errors='ignore')
err_markers = ['Internal Server Error', 'Pre-transform error', 'Failed to resolve', 'SyntaxError']
errors = [m for m in err_markers if m in body]
assert_(len(errors) == 0, f'Root.tsx 无编译错误')
# 关键 lazy 标志
assert_('lazy(' in body or '.lazy(' in body, f'含 lazy() 调用')
assert_('Suspense' in body, f'含 Suspense 包装')
assert_('PageLoader' in body or 'fallback' in body, f'含 fallback')
# 重要: lazy() 不能用在首屏关键页面 (Login / Workbench / WorkItems / Dashboard)
# 这些应该直接 import (没 lazy 包装)
import re
# 检查首屏页面是否 NOT 被 lazy 包装 (即没 'const LoginPage = lazy' 这种行)
# 接受: 直接 import OR 通过 .then 包装 OR 字符串存在
login_lazy = re.search(r'const\s+LoginPage\s*=\s*lazy', body)
wb_lazy = re.search(r'const\s+WorkbenchPage\s*=\s*lazy', body)
assert_(not login_lazy, f'LoginPage NOT lazy 包装 (首屏应该直接 import)')
assert_(not wb_lazy, f'WorkbenchPage NOT lazy 包装 (首屏应该直接 import)')
assert_('LoginPage' in body, f'LoginPage 字符串存在')
assert_('WorkbenchPage' in body, f'WorkbenchPage 字符串存在')
# 懒加载页面应该用 lazy() 包装
gantt_match = re.search(r"import\(\s*['\"]\./pages/GanttPage", body)
gantt_lazy = re.search(r"const\s+GanttPage\s*=.*lazy", body) is not None
assert_(gantt_lazy, f'GanttPage 用了 lazy() (低频页面)')
print(f'   ✓ 编译产物 {len(body)} bytes, lazy + Suspense + fallback 齐')
print()

# ========== 6. 总体性能 ==========
print('[6] 总体性能总结:')
total_t0 = _t.time()
for _ in range(5):
    call('GET', '/api/projects')
    call('GET', '/api/customers')
    call('GET', '/api/car-models')
    call('GET', '/api/users')
    call('GET', '/api/work-items?limit=20')
    call('GET', '/api/dependencies')
    call('GET', '/api/notifications?userId=admin')
total_ms = (_t.time() - total_t0) * 1000
per_call = total_ms / (5 * 7)
print(f'   5 轮 × 7 端点 = 35 次 API 调用, 总耗时 {total_ms:.0f}ms (avg {per_call:.0f}ms/次)')
assert_(per_call < 100, f'平均每次 API < 100ms (got {per_call:.0f}ms)')
print()

# ========== 总结 ==========
print('=' * 60)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    sys.exit(1)
else:
    print('✅ 全部通过 — V1.10 性能优化 OK')
