import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CRASH_LIMIT,
  DEFAULT_FLAGS,
  currentFlags,
  isModuleOn,
  loadModuleFlags,
  parseFlagsFile,
  parseFlagsParam,
  reportModuleCrash,
  resetModulesForTests,
  resolveFlags,
} from './registry';

afterEach(() => resetModulesForTests());

const okJson = (body: unknown) =>
  vi.fn(async () => ({ ok: true, json: async () => body })) as unknown as typeof fetch;

describe('реестр модулей: флаги', () => {
  it('по умолчанию оба модуля включены', () => {
    expect(resolveFlags({}, {}, {})).toEqual(DEFAULT_FLAGS);
    expect(DEFAULT_FLAGS).toEqual({ mapper: true, ramps: true });
  });

  it('файл берёт только известные модули и только да/нет', () => {
    expect(parseFlagsFile({ ramps: false, mapper: 'нет', other: false })).toEqual({ ramps: false });
    expect(parseFlagsFile(null)).toEqual({});
    expect(parseFlagsFile('ramps')).toEqual({});
  });

  it('адрес выключает и включает', () => {
    expect(parseFlagsParam('?modules=-ramps')).toEqual({ ramps: false });
    expect(parseFlagsParam('?modules=-ramps,+mapper')).toEqual({ ramps: false, mapper: true });
    expect(parseFlagsParam('?modules=-ramps,%2Bmapper')).toEqual({ ramps: false, mapper: true });
    expect(parseFlagsParam('?modules=-чужой')).toEqual({});
    expect(parseFlagsParam('')).toEqual({});
  });

  it('адрес сильнее файла, предохранитель сильнее адреса', () => {
    expect(resolveFlags({ ramps: false }, { ramps: true }, {})).toEqual({ mapper: true, ramps: true });
    expect(resolveFlags({}, { ramps: true }, { ramps: CRASH_LIMIT })).toEqual({ mapper: true, ramps: false });
  });
});

describe('реестр модулей: аварийный выключатель', () => {
  it('файл modules.json выключает модуль', async () => {
    const flags = await loadModuleFlags(okJson({ ramps: false }));
    expect(flags).toEqual({ mapper: true, ramps: false });
    expect(isModuleOn('ramps')).toBe(false);
    expect(isModuleOn('mapper')).toBe(true);
  });

  it('нет файла, нет сети или не JSON: остаются зашитые значения', async () => {
    const notFound = vi.fn(async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    expect(await loadModuleFlags(notFound)).toEqual(DEFAULT_FLAGS);
    const offline = vi.fn(async () => {
      throw new Error('offline');
    }) as unknown as typeof fetch;
    expect(await loadModuleFlags(offline)).toEqual(DEFAULT_FLAGS);
    const broken = vi.fn(async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('не JSON');
      },
    })) as unknown as typeof fetch;
    expect(await loadModuleFlags(broken)).toEqual(DEFAULT_FLAGS);
  });
});

describe('реестр модулей: предохранитель', () => {
  it('одно падение модуль не выключает, второе выключает до конца сессии', () => {
    expect(reportModuleCrash('ramps')).toBe(1);
    expect(isModuleOn('ramps')).toBe(true);
    expect(reportModuleCrash('ramps')).toBe(2);
    expect(isModuleOn('ramps')).toBe(false);
    expect(currentFlags().mapper).toBe(true);
  });

  it('о смене состояния слышит окно', () => {
    const heard = vi.fn();
    window.addEventListener('goapsny:modules', heard);
    reportModuleCrash('mapper');
    window.removeEventListener('goapsny:modules', heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
