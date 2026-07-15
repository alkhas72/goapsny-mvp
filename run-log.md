# GoApsny sprint — orchestration run log

> Owner: SOL sprint conductor. Only the active conductor edits this file.
> Mode: B0 manual orchestration; observational, not comparative.
> Operator/final arbiter: Alkhas.
> Staff: Cowork-Claude (panels, permission walls, Telegram signals).
> Started: 2026-07-14 MSK.
> Rule: append-only. Corrections are new entries; prior entries are not rewritten.

## Run frame

- Goal by 2026-07-15 evening: public PWA test (map + email OTP) and Telegram auditor/coordinator test; PWA wins under time pressure.
- Field roster frozen for start: Composer T1/T4; Kimi K2.7 Code T2/T3; Antigravity external read-only auditor; GLM-5.2 reserve conductor after explicit handoff.
- Worktrees: `feat/pwa-public`, `feat/tg-auditors`; both currently point to `origin/main` commit `97af435`.
- Execution order: Phase A `T1 ∥ T3`; Phase B `T2 ∥ T4`, with one writer per worktree and an explicit SOL handoff between phases.
- No autonomous deploy, secret mutation, destructive git/fs, webhook registration, or merge to `main`.
- Context rule: at >80% SOL context, append a budget signal and prepare GLM-5.2 handoff before the wall. Current surface exposes no trustworthy numeric context gauge; no percentage is invented.

## 2026-07-14

### 14:35 MSK — source reconciliation and baseline

- Director/model: SOL; orchestration/doc work only, no product code authored.
- Read: sprint partitura 2026-07-14, product decisions 2026-07-14, root `DESIGN.md`/`AGENTS.md`, UI Craft memory/spec, backend contract, RLS checklist, migration `0001`, secure reference branch `origin/feat/auth-session`, v2 wireframe/interview, prior conductor run-log format.
- Contract conflict resolved for field: public map viewing is anonymous; email OTP is not a login wall. This follows the newer product decision plus `DESIGN.md`; any request for a mandatory PWA wall returns to Alkhas as a product fork.
- Repository fact: `origin/main` is `97af435`; `origin/feat/auth-session` at `6b3a224` contains previously smoke-verified live auth/session work not merged into main. Field briefs reference it selectively and prohibit blind merge/reintroduction of insecure hand-signed JWTs.
- Baseline environment: `.env` absent in conductor worktree; `node_modules` initially absent. `npm ci` completed from lockfile with 0 vulnerabilities.
- Baseline evidence after install: `npm test` 7/7 PASS; `npm run build` PASS; `npm run lint` FAIL with 10 errors + 2 warnings (pre-existing debt, recorded so field cannot relabel regressions as baseline).
- DB smoke not run: `.env` absent and no secret was requested/exposed. Staff must copy `~/repo/goapsny-mvp/.env` into each active worktree before live database checks.
- Outcome: data contract approved for field in `briefs/OBJECT-CONTRACT.md`; no field executor started yet.

### 14:36 MSK — task decomposition ready

- Briefs created: `briefs/T1.md`, `briefs/T2.md`, `briefs/T3.md`, `briefs/T4.md`.
- Assignment locked: Composer starts T1 in `feat/pwa-public`; Kimi starts T3 in `feat/tg-auditors`. T2/T4 must not start until T1/T3 respectively are pushed and SOL appends the handoff.
- Contract seam: existing `places` + `photos`; auditor creates/edits own pending only; coordinator publishes/hides; anonymous PWA reads published only. Editing already-published objects and district-group schema are outside the sprint.
- PWA cut line: T1 implements the public wireframe slice; T2 owns email OTP; Telegram owns audit/admin mutations. The 10-frame v2 artifact remains the structural source, not a license to duplicate all mutation flows in the PWA.
- Product forks parked for G1: bottom rail under full place sheet; final Cabinet contents. Reversible G1 candidate in T1: bottom rail stays visible; unresolved email door omitted.
- SMTP risk: built-in Supabase delivery is test-only; live OTP volume stays minimal. Production sender remains a logged follow-up, not sprint scope.
- Required staff pre-start facts: observation panels/tails exist before agents; correct worktree is visible; `.env` copied locally; one writer per worktree; agent/model matches assignment; no deploy/secrets prompt is auto-approved.
- Next gate: staff confirms panels + worktrees + `.env`, then launches Phase A with the exact T1/T3 files.

### 14:42 MSK — pre-field artifact verification

