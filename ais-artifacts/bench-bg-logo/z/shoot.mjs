// Съёмка скриншотов для бенча bg+logo (модель z).
// Запуск: node ais-artifacts/bench-bg-logo/z/shoot.mjs
// Playwright (уже установлен в node_modules основного репо, сюда — symlink).
//
// Что снимаем (по критериям приёмки брифа), обе темы:
//   1. welcome       — публичный WelcomeLegend (крупный лого + подложка)
//   2. splash        — Telegram geolocation primer (крупный лого + подложка)
//   3. no-map        — профиль TelegramApp (подложка видна вне карты)
//   4. header        — шапка TelegramApp (компактный лого)
//
// Инъекции: мок Telegram SDK и мок fetch на auth-telegram/places/profiles,
// чтобы TelegramApp доходил до шапки/профиля без правки кода приложения.
import { chromium } from 'playwright';
import { existsSync, mkdirSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const APP_URL = 'http://localhost:4202/';
const OUT_DIR = new URL('./', import.meta.url).pathname.replace(/^\/private/, '');

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORT = { width: 440, height: 880, deviceScaleFactor: 2 };
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';

// Мок Telegram WebApp SDK — переводит App в ветку TelegramApp.
const TG_MOCK = `
window.Telegram = {
  WebApp: {
    initData: 'bench-z-mock-initdata',
    colorScheme: 'DARK',
    themeParams: {},
    ready: function(){},
    expand: function(){},
    onEvent: function(){},
    offEvent: function(){},
    HapticFeedback: { notificationOccurred: function(){}, selectionChanged: function(){}, impactOccurred: function(){} },
  },
};
`;

// Мок fetch: только на наши эндпоинты, остальное пропускаем к сети.
const FETCH_MOCK = `
const origFetch = window.fetch.bind(window);
window.fetch = function(input, init){
  const url = typeof input === 'string' ? input : (input && input.url) || '';
  if (url.indexOf('/functions/v1/auth-telegram') !== -1) {
    return Promise.resolve(new Response(JSON.stringify({
      access_token: 'bench-z-mock-token',
      profile: {
        id: '00000000-0000-0000-0000-0000000000z1',
        telegram_id: 700000001, username: 'z_bench', display_name: 'Z Bench',
        role: 'tester', ai_enabled: false, karma: 120, karma_status: 'curious',
        created_at: '2026-07-21T00:00:00Z'
      }
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  if (url.indexOf('/rest/v1/places') !== -1) {
    return Promise.resolve(new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  if (url.indexOf('/rest/v1/profiles') !== -1) {
    return Promise.resolve(new Response(JSON.stringify({
      id: '00000000-0000-0000-0000-0000000000z1',
      telegram_id: 700000001, username: 'z_bench', display_name: 'Z Bench',
      role: 'tester', ai_enabled: false, karma: 120, karma_status: 'curious',
      created_at: '2026-07-21T00:00:00Z'
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
  }
  return origFetch(input, init);
};
`;

const MOCK_PROFILE = {
  // условный профиль для прямого open в TelegramApp-ветке после мока
};

async function setupContext(browser, theme, { tg = false } = {}) {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    userAgent: UA,
    deviceScaleFactor: VIEWPORT.deviceScaleFactor,
    colorScheme: theme,
    isMobile: true,
    hasTouch: true,
  });
  await context.addInitScript(FETCH_MOCK);
  if (tg) await context.addInitScript(TG_MOCK);
  return context;
}

async function applyThemeClass(page, theme) {
  await page.evaluate((t) => {
    document.documentElement.className = t;
  }, theme);
}

async function waitStable(page, ms = 600) {
  try { await page.waitForLoadState('networkidle', { timeout: 4000 }); } catch {}
  await sleep(ms);
}

async function main() {
  const browser = await chromium.launch({ headless: true });

  const shots = [];

  // ===== 1. WelcomeLegend (публичный, обе темы) =====
  for (const theme of ['dark', 'light']) {
    const ctx = await setupContext(browser, theme, { tg: false });
    const page = await ctx.newPage();
    // welcome показывается, если в localStorage НЕТ goapsny_welcome_seen
    await ctx.clearCookies();
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('goapsny_welcome_seen'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitStable(page);
    await applyThemeClass(page, theme);
    await waitStable(page, 300);
    const file = `${OUT_DIR}01-welcome-${theme}.png`;
    await page.screenshot({ path: file, fullPage: false });
    shots.push(file);
    console.log('  ✓', file);
    await ctx.close();
  }

  // ===== 2/3/4. TelegramApp-ветка: splash, header, no-map(профиль) =====
  for (const theme of ['dark', 'light']) {
    const ctx = await setupContext(browser, theme, { tg: true });
    const page = await ctx.newPage();

    // 2. SPLASH (geolocation primer): primed=NO
    await ctx.clearCookies();
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('goapsny_gps_primed'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitStable(page, 900);
    await applyThemeClass(page, theme);
    await waitStable(page, 400);
    const splashFile = `${OUT_DIR}02-splash-${theme}.png`;
    await page.screenshot({ path: splashFile, fullPage: false });
    shots.push(splashFile);
    console.log('  ✓', splashFile);

    // 3. HEADER + 4. NO-MAP (профиль): primed=YES → попадаем в основной UI
    await page.evaluate(() => localStorage.setItem('goapsny_gps_primed', 'true'));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await waitStable(page, 1200);
    await applyThemeClass(page, theme);
    await waitStable(page, 400);

    // переходим в профиль (экран без карты — подложка видна)
    const profileBtn = page.locator('.nav-tab', { hasText: 'Профиль' }).first();
    if (await profileBtn.count()) {
      await profileBtn.click();
      await waitStable(page, 500);
    }
    const profFile = `${OUT_DIR}03-no-map-profile-${theme}.png`;
    await page.screenshot({ path: profFile, fullPage: false });
    shots.push(profFile);
    console.log('  ✓', profFile);

    // шапка: клип по .app-header
    const headerEl = page.locator('.app-header').first();
    if (await headerEl.count()) {
      const headerFile = `${OUT_DIR}04-header-${theme}.png`;
      await headerEl.screenshot({ path: headerFile });
      shots.push(headerFile);
      console.log('  ✓', headerFile);
    } else {
      console.warn('  ! .app-header не найден');
    }

    await ctx.close();
  }

  await browser.close();
  console.log('\nГотово. Файлов:', shots.length);
  for (const f of shots) console.log('  -', f);
}

main().catch((e) => { console.error(e); process.exit(1); });
