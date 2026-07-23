"""V1.8.2 E2E: AI 表单辅助扩展 + 风险一键跟进
覆盖: fill-form (customer/car_model/project/flow) + create-follow-up
"""
import json
import urllib.request
import urllib.error
import sqlite3
import sys
import time as _t

BASE = 'http://127.0.0.1:4000'
DB_PATH = r'D:\AI\飞书项目\avm-demo\backend\prisma\data.db'
TEST_TAG = 'V182_E2E'
fail = []

def call(method, path, body=None, timeout=180, retries=2, expect_400=False, expect_404=False):
    h = {'Content-Type': 'application/json; charset=utf-8'}
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    last_err = None
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(f'{BASE}{path}', method=method, data=data, headers=h)
            return json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8'))
        except urllib.error.HTTPError as e:
            if e.code == 400 and expect_400:
                return json.loads(e.read().decode('utf-8'))
            if e.code == 404 and expect_404:
                return json.loads(e.read().decode('utf-8'))
            last_err = e
            if i < retries:
                print(f'   [retry {i+1}/{retries}] {method} {path} failed: {type(e).__name__}: {e}')
                _t.sleep(3)
        except Exception as e:
            last_err = e
            if i < retries:
                print(f'   [retry {i+1}/{retries}] {method} {path} failed: {type(e).__name__}: {e}')
                _t.sleep(3)
    raise last_err

def assert_(cond, msg):
    if not cond:
        fail.append(msg)
        print(f'  ❌ {msg}')
    else:
        print(f'  ✓ {msg}')

def db_query(sql, params=()):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute(sql, params)
    rows = cur.fetchall()
    conn.close()
    return rows

print('=== V1.8.2 AI 表单辅助 + 风险一键跟进 E2E ===\n')

# 前置
print('⏳ 等待 65s 跳过 startup 风险扫描 + LLM cache 过期...')
_t.sleep(65)
call('POST', '/api/llm-settings/deepseek/switch-model', {'model': 'deepseek-v4-pro'})

# 1. fill-form customer
print('[1] fill-form customer:')
r = call('POST', '/api/ai-command/fill-form', {
    'formType': 'customer',
    'name': f'{TEST_TAG} 长安启源项目组',
    'hint': '汽车主机厂，重庆',
})
assert_(r.get('ok'), f'fill-form customer ok (got {r.get("ok")})')
if r.get('ok'):
    f = r.get('filled', {})
    assert_(f.get('name') and TEST_TAG in f.get('name', ''), f'name 包含 TEST_TAG (got {f.get("name")})')
    assert_(f.get('type') in ('internal', 'external'), f'type 有效 (got {f.get("type")})')
    assert_(f.get('industry'), f'industry 必填 (got {f.get("industry")})')
print()

# 2. fill-form car_model
print('[2] fill-form car_model:')
r = call('POST', '/api/ai-command/fill-form', {
    'formType': 'car_model',
    'name': f'{TEST_TAG} 启源 A07',
    'brand': '长安启源',
})
assert_(r.get('ok'), f'fill-form car_model ok (got {r.get("ok")})')
if r.get('ok'):
    f = r.get('filled', {})
    assert_(f.get('brand'), f'brand 必填 (got {f.get("brand")})')
    # launchYear 是可选字段，LLM 不一定填
    ly = f.get('launchYear')
    if ly is not None:
        assert_(isinstance(ly, int), f'launchYear 是数字 (got {ly})')
    else:
        print('  ⚠ launchYear 字段为 None (LLM 跳过可选字段，正常)')
print()

# 3. fill-form project
print('[3] fill-form project (用真实客户/车型):')
r = call('POST', '/api/ai-command/fill-form', {
    'formType': 'project',
    'name': f'{TEST_TAG} AVM 集成测试项目',
    'customerCode': 'GEELY-GALAXY-L7',
    'carModelCode': 'GALAXY-L7',
})
assert_(r.get('ok'), f'fill-form project ok (got {r.get("ok")})')
if r.get('ok'):
    f = r.get('filled', {})
    assert_(f.get('startDate') and f.get('endDate'), f'起止日期都有 (got {f.get("startDate")} → {f.get("endDate")})')
    assert_(f.get('contractAmount') and f.get('contractAmount') > 0, f'合同额>0 (got {f.get("contractAmount")})')
    assert_(f.get('billingType') in ('ODC', 'ODM', 'FIXED'), f'billingType 有效 (got {f.get("billingType")})')
    assert_(f.get('customerCode') == 'GEELY-GALAXY-L7', f'customerCode 保留 (got {f.get("customerCode")})')
    assert_(f.get('carModelCode') == 'GALAXY-L7', f'carModelCode 保留 (got {f.get("carModelCode")})')