- Fresh artifact check: `briefs/OBJECT-CONTRACT.md`, T1–T4, and this log are present/non-empty; total 697 lines before this appended entry.
- All local/Obsidian/design-source paths referenced by the briefs are readable from the conductor worktree.
- Placeholder/secret/trailing-whitespace scan returned no matches; Markdown code-fence counts are even in every brief.
- Fresh repository checks after documentation work: `npm test` 7/7 PASS; `npm run build` PASS.
- Fresh `npm run lint`: FAIL, reproducing the same baseline 10 errors + 2 warnings recorded at 14:35; no product code was changed by SOL.
- Git state: only new `briefs/` and `run-log.md` are untracked; no existing tracked file changed.
- Outcome: contract and briefs are ready for staff pre-start setup. Field still not started by SOL.

### 15:03 MSK — arbiter correction: immediate public gray lifecycle

- Arbiter decision received from Alkhas and supersedes the 14:36 lifecycle note: public map viewing is fully anonymous; email OTP is required only when choosing to add an object.
- Basic email user submits facade photo + category + name + selected location. The server creates `status=gray`, `moderation_status=published`, `source=public`; the gray pin is visible immediately and the contributor has no edit role afterward.
- Community auditor verifies the same published gray object into green/yellow/red and may create/edit verified published objects. Coordinator administration is hide/restore/overview; coordinator approval is not the normal publication path. Moderation is sleeping.
- Contract and T1–T4 were rewritten to treat this as a decision, not a fork. The earlier pending→approve seam remains historical only and must not be implemented.
- Field worktrees confirmed by staff: `feat/pwa-public` and `feat/tg-auditors`; staff is copying `.env` from `~/repo/goapsny-mvp` into each. One writer per worktree remains mandatory.
- Cursor CLI model inventory verified with the installed binary: exact launch IDs are `composer-2.5` and `kimi-k2.7-code`. Mistral is not listed by this Cursor CLI; it remains a separate later bounded candidate after research, not critical path.
- Antigravity expanded to a read-only external cross-audit plus official-source research under `briefs/ANTIGRAVITY.md`. No repository mutation or product arbitration is delegated to it.

### 14:54 MSK — clerical timestamp correction

- The immediately preceding entry was appended at 14:54 MSK; its `15:03 MSK` heading is a clerical future-time label. The content and supersession remain valid. Per append-only policy the earlier heading was not rewritten.

### 14:56 MSK — Phase A launch packet verified

- Fresh structural gate passed: contract, T1–T4, Antigravity brief, and run-log are non-empty; active briefs contain no old pending→approve seam; trailing-whitespace check passed.
- Fresh worktree gate passed: `feat/pwa-public` and `feat/tg-auditors` exist at `97af435`, report the correct branches, and their root `AGENTS.md` files are readable.
- Fresh Cursor CLI gate: version `2026.07.09-a3815c0`; interactive flags `--workspace`, `--add-dir`, `--model`, and `--auto-review` are supported. `--trust` is headless-only and is intentionally excluded from the interactive launch commands.
- Fresh account model inventory contains exact IDs `composer-2.5` and `kimi-k2.7-code`; it contains no Mistral entry.
- Phase A launch packet is ready for staff. SOL has not launched the field, deployed, changed secrets, pushed, or merged.

### 15:40 MSK — Antigravity security delta accepted

- Full Mission A/B reports read from `Obsidian/wiki/from-gemini/`; staff's three main findings were independently confirmed against baseline migration `0001_initial_schema.sql`.
- BLOCKER confirmed: `profiles.role` defaults to `tester` (line 19) and `current_user_can_collect()` includes `tester` (line 310). T2 now starts with an additive `ALTER COLUMN role SET DEFAULT 'public_user'`; blanket demotion of existing legitimate Telegram testers is forbidden.
- HIGH confirmed: `public.photos` published-parent read and `place-photos` Storage read are authenticated-only. T1 now explicitly owns narrow anon policies for published photo metadata and signed private-object reads.
- HIGH confirmed: Storage insert is collector-only. T2 owns explicit public-user facade INSERT and owned-unreferenced facade DELETE policies; no update/extra-kind/cross-owner permission.
- MEDIUM accepted as a new-function invariant: every new/replaced `SECURITY DEFINER` uses empty `search_path`, fully qualified references, and minimum execute grants. Existing `SET search_path=public` functions remain recorded legacy debt unless directly replaced; no unrelated schema rewrite is opened.
- Binding delta written to `briefs/FIELD-DELTA-ANTIGRAVITY-2026-07-14.md`; contract and T1/T2/T3 updated. T1/T3 remain the only active worktree writers.
- Research identifies Mistral Vibe as terminal-compatible, but it is not admitted: no install, credential/subscription setup, or trial before separate Alkhas arbitration.

