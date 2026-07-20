#!/usr/bin/env node
/**
 * Сквозная проверка публичного сценария: код на почту → вход → профиль
 * public_user → загрузка фасада → RPC → серая метка видна анониму.
 *
 * Зачем отдельно от unit-тестов. Каждый слой уже покрыт с подменами, но их
 * СТЫК не проверялся ничем: внешний аудит справедливо отметил, что
 * доказательства сквозного пути нет. Именно на стыке живут расхождения
 * клиента и RLS — как в случае, когда клиент звал RPC, которой в базе не было.
 *
 * Работает против ЛОКАЛЬНОГО стека: письма забираются из Mailpit, поэтому
 * код достаётся программно и прогон полностью автоматический.
 *
 * Запуск:
 *   supabase start
 *   node scripts/e2e-public-submit.mjs
 *
 * Переменные (по умолчанию — локальный стек):
 *   E2E_SUPABASE_URL, E2E_ANON_KEY, E2E_MAILPIT_URL
 */
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
const MAILPIT_URL = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:54324';

const OTP_PATTERN = /\b(\d{6,8})\b/;
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

/** Уникальный адрес на прогон: повторный вход по тому же email упрётся в лимит одной подачи. */
function uniqueEmail() {
  return `e2e-${Date.now()}@example.com`;
}

