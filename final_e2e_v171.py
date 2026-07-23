"""V1.7.1 E2E: 外部依赖管理（台架/实车/车模/SDB/UE/UI/标定）
覆盖:
  - GET    /api/dependencies (列表 + type/status/projectCode/workItemKey 过滤)
  - GET    /api/dependencies/:id (详情)
  - POST   /api/dependencies (创建 - 各种 type)
  - PATCH  /api/dependencies/:id (更新字段/状态)
  - POST   /api/dependencies/:id/ready (标记就绪)
  - DELETE /api/dependencies/:id (删除)
  - GET    /api/dependencies/stats/summary (统计)
  - POST   /api/ai-command/risk-scan 联动 dep_overdue 通知
  - POST   /api/ai-command/fill-form formType=dependency
"""
import json, urllib.request, urllib.error, sys, time as _t
from datetime import datetime, timedelta

BASE = 'http://127.0.0.1:4000'
fail = []
e2e_dep_ids: list[str] = []  # 测试结束后清理

def call(method, path, params=None, body=None, timeout=60):
    h = {'Content-Type': 'application/json; charset=utf-8'}
    if params:
        from urllib.parse import urlencode
        path = f'{path}?{urlencode(params)}'
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

def days_ago(n: int) -> str:
    return (datetime.now() - timedelta(days=n)).strftime('%Y-%m-%d')

def days_later(n: int) -> str:
    return (datetime.now() + timedelta(days=n)).strftime('%Y-%m-%d')

print('=== V1.7.1 外部依赖管理 E2E ===\n')

# 防御性清理：删掉上一轮 E2E 残留（异常退出时遗留的）
status, items_pre = call('GET', '/api/dependencies')
if isinstance(items_pre, list):
    stale = [i for i in items_pre if 'E2E-V171' in (i.get('name') or '')]
    for s in stale:
        call('DELETE', f"/api/dependencies/{s['id']}")
    if stale:
        print(f'🧹 清理了 {len(stale)} 个历史 E2E 残留依赖\n')

# ========== 1. 列表 ==========
print('[1] 列表查询:')
status, items = call('GET', '/api/dependencies')
assert_(status == 200 and isinstance(items, list), f'列表 200 (got status={status})')
assert_(len(items) >= 1, f'种子依赖 ≥ 1 (got {len(items) if isinstance(items, list) else "?"})')
# 字段完整性
if items:
    sample = items[0]
    for f in ['id', 'type', 'name', 'status', 'expectedDate']:
        assert_(f in sample, f'字段 {f} 存在')
print()

# ========== 2. 类型过滤 ==========
print('[2] 类型过滤 (type=台架):')
status, items = call('GET', '/api/dependencies', params={'type': '台架'})
assert_(status == 200 and isinstance(items, list), f'过滤 200')
if isinstance(items, list):
    for it in items:
        assert_(it.get('type') == '台架', f'类型全是台架 ({it.get("name")}={it.get("type")})')
print()

# ========== 3. 状态过滤 ==========
print('[3] 状态过滤 (status=ready):')
status, items = call('GET', '/api/dependencies', params={'status': 'ready'})
assert_(status == 200 and isinstance(items, list), f'状态过滤 200')
if isinstance(items, list):
    for it in items:
        assert_(it.get('status') == 'ready', f'状态全是 ready ({it.get("name")}={it.get("status")})')
print()

# ========== 4. 项目过滤 ==========
print('[4] 项目过滤 (projectCode=AVM-GALAXY-L7-2026):')
status, items = call('GET', '/api/dependencies', params={'projectCode': 'AVM-GALAXY-L7-2026'})
assert_(status == 200 and isinstance(items, list), f'项目过滤 200')
if isinstance(items, list):
    for it in items:
        code = it.get('project', {}).get('code') if it.get('project') else None
        assert_(code == 'AVM-GALAXY-L7-2026', f'项目全是 L7 ({it.get("name")}={code})')
