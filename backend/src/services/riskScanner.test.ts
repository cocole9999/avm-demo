/**
 * 风险扫描器单元测试
 * 测试 runRiskScan / stopRiskScanner
 * 通过 vi.hoisted + vi.mock 模拟 prisma + 依赖模块
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  prisma: {
    notification: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    externalDependency: {
      findMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
  executeTool: vi.fn(),
  getLLMProvider: vi.fn(),
}));

vi.mock('../db', () => ({ prisma: mocks.prisma }));

// Mock buildProjectSnapshot
vi.mock('./projectSnapshot', () => ({
  buildProjectSnapshot: vi.fn().mockResolvedValue({ text: 'snapshot' }),
}));

// Mock wsServer
vi.mock('./wsServer', () => ({
  pushToUser: vi.fn(),
  broadcastAll: vi.fn(),
}));

// Mock llmProvider
vi.mock('./llmProvider', () => ({
  getLLMProvider: mocks.getLLMProvider,
  clearLLMCache: vi.fn(),
}));

// Mock aiTools
vi.mock('./aiTools', () => ({
  executeTool: mocks.executeTool,
}));

import { runRiskScan, stopRiskScanner } from './riskScanner';

describe('services/riskScanner - runRiskScan', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.executeTool.mockResolvedValue({ riskProjects: [], overdueWorkItems: [] });
    mocks.getLLMProvider.mockResolvedValue({
      isAvailable: () => false,
      name: 'mock',
      chat: vi.fn(),
    });
    // scanDependencyOverdue 默认返回空数组 (无超期依赖)
    mocks.prisma.externalDependency.findMany.mockResolvedValue([]);
    stopRiskScanner();
  });
  afterEach(() => stopRiskScanner());

  it('无风险时返回 0 通知', async () => {
    mocks.executeTool.mockResolvedValueOnce({ riskProjects: [], overdueWorkItems: [] });
    const r = await runRiskScan('manual');
    expect(r.riskCount).toBe(0);
    expect(r.overdueCount).toBe(0);
    expect(r.notificationsCreated).toBe(0);
    expect(r.skippedByDedup).toBe(0);
    expect(r.alerts).toEqual([]);
  });

  it('有风险项目时生成 alerts (LLM 不可用 fallback)', async () => {
    mocks.executeTool.mockResolvedValueOnce({
      riskProjects: [
        { projectCode: 'AVM-001', risk: 'high', issues: ['进度滞后', '资源不足'] },
        { projectCode: 'AVM-002', risk: 'medium', issues: ['轻微延期'] },
      ],
      overdueWorkItems: [],
    });
    mocks.prisma.notification.findFirst.mockResolvedValue(null);
    mocks.prisma.notification.create.mockResolvedValue({ id: 'n1' });

    const r = await runRiskScan('manual');
    expect(r.riskCount).toBe(2);
    expect(r.alerts.length).toBe(2);
    expect(r.alerts[0].projectCode).toBe('AVM-001');
    expect(r.alerts[0].severity).toBe('high');
    expect(r.alerts[1].severity).toBe('medium');
    // 通知应被创建
    expect(r.notificationsCreated).toBeGreaterThan(0);
    expect(mocks.prisma.notification.create).toHaveBeenCalled();
  });

  it('24h 内同 dedupKey 跳过', async () => {
    mocks.executeTool.mockResolvedValueOnce({
      riskProjects: [{ projectCode: 'AVM-DUP', risk: 'high', issues: ['x'] }],
      overdueWorkItems: [],
    });
    // 模拟已存在通知 -> 去重
    mocks.prisma.notification.findFirst.mockResolvedValueOnce({ id: 'existing' });

    const r = await runRiskScan('manual');
    expect(r.notificationsCreated).toBe(0);
    expect(r.skippedByDedup).toBeGreaterThan(0);
    expect(mocks.prisma.notification.create).not.toHaveBeenCalled();
  });

  it('无 projectCode 的 alert 被跳过', async () => {
    mocks.executeTool.mockResolvedValueOnce({
      riskProjects: [
        { projectCode: '', risk: 'high', issues: ['x'] },
        { projectCode: 'AVM-OK', risk: 'high', issues: ['y'] },
      ],
      overdueWorkItems: [],
    });
    mocks.prisma.notification.findFirst.mockResolvedValue(null);
    mocks.prisma.notification.create.mockResolvedValue({ id: 'n1' });

    const r = await runRiskScan('manual');
    expect(r.alerts.length).toBe(2);  // alerts 数组保留全部
    // 仅 AVM-OK 触发通知
    expect(r.notificationsCreated).toBeGreaterThan(0);
  });

  it('scan_risks 工具失败时降级为空数据', async () => {
    mocks.executeTool.mockRejectedValueOnce(new Error('tool unavailable'));
    const r = await runRiskScan('manual');
    expect(r.riskCount).toBe(0);
    expect(r.notificationsCreated).toBe(0);
  });

  it('scanDependencyOverdue 集成 - 有超期依赖', async () => {
    // 让 executeTool 返回有数据让代码进入 scanDependencyOverdue 阶段
    mocks.executeTool.mockResolvedValueOnce({
      riskProjects: [{ projectCode: 'AVM-DEP', risk: 'high', issues: ['x'] }],
      overdueWorkItems: [],
    });
    mocks.prisma.externalDependency.findMany.mockResolvedValueOnce([
      {
        id: 'dep-1', name: '测试台架', type: '台架',
        expectedDate: new Date(Date.now() - 5 * 86400000),
        status: 'preparing', owner: 'owner-1', blocker: '',
        project: { code: 'AVM-001', name: '项目1' },
        workItem: { key: 'TASK-1', title: 't', assignee: 'u1' },
      },
    ]);
    mocks.prisma.notification.findFirst.mockResolvedValue(null);
    mocks.prisma.notification.create.mockResolvedValue({ id: 'n1' });
    mocks.prisma.user.findFirst.mockResolvedValue({ id: 'u-1' });

    const r = await runRiskScan('manual');
    expect(r.dependencyOverdue?.overdueCount).toBe(1);
    expect(r.dependencyOverdue?.items[0].name).toBe('测试台架');
    expect(r.dependencyOverdue?.items[0].daysOverdue).toBeGreaterThanOrEqual(5);
    expect(r.dependencyOverdue?.notificationsCreated).toBeGreaterThan(0);
  });

  it('依赖已 ready/cancelled 不计入超期', async () => {
    // 让 executeTool 返回有数据让代码进入 scanDependencyOverdue 阶段
    mocks.executeTool.mockResolvedValueOnce({
      riskProjects: [{ projectCode: 'AVM-DEP2', risk: 'high', issues: ['x'] }],
      overdueWorkItems: [],
    });
    mocks.prisma.externalDependency.findMany.mockResolvedValueOnce([]);

    const r = await runRiskScan('manual');
    expect(r.dependencyOverdue?.overdueCount).toBe(0);
  });

  it('返回 scannedAt 是 ISO 字符串', async () => {
    mocks.executeTool.mockResolvedValueOnce({ riskProjects: [], overdueWorkItems: [] });
    const r = await runRiskScan('startup');
    expect(typeof r.scannedAt).toBe('string');
    expect(new Date(r.scannedAt).getTime()).not.toBeNaN();
  });
});

describe('services/riskScanner - stopRiskScanner', () => {
  it('stopRiskScanner 不抛错 (即使未启动)', () => {
    expect(() => stopRiskScanner()).not.toThrow();
  });

  it('stopRiskScanner 多次调用幂等', () => {
    stopRiskScanner();
    stopRiskScanner();
    stopRiskScanner();
  });
});
