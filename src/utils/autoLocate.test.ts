import { describe, expect, it, vi } from 'vitest';
import { shouldAutoLocate } from './autoLocate';

/** Подменяет navigator.permissions.query заданным состоянием. */
function withPermission(state: PermissionState | null) {
  if (state === null) {
    return { permissions: undefined } as unknown as Navigator;
  }
  return {
    permissions: { query: vi.fn().mockResolvedValue({ state }) },
  } as unknown as Navigator;
}

describe('shouldAutoLocate', () => {
  it('показывает сразу, если доступ уже разрешён', async () => {
    await expect(shouldAutoLocate(withPermission('granted'))).resolves.toBe(true);
  });

  it('спрашивает при первом заходе: человек ждёт увидеть себя на карте', async () => {
    await expect(shouldAutoLocate(withPermission('prompt'))).resolves.toBe(true);
  });

  it('не донимает того, кто уже отказал', async () => {
    await expect(shouldAutoLocate(withPermission('denied'))).resolves.toBe(false);
  });

  it('пробует определить, если браузер не умеет сообщать состояние доступа', async () => {
    // Safari долгое время не поддерживал Permissions API для геолокации.
    await expect(shouldAutoLocate(withPermission(null))).resolves.toBe(true);
  });

  it('не падает, если запрос состояния бросает исключение', async () => {
    const navigatorLike = {
      permissions: { query: vi.fn().mockRejectedValue(new Error('unsupported')) },
    } as unknown as Navigator;
    await expect(shouldAutoLocate(navigatorLike)).resolves.toBe(true);
  });
});
