# GoApsny G1 and Contour Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Провести фактический G1 GoApsny на телефоне Алхаса, не строить второе Mini App и после принятия G1 перезапустить рабочий контур с новым дирижёром Z и отдельным Активатором.

**Architecture:** Публичная PWA T1 остаётся отдельным анонимным входом. Существующее Telegram Mini App сохраняется как будущая поверхность картографа и администратора. До телефонного G1 последовательно закрываются тестовая БД, T2 email-код и новая серая метка, preview и визуальная проверка. После G1 старый дирижёрский epoch отзывается, а новая сессия получает новый lease/fence.

**Tech Stack:** React/Vite PWA, Supabase/Postgres/Storage/Auth, Vercel Preview, Telegram Mini App, Supacode, ZCode CLI, Cursor Composer, Kimi Code CLI, Antigravity.

## Global Constraints

- Production Supabase, production Vercel, `main`, BotFather/webhooks и внешние публикации не затрагивать без отдельного гейта Алхаса.
- G1 относится к GoApsny, не к приостановленной iPad-консоли.
- Публичная карта открывается без регистрации; email-код появляется только после действия «Добавить объект».
- G1 завершается только после создания одной новой серой метки и её анонимного появления на карте.
- Второе Telegram-приложение не строить. Расширять существующее Mini App.
- MapLibre обязателен для текущего продукта, но не подменяет телефонный G1 уже принятой T1-ветки.
- Один писатель на worktree и один дирижёр на epoch.
- Активатор не является вторым дирижёром: `WORKING → NO_OP`; один wake на новый инцидент; максимум две попытки за 60 минут.

---

### Task 1: Preserve the pre-G1 control plane

**Files:**
- Modify: `run-log.md`
- Add: `briefs/T1-REREVIEW2-2026-07-15.md`
- Add: `briefs/T1-REREVIEW3-2026-07-15.md`
- Add: `briefs/T1-REREVIEW4-2026-07-15.md`

**Produces:** immutable pre-G1 checkpoint `fc20d65`.

- [x] **Step 1: Scan the four files for exposed credentials and malformed diff.**

Run:

```bash
git diff --check -- run-log.md
```

Expected: exit `0`; no credential values in the four files.

- [x] **Step 2: Commit only the control-plane evidence.**

```bash
git add run-log.md briefs/T1-REREVIEW2-2026-07-15.md briefs/T1-REREVIEW3-2026-07-15.md briefs/T1-REREVIEW4-2026-07-15.md
git commit -m "docs: preserve pre-g1 control plane"
```

Expected: commit `fc20d65`; sprint worktree clean.

### Task 2: Prepare the isolated T2 database lane

**Files:**
- Worktree: `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/t2-roles-rls`
- Branch: `feat/t2-roles-rls`
- Brief: `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/feat/goapsny-sprint/briefs/T2-Z-RLS.md`

**Produces:** isolated Z-owned database lane; no live apply authority.

- [x] **Step 1: Create the worktree from `origin/main` through Supacode.**

Expected: worktree path above; branch `feat/t2-roles-rls` at `97af435`.

- [x] **Step 2: Install locked dependencies and verify the baseline.**

```bash
npm ci
npm test
```

Expected: `7/7` tests pass.

- [ ] **Step 3: Launch Z through ZCode CLI after the protected credential-bridge gate.**

Z must first write `docs/superpowers/plans/2026-07-16-t2-roles-rls.md`, self-review it, then implement with TDD. Z may read the desktop ZCode subscription key only into process memory; it must not print or persist it.

- [ ] **Step 4: Require focused pushed SHAs and `T2-Z-REPORT.md`.**

Expected report: migrations/tests only, exact commands and counts, no DB apply, `READY FOR SOL REVIEW` or factual blocker.

- [ ] **Step 5: Perform immutable SOL review of the Z tip.**

Expected: accepted SHA or a bounded correction brief. No live T2 apply yet.

### Task 3: Apply and prove the accepted T1 test database

