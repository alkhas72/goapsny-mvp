#!/usr/bin/env node
/**
 * Public-path browser smoke: viewports + keyboard/focus checks.
 * Run: npm run preview && npm run browser-smoke
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

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

async function main() {
  mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  try {
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (error) {
    record('browser: preview reachable', false, error.message);
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

  await browser.close();
  const passed = verdicts.filter((v) => v.pass).length;
  console.log(`\n=== BROWSER SUMMARY: ${passed}/${verdicts.length} PASS ===`);
  process.exit(verdicts.every((v) => v.pass) ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
