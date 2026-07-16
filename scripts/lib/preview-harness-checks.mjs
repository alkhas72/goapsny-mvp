import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const INSTALL_DISPLAY_MODES = new Set(['standalone', 'fullscreen', 'minimal-ui']);

function check(name, pass, detail = '') {
  return { name, pass, detail };
}

export function parseManifest(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`manifest invalid JSON: ${message}`);
  }
}

export function checkManifestInstallability(manifest) {
  const checks = [];
  const requiredStringFields = [
    'name',
    'short_name',
    'start_url',
    'scope',
    'display',
    'background_color',
    'theme_color',
  ];

  for (const field of requiredStringFields) {
    const value = manifest?.[field];
    checks.push(
      check(
        `manifest: ${field} present`,
        typeof value === 'string' && value.length > 0,
        value ? 'ok' : 'missing or empty',
      ),
    );
  }

  checks.push(
    check(
      'manifest: display installable',
      INSTALL_DISPLAY_MODES.has(manifest?.display),
      manifest?.display ?? 'missing',
    ),
  );

  checks.push(
    check(
      'manifest: start_url in scope',
      typeof manifest?.start_url === 'string' &&
        typeof manifest?.scope === 'string' &&
        manifest.start_url.startsWith(manifest.scope),
      `${manifest?.start_url ?? '?'} vs scope ${manifest?.scope ?? '?'}`,
    ),
  );

  const icons = Array.isArray(manifest?.icons) ? manifest.icons : [];
  checks.push(
    check('manifest: icons array', icons.length >= 2, `count=${icons.length}`),
  );

  for (const size of ['192x192', '512x512']) {
    const icon = icons.find((entry) => entry?.sizes === size);
    checks.push(
      check(
        `manifest: icon ${size}`,
        Boolean(icon?.src && icon?.type),
        icon?.src ?? 'missing',
      ),
    );
  }

  return checks;
}