### 15:41 MSK — field delivery channel status

- Active processes independently mapped: Composer `composer-2.5` PID 1119/CWD `feat/pwa-public`; Kimi `kimi-k2.7-code` PID 3040/CWD `feat/tg-auditors`. Each worktree has exactly one open Supacode tab/surface.
- Supacode socket/API can enumerate and focus the exact surfaces but exposes no safe send-text operation. GUI runtime required by the local computer-use skill is unavailable in this session; blind keyboard injection was rejected.
- No second Cursor writer/session was launched and no session-state probing workaround was used. Delta commit `9807c98` is pushed and readable at the absolute brief path.
- Delivery is therefore **prepared but awaiting staff paste** into the two already-open chats. SOL must not claim executor acknowledgement until staff relays it or field output proves incorporation.

### 16:08 MSK — staff delivery confirmation, model correction, WALL protocol

- Staff confirms `FIELD-DELTA-ANTIGRAVITY-2026-07-14.md` was pasted into both active T1 and T3 chats. Delivery is complete; executor acknowledgements remain pending and must be verified from their responses/artifacts.
- Correction to the 15:41 process map: `feat/tg-auditors` is running **Composer 2.5**, switched inside the live Cursor session with `/model` under Alkhas's rule “Cursor — only native Composer”. Supacode statusline is the authoritative observation. Process PID/launch arguments show the startup model only and are invalid evidence after an in-session switch.
- Staff removed T1 walls for `git show`/`ls-tree`/`rg`, `npm test`/`build`/`lint`, and `npm install`; removed T3 walls for `deno`/`which` and `supabase db lint`.
- T3 `supabase db lint` returned exit 1 due to `Network Restrictions`. This does not block pure local implementation/tests. A network-capable/authorized database environment is now an explicit prerequisite before live-smoke or any claim that DB lint passed.
- Fresh filesystem observation: T1 now has active uncommitted UI/services plus the three named RLS/category migrations; T3 has active uncommitted bot/config/migrations and `T3-REPORT.md`. No executor commit/acknowledgement is inferred from file presence.
- Staff cadence: inspect active field roughly every 20 minutes. If a permission/tool wall is observed for more than 15 minutes, SOL appends an explicit marker in this form: `WALL: <T1|T3> | since <MSK> | <blocked command/capability> | <impact> | staff action needed`. On resolution append `WALL CLEARED` with elapsed time and factual result; never rewrite the original marker.
- No current `WALL` marker is opened at this observation: both worktrees show fresh progress, while T3 network DB lint is a recorded later prerequisite rather than a local-work blocker.

### 16:10 MSK — early artifact evidence after delta delivery

- T1's uncommitted `20260714141000_public_read_published.sql` now factually contains both required corrections: `photos_read_published_anon` joins to a published parent, and `place_photos_storage_read_anon_published` joins `storage.objects.name` through photo metadata to a published parent. Bucket-wide public access is not present in that migration.
- T3's current bot/migration files contain no new `SECURITY DEFINER`, function creation, or `search_path` declaration; therefore the hardening invariant is not presently triggered in T3. `rg` returned no matches (exit 1 means no match, not a test failure).
- These observations prove draft incorporation/no-conflict only. They do not prove tests, commit, push, or executor acknowledgement; Phase A remains active.

### 17:03 MSK — T3 SOL review: changes required

