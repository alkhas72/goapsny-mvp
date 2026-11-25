import {
  submitMapperPlace,
  type SubmitMapperPlaceInput,
  type SubmitMapperPlaceOptions,
  type SubmitMapperPlaceResult,
} from './submit-mapper-place';
import { SubmitPlaceError, generatePlaceId, type SubmitPlaceErrorKind } from './submit-place';

/**
 * Отложенная отправка пути картографа.
 *
 * В поле связь пропадает, а сервер может ещё не принимать карточки. Чтобы
 * снятый вход не терялся, карточка с уже подготовленным фото кладётся на
 * устройство (IndexedDB) и уходит позже: при открытии карты, при возврате
 * связи или по кнопке в кабинете.
 *
 * Идентификатор места выдаётся один раз, при постановке в очередь, и каждая
 * попытка идёт с ним же: повтор после оборванного ответа не создаёт дубль.
 * Карточка привязана к вошедшему человеку и под чужим входом не уходит.
 */

/** Почему карточка ждёт: вид отказа сервера или «нет сети». */
export type OutboxReason = SubmitPlaceErrorKind | 'offline';

export interface OutboxItem {
  /** UUID будущего места. */
  id: string;
  /** Кто снял объект (auth.uid()). */
  owner: string;
  createdAt: string;
  input: SubmitMapperPlaceInput;
  attempts: number;
  /** Когда пробовали отправить в последний раз. */
  lastTriedAt: string | null;
  reason: OutboxReason;
  /** Сервер отказал по существу: повтор не поможет, решает человек. */
  blocked: boolean;
}

export interface OutboxStore {
  all(): Promise<OutboxItem[]>;
  put(item: OutboxItem): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface FlushResult {
  sent: number;
  left: OutboxItem[];
}

export interface MapperOutbox {
  add(owner: string, input: SubmitMapperPlaceInput, reason: OutboxReason): Promise<OutboxItem>;
  list(owner: string): Promise<OutboxItem[]>;
  remove(id: string): Promise<void>;
  /**
   * Отправить всё, что ждёт. `auto` — фоновая попытка (открытие карты,
   * возврат связи): она не дёргает сервер, который только что ответил
   * «ещё не принимаю», чтобы не гонять фото туда и обратно.
   */
  flush(owner: string, options?: { auto?: boolean }): Promise<FlushResult>;
}

/** Сколько фоновая попытка ждёт после ответа «сервер ещё не принимает». */
export const NOT_READY_PAUSE_MS = 10 * 60 * 1000;

/** Отказы, после которых карточку стоит придержать: дело не в ней. */
const WAITING: ReadonlySet<OutboxReason> = new Set<OutboxReason>([
  'offline',
  'unknown',
  'missing_photo',
  'facade_object_missing',
  'server_not_ready',
  'auth_required',
  'not_configured',
]);

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/** Вид отказа для очереди; всё непонятное считается сбоем связи. */
export function outboxReason(error: unknown): OutboxReason {
  if (isOffline()) return 'offline';
  return error instanceof SubmitPlaceError ? error.kind : 'unknown';
}

/** Можно ли отложить отправку после такой ошибки. */
export function canWait(error: unknown): boolean {
  if (isOffline()) return true;
  return error instanceof SubmitPlaceError && WAITING.has(error.kind);
}

// ---------------------------------------------------------------------------
// Хранилища
// ---------------------------------------------------------------------------

const DB_NAME = 'goapsny-mapper';
const STORE_NAME = 'outbox';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB is not available'));
    request.onblocked = () => reject(new Error('IndexedDB is blocked'));
  });
}

function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, mode);
        const request = work(tx.objectStore(STORE_NAME));
        tx.oncomplete = () => {
          db.close();
          resolve(request.result);
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB transaction failed'));
        };
        tx.onabort = () => {
          db.close();
          reject(tx.error ?? new Error('IndexedDB transaction aborted'));
        };
      }),
  );
}