export function checkServiceWorkerHonestShell(source) {
  const checks = [
    check('sw: install handler', /addEventListener\s*\(\s*['"]install['"]/.test(source)),
    check('sw: activate handler', /addEventListener\s*\(\s*['"]activate['"]/.test(source)),
    check('sw: fetch handler', /addEventListener\s*\(\s*['"]fetch['"]/.test(source)),
    check('sw: skipWaiting', /skipWaiting\s*\(\s*\)/.test(source)),
    check('sw: clients.claim', /clients\.claim\s*\(\s*\)/.test(source)),
    check(
      'sw: network-only fetch',
      /respondWith\s*\(\s*fetch\s*\(\s*event\.request\s*\)\s*\)/.test(source),
      'expected event.respondWith(fetch(event.request))',
    ),
    check(
      'sw: honest offline disclaimer',
      /network-only|no offline cache claim/i.test(source),
      'document honest shell behavior',
    ),
    check(
      'sw: no precache shell claim',
      !/caches\.open\s*\(/.test(source) && !/cache\.addAll\s*\(/.test(source),
      'precache would over-promise offline readiness',
    ),
    check(
      'sw: no cache-first fallback',
      !/caches\.match\s*\(/.test(source),
      'cache-first would hide network failures',
    ),
  ];
  return checks;
}

export function checkPublicHtmlPwaHooks(html) {
  const hasManifestLink =
    /<link[^>]+rel=["']manifest["'][^>]*>/i.test(html) &&
    /href=["']\/manifest\.webmanifest["']/i.test(html);
  const hasThemeColor =
    /<meta[^>]+name=["']theme-color["'][^>]*>/i.test(html) &&
    /content=["'][^"']+["']/i.test(html);

  return [
    check('html: manifest link', hasManifestLink, 'expected /manifest.webmanifest'),
    check('html: theme-color meta', hasThemeColor, 'missing theme-color'),
    check(
      'html: viewport meta',
      /<meta[^>]+name=["']viewport["']/i.test(html),
      'missing viewport',
    ),
    check(
      'html: public entry script',
      /public-main\.tsx|\/assets\/public-/.test(html),
      'expected public bundle entry',
    ),
    check('html: root mount point', /<div id=["']root["']/i.test(html)),
  ];
}

export function checkRegisterSwSource(source) {
  return [
    check('registerSw: serviceWorker guard', /serviceWorker/.test(source)),
    check('registerSw: registers /sw.js', /register\s*\(\s*['"]\/sw\.js['"]\s*\)/.test(source)),
    check('registerSw: defers to load', /addEventListener\s*\(\s*['"]load['"]/.test(source)),
    check('registerSw: catches registration failure', /\.catch\s*\(/.test(source)),
  ];
}

export function checkRetryStateSources({ publicMapSource, placeSheetSource }) {
  return [
    check('retry: map loadAttempt state', /loadAttempt/.test(publicMapSource)),
    check('retry: map setLoadAttempt bump', /setLoadAttempt/.test(publicMapSource)),
    check('retry: map alert role', /role=["']alert["']/.test(publicMapSource)),
    check('retry: map Повторить button', /Повторить/.test(publicMapSource)),
    check('retry: sheet error alert', /role=["']alert["']/.test(placeSheetSource)),
    check('retry: sheet onRetry handler', /onRetry/.test(placeSheetSource)),
    check('retry: sheet Повторить button', /Повторить/.test(placeSheetSource)),
  ];
}

export function checkVitePublicEntry(source) {
  return [
    check('vite: public.html input', /public:\s*resolve\([^)]*['"]public\.html['"]/.test(source)),
    check('vite: index.html input', /main:\s*resolve\([^)]*['"]index\.html['"]/.test(source)),
  ];
}

export function checkThemeColorConsistency({ manifest, html }) {
  const manifestColor = manifest?.theme_color ?? '';
  const match = html.match(/<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i);
  const htmlColor = match?.[1] ?? '';
  return [
    check(
      'theme-color: manifest/html match',
      manifestColor.length > 0 && manifestColor.toLowerCase() === htmlColor.toLowerCase(),
      `manifest=${manifestColor || '?'} html=${htmlColor || '?'}`,
    ),
  ];
}

export function checkDistPreviewArtifacts(distRoot) {
  const required = [
    'public.html',
    'manifest.webmanifest',
    'sw.js',
    'icons/icon-192.svg',
    'icons/icon-512.svg',
    'favicon.svg',
  ];
  const checks = required.map((relativePath) => {
    const absolutePath = resolve(distRoot, relativePath);
    const exists = existsSync(absolutePath);
    return check(
      `dist: ${relativePath}`,
      exists,
      exists ? 'ok' : `missing at ${absolutePath}`,
    );
  });

  if (existsSync(resolve(distRoot, 'public.html'))) {
    const builtHtml = readFileSync(resolve(distRoot, 'public.html'), 'utf8');
    checks.push(
      check(
        'dist: public.html hashed bundle',
        /\/assets\/public-[^"']+\.js/.test(builtHtml),
        'expected built public JS chunk reference',
      ),
    );
    checks.push(...checkPublicHtmlPwaHooks(builtHtml).map((item) => ({
      ...item,
      name: `dist ${item.name}`,
    })));
  }

  return checks;
}

export function summarizeChecks(checks) {
  const passed = checks.filter((item) => item.pass).length;
  const failedLines = checks
    .filter((item) => !item.pass)
    .map((item) => `${item.name}: ${item.detail || 'failed'}`);
  return {
    passed,
    total: checks.length,
    failedLines,
    allPass: failedLines.length === 0,
  };
}

export function readRepoPreviewSources(repoRoot) {
  return {
    manifestRaw: readFileSync(resolve(repoRoot, 'public/manifest.webmanifest'), 'utf8'),
    swSource: readFileSync(resolve(repoRoot, 'public/sw.js'), 'utf8'),
    publicHtml: readFileSync(resolve(repoRoot, 'public.html'), 'utf8'),
    registerSwSource: readFileSync(resolve(repoRoot, 'src/registerSw.ts'), 'utf8'),
    publicMapSource: readFileSync(resolve(repoRoot, 'src/components/PublicMap.tsx'), 'utf8'),
    placeSheetSource: readFileSync(resolve(repoRoot, 'src/components/PlaceSheet.tsx'), 'utf8'),
    viteConfigSource: readFileSync(resolve(repoRoot, 'vite.config.ts'), 'utf8'),
  };
}

export function runSourcePreviewChecks(repoRoot) {
  const sources = readRepoPreviewSources(repoRoot);
  const manifest = parseManifest(sources.manifestRaw);
  return [
    ...checkManifestInstallability(manifest),
    ...checkServiceWorkerHonestShell(sources.swSource),
    ...checkPublicHtmlPwaHooks(sources.publicHtml),
    ...checkRegisterSwSource(sources.registerSwSource),
    ...checkRetryStateSources({
      publicMapSource: sources.publicMapSource,
      placeSheetSource: sources.placeSheetSource,
    }),
    ...checkVitePublicEntry(sources.viteConfigSource),
    ...checkThemeColorConsistency({ manifest, html: sources.publicHtml }),
  ];
}
