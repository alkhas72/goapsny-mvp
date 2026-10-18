import { expect, it, vi } from 'vitest';
import { trapLabFocus } from './labFocus';

it('handles Escape after a submitted form removes the focused button', () => {
  const trigger = document.createElement('button');
  const dialog = document.createElement('article');
  const close = document.createElement('button');
  const submit = document.createElement('button');
  document.body.append(trigger, dialog); dialog.append(close, submit);
  trigger.focus();
  const onEscape = vi.fn();
  const release = trapLabFocus(dialog, { initialFocus: close, onEscape });
  submit.focus(); submit.remove();
  expect(document.activeElement).toBe(document.body);
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  expect(onEscape).toHaveBeenCalledOnce();
  release(); expect(document.activeElement).toBe(trigger);
  trigger.remove(); dialog.remove();
});
