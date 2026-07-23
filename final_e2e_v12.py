# -*- coding: utf-8 -*-
"""
V1.12 E2E: 甘特图依赖连线 + 用户管理 UI + Docker 化
====================================================
覆盖:
  [A] 甘特图依赖连线 (V1.12.1)
    1. /api/work-items/gantt 返回 relations 数组
    2. relations 字段结构正确 (id/fromId/toId/type)
    3. summary.relationCount 一致
    4. WorkItemRelation 端点 (POST/DELETE)
    5. 前端 GanttPage.tsx 编译含 SVG 画线逻辑
  [B] 用户管理 UI (V1.12.2)
    1. users GET 列表
    2. users PATCH role 仅 admin
    3. users POST 创建仅 admin
    4. users DELETE 仅 admin
    5. 前端 UsersPage.tsx 编译 + 含关键 UI (改角色/重置密码/启停)
  [C] Docker 化 (V1.12.3)
    1. backend/Dockerfile 存在
    2. frontend/Dockerfile 存在
    3. frontend/nginx.conf 存在 (/api 反代 + MCP SSE)
    4. docker-compose.yml 存在 (双服务)
    5. .dockerignore 存在
    6. DEPLOY.md 存在
"""
import os
import sys
import json
import time
import urllib.request
import urllib.error

BASE = "http://localhost:4000/api"
FRONTEND = "http://127.0.0.1:9000"
PROJECT_ROOT = r"D:\AI\飞书项目\avm-demo"

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


def file_exists(rel):
    return os.path.isfile(os.path.join(PROJECT_ROOT, rel))


def file_contains(rel, needle):
    full = os.path.join(PROJECT_ROOT, rel)
    if not os.path.isfile(full): return False
    with open(full, "r", encoding="utf-8", errors="ignore") as f:
        return needle in f.read()


