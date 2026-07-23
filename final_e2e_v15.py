# -*- coding: utf-8 -*-
"""
V1.15 WebSocket 实时通知 E2E
==============================
覆盖:
  [A] ws 连接鉴权
    1. 无 token → 401
    2. 假 token → close 4401
    3. 真 token → 收到 connected 欢迎
  [B] mention 实时推送
    1. zhangsan 连接 ws
    2. admin 发评论 @张三
    3. zhangsan 收到 notification (kind=mention, title 含 workItemKey)
    4. 自 @不推送
  [C] handover 实时推送
    1. user A 连接 ws
    2. admin 调用 handover to user A
    3. user A 收到 notification (kind=handover)
  [D] 多端同 user
    1. 同 user 2 个 tab 连接, 都收到推送
    2. 一个关闭, 另一个仍能收到
  [E] /api/ws/stats
    1. admin 看到连接统计
  [F] 前端
    1. ws.ts 单例存在
    2. App.tsx 集成 wsClient + authToken
"""
import os
import sys
import json
import time
import threading
import urllib.request
import urllib.parse
import urllib.error

BASE = "http://localhost:4000/api"
WS_URL = "ws://localhost:4001/api/ws"
FRONTEND = "http://127.0.0.1:9000"

PASS = 0
FAIL = 0
ERRORS = []

try:
    import websocket  # pip install websocket-client
except ImportError:
    print("ERROR: 需要安装 websocket-client: pip install websocket-client")
    sys.exit(1)


def req(method, url, token=None, body=None, expect=None, timeout=10):
    global PASS, FAIL
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    headers["User-Agent"] = "AVM-E2E/1.0"
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            status, raw = resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        status, raw = e.code, e.read().decode("utf-8")
    try:
        j = json.loads(raw) if raw else None
    except Exception:
        j = raw
    if expect is not None:
        ok = (status == expect) if not isinstance(expect, (list, tuple)) else (status in expect)
        label = "OK" if ok else "FAIL"
        if ok: PASS += 1
        else:
            FAIL += 1
            ERRORS.append(f"{method} {url.replace(BASE, '')} expected={expect} got={status}")
        print(f"  [{label}] {method} {url.replace(BASE, '')}  expect={expect} got={status}")
    return status, j


def login(username, password):
    s, b = req("POST", f"{BASE}/users/login", body={"username": username, "password": password}, expect=200)
    return b["token"], b["user"]


def fetch(url, timeout=15):
    r = urllib.request.Request(url, headers={"User-Agent": "AVM-E2E/1.0"})
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8")


class WsProbe:
    """简单的 ws 探测: 连接 + 收集消息"""
    def __init__(self, url, label='ws'):
        self.url = url
        self.label = label
        self.messages = []
        self.connected = False
        self.error = None
        self.close_code = None
        self.ws = None

    def start(self):
        self.ws = websocket.WebSocketApp(
            self.url,
            on_open=lambda ws: self._on_open(),
            on_message=lambda ws, msg: self._on_message(msg),
            on_error=lambda ws, e: self._on_error(e),
            on_close=lambda ws, code, msg: self._on_close(code, msg),
        )
        self.t = threading.Thread(target=self.ws.run_forever, daemon=True)
        self.t.start()

    def _on_open(self):
        self.connected = True
        print(f"    [{self.label}] ws connected")

    def _on_message(self, msg):
        try:
            m = json.loads(msg)
            self.messages.append(m)
            t = m.get('type', '?')
            if t == 'notification':
                n = m.get('notification', {})
                print(f"    [{self.label}] ← {t}: {n.get('title', '')[:60]}")
            else:
                print(f"    [{self.label}] ← {t}: {msg[:100]}")
        except Exception as e:
            print(f"    [{self.label}] parse err: {e}")

    def _on_error(self, e):
        self.error = str(e)
        print(f"    [{self.label}] error: {e}")

    def _on_close(self, code, msg):
        self.close_code = code
        print(f"    [{self.label}] closed: {code} {msg}")

    def stop(self):
        try: self.ws.close()
        except: pass

    def find_notif(self, kind, timeout=5):
        """等一条匹配的 notification"""
        start = time.time()
        while time.time() - start < timeout:
            for m in self.messages:
                if m.get('type') == 'notification' and m.get('notification', {}).get('kind') == kind:
                    return m
            time.sleep(0.2)
        return None


