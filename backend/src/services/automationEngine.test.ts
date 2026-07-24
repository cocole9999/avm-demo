/**
 * 自动化引擎单元测试
 * 测试 listTriggers/listConditions/listActions 元数据 + testRule 干跑逻辑
 * testRule 不写数据库, 仅评估条件并预览动作 -> 可作为纯函数测试
 */
import { describe, it, expect } from 'vitest';
import {
  listTriggers,
  listConditions,
  listActions,
  testRule,
  TRIGGERS,
  CONDITIONS,
  ACTIONS,
} from './automationEngine';

describe('services/automationEngine - 元数据', () => {
  it('listTriggers 返回触发器列表', () => {
    const t = listTriggers();
    expect(Array.isArray(t)).toBe(true);
    expect(t.length).toBeGreaterThan(10);
  });

  it('listConditions 返回条件列表', () => {
    const c = listConditions();
    expect(Array.isArray(c)).toBe(true);
    expect(c.length).toBeGreaterThan(5);
  });

  it('listActions 返回操作列表', () => {
    const a = listActions();
    expect(Array.isArray(a)).toBe(true);
    expect(a.length).toBeGreaterThan(5);
  });

  it('触发器都包含 type/label/resource', () => {
    for (const t of TRIGGERS) {
      expect(t.type).toBeTruthy();
      expect(t.label).toBeTruthy();
      expect(t.resource).toBeTruthy();
    }
  });

  it('每个条件定义合法的 op 列表', () => {
    for (const c of CONDITIONS) {
      expect(c.field).toBeTruthy();
      expect(c.label).toBeTruthy();
      expect(Array.isArray(c.op)).toBe(true);
      expect(c.op.length).toBeGreaterThan(0);
    }
  });

  it('每个动作包含 type/label/config', () => {
    for (const a of ACTIONS) {
      expect(a.type).toBeTruthy();
      expect(a.label).toBeTruthy();
      expect(a.config).toBeDefined();
    }
  });

  it('包含关键触发器 type', () => {
    const types = TRIGGERS.map(t => t.type);
    expect(types).toContain('work_item.created');
    expect(types).toContain('work_item.status_changed');
    expect(types).toContain('review.approved');
    expect(types).toContain('manual');
    expect(types).toContain('scheduled.daily');
  });
});

