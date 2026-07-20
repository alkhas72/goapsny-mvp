#!/usr/bin/env node
/**
 * Сквозная проверка Telegram-сценария (партия Г1): initData → auth-telegram →
 * JWT → фото в Storage → метка в places → видна анониму (то, что показывает
 * сайт через fetchPublishedPlaces). Зеркало scripts/e2e-public-submit.mjs,
 * но через Telegram-вход, а не email-OTP.
 *
 * Зачем отдельно: до Г1 Telegram-контур жил на localStorage устройства
 * (isLiveMode = false) и с общей базой не пересекался. Здесь доказывается,
 * что путь картографа пишет в общую базу и что поддельный вход отклоняется.
 *
 * Работает против ЛОКАЛЬНОГО стека. Перед прогоном стек должен получить
 * тестовый токен бота и локальный demo JWT-секрет (config.toml читает их
 * из окружения CLI; demo-секрет — общеизвестное значение `supabase status`):
 *
 *   TELEGRAM_BOT_TOKEN=e2e-local-telegram-bot-token \
 *   SUPABASE_JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long \
 *   supabase start
 *   node scripts/e2e-telegram-submit.mjs
 *
 * Переменные (по умолчанию — локальный стек и тестовый токен):
 *   E2E_SUPABASE_URL, E2E_ANON_KEY, E2E_TELEGRAM_BOT_TOKEN
 */
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321';

// Тест создаёт пользователя, файл и метку — то есть пишет. Направить его
// в production можно было одной переменной окружения, поэтому цель
// проверяется до любого запроса и только по белому списку.
// Разрешён loopback; удалённый проект — лишь при явном совпадении с
// E2E_ALLOWED_PROJECT_REF, которую надо задать сознательно.
function assertSafeTarget(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    console.error(`[STOP] E2E_SUPABASE_URL не разбирается как адрес: ${url}`);
    process.exit(2);
  }

  const isLoopback = ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(parsed.hostname);
  if (isLoopback) return;

  const allowedRef = process.env.E2E_ALLOWED_PROJECT_REF;
  const targetRef = parsed.hostname.split('.')[0];
  if (allowedRef && targetRef === allowedRef) {
    console.warn(`[ВНИМАНИЕ] прогон против удалённого проекта ${targetRef} — будут созданы записи`);
    return;
  }

  console.error(
    `[STOP] Отказ: ${parsed.hostname} не является локальным стеком.\n` +
      'Этот тест ПИШЕТ в базу: создаёт пользователя, файл в Storage и метку.\n' +
      'Для удалённого проекта задайте E2E_ALLOWED_PROJECT_REF с его ref явно.',
  );
  process.exit(2);
}
assertSafeTarget(SUPABASE_URL);

const ANON_KEY =
  process.env.E2E_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';

// НЕ боевой токен: одноразовое значение для локального стека, задаётся при
// `supabase start` (см. шапку). Подпись initData считается им же, как делает
// Telegram, — так проверяется вся цепочка валидации в auth-telegram.
const BOT_TOKEN = process.env.E2E_TELEGRAM_BOT_TOKEN ?? 'e2e-local-telegram-bot-token';

const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? `: ${detail}` : ''}`);
}

function fail(name, detail) {
  record(name, false, detail);
  summary();
  process.exit(1);
}

function summary() {
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n=== E2E SUMMARY: ${passed}/${results.length} ${passed === results.length ? 'PASS' : 'FAIL'} ===`);
}

/** initData ровно по правилам Telegram: hash = HMAC(HMAC("WebAppData", token), data-check-string). */
function buildInitData(user) {
  const fields = {
    auth_date: String(Math.floor(Date.now() / 1000)),
    query_id: `AAE2E${Date.now()}`,
    user: JSON.stringify(user),
  };
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(BOT_TOKEN).digest();
  const hash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex');
  const encoded = Object.entries(fields)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&');
  return `${encoded}&hash=${hash}`;
}

async function callAuthTelegram(initData) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/auth-telegram`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${ANON_KEY}`,
    },
    body: JSON.stringify({ initData }),
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
}

/** Минимальный валидный JPEG: бакет принимает только image/jpeg. */
function tinyJpeg() {
  const base64 =
    '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
    'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
    'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  return Buffer.from(base64, 'base64');
}

