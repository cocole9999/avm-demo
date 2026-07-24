/**
 * 公式引擎单元测试
 * 测试 evaluateFormula / formatFormulaValue / getFormulaMeta 纯函数
 * 不依赖数据库
 */
import { describe, it, expect } from 'vitest';
import {
  evaluateFormula,
  formatFormulaValue,
  getFormulaMeta,
} from './formulaEngine';

describe('services/formulaEngine - 基础算术', () => {
  it('数字字面量求值', () => {
    expect(evaluateFormula('42', {})).toBe(42);
    expect(evaluateFormula('3.14', {})).toBe(3.14);
  });

  it('四则运算遵循优先级', () => {
    expect(evaluateFormula('1 + 2 * 3', {})).toBe(7);
    expect(evaluateFormula('(1 + 2) * 3', {})).toBe(9);
    expect(evaluateFormula('10 / 4', {})).toBe(2.5);
    expect(evaluateFormula('10 % 3', {})).toBe(1);
  });

  it('除以 0 返回 0 而不抛错', () => {
    expect(evaluateFormula('5 / 0', {})).toBe(0);
    expect(evaluateFormula('5 % 0', {})).toBe(0);
  });

  it('负数运算', () => {
    expect(evaluateFormula('-5', {})).toBe(-5);
    expect(evaluateFormula('3 + -2', {})).toBe(1);
    expect(evaluateFormula('-(2 + 3)', {})).toBe(-5);
  });

  it('空字符串返回 0', () => {
    expect(evaluateFormula('', {})).toBe(0);
    expect(evaluateFormula('   ', {})).toBe(0);
  });
});

describe('services/formulaEngine - 比较运算', () => {
  it('等于/不等于返回 0/1', () => {
    expect(evaluateFormula('1 = 1', {})).toBe(1);
    expect(evaluateFormula('1 = 2', {})).toBe(0);
    expect(evaluateFormula('1 != 2', {})).toBe(1);
    expect(evaluateFormula('1 != 1', {})).toBe(0);
  });

  it('大小比较', () => {
    expect(evaluateFormula('5 > 3', {})).toBe(1);
    expect(evaluateFormula('3 > 5', {})).toBe(0);
    expect(evaluateFormula('3 >= 3', {})).toBe(1);
    expect(evaluateFormula('2 <= 3', {})).toBe(1);
    expect(evaluateFormula('5 < 3', {})).toBe(0);
  });
});

describe('services/formulaEngine - 字段解析', () => {
  it('读取数字字段', () => {
    const ctx = { estimate: 8, actualHours: 3 };
    expect(evaluateFormula('estimate', ctx)).toBe(8);
    expect(evaluateFormula('estimate + actualHours', ctx)).toBe(11);
    expect(evaluateFormula('estimate - actualHours', ctx)).toBe(5);
  });

  it('未定义字段返回 0', () => {
    expect(evaluateFormula('nonexistent', {})).toBe(0);
    expect(evaluateFormula('nonexistent + 5', {})).toBe(5);
  });

  it('remaining = max(0, estimate - actualHours)', () => {
    expect(evaluateFormula('remaining', { estimate: 10, actualHours: 3 })).toBe(7);
    expect(evaluateFormula('remaining', { estimate: 5, actualHours: 8 })).toBe(0);
  });

  it('progress = min(1, actualHours / estimate)', () => {
    expect(evaluateFormula('progress', { estimate: 10, actualHours: 5 })).toBe(0.5);
    expect(evaluateFormula('progress', { estimate: 10, actualHours: 20 })).toBe(1);
    expect(evaluateFormula('progress', { estimate: 0, actualHours: 5 })).toBe(0);
  });

  it('priority 数值 P0=4 P1=3 P2=2 P3=1', () => {
    expect(evaluateFormula('priority', { priority: 'P0' })).toBe(4);
    expect(evaluateFormula('priority', { priority: 'P1' })).toBe(3);
    expect(evaluateFormula('priority', { priority: 'P2' })).toBe(2);
    expect(evaluateFormula('priority', { priority: 'P3' })).toBe(1);
    expect(evaluateFormula('priority', { priority: 'PX' })).toBe(0);
  });

  it('isCompleted/isActive 状态判定', () => {
    expect(evaluateFormula('isCompleted', { status: '已完成' })).toBe(1);
    expect(evaluateFormula('isCompleted', { status: '已关闭' })).toBe(1);
    expect(evaluateFormula('isCompleted', { status: '进行中' })).toBe(0);
    expect(evaluateFormula('isActive', { status: '进行中' })).toBe(1);
    expect(evaluateFormula('isActive', { status: '已完成' })).toBe(0);
  });
});

