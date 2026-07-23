#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
启动 AVM 后端（用 subprocess + 关闭 stdin 模拟 daemon）
"""
import subprocess
import time
import sys
import os

backend_dir = r"D:\AI\飞书项目\avm-demo\backend"
log_path = os.path.join(backend_dir, "server-new.log")

# 设置环境变量（SQLite 路径 + LLM 占位）
env = os.environ.copy()
env["DATABASE_URL"] = "file:./prisma/data.db"
env["LLM_PROVIDER"] = "mock"  # 默认 mock；生产设置 LLM_API_KEY 即可启用 OpenAI/Claude

# 删除旧 log（用 truncate 替代 remove 避免锁）
if os.path.exists(log_path):
    try: os.remove(log_path)
    except: pass

# 启动后端
log = open(log_path, "w", encoding="utf-8")
proc = subprocess.Popen(
    ["cmd", "/c", "npm", "run", "dev"],
    cwd=backend_dir,
    env=env,
    stdout=log,
    stderr=subprocess.STDOUT,
    stdin=subprocess.DEVNULL,
    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "DETACHED_PROCESS", 0),
)
print(f"Started backend, PID: {proc.pid}")
print(f"Log: {log_path}")

# 等待启动
for i in range(30):
    time.sleep(1)
    try:
        import requests
        r = requests.get("http://localhost:4000/api/health", timeout=2)
        if r.status_code == 200:
            print(f"Backend ready in {i+1}s: {r.json()}")
            sys.exit(0)
    except Exception:
        pass

print("Failed to start")
print("--- log tail ---")
with open(log_path, "r", encoding="utf-8") as f:
    print(f.read()[-2000:])
sys.exit(1)
