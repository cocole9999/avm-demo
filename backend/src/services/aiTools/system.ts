/**
 * AI 工具 - 系统管理
 * 用户/空间/租户/审计/SSO/通知/收藏/交接
 * 自动从 aiToolsQuery.ts 拆分而来 (V1.46.2)
 */
import { prisma } from '../../db';
import type { ToolDefinition } from './types';

// ========== 用户/成员 ==========
export const listUsers: ToolDefinition = {
  name: 'list_users',
  description: '列出系统用户/成员。可按角色/部门/状态/关键词搜索。对应"用户管理"页面。',
  parameters: {
    type: 'object',
    properties: {
      role: { type: 'string', description: '角色：tenant_admin / space_admin / member / pm 等' },
      department: { type: 'string', description: '部门模糊搜索' },
      active: { type: 'boolean', description: '是否启用' },
      keyword: { type: 'string', description: '用户名/显示名搜索' },
      limit: { type: 'number', description: '返回数量上限，默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.role) where.role = args.role;
    if (args.department) where.department = { contains: args.department };
    if (args.active !== undefined) where.active = args.active;
    if (args.keyword) {
      where.OR = [
        { username: { contains: args.keyword } },
        { displayName: { contains: args.keyword } },
        { email: { contains: args.keyword } },
      ];
    }
    const list = await prisma.user.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, username: true, displayName: true, email: true,
        department: true, role: true, active: true, lastLoginAt: true,
      },
    });
    return list;
  },
};


// ========== 空间 ==========
export const listSpaces: ToolDefinition = {
  name: 'list_spaces',
  description: '列出空间（项目空间）。对应"空间切换/空间管理"相关页面。',
  parameters: {
    type: 'object',
    properties: {
      status: { type: 'string', description: 'active/inactive' },
      keyword: { type: 'string', description: '空间名/编码搜索' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.status) where.status = args.status;
    if (args.keyword) {
      where.OR = [
        { name: { contains: args.keyword } },
        { code: { contains: args.keyword } },
      ];
    }
    const list = await prisma.space.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, code: true, name: true, description: true, icon: true,
        status: true, ownerId: true, memberCount: true, itemCount: true, createdAt: true,
      },
    });
    return list;
  },
};


// ========== 空间成员 ==========
export const listSpaceMembers: ToolDefinition = {
  name: 'list_space_members',
  description: '列出空间成员。对应"空间管理-成员"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string', description: '空间 ID' },
      role: { type: 'string', description: '成员角色' },
      keyword: { type: 'string', description: '用户名搜索' },
      limit: { type: 'number', description: '默认 100' },
    },
  },
  handler: async (args) => {
    if (!args.spaceId) throw new Error('spaceId 必填');
    const where: any = { spaceId: args.spaceId };
    if (args.role) where.role = args.role;
    if (args.keyword) {
      where.OR = [
        { userName: { contains: args.keyword } },
        { userId: { contains: args.keyword } },
      ];
    }
    const list = await prisma.spaceMember.findMany({
      where,
      orderBy: { joinedAt: 'desc' },
      take: Math.min(args.limit || 100, 200),
      include: { space: { select: { code: true, name: true } } },
    });
    return list;
  },
};


// ========== 租户信息 ==========
export const getTenant: ToolDefinition = {
  name: 'get_tenant',
  description: '获取当前租户信息。对应"租户设置"页面。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string', description: '租户 ID' },
      code: { type: 'string', description: '租户编码' },
    },
  },
  handler: async (args) => {
    const t = args.id
      ? await prisma.tenant.findUnique({ where: { id: args.id }, include: { ssoSettings: true } })
      : args.code
        ? await prisma.tenant.findUnique({ where: { code: args.code }, include: { ssoSettings: true } })
        : await prisma.tenant.findFirst({ include: { ssoSettings: true } });
    if (!t) return { error: '租户不存在' };
    const userCount = await prisma.user.count({ where: { tenantId: t.id } });
    return { ...t, userCount };
  },
};