- Staff reports `T3-REPORT.md` ready. SOL reviewed the full uncommitted T3 worktree under the local code-review checklists; no product code was edited by SOL.
- Fresh independent checks: Deno fmt pass (20 files), lint pass (19), test pass (36/36), check pass, tracked `git diff --check` pass. DB lint remains unproven under the recorded network/local-runtime restriction.
- Deploy blocker found: T3 reads shared `TELEGRAM_BOT_TOKEN`, already used by product `auth-telegram`/`@GoApsnyBot`. Arbiter requires a separate BotFather auditor bot. Contract/T3 now fix distinct env names `AUDITOR_TELEGRAM_BOT_TOKEN` and `AUDITOR_TELEGRAM_WEBHOOK_SECRET`, env-only with no fallback; `@GoApsnyBot` webhook is forbidden.
- Additional review blockers: pre-processing/non-atomic idempotency loses failed retries and races; published place precedes required photo row; gray verification never displays facade; stale callbacks are not bound to current state; audit enums accept arbitrary text. Telegram send failure handling, duplicate category migration, and unreviewable zero-commit change size are also returned.
- Full numbered evidence and re-handoff contract: `briefs/T3-REVIEW-2026-07-14.md`. Verdict is `CHANGES REQUIRED`, not G2/deploy-ready.
- G1 remains the PWA phone gate and is not blocked by T3 fixes. It requires T1 review/push, then T2 email OTP in the same PWA worktree, authorized test-project migrations/config, preview deployment, and Alkhas device review.
- Direct-voice prerequisite: the only callable Telegram MCP currently declares transport through `@GoApsnyBot`, not `@AbhAIS_CodexBot`. SOL sent nothing through it. Staff must rebind/expose the Codex-bot MCP before SOL can safely send routine aiLAB or private gate signals.

### 20:25 MSK — SOL active: T1 priority review opened

- Staff reports both revised handoffs ready: `T1-REPORT.md` dated 19:11 and revised `T3-REPORT.md` dated 19:08. SOL is active; T1 review starts first because it blocks G1, T3 re-review follows.
- Auditor bot identity is now fixed by Alkhas: `@Audit_AIS_Bot`. Alkhas holds the token. At the authorized deploy gate the distinct Supabase secrets are `AUDITOR_TELEGRAM_BOT_TOKEN` and `AUDITOR_TELEGRAM_WEBHOOK_SECRET`; `@GoApsnyBot` remains untouched.
- T1 is unfrozen: Playwright wall removed and follow-up delta queued. Staff reports 15/15 tests and 20/20 smoke; these are executor/staff claims until SOL reruns and reads outputs. Staff instructed T1 to commit/push three blocks; SHA is still pending.
- T3 received SOL review and worked eight corrections; revised report is ready for factual re-review. No acceptance is inferred before diff/tests review.
- Direct Telegram MCP rebind to `@AbhAIS_CodexBot` is a deferred Claude Code task, not a sprint blocker. Alkhas pressed `/start` at 16:58. Until rebind, SOL routes all routine/gate signals through staff and does not use the currently declared `@GoApsnyBot` MCP transport.
- Watchdog correction: journal silence since 17:03 caused two false stuck escalations. This entry explicitly marks active review; no `WALL` is open. During extended review SOL will append progress at least every 20 minutes or an immediate `WALL` after the 15-minute threshold.
## 2026-07-14 20:30 MSK — SOL — T1 independent review complete

- T1 reviewed first as G1 blocker from uncommitted `feat/pwa-public` state at base HEAD `97af435`.
- Independent facts: `npm test` 15/15 PASS; build PASS (578.35 kB chunk warning); lint FAIL 10 errors + 2 warnings; `git diff --check` PASS; browser script 8/8 exits 0.
- `npm run smoke` exits 0 with 20/20, but remote target has 0 places, 0 categories, missing `place-photos` bucket and no applied branch migrations. Required gray/colored/photo positive cases are counted PASS when absent/skipped; this is not FIELD-DELTA proof.
- Verdict: **CHANGES REQUIRED / G1 NOT READY**. Review issued at `briefs/T1-REVIEW-2026-07-14.md` with blockers for non-vacuous RLS fixtures, keyboard/focus behavior, zoom, visual/PWA evidence, and immutable pushed SHAs.
- Additional findings: Leaflet attribution disabled; placeholder external links; locale buttons do not localize copy; geolocation requested on map mount.
- No WALL. SOL proceeds immediately to revised T3 review. Signals remain routed through штаб while Telegram MCP rebind is deferred.

## 2026-07-14 20:35 MSK — SOL — T3 re-review rejected

- Revised T3 artifact reviewed from uncommitted `feat/tg-auditors` at base HEAD `97af435`. Independent checks remain green: fmt 20 files, lint 19 files, tests 36/36, Deno check, and diff-check.
- The reported eight-fix re-handoff is not substantiated by the artifact. Runtime still reads shared `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET`; binding target is separately created `@Audit_AIS_Bot` with only `AUDITOR_TELEGRAM_BOT_TOKEN` / `AUDITOR_TELEGRAM_WEBHOOK_SECRET`.
- New blocker: migration `0002` requires non-null processed-update `status`, but runtime inserts only `update_id`; first live claim would fail. Old pre-processing/racy idempotency remains unchanged.
- Attempted atomic-create RPC is unused by runtime, contains a malformed facade-path comparison, lacks an execute grant to `service_role`, and has no applied-schema proof. Published half-object window therefore remains.
- Prior facade-display, stale-callback, enum-validation, Telegram-transport and duplicate-category findings remain open. Two `0003*` migrations now also collide in version/order.
- Verdict: **REJECTED HANDOFF / CHANGES REQUIRED**. Full evidence and re-handoff requirements: `briefs/T3-REREVIEW-2026-07-14.md`.
- No WALL. Deploy/secrets/webhook gate remains closed; no signal sent through the unsafe product-bot MCP.