print()

# 4. fill-form flow
print('[4] fill-form flow:')
r = call('POST', '/api/ai-command/fill-form', {
    'formType': 'flow',
    'name': f'{TEST_TAG} 标准流程',
})
assert_(r.get('ok'), f'fill-form flow ok (got {r.get("ok")})')
if r.get('ok'):
    f = r.get('filled', {})
    assert_(f.get('workType') in ('requirement', 'task', 'bug', 'release'), f'workType 有效 (got {f.get("workType")})')
    assert_(f.get('description'), f'description 必填 (got {f.get("description")})')
print()

# 5. fill-form 不支持的 formType
print('[5] fill-form 错误处理:')
r = call('POST', '/api/ai-command/fill-form', {'formType': 'unknown'}, expect_400=True)
assert_(not r.get('ok') and 'formType' in (r.get('error') or ''), f'不支持的 formType 报错 (got {r.get("error")})')
print()

# 6. fill-form 缺 name
print('[6] fill-form 缺名称容错:')
r = call('POST', '/api/ai-command/fill-form', {'formType': 'customer'})
# 这个 case 实际上会走 LLM 补全（因为提示词没强制 name 必填），看 LLM 怎么处理
# 只验证不崩
assert_(r.get('ok') is not None, f'fill-form 不崩 (got ok={r.get("ok")}, err={r.get("error")})')
print()

# 7. create-follow-up: 先确保有未读通知
print('[7] create-follow-up (从 AI 风险预警创建跟进任务):')
# 手动触发一次风险扫描
r = call('POST', '/api/ai-command/risk-scan', {})
print(f'   risk-scan: ok={r.get("ok")}, created={r.get("created", 0)}')

# 找一条未读通知
rows = db_query("SELECT id, title, recipientId FROM Notification WHERE read=0 ORDER BY createdAt DESC LIMIT 3")
assert_(len(rows) > 0, f'有未读通知 (got {len(rows)})')
if rows:
    nid, ntitle, nrecipient = rows[0]
    r = call('POST', f'/api/ai-command/notifications/{nid}/create-follow-up', {
        'assignee': nrecipient or 'zhangsan',
        'priority': 'P1',
        'type': 'task',
    })
    assert_(r.get('ok'), f'create-follow-up ok (got {r.get("ok")}, err={r.get("error")})')
    if r.get('ok'):
        wi = r.get('workItem', {})
        assert_(wi.get('key', '').startswith('TASK-'), f'创建了 TASK-* (got {wi.get("key")})')
        assert_(wi.get('priority') == 'P1', f'priority=P1 (got {wi.get("priority")})')
        assert_(wi.get('title') and len(wi.get('title', '')) > 0, f'title 有值 (got {wi.get("title", "")[:40]})')
        # 验证 DB 里实际写入
        rows = db_query("SELECT key, priority, assignee FROM WorkItem WHERE key=?", (wi.get('key'),))
        assert_(len(rows) == 1, f'工作项 {wi.get("key")} 在 DB')
        if rows:
            assert_(rows[0][1] == 'P1', f'DB priority=P1 (got {rows[0][1]})')
        # 验证通知已标已读
        rows = db_query("SELECT read FROM Notification WHERE id=?", (nid,))
        assert_(rows[0][0] == 1, f'通知已标已读 (got {rows[0][0]})')
print()

# 8. create-follow-up 错误处理
print('[8] create-follow-up 错误处理:')
r = call('POST', '/api/ai-command/notifications/nonexistent-id/create-follow-up', {}, expect_404=True)
assert_(not r.get('ok') and '不存在' in (r.get('error') or ''), f'不存在的通知报错 (got {r.get("error")})')
print()

# 总结
print('=' * 50)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    sys.exit(1)
else:
    print(f'✅ 全部通过 — V1.8.2 AI 表单辅助 + 风险一键跟进 OK')
