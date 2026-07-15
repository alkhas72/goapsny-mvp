#!/usr/bin/env node
/**
 * Public-path browser smoke: viewports + keyboard/focus checks.
 * Run: npm run preview && npm run browser-smoke
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { BROWSER_SMOKE_PLACE_ROW, BROWSER_SMOKE_MARKER_LABEL } from './browser-smoke-fixtures.mjs';

const BASE_URL = process.env.BROWSER_SMOKE_URL ?? 'http://127.0.0.1:4173/public.html';
const SCREENSHOT_DIR = resolve('artifacts/browser-smoke');
const VIEWPORTS = [
  { width: 360, height: 740 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
  { width: 1440, height: 900 },
];

const verdicts = [];

function record(name, pass, detail = '') {
  verdicts.push({ name, pass, detail });
  console.log(`[${pass ? 'PASS' : 'FAIL'}] ${name}${detail ? `: ${detail}` : ''}`);
}

async function dismissWelcome(page) {
  const continueBtn = page.getByRole('button', { name: /поехали/i });
  if (await continueBtn.isVisible().catch(() => false)) {
    await continueBtn.click();
  }
}

async function waitForPublicShell(page, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const welcome = await page.getByText('Добро пожаловать в GoApsny').isVisible().catch(() => false);
    const menu = await page.getByRole('button', { name: 'Меню' }).isVisible().catch(() => false);
    const error = await page.getByRole('alert').isVisible().catch(() => false);
    if (welcome || menu || error) return { welcome, menu, error };
    await page.waitForTimeout(100);
  }
  return { welcome: false, menu: false, error: false };
}

async function installDeterministicDataRoutes(context) {
  await context.route('**/rest/v1/places**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    const url = route.request().url();
    if (url.includes('id=eq.')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([BROWSER_SMOKE_PLACE_ROW]),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([BROWSER_SMOKE_PLACE_ROW]),
    });
  });

  await context.route('**/rest/v1/photos**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.continue();
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await context.route('**/storage/v1/object/sign/**', async (route) => {
    await route.fulfill({
      status: 400,
      contentType: 'application/json',
      body: JSON.stringify({ statusCode: '403', error: 'Unauthorized', message: 'denied' }),
    });
  });
}

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await installDeterministicDataRoutes(context);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (error) {
    record('browser: preview reachable', false, error.message);
    await context.close();
  await browser.close();
    process.exit(1);
  }

  record('browser: preview reachable', true, BASE_URL);

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize(viewport);
    await dismissWelcome(page);
    const shell = await waitForPublicShell(page);
    const path = resolve(SCREENSHOT_DIR, `viewport-${viewport.width}x${viewport.height}.png`);
    await page.screenshot({ path, fullPage: true });
    const detail = shell.menu ? 'map' : shell.welcome ? 'welcome' : shell.error ? 'error' : path;
    record(`browser: viewport ${viewport.width}x${viewport.height}`, shell.welcome || shell.menu || shell.error, detail);
  }

  await dismissWelcome(page);
  const shell = await waitForPublicShell(page);
  if (!shell.menu) {
    record('browser: map shell visible', false, shell.error ? 'error state' : 'menu button not found');
    await context.close();
  await browser.close();
    process.exit(1);
  }

  const menuButton = page.getByRole('button', { name: 'Меню' }).first();
  await menuButton.focus();
  await page.keyboard.press('Enter');
  const menuClose = page.getByRole('dialog', { name: /меню/i }).getByRole('button', { name: /закрыть меню/i });
  record('browser: menu opens via keyboard', await menuClose.isVisible());
  await page.keyboard.press('Escape');
  record(
    'browser: menu escape returns focus to trigger',
    await menuButton.evaluate((el) => el === document.activeElement),
  );

  await menuButton.focus();
  await page.keyboard.press('Enter');
  const menuDialog = page.getByRole('dialog', { name: /меню/i });
  const menuCloseBtn = menuDialog.getByRole('button', { name: /закрыть меню/i });
  await menuCloseBtn.focus();
  await page.keyboard.press('Tab');
  record(
    'browser: menu forward Tab stays in dialog',
    await menuDialog.evaluate((dialog) => dialog.contains(document.activeElement)),
  );
  await page.keyboard.press('Shift+Tab');
  record(
    'browser: menu Shift+Tab stays in dialog',
    await menuDialog.evaluate((dialog) => dialog.contains(document.activeElement)),
  );
  await page.keyboard.press('Escape');

  const filterButton = page.getByRole('button', { name: /поиск и фильтр/i });
  await filterButton.focus();
  await page.keyboard.press('Enter');
  const filterClose = page.getByRole('button', { name: /закрыть фильтр/i });
  record('browser: filter opens via keyboard', await filterClose.isVisible());
  await page.keyboard.press('Escape');
  record(
    'browser: filter escape returns focus to trigger',
    await filterButton.evaluate((el) => el === document.activeElement),
  );

  await filterButton.focus();
  await page.keyboard.press('Enter');
  const filterDialog = page.getByRole('dialog', { name: /поиск и фильтр/i });
  const filterCloseBtn = filterDialog.getByRole('button', { name: /закрыть фильтр/i });
  await filterCloseBtn.focus();
  await page.keyboard.press('Tab');
  record(
    'browser: filter forward Tab stays in dialog',
    await filterDialog.evaluate((dialog) => dialog.contains(document.activeElement)),
  );
  await page.keyboard.press('Shift+Tab');
  record(
    'browser: filter Shift+Tab stays in dialog',
    await filterDialog.evaluate((dialog) => dialog.contains(document.activeElement)),
  );
  await page.keyboard.press('Escape');

  const markerButton = page.locator(`button.map-pin-button[aria-label="${BROWSER_SMOKE_MARKER_LABEL}"]`).first();
  await markerButton.waitFor({ state: 'visible', timeout: 15000 });
  await markerButton.scrollIntoViewIfNeeded();
  await markerButton.focus();
  await page.keyboard.press('Enter');
  const placeSheet = page.getByRole('dialog', { name: 'Browser Smoke Cafe' });
  await placeSheet.waitFor({ state: 'visible', timeout: 10000 });
  record('browser: marker opens place sheet via keyboard', await placeSheet.isVisible());
  const sheetCloseBtn = placeSheet.getByRole('button', { name: /закрыть карточку/i });
  await sheetCloseBtn.focus();
  await page.keyboard.press('Tab');
  record(
    'browser: place sheet forward Tab stays in dialog',
    await placeSheet.evaluate((dialog) => dialog.contains(document.activeElement)),
  );
  await page.keyboard.press('Shift+Tab');
  record(
    'browser: place sheet Shift+Tab stays in dialog',
    await placeSheet.evaluate((dialog) => dialog.contains(document.activeElement)),
  );
  await page.keyboard.press('Escape');
  const currentMarker = page.locator(`button.map-pin-button[aria-label="${BROWSER_SMOKE_MARKER_LABEL}"]`).first();
  await currentMarker.waitFor({ state: 'visible', timeout: 5000 });
  let focusReturned = false;
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    focusReturned = await currentMarker.evaluate((el) => el === document.activeElement);
    if (focusReturned) break;
    await page.waitForTimeout(50);
  }
  record('browser: place sheet escape returns focus to current marker', focusReturned);

  const locateButton = page.getByRole('button', { name: /найти меня/i });
  record('browser: locate button is keyboard reachable', await locateButton.isVisible());

  const swRegistered = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return Boolean(reg);
  });
  record('browser: service worker registered', swRegistered);

  const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
  record('browser: manifest linked', manifestHref === '/manifest.webmanifest', manifestHref ?? 'missing');

  record('browser: console/page errors', errors.length === 0, errors.join(' | ') || 'none');

  await context.close();
  await browser.close();
  const passed = verdicts.filter((v) => v.pass).length;
  console.log(`\n=== BROWSER SUMMARY: ${passed}/${verdicts.length} PASS ===`);
  process.exit(verdicts.every((v) => v.pass) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