## 2026-07-14 20:45 MSK — SOL — arbiter decisions fixed; Mistral exam issued

- Alkhas authorizes one separate free Supabase test project for G1/G2. Production is excluded. Exact staff credential/config/fixture request is recorded in `briefs/G1-TEST-ENV.md`; no secrets are requested in chat or committed.
- Requested human test label “14.07-pwa-test” is normalized to the valid Vercel slug `pwa-test-14-07`; candidate URL is `https://pwa-test-14-07.vercel.app` if available. This is a target name, not a deployment claim or authorization for T1 to deploy.
- Product decisions are fixed for T1: Russian only, no language switch; default Sukhum view; browser geolocation only after explicit user action.
- Final auditor bot identity: `@mapper_abh_bot`, display name `Mapper_GoApsny`, former username `@Audit_AIS_Bot`. Rename-pending is closed. Secret names remain exactly `AUDITOR_TELEGRAM_BOT_TOKEN` and `AUDITOR_TELEGRAM_WEBHOOK_SECRET`; `@GoApsnyBot` remains untouched.
- Staff reports Mistral Vibe write-probe PASS: exact 21 bytes, clean deletion, native permission sandbox. Highest available Pro model is `mistral-medium-3.5`; Large is unavailable.
- Alkhas-authorized bounded field exam issued at `briefs/MISTRAL-EXAM.md`: dependency-free migration preflight CLI with deterministic tests, isolated to `feat/mistral-probe`, four-file boundary, no network/secrets/deploy/product mutation, outside critical path.
- No WALL. T1/T3 verdicts are unchanged; Mistral work does not consume or delay their critical-path slots.

## 2026-07-14 21:37 MSK — clerical timestamp correction and artifact check

- The immediately preceding decision/exam entry was appended at 21:37 MSK; its `20:45 MSK` heading is a clerical stale-time label. Per append-only policy the prior heading was not rewritten.
- Fresh artifact scan confirms the final bot username, fixed T1 decisions, test-environment request, and bounded Mistral brief are present. No secret value appears in the files; only environment variable names are recorded.
- No WALL. No product worktree, external project, deployment, webhook, or secret was changed by SOL.

## 2026-07-15 00:41 MSK — SOL — isolated test env accepted; remote apply held

- Staff created `feat/pwa-public/.env.test.local`: 589 bytes, mode `0600`. Key names only were verified: test URL, anon key, service-role key, and project ref. Values were not read into chat/log and remain untracked.
- **HOLD:** do not apply migrations/seeds yet. T1 remains fully uncommitted at base HEAD `97af435`; there is no deterministic place/photo fixture runner; current smoke ignores `.env.test.local`/`TEST_SUPABASE_*` and still treats absent positive cases as PASS.
- Exact pre-apply contract and later apply order issued at `briefs/T1-TESTDB-GATE-2026-07-15.md`. T1 must provide a pushed immutable fixture-backed harness and close the prior UI/a11y decisions before SOL changes HOLD to GO.
- Security seam reiterated: baseline profile default is still `tester`; no OTP user may be created on the test project before T2's accepted `public_user` default migration.
- No WALL. Test project creation/env setup is accepted preparation, not schema-apply authorization.

## 2026-07-15 00:45 MSK — DB-gate sequencing clarification

- The database HOLD does not require T1 to finish all UI/a11y fixes first. To preserve parallel progress, T1 may push a dedicated migration + deterministic fixture + non-vacuous smoke block for immediate SOL DB re-review while continuing unrelated UI work.
- Staff apply remains bound to the accepted database/harness SHA and only proceeds after confirming those relevant paths have no later dirty delta. G1 itself remains blocked until the separate UI/a11y fixes and physical/visual gates pass.

## 2026-07-15 00:42 MSK — clerical timestamp correction