**Files:**
- Source worktree: `/Users/alkhas.abaza/.supacode/repos/goapsny-mvp/feat/pwa-public`
- Immutable source SHA: `12a12685fb7df0d69a98bf2cff6ec46501413a66`
- Protected env: `.env.test.local` mode `0600`

**Consumes:** explicit Alkhas authorization for isolated test-project apply; production excluded.

**Produces:** live anonymous DB/Storage proof for T1.

- [ ] **Step 1: Verify the immutable source and protected environment without printing values.**

```bash
git status --short --branch
git rev-parse HEAD
stat -f '%Sp %z' .env.test.local
```

Expected: clean worktree, SHA `12a1268…`, env mode `-rw-------`.

- [ ] **Step 2: Link only the isolated test project.**

Use the project ref already stored in `.env.test.local`. If the CLI asks for a database password, Алхас enters it through the local prompt; it is never placed in a command, chat or report.

- [ ] **Step 3: Dry-run the ordered schema application.**

The staff runner must preserve this order:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/seed/categories.sql`
3. `supabase/seed/methodology.sql`
4. `supabase/migrations/20260714140000_lock_karma_rpc.sql`
5. `supabase/migrations/20260714141000_public_read_published.sql`
6. `supabase/migrations/20260714142000_align_active_categories.sql`

Do not use a single blind `db push` that would apply the category-alignment migration before the canonical category seed.

- [ ] **Step 4: Apply the six accepted SQL inputs and record each exit code.**

Expected: only the isolated project changes; private bucket remains private; no credential output.

- [ ] **Step 5: Seed deterministic G1 fixtures.**

```bash
npm run smoke:setup
```

Expected: published gray, published colored, pending and hidden fixtures plus their facade objects.

- [ ] **Step 6: Run the live anonymous proof.**

```bash
npm run smoke
```

Expected: published rows/photos/signed URLs visible; pending/hidden rows, metadata and objects denied; anonymous writes/uploads denied.

### Task 4: Build and accept T2 email OTP plus one gray submission

**Files:**
- Database phase: `feat/t2-roles-rls`
- UI integration base: accepted T1 `feat/pwa-public@12a1268`
- Product contract: `briefs/T2.md` and `briefs/OBJECT-CONTRACT.md`

**Consumes:** accepted T2 database SHA and green T1 live smoke.

**Produces:** email OTP and facade/category/name/location flow that publishes one gray pin.

- [ ] **Step 1: Apply the accepted T2 migrations only after a separate Alkhas gate.**

Expected: new email profiles default to `public_user`; existing legitimate Telegram `tester` profiles remain unchanged.

- [ ] **Step 2: Configure the isolated test project's email OTP and exact preview redirect allowlist.**

Expected: one controlled test mailbox; no wildcard production domains; no OTP or mailbox credential in logs.

- [ ] **Step 3: Create a fresh integration branch from the accepted dual-entry T1 pin.**

Do not overwrite `feat/pwa-public` and do not merge `feat/auth-session` wholesale.

- [ ] **Step 4: Implement OTP/session and the minimal gray-place flow with TDD.**

Expected sequence: anonymous map → Add → email → six-digit code → facade/category/name/map pin → publish → same gray pin opens on the public map.

- [ ] **Step 5: Review the immutable integration tip.**

Required evidence: tests, build, DB/Auth/Storage smoke, 360/390/768 browser flow and no new lint regression.

### Task 5: Reuse the existing Mini App without creating a second UI

**Files:**
- Secure source: `/Users/alkhas.abaza/repo/goapsny-mvp` at `feat/auth-session@6b3a224`
- Logic source only: `feat/tg-auditors@75392e1`
- Integration target: post-G1 dual-entry branch

**Produces:** post-G1 port plan, not a second application.

- [ ] **Step 1: Port the real Telegram→Supabase session and geolocation fallback file by file.**

Reuse `auth-telegram`, the persistent Supabase client and LocationManager watchdog. Do not restore mock fallback as production behavior.

- [ ] **Step 2: Extract only neutral role/validation/place-transition logic from `feat/tg-auditors`.**

Do not bring `handler.ts`, keyboards, callback routing, webhook transport or bot session tables into the Mini App UI.

- [ ] **Step 3: Replace legacy auditor/coordinator gates with mapper/administrator capabilities.**

Expected: mapper has no admin panel; administrator has the additional community and administrative powers.

- [ ] **Step 4: Keep MapLibre migration as a separate map-component lane.**

Expected: same application shells and shared data; no duplicate Mini App.

### Task 6: Deploy the G1 preview and collect visual evidence

**Consumes:** green T1/T2 live smoke and explicit preview-deploy authorization.

- [ ] **Step 1: Configure only the Vercel Preview environment.**

Expected project slug: `pwa-test-14-07`; no service-role key in any `VITE_*` variable.

- [ ] **Step 2: Deploy the accepted preview tip.**

Expected: immutable preview URL; production domain unchanged.

- [ ] **Step 3: Run Antigravity mobile visual/accessibility audit.**

Required widths: `360`, `390`, `768`, `1024`, `1440`; capture screenshots, console/page errors, manifest/service worker and installability evidence.

### Task 7: Alkhas physical-device G1

**Consumes:** preview URL and Antigravity evidence.

- [ ] **Step 1: Open the preview on the phone without signing in.**

Verify: map opens directly; no registration wall; no automatic location prompt.

- [ ] **Step 2: Check the public map.**

Verify: gray and colored published markers, filters, place card, facade photo and readable controls.

- [ ] **Step 3: Check the Add flow.**

Verify: email code appears only after Add; one facade/category/name/location submission creates a gray pin visible anonymously.

- [ ] **Step 4: Check PWA behavior.**

Verify installation/add-to-home-screen, relaunch, portrait use and return from the place sheet.

- [ ] **Step 5: Give the verdict.**

Exact output: `G1 принято` or a concrete numbered correction list. Also decide whether the bottom rail remains visible under the place sheet and what the first Cabinet contains.

### Task 8: Cut over to the new Supacode contour after G1

**Consumes:** `G1 принято`, preserved pre-G1 checkpoint, immutable lane SHAs and handoff.

- [ ] **Step 1: Freeze existing tabs without closing them.**

Old SOL, T1 and T3 remain available for evidence but receive no new work during cutover.

- [ ] **Step 2: Revoke the old conductor epoch.**

Record old tab/process as non-authoritative. It cannot regain writer authority merely by resume.

- [ ] **Step 3: Start a genuinely new Z conductor through ZCode CLI.**

Assign a new `epoch`, `lease_id` and `fence_token`; write exactly one `SESSION-START` entry with current SHAs, gates, roster and `NEXT`.

- [ ] **Step 4: Start SOL as a separate Activator contour.**

It reads run state and writes only its own incident/control journal. It never writes the conductor run-log.

- [ ] **Step 5: Run a capped reconnect smoke.**

Z dispatches one bounded read-only Composer lane and one Kimi lane. Activator must prove `WORKING → NO_OP` and exactly one wake for an injected stale incident.

- [ ] **Step 6: Start product lanes only after the smoke passes.**

Recommended initial roster:

- Z: primary conductor;
- SOL: Activator and reserve conductor only through formal takeover;
- Composer: primary code lanes, one writer per worktree;
- Kimi: independent builder/reviewer/research lanes;
- Antigravity: preview QA and isolated execution with explicit project adapter;
- Sonnet: optional review subject to Claude resource;
- Luna/Terra: do not route until native entitlement works;
- Grok: rare bounded probes only;
- retired Mistral probe: never resume.

- [ ] **Step 7: Begin HQ audits.**

Hourly for the first 8 hours; then every 3 hours; after 3–5 stable days at `00:00`, `08:00`, `16:00` MSK. Any anomaly returns cadence to hourly.

---

## Completion Evidence

The initiative is complete only when:

1. T1 live DB/Storage smoke is green on the isolated project;
2. T2 creates a non-elevated email user and one public gray pin;
3. preview and Antigravity evidence are attached;
4. Alkhas says `G1 принято`;
5. old conductor authority is revoked;
6. the new Z epoch and separate Activator pass the capped reconnect smoke;
7. no production, webhook, external-message or `main` gate was crossed implicitly.
