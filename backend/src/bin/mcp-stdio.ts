#!/usr/bin/env node
/**
 * AVM MCP Server - stdio 模式 (V1.47)
 *
 * 用于 Claude Desktop / Cursor / Trae / 其它支持 MCP 协议的客户端。
 * 走 stdin/stdout JSON-RPC 2.0，每行一个请求。
 * 核心逻辑委托给 services/mcpCore.ts 的 handleJsonRpcRequest
 *
 * 启动方式（Trae / Claude Desktop 配置）：
 *   {
 *     "mcpServers": {
 *       "avm": {
 *         "command": "npx",
 *         "args": ["tsx", "D:/AI/飞书项目/avm-demo/backend/src/bin/mcp-stdio.ts"],
 *         "env": {
 *           "AVM_MCP_TOKEN": "<JWT token>",
 *           "AVM_API_BASE": "http://localhost:4000"
 *         }
 *       }
 *     }
 *   }
 *
 * V1.47 新增：
 *   - 支持 AVM_MCP_TOKEN 环境变量传入 JWT，用于认证
 *   - 支持 AVM_API_BASE 环境变量指定后端 API 地址（默认 http://localhost:4000）
 *   - 工具数从 13 个扩展到 124 个（全量桥接 aiTools）
 *
 * 或打包后直接 node 跑编译产物。
 */
import { handleJsonRpcRequest, SERVER_INFO, type McpUserContext } from '../services/mcpCore';

function send(msg: any) {
  // 写一行 JSON 到 stdout
  process.stdout.write(JSON.stringify(msg) + '\n');
  // 显式 flush（避免 pipe 关闭时丢数据）
  if (typeof (process.stdout as any)._handle?.flush === 'function') {
    try { (process.stdout as any)._handle.flush(); } catch {}
  }
}

function sendError(id: number | string | null, code: number, message: string, data?: any) {
  send({ jsonrpc: '2.0', id, error: { code, message, data } });
}

// ========== V1.47: 解析环境变量构造用户上下文 ==========
function buildStdioCtx(): McpUserContext {
  const token = process.env.AVM_MCP_TOKEN;
  if (!token) {
    // 未提供 token，返回 stdio 模式默认上下文（开发环境）
    // 生产环境应在 mcpCore.executeTool 中校验并拒绝敏感操作
    return {
      stdio: true,
      role: process.env.AVM_MCP_ROLE || 'tenant_admin',  // 默认管理员（向后兼容）
      username: process.env.AVM_MCP_USER || 'mcp-stdio',
    };
  }

  // 解析 JWT（简单解析 payload，不验证签名——签名验证应由后端 API 完成）
  try {
    const parts = token.split('.');
    if (parts.length === 3) {
      const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
      return {
        userId: payload.userId || payload.sub,
        tenantId: payload.tenantId,
        role: payload.role || 'tenant_admin',
        username: payload.username || payload.displayName,
        spaceId: payload.spaceId,
        stdio: true,
      };
    }
  } catch (e: any) {
    process.stderr.write(`[avm-mcp-stdio] WARN: AVM_MCP_TOKEN 解析失败: ${e.message}，降级为默认上下文\n`);
  }

  return { stdio: true, role: 'tenant_admin', username: 'mcp-stdio' };
}

const stdioCtx = buildStdioCtx();

// ========== 主循环 ==========
const pendingPromises: Promise<any>[] = [];
let buffer = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => {
  buffer += chunk;
  let idx;
  while ((idx = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, idx).trim();
    buffer = buffer.slice(idx + 1);
    if (!line) continue;
    try {
      const req = JSON.parse(line);
      const p = handleJsonRpcRequest(req, stdioCtx).then((resp) => {
        if (resp) send(resp);
      });
      pendingPromises.push(p);
    } catch (e: any) {
      sendError(null, -32700, `Parse error: ${e.message}`);
    }
  }
});

process.stdin.on('end', async () => {
  await Promise.allSettled(pendingPromises);
  // 给 stdout 一小段时间 flush
  setTimeout(() => process.exit(0), 50);
});

process.stderr.write(`[avm-mcp-stdio] started ${SERVER_INFO.name} v${SERVER_INFO.version} (tools: 124, user: ${stdioCtx.username || 'anonymous'}, role: ${stdioCtx.role || 'unknown'})\n`);
