# Z player A — unified shell on Leaflet

Role: sole product writer for branch `feat/epoch3-shell-z`. You are not the conductor.

## Canon

- Base: `456a0130fb2d996211e2d02af2b784a92a1fc99d`.
- Read `.ui-craft/brief.md`, `.ui-craft/tokens.md`, and `DESIGN.md` before editing UI.
- Product face: existing June `TelegramApp` composition.
- `PublicMap` is a logic source, not a second shell.
- Preserve existing visual language. Do not redesign, invent a new navigation, or create a second Mini App.
- One shell, one Leaflet map component, one real Supabase client/data path, three permission modes: public / mapper / administrator.
- Email OTP and Telegram auth are two entries into one DB-backed session/role model.
- Production, main, secrets and external publication are forbidden.

## Objective — first integrated Leaflet slice

Use TDD. First write a concise implementation plan and tests. Then implement the smallest coherent slice that:

1. makes the June shell the common application composition;
2. renders the public mode inside it without the separate `PublicMap` navigation shell;
3. routes real place reads through the shared Supabase client instead of the mapper mock path;
4. preserves the 8-digit OTP and add-gray-location flow;
5. keeps mapper/admin capabilities role-gated from DB state;
6. leaves MapLibre untouched in this branch.

Required evidence: focused tests, complete test suite, build, exact changed files, remaining gap to parity. Commit and push only this branch. Do not merge anywhere.

Timebox: first factual checkpoint after 90 minutes; hard 4 hours to integrated evidence. If blocked, record the exact blocker and continue on an independent testable sub-slice.

First response: `ACK Z-PLAYER-A SHELL feat/epoch3-shell-z`.

