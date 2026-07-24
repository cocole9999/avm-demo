/**
 * /api/agent - Agent 命令路由 (V1.44)
 *
 * 支持 / 命令触发式 Agent 工作流：
 * - GET  /api/agent/commands      — 列出所有命令
 * - GET  /api/agent/commands/search?q=xxx — 搜索命令
 * - POST /api/agent/execute       — 执行命令
 */
import { Router } from 'express';
import {
  listCommands, searchCommands, executeAgentCommand,
  type CommandContext,
} from '../services/agentCommands';
import { requireAuth, AuthedRequest } from '../middleware/auth';

export const agentRouter = Router();
agentRouter.use(requireAuth);

// 列出所有命令
agentRouter.get('/commands', (req, res) => {
  const { category } = req.query;
  const cmds = listCommands(category as string);
  res.json({
    commands: cmds.map(c => ({
      name: c.name,
      alias: c.alias,
      description: c.description,
      category: c.category,
      hint: c.hint,
      params: c.params,
    })),
  });
});

// 搜索命令
agentRouter.get('/commands/search', (req, res) => {
  const q = (req.query.q as string) || '';
  if (!q) return res.json({ commands: [] });
  const cmds = searchCommands(q);
  res.json({
    commands: cmds.map(c => ({
      name: c.name,
      alias: c.alias,
      description: c.description,
      category: c.category,
      hint: c.hint,
      params: c.params,
    })),
  });
});

// 执行命令
agentRouter.post('/execute', async (req: AuthedRequest, res) => {
  try {
    const { command, args = {} } = req.body;
    if (!command) return res.status(400).json({ error: 'command 必填' });

    const ctx: CommandContext = {
      userId: req.user?.id,
      username: req.user?.displayName || req.user?.username,
      role: req.user?.role,
    };

    const result = await executeAgentCommand(command, args, ctx);
    res.json(result);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});
