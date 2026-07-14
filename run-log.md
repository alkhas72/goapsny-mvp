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
