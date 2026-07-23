"""V1.8.3 E2E: AI 多轮对话记忆 + 资源管理
覆盖:
  - POST /api/ai-command/command 带 history 注入
  - GET    /api/resources/allocations (按 userId/workItemId/spaceId/date 过滤)
  - GET    /api/resources/load (负荷汇总, 验证 utilization/level/dailyHours)
  - GET    /api/resources/by-user/:userId
  - GET    /api/resources/by-work-item/:workItemId
  - POST   /api/resources/allocations (创建)
  - DELETE /api/resources/allocations/:id
"""
import json, urllib.request, urllib.error, sys
from datetime import datetime, timedelta

BASE = 'http://127.0.0.1:4000'
fail = []
created_alloc_ids: list[str] = []

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

def days(n: int) -> str:
    return (datetime.now() + timedelta(days=n)).strftime('%Y-%m-%d')

print('=== V1.8.3 AI 多轮对话记忆 + 资源管理 E2E ===\n')

# ========== 1. AI 多轮对话 - 第一轮：问项目风险 ==========
print('[1] AI 多轮 - 第一轮（问领克 09 风险）:')
status, r1 = call('POST', '/api/ai-command/command', body={
    'command': '领克 09 这个项目的风险怎么样？',
})
assert_(status == 200 and r1.get('ok'), f'第一轮 ok (status={status})')
if r1.get('ok'):
    print(f'   reply 预览: {(r1.get("reply") or "")[:120].replace(chr(10), " ")}...')
print()

# ========== 2. AI 多轮 - 第二轮：带 history 引用上文 ==========
print('[2] AI 多轮 - 第二轮（带 history，"它"指代领克 09）:')
history = [
    {'role': 'user', 'content': '领克 09 这个项目的风险怎么样？'},
    {'role': 'assistant', 'content': r1.get('reply', '')},
    # 加上 tool_calls 让 LLM 知道是"用工具查过的"对话
]
# 把 tool_calls 拼回去（如果有）
if r1.get('toolCalls'):
    history[1]['tool_calls'] = [
        {
            'id': f'call_{i}',
            'type': 'function',
            'function': {'name': tc.get('name'), 'arguments': json.dumps(tc.get('args') or {})},
        }
        for i, tc in enumerate(r1['toolCalls'])
    ]
    for i, tc in enumerate(r1['toolCalls']):
        history.append({
            'role': 'tool',
            'tool_call_id': f'call_{i}',
            'content': json.dumps(tc.get('result') or {}, ensure_ascii=False)[:1000],
        })
    history.append({'role': 'assistant', 'content': r1.get('reply', '')})

status, r2 = call('POST', '/api/ai-command/command', body={
    'command': '它的 PM 是谁？合同额多少？',  # "它"应指领克 09
    'history': history,
})
assert_(status == 200 and r2.get('ok'), f'第二轮 ok (status={status})')
if r2.get('ok'):
    reply2 = r2.get('reply', '')
    print(f'   reply 预览: {reply2[:200].replace(chr(10), " ")}...')
    # 验证 LLM 用 history 知道"它"指领克 09
    # 至少有"刚才"/"上文"等指代词 + 提到 600万合同
    has_reference = ('刚才' in reply2 or '上文' in reply2 or '继续' in reply2 or '那个' in reply2 or '领克 09' in reply2 or '领克09' in reply2 or 'AVM-LYNK-09' in reply2)
    has_amount = '600' in reply2 and ('万' in reply2 or '合同' in reply2)
    # 关键: 领克 09 是 600万合同, history 注入让 LLM 知道"它"是领克 09
    assert_(has_amount, f'提到 600万 合同额 (got: {reply2[:200]})')
    # history 注入证据: 提到领克 09 (LLM 实际指明了上文指代)
    if has_reference:
        print(f'   ✓ LLM 引用了上文（history 注入生效）')
    # 不强断言 mentions_lynk (LLM 可能用 "刚才的项目" 之类)
print()