def main():
    global PASS, FAIL
    print("=" * 60)
    print("V1.12 甘特图依赖连线 + 用户管理 UI + Docker 化")
    print("=" * 60)

    # ===== A. 甘特图依赖连线 =====
    print("\n[A1] /api/work-items/gantt 返回 relations 数组")
    s, d = req("GET", f"{BASE}/work-items/gantt?projectCode=AVM-GALAXY-L7-2026", expect=200)
    assert isinstance(d, dict), f"gantt 响应不是 dict: {d}"
    assert "relations" in d, f"gantt 缺 relations 字段: keys={list(d.keys())}"
    assert isinstance(d["relations"], list), f"relations 不是 list: {type(d['relations'])}"
    print(f"  → relations count: {len(d['relations'])}")

    print("\n[A2] relations 字段结构正确")
    if d["relations"]:
        rel = d["relations"][0]
        for f in ["id", "fromId", "toId", "type"]:
            assert f in rel, f"relation 缺字段 {f}: {rel}"
        print(f"  → 字段齐全 (id, fromId, toId, type)")
    else:
        print(f"  (无 relations, 跳过结构校验)")

    print("\n[A3] summary.relationCount 与 relations 数量一致")
    s_count = d.get("summary", {}).get("relationCount", -1)
    r_count = len(d["relations"])
    assert s_count == r_count, f"summary.relationCount={s_count} != len(relations)={r_count}"
    print(f"  → summary.relationCount={s_count} == len(relations)={r_count} ✓")

    print("\n[A4] WorkItemRelation 端点 (POST/DELETE)")
    # 找 2 个 work item 创建 relation
    items = d.get("items", [])
    if len(items) >= 2:
        from_id, to_id = items[0]["id"], items[1]["id"]
        # 删已有 same-type 同 from-to 避免 unique 冲突
        admin_token, _ = login("admin", "admin123")
        s, created = req("POST", f"{BASE}/work-items/{from_id}/relations", token=admin_token, body={
            "toId": to_id, "relationType": "test_e2e"
        }, expect=201)
        rel_id = created["id"]
        print(f"  → 创建 relation: {from_id} -> {to_id} ({created.get('relationType')})")
        # 验证出现在 gantt
        s, d2 = req("GET", f"{BASE}/work-items/gantt?projectCode=AVM-GALAXY-L7-2026", expect=200)
        found = any(r["id"] == rel_id for r in d2["relations"])
        assert found, f"新创建的 relation {rel_id} 未出现在 gantt 响应"
        print(f"  → gantt 响应中能找到新 relation ✓")
        # 删
        s, _ = req("DELETE", f"{BASE}/work-items/{from_id}/relations/{rel_id}", token=admin_token, expect=204)
        print(f"  → 删除 relation OK")
    else:
        print("  (items 不足 2, 跳过 relation 端点测试)")

    print("\n[A5] 前端 GanttPage.tsx 编译 + SVG 依赖连线逻辑")
    s, body = fetch(f"{FRONTEND}/src/pages/GanttPage.tsx")
    assert s == 200, f"GanttPage 编译失败: status={s}"
    assert len(body) > 10000, f"GanttPage 编译产物太短: {len(body)}"
    # V1.12.1 关键标记 (Vite 把 TS interface 擦掉了, 用最稳定的关键字)
    assert "marker" in body, "GanttPage 缺 SVG 箭头 marker"
    assert "markerEnd" in body or "marker-end" in body, "GanttPage 缺 markerEnd 引用"
    assert "showRelations" in body, "GanttPage 缺 showRelations 状态"
    assert "setShowRelations" in body, "GanttPage 缺 setShowRelations setter"
    assert "positionOf" in body, "GanttPage 缺 positionOf 函数 (用于算 SVG 路径)"
    # relations 数组 (Vite 编译后字段名也保留)
    assert "relatedFrom" in body or "relatedTo" in body or "rowMap" in body, "GanttPage 缺 relations 索引逻辑"
    print(f"  → 编译产物 {len(body)} chars, SVG + marker + showRelations + positionOf 齐 ✓")

    # ===== B. 用户管理 UI =====
    print("\n[B1] users GET 列表 (任何登录用户)")
    admin_token, admin = login("admin", "admin123")
    lisi_token, lisi = login("lisi", "123456")
    req("GET", f"{BASE}/users", expect=200)
    s, b = req("GET", f"{BASE}/users", token=admin_token, expect=200)
    assert isinstance(b, list) and len(b) > 0, "users 列表空"
    # 找 lisi
    lisi_user = next((u for u in b if u["username"] == "lisi"), None)
    assert lisi_user is not None, "找不到 lisi 用户"
    print(f"  → 找到 lisi (id={lisi_user['id']}, role={lisi_user['role']})")

    print("\n[B2] users PATCH role - admin 可, member 不可")
    # admin 改 lisi role 为 biz_admin (level 3, 介于 space 和 member 之间)
    s, b = req("PATCH", f"{BASE}/users/{lisi_user['id']}", token=admin_token, body={"role": "biz_admin"}, expect=200)
    assert b["role"] == "biz_admin", f"admin PATCH role 失败: {b}"
    print(f"  → admin 把 lisi 改成 biz_admin ✓")
    # 改回
    req("PATCH", f"{BASE}/users/{lisi_user['id']}", token=admin_token, body={"role": "member"}, expect=200)
    # member 不能改
    req("PATCH", f"{BASE}/users/{lisi_user['id']}", token=lisi_token, body={"role": "tenant_admin"}, expect=403)
    print(f"  → member (lisi) PATCH 别人的 role 被 403 拒绝 ✓")

    print("\n[B3] users POST 创建 - admin 可, member 不可")
    s, b = req("POST", f"{BASE}/users", token=admin_token, body={
        "username": f"e2e_v12_{int(time.time())}",
        "displayName": "E2E V1.12 测试账号",
        "password": "test123",
        "role": "member",
    }, expect=201)
    new_uid = b["id"]
    print(f"  → admin 创建新用户: {b['username']} (id={new_uid})")
    req("POST", f"{BASE}/users", token=lisi_token, body={"username": "x", "password": "x"}, expect=403)
    print(f"  → member POST 创建用户被 403 拒绝 ✓")

    print("\n[B4] users DELETE - admin 可, member 不可")
    req("DELETE", f"{BASE}/users/{new_uid}", token=lisi_token, expect=403)
    print(f"  → member DELETE 被 403 拒绝 ✓")
    req("DELETE", f"{BASE}/users/{new_uid}", token=admin_token, expect=204)
    print(f"  → admin DELETE 新用户 OK ✓")

    print("\n[B5] 前端 UsersPage.tsx 编译 + 关键 UI")
    s, body = fetch(f"{FRONTEND}/src/pages/UsersPage.tsx")
    assert s == 200, f"UsersPage 编译失败: status={s}"
    assert len(body) > 5000, f"UsersPage 编译产物太短: {len(body)}"
    for keyword in ["isAdmin", "tenant_admin", "toggleActive", "重置密码", "改角色", "role", "userApi"]:
        assert keyword in body, f"UsersPage 缺关键词: {keyword}"
    print(f"  → 编译 {len(body)} chars, isAdmin/role/重置密码/改角色 齐 ✓")

    print("\n[B6] Root.tsx 路由 /users + App.tsx 菜单")
    s, root_body = fetch(f"{FRONTEND}/src/Root.tsx")
    assert s == 200
    assert "UsersPage" in root_body and "users" in root_body, "Root.tsx 缺 UsersPage 路由"
    print(f"  → Root.tsx 含 UsersPage 路由 ✓")

    # ===== C. Docker 化 =====
    print("\n[C1] backend/Dockerfile 存在 + 多阶段")
    assert file_exists("backend/Dockerfile"), "缺 backend/Dockerfile"
    bf = open(os.path.join(PROJECT_ROOT, "backend/Dockerfile"), encoding="utf-8").read()
    assert "AS deps" in bf and "AS builder" in bf and "AS runtime" in bf, "backend/Dockerfile 缺多阶段"
    assert "EXPOSE 4000" in bf, "缺 EXPOSE 4000"
    assert "HEALTHCHECK" in bf, "缺 HEALTHCHECK"
    print(f"  → backend/Dockerfile: 多阶段 + EXPOSE 4000 + HEALTHCHECK ✓")

    print("\n[C2] frontend/Dockerfile 存在 + nginx")
    assert file_exists("frontend/Dockerfile"), "缺 frontend/Dockerfile"
    ff = open(os.path.join(PROJECT_ROOT, "frontend/Dockerfile"), encoding="utf-8").read()
    assert "npm run build" in ff, "frontend/Dockerfile 缺 build"
    assert "nginx" in ff.lower(), "缺 nginx"
    assert "EXPOSE 80" in ff, "缺 EXPOSE 80"
    print(f"  → frontend/Dockerfile: build + nginx + EXPOSE 80 ✓")

    print("\n[C3] frontend/nginx.conf (/api 反代 + MCP SSE)")
    assert file_exists("frontend/nginx.conf"), "缺 frontend/nginx.conf"
    nc = open(os.path.join(PROJECT_ROOT, "frontend/nginx.conf"), encoding="utf-8").read()
    assert "proxy_pass http://backend" in nc, "nginx.conf 缺 backend 反代"
    assert "/api/" in nc, "nginx.conf 缺 /api/ 路径"
    assert "proxy_buffering off" in nc, "nginx.conf 缺 buffering off (SSE 需要)"
    assert "proxy_read_timeout" in nc, "nginx.conf 缺 read timeout (MCP 需要)"
    assert ("mcp/stream" in nc or "mcp/sse" in nc or "mcp/(stream" in nc), "nginx.conf 缺 MCP SSE 路径"
    print(f"  → nginx.conf: /api 反代 + SSE 优化 + MCP 路径 ✓")

    print("\n[C4] docker-compose.yml (双服务)")
    assert file_exists("docker-compose.yml"), "缺 docker-compose.yml"
    dc = open(os.path.join(PROJECT_ROOT, "docker-compose.yml"), encoding="utf-8").read()
    assert "backend:" in dc and "frontend:" in dc, "缺双服务"
    assert "avm-data" in dc, "缺 volume 持久化"
    assert "8080:80" in dc, "缺 8080 端口映射"
    assert "depends_on" in dc, "缺依赖关系"
    assert "healthcheck" in dc.lower(), "缺 healthcheck"
    print(f"  → docker-compose.yml: backend+frontend + volume + 8080 + healthcheck ✓")

    print("\n[C5] .dockerignore 存在")
    assert file_exists(".dockerignore"), "缺 .dockerignore"
    di = open(os.path.join(PROJECT_ROOT, ".dockerignore"), encoding="utf-8").read()
    assert "node_modules" in di and ("*.db" in di or "data.db" in di), ".dockerignore 缺关键排除项"
    print(f"  → .dockerignore: 排除 node_modules + db ✓")

    print("\n[C6] DEPLOY.md 存在 + 覆盖 3 种方案")
    assert file_exists("DEPLOY.md"), "缺 DEPLOY.md"
    dep = open(os.path.join(PROJECT_ROOT, "DEPLOY.md"), encoding="utf-8").read()
    assert "Docker Compose" in dep, "DEPLOY.md 缺 Docker Compose 节"
    assert "开发模式" in dep, "DEPLOY.md 缺开发模式"
    assert "pm2" in dep or "systemd" in dep, "DEPLOY.md 缺传统部署"
    assert len(dep) > 3000, f"DEPLOY.md 内容太少: {len(dep)}"
    print(f"  → DEPLOY.md: {len(dep)} chars, 3 种方案齐 ✓")

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
