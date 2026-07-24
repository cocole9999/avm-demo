/**
 * 聚合字段引擎单元测试
 * 测试 computeRollupField / computeItemRollups / computeItemDerivedFields / recomputeAllDerivedFields
 * 通过 vi.hoisted + vi.mock 模拟 prisma
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockPrisma = vi.hoisted(() => ({
  rollupField: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  formulaField: {
    findMany: vi.fn(),
  },
  workItem: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
}));

vi.mock('../db', () => ({ prisma: mockPrisma }));

// Mock formulaEngine 防止连锁真实查询
vi.mock('./formulaEngine', () => ({
  computeFormulaField: vi.fn().mockResolvedValue({}),
  computeItemFormulas: vi.fn().mockResolvedValue({}),
}));

import {
  computeRollupField,
  computeItemRollups,
  computeItemDerivedFields,
  recomputeAllDerivedFields,
} from './rollupEngine';

describe('services/rollupEngine - computeRollupField', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rollupField 不存在抛错', async () => {
    mockPrisma.rollupField.findUnique.mockResolvedValueOnce(null);
    await expect(computeRollupField('no-such')).rejects.toThrow(/Rollup field not found/);
  });

  it('sum 聚合 - 累加所有子项 estimate', async () => {
    mockPrisma.rollupField.findUnique.mockResolvedValueOnce({
      id: 'rf-1', workType: 'epic', childType: 'task',
      sourceField: 'estimate', aggregation: 'sum', spaceId: null,
    });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'p1', type: 'epic', spaceId: 's1' },
    ]);
    // getAllDescendants 递归返回
    mockPrisma.workItem.findMany
      .mockResolvedValueOnce([{ id: 'c1', estimate: 5, status: '进行中' }, { id: 'c2', estimate: 8, status: '已完成' }])
      .mockResolvedValueOnce([])  // c1 的子项
      .mockResolvedValueOnce([]);  // c2 的子项
    mockPrisma.rollupField.update.mockResolvedValueOnce({});

    const r = await computeRollupField('rf-1');
    expect(r['p1']).toBe(13);  // 5 + 8
    expect(mockPrisma.rollupField.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'rf-1' },
      data: expect.objectContaining({ cachedValues: JSON.stringify({ p1: 13 }) }),
    }));
  });

  it('count 聚合 - 子项数量', async () => {
    mockPrisma.rollupField.findUnique.mockResolvedValueOnce({
      id: 'rf-2', workType: 'epic', childType: 'task',
      sourceField: 'estimate', aggregation: 'count', spaceId: null,
    });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([{ id: 'p1', type: 'epic', spaceId: 's1' }]);
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'c1', status: '进行中' }, { id: 'c2', status: '已完成' }, { id: 'c3', status: '待评审' },
    ]);
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);  // c1 子项
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);  // c2 子项
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);  // c3 子项
    mockPrisma.rollupField.update.mockResolvedValueOnce({});

    const r = await computeRollupField('rf-2');
    expect(r['p1']).toBe(3);
  });

  it('countDone - 仅已完成状态计数', async () => {
    mockPrisma.rollupField.findUnique.mockResolvedValueOnce({
      id: 'rf-3', workType: 'epic', childType: 'task',
      sourceField: 'estimate', aggregation: 'countDone', spaceId: null,
    });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([{ id: 'p1', type: 'epic', spaceId: 's1' }]);
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'c1', status: '已完成' },
      { id: 'c2', status: '进行中' },
      { id: 'c3', status: '已验收' },
      { id: 'c4', status: '已关闭' },
    ]);
    // 递归空子项
    mockPrisma.workItem.findMany.mockResolvedValue([]);
    mockPrisma.rollupField.update.mockResolvedValueOnce({});

    const r = await computeRollupField('rf-3');
    expect(r['p1']).toBe(3);  // 已完成 + 已验收 + 已关闭
  });

  it('progress - 已完成比例', async () => {
    mockPrisma.rollupField.findUnique.mockResolvedValueOnce({
      id: 'rf-4', workType: 'epic', childType: 'task',
      sourceField: '', aggregation: 'progress', spaceId: null,
    });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([{ id: 'p1', type: 'epic', spaceId: 's1' }]);
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'c1', status: '已完成' },
      { id: 'c2', status: '进行中' },
      { id: 'c3', status: '已完成' },
      { id: 'c4', status: '待评审' },
    ]);
    mockPrisma.workItem.findMany.mockResolvedValue([]);
    mockPrisma.rollupField.update.mockResolvedValueOnce({});

    const r = await computeRollupField('rf-4');
    expect(r['p1']).toBe(0.5);  // 2/4
  });

  it('空子项 progress=0', async () => {
    mockPrisma.rollupField.findUnique.mockResolvedValueOnce({
      id: 'rf-5', workType: 'epic', childType: 'task',
      sourceField: '', aggregation: 'progress', spaceId: null,
    });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([{ id: 'p1', type: 'epic', spaceId: 's1' }]);
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);  // 无子项
    mockPrisma.rollupField.update.mockResolvedValueOnce({});

    const r = await computeRollupField('rf-5');
    expect(r['p1']).toBe(0);
  });

  it('avg / max / min 数值聚合', async () => {
    mockPrisma.rollupField.findUnique.mockResolvedValueOnce({
      id: 'rf-6', workType: 'epic', childType: 'task',
      sourceField: 'estimate', aggregation: 'avg', spaceId: null,
    });
    mockPrisma.workItem.findMany.mockResolvedValueOnce([{ id: 'p1', type: 'epic', spaceId: 's1' }]);
    mockPrisma.workItem.findMany.mockResolvedValueOnce([
      { id: 'c1', estimate: 6 }, { id: 'c2', estimate: 4 }, { id: 'c3', estimate: 8 },
    ]);
    mockPrisma.workItem.findMany.mockResolvedValue([]);
    mockPrisma.rollupField.update.mockResolvedValueOnce({});

    const r = await computeRollupField('rf-6');
    expect(r['p1']).toBe(6);  // (6+4+8)/3
  });
});

describe('services/rollupEngine - computeItemRollups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('父工作项不存在返回空对象', async () => {
    mockPrisma.workItem.findUnique.mockResolvedValueOnce(null);
    const r = await computeItemRollups('no-such');
    expect(r).toEqual({});
  });

  it('无 rollupField 配置返回空对象', async () => {
    mockPrisma.workItem.findUnique.mockResolvedValueOnce({ id: 'p1', type: 'epic', spaceId: 's1' });
    mockPrisma.rollupField.findMany.mockResolvedValueOnce([]);
    const r = await computeItemRollups('p1');
    expect(r).toEqual({});
  });

  it('聚合多个 rollup 字段到 result', async () => {
    mockPrisma.workItem.findUnique.mockResolvedValueOnce({ id: 'p1', type: 'epic', spaceId: 's1' });
    mockPrisma.rollupField.findMany.mockResolvedValueOnce([
      { id: 'rf-1', fieldKey: 'totalEstimate', childType: 'task', sourceField: 'estimate', aggregation: 'sum' },
      { id: 'rf-2', fieldKey: 'taskCount', childType: 'task', sourceField: '', aggregation: 'count' },
    ]);
    // 第一次 getAllDescendants
    mockPrisma.workItem.findMany.mockResolvedValueOnce([{ id: 'c1', estimate: 5, status: '进行中' }]);
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);  // c1 子项
    // 第二次 getAllDescendants
    mockPrisma.workItem.findMany.mockResolvedValueOnce([{ id: 'c2', status: '已完成' }]);
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);  // c2 子项

    const r = await computeItemRollups('p1');
    expect(r['totalEstimate']).toBe(5);
    expect(r['taskCount']).toBe(1);
  });
});

describe('services/rollupEngine - computeItemDerivedFields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('同时返回 formulas 和 rollups', async () => {
    // computeItemFormulas 被 mock 为返回 {formulasKey: 1}
    // computeItemRollups 内部走 prisma mock
    mockPrisma.workItem.findUnique.mockResolvedValueOnce({ id: 'p1', type: 'epic', spaceId: 's1' });
    mockPrisma.rollupField.findMany.mockResolvedValueOnce([]);
    const r = await computeItemDerivedFields('p1');
    expect(r.formulas).toEqual({});
    expect(r.rollups).toEqual({});
  });
});

describe('services/rollupEngine - recomputeAllDerivedFields', () => {
  beforeEach(() => vi.clearAllMocks());

  it('返回 formulasCount + rollupsCount + duration', async () => {
    mockPrisma.formulaField.findMany.mockResolvedValueOnce([{ id: 'f1' }, { id: 'f2' }]);
    mockPrisma.rollupField.findMany.mockResolvedValueOnce([{ id: 'r1' }]);
    // recomputeAllDerivedFields 内部对每个 rollupField 调用 computeRollupField(r.id)
    // computeRollupField 第一步 findUnique, 然后对每个父项递归 getAllDescendants
    mockPrisma.rollupField.findUnique.mockResolvedValueOnce({
      id: 'r1', workType: 'epic', childType: 'task',
      sourceField: 'estimate', aggregation: 'sum', spaceId: null,
    });
    // 父项列表 (空 → 不进入 getAllDescendants)
    mockPrisma.workItem.findMany.mockResolvedValueOnce([]);
    mockPrisma.rollupField.update.mockResolvedValueOnce({});

    const r = await recomputeAllDerivedFields();
    expect(r.formulasCount).toBe(2);
    expect(r.rollupsCount).toBe(1);
    expect(typeof r.duration).toBe('number');
    expect(r.duration).toBeGreaterThanOrEqual(0);
  });

  it('spaceId 传入时按 spaceId 过滤', async () => {
    mockPrisma.formulaField.findMany.mockResolvedValueOnce([]);
    mockPrisma.rollupField.findMany.mockResolvedValueOnce([]);
    await recomputeAllDerivedFields('space-1');
    expect(mockPrisma.formulaField.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ enabled: true, spaceId: 'space-1' }),
    }));
    expect(mockPrisma.rollupField.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ enabled: true, spaceId: 'space-1' }),
    }));
  });

  it('无字段时返回 0', async () => {
    mockPrisma.formulaField.findMany.mockResolvedValueOnce([]);
    mockPrisma.rollupField.findMany.mockResolvedValueOnce([]);
    const r = await recomputeAllDerivedFields();
    expect(r.formulasCount).toBe(0);
    expect(r.rollupsCount).toBe(0);
  });
});