// ========== 审计日志 ==========
export const listAuditLogs: ToolDefinition = {
  name: 'list_audit_logs',
  description: '列出审计日志。可按实体/操作/操作人/最近天数过滤。对应"审计日志"页面。',
  parameters: {
    type: 'object',
    properties: {
      entity: { type: 'string', description: 'project / customer / workItem / user / carModel / contact / dependency / auth 等' },
      action: { type: 'string', description: 'create / update / delete / login / status_change 等' },
      actor: { type: 'string' },
      days: { type: 'number', description: '最近 N 天，默认 7' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.entity) where.entity = args.entity;
    if (args.action) where.action = args.action;
    if (args.actor) where.actor = args.actor;
    if (args.days) {
      where.createdAt = { gte: new Date(Date.now() - args.days * 86400000) };
    }
    const list = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, entity: true, entityId: true, action: true, actor: true,
        actorRole: true, changes: true, meta: true, createdAt: true,
      },
    });
    return list;
  },
};


// ========== SSO 设置与日志 ==========
export const listSSOSettings: ToolDefinition = {
  name: 'list_sso_settings',
  description: '列出单点登录（SSO）配置。对应"租户设置-SSO"页面。',
  parameters: {
    type: 'object',
    properties: {
      provider: { type: 'string', description: 'feishu / dingtalk / wechatwork / saml / oidc' },
      enabled: { type: 'boolean' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.provider) where.provider = args.provider;
    if (args.enabled !== undefined) where.enabled = args.enabled;
    const list = await prisma.sSOSetting.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, tenantId: true, provider: true, enabled: true,
        appId: true, redirectUri: true, corpId: true, agentId: true,
        config: true, createdAt: true, updatedAt: true,
      },
    });
    return list.map(s => ({ ...s, appSecret: '' }));
  },
};


export const listSSOLogs: ToolDefinition = {
  name: 'list_sso_logs',
  description: '列出 SSO 登录/绑定日志。对应"审计日志"中的 SSO 相关记录。',
  parameters: {
    type: 'object',
    properties: {
      provider: { type: 'string' },
      action: { type: 'string', description: 'login / bind / unbind' },
      userKey: { type: 'string' },
      days: { type: 'number', description: '最近 N 天' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.provider) where.provider = args.provider;
    if (args.action) where.action = args.action;
    if (args.userKey) where.userKey = args.userKey;
    if (args.days) where.createdAt = { gte: new Date(Date.now() - args.days * 86400000) };
    const list = await prisma.sSOLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, tenantId: true, provider: true, userKey: true, userName: true,
        action: true, ip: true, userAgent: true, success: true, errorMsg: true, createdAt: true,
      },
    });
    return list;
  },
};


// ========== 空间管理 ==========
export const createSpace: ToolDefinition = {
  name: 'create_space',
  description: '创建一个项目空间。必填：name, code。',
  parameters: {
    type: 'object',
    properties: {
      name: { type: 'string', description: '空间名称' },
      code: { type: 'string', description: '空间编码（唯一）' },
      description: { type: 'string' },
      icon: { type: 'string', description: '图标名' },
      ownerId: { type: 'string', description: '负责人用户 ID' },
    },
    required: ['name', 'code'],
  },
  handler: async (args) => {
    if (!args.name || !args.code) throw new Error('name 和 code 必填');
    const s = await prisma.space.create({
      data: {
        name: args.name, code: args.code,
        description: args.description || '',
        icon: args.icon || 'project',
        ownerId: args.ownerId || null,
        status: 'active',
      },
    });
    return { ok: true, id: s.id, code: s.code, message: `已创建空间 ${s.code}: ${s.name}` };
  },
};


export const updateSpace: ToolDefinition = {
  name: 'update_space',
  description: '更新空间信息。通过 id 或 code 定位。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      code: { type: 'string' },
      name: { type: 'string' },
      description: { type: 'string' },
      icon: { type: 'string' },
      status: { type: 'string', description: 'active/inactive' },
    },
  },
  handler: async (args) => {
    if (!args.id && !args.code) throw new Error('id 或 code 必填');
    const where = args.id ? { id: args.id } : { code: args.code };
    const data: any = {};
    ['name', 'description', 'icon', 'status'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const s = await prisma.space.update({ where, data });
    return { ok: true, code: s.code, message: `已更新空间 ${s.code}` };
  },
};


