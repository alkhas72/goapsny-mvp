# Session and tab name audit — GoApsny orchestra

Audited by: SOL
Audited at: 2026-07-15 18:02 MSK
Sources: native Codex rollout metadata, Supacode socket/CLI help, `~/.supacode/layouts.json`, git worktree state

## Binding standard

- Agent work: `Surface-Model — task`.
- Non-agent technical work: `TECH-<surface> — task`.
- A desired name is not reported as applied until the surface confirms it.

## Active conductor and sprint lanes

| Contour / immutable ID | Verified current name | Required canonical name | State | Disposition |
|---|---|---|---|---|
| Current Codex rollout `019f663a-2513-7263-8e94-e56a51241752` | UI title unavailable; rollout metadata gives only originator `Codex Desktop` | `Codex Desktop-GPT-5.6 SOL — GoApsny recovery and handoff` | ACTIVE writer; started 17:41:54 MSK | Rename API is not exposed to this process; HQ/UI rename requested. |
| Supacode conductor tab `BAAF84B1-CE04-4276-875A-7FC2BB7FD124` | `goapsny-sprint`; agent activity `idle` | `Supacode-Codex GPT-5.6 SOL — GoApsny conductor (old panel)` | IDLE; possible old fork | Must be retired or explicitly resumed only after reading the handoff passport; HQ/UI rename requested. |
| T1 Supacode tab `A90FA2A0-1451-4529-B015-EA6E956F56BE`; Cursor chat `0f612cc8-592a-43da-b3e1-7b5316696270` | `PSNY Composer Agent`; activity `idle` | `Supacode-Composer 2.5 — T1 public PWA corrections` | RESUMABLE, idle after `fc2b7dd` review | HQ/UI rename requested before correction RESUME. Do not start a second writer. |
| T3 Supacode tab `FAD271A2-71E5-47A3-95D1-8D535046B5B6`; Cursor chat `5e0e4d3c-f9ed-4cf6-8dec-60d986d80b79` | `GoApsny T3 Sprint`; activity `idle` | `Supacode-Composer 2.5 — T3 auditor-bot corrections` | RESUMABLE, idle after `faa7993` review | HQ/UI rename requested before correction RESUME. Do not start a second writer. |

## Persisted retired and technical tabs

| Tab / current title | Required canonical name | State / action |
|---|---|---|
| Mistral probe `4FBFA360-3C9E-4019-A1F3-2291BB7AB4CB` / `Vibe` | `Supacode-Vibe Medium 3.5 — RETIRED Mistral exam` | Retired by Arbiter; do not resume. Rename/archive is HQ action. |
| AgY sandbox probe `6A27D7A9-3331-42FC-8345-9D023E393E83` / `Git Project Explainer` | `TECH-Supacode — Antigravity sandbox probe` | Historical technical tab; rename/archive is HQ action. |
| Cursor transport smoke `240F1341-03C2-459A-9EF7-5720DA380B3F` / `agy` | `TECH-Supacode — Cursor transport smoke` | Historical technical tab; rename/archive is HQ action. |
| Supacode smoke `C0836D8F-19DC-44B2-8382-EE5EDE3992A0` / `Review project README and git status` | `TECH-Supacode — permission and surface smoke` | Historical technical tab, recorded `awaitingInput`; HQ should close/archive after rejecting stale prompt. |
| Main-repo mirror `05B8DB7D-EEAF-43D6-8305-DFC19923899D` / path title | `TECH-Supacode — T1 worktree mirror` | Historical technical tab; rename/archive is HQ action. |

`feat/exp002-lab` is a separate historical experiment rather than the current GoApsny sprint orchestra; it was observed but not renamed by this task.

## Rename-channel result

- Bundled Supacode CLI was reached through the live Unix socket. Its `tab` and `surface` command sets expose list/focus/new/close/split, but no rename operation.
- Computer Use access to Supacode is not approved in the current Codex contour, so UI rename could not be verified or performed.
- Direct editing of `~/.supacode/layouts.json` was intentionally not used: it is live application state, not a supported rename channel, and could be overwritten or fork the UI state.
- Therefore the audit is complete but the rename operation is **WAITING ON HQ/UI**. The exact target names above are the action packet. No session is falsely reported as renamed.
