import { describe, expect, it, vi, afterEach } from 'vitest';
import { looksLikeTelegramLaunch, loadTelegramSdk } from './telegramSdk';

describe('looksLikeTelegramLaunch', () => {
  it('узнаёт запуск из Telegram по hash', () => {
    expect(looksLikeTelegramLaunch({ hash: '#tgWebAppData=abc', search: '' })).toBe(true);
  });

  it('узнаёт запуск из Telegram по query', () => {
    expect(looksLikeTelegramLaunch({ hash: '', search: '?tgWebAppStartParam=x' })).toBe(true);
  });

  it('обычный заход в браузере телеграмным не считает', () => {
    expect(looksLikeTelegramLaunch({ hash: '', search: '' })).toBe(false);
    expect(looksLikeTelegramLaunch({ hash: '#place=42', search: '?utm_source=vk' })).toBe(false);
  });
});

describe('loadTelegramSdk', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.head.querySelectorAll('script[src*="telegram.org"]').forEach((node) => node.remove());
  });

  it('сообщает о неудаче, если скрипт не загрузился', async () => {
    const pending = loadTelegramSdk(1000);
    const script = document.head.querySelector('script[src*="telegram.org"]');
    expect(script).not.toBeNull();
    script?.dispatchEvent(new Event('error'));
    await expect(pending).resolves.toBe(false);
  });

  it('сообщает об успехе после загрузки', async () => {
    const pending = loadTelegramSdk(1000);
    const script = document.head.querySelector('script[src*="telegram.org"]');
    script?.dispatchEvent(new Event('load'));
    await expect(pending).resolves.toBe(true);
  });

  it('не ждёт вечно: по таймауту отдаёт false', async () => {
    vi.useFakeTimers();
    const pending = loadTelegramSdk(100);
    // Событий нет — сеть повисла.
    await vi.advanceTimersByTimeAsync(150);
    await expect(pending).resolves.toBe(false);
  });

  it('грузит скрипт асинхронно, не блокируя разбор страницы', () => {
    void loadTelegramSdk(1000);
    const script = document.head.querySelector<HTMLScriptElement>('script[src*="telegram.org"]');
    expect(script?.async).toBe(true);
  });
});
