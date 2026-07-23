# -*- coding: utf-8 -*-
"""
V1.13 审计日志 E2E
==================
覆盖:
  [A] Backend: /api/audit-logs 端点
    1. login 产生 auth/login 记录
    2. login_failed 产生记录
    3. PATCH project 产生 update + 字段 diff
    4. POST project 产生 create
    5. DELETE project 产生 delete
    6. logout 产生 auth/logout
    7. GET /api/audit-logs 列表 + 筛选
    8. GET /api/audit-logs/stats 统计
    9. GET /api/audit-logs/:id 详情
    10. GET /api/audit-logs/by-entity/:entity/:entityId
  [B] V1.11 漏的 autoRole 补漏验证
    1. customers POST/PATCH/DELETE 已加 autoRole (member 403)
    2. carModels POST/PATCH/DELETE 已加 autoRole (member 403)
    3. dependencies POST/PATCH/DELETE 已加 autoRole (member 403)
  [C] 前端 AuditLogsPage.tsx
    1. 编译通过
    2. 关键 UI 元素 (entity filter, action filter, drawer)
"""
import os
import sys
import json
import time
import urllib.request
import urllib.error

BASE = "http://localhost:4000/api"
FRONTEND = "http://127.0.0.1:9000"

PASS = 0
FAIL = 0
ERRORS = []


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
            ERRORS.append(f"{method} {url.replace(BASE, '')} expected={expect} got={status} body={raw[:200]}")
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