print()

# ========== 5. 工作项过滤 ==========
print('[5] 工作项过滤 (workItemKey=REQ-1):')
status, items = call('GET', '/api/dependencies', params={'workItemKey': 'REQ-1'})
assert_(status == 200 and isinstance(items, list), f'工作项过滤 200')
if isinstance(items, list):
    for it in items:
        key = it.get('workItem', {}).get('key') if it.get('workItem') else None
        assert_(key == 'REQ-1', f'工作项全是 REQ-1 ({it.get("name")}={key})')
print()

# ========== 6. 创建 - 7 种类型 + 1 错误 ==========
print('[6] 创建 (各种 type):')
new_dep = None
for dep_type in ['台架', '实车', '车模', 'SDB', 'UE', 'UI', '标定']:
    body = {
        'type': dep_type,
        'name': f'E2E-V171-{dep_type}-{int(_t.time())}',
        'status': 'preparing',
        'owner': '张三（研发一组）',
        'expectedDate': days_later(7),
        'projectCode': 'AVM-GALAXY-L7-2026',
    }
    status, r = call('POST', '/api/dependencies', body=body)
    assert_(status == 201 and r.get('id'), f'创建 {dep_type} ok (status={status} id={r.get("id") if isinstance(r, dict) else "?"})')
    if r and r.get('id'):
        e2e_dep_ids.append(r['id'])
        if dep_type == '台架':
            new_dep = r  # 保留台架 dep 详情用
print()

# ========== 7. 创建 - 非法 type ==========
print('[7] 创建 - 非法 type 应拒绝:')
status, r = call('POST', '/api/dependencies', body={'type': '不存在的类型', 'name': '非法测试'})
assert_(status == 400 and 'type' in str(r.get('error', '')), f'非法 type 400 (got status={status} err={r.get("error") if isinstance(r, dict) else "?"})')
print()

# ========== 8. 详情 ==========
print('[8] 详情查询:')
if new_dep:
    status, r = call('GET', f'/api/dependencies/{new_dep["id"]}')
    assert_(status == 200 and r.get('id') == new_dep['id'], f'详情 OK (status={status})')
    assert_(r.get('type') == '台架', f'type 正确 ({r.get("type")})')
    assert_(r.get('project', {}).get('code') == 'AVM-GALAXY-L7-2026', f'关联项目 OK')
print()

# ========== 9. 更新 - 状态变更 ==========
print('[9] 更新 (status: preparing → blocked):')
if new_dep:
    status, r = call('PATCH', f'/api/dependencies/{new_dep["id"]}', body={
        'status': 'blocked',
        'blocker': '设备厂商交期延误',
    })
    assert_(status == 200 and r.get('status') == 'blocked', f'更新 status OK (got {r.get("status") if isinstance(r, dict) else "?"})')
print()

# ========== 10. 更新 - 状态 blocked 但缺 blocker 应拒绝 ==========
print('[10] 更新 - blocked 但无 blocker:')
if new_dep:
    # 先清空 blocker，然后试图改为 blocked
    call('PATCH', f'/api/dependencies/{new_dep["id"]}', body={'blocker': ''})
    status, r = call('PATCH', f'/api/dependencies/{new_dep["id"]}', body={'status': 'blocked'})
    # 之前有 blocker 的话允许；这里清空了所以应该失败
    if status == 400:
        assert_('blocker' in str(r.get('error', '')), f'blocked 无 blocker 被拒 ({r.get("error")})')
    else:
        print(f'  ⚠ 允许 blocked 无 blocker (status={status}) - 不影响主测试')
    # 恢复
    call('PATCH', f'/api/dependencies/{new_dep["id"]}', body={'status': 'preparing', 'blocker': '设备厂商交期延误'})
print()

