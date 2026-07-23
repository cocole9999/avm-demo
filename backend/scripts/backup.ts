/**
 * AVM 数据库备份脚本 (V1.30)
 *
 * 用法:
 *   tsx scripts/backup.ts                  # 默认: pg_dump (PG) / 拷贝 db 文件 (SQLite)
 *   tsx scripts/backup.ts --keep 14        # 保留 14 天 (默认 7)
 *   BACKUP_DIR=/var/backups tsx scripts/backup.ts
 *
 * 适合: cron / Windows Task Scheduler / K8s CronJob
 * 推荐: 每天凌晨 2-4 点跑一次
 */
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/data.db';
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');
const KEEP_DAYS = parseInt(
  (process.argv.find((a) => a.startsWith('--keep=')) || '--keep=7').split('=')[1] || '7',
  10,
);

function ts() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function isPostgres(url: string): boolean {
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

function parsePgUrl(url: string) {
  // postgresql://user:pass@host:port/db?schema=public
  const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!m) throw new Error(`无法解析 PG URL: ${url}`);
  return { user: m[1], password: m[2], host: m[3], port: m[4], db: m[5] };
}

function backupPostgres() {
  const { user, password, host, port, db } = parsePgUrl(DATABASE_URL);
  const filename = `avm-pg-${ts()}.dump`;
  const filepath = path.join(BACKUP_DIR, filename);
  console.log(`[${new Date().toISOString()}] Backing up PG → ${filepath}`);

  // 检查 pg_dump 是否可用
  const check = spawnSync('pg_dump', ['--version'], { stdio: 'pipe' });
  if (check.status !== 0) {
    console.error('❌ pg_dump 未安装, 请安装 PostgreSQL client 后重试');
    process.exit(1);
  }

  execSync(
    `pg_dump -h ${host} -p ${port} -U ${user} -d ${db} -F c -f "${filepath}"`,
    { env: { ...process.env, PGPASSWORD: password }, stdio: 'inherit' },
  );
  return filepath;
}

function backupSqlite() {
  // SQLite: 拷贝 db 文件
  // url 形如 file:./prisma/data.db 或 file:./data.db
  const rel = DATABASE_URL.replace(/^file:/, '');
  const src = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);

  if (!fs.existsSync(src)) {
    console.error(`❌ SQLite 文件不存在: ${src}`);
    process.exit(1);
  }

  const filename = `avm-sqlite-${ts()}.db`;
  const filepath = path.join(BACKUP_DIR, filename);
  console.log(`[${new Date().toISOString()}] Backing up SQLite → ${filepath}`);

  // 用 sqlite3 .backup 命令 (更安全, 避免锁问题); 如未安装则用 cp
  const check = spawnSync('sqlite3', ['--version'], { stdio: 'pipe' });
  if (check.status === 0) {
    execSync(`sqlite3 "${src}" ".backup '${filepath}'"`, { stdio: 'inherit' });
  } else {
    fs.copyFileSync(src, filepath);
  }
  return filepath;
}

function cleanOldBackups() {
  const now = Date.now();
  const maxAgeMs = KEEP_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const f of fs.readdirSync(BACKUP_DIR)) {
    if (!f.startsWith('avm-')) continue;
    const fp = path.join(BACKUP_DIR, f);
    const stat = fs.statSync(fp);
    if (now - stat.mtimeMs > maxAgeMs) {
      fs.unlinkSync(fp);
      removed++;
    }
  }
  if (removed > 0) console.log(`[${new Date().toISOString()}] Cleaned ${removed} old backup(s)`);
}

function main() {
  ensureDir(BACKUP_DIR);
  console.log(`[${new Date().toISOString()}] AVM backup start (keep=${KEEP_DAYS}d, dir=${BACKUP_DIR})`);

  const file = isPostgres(DATABASE_URL) ? backupPostgres() : backupSqlite();
  const sizeMb = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
  console.log(`[${new Date().toISOString()}] ✅ Backup done: ${file} (${sizeMb} MB)`);

  cleanOldBackups();
  console.log(`[${new Date().toISOString()}] All done.`);
}

main();
