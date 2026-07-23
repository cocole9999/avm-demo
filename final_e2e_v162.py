"""AVM V1.6.2 E2E - LLM 模型切换"""
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

print('========== V1.6.2 模型切换 E2E ==========\n')

# 先建一个 qwen 配置
ok, _, _ = req('PUT', '/api/llm-settings/qwen', {
    'name': '通义千问', 'apiKey': 'sk-qwen-test-1234567890',
    'model': 'qwen-turbo', 'isPrimary': True, 'enabled': True,
}, expect=200)
test('2.1 配置 qwen 为主 provider', ok)

# 1. 列出可用模型
ok, _, r = req('GET', '/api/llm-settings/qwen/models')
test('2.2 列出 qwen 可用模型', ok and len(r['builtin']) >= 5 and 'qwen-plus' in r['builtin'])
test('2.3 current 是 qwen-turbo', ok and r['current'] == 'qwen-turbo')

# 2. 切换模型
ok, _, r = req('POST', '/api/llm-settings/qwen/switch-model', {'model': 'qwen-max'})
test('2.4 切换到 qwen-max', ok and r.get('model') == 'qwen-max')

# 3. 状态确认
ok, _, st = req('GET', '/api/llm-settings/_/status')
test('2.5 状态显示 qwen-max', ok and st.get('model') == 'qwen-max')

# 4. 切换到不在列表的模型
ok, _, _ = req('POST', '/api/llm-settings/qwen/switch-model', {'model': 'fake-model-xxx'}, expect=400)
test('2.6 非法模型拒绝', ok)

# 5. 添加自定义模型
ok, _, r = req('POST', '/api/llm-settings/qwen/custom-models', {'model': 'qwen-custom-fine-tune'})
test('2.7 添加自定义模型', ok and 'qwen-custom-fine-tune' in r.get('customModels', []))

# 6. 列出模型确认
ok, _, r = req('GET', '/api/llm-settings/qwen/models')
test('2.8 列表含自定义模型', ok and 'qwen-custom-fine-tune' in r.get('all', []) and 'qwen-custom-fine-tune' in r.get('custom', []))

# 7. 切到自定义模型
ok, _, r = req('POST', '/api/llm-settings/qwen/switch-model', {'model': 'qwen-custom-fine-tune'})
test('2.9 切到自定义模型', ok)

# 8. 状态确认
ok, _, st = req('GET', '/api/llm-settings/_/status')
test('2.10 状态显示自定义模型', ok and st.get('model') == 'qwen-custom-fine-tune')

# 9. 删除自定义模型
ok, _, r = req('DELETE', '/api/llm-settings/qwen/custom-models/qwen-custom-fine-tune')
test('2.11 删除自定义模型', ok and 'qwen-custom-fine-tune' not in r.get('customModels', []))

# 10. 切回预置
ok, _, _ = req('POST', '/api/llm-settings/qwen/switch-model', {'model': 'qwen-plus'})
test('2.12 切回 qwen-plus', ok)

# 11. 通过 PUT 设置 currentModel
ok, _, r = req('PUT', '/api/llm-settings/qwen', {
    'currentModel': 'qwen-long',
}, expect=200)
test('2.13 PUT 设置 currentModel', ok)

ok, _, st = req('GET', '/api/llm-settings/_/status')
test('2.14 状态确认 PUT currentModel', ok and st.get('model') == 'qwen-long')

# 12. AI qa 调用走当前模型（无 key 不会真调 LLM，会触发 provider 不可用回退；但 confirm 路径通畅）
ok, _, r = req('POST', '/api/ai/qa', {'question': 'P0 多少个？'})
test('2.15 AI 问答仍正常', ok and 'answer' in r)

# 13. 未知 provider 切换模型 = 404
ok, _, _ = req('POST', '/api/llm-settings/no-such-provider/switch-model', {'model': 'x'}, expect=404)
test('2.16 未知 provider 拒绝', ok)

# 14. 删除后状态回 mock
req('DELETE', '/api/llm-settings/qwen', expect=204)
ok, _, st = req('GET', '/api/llm-settings/_/status')
test('2.17 删除后回 mock', ok and st.get('provider') == 'mock')

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