async function main() {
  console.log(`E2E (Telegram) против ${SUPABASE_URL}\n`);

  const telegramUser = {
    id: 777000111,
    first_name: 'E2E',
    last_name: 'Cartographer',
    username: 'e2e_cartographer',
    language_code: 'ru',
  };

  // 1. Подлинный initData проходит валидацию и связывает Telegram-пользователя
  //    с учётной записью (профиль + JWT).
  const login = await callAuthTelegram(buildInitData(telegramUser));
  if (login.status !== 200 || !login.body?.access_token) {
    fail('auth-telegram принимает подлинный initData', `HTTP ${login.status}: ${JSON.stringify(login.body)}`);
  }
  record('auth-telegram принимает подлинный initData', true);

  const token = login.body.access_token;
  const profile = login.body.profile;
  record(
    'Telegram-пользователь связан с профилем в общей базе',
    Boolean(profile?.id) && profile?.telegram_id === telegramUser.id,
    `profile.id=${profile?.id ?? 'нет'}`,
  );
  record(
    'роль нового профиля — tester (коллектор, не public_user)',
    profile?.role === 'tester',
    `фактически: ${profile?.role}`,
  );

  // 2. DG-3: поддельный initData отклоняется, а не пропускается за owner.
  const valid = buildInitData(telegramUser);
  const forgedInitData = valid.endsWith('a') ? valid.slice(0, -1) + 'b' : valid.slice(0, -1) + 'a';
  const forged = await callAuthTelegram(forgedInitData);
  record(
    'поддельный initData отклонён (нет тихого входа)',
    forged.status === 401 && typeof forged.body?.error === 'string',
    `HTTP ${forged.status}: ${forged.body?.error ?? ''}`,
  );

  // 3. Клиент с JWT картографа — так же, как api.ts (accessToken-опция).
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    accessToken: () => Promise.resolve(token),
  });

  // 4. Анонимная запись запрещена — честный отказ, а не «успех».
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonWrite = await anonClient.from('places').insert({ name: 'anon', category: 'food', lat: 43, lng: 41 });
  record('анонимная запись в places отклонена RLS', Boolean(anonWrite.error));

  // Карма накапливается между прогонами — проверяем дельту, а не абсолют.
  const karmaStart = await supabase.from('profiles').select('karma').eq('id', profile.id).single();
  if (karmaStart.error) fail('стартовая карма читается', karmaStart.error.message);
  const karmaBefore = karmaStart.data.karma;

  // 5. Фото фасада в Storage по контрактному пути.
  const placeId = crypto.randomUUID();
  const storagePath = `${placeId}/facade.jpg`;
  const upload = await supabase.storage
    .from('place-photos')
    .upload(storagePath, tinyJpeg(), { contentType: 'image/jpeg', upsert: false });
  if (upload.error) fail('фасад загружается в place-photos', upload.error.message);
  record('фасад загружается в place-photos', true, storagePath);

  // 6. Метка картографа: published сразу, статус из светофора, автор — профиль.
  const insert = await supabase
    .from('places')
    .insert({
      id: placeId,
      name: 'E2E Telegram картограф',
      category: 'food',
      lat: 43.0015,
      lng: 41.0171,
      status: 'green',
      steps_count: 0,
      step_height_cm: null,
      ramp_type: 'permanent',
      door_width_cm: 100,
      entrance_notes: 'E2E: плоский вход',
      toilet_exists: 'yes',
      toilet_accessible: 'yes',
      parking: 'unknown',
      comment: 'E2E прогон партии Г1',
      moderation_status: 'published',
      source: 'operator',
      created_by: profile.id,
    })
    .select('id, osm_tags')
    .single();
  if (insert.error) fail('метка картографа пишется в общую базу', insert.error.message);
  record('метка картографа пишется в общую базу', true);
  record(
    'osm_tags построены серверным триггером',
    insert.data?.osm_tags?.wheelchair === 'yes',
    `wheelchair=${insert.data?.osm_tags?.wheelchair ?? 'нет'}`,
  );

  // 7. Метаданные фото — после них сайт показывает фасад.
  const photoRow = await supabase
    .from('photos')
    .insert({ place_id: placeId, storage_path: storagePath, kind: 'facade', uploaded_by: profile.id });
  if (photoRow.error) fail('метаданные фото пишутся в photos', photoRow.error.message);
  record('метаданные фото пишутся в photos', true);

  // 8. Карма начислена серверными триггерами: 10 место + 10 полная карточка + 5 фото.
  const freshProfile = await supabase
    .from('profiles')
    .select('karma, karma_status')
    .eq('id', profile.id)
    .single();
  if (freshProfile.error) fail('профиль перечитывается после подачи', freshProfile.error.message);
  record(
    'карма начислена сервером (+25: место, полная карточка, фото)',
    freshProfile.data?.karma === karmaBefore + 25,
    `было: ${karmaBefore}, стало: ${freshProfile.data?.karma}`,
  );

  // 9. Метка видна на сайте: аноним читает её в published-наборе — это тот же
  //    запрос, что делает fetchPublishedPlaces для карты.
  const anonSees = await anonClient
    .from('places')
    .select('id, status, moderation_status')
    .eq('id', placeId)
    .eq('moderation_status', 'published')
    .maybeSingle();
  record(
    'метка видна на сайте (anon читает published)',
    !anonSees.error && anonSees.data?.status === 'green',
    anonSees.error?.message ?? `статус: ${anonSees.data?.status ?? 'нет строки'}`,
  );

  // 10. И фото видно: аноним получает signed URL на фасад published-метки.
  const signed = await anonClient.storage.from('place-photos').createSignedUrl(storagePath, 60);
  record(
    'фото метки доступно сайту (anon signed URL)',
    !signed.error && Boolean(signed.data?.signedUrl),
    signed.error?.message ?? '',
  );

  summary();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  fail('прогон завершился без исключений', error.message);
});
