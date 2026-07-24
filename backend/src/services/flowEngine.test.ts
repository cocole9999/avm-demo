/**
 * 流程引擎单元测试
 * 测试 transitionWorkItem / initWorkItemNode / getAvailableTransitions / getNodeByStatus
 * 通过 vi.hoisted + vi.mock 模拟 prisma
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 用 vi.hoisted 保证 mock 对象在 vi.mock 工厂内可用
const mocks = vi.hoisted(() => ({
  prisma: {
    nodeFlow: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    workItem: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    activity: {
      create: vi.fn(),
    },
  },
}));

vi.mock('../db', () => ({ prisma: mocks.prisma }));

import {
  getActiveFlow,
  listFlows,
  getNodeByStatus,
  initWorkItemNode,
  transitionWorkItem,
  getAvailableTransitions,
} from './flowEngine';

// 构造一个最小可用的流程对象
function makeFlow(overrides: any = {}) {
  return {
    id: 'flow-1',
    workType: 'task',
    isActive: true,
    nodes: [
      { id: 'n-start', name: '开始', nodeType: 'start', statusValue: '待评审', dodItems: '', reviewRule: '' },
      { id: 'n-dev', name: '开发', nodeType: 'normal', statusValue: '开发中', dodItems: '', reviewRule: '' },
      { id: 'n-test', name: '测试', nodeType: 'normal', statusValue: '测试中', dodItems: '', reviewRule: '' },
      { id: 'n-done', name: '完成', nodeType: 'end', statusValue: '已完成', dodItems: '', reviewRule: '' },
    ],
    transitions: [
      { id: 't1', fromNodeId: 'n-start', toNodeId: 'n-dev', condition: '', label: '开始开发', isDefault: false },
      { id: 't2', fromNodeId: 'n-dev', toNodeId: 'n-test', condition: '', label: '提测', isDefault: false },
      { id: 't3', fromNodeId: 'n-test', toNodeId: 'n-done', condition: '', label: '完成', isDefault: false },
    ],
    ...overrides,
  };
}

describe('services/flowEngine - getActiveFlow / listFlows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getActiveFlow 按 workType 查询活跃流', async () => {
    const flow = makeFlow();
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(flow);
    const r = await getActiveFlow('task');
    expect(r).toEqual(flow);
    expect(mocks.prisma.nodeFlow.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { workType: 'task', isActive: true },
    }));
  });

  it('getActiveFlow 未找到返回 null', async () => {
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(null);
    const r = await getActiveFlow('nonexistent');
    expect(r).toBeNull();
  });

  it('listFlows 返回所有流', async () => {
    const flows = [makeFlow(), makeFlow({ id: 'flow-2' })];
    mocks.prisma.nodeFlow.findMany.mockResolvedValueOnce(flows);
    const r = await listFlows();
    expect(r.length).toBe(2);
    expect(mocks.prisma.nodeFlow.findMany).toHaveBeenCalled();
  });
});

describe('services/flowEngine - getNodeByStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('按 statusValue 找到对应节点', async () => {
    const flow = makeFlow();
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(flow);
    const node = await getNodeByStatus('task', '开发中');
    expect(node?.id).toBe('n-dev');
  });

  it('未匹配返回 null', async () => {
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(makeFlow());
    const node = await getNodeByStatus('task', '不存在状态');
    expect(node).toBeNull();
  });

  it('流程不存在返回 null', async () => {
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(null);
    const node = await getNodeByStatus('nonexistent', '待评审');
    expect(node).toBeNull();
  });
});

describe('services/flowEngine - initWorkItemNode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('初始化到 start 节点', async () => {
    const flow = makeFlow();
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(flow);
    mocks.prisma.workItem.update.mockResolvedValueOnce({ id: 'item-1', currentNodeId: 'n-start', status: '待评审' });
    const node = await initWorkItemNode('item-1', 'task');
    expect(node?.id).toBe('n-start');
    expect(mocks.prisma.workItem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'item-1' },
      data: expect.objectContaining({ currentNodeId: 'n-start' }),
    }));
  });

  it('流程不存在返回 null', async () => {
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(null);
    const node = await initWorkItemNode('item-1', 'no-such-type');
    expect(node).toBeNull();
    expect(mocks.prisma.workItem.update).not.toHaveBeenCalled();
  });

  it('无节点时返回 null', async () => {
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(makeFlow({ nodes: [] }));
    const node = await initWorkItemNode('item-1', 'task');
    expect(node).toBeNull();
  });
});

describe('services/flowEngine - transitionWorkItem', () => {
  beforeEach(() => vi.clearAllMocks());

  it('合法 transition 流转成功', async () => {
    const flow = makeFlow();
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce({ id: 'item-1', type: 'task', currentNodeId: 'n-start', status: '待评审' });
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(flow);
    mocks.prisma.workItem.update.mockResolvedValueOnce({ id: 'item-1', currentNodeId: 'n-dev', status: '开发中' });
    mocks.prisma.activity.create.mockResolvedValueOnce({});

    const r = await transitionWorkItem('item-1', 'n-dev', { actor: '张三', comment: '开始开发' });
    expect(r.currentNodeId).toBe('n-dev');
    expect(mocks.prisma.activity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        workItemId: 'item-1',
        actor: '张三',
        action: 'node_transition',
        oldValue: '待评审',
        newValue: '开发中',
        meta: '开始开发',
      }),
    }));
  });

  it('工作项不存在抛错', async () => {
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce(null);
    await expect(transitionWorkItem('no-such-item', 'n-dev')).rejects.toThrow(/工作项不存在/);
  });

  it('流程不存在抛错', async () => {
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce({ id: 'item-1', type: 'no-such-type', currentNodeId: null });
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(null);
    await expect(transitionWorkItem('item-1', 'n-dev')).rejects.toThrow(/流程/);
  });

  it('目标节点不存在抛错', async () => {
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce({ id: 'item-1', type: 'task', currentNodeId: 'n-start' });
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(makeFlow());
    await expect(transitionWorkItem('item-1', 'non-existent-node')).rejects.toThrow(/目标节点/);
  });

  it('无 transition 路径抛错', async () => {
    // 从 n-start 直接跳到 n-test (无 transition)
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce({ id: 'item-1', type: 'task', currentNodeId: 'n-start', status: '待评审' });
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(makeFlow());
    await expect(transitionWorkItem('item-1', 'n-test')).rejects.toThrow(/不允许/);
  });

  it('DOD 必填项未完成抛错', async () => {
    const flow = makeFlow({
      nodes: [
        { id: 'n-start', name: '开始', nodeType: 'start', statusValue: '待评审', dodItems: JSON.stringify([{ name: 'checklist', required: true, checked: false }]), reviewRule: '' },
        { id: 'n-dev', name: '开发', nodeType: 'normal', statusValue: '开发中', dodItems: '', reviewRule: '' },
      ],
      transitions: [
        { id: 't1', fromNodeId: 'n-start', toNodeId: 'n-dev', condition: '', label: '开发', isDefault: false },
      ],
    });
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce({ id: 'item-1', type: 'task', currentNodeId: 'n-start', status: '待评审' });
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(flow);
    await expect(transitionWorkItem('item-1', 'n-dev')).rejects.toThrow(/DOD/);
  });

  it('同节点流转 (fromNode === toNode) 不抛 transition 错', async () => {
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce({ id: 'item-1', type: 'task', currentNodeId: 'n-dev', status: '开发中' });
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(makeFlow());
    mocks.prisma.workItem.update.mockResolvedValueOnce({ id: 'item-1', currentNodeId: 'n-dev', status: '开发中' });
    mocks.prisma.activity.create.mockResolvedValueOnce({});
    // 同节点 (n-dev -> n-dev) 不需要 transition
    const r = await transitionWorkItem('item-1', 'n-dev');
    expect(r.currentNodeId).toBe('n-dev');
  });
});

describe('services/flowEngine - getAvailableTransitions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('返回当前节点可流转的目标', async () => {
    const flow = makeFlow();
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce({ id: 'item-1', type: 'task', currentNodeId: 'n-start' });
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(flow);
    const r = await getAvailableTransitions('item-1');
    expect(r.length).toBe(1);
    expect(r[0].transition.id).toBe('t1');
    expect(r[0].node?.id).toBe('n-dev');
  });

  it('工作项不存在返回空数组', async () => {
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce(null);
    const r = await getAvailableTransitions('no-such');
    expect(r).toEqual([]);
  });

  it('无 currentNodeId 返回空数组', async () => {
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce({ id: 'item-1', type: 'task', currentNodeId: null });
    const r = await getAvailableTransitions('item-1');
    expect(r).toEqual([]);
  });

  it('流程不存在返回空数组', async () => {
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce({ id: 'item-1', type: 'no-such', currentNodeId: 'n-start' });
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(null);
    const r = await getAvailableTransitions('item-1');
    expect(r).toEqual([]);
  });

  it('终节点无可流转目标', async () => {
    mocks.prisma.workItem.findUnique.mockResolvedValueOnce({ id: 'item-1', type: 'task', currentNodeId: 'n-done' });
    mocks.prisma.nodeFlow.findFirst.mockResolvedValueOnce(makeFlow());
    const r = await getAvailableTransitions('item-1');
    expect(r).toEqual([]);
  });
});
