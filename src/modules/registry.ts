/**
 * Реестр модулей. Карта — несущая основа; «картограф» и «пандусы» — модули,
 * каждый включается и выключается одним флагом. Сбой модуля основу не роняет:
 * модуль гаснет, карта и поиск живут.
 *
 * Откуда берётся флаг, по возрастанию силы:
 *   1. значение, зашитое в сборку (DEFAULT_FLAGS);
 *   2. файл `/modules.json` рядом с приложением: аварийный выключатель,
 *      правится одной строкой;
 *   3. адрес `?modules=-ramps,+mapper` (для проверок);
 *   4. предохранитель: модуль, упавший дважды за сессию, выключен до её конца.
 */
export type ModuleId = 'mapper' | 'ramps';
export type ModuleFlags = Record<ModuleId, boolean>;

export const MODULE_IDS: readonly ModuleId[] = ['mapper', 'ramps'];
export const DEFAULT_FLAGS: ModuleFlags = { mapper: true, ramps: true };
/** Столько падений за сессию выключают модуль. */
export const CRASH_LIMIT = 2;
/** Событие окна: состояние модулей изменилось. */
export const MODULES_EVENT = 'goapsny:modules';

const PARAM = 'modules';
const CRASH_KEY = 'goapsny:module-crashes';

function isModuleId(value: string): value is ModuleId {
  return (MODULE_IDS as readonly string[]).includes(value);
}

/** Разбор файла флагов: берём только известные модули и только булевы значения. */
export function parseFlagsFile(raw: unknown): Partial<ModuleFlags> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Partial<ModuleFlags> = {};
  for (const id of MODULE_IDS) {
    const value = (raw as Record<string, unknown>)[id];
    if (typeof value === 'boolean') out[id] = value;
  }
  return out;
}

/** Разбор адреса: `?modules=-ramps,+mapper`; без знака — включить. */
export function parseFlagsParam(search: string): Partial<ModuleFlags> {
  const value = new URLSearchParams(search).get(PARAM);
  if (!value) return {};
  const out: Partial<ModuleFlags> = {};
  for (const part of value.split(',')) {
    const token = part.trim();
    if (!token) continue;
    const off = token.startsWith('-');
    // «+» в адресе приходит пробелом, поэтому знак включения необязателен.
    const name = token.replace(/^[-+]/, '').trim();
    if (isModuleId(name)) out[name] = !off;
  }
  return out;
}

export function resolveFlags(
  file: Partial<ModuleFlags>,
  param: Partial<ModuleFlags>,
  crashes: Partial<Record<ModuleId, number>>,
): ModuleFlags {
  const flags: ModuleFlags = { ...DEFAULT_FLAGS, ...file, ...param };
  for (const id of MODULE_IDS) {
    if ((crashes[id] ?? 0) >= CRASH_LIMIT) flags[id] = false;
  }
  return flags;
}

function readCrashes(): Partial<Record<ModuleId, number>> {
  try {
    const raw = window.sessionStorage.getItem(CRASH_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Partial<Record<ModuleId, number>> = {};
    for (const id of MODULE_IDS) {
      const n = (parsed as Record<string, unknown>)[id];
      if (typeof n === 'number' && Number.isFinite(n)) out[id] = n;
    }
    return out;
  } catch {
    return {};
  }
}

let fileFlags: Partial<ModuleFlags> = {};
let memoryCrashes: Partial<Record<ModuleId, number>> = {};

function crashes(): Partial<Record<ModuleId, number>> {
  const stored = readCrashes();
  const out: Partial<Record<ModuleId, number>> = {};
  for (const id of MODULE_IDS) out[id] = Math.max(stored[id] ?? 0, memoryCrashes[id] ?? 0);
  return out;
}

export function currentFlags(search: string = window.location.search): ModuleFlags {
  return resolveFlags(fileFlags, parseFlagsParam(search), crashes());
}

export function isModuleOn(id: ModuleId): boolean {
  return currentFlags()[id];
}

function announce(): void {
  window.dispatchEvent(new Event(MODULES_EVENT));
}

/** Модуль упал: считаем; после CRASH_LIMIT он выключен до конца сессии. */
export function reportModuleCrash(id: ModuleId): number {
  const next = (crashes()[id] ?? 0) + 1;
  memoryCrashes = { ...memoryCrashes, [id]: next };
  try {
    window.sessionStorage.setItem(CRASH_KEY, JSON.stringify({ ...crashes(), [id]: next }));
  } catch {
    // Хранилище недоступно: счёт живёт в памяти до перезагрузки.
  }
  announce();
  return next;
}

/**
 * Читает `/modules.json`. Любой сбой (нет файла, нет сети, не JSON, долго)
 * оставляет зашитые значения: выключатель не должен мешать открыть карту.
 */
export async function loadModuleFlags(
  fetchImpl: typeof fetch = fetch,
  timeoutMs = 1500,
): Promise<ModuleFlags> {
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    const response = await fetchImpl('/modules.json', { cache: 'no-store', signal: controller?.signal });
    if (response.ok) fileFlags = parseFlagsFile(await response.json());
  } catch {
    // Остаёмся на зашитых значениях.
  } finally {
    if (timer) clearTimeout(timer);
  }
  announce();
  return currentFlags();
}

/** Только для тестов: вернуть реестр в исходное состояние. */
export function resetModulesForTests(): void {
  fileFlags = {};
  memoryCrashes = {};
  try {
    window.sessionStorage.removeItem(CRASH_KEY);
  } catch {
    // нет хранилища
  }
}
