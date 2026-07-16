import { describe, expect, it } from 'vitest';
import {
  checkDistPreviewArtifacts,
  checkManifestInstallability,
  checkPublicHtmlPwaHooks,
  checkRegisterSwSource,
  checkRetryStateSources,
  checkServiceWorkerHonestShell,
  checkThemeColorConsistency,
  checkVitePublicEntry,
  parseManifest,
  summarizeChecks,
} from './preview-harness-checks.mjs';

const VALID_MANIFEST = {
  name: 'GoApsny — карта доступности',
  short_name: 'GoApsny',
  description: 'Карта доступности городской среды Абхазии',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#0F1A24',
  theme_color: '#4BA4DD',
  lang: 'ru',
  icons: [
    { src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any' },
    { src: '/icons/icon-512.svg', sizes: '512x512', type: 'image/svg+xml', purpose: 'any maskable' },
  ],
};

const HONEST_SW = `
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
// Honest PWA shell: network-only, no offline cache claim.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
`;

describe('parseManifest', () => {
  it('parses valid JSON manifest', () => {
    const manifest = parseManifest(JSON.stringify(VALID_MANIFEST));
    expect(manifest.short_name).toBe('GoApsny');
  });

  it('throws with readable detail on invalid JSON', () => {
    expect(() => parseManifest('{not-json')).toThrow(/invalid JSON/i);
  });
});

describe('checkManifestInstallability', () => {
  it('passes a complete public manifest', () => {
    const checks = checkManifestInstallability(VALID_MANIFEST);
    expect(checks.every((item) => item.pass)).toBe(true);
  });

  it('reports missing icon sizes and display mode', () => {
    const checks = checkManifestInstallability({
      ...VALID_MANIFEST,
      display: 'browser',
      icons: [{ src: '/icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml' }],
    });
    expect(checks.some((item) => !item.pass && item.name.includes('display'))).toBe(true);
    expect(checks.some((item) => !item.pass && item.name.includes('512'))).toBe(true);
  });
});

describe('checkServiceWorkerHonestShell', () => {
  it('accepts network-only honest shell', () => {
    const checks = checkServiceWorkerHonestShell(HONEST_SW);
    expect(checks.every((item) => item.pass)).toBe(true);
  });

  it('rejects precache offline claims', () => {
    const checks = checkServiceWorkerHonestShell(`
      self.addEventListener('install', (event) => {
        event.waitUntil(caches.open('shell').then((cache) => cache.addAll(['/'])));
      });
      self.addEventListener('fetch', (event) => {
        event.respondWith(caches.match(event.request));
      });
    `);
    expect(checks.some((item) => !item.pass)).toBe(true);
  });
});

describe('checkPublicHtmlPwaHooks', () => {
  it('requires manifest link and theme-color meta', () => {
    const html = `<!doctype html>
      <div id="root"></div>
      <link rel="manifest" href="/manifest.webmanifest" />
      <meta name="theme-color" content="#4BA4DD" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <script type="module" src="/src/public-main.tsx"></script>`;
    const checks = checkPublicHtmlPwaHooks(html);
    expect(checks.every((item) => item.pass)).toBe(true);
  });

  it('flags missing manifest link', () => {
    const checks = checkPublicHtmlPwaHooks('<html><body></body></html>');
    expect(checks.some((item) => !item.pass && item.name.includes('manifest'))).toBe(true);
  });
});

describe('checkRegisterSwSource', () => {
  it('requires /sw.js registration on load', () => {
    const source = `
      export function registerServiceWorker() {
        if (!('serviceWorker' in navigator)) return;
        window.addEventListener('load', () => {
          void navigator.serviceWorker.register('/sw.js').catch((error) => {
            console.warn('Service worker registration failed', error);
          });
        });
      }
    `;
    const checks = checkRegisterSwSource(source);
    expect(checks.every((item) => item.pass)).toBe(true);
  });
});

describe('checkRetryStateSources', () => {
  it('requires map and sheet retry affordances', () => {
    const checks = checkRetryStateSources({
      publicMapSource: `
        const [loadAttempt, setLoadAttempt] = useState(0);
        <div className="public-error" role="alert">
          <button onClick={() => setLoadAttempt((attempt) => attempt + 1)}>Повторить</button>
        </div>
      `,
      placeSheetSource: `
        {state === 'error' && (
          <div role="alert">
            <button onClick={onRetry}>Повторить</button>
          </div>
        )}
      `,
    });
    expect(checks.every((item) => item.pass)).toBe(true);
  });
});

describe('checkVitePublicEntry', () => {
  it('requires public.html rollup input', () => {
    const source = `
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
          public: resolve(__dirname, 'public.html'),
        },
      },
    `;
    const checks = checkVitePublicEntry(source);
    expect(checks.every((item) => item.pass)).toBe(true);
  });
});

describe('checkThemeColorConsistency', () => {
  it('matches manifest theme_color to html meta', () => {
    const checks = checkThemeColorConsistency({
      manifest: VALID_MANIFEST,
      html: '<meta name="theme-color" content="#4BA4DD" />',
    });
    expect(checks.every((item) => item.pass)).toBe(true);
  });
});

describe('checkDistPreviewArtifacts', () => {
  it('reports missing dist files with paths', () => {
    const checks = checkDistPreviewArtifacts('/tmp/goapsny-missing-dist');
    expect(checks.some((item) => !item.pass && item.detail.includes('dist'))).toBe(true);
  });
});

describe('summarizeChecks', () => {
  it('formats pass ratio and failed detail lines', () => {
    const summary = summarizeChecks([
      { name: 'ok', pass: true },
      { name: 'bad', pass: false, detail: 'missing manifest' },
    ]);
    expect(summary.passed).toBe(1);
    expect(summary.total).toBe(2);
    expect(summary.failedLines).toEqual(['bad: missing manifest']);
  });
});