# ========== 3. AI 多轮 - 无 history 时"它"会模糊 ==========
print('[3] AI 多轮 - 无 history（"它"应模糊，对比验证 history 必要性）:')
status, r3 = call('POST', '/api/ai-command/command', body={
    'command': '它的 PM 是谁？合同额多少？',  # 无上文，LLM 应该问"哪个项目"
})
assert_(status == 200 and r3.get('ok'), f'无 history 也 ok (status={status})')
if r3.get('ok'):
    reply3 = r3.get('reply', '')
    print(f'   reply 预览: {reply3[:150].replace(chr(10), " ")}...')
    # 不强制断言（可能 LLM 也能从快照直接挑一个项目回答）
print()

# ========== 4. 资源管理 - 列表 ==========
print('[4] 资源列表 (/allocations):')
status, items = call('GET', '/api/resources/allocations')
assert_(status == 200 and isinstance(items, list), f'列表 200 (got status={status})')
seed_count = len(items) if isinstance(items, list) else 0
assert_(seed_count >= 10, f'种子排期 ≥ 10 (got {seed_count})')
# 字段完整性
if items:
    sample = items[0]
    for f in ['id', 'userId', 'userName', 'workItemKey', 'startDate', 'endDate', 'allocatedHours', 'type', 'status']:
        assert_(f in sample, f'字段 {f} 存在')
print()

# ========== 5. 资源管理 - 过滤 ==========
print('[5] 资源列表过滤 (userId=张三（研发一组）):')
status, items = call('GET', '/api/resources/allocations', params={'userId': '张三（研发一组）'})
assert_(status == 200 and isinstance(items, list), f'userId 过滤 200')
if isinstance(items, list):
    for it in items:
        assert_(it.get('userId') == '张三（研发一组）', f'全是张三 (got {it.get("userId")})')
print(f'   张三 排期 {len(items)} 条')
print()

# ========== 6. 资源管理 - 工作项过滤 ==========
print('[6] 资源列表过滤 (workItemId=REQ-1):')
status, items = call('GET', '/api/resources/allocations', params={'workItemId': 'REQ-1'})
assert_(status == 200 and isinstance(items, list), f'workItemId 过滤 200')
if isinstance(items, list):
    for it in items:
        assert_(it.get('workItemId') == 'REQ-1', f'全是 REQ-1 (got {it.get("workItemId")})')
print(f'   REQ-1 排期 {len(items)} 条')
print()

# ========== 7. 资源管理 - 负荷汇总 ==========
print('[7] 资源负荷汇总 (/load 本周, range 限工作日):')
# 范围用 days(-3) ~ days(3) — 7 个本地日, 5 个工作日
# 张三 5×10h=50h 在 5 个工作日内 → utilization=50/40=125% overload
start, end = days(-3), days(3)
status, load = call('GET', '/api/resources/load', params={'startDate': start, 'endDate': end})
assert_(status == 200, f'load 200 (got {status})')
if status == 200:
    assert_('users' in load and 'workingDays' in load, f'load 包含 users + workingDays')
    users = load.get('users', [])
    assert_(len(users) >= 3, f'至少 3 个人有排期 (got {len(users)})')
    print(f'   人员: {len(users)}, 工作日: {len(load.get("workingDays", []))}')
    # 验证 张三 = 满载 (50h, 5 个工作日, 5×10h)
    zhangsan = next((u for u in users if '张三' in u.get('userName', '')), None)
    if zhangsan:
        print(f'   张三: total={zhangsan.get("totalHours")}h util={zhangsan.get("utilization")}% level={zhangsan.get("level")}')
        assert_(zhangsan.get('totalHours', 0) == 50, f'张三 totalHours=50 (got {zhangsan.get("totalHours")})')
        assert_(zhangsan.get('utilization', 0) > 100, f'张三 utilization > 100 (got {zhangsan.get("utilization")})')
        assert_(zhangsan.get('level') == 'overload', f'张三 level=overload (got {zhangsan.get("level")})')
    # 验证 王五 = 偏闲 (12h, 3天×4h)
    wangwu = next((u for u in users if '王五' in u.get('userName', '')), None)
    if wangwu:
        print(f'   王五: total={wangwu.get("totalHours")}h util={wangwu.get("utilization")}% level={wangwu.get("level")}')
        assert_(wangwu.get('totalHours', 0) == 12, f'王五 totalHours=12 (got {wangwu.get("totalHours")})')
        assert_(wangwu.get('level') in ['idle', 'normal'], f'王五 level=idle/normal (got {wangwu.get("level")})')
    # 验证 dailyHours 字段
    if users:
        sample = users[0]
        assert_('dailyHours' in sample, f'dailyHours 字段存在')
        assert_(len(sample.get('dailyHours', {})) > 0, f'dailyHours 有数据 ({len(sample["dailyHours"])} 天)')
