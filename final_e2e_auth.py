# -*- coding: utf-8 -*-
"""
V1.11 权限细化 E2E
==================
覆盖:
  1. 白名单 (health, users/login) 公开
  2. dev 模式无 token 自动放行 (tenant_admin)
  3. login 拿 token + 错密码 401
  4. 假 token 401
  5. tenant_admin (admin) 全权限 (DELETE 成功)
  6. space_admin (pm) DELETE 403, PATCH 200
  7. member (zhangsan) PATCH 403, GET 200
  8. logout 清 token, 复用旧 token 应 401
"""
import os
import sys
import json
import time
import urllib.request
import urllib.error

BASE = "http://localhost:4000/api"
PROJECTS = f"{BASE}/projects"
CUSTOMERS = f"{BASE}/customers"
USERS = f"{BASE}/users"

PASS = 0
FAIL = 0
ERRORS = []


def req(method, url, token=None, body=None, expect=None):
    """发请求, 期望 status 匹配 expect, 返回 (status, body_json)"""
    global PASS, FAIL
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    # V1.11: 显式 ASCII User-Agent 避免 Python 3.14 latin-1 头编码问题
    headers["User-Agent"] = "AVM-E2E/1.0"
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=10) as resp:
            status = resp.status
            raw = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        status = e.code
        raw = e.read().decode("utf-8")
    try:
        j = json.loads(raw) if raw else None
    except Exception:
        j = raw
    if expect is not None:
        ok = (status == expect) if not isinstance(expect, (list, tuple)) else (status in expect)
        label = "OK" if ok else "FAIL"
        if ok:
            PASS += 1
        else:
            FAIL += 1
            ERRORS.append(f"{method} {url} expected={expect} got={status} body={raw[:200]}")
        print(f"  [{label}] {method} {url.replace(BASE, '')}  expect={expect} got={status}")
    return status, j


def login(username, password):
    s, b = req("POST", f"{BASE}/users/login", body={"username": username, "password": password}, expect=200)
    return b["token"], b["user"]


