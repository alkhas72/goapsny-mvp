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

  it('wraps focus forward with Tab on last element', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button type="button" id="first">First</button>
      <button type="button" id="last">Last</button>
    `;
    document.body.appendChild(container);
    const first = container.querySelector('#first') as HTMLButtonElement;
    const last = container.querySelector('#last') as HTMLButtonElement;
    const release = trapFocus(container);
    last.focus();
    last.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(first);
    release();
    container.remove();
  });

  it('wraps focus backward with Shift+Tab on first element', () => {
    const container = document.createElement('div');
    container.innerHTML = `
      <button type="button" id="first">First</button>
      <button type="button" id="last">Last</button>
    `;
    document.body.appendChild(container);
    const first = container.querySelector('#first') as HTMLButtonElement;
    const last = container.querySelector('#last') as HTMLButtonElement;
    const release = trapFocus(container);
    first.focus();
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(last);
    release();
    container.remove();
  });
});