async function waitForOtp(email, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=30`);
    if (response.ok) {
      const { messages = [] } = await response.json();
      const letter = messages.find((m) => m.To?.some((to) => to.Address === email));
      if (letter) {
        const body = await fetch(`${MAILPIT_URL}/api/v1/message/${letter.ID}`).then((r) => r.json());
        const text = `${body.Text ?? ''}\n${body.HTML ?? ''}`;
        const match = text.match(OTP_PATTERN);
        if (match) return { code: match[1], subject: letter.Subject, raw: text };
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return null;
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
  console.log(`E2E против ${SUPABASE_URL}\n`);
  const supabase = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = uniqueEmail();

  // 1. Аноним видит карту до всякого входа — базовое условие DG-2.
  const anonRead = await supabase.from('places').select('id').limit(1);
  if (anonRead.error) fail('anon читает places без входа', anonRead.error.message);
  record('anon читает places без входа', true);

  const anonCategories = await supabase.from('categories').select('slug').limit(1);
  if (anonCategories.error) fail('anon читает справочник категорий', anonCategories.error.message);
  record('anon читает справочник категорий', true);

  // 2. Запрос кода.
  const otpRequest = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (otpRequest.error) fail('запрос кода принят сервером', otpRequest.error.message);
  record('запрос кода принят сервером', true, email);

  // 3. Письмо и код из него.
  const letter = await waitForOtp(email);
  if (!letter) fail('письмо с кодом доставлено', 'не появилось в Mailpit за 15 с');
  record('письмо с кодом доставлено', true, `тема: ${letter.subject}`);

  // Длина кода — жёсткий контракт с клиентом (OTP_CODE_LENGTH = 8).
  // Шестизначный код не пройдёт валидацию и до verifyOtp не дойдёт.
  record(
    'длина кода совпадает с контрактом клиента (8)',
    letter.code.length === 8,
    `фактически: ${letter.code.length}`,
  );

  // Формат письма (код против ссылки) задаётся шаблоном. Локально шаблон
  // остаётся дефолтным: CLI 2.104 не умеет монтировать content_path
  // (см. supabase/config.toml). Поэтому здесь только сообщаем факт —
  // считать это дефектом продукта нельзя. На production шаблон приведён
  // к supabase/templates/otp.html и проверен живым письмом 19.07.
  const hasLink = /ConfirmationURL|\/auth\/v1\/verify\?/.test(letter.raw);
  console.log(
    `[INFO] формат письма на локальном стеке: ${hasLink ? 'ссылка (дефолтный шаблон CLI)' : 'код'}`,
  );

  // 4. Обмен кода на сессию.
  const verified = await supabase.auth.verifyOtp({ email, token: letter.code, type: 'email' });
  if (verified.error) fail('код обменивается на сессию', verified.error.message);
  const userId = verified.data.user?.id;
  if (!userId) fail('код обменивается на сессию', 'сессия без пользователя');
  record('код обменивается на сессию', true);

  // 5. Профиль создан триггером и роль именно public_user, а не привилегированная.
  const profile = await supabase.from('profiles').select('id, role').eq('id', userId).maybeSingle();
  if (profile.error) fail('профиль создан автоматически', profile.error.message);
  if (!profile.data) fail('профиль создан автоматически', 'строки нет — триггер не сработал');
  record('профиль создан автоматически', true);
  record(
    'роль нового профиля — public_user',
    profile.data.role === 'public_user',
    `фактически: ${profile.data.role}`,
  );

  // 6. Загрузка фасада по пути, который проверит RPC.
  const placeId = crypto.randomUUID();
  const storagePath = `${placeId}/facade.jpg`;
  const upload = await supabase.storage
    .from('place-photos')
    .upload(storagePath, tinyJpeg(), { contentType: 'image/jpeg', upsert: false });
  if (upload.error) fail('фасад загружается в place-photos', upload.error.message);
  record('фасад загружается в place-photos', true, storagePath);

  // 7. Сама подача.
  const rpc = await supabase.rpc('submit_public_place', {
    p_place_id: placeId,
    p_name: 'E2E тестовая точка',
    p_category: 'food',
    p_lat: 43.0009,
    p_lng: 41.0159,
    p_storage_path: storagePath,
  });
  if (rpc.error) fail('RPC submit_public_place отрабатывает', rpc.error.message);
  record('RPC submit_public_place отрабатывает', true);

  // 8. Метка появилась и именно серая.
  const created = await supabase.from('places').select('id, status, name').eq('id', placeId).maybeSingle();
  if (created.error || !created.data) fail('метка появилась в базе', created.error?.message ?? 'строки нет');
  record('метка появилась в базе', true);
  record('статус метки — gray', created.data.status === 'gray', `фактически: ${created.data.status}`);

  // 9. Лимит одной подачи на пользователя.
  const secondPlaceId = crypto.randomUUID();
  const secondPath = `${secondPlaceId}/facade.jpg`;
  const secondUpload = await supabase.storage
    .from('place-photos')
    .upload(secondPath, tinyJpeg(), { contentType: 'image/jpeg', upsert: false });
  // Загрузка обязана пройти: иначе RPC откажет из-за отсутствия файла,
  // и мы засчитаем за работу лимита совсем другую причину.
  if (secondUpload.error) {
    fail('вторая загрузка фасада проходит', secondUpload.error.message);
  }
  record('вторая загрузка фасада проходит', true);

  const second = await supabase.rpc('submit_public_place', {
    p_place_id: secondPlaceId,
    p_name: 'E2E вторая попытка',
    p_category: 'food',
    p_lat: 43.001,
    p_lng: 41.016,
    p_storage_path: secondPath,
  });
  // Проверяем именно лимит одной подачи, а не любую ошибку: код 23505
  // и текст ограничения. Иначе тест зазеленеет на посторонней поломке.
  const limitCode = second.error?.code;
  const limitMessage = second.error?.message ?? '';
  record(
    'вторая подача отклонена именно лимитом (23505)',
    limitCode === '23505' && /public submission already used/i.test(limitMessage),
    second.error ? `${limitCode}: ${limitMessage}` : 'ошибки нет — лимит не сработал',
  );

  // 10. Итог глазами анонима: свежая метка видна без входа.
  const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonSees = await anonClient.from('places').select('id').eq('id', placeId).maybeSingle();
  record(
    'аноним видит созданную метку',
    !anonSees.error && Boolean(anonSees.data),
    anonSees.error?.message ?? '',
  );

  summary();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  fail('прогон завершился без исключений', error.message);
});
