/**
 * 备份恢复演练 (V1.30.2 P3-2e)
 *
 * 流程:
 *   1. 创建临时 sqlite db + 写入测试数据 (用 prisma)
 *   2. 跑 backup 风格拷贝 (sqlite3 .backup / fs.copyFileSync)
 *   3. 验证备份文件大小 > 0
 *   4. 模拟恢复: 用 prisma 打开备份, 校验表 + 数据完整
 *   5. 清理临时文件
 *
 * 目的: 证明 backup 脚本的输出是有效、可恢复的 SQLite 文件
 *
 * 真实生产环境: PG 用 `pg_dump -F c` + `pg_restore`, 见 backup.ts
 */
import { execSync, spawnSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const TMP_DIR = path.join(process.cwd(), 'backups-test');
const SRC_DB = path.join(TMP_DIR, 'source.db');
const BACKUP = path.join(TMP_DIR, 'source-backup.db');

function ok(msg: string) { console.log(`  ✅ ${msg}`); }
function fail(msg: string) { console.error(`  ❌ ${msg}`); process.exit(1); }

function cleanup() {
  if (fs.existsSync(TMP_DIR)) fs.rmSync(TMP_DIR, { recursive: true, force: true });
}

async function main() {
  console.log('🧪 备份恢复演练 (P3-2e)');
  cleanup();
  fs.mkdirSync(TMP_DIR, { recursive: true });

  // 1. 准备源库 + 测试数据
  console.log('\n1. 创建临时 SQLite + 写入测试数据...');
  const srcPrisma = new PrismaClient({ datasources: { db: { url: `file:${SRC_DB}` } } });
  try {
    await srcPrisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username TEXT NOT NULL, role TEXT NOT NULL)`);
    await srcPrisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS work_items (id INTEGER PRIMARY KEY, key TEXT NOT NULL, title TEXT)`);
    await srcPrisma.$executeRawUnsafe(`DELETE FROM users`);
    await srcPrisma.$executeRawUnsafe(`DELETE FROM work_items`);
    await srcPrisma.$executeRawUnsafe(`INSERT INTO users (id, username, role) VALUES (1, 'admin', 'tenant_admin'), (2, 'pm', 'space_admin')`);
    await srcPrisma.$executeRawUnsafe(`INSERT INTO work_items (id, key, title) VALUES (1, 'TASK-1', 'AVM 集成测试用例')`);
    const userCount = await srcPrisma.$queryRawUnsafe<any[]>('SELECT COUNT(*) as c FROM users');
    ok(`源库创建, ${userCount[0].c} users / 1 work_item`);
  } finally {
    await srcPrisma.$disconnect();
  }

  // 2. 跑 backup 风格拷贝
  console.log('\n2. 跑 backup 风格拷贝...');
  const sqliteCheck = spawnSync('sqlite3', ['--version'], { stdio: 'pipe' });
  if (sqliteCheck.status === 0) {
    execSync(`sqlite3 "${SRC_DB}" ".backup '${BACKUP}'"`, { stdio: 'inherit' });
    ok('使用 sqlite3 .backup (在线热备, 避免锁)');
  } else {
    fs.copyFileSync(SRC_DB, BACKUP);
    ok('sqlite3 CLI 不存在, 用 fs.copyFileSync 降级');
  }

  // 3. 验证备份文件存在
  console.log('\n3. 验证备份文件...');
  if (!fs.existsSync(BACKUP)) fail('备份文件未生成');
  const srcSize = fs.statSync(SRC_DB).size;
  const bakSize = fs.statSync(BACKUP).size;
  if (bakSize === 0) fail('备份文件大小为 0');
  ok(`备份文件: ${path.basename(BACKUP)} (${bakSize} bytes, 源库 ${srcSize} bytes)`);

  // 4. 模拟恢复: 用 prisma 打开备份库, 校验表 + 数据
  console.log('\n4. 模拟恢复 (打开备份文件, 校验)...');
  const recPrisma = new PrismaClient({ datasources: { db: { url: `file:${BACKUP}` } } });
  const tables = await recPrisma.$queryRawUnsafe<any[]>(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  );
  const tableNames = tables.map(t => t.name).join(', ');
  if (!tableNames.includes('users') || !tableNames.includes('work_items')) {
    fail(`恢复后表缺失, 实际: ${tableNames}`);
  }
  ok(`恢复后表: ${tableNames}`);

  const recoveredUsers = await recPrisma.$queryRawUnsafe<any[]>('SELECT * FROM users ORDER BY id');
  const recoveredItems = await recPrisma.$queryRawUnsafe<any[]>('SELECT * FROM work_items');
  if (recoveredUsers.length !== 2) fail(`users 数量不符: ${recoveredUsers.length}`);
  if (recoveredItems.length !== 1) fail(`work_items 数量不符: ${recoveredItems.length}`);
  ok(`数据完整: ${recoveredUsers.length} users, ${recoveredItems.length} work_items`);
  await recPrisma.$disconnect();

  // 5. 清理
  console.log('\n5. 清理临时文件...');
  cleanup();
  ok('临时目录已清理');

  console.log('\n🎉 备份恢复演练通过!');
  console.log('   真实生产: PG 用 pg_dump -F c, 恢复用 pg_restore');
  console.log('   SQLite: 备份=源文件拷贝/在线热备, 恢复=替换源文件');
}

main().catch((e) => {
  console.error('❌ 演练失败:', e);
  cleanup();
  process.exit(1);
});
