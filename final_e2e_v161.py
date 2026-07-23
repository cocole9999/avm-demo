"""AVM V1.6.1 E2E - LLM 设置管理"""
import json
import sys
import urllib.request
import urllib.error
import time

BASE = 'http://localhost:4000'
RESULTS = []
FAILED = 0

def req(method, path, body=None, expect=200):
    url = BASE + path
    data = json.dumps(body).encode('utf-8') if body is not None else None
    r = urllib.request.Request(url, data=data, method=method,
                                headers={'Content-Type': 'application/json'} if body else {})
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            status = resp.status
            text = resp.read().decode('utf-8')
            data = json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        status = e.code
        text = e.read().decode('utf-8')
        try: data = json.loads(text)
        except: data = text
    ok = status == expect
    return ok, status, data

def test(name, ok, detail=''):
    global FAILED
    mark = '[PASS]' if ok else '[FAIL]'
    if not ok: FAILED += 1
    line = f"{mark} {name}"
    if detail and not ok: line += f" :: {detail}"
    print(line)
    RESULTS.append(ok)

print('========== V1.6.1 LLM 设置 E2E ==========\n')

# 1. 列表
ok, _, r = req('GET', '/api/llm-settings')
test('LLM 1.1 列表 provider', ok and len(r['providers']) >= 9 and len(r['settings']) >= 0)

# 2. 状态
ok, _, st = req('GET', '/api/llm-settings/_/status')
test('LLM 1.2 状态查询', ok and 'provider' in st)

# 3. 配置 DeepSeek
ok, _, s = req('PUT', '/api/llm-settings/deepseek', {
    'name': 'DeepSeek 测试',
    'apiKey': 'sk-test-deepseek-1234567890',
    'model': 'deepseek-chat',
    'temperature': 0.5,
    'maxTokens': 4096,
    'enabled': True,
    'isPrimary': True,
    'note': 'E2E 测试',
}, expect=200)
test('LLM 1.3 配置 DeepSeek', ok and s.get('provider') == 'deepseek' and s.get('apiKey', '').endswith('7890'))
test('LLM 1.4 apiKey 脱敏', ok and s.get('apiKey', '').startswith('sk-t') and '***' in s.get('apiKey', ''))

# 4. 标记主 provider
ok, _, _ = req('POST', '/api/llm-settings/deepseek/primary')
test('LLM 1.5 标记主 provider', ok)

# 5. 配置 OpenAI
ok, _, _ = req('PUT', '/api/llm-settings/openai', {
    'apiKey': 'sk-openai-abcdef123456',
    'model': 'gpt-4o',
}, expect=200)
test('LLM 1.6 配置 OpenAI', ok)

# 6. 列表确认有配置
ok, _, r = req('GET', '/api/llm-settings')
test('LLM 1.7 配置数 >= 2', ok and len(r['settings']) >= 2)
test('LLM 1.8 状态显示主 provider', ok and r['status']['configured'] and r['status']['provider'] == 'deepseek')

# 7. 测试连接（无效 key 应该失败）
ok, _, r = req('POST', '/api/llm-settings/deepseek/test', {
    'apiKey': 'sk-test-deepseek-1234567890',
})
test('LLM 1.9 测试连接（无效 key 应失败）', ok and r.get('success') == False)

# 8. 测试聊天（无效 key 应该失败）
ok, _, r = req('POST', '/api/llm-settings/test-chat', {
    'provider': 'deepseek',
    'apiKey': 'sk-test-deepseek-1234567890',
    'prompt': 'ping',
})
test('LLM 1.10 测试聊天（无效 key 应失败）', ok and r.get('success') == False)

# 9. 更新（upsert 覆盖）
ok, _, s = req('PUT', '/api/llm-settings/deepseek', {
    'name': 'DeepSeek 更新',
    'apiKey': 'sk-test-deepseek-NEWKEY',
    'model': 'deepseek-coder',
}, expect=200)
test('LLM 1.11 upsert 覆盖', ok and s.get('model') == 'deepseek-coder' and s.get('name') == 'DeepSeek 更新')

# 10. 删除 OpenAI
ok, _, _ = req('DELETE', '/api/llm-settings/openai', expect=204)
test('LLM 1.12 删除 OpenAI', ok)

# 11. 列表 OpenAI 已删
ok, _, r = req('GET', '/api/llm-settings')
test('LLM 1.13 OpenAI 已删', ok and not any(s['provider'] == 'openai' for s in r['settings']))

# 12. LLM 状态端点（兼容老调用）
ok, _, r = req('GET', '/api/ai/llm-status')
test('LLM 1.14 兼容 ai/llm-status', ok and 'providers' in r and len(r['providers']) >= 9)

# 13. 主 provider 删除后 fallback
req('DELETE', '/api/llm-settings/deepseek', expect=204)
ok, _, r = req('GET', '/api/llm-settings/_/status')
test('LLM 1.15 删除后回 mock', ok and r['provider'] == 'mock' and not r['configured'])

# 14. 未知 provider 错误
ok, _, _ = req('PUT', '/api/llm-settings/unknown', {'apiKey': 'x'}, expect=400)
test('LLM 1.16 未知 provider 拒绝', ok)

print()
total = len(RESULTS)
passed = sum(RESULTS)
print(f'========== 完成: {passed}/{total} 通过 ==========')
if FAILED > 0:
    print(f'!!! {FAILED} 个测试失败 !!!')
    sys.exit(1)
else:
    print('全部通过！')
    sys.exit(0)