describe('services/formulaEngine - 字符串函数', () => {
  it('CONCAT 拼接', () => {
    expect(evaluateFormula('CONCAT("a", "b", "c")', {})).toBe('abc');
  });

  it('CONCAT_WS 带分隔符拼接', () => {
    expect(evaluateFormula('CONCAT_WS("-", "a", "b", "c")', {})).toBe('a-b-c');
  });

  it('UPPER / LOWER / TRIM', () => {
    expect(evaluateFormula('UPPER("abc")', {})).toBe('ABC');
    expect(evaluateFormula('LOWER("ABC")', {})).toBe('abc');
    expect(evaluateFormula('TRIM("  hi  ")', {})).toBe('hi');
  });

  it('LEFT / RIGHT / MID', () => {
    expect(evaluateFormula('LEFT("hello", 3)', {})).toBe('hel');
    expect(evaluateFormula('RIGHT("hello", 3)', {})).toBe('llo');
    expect(evaluateFormula('MID("hello", 2, 3)', {})).toBe('ell');
  });

  it('LEN 返回字符串长度', () => {
    expect(evaluateFormula('LEN("hello")', {})).toBe(5);
    expect(evaluateFormula('LEN("")', {})).toBe(0);
  });

  it('REPLACE 替换', () => {
    expect(evaluateFormula('REPLACE("a-b-c", "-", "_")', {})).toBe('a_b_c');
  });
});

describe('services/formulaEngine - 数学函数', () => {
  it('SUM / AVG / MAX / MIN', () => {
    expect(evaluateFormula('SUM(1, 2, 3)', {})).toBe(6);
    expect(evaluateFormula('AVG(2, 4, 6)', {})).toBe(4);
    expect(evaluateFormula('MAX(1, 5, 3)', {})).toBe(5);
    expect(evaluateFormula('MIN(1, 5, 3)', {})).toBe(1);
  });

  it('AVG 空数组返回 0', () => {
    expect(evaluateFormula('AVG()', {})).toBe(0);
  });

  it('ROUND / ROUND_UP / ROUND_DOWN / CEIL / FLOOR', () => {
    expect(evaluateFormula('ROUND(3.5)', {})).toBe(4);
    expect(evaluateFormula('ROUND(3.4)', {})).toBe(3);
    expect(evaluateFormula('ROUND_UP(3.1)', {})).toBe(4);
    expect(evaluateFormula('ROUND_DOWN(3.9)', {})).toBe(3);
    expect(evaluateFormula('CEIL(3.1)', {})).toBe(4);
    expect(evaluateFormula('FLOOR(3.9)', {})).toBe(3);
  });

  it('ABS / POWER / SQRT / MOD', () => {
    expect(evaluateFormula('ABS(-5)', {})).toBe(5);
    expect(evaluateFormula('POWER(2, 3)', {})).toBe(8);
    expect(evaluateFormula('SQRT(9)', {})).toBe(3);
    expect(evaluateFormula('MOD(10, 3)', {})).toBe(1);
  });

  it('CLAMP 区间约束', () => {
    expect(evaluateFormula('CLAMP(15, 0, 10)', {})).toBe(10);
    expect(evaluateFormula('CLAMP(-5, 0, 10)', {})).toBe(0);
    expect(evaluateFormula('CLAMP(5, 0, 10)', {})).toBe(5);
  });

  it('IFNULL 处理 null/空 (0 不视为 null)', () => {
    // 源码: args[0] == null || args[0] === '' ? 第二参数 : 第一参数
    expect(evaluateFormula('IFNULL(0, 99)', {})).toBe(0);  // 0 不是 null
    expect(evaluateFormula('IFNULL(5, 99)', {})).toBe(5);
    expect(evaluateFormula('IFNULL("", 99)', {})).toBe(99);  // 空字符串视为 null
  });
});