export const addSpaceMember: ToolDefinition = {
  name: 'add_space_member',
  description: '向空间添加成员。必填：spaceId/spaceCode, userId/userName, role。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      spaceCode: { type: 'string' },
      userId: { type: 'string' },
      userName: { type: 'string', description: '用户名（显示名）' },
      role: { type: 'string', description: 'admin/member/guest' },
    },
    required: ['role'],
  },
  handler: async (args) => {
    let spaceId = args.spaceId;
    if (!spaceId && args.spaceCode) {
      const s = await prisma.space.findUnique({ where: { code: args.spaceCode } });
      if (!s) throw new Error(`空间 ${args.spaceCode} 不存在`);
      spaceId = s.id;
    }
    if (!spaceId) throw new Error('必须提供 spaceId 或 spaceCode');
    let userId = args.userId;
    let userName = args.userName;
    if (!userId) {
      const u = await prisma.user.findFirst({ where: { OR: [{ username: userName }, { displayName: userName }] } });
      if (!u) throw new Error(`用户 ${userName} 不存在`);
      userId = u.id;
      userName = u.displayName;
    } else if (!userName) {
      const u = await prisma.user.findUnique({ where: { id: userId } });
      if (u) userName = u.displayName;
    }
    const m = await prisma.spaceMember.create({
      data: { spaceId, userId, userName: userName || '', role: args.role || 'member' },
    });
    return { ok: true, id: m.id, message: `已添加成员 ${userName} 到空间` };
  },
};


export const removeSpaceMember: ToolDefinition = {
  name: 'remove_space_member',
  description: '从空间移除成员。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string', description: 'SpaceMember ID' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.spaceMember.delete({ where: { id: args.id } });
    return { ok: true, message: '已移除空间成员' };
  },
};


// ========== 用户管理 ==========
export const createUser: ToolDefinition = {
  name: 'create_user',
  description: '创建系统用户。必填：username, displayName, password。',
  parameters: {
    type: 'object',
    properties: {
      username: { type: 'string' },
      displayName: { type: 'string' },
      password: { type: 'string', description: '登录密码（至少8位，含数字和字母）' },
      email: { type: 'string' },
      department: { type: 'string' },
      role: { type: 'string', description: 'member/space_admin/tenant_admin' },
    },
    required: ['username', 'displayName', 'password'],
  },
  handler: async (args) => {
    if (!args.username || !args.displayName || !args.password) throw new Error('username/displayName/password 必填');
    const { hashPassword } = await import('../../utils/password');
    const u = await prisma.user.create({
      data: {
        username: args.username, displayName: args.displayName,
        password: await hashPassword(args.password),
        email: args.email || null,
        department: args.department || null,
        role: args.role || 'member',
        active: true,
      },
    });
    return { ok: true, id: u.id, username: u.username, message: `已创建用户 ${u.username}` };
  },
};


export const updateUser: ToolDefinition = {
  name: 'update_user',
  description: '更新用户信息（不改密码）。通过 id 或 username 定位。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      username: { type: 'string' },
      displayName: { type: 'string' },
      email: { type: 'string' },
      department: { type: 'string' },
      role: { type: 'string' },
      active: { type: 'boolean' },
    },
  },
  handler: async (args) => {
    if (!args.id && !args.username) throw new Error('id 或 username 必填');
    const where = args.id ? { id: args.id } : { username: args.username };
    const data: any = {};
    ['displayName', 'email', 'department', 'role', 'active'].forEach(f => { if (args[f] !== undefined) data[f] = args[f]; });
    const u = await prisma.user.update({ where, data });
    return { ok: true, username: u.username, message: `已更新用户 ${u.username}` };
  },
};


