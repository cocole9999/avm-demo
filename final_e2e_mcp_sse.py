"""V1.8.5 MCP Server SSE E2E
覆盖:
  - Streamable HTTP (2025-03-26): POST /api/mcp/stream
    - Content-Type: text/event-stream
    - 响应格式: event: message\\ndata: <jsonrpc>\\n\\n
  - Legacy HTTP+SSE (2024-11-05): GET /api/mcp/sse + POST /api/mcp/messages
    - GET 立即发 endpoint 事件
    - POST 接收消息 → 202 + 通过 SSE 通道返回响应
  - 错误处理: 未知方法 / 无 method / notification (无 id)
  - 13 工具能正常通过 SSE 调用
"""
import json, urllib.request, urllib.error, sys, socket, re
import time as _t

BASE = 'http://127.0.0.1:4000'
fail = []
e2e_ids: list[str] = []


def call(method, path, body=None, timeout=60):
    h = {'Content-Type': 'application/json; charset=utf-8'}
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    req = urllib.request.Request(f'{BASE}{path}', method=method, data=data, headers=h)
    try:
        r = urllib.request.urlopen(req, timeout=timeout)
        body_bytes = r.read()
        if not body_bytes:
            return r.status, None, dict(r.headers)
        try:
            return r.status, body_bytes.decode('utf-8'), dict(r.headers)
        except UnicodeDecodeError:
            return r.status, body_bytes, dict(r.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', errors='ignore'), dict(e.headers)


def streamable_call(req: dict, timeout=30) -> tuple:
    """POST /api/mcp/stream，返回 (status, headers, sse_data_dict)"""
    status, body, headers = call('POST', '/api/mcp/stream', body=req, timeout=timeout)
    if not body:
        return status, headers, None
    # 解析 SSE 格式: event: message\ndata: <json>\n\n
    data_match = re.search(r'^data: (.+?)$', body, re.MULTILINE)
    if not data_match:
        return status, headers, None
    return status, headers, json.loads(data_match.group(1))


def assert_(cond, msg):
    if not cond:
        fail.append(msg)
        print(f'  ❌ {msg}')
    else:
        print(f'  ✓ {msg}')


print('=== V1.8.5 MCP Server SSE E2E ===\n')

# ========== 1. Streamable - initialize ==========
print('[1] Streamable initialize:')
status, headers, data = streamable_call({
    'jsonrpc': '2.0', 'id': 1, 'method': 'initialize',
    'params': {'protocolVersion': '2024-11-05', 'capabilities': {}, 'clientInfo': {'name': 'e2e', 'version': '1.0'}}
})
ct = headers.get('Content-Type', '')
assert_(ct.startswith('text/event-stream'), f'Content-Type 是 text/event-stream (got {ct})')
assert_(status == 200, f'status 200 (got {status})')
assert_(data and data.get('id') == 1, f'response id=1')
assert_(data.get('result', {}).get('serverInfo', {}).get('name') == 'avm-mcp-server', f'serverInfo.name 正确')
print()

# ========== 2. Streamable - tools/list ==========
print('[2] Streamable tools/list:')
status, headers, data = streamable_call({'jsonrpc': '2.0', 'id': 2, 'method': 'tools/list', 'params': {}})
assert_(status == 200, f'200')
assert_(data and 'result' in data, f'有 result')
tools = data.get('result', {}).get('tools', [])
assert_(len(tools) >= 10, f'工具数 ≥ 10 (got {len(tools)})')
print()

# ========== 3. Streamable - tools/call ==========
print('[3] Streamable tools/call get_metrics:')
status, headers, data = streamable_call({'jsonrpc': '2.0', 'id': 3, 'method': 'tools/call', 'params': {'name': 'get_metrics', 'arguments': {}}})
assert_(status == 200, f'200')
assert_(data and 'result' in data, f'有 result')
content = data['result'].get('content', [])
assert_(len(content) > 0, f'content 不为空')
text = content[0].get('text', '') if content else ''
assert_('total' in text, f'result 含 total 字段 (text 长度 {len(text)})')
print(f'   text 长度: {len(text)}')
print()

# ========== 4. Streamable - create_work_item ==========
print('[4] Streamable tools/call create_work_item:')
status, headers, data = streamable_call({
    'jsonrpc': '2.0', 'id': 4, 'method': 'tools/call',
    'params': {'name': 'create_work_item', 'arguments': {
        'type': 'task', 'title': f'E2E-SSE-测试-{int(_t.time())}', 'priority': 'P2'
    }}
})
assert_(status == 200, f'200')
assert_(data and 'result' in data, f'有 result')
text = data['result']['content'][0]['text']
import re as _re
m = _re.search(r'"id":\s*"?([\w-]+)"?', text)
m_key = _re.search(r'"key":\s*"?([\w-]+)"?', text)
if m:
    e2e_ids.append(m.group(1))
assert_(m_key, f'返回了 key (匹配: {m_key.group(1) if m_key else "?"})')
print(f'   创建的 id: {e2e_ids[0] if e2e_ids else "?"} key: {m_key.group(1) if m_key else "?"}')
print()

# ========== 5. Streamable - resources/list ==========
print('[5] Streamable resources/list:')
status, headers, data = streamable_call({'jsonrpc': '2.0', 'id': 5, 'method': 'resources/list', 'params': {}})
assert_(status == 200 and data, f'200 + result')
resources = data.get('result', {}).get('resources', [])
assert_(len(resources) > 0, f'resources 数量 > 0 (got {len(resources)})')
if resources:
    assert_(resources[0].get('uri', '').startswith('avm://'), f'URI 格式正确')
print(f'   资源数: {len(resources)}')
print()

# ========== 6. Streamable - prompts/list ==========
print('[6] Streamable prompts/list:')
status, headers, data = streamable_call({'jsonrpc': '2.0', 'id': 6, 'method': 'prompts/list', 'params': {}})
assert_(status == 200 and data, f'200 + result')
prompts = data.get('result', {}).get('prompts', [])
assert_(len(prompts) >= 3, f'prompts ≥ 3 (got {len(prompts)})')
print(f'   模板数: {len(prompts)}')
print()

# ========== 7. Streamable - 错误处理 ==========
print('[7] Streamable 错误处理:')
# 未知方法
status, headers, data = streamable_call({'jsonrpc': '2.0', 'id': 7, 'method': 'foo/bar', 'params': {}})
assert_(status == 200, f'200 (错误也走 SSE 格式)')
assert_(data and 'error' in data, f'error 字段存在')
assert_(data['error'].get('code') == -32601, f'error code = -32601 (Method not found)')
# 缺 method
status, headers, data = streamable_call({'jsonrpc': '2.0', 'id': 8})
assert_(status == 200, f'缺 method 也 200')
assert_(data and data.get('error', {}).get('code') == -32700, f'error code = -32700 (Parse error)')
# 未知工具
status, headers, data = streamable_call({'jsonrpc': '2.0', 'id': 9, 'method': 'tools/call', 'params': {'name': 'nonexistent_tool', 'arguments': {}}})
assert_(status == 200, f'未知工具 200')
content = data['result']['content']
assert_(content[0].get('text', '').startswith('Tool not found'), f'isError 标记')
print()

# ========== 8. Streamable - notification (无 id) ==========
print('[8] Streamable notification (无 id):')
# 通知不应返回响应，body 应为空
data_body = json.dumps({'jsonrpc': '2.0', 'method': 'notifications/cancelled'}).encode('utf-8')
req = urllib.request.Request(f'{BASE}/api/mcp/stream', method='POST', data=data_body, headers={'Content-Type': 'application/json'})
r = urllib.request.urlopen(req, timeout=10)
body_text = r.read().decode('utf-8')
assert_(body_text.strip() == '', f'notification 返回空 body (got: "{body_text[:50]}")')
print()

# ========== 9. Legacy HTTP+SSE - GET /sse 立即发 endpoint ==========
print('[9] Legacy GET /api/mcp/sse:')
sock = socket.create_connection(('127.0.0.1', 4000), timeout=3)
sock.sendall(b'GET /api/mcp/sse HTTP/1.1\r\nHost: 127.0.0.1:4000\r\nAccept: text/event-stream\r\nConnection: close\r\n\r\n')
sock.settimeout(2)
buf = b''
try:
    while b'\r\n\r\n' not in buf or b'event: endpoint' not in buf:
        chunk = sock.recv(2048)
        if not chunk: break
        buf += chunk
        if b'event: endpoint' in buf and b'\n\n' in buf[buf.find(b'event: endpoint'):]:
            break
except socket.timeout:
    pass
sock.close()
text = buf.decode('utf-8', errors='ignore')
ct_line = [l for l in text.split('\r\n') if l.lower().startswith('content-type:')]
ct = ct_line[0].split(':', 1)[1].strip() if ct_line else ''
assert_('text/event-stream' in ct, f'Content-Type 是 text/event-stream (got {ct})')
assert_('event: endpoint' in text, f'event: endpoint 存在')
assert_('data: http' in text, f'data: http 包含 endpoint URL')
m = re.search(r'data: (http[^\s]+)', text)
session_id = re.search(r'sessionId=([\w-]+)', m.group(1) if m else '')
assert_(session_id, f'endpoint URL 含 sessionId')
session_id = session_id.group(1)
print(f'   sessionId: {session_id}')
print()

# ========== 10. Legacy POST /messages 通过 SSE 推响应 ==========
print('[10] Legacy POST /api/mcp/messages 通过 SSE 推响应:')
# 1) 建立 SSE 连接，收到 endpoint 后转给 reader 监听后续 message 事件
import threading, urllib.parse

sse_state = {'endpoint_url': None, 'response': None, 'ready': False, 'event': threading.Event()}

def sse_reader():
    sock = socket.create_connection(('127.0.0.1', 4000), timeout=10)
    sock.sendall(b'GET /api/mcp/sse HTTP/1.1\r\nHost: 127.0.0.1:4000\r\nAccept: text/event-stream\r\nConnection: keep-alive\r\n\r\n')
    sock.settimeout(8)
    buf = b''
    got_endpoint = False
    try:
        while True:
            chunk = sock.recv(4096)
            if not chunk: break
            buf += chunk
            if not got_endpoint:
                m = re.search(rb'event: endpoint\r?\ndata: (\S+)', buf)
                if m:
                    sse_state['endpoint_url'] = m.group(1).decode('utf-8')
                    sse_state['ready'] = True
                    sse_state['event'].set()
                    got_endpoint = True
            if got_endpoint and b'event: message' in buf:
                # 取最后一个 message 事件
                idx = buf.rfind(b'event: message')
                end = buf.find(b'\n\n', idx)
                if end >= 0:
                    sse_state['response'] = buf[idx:end+2].decode('utf-8', errors='ignore')
                    break
    except socket.timeout:
        pass
    sock.close()

t = threading.Thread(target=sse_reader, daemon=True)
t.start()
sse_state['event'].wait(timeout=5)
assert_(sse_state['endpoint_url'], f'拿到 endpoint URL: {sse_state["endpoint_url"]}')

# 2) POST /messages 用同一个 sessionId
parsed = urllib.parse.urlparse(sse_state['endpoint_url'])
msg_path = parsed.path + '?' + parsed.query
msg_body = json.dumps({
    'jsonrpc': '2.0', 'id': 99, 'method': 'tools/call',
    'params': {'name': 'get_metrics', 'arguments': {}}
}).encode('utf-8')
req = urllib.request.Request(f'http://127.0.0.1:4000{msg_path}', method='POST', data=msg_body, headers={'Content-Type': 'application/json'})
r = urllib.request.urlopen(req, timeout=10)
assert_(r.status == 202, f'POST /messages 返 202 (got {r.status})')

# 3) 等 SSE 推响应
t.join(timeout=5)
assert_(sse_state['response'], f'SSE 收到响应')
resp = sse_state['response']
assert_('event: message' in resp, f'SSE 含 event: message')
m = re.search(r'data: (.+)', resp)
if m:
    d = json.loads(m.group(1))
    assert_(d.get('id') == 99, f'响应 id=99 (got {d.get("id")})')
    assert_('result' in d, f'响应含 result')
    text = d['result']['content'][0]['text']
    assert_('total' in text, f'result 含 total')
    print(f'   收到 SSE 响应 (text 长度 {len(text)})')
print()

# ========== 11. 清理 E2E 创建的工作项 ==========
print('[11] 清理 E2E 创建的工作项:')
for wid in e2e_ids:
    try:
        req = urllib.request.Request(f'{BASE}/api/work-items/{wid}', method='DELETE')
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass
e2e_ids.clear()
print('   ✓')
print()

# ========== 总结 ==========
print('=' * 60)
if fail:
    print(f'❌ 失败 {len(fail)} 项:')
    for f in fail: print(f'  - {f}')
    sys.exit(1)
else:
    print('✅ 全部通过 — V1.8.5 MCP SSE OK')
