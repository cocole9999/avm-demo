"""V1.8.1 E2E: AI 全量 CRUD 工具 — 18 个新工具端到端验证
覆盖: Project / Customer / CarModel / Contact / Iteration / Flow / Comment / Notification / AssignIteration
"""
import json
import urllib.request
import sqlite3
import sys
import time as _t

BASE = 'http://127.0.0.1:4000'
DB_PATH = r'D:\AI\飞书项目\avm-demo\backend\prisma\data.db'
TEST_TAG = 'V181_E2E'  # 用于标识测试数据便于清理
fail = []

def call(method, path, body=None, timeout=180, retries=2):
    h = {'Content-Type': 'application/json; charset=utf-8'}
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    last_err = None
    for i in range(retries + 1):
        try:
            req = urllib.request.Request(f'{BASE}{path}', method=method, data=data, headers=h)
            return json.loads(urllib.request.urlopen(req, timeout=timeout).read().decode('utf-8'))
        except Exception as e:
            last_err = e
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

def db_exec(sql, params=()):
    conn = sqlite3.connect(DB_PATH)
    conn.execute(sql, params)
    conn.commit()
    conn.close()

def cleanup():
    """清理测试数据 (V181_E2E 标识)"""
    print('\n[清理] 删除 V181_E2E 测试数据...')
    # 工作项 (key 前缀)
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    # Comment / Activity 通过 WorkItem cascade
    cur.execute("DELETE FROM WorkItem WHERE key LIKE ? OR title LIKE ?", (f'V181-%', f'%V181_E2E%'))
    wi_n = cur.rowcount
    # Project (按 name)
    cur.execute("DELETE FROM Project WHERE name LIKE ? OR code LIKE ?", (f'%V181_E2E%', f'%V181_E2E%'))
    pj_n = cur.rowcount
    # Contact (按 name)
    cur.execute("DELETE FROM Contact WHERE name LIKE ?", (f'%V181_E2E%',))
    ct_n = cur.rowcount
    # Customer
    cur.execute("DELETE FROM Customer WHERE name LIKE ?", (f'%V181_E2E%',))
    cu_n = cur.rowcount
    # CarModel
    cur.execute("DELETE FROM CarModel WHERE name LIKE ?", (f'%V181_E2E%',))
    cm_n = cur.rowcount
    # Iteration
    cur.execute("DELETE FROM Iteration WHERE name LIKE ?", (f'%V181_E2E%',))
    it_n = cur.rowcount
    # NodeFlow (按 name)
    cur.execute("DELETE FROM NodeFlow WHERE name LIKE ?", (f'%V181_E2E%',))
    nf_n = cur.rowcount
    # Notification
    cur.execute("DELETE FROM Notification WHERE title LIKE ? OR content LIKE ?", (f'%V181_E2E%', f'%V181_E2E%'))
    nt_n = cur.rowcount
    conn.commit()
    conn.close()
    print(f'  删除: WorkItem={wi_n} Project={pj_n} Contact={ct_n} Customer={cu_n} CarModel={cm_n} Iteration={it_n} NodeFlow={nf_n} Notification={nt_n}')

print('=== V1.8.1 AI 全量 CRUD 工具 E2E ===\n')

# 0. 前置: 等 65s 跳 startup 风险扫描 + LLM cache 过期
print('⏳ 等待 65s 跳过 startup 风险扫描 + LLM cache 过期...')
_t.sleep(65)
call('POST', '/api/llm-settings/deepseek/switch-model', {'model': 'deepseek-v4-pro'})

# 0. 工具列表 (验证 26 个)
print('[0] 工具列表:')
r = call('GET', '/api/ai-command/tools')
tools = [t['function']['name'] for t in r['tools']]
print(f'   共 {len(tools)} 个工具')
assert_(len(tools) == 26, f'工具总数 = 26 (got {len(tools)})')
new_tools = ['create_project', 'create_customer', 'create_car_model', 'create_contact',
             'create_iteration', 'create_flow', 'create_comment', 'list_notifications',
             'mark_notification_read', 'update_project', 'update_contact', 'update_iteration',
             'update_flow', 'update_car_model', 'update_customer', 'delete_project',
             'delete_work_item', 'assign_iteration']
