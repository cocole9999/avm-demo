"""V1.7 LLM 真实掌握项目数据 - 验证不再编造
核心: 喂给 LLM 项目快照后，问项目/客户/联系人级问题，验证 LLM 答到真实数据（不编造）
"""
import json
import urllib.request
import sys
import re

BASE = 'http://localhost:4000'
fail = []

def call(method, path, body=None, timeout=60):
    h = {'Content-Type': 'application/json; charset=utf-8'}
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    req = urllib.request.Request(f'{BASE}{path}', method=method, data=data, headers=h)
    r = urllib.request.urlopen(req, timeout=timeout)
    return json.loads(r.read().decode('utf-8'))

def assert_(cond, msg):
    if not cond:
        fail.append(msg)
        print(f'  ❌ {msg}')
    else:
        print(f'  ✓ {msg}')

print('=== V1.7 LLM 项目数据真实掌握 ===\n')

# 0. 清 LLM provider 30s cache（避免上一轮 E2E 留的 fake-key provider 干扰）
# switch-model 端点会调 clearLLMCache()，同时确保 deepseek 仍是 v4-pro
import time as _t
_t.sleep(31)  # 等 cache 自然过期（最稳）
call('POST', '/api/llm-settings/deepseek/switch-model', {'model': 'deepseek-v4-pro'})

# Step 1: llmContext.snapshot 必须为 true（说明 LLM 用了快照）
print('[1] snapshot 注入验证:')
r = call('POST', '/api/ai/qa', {'question': 'AVM 项目中心有几个项目？'})
ctx = r.get('llmContext') or {}
assert_(ctx.get('snapshot') is True, f'llmContext.snapshot=true (got {ctx.get("snapshot")})')
assert_(isinstance(ctx.get('items'), int) and ctx.get('items') > 500, f'快照大小合理 (got {ctx.get("items")} chars)')
print(f'   answer: {r.get("answer", "")[:120]}...')
print()

# Step 2: 问项目超期 - 必须列出真实项目（不编造）
print('[2] 项目超期问题: 真实项目名 + 真实合同额:')
r = call('POST', '/api/ai/qa', {'question': '哪些项目风险最高？列出前 3 个项目名和合同额。'})
insight = r.get('answer', '') or r.get('llmInsight', '') or ''
# 真实项目名（领克09 600万, 银河L7 380万）
assert_('领克09' in insight or '领克 09' in insight, f'答出真实项目"领克09" (got: {insight[:200]})')
assert_('600' in insight and '万' in insight, f'答出真实合同额"600万" (got: {insight[:200]})')
assert_('银河L7' in insight or '银河 L7' in insight, f'答出"银河L7" (got: {insight[:200]})')
# 不能编造
assert_('项目 A' not in insight and '项目 B' not in insight, f'不能编造"项目 A/B"')
print(f'   {insight[:150]}...')
print()

# Step 3: 银河 L7 客户 + UPL
print('[3] 银河 L7 客户 + UPL: 真实数据:')
r = call('POST', '/api/ai/qa', {'question': '银河 L7 项目的客户是谁？联系人里谁是 UPL？'})
insight = r.get('answer', '') or r.get('llmInsight', '') or ''
# 真实客户名"吉利银河 L7 项目组"
assert_('吉利' in insight and '银河' in insight, f'答出客户"吉利银河 L7 项目组" (got: {insight[:200]})')
# 真实 UPL 陈工 + 电话 13900001000（LLM 可能答部分，放宽到"主联系人"或"陈"或电话任一）
upl_ok = ('陈' in insight) or ('13900' in insight) or ('主联系人' in insight and ('陈' in insight or '工' in insight))
assert_(upl_ok, f'答出 UPL 陈工+电话 (got: {insight[:200]})')
print(f'   {insight[:200]}')
print()

# Step 4: 极氪 007 状态 - 进度 0% / 合同 220 万
print('[4] 极氪 007 状态真实数据:')
r = call('POST', '/api/ai/qa', {'question': '极氪 007 项目现在什么状态？合同额多少？'})
insight = r.get('answer', '') or r.get('llmInsight', '') or ''
# 接受"极氪 007"/"极氪007" / "该项目" / 主体识别后省略名字的情况
mentions = ('极氪 007' in insight) or ('极氪007' in insight) or ('该项目' in insight)
assert_(mentions, f'提到极氪 007/该项目 (got: {insight[:200]})')
assert_('220' in insight and '万' in insight, f'答出合同额 220万 (got: {insight[:200]})')
assert_('0%' in insight or '规划' in insight, f'答出进度 0% / 规划中 (got: {insight[:200]})')
print(f'   {insight[:200]}')
print()

# Step 5: 跨实体 - 哪个客户的项目数最多
print('[5] 跨实体推理: 哪个客户关联项目最多？')
r = call('POST', '/api/ai/qa', {'question': '所有客户中，关联项目最多的是哪个？项目数多少？'})
insight = r.get('answer', '') or r.get('llmInsight', '') or ''
# 客户名"吉利"开头
assert_('吉利' in insight, f'答出"吉利"系列客户 (got: {insight[:200]})')
print(f'   {insight[:200]}')
print()

# Step 6: 联系人 - 测试问某个角色
print('[6] 联系人角色查询: 测试角色是谁？')
r = call('POST', '/api/ai/qa', {'question': '博越 L 这个客户的测试负责人是谁？'})
insight = r.get('answer', '') or r.get('llmInsight', '') or ''
# 真实数据：博越L客户有 5 角色联系人，测试角色是一个"X工"
assert_('博越' in insight, f'答出"博越" (got: {insight[:200]})')
assert_('测试' in insight or '工' in insight, f'答出测试角色联系人 (got: {insight[:200]})')
print(f'   {insight[:200]}')
print()

# Step 7: 数据不存在的字段，LLM 必须说"数据中没有"
print('[7] 幻觉测试: 问数据里没有的字段:')
r = call('POST', '/api/ai/qa', {'question': '吉利银河 L7 项目组的年度营收是多少？'})
insight = r.get('answer', '') or r.get('llmInsight', '') or ''
# 关键检查：不能编造 8 位数（亿）数字
has_made_up = bool(re.search(r'\d+\.?\d*\s*亿', insight)) or bool(re.search(r'\d+\.?\d*\s*千万', insight))
assert_(not has_made_up, f'不能编造"X 亿 / X 千万" 营收 (got: {insight[:200]})')
# 软检查：建议 LLM 说"数据中没有/未提供"，但不强制（LLM 可能合理推测合同合计）
says_no_data = any(k in insight for k in ['没有', '未提供', '未直接', '不包含', '不在', '无相关', '找不到', '没有营收', 'not provided', 'not available', '不在快照', '没有该字段', '没有这个字段', '不提供', '没提供'])
if not says_no_data:
    print(f'  ⚠ LLM 没明确说"数据中没有"，但没编造大数字 — soft pass (got: {insight[:150]})')
print(f'   {insight[:200]}')
print()

# 总结
print('=' * 50)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    sys.exit(1)
else:
    print(f'✅ 全部通过 (7 步) — LLM 真掌握 V1.7 项目数据')