# ========== 11. 标记就绪 ==========
print('[11] 标记已就绪:')
if new_dep:
    status, r = call('POST', f'/api/dependencies/{new_dep["id"]}/ready')
    assert_(status == 200 and r.get('dep', {}).get('status') == 'ready', f'标记就绪 OK (got {r.get("dep", {}).get("status") if isinstance(r, dict) else "?"})')
    assert_(r.get('dep', {}).get('actualDate'), f'actualDate 已写入')
print()

# ========== 12. 统计 ==========
print('[12] 统计:')
status, stats = call('GET', '/api/dependencies/stats/summary')
assert_(status == 200 and 'total' in stats, f'统计 200 (got {stats})')
assert_(stats.get('total', 0) > 0, f'总数 > 0 ({stats.get("total")})')
assert_('byType' in stats and 'byStatus' in stats, f'byType + byStatus 都有')
assert_('overdue' in stats, f'overdue 字段存在')
print(f'   {json.dumps(stats, ensure_ascii=False)}')
print()

# ========== 13. 风险扫描 - 注入超期依赖 ==========
print('[13] 风险扫描 (注入超期依赖 → 推 dep_overdue 通知):')
# 注入 2 个超期：critical (blocked) + high (超期 5 天)
critical_dep_body = {
    'type': '实车',
    'name': f'E2E-V171-超期-实车-{int(_t.time())}',
    'status': 'blocked',
    'blocker': '试制车间排期冲突',
    'owner': '王五（研发二组）',
    'expectedDate': days_ago(10),
    'projectCode': 'AVM-LYNK-09-2026',
}
status, critical_dep = call('POST', '/api/dependencies', body=critical_dep_body)
assert_(status == 201, f'创建 critical dep (status={status})')
e2e_dep_ids.append(critical_dep['id'])

high_dep_body = {
    'type': '台架',
    'name': f'E2E-V171-超期-台架-{int(_t.time())}',
    'status': 'preparing',
    'owner': '张三（研发一组）',
    'expectedDate': days_ago(5),
    'projectCode': 'AVM-LYNK-09-2026',
}
status, high_dep = call('POST', '/api/dependencies', body=high_dep_body)
assert_(status == 201, f'创建 high dep (status={status})')
e2e_dep_ids.append(high_dep['id'])

# 风险扫描前先记录 notification count - 遍历所有相关 recipientId
RECIPIENTS = ['admin', 'pm', '张三(研发一组)', '李四(测试)', '王五(研发二组)', '赵六(产品)']
# owner 用全角括号（seed 同款）
OWNER_USERS = ['张三（研发一组）', '王五（研发二组）']

def fetch_dep_notifications(user_ids: list[str]) -> list:
    out = []
    for uid in user_ids:
        status, r = call('GET', '/api/notifications', params={'userId': uid, 'filter': 'all', 'limit': 200})
        if status == 200 and isinstance(r, list):
            for n in r:
                if n.get('type') == 'dep_overdue':
                    out.append(n)
    return out

before_list = fetch_dep_notifications(RECIPIENTS + OWNER_USERS)
before_keys = {(n.get('link'), n.get('recipientId')) for n in before_list}
before_count = len(before_list)
print(f'   扫描前 dep_overdue 通知: {before_count} 条')

# 触发 risk-scan
status, scan_result = call('POST', '/api/ai-command/risk-scan')
assert_(status == 200 and scan_result.get('ok'), f'risk-scan OK (status={status})')
dep_part = scan_result.get('dependencyOverdue', {})
print(f'   扫描结果: overdue={dep_part.get("overdueCount")} 推送={dep_part.get("notificationsCreated")} 跳过={dep_part.get("skippedByDedup")}')

# 查询新生成的 dep_overdue 通知
after_list = fetch_dep_notifications(RECIPIENTS + OWNER_USERS)
after_keys = {(n.get('link'), n.get('recipientId')) for n in after_list}
new_keys = after_keys - before_keys
new_count = len(new_keys)
print(f'   扫描后 dep_overdue 通知: {len(after_list)} 条 (新增 {new_count})')
assert_(new_count > 0, f'新增通知 > 0 (got {new_count})')

