// V1.53: vitest setup - mock browser APIs not available in jsdom
import { vi } from 'vitest';

// antd 依赖 window.matchMedia (响应式断点)
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// 部分 antd 组件依赖 getComputedStyle
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = (elt: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(elt, pseudoElt);
  // 确保某些 CSS 属性有默认值，避免 antd 内部计算异常
  if (!style.fontSize) {
    Object.defineProperty(style, 'fontSize', { value: '16px' });
  }
  return style;
};