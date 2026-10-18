import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('/tmp/goapsny-evidence', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.LAB_CHROMIUM_PATH || undefined, headless: true, args: ['--no-sandbox', '--enable-unsafe-swiftshader'] });
try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript(() => { Object.defineProperty(window, 'Telegram', { get() { throw new Error('Lab accessed Telegram'); } }); });
  const page = await context.newPage();
  const external = [], errors = [];
  page.on('request', request => {
    const url = request.url();
    if (!url.startsWith('http://127.0.0.1:5173') && !url.startsWith('blob:') && !url.startsWith('data:')) external.push(url);
  });
  page.on('pageerror', error => errors.push(error.message));
  const ready = () => page.getByText(/^В видимой области: \d+$/).waitFor();
  await page.goto('http://127.0.0.1:5173/?lab=1&mapper=1');
  await ready();
  await page.screenshot({ path: '/tmp/goapsny-evidence/lab-mobile.png', fullPage: true });
  const openCafe = () => page.getByRole('button', { name: 'Демо: кафе у моря · Доступно', exact: true }).click();
  await openCafe();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Нисколько', exact: true }).click();
  await dialog.getByText('Доступно', { exact: true }).waitFor();
  await dialog.getByRole('button', { name: 'Нисколько', exact: true }).click();
  await dialog.getByText('Уже сохранено на телефоне', { exact: true }).waitFor();
  await page.keyboard.press('Escape');
  await page.reload();
  await page.getByRole('button', { name: 'Мои отметки (1)', exact: true }).click();
  await page.screenshot({ path: '/tmp/goapsny-evidence/lab-marks-reload.png', fullPage: true });
  await context.setOffline(true);
  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  await ready();
  await page.getByRole('button', { name: 'Демо: новая точка без данных · Ещё не оценено', exact: true }).click();
  await dialog.getByRole('button', { name: 'Частично', exact: true }).click();
  await dialog.getByRole('button', { name: 'Добавить: Ширина двери', exact: true }).click();
  await dialog.getByRole('spinbutton', { name: 'Ширина двери, см', exact: true }).fill('84');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await dialog.getByRole('button', { name: 'Сообщить о проблеме', exact: true }).click();
  await dialog.getByRole('radio', { name: 'Неверные сведения', exact: true }).check();
  await dialog.getByRole('textbox', { name: 'Комментарий', exact: true }).fill('Демонстрационная проблема');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Мои отметки (4)', exact: true }).click();
  await page.getByText(/Нет сети/).waitFor();
  await context.setOffline(false);
  await page.getByRole('button', { name: 'Карта', exact: true }).click();
  await ready();
  await page.getByLabel('Фильтр проверенного статуса').selectOption('red');
  await page.locator('canvas').focus();
  for (let i = 0; i < 4; i++) {
    if (await page.getByText('В этой области нет мест по выбранному фильтру.', { exact: true }).count()) break;
    await page.keyboard.press('ArrowRight'); await page.waitForTimeout(350);
  }
  await page.getByText('В этой области нет мест по выбранному фильтру.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Сбросить фильтр' }).click();
  await page.locator('canvas').focus();
  for (let i = 0; i < 8; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(350); }
  await page.getByText('Здесь пока нет отметок — будьте первым.', { exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/goapsny-evidence/lab-empty-area.png', fullPage: true });
  await page.getByRole('button', { name: 'Добавить демонстрационное место в центре области' }).click();
  await dialog.getByText('Ещё не оценено', { exact: true }).waitFor();
  await page.screenshot({ path: '/tmp/goapsny-evidence/lab-new-gray.png', fullPage: true });
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
  await dialog.getByRole('button', { name: 'Частично', exact: true }).click();
  await dialog.getByRole('alert').filter({ hasText: 'Не удалось сохранить' }).waitFor();
  if (external.length || errors.length) throw new Error(JSON.stringify({ external, errors }));
  console.log(JSON.stringify({ result: 'PASS', external, errors, marksBeforeNewPlace: 4, scenarios: 'rating/fact/problem/reload/offline/duplicate/filter/viewport/gray/quota' }));
} finally { await browser.close(); }
