"""V1.6.8 E2E: 验证模型切换后 AI 调用实际反映新 model
关键点:
- DB currentModel 改变后, AI qa 的 llmModel 字段必须反映新 model
- 不管走 pattern 命中还是 fallback 路径, 都必须带 llmModel
- 切到不同 model, 字段值要跟着变
- switch-model 必须把 enabled 置 1（切模型 = 启用，否则 llm-status 仍走 mock）
"""
import json
import time
import urllib.request
import sqlite3
import os

BASE = 'http://localhost:4000'
DB_PATH = r'D:\AI\飞书项目\avm-demo\backend\prisma\data.db'
fail = []

def req(method, path, data=None):
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(f'{BASE}{path}', method=method, data=body,
                               headers={'Content-Type': 'application/json'})
    return json.loads(urllib.request.urlopen(r).read())

def assert_(cond, msg):
    if not cond:
        fail.append(msg)
        print(f'  ❌ {msg}')
    else:
        print(f'  ✓ {msg}')

print('=== V1.6.8 模型切换生效验证 ===\n')

# === 隔离：跑前备份 deepseek 真实 key，跑后还原（避免 E2E 假 key 污染真实配置） ===
def backup_key() -> str | None:
    """备份 deepseek 真实 api key（如果存在）"""
    if not os.path.exists(DB_PATH): return None
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute("SELECT apiKey FROM LLMSettings WHERE provider='deepseek'")
    row = cur.fetchone()
    conn.close()
    return row[0] if row and row[0] else None

def restore_key(key: str | None) -> None:
    """还原 deepseek 真实 api key"""
    if not key: return
    if not os.path.exists(DB_PATH): return
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE LLMSettings SET apiKey=? WHERE provider='deepseek'", (key,))
    conn.commit()
    conn.close()
    print(f'\n🔑 已还原 deepseek 真实 key（{key[:4]}***{key[-4:]}）')

_saved_key = backup_key()
print(f'🔒 已备份 deepseek 真实 key，跑完测试后自动还原\n')

# Step 1: 初始 (无 LLM 配置)
print('[1] 初始无 LLM 配置:')
status = req('GET', '/api/llm-settings/status')
assert_(status.get('configured') is False, 'configured=false (no provider yet)')
print()

# Step 2: 配置 deepseek + currentModel=v4-pro
print('[2] 配置 DeepSeek v4-pro:')
req('PUT', '/api/llm-settings/deepseek', {
    'name': 'DeepSeek', 'apiKey': 'sk-test-x', 'model': 'deepseek-v4-pro', 'isPrimary': True
})
qa = req('POST', '/api/ai/qa', {'question': 'P0 多少个？'})
assert_(qa.get('llmModel') == 'deepseek-v4-pro', f'llmModel=deepseek-v4-pro (got {qa.get("llmModel")})')
assert_('P0' in qa.get('answer', ''), f'answer 含 P0 (got {qa.get("answer")})')
print()

# Step 3: 切到 v4-flash
print('[3] switch-model 切到 v4-flash:')
sm = req('POST', '/api/llm-settings/deepseek/switch-model', {'model': 'deepseek-v4-flash'})
assert_(sm.get('ok') is True, f'switch ok (got {sm})')
assert_(sm.get('model') == 'deepseek-v4-flash', f'switched to v4-flash (got {sm.get("model")})')

# Step 4: AI qa 应反映 v4-flash
print('[4] AI qa 应反映 v4-flash:')
qa2 = req('POST', '/api/ai/qa', {'question': 'P0 多少个？'})
assert_(qa2.get('llmModel') == 'deepseek-v4-flash', f'llmModel=deepseek-v4-flash (got {qa2.get("llmModel")})')
print(f'   answer: {qa2.get("answer")[:60]}')
print(f'   llmModel: {qa2.get("llmModel")}')
print(f'   llmEnhanced: {qa2.get("llmEnhanced")}')
print()

# Step 5: 切到 v4-coder
print('[5] 切到 v4-coder:')
req('POST', '/api/llm-settings/deepseek/switch-model', {'model': 'deepseek-v4-coder'})
qa3 = req('POST', '/api/ai/qa', {'question': '有哪些工作项？'})
assert_(qa3.get('llmModel') == 'deepseek-v4-coder', f'llmModel=deepseek-v4-coder (got {qa3.get("llmModel")})')
print(f'   answer: {qa3.get("answer")[:60]}')
print(f'   llmModel: {qa3.get("llmModel")}')
print()