describe('services/formulaEngine - IF / IFS', () => {
  it('IF 真分支', () => {
    expect(evaluateFormula('IF(1 > 0, "yes", "no")', {})).toBe('yes');
  });

  it('IF 假分支', () => {
    expect(evaluateFormula('IF(1 < 0, "yes", "no")', {})).toBe('no');
  });

  it('IFS 多分支匹配', () => {
    const r = evaluateFormula('IFS(1 = 1, "a", 2 = 2, "b", "default")', {});
    expect(r).toBe('a');
  });

  it('IFS 落到 default', () => {
    const r = evaluateFormula('IFS(1 = 2, "a", 2 = 3, "b", "default")', {});
    expect(r).toBe('default');
  });
});

describe('services/formulaEngine - 日期函数', () => {
  it('DAYS 计算天数差', () => {
    expect(evaluateFormula('DAYS("2024-01-01", "2024-01-11")', {})).toBe(10);
  });

  it('DATE_DIFF 不同单位', () => {
    expect(evaluateFormula('DATE_DIFF("2024-01-01", "2024-01-02", "day")', {})).toBe(1);
    expect(evaluateFormula('DATE_DIFF("2024-01-01", "2024-01-02", "hour")', {})).toBe(24);
  });

  it('YEAR/MONTH/DAY 提取', () => {
    expect(evaluateFormula('YEAR("2024-06-15")', {})).toBe(2024);
    expect(evaluateFormula('MONTH("2024-06-15")', {})).toBe(6);
    expect(evaluateFormula('DAY("2024-06-15")', {})).toBe(15);
  });

  it('WEEKDAY 周几', () => {
    // 2024-01-01 是星期一
    expect(evaluateFormula('WEEKDAY("2024-01-01")', {})).toBe(1);
  });

  it('DATE_FORMAT 格式化', () => {
    expect(evaluateFormula('DATE_FORMAT("2024-06-15T08:00:00Z")', {})).toBe('2024-06-15');
  });
});

describe('services/formulaEngine - formatFormulaValue', () => {
  it('百分比输出 (0-1 范围)', () => {
    expect(formatFormulaValue(0.5, '', 'percent')).toBe('50%');
    expect(formatFormulaValue(1, '', 'percent')).toBe('100%');
  });

  it('百分比输出 (>1 视作已是百分数)', () => {
    expect(formatFormulaValue(50, '', 'percent')).toBe('50%');
  });

  it('小数精度格式化', () => {
    expect(formatFormulaValue(3.14159, '0.0', 'number')).toBe(3.1);
    expect(formatFormulaValue(3.14159, '0.00', 'number')).toBe(3.14);
    expect(formatFormulaValue(3.14159, '0', 'number')).toBe(3);
  });

  it('日期输出', () => {
    const d = new Date('2024-06-15T00:00:00Z');
    expect(formatFormulaValue(d, '', 'date')).toBe('2024-06-15');
    expect(formatFormulaValue(d.getTime(), '', 'date')).toBe('2024-06-15');
  });

  it('文本输出转字符串', () => {
    expect(formatFormulaValue(42, '', 'text')).toBe('42');
    expect(formatFormulaValue('abc', '', 'text')).toBe('abc');
  });

  it('null 返回 null', () => {
    expect(formatFormulaValue(null, '', 'number')).toBe(null);
  });
});

describe('services/formulaEngine - getFormulaMeta', () => {
  it('返回字段、函数列表', () => {
    const meta = getFormulaMeta();
    expect(Array.isArray(meta.fields)).toBe(true);
    expect(meta.fields.length).toBeGreaterThan(10);
    expect(meta.numberFunctions).toContain('SUM');
    expect(meta.numberFunctions).toContain('IF');
    expect(meta.stringFunctions).toContain('CONCAT');
    expect(meta.dateFunctions).toContain('DAYS');
  });

  it('字段定义包含类型和描述', () => {
    const meta = getFormulaMeta();
    const estimate = meta.fields.find(f => f.key === 'estimate');
    expect(estimate).toBeDefined();
    expect(estimate?.type).toBe('number');
    expect(estimate?.desc).toBeTruthy();
  });
});
