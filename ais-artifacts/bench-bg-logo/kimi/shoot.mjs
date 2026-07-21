// Съёмка скриншотов для бенча bg+logo (модель kimi).
// Запуск: node ais-artifacts/bench-bg-logo/kimi/shoot.mjs (превью на :4201 уже поднято).
//
// По критериям приёмки брифа, обе темы:
//   1. welcome — публичное приветствие WelcomeLegend (крупный лого + подложка)
//   2. splash  — Telegram geolocation primer (крупный лого + подложка)
//   3. profile — профиль TelegramApp, экран без карты (подложка видна)
//   4. header  — шапка TelegramApp (компактный лого)
//
// Код приложения не правим: инъектируем мок Telegram SDK и мок fetch
// на auth-telegram / places / profiles, чтобы Telegram-ветка дошла до UI.
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const APP_URL = 'http://localhost:4201/';
const OUT_DIR = new URL('./', import.meta.url).pathname.replace(/^\/private/, '');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORT = { width: 440, height: 880 };
const UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// Мок Telegram WebApp SDK — переводит App в ветку TelegramApp.
// colorScheme параметризуем: getTelegramTheme() читает его при инициализации.
const tgMock = (scheme) => `
window.Telegram = {
  WebApp: {
    initData: 'bench-kimi-mock-initdata',
    colorScheme: '${scheme}',
    themeParams: {},
    ready: function(){},
    expand: function(){},
    onEvent: function(){},
    offEvent: function(){},
    HapticFeedback: { notificationOccurred: function(){}, selectionChanged: function(){}, impactOccurred: function(){} },
  },
};
`;

// Мок fetch: только наши эндпоинты, остальное — в сеть как есть.
const PROFILE = {
  id: '00000000-0000-0000-0000-0000000000k1',
  telegram_id: 700000002,
  username: 'kimi_bench',
  display_name: 'Kimi Bench',
  role: 'tester',
  ai_enabled: false,
  karma: 120,
  karma_status: 'curious',
  created_at: '2026-07-21T00:00:00Z',
};

const FETCH_MOCK = `
const benchProfile = ${JSON.stringify(PROFILE)};
const origFetch = window.fetch.bind(window);
window.fetch = function(input, init){
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  const json = (obj) => Promise.resolve(new Response(JSON.stringify(obj), {
    status: 200, headers: { 'Content-Type': 'application/json' }
  }));
  if (url.indexOf('/functions/v1/auth-telegram') !== -1) {
    return json({ access_token: 'bench-kimi-mock-token', profile: benchProfile });
  }
  if (url.indexOf('/rest/v1/places') !== -1) return json([]);
  if (url.indexOf('/rest/v1/profiles') !== -1) return json(benchProfile);
  return origFetch(input, init);
};
`;

async function setupContext(browser, { theme, tg }) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: UA,
    deviceScaleFactor: 2,
    colorScheme: theme,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(FETCH_MOCK);
  if (tg) await context.addInitScript(tgMock(theme));
  return context;
}

async function waitStable(page, ms = 600) {
  try { await page.waitForLoadState('networkidle', { timeout: 4000 }); } catch {}
  await sleep(ms);
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const shots = [];

  // ===== 1. Публичное приветствие (welcome), обе темы =====
  for (const theme of ['dark', 'light']) {
    const ctx = await setupContext(browser, { theme, tg: false });
    const page = await ctx.newPage();
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('goapsny_welcome_seen'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitStable(page);
    // Welcome-экран публичной ветки сам класс темы не выставляет (это делает
    // PublicMap после продолжения) — для съёмки ставим класс темы вручную.
    await page.evaluate((t) => { document.documentElement.className = t; }, theme);
    await waitStable(page, 300);
    const file = `${OUT_DIR}01-welcome-${theme}.png`;
    await page.screenshot({ path: file });
    shots.push(file);
    console.log('  ok', file);
    await ctx.close();
  }

  // ===== 2/3/4. TelegramApp: splash, профиль без карты, шапка =====
  for (const theme of ['dark', 'light']) {
    const ctx = await setupContext(browser, { theme, tg: true });
    const page = await ctx.newPage();

    // 2. Сплэш (geolocation primer): primed=NO
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('goapsny_gps_primed'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitStable(page, 1000);
    const splashFile = `${OUT_DIR}02-splash-${theme}.png`;
    await page.screenshot({ path: splashFile });
    shots.push(splashFile);
    console.log('  ok', splashFile);

    // 3/4. Основной UI: primed=YES
    await page.evaluate(() => localStorage.setItem('goapsny_gps_primed', 'true'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitStable(page, 1200);

    // 3. Профиль — экран без карты, подложка видна
    const profileBtn = page.locator('.nav-tab', { hasText: 'Профиль' }).first();
    if (await profileBtn.count()) {
      await profileBtn.click();
      await waitStable(page, 500);
    } else {
      console.warn('  ! вкладка Профиль не найдена');
    }
    const profFile = `${OUT_DIR}03-profile-${theme}.png`;
    await page.screenshot({ path: profFile });
    shots.push(profFile);
    console.log('  ok', profFile);

    // 4. Шапка с мелким логотипом — клип по .app-header
    const headerEl = page.locator('.app-header').first();
    if (await headerEl.count()) {
      const headerFile = `${OUT_DIR}04-header-${theme}.png`;
      await headerEl.screenshot({ path: headerFile });
      shots.push(headerFile);
      console.log('  ok', headerFile);
    } else {
      console.warn('  ! .app-header не найден');
    }

    await ctx.close();
  }

  await browser.close();
  console.log('Готово. Файлов:', shots.length);
}

main().catch((e) => { console.error(e); process.exit(1); });
