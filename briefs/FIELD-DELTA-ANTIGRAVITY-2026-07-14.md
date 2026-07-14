# Field delta — Antigravity cross-audit

Status: **BINDING SECURITY CORRECTION**
Issued by: SOL after staff verification against `0001_initial_schema.sql`
Date: 2026-07-14

Source reports:

- `/Users/alkhas.abaza/Obsidian/wiki/from-gemini/goapsny-antigravity-crossaudit-2026-07-14.md`
- `/Users/alkhas.abaza/Obsidian/wiki/from-gemini/goapsny-antigravity-research-2026-07-14.md`

## Confirmed facts

1. `profiles.role` defaults to `tester` at baseline line 19; `current_user_can_collect()` includes `tester` at line 310. Enabling email signup without a forward migration would elevate every new email profile.
2. `photos_read_by_published_place` is `TO authenticated`; anon cannot read photo metadata.
3. `place_photos_storage_read_authenticated` and the collector-only insert policy exclude the required anonymous signed-read/public-user upload paths.
4. Existing security-definer functions use `SET search_path = public`; this pattern must not be copied into new sprint RPCs.

## Active T1 — immediate delta

Owner remains T1:

- add narrow anon SELECT on `public.photos` for published parents;
- add narrow anon SELECT on private `place-photos` Storage objects backed by those photo rows/published parents, enabling short-lived signed URLs;
- test published gray/colored success and hidden/pending denial for both metadata and signing;
- do not make the bucket public and do not grant anon writes/list-all.

This is inside T1's existing public-read migration ownership. Rebase/restart is not required; incorporate before the first RLS green block.

## Active T3 — immediate invariant

T3 owns none of the T1/T2 fixes. Continue current work. If T3 adds/replaces a database security-definer function, use empty `search_path`, fully qualified references, and minimum grants. The current server-only session tables do not by themselves require such a function.

## Queued T2 — blocker before start

T2 must start with:

```sql
alter table public.profiles alter column role set default 'public_user';
```

Then prove fresh email profile is `public_user` and cannot collect; do not bulk-demote legitimate Telegram testers. T2 also owns explicit public-user facade INSERT/unreferenced-owner DELETE Storage policies and the hardened `submit_public_place` RPC with `SET search_path = ''`.

## Mistral decision

Research identifies the CLI as Mistral Vibe and reports terminal compatibility. It is **not admitted to the field**: no install, key/subscription setup, model trial, or task assignment until a separate Alkhas decision.