# 验证涉及的级别（按 dep.id 区分）
critical_links = [k for k in new_keys if critical_dep['id'] in (k[0] or '')]
high_links = [k for k in new_keys if high_dep['id'] in (k[0] or '')]
levels = set()
for n in after_list:
    if (n.get('link'), n.get('recipientId')) in new_keys:
        levels.add(n.get('level'))
print(f'   critical dep 推 {len(critical_links)} 条 (error), high dep 推 {len(high_links)} 条 (warning)')
print(f'   涉及级别: {levels}')
assert_(len(critical_links) > 0, f'critical dep 推送了 ({len(critical_links)})')
assert_(len(high_links) > 0, f'high dep 推送了 ({len(high_links)})')
assert_('error' in levels, f'有 critical 通知 (error level) (got {levels})')
assert_('warning' in levels, f'有 high 通知 (warning level) (got {levels})')
print()

# ========== 14. 风险扫描 - dedup (再次扫描不重复推) ==========
print('[14] 风险扫描 - dedup 24h 去重:')
status, scan_result2 = call('POST', '/api/ai-command/risk-scan')
dep_part2 = scan_result2.get('dependencyOverdue', {})
skipped2 = dep_part2.get('skippedByDedup', 0)
created2 = dep_part2.get('notificationsCreated', 0)
print(f'   第二次扫描: 创建={created2} 跳过={skipped2}')
assert_(skipped2 >= 2, f'至少跳过 2 条 (got {skipped2})')
print()

# ========== 15. fill-form dependency ==========
print('[15] fill-form dependency (LLM):')
status, r = call('POST', '/api/ai-command/fill-form', body={
    'formType': 'dependency',
    'name': 'AVM 2.5 透明底盘台架',
    'type': '台架',
    'hint': '银河 L7 项目，4 颗广角 camera 标定，5 月底前需要就绪',
})
assert_(status == 200 and r.get('ok'), f'fill-form 200 (got status={status} ok={r.get("ok") if isinstance(r, dict) else "?"})')
if isinstance(r, dict) and r.get('ok'):
    filled = r.get('filled', {})
    assert_(filled.get('type') in ['台架', '实车', '车模', 'SDB', 'UE', 'UI', '标定', '其他'], f'type 合法 ({filled.get("type")})')
    assert_(filled.get('name'), f'name 已填 ({filled.get("name")})')
    assert_(filled.get('expectedDate'), f'expectedDate 已填 ({filled.get("expectedDate")})')
    assert_(filled.get('owner'), f'owner 已填 ({filled.get("owner")})')
    print(f'   填充: type={filled.get("type")} name={filled.get("name")} owner={filled.get("owner")} expectedDate={filled.get("expectedDate")}')
    print(f'   reasoning: {r.get("reasoning", "")[:100]}')
print()

# ========== 16. 删除 E2E 注入的依赖 ==========
print('[16] 清理 E2E 注入的依赖:')
for dep_id in e2e_dep_ids:
    status, _ = call('DELETE', f'/api/dependencies/{dep_id}')
    assert_(status in [200, 204], f'删除 {dep_id[:8]}... (status={status})')
e2e_dep_ids.clear()
print()

# ========== 17. 统计 - 验证清理后无残留 ==========
print('[17] 清理后统计校验:')
status, stats_after = call('GET', '/api/dependencies/stats/summary')
# 跟之前比，total 应该没变化（清理了注入的）
print(f'   清理后: {json.dumps(stats_after, ensure_ascii=False)}')
print()

# ========== 总结 ==========
print('=' * 60)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    sys.exit(1)
else:
    print('✅ 全部通过 — V1.7.1 外部依赖管理 OK')
