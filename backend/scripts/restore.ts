/**
 * AVM 数据库恢复脚本 (V1.30)
 *
 * 用法:
 *   tsx scripts/restore.ts <backup-file-path>             # 交互式确认
 *   tsx scripts/restore.ts <backup-file-path> --force     # 跳过确认 (CI/非交互)
 *
 * 支持:
 *   - PostgreSQL (.dump)  → pg_restore --clean --if-exists
 *   - SQLite   (.db)      → 关闭 Prisma 连接后拷贝文件
 *
 * ⚠️  恢复会覆盖现有数据, 请确保:
 *   1) 后端服务已停止 (避免 SQLite 锁 / PG 连接占用)
 *   2) 已对当前数据库做过备份
 */
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

const DATABASE_URL = process.env.DATABASE_URL || 'file:./prisma/data.db';
const FORCE = process.argv.includes('--force');

/** 位置参数: 第一个非 flag 参数即 backup 文件路径 */
const BACKUP_FILE = process.argv
  .slice(2)
  .find((a) => !a.startsWith('--') && a !== undefined);

function isPostgres(url: string): boolean {
  return url.startsWith('postgres://') || url.startsWith('postgresql://');
}

function parsePgUrl(url: string) {
  // postgresql://user:pass@host:port/db?schema=public
  const m = url.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);
  if (!m) throw new Error(`无法解析 PG URL: ${url}`);
  return { user: m[1], password: m[2], host: m[3], port: m[4], db: m[5] };
}

function confirm(question: string): boolean {
  if (FORCE) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(/^(y|yes|是)$/i.test(answer.trim()));
    });
  }) as unknown as boolean;
}

function restorePostgres(file: string) {
  const { user, password, host, port, db } = parsePgUrl(DATABASE_URL);
  console.log(`[${new Date().toISOString()}] Restoring PG ← ${file}`);
  console.log(`  target: ${user}@${host}:${port}/${db}`);

  // 检查 pg_restore 是否可用
  const check = spawnSync('pg_restore', ['--version'], { stdio: 'pipe' });
  if (check.status !== 0) {
    console.error('❌ pg_restore 未安装, 请安装 PostgreSQL client 后重试');
    process.exit(1);
  }

  // pg_restore --clean --if-exists: 先 drop 再 create, 容错
  execSync(
    `pg_restore --clean --if-exists -h ${host} -p ${port} -U ${user} -d ${db} "${file}"`,
    { env: { ...process.env, PGPASSWORD: password }, stdio: 'inherit' },
  );
}

function restoreSqlite(file: string) {
  // SQLite: 关闭 Prisma 连接 → 拷贝文件 → 提示重启
  const rel = DATABASE_URL.replace(/^file:/, '');
  const dest = path.isAbsolute(rel) ? rel : path.join(process.cwd(), rel);

  console.log(`[${new Date().toISOString()}] Restoring SQLite ← ${file}`);
  console.log(`  target: ${dest}`);

  // 1. 关闭 Prisma 连接 (尝试动态 import; 若失败则提示用户手动停止服务)
  //    注: 此脚本通常在服务停止后运行, 这里只是 best-effort。
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    spawnSync('prisma', ['db', 'push', '--accept-data-loss'], { stdio: 'inherit' });
    prisma.$disconnect();
  } catch {
    console.warn('⚠️  无法自动关闭 Prisma 连接, 请确保后端服务已停止');
  }

  // 2. 备份当前 db (保险)
  if (fs.existsSync(dest)) {
    const bak = `${dest}.pre-restore-${Date.now()}.bak`;
    fs.copyFileSync(dest, bak);
    console.log(`  已备份当前数据库 → ${bak}`);
  }

  // 3. 拷贝文件
  fs.copyFileSync(file, dest);
  console.log(`  已恢复数据库文件`);
}

async function main() {
  if (!BACKUP_FILE) {
    console.error('❌ 缺少参数: <backup-file-path>');
    console.error('   用法: tsx scripts/restore.ts <backup-file-path> [--force]');
    process.exit(1);
  }

  const file = path.isAbsolute(BACKUP_FILE) ? BACKUP_FILE : path.join(process.cwd(), BACKUP_FILE);
  if (!fs.existsSync(file)) {
    console.error(`❌ 备份文件不存在: ${file}`);
    process.exit(1);
  }

  const sizeMb = (fs.statSync(file).size / 1024 / 1024).toFixed(2);
  console.log(`[${new Date().toISOString()}] AVM restore start`);
  console.log(`  source: ${file} (${sizeMb} MB)`);
  console.log(`  mode:   ${isPostgres(DATABASE_URL) ? 'PostgreSQL' : 'SQLite'}`);

  // 恢复前确认
  const ok = await confirm(
    '\n⚠️  此操作将覆盖现有数据库, 确认继续? [y/N]: ',
  );
  if (!ok) {
    console.log('已取消');
    process.exit(0);
  }

  if (isPostgres(DATABASE_URL)) {
    restorePostgres(file);
  } else {
    restoreSqlite(file);
  }

  console.log(`[${new Date().toISOString()}] ✅ Restore done: ${file}`);
  console.log(`\n👉 请重启后端服务以加载恢复后的数据`);
  console.log(`   npm run dev   # 或: npm start`);
}

main();