describe('services/automationEngine - testRule 条件评估', () => {
  it('空条件 = 总是匹配', async () => {
    const rule = {
      id: 'r1',
      name: '空条件规则',
      conditions: '[]',
      actions: '[]',
    };
    const r = await testRule(rule, { type: 'task' });
    expect(r.matched).toBe(true);
    expect(r.conditionsEval).toEqual([]);
  });

  it('eq 操作精确匹配', async () => {
    const rule = {
      id: 'r2',
      name: 'type=bug',
      conditions: JSON.stringify([{ field: 'type', op: 'eq', value: 'bug' }]),
      actions: '[]',
    };
    expect((await testRule(rule, { type: 'bug' })).matched).toBe(true);
    expect((await testRule(rule, { type: 'task' })).matched).toBe(false);
  });

  it('neq 操作', async () => {
    const rule = {
      id: 'r3',
      name: 'type != bug',
      conditions: JSON.stringify([{ field: 'type', op: 'neq', value: 'bug' }]),
      actions: '[]',
    };
    expect((await testRule(rule, { type: 'task' })).matched).toBe(true);
    expect((await testRule(rule, { type: 'bug' })).matched).toBe(false);
  });

  it('in / not_in 操作', async () => {
    const rule = {
      id: 'r4',
      conditions: JSON.stringify([{ field: 'status', op: 'in', value: ['待评审', '进行中'] }]),
      actions: '[]',
    };
    expect((await testRule(rule, { status: '待评审' })).matched).toBe(true);
    expect((await testRule(rule, { status: '进行中' })).matched).toBe(true);
    expect((await testRule(rule, { status: '已完成' })).matched).toBe(false);
  });

  it('gt / gte / lt / lte 数值比较', async () => {
    const gtRule = {
      id: 'r5',
      conditions: JSON.stringify([{ field: 'estimate', op: 'gt', value: 5 }]),
      actions: '[]',
    };
    expect((await testRule(gtRule, { estimate: 6 })).matched).toBe(true);
    expect((await testRule(gtRule, { estimate: 5 })).matched).toBe(false);
    expect((await testRule(gtRule, { estimate: 4 })).matched).toBe(false);

    const gteRule = {
      id: 'r5b',
      conditions: JSON.stringify([{ field: 'estimate', op: 'gte', value: 5 }]),
      actions: '[]',
    };
    expect((await testRule(gteRule, { estimate: 5 })).matched).toBe(true);
    expect((await testRule(gteRule, { estimate: 4 })).matched).toBe(false);
  });

  it('contains / not_contains 字符串包含', async () => {
    const rule = {
      id: 'r6',
      conditions: JSON.stringify([{ field: 'title', op: 'contains', value: '紧急' }]),
      actions: '[]',
    };
    expect((await testRule(rule, { title: '紧急修复' })).matched).toBe(true);
    expect((await testRule(rule, { title: '普通任务' })).matched).toBe(false);
  });

  it('empty / not_empty 判空', async () => {
    const rule = {
      id: 'r7',
      conditions: JSON.stringify([{ field: 'assignee', op: 'empty' }]),
      actions: '[]',
    };
    expect((await testRule(rule, { assignee: null })).matched).toBe(true);
    expect((await testRule(rule, { assignee: '' })).matched).toBe(true);
    expect((await testRule(rule, { assignee: 'zhangsan' })).matched).toBe(false);
  });

  it('多条件 AND 关系', async () => {
    const rule = {
      id: 'r8',
      conditions: JSON.stringify([
        { field: 'type', op: 'eq', value: 'bug' },
        { field: 'priority', op: 'eq', value: 'P0' },
      ]),
      actions: '[]',
    };
    expect((await testRule(rule, { type: 'bug', priority: 'P0' })).matched).toBe(true);
    expect((await testRule(rule, { type: 'bug', priority: 'P1' })).matched).toBe(false);
    expect((await testRule(rule, { type: 'task', priority: 'P0' })).matched).toBe(false);
  });

  it('changed_to 变更检测', async () => {
    const rule = {
      id: 'r9',
      conditions: JSON.stringify([{ field: 'status', op: 'changed_to', value: '已完成' }]),
      actions: '[]',
    };
    // _status_prev 是约定前值
    expect((await testRule(rule, { status: '已完成', _status_prev: '进行中' })).matched).toBe(true);
    expect((await testRule(rule, { status: '进行中', _status_prev: '进行中' })).matched).toBe(false);
  });

  it('before / after 日期比较', async () => {
    const rule = {
      id: 'r10',
      conditions: JSON.stringify([{ field: 'planEnd', op: 'before', value: '2024-12-31' }]),
      actions: '[]',
    };
    expect((await testRule(rule, { planEnd: '2024-06-01' })).matched).toBe(true);
    expect((await testRule(rule, { planEnd: '2025-06-01' })).matched).toBe(false);
    expect((await testRule(rule, { planEnd: null })).matched).toBe(false);
  });
});

describe('services/automationEngine - testRule 动作预览', () => {
  it('actionsPreview 列出所有动作的 wouldDo 描述', async () => {
    const rule = {
      id: 'r11',
      name: '预览测试',
      conditions: '[]',
      actions: JSON.stringify([
        { type: 'update_field', config: { field: 'priority', value: 'P0' } },
        { type: 'add_comment', config: { content: '紧急' } },
        { type: 'send_notification', config: { recipientId: 'u1', title: 't', content: 'c' } },
        { type: 'create_work_item', config: { type: 'task', title: '子任务' } },
        { type: 'assign_user', config: { userId: 'u2' } },
      ]),
    };
    const r = await testRule(rule, {});
    expect(r.actionsPreview.length).toBe(5);
    expect(r.actionsPreview[0].wouldDo).toContain('priority');
    expect(r.actionsPreview[1].wouldDo).toContain('紧急');
    expect(r.actionsPreview[2].wouldDo).toContain('u1');
    expect(r.actionsPreview[3].wouldDo).toContain('子任务');
    expect(r.actionsPreview[4].wouldDo).toContain('u2');
  });

  it('未知动作类型原样返回 type', async () => {
    const rule = {
      id: 'r12',
      conditions: '[]',
      actions: JSON.stringify([{ type: 'unknown_action', config: {} }]),
    };
    const r = await testRule(rule, {});
    expect(r.actionsPreview[0].wouldDo).toBe('unknown_action');
  });

  it('conditionsEval 包含 condition/result/actual', async () => {
    const rule = {
      id: 'r13',
      conditions: JSON.stringify([{ field: 'type', op: 'eq', value: 'bug' }]),
      actions: '[]',
    };
    const r = await testRule(rule, { type: 'bug' });
    expect(r.conditionsEval.length).toBe(1);
    expect(r.conditionsEval[0].result).toBe(true);
    expect(r.conditionsEval[0].actual).toBe('bug');
    expect(r.conditionsEval[0].condition).toBeDefined();
  });
});
