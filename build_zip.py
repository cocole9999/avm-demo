"""打包 avm-demo 为 zip（排除 node_modules / .log / .db / test artifacts）"""
import os
import zipfile
from pathlib import Path

ROOT = Path(r'D:\AI\飞书项目\avm-demo')
OUT = ROOT / 'avm-demo.zip'

EXCLUDE_DIRS = {'node_modules', '.git', 'dist', '.vite', '__pycache__', '.next', '.cache', '.edge-profile', 'prisma'}
EXCLUDE_FILES = {'.db', '.log', '.sqlite', '.sqlite3', '.pyc'}
EXCLUDE_PATTERNS = ['out-', 'test_ai.py', 'fix_llm_', 'test_switch_', 'out.', 'out2.', 'tmp.']

def should_exclude(path: Path) -> bool:
    parts = set(path.parts)
    if parts & EXCLUDE_DIRS:
        return True
    if any(path.name.endswith(ext) for ext in EXCLUDE_FILES):
        return True
    if any(pat in path.name for pat in EXCLUDE_PATTERNS):
        return True
    return False

count = 0
with zipfile.ZipFile(OUT, 'w', zipfile.ZIP_DEFLATED) as zf:
    for p in sorted(ROOT.rglob('*')):
        if not p.is_file():
            continue
        if p == OUT:
            continue
        if should_exclude(p):
            continue
        arc = p.relative_to(ROOT)
        zf.write(p, arc)
        count += 1

size_kb = OUT.stat().st_size / 1024
print(f'✅ Packed {count} files → {OUT.name} ({size_kb:.0f} KB)')