- The immediately preceding sequencing clarification was appended at 00:42 MSK; its `00:45 MSK` heading is a clerical future-time label. Per append-only policy the earlier heading was not rewritten. The sequencing content remains binding.

## 2026-07-15 01:14 MSK — field shells recovered; Phase A fixes active

- Staff reports both Cursor shells were restarted after `WritableIterable is closed`; work resumed from disk and field files survived. This is a shell-recovery event, not a product/test acceptance.
- Per Fable/Alkhas operating decision, `git add`/`commit`/`push` walls are removed for each executor only inside its own task worktree/branch. Force-push, cross-worktree writes, deploy, secrets, webhook, and `main` merge remain unauthorized.
- Read-only T1 snapshot: branch `feat/pwa-public`, local HEAD `1ef8a4a` (`feat(t1): anon RLS migrations and contract test harness`), ahead of `origin/main` by one; additional review fixes remain dirty/untracked. `scripts/smoke-public.mjs` has fresh 01:11 activity. Final three-block pushed tip/SHA is still pending.
- Read-only T3 snapshot: branch `feat/tg-auditors`, local HEAD `eb99de9` (`feat(tg-auditors): add bot session tables and atomic publish RPC`), ahead of `origin/main` by one; migration/runtime/report work remains dirty/untracked. Staff reports the active suite at 49 passed / 0 failed; SOL has not independently rerun it against a final SHA.
- `.env.test.local` remains excluded from field edits by instruction. No migration/seed apply is authorized while the T1 DB gate is HOLD.
- No WALL is open: both executors are active after recovery. SOL waits for pushed branch tips and exact SHAs, then performs immutable re-review; local intermediate commits do not open G1/G2 gates.

## 2026-07-15 04:58 MSK — arbiter directive accepted: six parallel field lanes

- SOL read the full directive `/Users/alkhas.abaza/Obsidian/wiki/06-AI-TECH/goapsny-sprint-staff-directive-2026-07-15.md` and accepts the corrected role map v1.1: Kimi and Z are active executors. Unused model windows are now scheduled in parallel; this does not broaden deploy/apply/merge authority or move G1/G2 arbitration away from Alkhas.
- Six field lanes are issued/continued:
  1. Composer №1 / T1: existing `briefs/T1.md`, `T1-REVIEW-2026-07-14.md`, and `T1-TESTDB-GATE-2026-07-15.md`.
  2. Composer №2 / T3: existing `briefs/T3.md` and `T3-REREVIEW-2026-07-14.md`.
  3. Z (`GLM-5.2`, desktop ZCode) / T2 roles-RLS: new `briefs/T2-Z-RLS.md`; separate branch `feat/t2-roles-rls`; migration/test preparation only, DB apply remains the Alkhas password gate.
  4. Kimi K2.7 Code / independent test belt: new `briefs/KIMI-TEST-BELT.md`; separate branch `feat/test-belt`; pinned-SHA T1/T3 regression tests first, minor fixes only after explicit non-overlap assignment.
  5. Vibe / Mistral Medium 3.5: `briefs/MISTRAL-EXAM.md` replaced by real field task 1, an idempotent G1 test seed utility in `feat/mistral-probe`. The discarded synthetic migration-linter task is explicitly superseded. No live apply before staff/SOL gate.
  6. Antigravity: `briefs/ANTIGRAVITY.md` replaced with a permanent queue—mobile G1 QA and cmux official-source research start immediately; adversarial T2 re-audit triggers on Z's pushed SHA; completion carries a mandatory next-brief signal.
- Ownership collision resolved without weakening the directive: T1 already owns the HIGH anon read policies for published photo metadata/private Storage. Z must pin and test that dependency against T1's SHA and owns the remaining role/profile/public-user Storage/atomic-RPC migrations; it must not create duplicate policies or migration versions.
- Fresh read-only tips now exist: T1 pushed `fc2b7dd` on `origin/feat/pwa-public` (three implementation blocks plus report; local `T1-REPORT.md` has a later dirty delta), and T3 pushed clean `faa7993` on `origin/feat/tg-auditors`. SOL re-review pins these immutable SHAs; the dirty T1 report is not evidence until committed.
- Critical path rule: T1/T3 immutable re-review and T1 DB HOLD decision remain first SOL work. Z/Kimi/Vibe/Antigravity proceed in their own worktrees/contours and cannot block G1. One writer per worktree remains binding.
- No WALL. No DB migration/seed apply, Vercel deploy, Supabase secret change, auditor webhook, PR, or `main` merge is authorized by this roster expansion.
