// V1.50: workItemLinker 单元测试
import { describe, it, expect } from 'vitest';
import {
  WORK_ITEM_KEY_REGEX,
  parseWorkItemHref,
  buildWorkItemHref,
  workItemLinkPath,
  linkifyWorkItemKeys,
  extractWorkItemKeys,
  WORK_ITEM_HREF_PREFIX,
  KEY_PREFIX_TO_TYPE,
} from './workItemLinker';

describe('parseWorkItemHref', () => {
  it('parses valid work-item href', () => {
    expect(parseWorkItemHref(`${WORK_ITEM_HREF_PREFIX}REQ-1`)).toEqual({ type: 'requirement', key: 'REQ-1' });
    expect(parseWorkItemHref(`${WORK_ITEM_HREF_PREFIX}TASK-42`)).toEqual({ type: 'task', key: 'TASK-42' });
    expect(parseWorkItemHref(`${WORK_ITEM_HREF_PREFIX}BUG-3`)).toEqual({ type: 'bug', key: 'BUG-3' });
    expect(parseWorkItemHref(`${WORK_ITEM_HREF_PREFIX}REL-7`)).toEqual({ type: 'release', key: 'REL-7' });
  });

  it('rejects invalid href', () => {
    expect(parseWorkItemHref('https://example.com')).toBeNull();
    expect(parseWorkItemHref(`${WORK_ITEM_HREF_PREFIX}`)).toBeNull();
    expect(parseWorkItemHref(`${WORK_ITEM_HREF_PREFIX}XYZ-1`)).toBeNull();
    expect(parseWorkItemHref(`${WORK_ITEM_HREF_PREFIX}REQ-`)).toBeNull();
    expect(parseWorkItemHref('')).toBeNull();
  });
});

describe('buildWorkItemHref', () => {
  it('builds correct href', () => {
    expect(buildWorkItemHref('REQ-1')).toBe(`${WORK_ITEM_HREF_PREFIX}REQ-1`);
    expect(buildWorkItemHref('BUG-99')).toBe(`${WORK_ITEM_HREF_PREFIX}BUG-99`);
  });
});

describe('workItemLinkPath', () => {
  it('returns react-router path', () => {
    expect(workItemLinkPath('REQ-1')).toBe('/work-items/requirement/REQ-1');
    expect(workItemLinkPath('TASK-2')).toBe('/work-items/task/TASK-2');
  });

  it('returns null for invalid', () => {
    expect(workItemLinkPath('XYZ-1')).toBeNull();
    expect(workItemLinkPath('REQ')).toBeNull();
  });
});

describe('KEY_PREFIX_TO_TYPE', () => {
  it('has all 4 work types', () => {
    expect(KEY_PREFIX_TO_TYPE).toEqual({
      REQ: 'requirement',
      TASK: 'task',
      BUG: 'bug',
      REL: 'release',
    });
  });
});

describe('linkifyWorkItemKeys', () => {
  it('replaces plain key with anchor', () => {
    const out = linkifyWorkItemKeys('see REQ-1 for details');
    expect(out).toContain('href="avm-wi://REQ-1"');
    expect(out).toContain('class="avm-wi-link"');
    expect(out).toContain('>REQ-1</a>');
  });

  it('replaces multiple keys', () => {
    const out = linkifyWorkItemKeys('REQ-1 and TASK-42 and BUG-3');
    expect((out.match(/<a /g) || []).length).toBe(3);
  });

  it('skips keys inside inline code', () => {
    const out = linkifyWorkItemKeys('use `REQ-1` in code');
    expect(out).not.toContain('<a ');
    expect(out).toContain('`REQ-1`');
  });

  it('skips keys inside markdown link text', () => {
    const out = linkifyWorkItemKeys('[REQ-1](https://example.com)');
    expect(out).not.toContain('class="avm-wi-link"');
  });

  it('skips keys inside markdown image', () => {
    const out = linkifyWorkItemKeys('![REQ-1](image.png)');
    expect(out).not.toContain('class="avm-wi-link"');
  });

  it('skips keys inside existing <a> tag', () => {
    const out = linkifyWorkItemKeys('<a href="x">REQ-1</a>');
    expect(out).not.toContain('class="avm-wi-link"');
  });

  it('skips key adjacent to attribute chars', () => {
    // 当 key 紧跟在 =" 之后（HTML 属性中）应跳过
    const out = linkifyWorkItemKeys('title="REQ-1"');
    expect(out).not.toContain('class="avm-wi-link"');
  });

  it('respects word boundaries', () => {
    // XXREQ-1 不应匹配
    const out = linkifyWorkItemKeys('XXREQ-1 not matched');
    expect(out).not.toContain('<a ');
  });

  it('returns empty string unchanged', () => {
    expect(linkifyWorkItemKeys('')).toBe('');
  });

  it('handles content with no keys', () => {
    expect(linkifyWorkItemKeys('plain text')).toBe('plain text');
  });
});

describe('extractWorkItemKeys', () => {
  it('extracts unique keys in order', () => {
    expect(extractWorkItemKeys('REQ-1 and TASK-2 and REQ-1 again')).toEqual(['REQ-1', 'TASK-2']);
  });

  it('returns empty for empty input', () => {
    expect(extractWorkItemKeys('')).toEqual([]);
    expect(extractWorkItemKeys('no keys here')).toEqual([]);
  });
});

describe('WORK_ITEM_KEY_REGEX', () => {
  it('matches all 4 prefixes', () => {
    const text = 'REQ-1 TASK-2 BUG-3 REL-4';
    const matches = [...text.matchAll(WORK_ITEM_KEY_REGEX)].map(m => m[0]);
    expect(matches).toEqual(['REQ-1', 'TASK-2', 'BUG-3', 'REL-4']);
  });

  it('uses global flag for replaceAll semantics', () => {
    expect(WORK_ITEM_KEY_REGEX.global).toBe(true);
  });
});
