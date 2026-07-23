#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
启动 AVM 前端（Vite dev server）
"""
import subprocess
import time
import sys
import os

frontend_dir = r"D:\AI\飞书项目\avm-demo\frontend"
log_path = os.path.join(frontend_dir, "vite-new.log")

# 启动前端
log = open(log_path, "w", encoding="utf-8")
proc = subprocess.Popen(
    ["cmd", "/c", "npm", "run", "dev"],
    cwd=frontend_dir,
    stdout=log,
    stderr=subprocess.STDOUT,
    stdin=subprocess.DEVNULL,
    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0) | getattr(subprocess, "DETACHED_PROCESS", 0),
)
print(f"Started frontend, PID: {proc.pid}")
print(f"Log: {log_path}")

# 等待启动
for i in range(30):
    time.sleep(1)
    try:
        import requests
        r = requests.get("http://localhost:5173/", timeout=2)
        if r.status_code == 200:
            print(f"Frontend ready in {i+1}s")
            sys.exit(0)
    except Exception:
        pass

print("Failed to start")
with open(log_path, "r", encoding="utf-8") as f:
    print(f.read()[-2000:])
sys.exit(1)