for t in new_tools:
    assert_(t in tools, f'工具 {t} 已注册')
print()

# 1. AI 创建客户
print('[1] AI 创建客户 (create_customer):')
r = call('POST', '/api/ai-command/command', {
    'command': f'创建一个新客户 {TEST_TAG}测试车企，类型 internal，行业 汽车主机厂，主联系人 王测试，电话 13800000001',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'create_customer' and tc.get('result', {}).get('ok')]
assert_(len(hits) >= 1, f'LLM 调 create_customer 成功 (got {len(hits)})')
if hits:
    cust_code = hits[0]['result']['code']
    cust_name = hits[0]['result'].get('message', '')
    print(f'   客户创建: {cust_code}')
    # DB 验证
    rows = db_query("SELECT code, name, type FROM Customer WHERE code=?", (cust_code,))
    assert_(len(rows) == 1, f'客户实际写入 DB (got {len(rows)})')
    if rows:
        assert_('V181_E2E' in rows[0][1], f'客户名含 V181_E2E (got {rows[0][1]})')
print()

# 2. AI 创建车型
print('[2] AI 创建车型 (create_car_model):')
r = call('POST', '/api/ai-command/command', {
    'command': f'创建一个车型 {TEST_TAG}测试车型，品牌 吉利银河，平台 SEA，2026 上市',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'create_car_model' and tc.get('result', {}).get('ok')]
assert_(len(hits) >= 1, f'LLM 调 create_car_model 成功 (got {len(hits)})')
if hits:
    car_code = hits[0]['result']['code']
    print(f'   车型创建: {car_code}')
    rows = db_query("SELECT code, name, brand FROM CarModel WHERE code=?", (car_code,))
    assert_(len(rows) == 1, '车型实际写入 DB')
    if rows:
        assert_(rows[0][2] == '吉利银河', f'品牌=吉利银河 (got {rows[0][2]})')
print()

# 3. AI 创建项目 (用刚创建的客户+车型)
print('[3] AI 创建项目 (create_project):')
r = call('POST', '/api/ai-command/command', {
    'command': f'用客户 {cust_code} 和车型 {car_code} 创建一个 AVM 集成项目，名称 {TEST_TAG}测试项目，2026-01-01 开始到 2026-12-31 结束，计费方式 ODC，合同 200 万，PM 张三',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'create_project' and tc.get('result', {}).get('ok')]
assert_(len(hits) >= 1, f'LLM 调 create_project 成功 (got {len(hits)})')
if hits:
    proj_code = hits[0]['result']['code']
    proj_id = hits[0]['result']['id']
    print(f'   项目创建: {proj_code}')
    rows = db_query("SELECT code, name, contractAmount, pmUserName FROM Project WHERE id=?", (proj_id,))
    assert_(len(rows) == 1, '项目实际写入 DB')
    if rows:
        assert_(rows[0][2] == 2000000 or rows[0][2] == 200.0, f'合同额 200 万 (got {rows[0][2]})')
        assert_('AVM-' in rows[0][0], f'code 以 AVM- 开头 (got {rows[0][0]})')
print()

# 4. AI 创建联系人
print('[4] AI 创建联系人 (create_contact):')
r = call('POST', '/api/ai-command/command', {
    'command': f'给客户 {cust_code} 加一个联系人 {TEST_TAG}李测试，角色 UPL，部门 智能驾驶，邮箱 test@example.com',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'create_contact' and tc.get('result', {}).get('ok')]
assert_(len(hits) >= 1, f'LLM 调 create_contact 成功 (got {len(hits)})')
if hits:
    contact_id = hits[0]['result']['id']
    rows = db_query("SELECT name, role, email FROM Contact WHERE id=?", (contact_id,))
    assert_(len(rows) == 1, '联系人实际写入 DB')
    if rows:
        assert_(rows[0][1] == 'UPL', f'role=UPL (got {rows[0][1]})')
        assert_(rows[0][2] == 'test@example.com', f'邮箱写入 (got {rows[0][2]})')
print()

# 5. AI 更新联系人 (按 id)
print('[5] AI 更新联系人 (update_contact):')
r = call('POST', '/api/ai-command/command', {
    'command': f'把联系人 {contact_id} 的角色从 UPL 改为 PPM',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'update_contact' and tc.get('result', {}).get('ok')]
assert_(len(hits) >= 1, f'LLM 调 update_contact 成功 (got {len(hits)})')
if hits:
    rows = db_query("SELECT role FROM Contact WHERE id=?", (contact_id,))
    assert_(rows[0][0] == 'PPM', f'角色已更新为 PPM (got {rows[0][0]})')
print()

# 6. AI 创建迭代
print('[6] AI 创建迭代 (create_iteration):')
r = call('POST', '/api/ai-command/command', {
    'command': f'创建一个迭代 {TEST_TAG}Sprint 2026-Q1，从 2026-01-01 到 2026-03-31，状态 active，目标是完成 AVM 测试',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'create_iteration' and tc.get('result', {}).get('ok')]
assert_(len(hits) >= 1, f'LLM 调 create_iteration 成功 (got {len(hits)})')
if hits:
    iter_id = hits[0]['result']['id']
    iter_name = hits[0]['result'].get('name', '')
    rows = db_query("SELECT name, status, goal FROM Iteration WHERE id=?", (iter_id,))
    assert_(len(rows) == 1, '迭代实际写入 DB')
    if rows:
        assert_(rows[0][1] == 'active', f'status=active (got {rows[0][1]})')
print()

# 7. AI 创建流程 (NodeFlow + workType 复合唯一)
print('[7] AI 创建流程 (create_flow, NodeFlow + workType):')
unique_wt = f'v181_e2e_{int(_t.time())}'  # 避免重复
r = call('POST', '/api/ai-command/command', {
    'command': f'创建一个流程，名称 {TEST_TAG}测试流程，workType 用 {unique_wt}，描述 用于 E2E 验证',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'create_flow' and tc.get('result', {}).get('ok')]
assert_(len(hits) >= 1, f'LLM 调 create_flow 成功 (got {len(hits)})')
if hits:
    flow_id = hits[0]['result']['id']
    rows = db_query("SELECT name, workType, isActive FROM NodeFlow WHERE id=?", (flow_id,))
    assert_(len(rows) == 1, '流程实际写入 DB (NodeFlow 表)')
    if rows:
        assert_(rows[0][1] == unique_wt, f'workType 正确 (got {rows[0][1]})')
        assert_(rows[0][2] == 1, f'isActive=true (got {rows[0][2]})')
print()

# 8. AI 创建工作项
print('[8] AI 创建工作项 (create_work_item, 关联到新项目):')
r = call('POST', '/api/ai-command/command', {
    'command': f'在项目 {proj_code} 下创建一个 P0 任务 {TEST_TAG}测试任务，描述 验证 AI 全链路',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'create_work_item' and tc.get('result', {}).get('ok')]
assert_(len(hits) >= 1, f'LLM 调 create_work_item 成功 (got {len(hits)})')
if hits:
    wi_key = hits[0]['result']['key']
    rows = db_query("SELECT key, type, title, projectId FROM WorkItem WHERE key=?", (wi_key,))
    assert_(len(rows) == 1, f'工作项实际写入 (key={wi_key})')
    if rows:
        assert_(rows[0][3] == proj_id, f'关联到新项目 (got projectId={rows[0][3]})')
print()

# 9. AI 给工作项加评论
print('[9] AI 给工作项加评论 (create_comment):')
r = call('POST', '/api/ai-command/command', {
    'command': f'给 {wi_key} 加一条评论：{TEST_TAG}评论内容 - AI 已完成自动化测试',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'create_comment' and tc.get('result', {}).get('ok')]
assert_(len(hits) >= 1, f'LLM 调 create_comment 成功 (got {len(hits)})')
if hits:
    rows = db_query("SELECT content, author FROM Comment WHERE workItemId=(SELECT id FROM WorkItem WHERE key=?) AND content LIKE ?",
                    (wi_key, f'%{TEST_TAG}%'))
    assert_(len(rows) >= 1, '评论实际写入 DB')
    if rows:
        assert_('V181_E2E' in rows[0][0], f'评论内容正确 (got {rows[0][0][:50]})')
print()

# 10. AI 列出通知
print('[10] AI 列出通知 (list_notifications):')
r = call('POST', '/api/ai-command/command', {
    'command': '列出 admin 的未读通知',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'list_notifications' and not tc.get('error')]
assert_(len(hits) >= 1, f'LLM 调 list_notifications 成功 (got {len(hits)})')
if hits:
    notif_list = hits[0].get('result', [])
    if isinstance(notif_list, list):
        print(f'   返回 {len(notif_list)} 条通知')
    else:
        print(f'   返回: {str(notif_list)[:100]}')
print()

# 11. AI 标记通知已读 (按 id)
print('[11] AI 标记通知已读 (mark_notification_read):')
# 找一条未读通知
rows = db_query("SELECT id FROM Notification WHERE read=0 LIMIT 1")
if rows:
    nid = rows[0][0]
    r = call('POST', '/api/ai-command/command', {
        'command': f'把通知 {nid} 标记为已读',
    })
    hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'mark_notification_read' and tc.get('result', {}).get('ok')]
    assert_(len(hits) >= 1, f'LLM 调 mark_notification_read 成功 (got {len(hits)})')
    if hits:
        rows = db_query("SELECT read FROM Notification WHERE id=?", (nid,))
        assert_(rows[0][0] == 1, f'通知已标记为已读 (got {rows[0][0]})')
else:
    print('   (没有未读通知可测试，跳过)')
print()

# 12. AI 给工作项分配迭代
print('[12] AI 给工作项分配迭代 (assign_iteration):')
r = call('POST', '/api/ai-command/command', {
    'command': f'把 {wi_key} 分配到迭代 {iter_name}',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'assign_iteration' and tc.get('result', {}).get('ok')]
assert_(len(hits) >= 1, f'LLM 调 assign_iteration 成功 (got {len(hits)})')
if hits:
    rows = db_query("SELECT iterationId FROM WorkItem WHERE key=?", (wi_key,))
    assert_(rows[0][0] == iter_id, f'工作项关联到迭代 (got iterationId={rows[0][0]}, expected={iter_id})')
print()

# 13. AI 更新项目进度
print('[13] AI 更新项目进度 (update_project):')
r = call('POST', '/api/ai-command/command', {
    'command': f'把项目 {proj_code} 的进度更新到 50%',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'update_project' and tc.get('result', {}).get('ok')]
assert_(len(hits) >= 1, f'LLM 调 update_project 成功 (got {len(hits)})')
if hits:
    rows = db_query("SELECT progress FROM Project WHERE id=?", (proj_id,))
    assert_(rows[0][0] == 50, f'项目进度=50 (got {rows[0][0]})')
print()

# 14. AI 删除工作项 (危险操作)
print('[14] AI 删除工作项 (delete_work_item):')
# 先创建临时工作项
r = call('POST', '/api/ai-command/command', {
    'command': f'创建一个 P3 任务 {TEST_TAG}待删除',
})
hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'create_work_item' and tc.get('result', {}).get('ok')]
del_key = None
if hits:
    del_key = hits[0]['result']['key']
    # 验证存在
    rows = db_query("SELECT id FROM WorkItem WHERE key=?", (del_key,))
    assert_(len(rows) == 1, f'临时工作项 {del_key} 已创建')

# 删除
if del_key:
    r = call('POST', '/api/ai-command/command', {
        'command': f'删除工作项 {del_key}',
    })
    hits = [tc for tc in r.get('toolCalls', []) if tc['name'] == 'delete_work_item' and tc.get('result', {}).get('ok')]
    assert_(len(hits) >= 1, f'LLM 调 delete_work_item 成功 (got {len(hits)})')
    if hits:
        rows = db_query("SELECT id FROM WorkItem WHERE key=?", (del_key,))
        assert_(len(rows) == 0, f'工作项 {del_key} 已删除')
print()

# 总结
print('=' * 50)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    cleanup()
    sys.exit(1)
else:
    print(f'✅ 全部通过 — V1.8.1 全量 CRUD 工具 OK (14 个新场景)')
    cleanup()