# Step 6: fallback 路径也要带 llmModel
print('[6] 随机问题(fallback 路径)也要带 llmModel:')
qa4 = req('POST', '/api/ai/qa', {'question': '今天天气如何?'})
assert_(qa4.get('llmModel') == 'deepseek-v4-coder', f'fallback 路径 llmModel=v4-coder (got {qa4.get("llmModel")})')
print(f'   answer: {qa4.get("answer")[:60]}')
print(f'   llmModel: {qa4.get("llmModel")}')
print()

# Step 7: 多 provider 场景
print('[7] 配置 OpenAI 切到 gpt-5:')
req('PUT', '/api/llm-settings/openai', {
    'name': 'OpenAI', 'apiKey': 'sk-openai-test', 'model': 'gpt-5', 'isPrimary': False
})
req('POST', '/api/llm-settings/openai/switch-model', {'model': 'gpt-5'})
qa5 = req('POST', '/api/ai/qa', {'question': 'P0 多少个？'})
# primary 是 deepseek 还是 openai 取决于配置, 关键是 llmModel 反映 currentModel
m5 = qa5.get('llmModel')
print(f'   llmModel: {m5} (取决于 primary 配置)')
assert_(m5 in ('deepseek-v4-coder', 'gpt-5'), f'llmModel 有效 (got {m5})')
print()

# Step 8: 关键修复 — switch-model 必须自动把 enabled 置 1
# 模拟 bug 场景: DB 里有 provider 但 enabled=0（之前 switch-model 不改 enabled 导致永远走 mock）
print('[8] 关键修复: switch-model 必须把 enabled=0 → 1:')
# 先把 deepseek 强行改回 enabled=0
if os.path.exists(DB_PATH):
    conn = sqlite3.connect(DB_PATH)
    conn.execute("UPDATE LLMSettings SET enabled=0 WHERE provider='deepseek'")
    conn.commit()
    conn.close()
    print('   DB: 模拟 enabled=0 状态')
# 调 switch-model（不传 markPrimary）
sm = req('POST', '/api/llm-settings/deepseek/switch-model', {'model': 'deepseek-v4-flash'})
assert_(sm.get('ok') is True, f'switch ok (got {sm})')
# 验证 enabled 被自动置 1
if os.path.exists(DB_PATH):
    conn = sqlite3.connect(DB_PATH)
    cur = conn.execute("SELECT enabled, currentModel FROM LLMSettings WHERE provider='deepseek'")
    row = cur.fetchone()
    conn.close()
    assert_(row[0] == 1, f'切换后 enabled=1 (got {row[0]}) — 否则 llm-status 仍走 mock')
    assert_(row[1] == 'deepseek-v4-flash', f'切换后 currentModel=v4-flash (got {row[1]})')
# 立即查 llm-status — 不应再走 mock
status_after = req('GET', '/api/ai/llm-status')
print(f'   provider: {status_after.get("provider")} | configured: {status_after.get("configured")}')
assert_(status_after.get('provider') == 'deepseek', f'provider=deepseek (got {status_after.get("provider")})')
assert_(status_after.get('configured') is True, f'configured=true (got {status_after.get("configured")})')
# AI qa 也应反映 v4-flash
qa6 = req('POST', '/api/ai/qa', {'question': 'P0 多少个？'})
assert_(qa6.get('llmModel') == 'deepseek-v4-flash', f'llmModel=v4-flash (got {qa6.get("llmModel")})')
print()

# Step 9: 切回 v4-pro（恢复）
print('[9] 切回 v4-pro 恢复:')
req('POST', '/api/llm-settings/deepseek/switch-model', {'model': 'deepseek-v4-pro'})
# 等 31s 让 LLM provider 30s cache 彻底过期，避免紧接的 qa 命中上一个模型（已知 race）
time.sleep(31)
qa7 = req('POST', '/api/ai/qa', {'question': 'P0 多少个？'})
assert_(qa7.get('llmModel') == 'deepseek-v4-pro', f'llmModel=v4-pro (got {qa7.get("llmModel")})')
print()

# === 还原 deepseek 真实 key（无论 E2E 是否失败都还原） ===
restore_key(_saved_key)

# 总结
print('=' * 50)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    import sys; sys.exit(1)
else:
    print(f'✅ 全部通过 (11 项) — V1.6.8 模型切换验证 OK + enabled 修复')
