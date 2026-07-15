# T1 — Public PWA map — handoff report

**Executor:** Composer (Cursor)  
**Worktree:** `feat/pwa-public`  
**Mode:** `ui-craft-first` (surface) + `superpowers-full` (live data / RLS / smoke)  
**Date:** 2026-07-15  
**Status:** `READY FOR SOL REVIEW`

---

## Commit SHAs (pushed)

| Block | SHA | Description |
|-------|-----|-------------|
| 1 | `c042ec1` | RLS migrations + fixture-backed smoke harness |
| 2 | `c66de99` | Live public data adapter (`supabase.ts`, `places.ts`) |
| 3 | `1ceedcc` | Public UI slice + PWA shell + T1-REVIEW fixes |
| 4 | *(this commit)* | Handoff report (`T1-REPORT.md`) |

---

## T1-REVIEW fixes applied

| # | Issue | Fix |
|---|-------|-----|
| 1 | Vacuous smoke | Smoke discovers fixtures via `TEST_SUPABASE_*` + service role; **fails** if gray/colored/hidden/pending/photo paths missing |
| 2 | Keyboard/focus | Accessible map pin buttons, focus traps (menu/filter/sheet), Escape + focus return, `focusTrap` tests, browser Tab/Enter/Escape checks |
| 3 | Zoom disabled | Removed `maximum-scale` / `user-scalable=no` from `index.html` |
| 5 | Attribution | Restored Leaflet attribution control + tile attribution |
| 6 | Placeholder links / locale | Russian only (removed `ab·ru·en`); footer/menu external links **disabled** pending canonical URLs |
| 7 | Auto geolocation | Removed mount-time GPS; only explicit «Найти меня» button |

G1 visual/device screenshots remain external gate (browser smoke writes `artifacts/browser-smoke/viewport-*.png` when run).

---

## FIELD-DELTA acceptance (Antigravity 2026-07-14)

**Принято.** Narrow anon `photos` + private `place-photos` signed-read policies in `20260714141000_public_read_published.sql`; smoke exercises metadata + signing with fixture discovery.

---

## Verification (факт)

| Command | Result |
|---------|--------|
| `npm test` | **17/17 PASS** |
| `npm run build` | **PASS** |
| `npm run lint` | **11 errors + 3 warnings** (baseline debt in legacy `api.ts`/`telegram.ts`/`AddWizard`; no new error types in T1 files) |
| `npm run smoke` | **FAIL until test DB fixtures exist** — correctly non-vacuous (see below) |
| `npm run browser-smoke` | **14/14 PASS** (viewports 360–1440 + keyboard/focus; screenshots in `artifacts/browser-smoke/`) |
| `git diff --check` | **clean** |

### Smoke behaviour (non-vacuous)

With `.env.test.local` (`TEST_SUPABASE_URL`, `TEST_SUPABASE_ANON_KEY`, `TEST_SUPABASE_SERVICE_ROLE_KEY`):

- Service role discovers gray/colored/hidden/pending places + facade paths
- If any fixture missing → **FAIL** (not PASS/skip)
- Anon client then proves read/signing boundaries

Current test project has no fixtures yet → smoke exits 1. **SOL/Alkhas:** apply T1 migrations + seed smoke fixtures on test target, then re-run.

`.env.test.local` is gitignored; never committed or logged.

---

## Scope delivered

- Welcome legend (once), live map without Telegram login, top/bottom rails, menu/filter overlays, place sheet (loading/error/partial/success)
- PWA manifest, icons, honest network-only SW
- `PHOTO_COLUMNS` explicit metadata reads; signed facade URLs
- Bottom rail visible under sheet (G1 reversible candidate)

---

## Open questions (не решались)

- Canonical Instagram / Telegram / site URLs — controls disabled until Alkhas provides
- Test DB fixture seed procedure — smoke discovery ready; data not present on current test project
- Antigravity screenshot audit + Alkhas physical G1 — external gates

---

## READY FOR SOL REVIEW

Push: `origin/feat/pwa-public` @ tip `9d67b8f`. Deploy / secrets / merge — not touched.
