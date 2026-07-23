/**
 * V1.30.2 P3-1b 单元测试
 * 覆盖: 前端常量映射完整性
 */
import { describe, it, expect } from 'vitest';
import { TYPE_LABEL, TYPE_COLOR, PRIORITY_COLOR, STATUS_COLOR, type WorkItemType } from './types';

describe('前端常量映射完整性', () => {
  it('TYPE_LABEL 覆盖所有 WorkItemType', () => {
    const allTypes: WorkItemType[] = ['requirement', 'task', 'bug', 'release'];
    for (const t of allTypes) {
      expect(TYPE_LABEL[t]).toBeTruthy();
      expect(TYPE_LABEL[t].length).toBeGreaterThan(0);
    }
  });

  it('TYPE_COLOR 覆盖所有 WorkItemType (AntD 颜色 token)', () => {
    const allTypes: WorkItemType[] = ['requirement', 'task', 'bug', 'release'];
    for (const t of allTypes) {
      expect(TYPE_COLOR[t]).toBeTruthy();
    }
  });

  it('PRIORITY_COLOR 含 P0-P3', () => {
    expect(PRIORITY_COLOR.P0).toBeTruthy();
    expect(PRIORITY_COLOR.P1).toBeTruthy();
    expect(PRIORITY_COLOR.P2).toBeTruthy();
    expect(PRIORITY_COLOR.P3).toBeTruthy();
  });

  it('P0 红色, P3 默认灰色 (业务约定)', () => {
    expect(PRIORITY_COLOR.P0).toBe('red');
    expect(PRIORITY_COLOR.P3).toBe('default');
  });

  it('STATUS_COLOR 至少覆盖核心状态', () => {
    // 前端表格/看板渲染依赖这些 key 不能缺失
    const coreStatuses = ['待评审', '进行中', '已关闭', '已完成'];
    for (const s of coreStatuses) {
      expect(STATUS_COLOR[s]).toBeTruthy();
    }
  });
});