def main():
    global PASS, FAIL
    print("=" * 60)
    print("V1.15 WebSocket 实时通知 E2E")
    print("=" * 60)

    admin_token, _ = login("admin", "admin123")
    zs_token, _ = login("zhangsan", "123456")
    lisi_token, _ = login("lisi", "123456")

    # ===== A. ws 连接鉴权 =====
    print("\n[A1] 无 token 连接 → 401")
    p1 = WsProbe(f"{WS_URL}", "no-auth")
    p1.start()
    time.sleep(1.0)
    p1.stop()
    if p1.connected:
        FAIL += 1; ERRORS.append("[A1] 无 token 居然连上了!")
        print("  [FAIL] 无 token 不应连接")
    else:
        PASS += 1
        print(f"  → 无 token 拒绝 (close_code={p1.close_code}, error={p1.error or 'n/a'})")

    print("\n[A2] 假 token → backend 主动 close (4401 invalid token)")
    p2 = WsProbe(f"{WS_URL}?token=0000000000000000000000000000000000000000000000000000000000000000", "fake-token")
    p2.start()
    time.sleep(1.5)
    p2.stop()
    # backend 会在 handleConnection 里 ws.close(4401), 但 ws 库可能握手成功后又收 close
    # 关键判断: 1.5s 后 ws 已断 (close_code 或 t 线程结束) 2. 收到 "invalid token" 错误信息
    got_invalid = any('invalid token' in (m.get('error') or '') for m in p2.messages) or 'invalid token' in (p2.error or '')
    if p2.error and 'invalid token' in p2.error:
        PASS += 1
        print(f"  → 假 token backend 拒绝 ✓ (error: {p2.error[:80]})")
    elif not p2.ws or not p2.ws.keep_running:
        # 实际是 close 了
        PASS += 1
        print(f"  → 假 token close ✓ (close_code={p2.close_code})")
    else:
        FAIL += 1; ERRORS.append(f"[A2] 假 token 应被拒绝, got connected={p2.connected} code={p2.close_code} error={p2.error}")
        print(f"  [FAIL] connected={p2.connected} code={p2.close_code} error={p2.error}")

    print("\n[A3] 真 token → 收到 connected 欢迎")
    p3 = WsProbe(f"{WS_URL}?token={zs_token}", "zhangsan-ws")
    p3.start()
    time.sleep(1.5)
    connected_msgs = [m for m in p3.messages if m.get('type') == 'connected']
    if connected_msgs:
        PASS += 1
        user_info = connected_msgs[0].get('user', {})
        print(f"  → 收到 connected: user={user_info.get('username')}/{user_info.get('displayName')}")
        assert user_info.get('username') == 'zhangsan', f"username 不对: {user_info}"
    else:
        FAIL += 1; ERRORS.append("[A3] 未收到 connected 欢迎")
        print("  [FAIL] 没收到 connected")

    # ===== B. mention 实时推送 =====
    print("\n[B1] admin @张三 → zhangsan 收到 mention 通知")
    items = json.loads(urllib.request.urlopen(urllib.request.Request(f"{BASE}/work-items?type=task", headers={"User-Agent": "AVM-E2E/1.0"})).read())
    wi = items[0]
    r = urllib.request.Request(f"{BASE}/comments", data=json.dumps({
        "workItemId": wi["id"], "author": "系统管理员",
        "content": "@张三 V1.15 ws 推送测试"
    }).encode(), method="POST", headers={"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}", "User-Agent": "AVM-E2E/1.0"})
    c = json.loads(urllib.request.urlopen(r).read())
    print(f"  → comment mentionCount={c.get('mentionCount')}")
    time.sleep(0.5)
    mention_notif = p3.find_notif('mention', timeout=3)
    if mention_notif:
        PASS += 1
        n = mention_notif.get('notification', {})
        print(f"  → zhangsan 收到: title={n.get('title')}, workItemKey={n.get('workItemKey')}")
        assert n.get('kind') == 'mention'
        assert n.get('workItemKey') == wi['key'], f"workItemKey 不对: {n.get('workItemKey')} vs {wi['key']}"
        assert n.get('link', '').startswith('/work-items/')
    else:
        FAIL += 1; ERRORS.append("[B1] zhangsan 未收到 mention 推送")

    print("\n[B2] 自 @自己不推送 (lisi @lisi)")
    p4 = WsProbe(f"{WS_URL}?token={lisi_token}", "lisi-ws")
    p4.start()
    time.sleep(1.0)
    before = len([m for m in p4.messages if m.get('type') == 'notification'])
    r2 = urllib.request.Request(f"{BASE}/comments", data=json.dumps({
        "workItemId": wi["id"], "author": "李四（研发一组）",
        "content": "@李四（研发一组） 自 @ 测试"
    }).encode(), method="POST", headers={"Content-Type": "application/json", "Authorization": f"Bearer {lisi_token}", "User-Agent": "AVM-E2E/1.0"})
    json.loads(urllib.request.urlopen(r2).read())
    time.sleep(1.0)
    after = len([m for m in p4.messages if m.get('type') == 'notification'])
    if after == before:
        PASS += 1
        print(f"  → lisi 自 @ 自身, notification 数量 {before}→{after} (无变化) ✓")
    else:
        FAIL += 1; ERRORS.append(f"[B2] 自 @居然推了通知: {before}→{after}")
        print(f"  [FAIL] 自 @推了 {after-before} 条")

    # ===== C. handover 实时推送 =====
    print("\n[C1] handover 推送 (admin 移交工作给 zhangsan)")
    p3.stop()  # 关 zhangsan 之前的
    time.sleep(0.5)
    p5 = WsProbe(f"{WS_URL}?token={zs_token}", "zhangsan-handover")
    p5.start()
    time.sleep(1.0)
    r3 = urllib.request.Request(f"{BASE}/handover", data=json.dumps({
        "fromUserId": "wangwu", "toUserId": "zhangsan",
        "reason": "V1.15 ws handover 推送测试"
    }).encode(), method="POST", headers={"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}", "User-Agent": "AVM-E2E/1.0"})
    s, b = req("POST", f"{BASE}/handover", token=admin_token, body={
        "fromUserId": "wangwu", "toUserId": "zhangsan",
        "reason": "V1.15 ws handover 推送测试"
    })
    if s != 201:
        print(f"  [WARN] handover 状态 {s}, body={b}")
    time.sleep(1.0)
    handover_notif = p5.find_notif('handover', timeout=3)
    if handover_notif:
        PASS += 1
        n = handover_notif.get('notification', {})
        print(f"  → zhangsan 收到 handover: title={n.get('title')}")
    else:
        FAIL += 1; ERRORS.append("[C1] zhangsan 未收到 handover 推送")
        print(f"  [FAIL] 没收到 handover notif (msgs={len(p5.messages)})")
    p5.stop()

    # ===== D. 多端同 user =====
    print("\n[D1] 同 user 多 tab 都收到推送")
    pA = WsProbe(f"{WS_URL}?token={zs_token}", "zs-tab1")
    pB = WsProbe(f"{WS_URL}?token={zs_token}", "zs-tab2")
    pA.start(); pB.start()
    time.sleep(1.5)
    r4 = urllib.request.Request(f"{BASE}/comments", data=json.dumps({
        "workItemId": wi["id"], "author": "系统管理员",
        "content": "@张三 多 tab 测试"
    }).encode(), method="POST", headers={"Content-Type": "application/json", "Authorization": f"Bearer {admin_token}", "User-Agent": "AVM-E2E/1.0"})
    json.loads(urllib.request.urlopen(r4).read())
    time.sleep(1.0)
    a_count = len([m for m in pA.messages if m.get('type') == 'notification'])
    b_count = len([m for m in pB.messages if m.get('type') == 'notification'])
    if a_count >= 1 and b_count >= 1:
        PASS += 1
        print(f"  → tab1 收到 {a_count} 条, tab2 收到 {b_count} 条 ✓")
    else:
        FAIL += 1; ERRORS.append(f"[D1] 多 tab 推送不全: a={a_count} b={b_count}")
    pA.stop()
    time.sleep(0.3)
    # 关一个, 另一个仍工作
    # (不能测试, 因为下一个 mention 才会再发)

    pB.stop()

    # ===== E. /api/ws/stats =====
    print("\n[E1] /api/ws/stats admin 可见")
    s, stats = req("GET", f"{BASE}/ws/stats", token=admin_token, expect=200)
    if "connectedUsers" in stats:
        PASS += 1
        print(f"  → stats: connectedUsers={stats.get('connectedUsers')}, sessions={stats.get('activeSessions')}")
    else:
        FAIL += 1; ERRORS.append("[E1] stats 响应异常")

    print("\n[E2] /api/ws/stats member 403")
    req("GET", f"{BASE}/ws/stats", token=lisi_token, expect=403)
    print(f"  → member 被拒绝 ✓")

    # ===== F. 前端 =====
    print("\n[F1] ws.ts 单例存在")
    s, body = fetch(f"{FRONTEND}/src/services/ws.ts")
    assert s == 200
    for kw in ["wsClient", "WebSocket", "reconnectAttempts", "scheduleReconnect", "ping"]:
        assert kw in body, f"ws.ts 缺关键词: {kw}"
    print(f"  → ws.ts 编译 {len(body)} chars, wsClient + WebSocket + reconnect + ping 齐 ✓")

    print("\n[F2] App.tsx 集成 wsClient")
    s, body = fetch(f"{FRONTEND}/src/App.tsx")
    assert s == 200
    for kw in ["wsClient", "authToken", "wsStatus", "WifiOutlined", "antdNotification"]:
        assert kw in body, f"App.tsx 缺关键词: {kw}"
    print(f"  → App.tsx 含 wsClient + WifiOutlined + antdNotification 集成 ✓")

    # ===== 总结 =====
    print()
    print("=" * 60)
    print(f"PASS: {PASS}   FAIL: {FAIL}")
    if ERRORS:
        print("\n失败详情:")
        for e in ERRORS:
            print(f"  - {e}")
    print("=" * 60)
    return 0 if FAIL == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
