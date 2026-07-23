#!/usr/bin/env bash
# AVM 数据库备份 - Linux/Mac cron 版本
# 建议 cron: 0 3 * * * /opt/avm/backend/scripts/backup.sh >> /var/log/avm-backup.log 2>&1

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
cd "$BACKEND_DIR"

# 通过 npm script 调用 (自动读取 DATABASE_URL)
npm run backup