export const resetUserPassword: ToolDefinition = {
  name: 'reset_user_password',
  description: '重置用户密码。⚠️ 需要 tenant_admin 权限。通过 id 或 username 定位。',
  parameters: {
    type: 'object',
    properties: {
      id: { type: 'string' },
      username: { type: 'string' },
      newPassword: { type: 'string', description: '新密码（至少8位，含数字和字母）' },
    },
    required: ['newPassword'],
  },
  handler: async (args) => {
    if (!args.id && !args.username) throw new Error('id 或 username 必填');
    const where = args.id ? { id: args.id } : { username: args.username };
    const { hashPassword } = await import('../../utils/password');
    await prisma.user.update({
      where,
      data: { password: await hashPassword(args.newPassword), token: null, tokenExpiresAt: null },
    });
    return { ok: true, message: '密码已重置，用户需重新登录' };
  },
};


// ========== 通知 ==========
export const createNotification: ToolDefinition = {
  name: 'create_notification',
  description: '发送系统通知给用户。必填：recipientId, title, content。',
  parameters: {
    type: 'object',
    properties: {
      recipientId: { type: 'string', description: '接收人用户 ID' },
      recipientName: { type: 'string', description: '接收人用户名（与 recipientId 二选一）' },
      title: { type: 'string' },
      content: { type: 'string' },
      level: { type: 'string', description: 'info/warning/error/success' },
      type: { type: 'string', description: '通知类型' },
      link: { type: 'string', description: '点击跳转链接' },
    },
    required: ['title', 'content'],
  },
  handler: async (args) => {
    let recipientId = args.recipientId;
    if (!recipientId && args.recipientName) {
      const u = await prisma.user.findFirst({ where: { OR: [{ username: args.recipientName }, { displayName: args.recipientName }] } });
      if (!u) throw new Error(`用户 ${args.recipientName} 不存在`);
      recipientId = u.id;
    }
    if (!recipientId) throw new Error('必须提供 recipientId 或 recipientName');
    const n = await prisma.notification.create({
      data: {
        recipientId, title: args.title, content: args.content,
        level: args.level || 'info', type: args.type || 'system',
        link: args.link || '',
      },
    });
    // 尝试通过 WebSocket 推送
    try {
      const { pushToUser } = await import('../wsServer');
      pushToUser(recipientId, { type: 'notification', data: n });
    } catch {/* ignore if WS not initialized */}
    return { ok: true, id: n.id, message: `已发送通知: ${args.title}` };
  },
};


// ========== 收藏 ==========
export const listFavorites: ToolDefinition = {
  name: 'list_favorites',
  description: '列出用户收藏/快捷入口。对应"我的收藏"页面。',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string', description: '用户 ID' },
      resourceType: { type: 'string', description: 'work_item / project / dashboard 等' },
      folder: { type: 'string' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.userId) where.userId = args.userId;
    if (args.resourceType) where.resourceType = args.resourceType;
    if (args.folder) where.folder = args.folder;
    const list = await prisma.favorite.findMany({
      where,
      orderBy: { position: 'asc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, userId: true, resourceType: true, resourceId: true,
        title: true, subtitle: true, icon: true, link: true, folder: true, position: true,
      },
    });
    return list;
  },
};


// ========== 收藏 ==========
export const addFavorite: ToolDefinition = {
  name: 'add_favorite',
  description: '添加收藏。必填：userId, title, resourceType, resourceId。',
  parameters: {
    type: 'object',
    properties: {
      userId: { type: 'string' },
      title: { type: 'string' },
      resourceType: { type: 'string', description: 'project/work_item/dashboard/space' },
      resourceId: { type: 'string', description: '资源 ID' },
      link: { type: 'string', description: '链接路径' },
      folder: { type: 'string', description: '收藏夹名称' },
      spaceId: { type: 'string' },
    },
    required: ['userId', 'title', 'resourceType', 'resourceId'],
  },
  handler: async (args) => {
    const f = await prisma.favorite.create({
      data: {
        userId: args.userId, title: args.title, resourceType: args.resourceType,
        resourceId: args.resourceId,
        link: args.link || '', folder: args.folder || '默认',
        spaceId: args.spaceId || null,
      },
    });
    return { ok: true, id: f.id, message: `已收藏 ${f.title}` };
  },
};


