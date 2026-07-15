# T1 — Public PWA map — correction handoff

**Executor:** Composer (Cursor)  
**Worktree:** `feat/pwa-public`  
**Mode:** `superpowers-lite` (correction lane) + `ui-craft-first` (surface)  
**Date:** 2026-07-15  
**Prior immutable pin:** `fc2b7dd`  
**Correction tip (pre-report):** `3db546b`

---

## T1-REREVIEW blocker → pushed SHA

| # | Finding | SHA | Status |
|---|---------|-----|--------|
| 1 | DB harness: stable fixtures, fail-closed `TEST_SUPABASE_*`, host boundary, no fallbacks | `8607fbd` | **Code ready** — smoke 2/9 until staff apply + `npm run smoke:setup`; **WAITING ON ARBITER** (SOL HOLD→GO, no T1 apply) |
| 2 | Preserve Telegram Mini App vs public PWA | `86fb8a2` | `index.html` → `TelegramApp`; `public.html` → `PublicApp` + PWA |
| 3 | `.env.example` documents `VITE_SUPABASE_*` | `86fb8a2` | Names only; separate `TEST_SUPABASE_*` block |
| 4 | Populated-map integration (load/filter/sheet/partial) | `3db546b` | `PublicMap.test.tsx` 5/5 green in full suite |
| 5 | Focused immutable blocks | `8607fbd`…`3db546b` | Additive commits, no rewrite |
| 6 | Tab/Shift+Tab focus coverage | `70e7de2`, `3db546b` | `focusTrap.test.ts` + browser-smoke Tab checks |
| 7 | Filter close + focus restore | `3db546b` | `PublicMap` integration asserts apply closes overlay + focus |
| 8 | Bounded public data load | `352c046` | `PUBLIC_PLACES_FETCH_LIMIT = 500` + `.range()` |
| 9 | Factual handoff evidence | *(this commit)* | Machine-reproduced counts below |
| 10 | Antigravity screenshots + Alkhas device G1 | — | **WAITING ON ARBITER** |
| — | Canonical external URLs | — | **WAITING ON ARBITER** (controls disabled in UI) |
| — | Deploy / secrets / PR / `main` merge | — | **WAITING ON ARBITER** |

---

## Commit SHAs (correction lane, pushed)

| SHA | Description |
|-----|-------------|
| `8607fbd` | Fail-closed test DB gate + deterministic fixture setup script |
| `86fb8a2` | Telegram `index.html` + public `public.html` entrypoints; `.env.example` |
| `352c046` | Bounded anonymous published-place fetch (500) |
| `70e7de2` | WIP checkpoint: Tab trap tests + PublicMap scaffold |
| `3081b90` | Report wording checkpoint |
| `3db546b` | Green PublicMap integration + browser Tab focus checks |

Prior T1 blocks unchanged: `c042ec1`, `c66de99`, `1ceedcc`, `fc2b7dd`.

---

## Verification at `3db546b` (reproduced 2026-07-15)

| Command | Result |
|---------|--------|
| `npm test` | **24/24 PASS** |
| `npm run build` | **PASS** |
| `npm run lint` | **9 errors + 2 warnings** |
| `npm run smoke:gate-offline` | **3/3 PASS** |
| `npm run smoke` | **2/9 PASS** — env/boundary OK; 7 fixture rows absent (expected pre-apply) |
| `npm run browser-smoke` | Not re-run this session (requires `npm run preview` on `public.html`) |
| `git diff --check` | **clean** |

---

## Staff order after SOL HOLD → GO (not executed by T1)

1. Apply reviewed migrations on isolated test project per `T1-TESTDB-GATE-2026-07-15.md`
2. `npm run smoke:setup` (service role from `.env.test.local` only)
3. `npm run smoke` → expect full anon/storage proof pass

---

## READY FOR SOL RE-REVIEW

Push: `origin/feat/pwa-public`. Deploy / secrets / merge — not touched.
