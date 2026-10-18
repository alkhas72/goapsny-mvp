import { afterEach, expect, it, vi } from 'vitest';
import { registerServiceWorker } from './registerSw';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('registers immediately if the document has already loaded', async () => {
  const register = vi.fn().mockResolvedValue({});
  vi.stubGlobal('navigator', { serviceWorker: { register } });
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  registerServiceWorker();
  expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js');
});

it('waits for load and registers only once when the document is loading', async () => {
  const register = vi.fn().mockResolvedValue({});
  vi.stubGlobal('navigator', { serviceWorker: { register } });
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('interactive');
  registerServiceWorker();
  expect(register).not.toHaveBeenCalled();
  window.dispatchEvent(new Event('load'));
  window.dispatchEvent(new Event('load'));
  expect(register).toHaveBeenCalledExactlyOnceWith('/sw.js');
});

it('does nothing when service workers are unsupported', () => {
  vi.stubGlobal('navigator', {});
  const listen = vi.spyOn(window, 'addEventListener');
  registerServiceWorker();
  expect(listen).not.toHaveBeenCalled();
});

it('handles a registration rejection without an unhandled promise', async () => {
  const error = new Error('local test registration failed');
  const register = vi.fn().mockRejectedValue(error);
  vi.stubGlobal('navigator', { serviceWorker: { register } });
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  registerServiceWorker();
  await Promise.resolve();
  expect(warn).toHaveBeenCalledWith('Service worker registration failed', error);
});
