# Antigravity — permanent external queue, 2026-07-15

Owner: Antigravity through external chat/staging
Role: full-time external auditor/researcher; read-only to repositories
Priority: continuous parallel queue; never blocks Composer critical path by waiting
Conductor: SOL; product decisions and gates remain Alkhas.

## Standing rules

- No repository writes, credentials, database apply, deploy, webhook, external production action, PR, merge, or product arbitration.
- Findings require exact local file/SHA/line evidence. Research requires current official primary sources, direct links, and access date.
- Separate verified fact, inference/recommendation, and unresolved question.
- A green executor report is not evidence; trace the implementation and acceptance path.
- Queue must not become empty. Package 1 and 2 start immediately in parallel/order available; package 3 starts as soon as Z supplies a pushed SHA. On completing the last available package, notify HQ/SOL in the same message so the next package is issued without idle time.

## Package 1 — G1 mobile QA scenarios (start now)

Produce a concise executable manual/automation-ready matrix for the public PWA and later OTP contribution flow at the candidate test URL `https://pwa-test-14-07.vercel.app` (availability/deploy not yet claimed).

Cover at minimum:

- iOS Safari and Android Chrome; 360×740, 390×844, tablet portrait/landscape;
- anonymous first visit, repeat visit, welcome persistence, empty/loading/error/populated map;
- Russian-only UI with no dead language switch;
- geolocation permission only after explicit action: allow/deny/timeout/retry;
- keyboard/switch-control focus order, pin activation, menu/filter/place-sheet traps and focus return;
- pinch zoom enabled, 200% text zoom/reflow, 44×44 targets, status word+color, purple ramp text;
- gray/published and colored facade cards, missing-photo partial state, hidden/pending absence;
- offline/network-loss honesty, service worker update/reload, manifest/install path including iOS Add to Home Screen;
- placeholder/external link safety, tile attribution, console/network errors;
- later email OTP: map remains public, wrong/expired code, resend cooldown, session restore/sign-out, one gray submission, no post-submit edit.

For each scenario provide: ID, precondition/fixture, device/browser, actions, expected observable result, evidence to capture, severity if failed, automation feasibility. Distinguish G1 must-pass from later/nonblocking. Do not invent canonical external URLs or claim a device run occurred.

Output: `goapsny-antigravity-mobile-qa-2026-07-15.md` through HQ chat/staging.

## Package 2 — cmux research checkpoint (start now; research only)

Research the current cmux product using official documentation/repository/releases only:

1. socket/API surface: exact transport, commands/events, authentication/trust boundary, ability to enumerate workspaces/panes, read status, create/focus/send input, and observability hooks;
2. iOS/iPad app: whether an official app exists, exact capabilities, remote connection model, limitations, and release status;
3. Attention Queue: exact feature behavior, trigger sources, persistence, routing, APIs/hooks, and whether it can carry B0 wall/gate signals;
4. installation/runtime requirements, licensing, security model, headless/automation boundary, and version/date checked;
5. factual comparison to the sprint's needs only: observation, permission-wall detection, safe message delivery, and human arbitration. Do not recommend a migration or reopen Rev A during the sprint.

Return a source table and a verdict per required capability: `verified`, `partial`, `absent`, or `unknown`. Highlight any claim from prior discussions that official evidence contradicts.

Output: `cmux-research-checkpoint-antigravity-2026-07-15.md` through HQ chat/staging.

## Package 3 — T2-Z post-fix adversarial audit (wait only for SHA)

Trigger: staff supplies the exact pushed `feat/t2-roles-rls` SHA and `T2-Z-REPORT.md` path. Audit that immutable artifact, not a moving worktree.

Trace:

- new email profile creation/default role cannot become `tester` or trust metadata;
- legitimate Telegram auditor roles are not demoted or blocked;
- `public_user` facade Storage insert/delete is exact-owner/exact-path/unreferenced only;
- `submit_public_place` caller identity, category/coordinate/path/object checks;
- atomic place+photo visibility and failure cleanup;
- `SECURITY DEFINER`, empty search path, qualification, ownership and execute grants;
- anon published photo/Storage reads interoperate with T1 without duplicate policy/migration ownership;
- direct table writes, role/status/source/creator forgery, cross-owner paths, extra kinds, replay/UUID reuse, and enumeration remain denied;
- tests are non-vacuous and any unrun live DB behavior is labeled prerequisite.

Return findings ordered `BLOCKER/HIGH/MEDIUM/LOW`, each with file/line evidence, exploit/failure path, smallest correction, and whether it blocks the DB apply gate. “No finding” requires a checklist trace of every item above.

Output: `goapsny-antigravity-t2-rereview-2026-07-15.md` through HQ chat/staging.

## Continuity signal

Every completion message ends with:

```text
ANTIGRAVITY QUEUE: completed <package>; active <package or none>; waiting <dependency or none>; NEXT BRIEF NEEDED <yes/no>.
```

If `NEXT BRIEF NEEDED yes`, HQ signals SOL immediately. Antigravity must not invent product work while waiting; SOL keeps a follow-on bounded package ready.
