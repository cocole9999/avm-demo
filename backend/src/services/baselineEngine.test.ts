/**
 * 基线引擎单元测试
 * 测试 createBaseline / compareBaseline
 * 通过 vi.hoisted + vi.mock 模拟 prisma
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  baseline: {
    create: vi.fn(),
    findUnique: vi.fn(),
  },
  workItem: {
    findMany: vi.fn(),
  },
  iteration: {
    findUnique: vi.fn(),
  },
}));

vi.mock('../db', () => ({ prisma: mockPrisma }));

import { createBaseline, compareBaseline } from './baselineEngine';

describe('services/baselineEngine - createBaseline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('创建迭代基线并写入快照', async () => {
    const items = [
      {
        id: 'w1', key: 'TASK-1', title: '任务1', type: 'task', status: '进行中',
        priority: 'P1', assignee: '张三', planStart: new Date('2024-01-01'),
        planEnd: new Date('2024-01-10'), estimate: 8, module: 'M1', spaceId: 's1',
      },
      {
        id: 'w2', key: 'BUG-1', title: '缺陷1', type: 'bug', status: '待评审',
        priority: 'P0', assignee: null, planStart: null, planEnd: null,
        estimate: 3, module: '', spaceId: 's1',
      },
    ];
    mockPrisma.workItem.findMany.mockResolvedValueOnce(items);
    mockPrisma.iteration.findUnique.mockResolvedValueOnce({ id: 'it-1', name: '迭代1' });
    mockPrisma.baseline.create.mockResolvedValueOnce({ id: 'b-1', name: '基线1' });

    const r = await createBaseline({
      spaceId: 's1', iterationId: 'it-1', name: '基线1', description: '测试', createdBy: 'admin',
    });

    expect(r.id).toBe('b-1');
    expect(mockPrisma.baseline.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        name: '基线1',
        description: '测试',
        iterationName: '迭代1',
        itemCount: 2,
        totalEstimate: 11,
        snapshot: expect.any(String),
      }),
    }));
    // 快照内容校验
    const call = mockPrisma.baseline.create.mock.calls[0][0];
    const snapshot = JSON.parse(call.data.snapshot);
    expect(snapshot.length).toBe(2);
    expect(snapshot[0].itemId).toBe('w1');
    expect(snapshot[1].assignee).toBe('');
  });

  it('未传 iterationId 时 iterationName=null', async () => {
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);
    mockPrisma.baseline.create.mockResolvedValueOnce({ id: 'b-2' });

    await createBaseline({ name: '空基线' });
    expect(mockPrisma.baseline.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        iterationName: null,
        itemCount: 0,
        totalEstimate: 0,
      }),
    }));
    expect(mockPrisma.iteration.findUnique).not.toHaveBeenCalled();
  });

  it('iteration 不存在时 iterationName=null', async () => {
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);
    mockPrisma.iteration.findUnique.mockResolvedValueOnce(null);
    mockPrisma.baseline.create.mockResolvedValueOnce({ id: 'b-3' });

    await createBaseline({ iterationId: 'no-such', name: 'x' });
    expect(mockPrisma.baseline.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ iterationName: null }),
    }));
  });

  it('baselineType 默认 iteration', async () => {
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);
    mockPrisma.baseline.create.mockResolvedValueOnce({ id: 'b-4' });

    await createBaseline({ name: 'x' });
    expect(mockPrisma.baseline.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ baselineType: 'iteration' }),
    }));
  });

  it('支持自定义 baselineType', async () => {
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);
    mockPrisma.baseline.create.mockResolvedValueOnce({ id: 'b-5' });

    await createBaseline({ name: 'x', baselineType: 'milestone' });
    expect(mockPrisma.baseline.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ baselineType: 'milestone' }),
    }));
  });

  it('description 默认空字符串', async () => {
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);
    mockPrisma.baseline.create.mockResolvedValueOnce({ id: 'b-6' });

    await createBaseline({ name: 'x' });
    expect(mockPrisma.baseline.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ description: '' }),
    }));
  });
});

describe('services/baselineEngine - compareBaseline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('基线不存在抛错', async () => {
    mockPrisma.baseline.findUnique.mockResolvedValueOnce(null);
    await expect(compareBaseline('no-such')).rejects.toThrow(/Baseline not found/);
  });

  it('工作项被删除计入 removed', async () => {
    const snapshot = [
      { itemId: 'w1', key: 'TASK-1', title: 't1', type: 'task', status: '待评审', priority: 'P1', assignee: '张三', planStart: null, planEnd: null, estimate: 5, module: '' },
      { itemId: 'w2', key: 'BUG-1', title: 'b1', type: 'bug', status: '待评审', priority: 'P2', assignee: '', planStart: null, planEnd: null, estimate: 3, module: '' },
    ];
    mockPrisma.baseline.findUnique.mockResolvedValueOnce({
      id: 'b-1', snapshot: JSON.stringify(snapshot),
    });
    // 当前仅 w1 还存在 (w2 被删除)
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'w1', key: 'TASK-1', title: 't1', status: '已完成', priority: 'P1', assignee: '张三', planStart: null, planEnd: null, estimate: 5 },
    ]);

    const r = await compareBaseline('b-1');
    expect(r.changes.removed.length).toBe(1);
    expect(r.changes.removed[0].itemId).toBe('w2');
    expect(r.changes.statusChanged.length).toBe(1);  // w1: 待评审 -> 已完成
    expect(r.changes.ahead.length).toBe(1);  // 已完成但基线未完成 -> ahead
  });

  it('状态变更计入 statusChanged', async () => {
    const snapshot = [
      { itemId: 'w1', key: 'TASK-1', title: 't1', type: 'task', status: '待评审', priority: 'P1', assignee: '张三', planStart: null, planEnd: null, estimate: 5, module: '' },
    ];
    mockPrisma.baseline.findUnique.mockResolvedValueOnce({ id: 'b-1', snapshot: JSON.stringify(snapshot) });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'w1', key: 'TASK-1', title: 't1', status: '开发中', priority: 'P1', assignee: '张三', planStart: null, planEnd: null, estimate: 5 },
    ]);

    const r = await compareBaseline('b-1');
    expect(r.changes.statusChanged.length).toBe(1);
    expect(r.changes.statusChanged[0].from).toBe('待评审');
    expect(r.changes.statusChanged[0].to).toBe('开发中');
  });

  it('estimate 变更计入 estimateChanged', async () => {
    const snapshot = [
      { itemId: 'w1', key: 'TASK-1', title: 't1', type: 'task', status: '进行中', priority: 'P1', assignee: '张三', planStart: null, planEnd: null, estimate: 5, module: '' },
    ];
    mockPrisma.baseline.findUnique.mockResolvedValueOnce({ id: 'b-1', snapshot: JSON.stringify(snapshot) });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'w1', key: 'TASK-1', title: 't1', status: '进行中', priority: 'P1', assignee: '张三', planStart: null, planEnd: null, estimate: 8 },
    ]);

    const r = await compareBaseline('b-1');
    expect(r.changes.estimateChanged.length).toBe(1);
    expect(r.changes.estimateChanged[0].diff).toBe(3);
  });

  it('assignee 变更计入 assigneeChanged', async () => {
    const snapshot = [
      { itemId: 'w1', key: 'TASK-1', title: 't1', type: 'task', status: '进行中', priority: 'P1', assignee: '张三', planStart: null, planEnd: null, estimate: 5, module: '' },
    ];
    mockPrisma.baseline.findUnique.mockResolvedValueOnce({ id: 'b-1', snapshot: JSON.stringify(snapshot) });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'w1', key: 'TASK-1', title: 't1', status: '进行中', priority: 'P1', assignee: '李四', planStart: null, planEnd: null, estimate: 5 },
    ]);

    const r = await compareBaseline('b-1');
    expect(r.changes.assigneeChanged.length).toBe(1);
    expect(r.changes.assigneeChanged[0].from).toBe('张三');
    expect(r.changes.assigneeChanged[0].to).toBe('李四');
  });

  it('排期变更 (>1天) 计入 planChanged', async () => {
    const snapshot = [
      { itemId: 'w1', key: 'TASK-1', title: 't1', type: 'task', status: '进行中', priority: 'P1', assignee: '张三', planStart: '2024-01-01T00:00:00.000Z', planEnd: '2024-01-10T00:00:00.000Z', estimate: 5, module: '' },
    ];
    mockPrisma.baseline.findUnique.mockResolvedValueOnce({ id: 'b-1', snapshot: JSON.stringify(snapshot) });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'w1', key: 'TASK-1', title: 't1', status: '进行中', priority: 'P1', assignee: '张三', planStart: new Date('2024-01-01'), planEnd: new Date('2024-01-15'), estimate: 5 },
    ]);

    const r = await compareBaseline('b-1');
    expect(r.changes.planChanged.length).toBe(1);
    expect(r.changes.planChanged[0].delayDays).toBe(5);
  });

  it('超期未完成计入 delayed', async () => {
    const snapshot = [
      { itemId: 'w1', key: 'TASK-1', title: 't1', type: 'task', status: '进行中', priority: 'P1', assignee: '张三', planStart: null, planEnd: '2020-01-01T00:00:00.000Z', estimate: 5, module: '' },
    ];
    mockPrisma.baseline.findUnique.mockResolvedValueOnce({ id: 'b-1', snapshot: JSON.stringify(snapshot) });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'w1', key: 'TASK-1', title: 't1', status: '进行中', priority: 'P1', assignee: '张三', planStart: null, planEnd: new Date('2020-01-01'), estimate: 5 },
    ]);

    const r = await compareBaseline('b-1');
    expect(r.changes.delayed.length).toBe(1);
    expect(r.changes.delayed[0].delayDays).toBeGreaterThan(0);
  });

  it('正常进行中计入 onTrack', async () => {
    const future = new Date(Date.now() + 30 * 86400000).toISOString();
    const snapshot = [
      { itemId: 'w1', key: 'TASK-1', title: 't1', type: 'task', status: '进行中', priority: 'P1', assignee: '张三', planStart: null, planEnd: future, estimate: 5, module: '' },
    ];
    mockPrisma.baseline.findUnique.mockResolvedValueOnce({ id: 'b-1', snapshot: JSON.stringify(snapshot) });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'w1', key: 'TASK-1', title: 't1', status: '进行中', priority: 'P1', assignee: '张三', planStart: null, planEnd: new Date(future), estimate: 5 },
    ]);

    const r = await compareBaseline('b-1');
    expect(r.changes.onTrack.length).toBe(1);
  });

  it('stats 包含 healthScore', async () => {
    const snapshot = [
      { itemId: 'w1', key: 'TASK-1', title: 't1', type: 'task', status: '进行中', priority: 'P1', assignee: '张三', planStart: null, planEnd: null, estimate: 5, module: '' },
    ];
    mockPrisma.baseline.findUnique.mockResolvedValueOnce({ id: 'b-1', snapshot: JSON.stringify(snapshot) });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'w1', key: 'TASK-1', title: 't1', status: '进行中', priority: 'P1', assignee: '张三', planStart: null, planEnd: null, estimate: 5 },
    ]);

    const r = await compareBaseline('b-1');
    expect(r.stats.totalItems).toBe(1);
    expect(typeof r.stats.healthScore).toBe('number');
    expect(r.stats.healthScore).toBeLessThanOrEqual(100);
    expect(r.stats.healthScore).toBeGreaterThanOrEqual(0);
  });
});