print()

# ========== 8. 资源管理 - 按用户 ==========
print('[8] 按用户查 (/by-user/张三（研发一组）):')
status, r = call('GET', '/api/resources/by-user/' + urllib.request.quote('张三（研发一组）'))
assert_(status == 200, f'by-user 200 (got {status})')
if status == 200:
    assert_('allocations' in r and 'totalHours' in r, f'返回 allocations + totalHours')
    assert_(r.get('totalHours', 0) >= 50, f'张三 totalHours ≥ 50 (got {r.get("totalHours")})')
print(f'   张三 排期: {len(r.get("allocations", []))} 条, totalHours: {r.get("totalHours")}h')
print()

# ========== 9. 资源管理 - 按工作项 ==========
print('[9] 按工作项查 (/by-work-item/REQ-1):')
status, r = call('GET', '/api/resources/by-work-item/REQ-1')
assert_(status == 200, f'by-work-item 200 (got {status})')
if status == 200:
    assert_('allocations' in r and 'totalHours' in r, f'返回 allocations + totalHours')
    assert_(r.get('totalHours', 0) >= 50, f'REQ-1 totalHours ≥ 50 (got {r.get("totalHours")})')
print(f'   REQ-1 排期: {len(r.get("allocations", []))} 条, totalHours: {r.get("totalHours")}h')
print()

# ========== 10. 资源管理 - 创建 ==========
print('[10] 创建排期 (POST /allocations):')
# date 字段需要 ISO DateTime，不能只 YYYY-MM-DD
new_alloc_body = {
    'userId': 'E2E-V183-测试人员',
    'userName': 'E2E-V183-测试人员',
    'workItemId': 'REQ-1',
    'workItemKey': 'REQ-1',
    'workItemTitle': '银河 L7 AVM 透明底盘功能开发',
    'startDate': f'{days(10)}T00:00:00.000Z',
    'endDate': f'{days(12)}T00:00:00.000Z',
    'allocatedHours': 24,
    'type': 'develop',
    'status': 'planned',
}
status, created = call('POST', '/api/resources/allocations', body=new_alloc_body)
assert_(status == 201 and created.get('id'), f'创建 ok (status={status} id={created.get("id") if isinstance(created, dict) else "?"})')
if created and created.get('id'):
    created_alloc_ids.append(created['id'])
    assert_(created.get('allocatedHours') == 24, f'工时数=24 (got {created.get("allocatedHours")})')
print()

# ========== 11. 资源管理 - 删除 ==========
print('[11] 删除排期:')
for aid in created_alloc_ids:
    status, _ = call('DELETE', f'/api/resources/allocations/{aid}')
    assert_(status in [200, 204], f'删除 {aid[:8]}... (status={status})')
created_alloc_ids.clear()
print()

# ========== 12. 资源管理 - 时间窗过滤 ==========
print('[12] 资源列表时间窗过滤 (PM 下周排期):')
# PM 排期在 seed 当时 today+5~9 范围。 用 days(4)~days(8) 匹配
status, items = call('GET', '/api/resources/allocations', params={'startDate': days(4), 'endDate': days(8)})
assert_(status == 200, f'时间过滤 200')
if isinstance(items, list):
    pm_items = [i for i in items if 'AVM 项目经理' in i.get('userName', '')]
    print(f'   时间窗内 PM 排期: {len(pm_items)} 条')
    assert_(len(pm_items) >= 1, f'PM 排期 ≥ 1 (got {len(pm_items)})')
print()

# 总结
print('=' * 60)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    sys.exit(1)
else:
    print('✅ 全部通过 — V1.8.3 AI 多轮记忆 + 资源管理 OK')