/** Очередь на устройстве: переживает закрытие вкладки и перезагрузку. */
export function idbOutboxStore(): OutboxStore {
  return {
    all: () => run<OutboxItem[]>('readonly', (store) => store.getAll() as IDBRequest<OutboxItem[]>),
    put: (item) => run('readwrite', (store) => store.put(item)).then(() => undefined),
    remove: (id) => run('readwrite', (store) => store.delete(id)).then(() => undefined),
  };
}

/** Очередь в памяти: для тестов и для браузеров без IndexedDB (живёт до закрытия вкладки). */
export function memoryOutboxStore(initial: OutboxItem[] = []): OutboxStore {
  const items = new Map(initial.map((item) => [item.id, item]));
  return {
    all: async () => [...items.values()],
    put: async (item) => {
      items.set(item.id, item);
    },
    remove: async (id) => {
      items.delete(id);
    },
  };
}

// ---------------------------------------------------------------------------
// Очередь
// ---------------------------------------------------------------------------

type Submit = (
  input: SubmitMapperPlaceInput,
  options?: SubmitMapperPlaceOptions,
) => Promise<SubmitMapperPlaceResult>;

export interface MapperOutboxOptions {
  store?: OutboxStore;
  submit?: Submit;
  generateId?: () => string;
  now?: () => Date;
}

export function createMapperOutbox(options: MapperOutboxOptions = {}): MapperOutbox {
  let store = options.store ?? null;
  const getStore = (): OutboxStore => {
    if (!store) store = typeof indexedDB === 'undefined' ? memoryOutboxStore() : idbOutboxStore();
    return store;
  };
  const submit = options.submit ?? submitMapperPlace;
  const generateId = options.generateId ?? generatePlaceId;
  const now = options.now ?? (() => new Date());
  // Две отправки разом (возврат связи и кнопка в кабинете) дали бы две попытки
  // с одним идентификатором, поэтому вторая ждёт первую.
  const running = new Map<string, Promise<FlushResult>>();

  const list = async (owner: string): Promise<OutboxItem[]> => {
    const all = await getStore().all();
    return all.filter((item) => item.owner === owner).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  };

  const flushOnce = async (owner: string, auto: boolean): Promise<FlushResult> => {
    let sent = 0;
    for (const item of await list(owner)) {
      if (item.blocked) continue;
      if (isOffline()) break;
      if (
        auto &&
        item.reason === 'server_not_ready' &&
        item.lastTriedAt &&
        now().getTime() - new Date(item.lastTriedAt).getTime() < NOT_READY_PAUSE_MS
      ) {
        break;
      }
      try {
        await submit(item.input, { generateId: () => item.id, resume: true });
        await getStore().remove(item.id);
        sent += 1;
      } catch (error) {
        const reason = outboxReason(error);
        // Сервер уже знает это место: прошлая попытка дошла, пропал только ответ.
        if (reason === 'place_id_reused') {
          await getStore().remove(item.id);
          sent += 1;
          continue;
        }
        const waiting = WAITING.has(reason);
        await getStore().put({
          ...item,
          attempts: item.attempts + 1,
          lastTriedAt: now().toISOString(),
          reason,
          blocked: !waiting,
        });
        // Связь, вход или сервер: следующие карточки упрутся в то же самое.
        if (waiting) break;
      }
    }
    return { sent, left: await list(owner) };
  };

  return {
    async add(owner, input, reason) {
      const item: OutboxItem = {
        id: generateId(),
        owner,
        createdAt: now().toISOString(),
        input,
        attempts: 0,
        // Постановка в очередь сама следует за неудачной попыткой.
        lastTriedAt: now().toISOString(),
        reason,
        blocked: false,
      };
      await getStore().put(item);
      return item;
    },
    list,
    remove: (id) => getStore().remove(id),
    flush(owner, flushOptions = {}) {
      const current = running.get(owner);
      if (current) return current;
      const next = flushOnce(owner, flushOptions.auto === true).finally(() => running.delete(owner));
      running.set(owner, next);
      return next;
    },
  };
}

let shared: MapperOutbox | null = null;

/** Общая очередь приложения. */
export function getMapperOutbox(): MapperOutbox {
  if (!shared) shared = createMapperOutbox();
  return shared;
}
