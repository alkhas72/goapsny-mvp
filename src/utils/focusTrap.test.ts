import { describe, expect, it } from 'vitest';
import { getFocusableElements, trapFocus } from './focusTrap';

describe('focusTrap', () => {
  it('collects enabled focusable controls inside container', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button type="button">A</button>
      <button type="button" disabled>B</button>
      <a href="#">C</a>
    `;
    expect(getFocusableElements(container).map((el) => el.textContent)).toEqual(['A', 'C']);
  });

  it('calls onEscape from container keydown', () => {
    const container = document.createElement('div');
    container.innerHTML = '<button type="button">Close</button>';
    document.body.appendChild(container);
    let escaped = false;
    const release = trapFocus(container, { onEscape: () => { escaped = true; } });
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(escaped).toBe(true);
    release();
    container.remove();
  });
});