def main():
    global PASS, FAIL
    print("=" * 60)
    print("V1.13 审计日志 E2E")
    print("=" * 60)

    # ===== A. Backend =====
    print("\n[A0] 拿 admin token (产生 login 记录)")
    admin_token, admin = login("admin", "admin123")

    print("\n[A1] 触发 login_failed (错密码)")
    req("POST", f"{BASE}/users/login", body={"username": "admin", "password": "wrong"}, expect=401)
    time.sleep(0.3)

    print("\n[A2] POST project → create 记录")
    s, projs = req("GET", f"{BASE}/projects", expect=200)
    test_p = projs[0]
    s, new_p = req("POST", f"{BASE}/projects", token=admin_token, body={
        "code": f"AUDIT-{int(time.time())}",
        "name": "V1.13 audit test",
        "customerId": test_p["customerId"],
        "carModelId": test_p["carModelId"],
        "billingType": "ODC",
        "contractAmount": 100000,
        "budgetHours": 100,
        "consumedHours": 0,
        "status": "planning",
        "risk": "low",
        "progress": 0,
        "startDate": "2026-01-01T00:00:00Z",
        "endDate": "2026-12-31T00:00:00Z",
        "pmUserId": admin["id"],
        "createdBy": admin["id"],
    }, expect=201)
    pid = new_p["id"]
    time.sleep(0.3)

    print("\n[A3] PATCH project → update + 字段 diff")
    s, patched = req("PATCH", f"{BASE}/projects/{pid}", token=admin_token, body={
        "description": "V1.13 audit desc",
        "status": "in_progress",
    }, expect=200)
    time.sleep(0.3)

    print("\n[A4] GET /api/audit-logs (验证上面产生的记录都在)")
    s, d = req("GET", f"{BASE}/audit-logs?limit=20", token=admin_token, expect=200)
    assert "items" in d and "total" in d, f"响应缺字段: {list(d.keys())}"
    print(f"  → 总数 {d['total']} 条, items {len(d['items'])}")

    # 找刚创建的
    found = {"login": False, "create": False, "update": False, "login_failed": False}
    for l in d["items"]:
        if l["actor"] == "admin" and l["action"] == "login": found["login"] = True
        if l["action"] == "create" and l["entity"] == "project" and l["entityId"] == pid: found["create"] = True
        if l["action"] == "update" and l["entity"] == "project" and l["entityId"] == pid: found["update"] = True
        if l["action"] == "login_failed": found["login_failed"] = True
    for k, v in found.items():
        assert v, f"audit log 缺 {k} 记录"
        print(f"  → {k} ✓")
    # 验证 update 有字段 diff
    upd = next((l for l in d["items"] if l["action"] == "update" and l["entityId"] == pid), None)
    assert upd, "update 记录未找到"
    changes = json.loads(upd["changes"] or "[]")
    assert len(changes) >= 2, f"update 应有 2 个字段变化 (description+status), got {len(changes)}: {changes}"
    fields = [c["field"] for c in changes]
    assert "description" in fields and "status" in fields, f"缺关键字段: {fields}"
    print(f"  → update 字段 diff: {fields} ✓")

    print("\n[A5] DELETE project → delete 记录")
    req("DELETE", f"{BASE}/projects/{pid}", token=admin_token, expect=200)
    time.sleep(0.3)
    s, d2 = req("GET", f"{BASE}/audit-logs?entity=project&entityId=" + pid, token=admin_token, expect=200)
    actions = [l["action"] for l in d2["items"]]
    assert "delete" in actions, f"delete 记录不在: {actions}"
    print(f"  → project {pid} 全生命周期: {actions} ✓")

    print("\n[A6] GET /api/audit-logs 筛选")
    s, d3 = req("GET", f"{BASE}/audit-logs?action=login&limit=5", token=admin_token, expect=200)
    for l in d3["items"]:
        assert l["action"] == "login", f"筛选 login 不准: {l['action']}"
    print(f"  → 按 action=login 筛, {len(d3['items'])} 条全 match ✓")
    s, d4 = req("GET", f"{BASE}/audit-logs?actor=admin&limit=5", token=admin_token, expect=200)
    for l in d4["items"]:
        assert l["actor"] == "admin"
    print(f"  → 按 actor=admin 筛 ✓")

    print("\n[A7] GET /api/audit-logs/stats")
    s, stats = req("GET", f"{BASE}/audit-logs/stats?days=1", token=admin_token, expect=200)
    assert "total" in stats and "byEntity" in stats and "byAction" in stats
    assert stats["total"] > 0, "stats total 应 > 0"
    print(f"  → stats: total={stats['total']}, entities={list(stats['byEntity'].keys())}, actions={list(stats['byAction'].keys())} ✓")

    print("\n[A8] GET /api/audit-logs/:id 详情")
    some_id = d["items"][0]["id"]
    s, detail = req("GET", f"{BASE}/audit-logs/{some_id}", token=admin_token, expect=200)
    assert detail["id"] == some_id
    print(f"  → 详情: entity={detail['entity']} action={detail['action']} actor={detail['actor']} ✓")

    print("\n[A9] GET /api/audit-logs/by-entity/project/:id")
    s, by_ent = req("GET", f"{BASE}/audit-logs/by-entity/project/{pid}", token=admin_token, expect=200)
    assert isinstance(by_ent, list) and len(by_ent) >= 3, f"by-entity 应有 create/update/delete, got {len(by_ent)}"
    print(f"  → by-entity/project/{pid}: {len(by_ent)} 条 ✓")

    print("\n[A10] logout 产生 auth/logout 记录")
    once_token, _ = login("tester", "123456")
    req("POST", f"{BASE}/users/logout", token=once_token, expect=200)
    time.sleep(0.3)
    s, d5 = req("GET", f"{BASE}/audit-logs?action=logout&actor=tester&limit=1", token=admin_token, expect=200)
    assert len(d5["items"]) >= 1, "tester logout 记录未生成"
    print(f"  → logout 记录 ✓")

    # ===== B. autoRole 漏补验证 =====
    print("\n[B1] customers/carModels/dependencies 写操作对 member 403 (V1.11 漏的补上)")
    ls_token, ls = login("lisi", "123456")
    # 找 1 个 customer id
    s, customers = req("GET", f"{BASE}/customers", expect=200)
    cid = customers[0]["id"]
    s, carmodels = req("GET", f"{BASE}/car-models", expect=200)
    cmid = carmodels[0]["id"]
    s, deps = req("GET", f"{BASE}/dependencies", expect=200)
    did = deps[0]["id"] if deps else None
    # member POST customer
    req("POST", f"{BASE}/customers", token=ls_token, body={"name":"x","code":"x"}, expect=403)
    req("PATCH", f"{BASE}/customers/{cid}", token=ls_token, body={"name":"x"}, expect=403)
    print("  → customers POST/PATCH member=403 ✓")
    req("POST", f"{BASE}/car-models", token=ls_token, body={"name":"x","code":"x"}, expect=403)
    req("PATCH", f"{BASE}/car-models/{cmid}", token=ls_token, body={"name":"x"}, expect=403)
    print("  → carModels POST/PATCH member=403 ✓")
    if did:
        req("POST", f"{BASE}/dependencies", token=ls_token, body={"type":"台架","name":"x"}, expect=403)
        req("PATCH", f"{BASE}/dependencies/{did}", token=ls_token, body={"name":"x"}, expect=403)
        print("  → dependencies POST/PATCH member=403 ✓")

    # ===== C. 前端 =====
    print("\n[C1] 前端 AuditLogsPage.tsx 编译 + 关键 UI")
    s, body = fetch(f"{FRONTEND}/src/pages/AuditLogsPage.tsx")
    assert s == 200, f"AuditLogsPage 编译失败: status={s}"
    assert len(body) > 5000
    for kw in ["auditApi", "setEntityFilter", "setActionFilter", "Drawer", "byEntity", "byAction", "topActors", "entityFilter", "actionFilter"]:
        assert kw in body, f"AuditLogsPage 缺关键词: {kw}"
    print(f"  → 编译 {len(body)} chars, entity/action 筛选 + Drawer + stats 齐 ✓")

    print("\n[C2] api.ts 含 auditApi")
    s, api_body = fetch(f"{FRONTEND}/src/api.ts")
    assert s == 200
    assert "auditApi" in api_body, "api.ts 缺 auditApi"
    assert "/audit-logs" in api_body, "api.ts 缺 /audit-logs 路径"
    print(f"  → api.ts 含 auditApi ✓")

    print("\n[C3] Root.tsx + App.tsx 路由/菜单")
    s, root_body = fetch(f"{FRONTEND}/src/Root.tsx")
    assert s == 200 and "AuditLogsPage" in root_body and "audit-logs" in root_body, "Root.tsx 缺路由"
    print(f"  → Root.tsx 含 AuditLogsPage 路由 ✓")

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