export const removeFavorite: ToolDefinition = {
  name: 'remove_favorite',
  description: '取消收藏。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    await prisma.favorite.delete({ where: { id: args.id } });
    return { ok: true, message: '已取消收藏' };
  },
};


// ========== 工作交接 ==========
export const listWorkHandovers: ToolDefinition = {
  name: 'list_work_handovers',
  description: '列出工作交接记录。对应"工作交接"页面。',
  parameters: {
    type: 'object',
    properties: {
      spaceId: { type: 'string' },
      fromUserId: { type: 'string' },
      toUserId: { type: 'string' },
      limit: { type: 'number', description: '默认 50' },
    },
  },
  handler: async (args) => {
    const where: any = {};
    if (args.spaceId) where.spaceId = args.spaceId;
    if (args.fromUserId) where.fromUserId = args.fromUserId;
    if (args.toUserId) where.toUserId = args.toUserId;
    const list = await prisma.workHandover.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(args.limit || 50, 100),
      select: {
        id: true, fromUserId: true, fromUserName: true, toUserId: true, toUserName: true,
        workItemIds: true, reason: true, status: true, createdAt: true,
      },
    });
    return list;
  },
};


// ========== 工作交接 ==========
export const createWorkHandover: ToolDefinition = {
  name: 'create_work_handover',
  description: '创建工作交接单。必填：fromUserName, toUserName。',
  parameters: {
    type: 'object',
    properties: {
      fromUserName: { type: 'string', description: '交接人姓名' },
      toUserName: { type: 'string', description: '接交人姓名' },
      reason: { type: 'string', description: '交接原因' },
      workItemKeys: { type: 'array', items: { type: 'string' }, description: '要交接的工作项 Key 列表（如 REQ-1, TASK-2）' },
      spaceId: { type: 'string' },
    },
    required: ['fromUserName', 'toUserName'],
  },
  handler: async (args) => {
    let fromUserId = '', toUserId = '';
    const fromUser = await prisma.user.findFirst({ where: { OR: [{ username: args.fromUserName }, { displayName: args.fromUserName }] } });
    if (fromUser) { fromUserId = fromUser.id; }
    const toUser = await prisma.user.findFirst({ where: { OR: [{ username: args.toUserName }, { displayName: args.toUserName }] } });
    if (toUser) { toUserId = toUser.id; }
    if (!fromUserId || !toUserId) throw new Error('交接人或接交人不存在');
    const wids: string[] = [];
    if (args.workItemKeys) {
      for (const key of args.workItemKeys) {
        const w = await prisma.workItem.findUnique({ where: { key } });
        if (w) wids.push(w.id);
      }
    }
    const h = await prisma.workHandover.create({
      data: {
        fromUserId, fromUserName: args.fromUserName,
        toUserId, toUserName: args.toUserName,
        reason: args.reason || '', workItemIds: JSON.stringify(wids),
        status: 'pending',
        spaceId: args.spaceId || null,
      },
    });
    return { ok: true, id: h.id, message: `已创建交接单：${args.fromUserName} → ${args.toUserName}` };
  },
};


export const completeWorkHandover: ToolDefinition = {
  name: 'complete_work_handover',
  description: '完成工作交接（将工作项负责人改为接交人）。',
  parameters: {
    type: 'object',
    properties: { id: { type: 'string' } },
    required: ['id'],
  },
  handler: async (args) => {
    const h = await prisma.workHandover.findUnique({ where: { id: args.id } });
    if (!h) throw new Error('交接单不存在');
    let wids: string[] = [];
    try { wids = JSON.parse(h.workItemIds); } catch { /* ignore */ }
    for (const wid of wids) {
      await prisma.workItem.update({ where: { id: wid }, data: { assignee: h.toUserName } }).catch(() => {/* ignore */});
    }
    await prisma.workHandover.update({
      where: { id: args.id },
      data: { status: 'done' },
    });
    return { ok: true, message: '交接已完成，工作项负责人已更新' };
  },
};