def main():
    print("=" * 60)
    print("V1.11 权限细化 E2E")
    print("=" * 60)

    # ===== 1. 白名单 =====
    print("\n[1] 白名单 (公开端点)")
    req("GET", f"{BASE}/health", expect=200)
    req("POST", f"{BASE}/users/login", body={"username": "x", "password": "x"}, expect=401)  # 错密码 401 但路径通了

    # ===== 2. dev 模式无 token 自动放行 =====
    print("\n[2] dev 模式无 token 视作 dev-user tenant_admin")
    s, b = req("GET", PROJECTS, expect=200)
    assert isinstance(b, list) and len(b) > 0, f"projects list empty: {b}"
    test_proj = b[0]
    pid = test_proj["id"]
    print(f"  → 首个 project: {test_proj.get('code')} ({pid})")

    # ===== 3. login 拿 token =====
    print("\n[3] login 拿 token")
    admin_token, admin = login("admin", "admin123")
    pm_token, pm = login("pm", "pm123")
    zs_token, zs = login("lisi", "123456")
    print(f"  admin role={admin['role']} | pm role={pm['role']} | lisi role={zs['role']}")
    assert admin["role"] == "tenant_admin", "admin 应是 tenant_admin"
    assert pm["role"] == "space_admin", "pm 应是 space_admin"
    assert zs["role"] == "member", "lisi 应是 member"

    # 错密码
    req("POST", f"{BASE}/users/login", body={"username": "admin", "password": "wrong"}, expect=401)

    # ===== 4. 假 token =====
    print("\n[4] 假 token 应 401")
    req("GET", PROJECTS, token="0" * 64, expect=401)

    # ===== 5. tenant_admin 全权限 (admin) =====
    print("\n[5] admin (tenant_admin) GET/POST/PATCH/DELETE 全通")
    req("GET", PROJECTS, token=admin_token, expect=200)
    req("GET", f"{PROJECTS}/{pid}", token=admin_token, expect=200)
    # PATCH
    s, b = req("PATCH", f"{PROJECTS}/{pid}", token=admin_token, body={"description": "admin patch test"}, expect=200)
    assert b.get("description") == "admin patch test", f"PATCH 没生效: {b}"
    # POST 创建
    s, newp = req("POST", PROJECTS, token=admin_token, body={
        "code": f"AUTH-TEST-{int(time.time())}",
        "name": "AUTH TEST",
        "customerId": test_proj["customerId"],
        "carModelId": test_proj["carModelId"],
        "billingType": "ODC",
        "contractAmount": 0,
        "budgetHours": 0,
        "consumedHours": 0,
        "status": "planning",
        "risk": "low",
        "progress": 0,
        "startDate": "2026-08-01T00:00:00Z",
        "endDate": "2026-12-31T00:00:00Z",
        "pmUserId": pm["id"],
        "createdBy": admin["id"],
    }, expect=201)
    new_id = newp["id"]
    # DELETE
    req("DELETE", f"{PROJECTS}/{new_id}", token=admin_token, expect=200)
    # 确认删了
    req("GET", f"{PROJECTS}/{new_id}", token=admin_token, expect=404)

    # ===== 6. space_admin DELETE 应 403 =====
    print("\n[6] pm (space_admin) DELETE 应 403, PATCH 200")
    s, b = req("POST", PROJECTS, token=admin_token, body={
        "code": f"AUTH-DEL-{int(time.time())}",
        "name": "AUTH DEL TEST",
        "customerId": test_proj["customerId"],
        "carModelId": test_proj["carModelId"],
        "billingType": "ODC",
        "contractAmount": 0,
        "budgetHours": 0,
        "consumedHours": 0,
        "status": "planning",
        "risk": "low",
        "progress": 0,
        "startDate": "2026-08-01T00:00:00Z",
        "endDate": "2026-12-31T00:00:00Z",
        "pmUserId": pm["id"],
        "createdBy": admin["id"],
    }, expect=201)
    del_id = b["id"]
    req("DELETE", f"{PROJECTS}/{del_id}", token=pm_token, expect=403)
    s, b = req("PATCH", f"{PROJECTS}/{del_id}", token=pm_token, body={"description": "pm patch OK"}, expect=200)
    assert b.get("description") == "pm patch OK", f"pm PATCH 没生效: {b}"
    # pm 清理
    req("DELETE", f"{PROJECTS}/{del_id}", token=admin_token, expect=200)

    # ===== 7. member GET 通, PATCH 403, POST 403 =====
    print("\n[7] lisi (member) GET 200, PATCH 403, POST 403, DELETE 403")
    req("GET", PROJECTS, token=zs_token, expect=200)
    req("GET", f"{PROJECTS}/{pid}", token=zs_token, expect=200)
    req("PATCH", f"{PROJECTS}/{pid}", token=zs_token, body={"description": "member try"}, expect=403)
    req("POST", PROJECTS, token=zs_token, body={"code": "X", "name": "X"}, expect=403)
    req("DELETE", f"{PROJECTS}/{pid}", token=zs_token, expect=403)

    # ===== 8. logout 清 token =====
    print("\n[8] logout 清 token, 复用旧 token 应 401")
    # 临时登录拿个一次性 token
    once_token, _ = login("tester", "123456")
    req("GET", PROJECTS, token=once_token, expect=200)
    # logout
    req("POST", f"{BASE}/users/logout", token=once_token, expect=200)
    # 再用旧 token 应该 401
    req("GET", PROJECTS, token=once_token, expect=401)

    # ===== 9. PATCH 同样对 dependencies / resources 适用 =====
    print("\n[9] autoRole 同样保护其他核心业务路由")
    # 找 1 个 dep
    s, deps = req("GET", f"{BASE}/dependencies", expect=200)
    if isinstance(deps, list) and len(deps) > 0:
        dep_id = deps[0]["id"]
        # member 不能 PATCH dep
        ww_token, ww_user = login("wangwu", "123456")
        if ww_user["role"] == "member":
            req("PATCH", f"{BASE}/dependencies/{dep_id}", token=ww_token, body={"description": "member try"}, expect=403)
            print(f"  → member PATCH dep 已 403 拒绝")
        # pm PATCH 应通
        s, dep_after = req("PATCH", f"{BASE}/dependencies/{dep_id}", token=pm_token, body={"description": "pm dep patch"}, expect=200)
        if isinstance(dep_after, dict):
            print(f"  → pm PATCH dep 成功: {dep_after.get('description')}")
    else:
        print("  (无 dependencies 跳过)")

    # ===== 10. resources POST 也受 autoRole 保护 =====
    print("\n[10] resources POST member 应 403 (lisi 是 member)")
    ls_token, ls_user = login("lisi", "123456")
    if ls_user["role"] == "member":
        req("POST", f"{BASE}/resources/allocations", token=ls_token, body={
            "userId": "lisi", "userName": "李四",
            "workItemId": "x", "workItemKey": "X", "workItemTitle": "X",
            "startDate": "2026-08-01", "endDate": "2026-08-02",
            "allocatedHours": 8, "type": "task",
        }, expect=403)

    # 总结
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
