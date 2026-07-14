# GoApsny sprint object contract

Status: **APPROVED FOR FIELD — ARBITER DECISION APPLIED**
Approved by: Alkhas (product decision), recorded by SOL
Date: 2026-07-14
Applies to: T1–T4, worktrees `feat/pwa-public` and `feat/tg-auditors`

This is the binding sprint seam between the public PWA and Telegram auditor flow. Existing migrations are immutable; database changes are new additive migrations only. This document authorizes no deploy, secret change, webhook registration, or merge to `main`.

## 1. Final product decision

This is a decision, not an open fork:

1. Anyone can open and browse the map without registration.
2. Email OTP appears only when a visitor chooses to add an object: email → six-digit code → authenticated session.
3. A basic authenticated user submits one preliminary **gray** pin: required facade photo, category, name, and map location.
4. The gray pin is `published` immediately and is visible on the public map without coordinator approval. This is sleeping moderation.
5. The contributor cannot edit the object after submission; their role ends there.
6. A community auditor verifies the same gray object and changes its accessibility verdict to `green`, `yellow`, or `red`, adding audit facts. Auditors may also add and edit verified objects directly.
7. A coordinator administers the contour and can hide/restore objects. Coordinator action is not required for normal publication.

Precedence: direct arbiter decision → product decisions dated 2026-07-14 → `DESIGN.md`/`.ui-craft/spec.md` → this contract → older backend documents. If an executor needs a different field, enum, role, or transition, stop for SOL/Alkhas.

## 2. Canonical persisted object

One object is a row in `public.places`; media is indexed by `public.photos`. Database names stay snake_case.

| Field | Sprint contract |
| --- | --- |
| `id` | UUID generated once; first photo-path segment. |
| `name` | Required, trimmed, non-empty. |
| `category` | Required FK to active `categories.slug`; approved mapping below. |
| `lat`, `lng` | Required coordinates selected by map/location UI, never typed as database fields. |
| `status` | `gray` for a preliminary public submission; `green`, `yellow`, or `red` after auditor verification. Auditor final choice excludes `gray`. |
| audit fields | `steps_count`, `step_height_cm`, `ramp_type`, `door_width_cm`, `entrance_notes`, `toilet_exists`, `toilet_accessible`, `parking`, `comment`; nullable/default-safe on gray, populated by the auditor where known. |
| `osm_tags` | Server/trigger-owned; clients do not overwrite it. |
| `details` | Public-safe JSON v1 described below. |
| `moderation_status` | Normal path is `published`, including gray submissions. `hidden` is a coordinator safety action. `pending` remains a dormant compatibility state, never the default sprint workflow. |
| `source` | `public` for email contributor; `operator` for Telegram auditor/coordinator. |
| `created_by` | Authenticated profile UUID resolved server-side; never accepted from client input. |
| timestamps | Server-owned `created_at`, `updated_at`. |

Every column on a published row is public. Private coordination and bot state never go in `places`.

### `details` v1

Gray submission:

```json
{
  "schema_version": 1
}
```

Verified object may add:

```json
{
  "schema_version": 1,
  "address": "ул. Лакоба, 12",
  "elevator": "yes",
  "verification": {
    "verified_at": "2026-07-14T12:00:00.000Z",
    "verified_by_role": "auditor"
  },
  "external_links": {
    "yandex": "https://...",
    "google": "https://...",
    "apple": "https://...",
    "osm": "https://..."
  }
}
```

- `schema_version` is required and equals `1`.
- `verification` is absent on gray and written when the auditor saves a colored verdict.
- `address` is optional trimmed text; `elevator` is `yes`, `no`, or `unknown`.
- External links are optional `https://` URLs; unknown existing keys are preserved on edit but not invented.

## 3. Photos

The Storage bucket stays private.

- One facade photo is required for public submission and auditor creation.
- Exact required path: `{place_id}/facade.jpg`; `photos.kind='facade'`.
- Optional auditor paths/kinds: `steps`, `ramp`, `toilet`, `interior`, each as `{place_id}/{kind}.jpg`.
- `uploaded_by` is resolved from the authenticated user/auditor profile.
- Public readers receive a short-lived signed URL only when the photo row belongs to a `published` place, including gray.
- Photo failure produces a partial card state; map/text remain usable.

## 4. Category mapping

| DB slug | Russian UI label |
| --- | --- |
| `shops` | Магазины |
| `food` | Еда и напитки |
| `public_transport` | Транспорт |
| `tourism` | Достопримечательности |
| `leisure` | Культура |
| `accommodation` | Гостиницы |
| `education` | Обучение |
| `government` | Госучреждения |
| `health` | Здоровье |
| `bank_post` | Финансы |
| `sport` | Спорт |
| `toilets` | Туалеты |

Add `toilets` and deactivate `other` for new selection by additive migration. Existing `other` rows remain readable.

## 5. Roles and transitions

| Product role | `profiles.role` |
| --- | --- |
| Basic email contributor | `public_user` |
| Auditor | `tester` or `operator` |
| Coordinator | `admin` or `owner` |
| Denied | `banned` or unknown Telegram identity |

Normal transitions:

```text
anonymous read: published gray/green/yellow/red
email OTP public_user: create → gray + published + source=public → role ends
Telegram auditor: gray published → green/yellow/red published
Telegram auditor: create/edit verified green/yellow/red published
coordinator: published ↔ hidden
```

No automatic elevation is permitted. The baseline schema currently has `profiles.role default 'tester'`, while `current_user_can_collect()` includes `tester`; this is a confirmed privilege-escalation blocker for email signup. T2 must add an immutable forward migration containing the exact safety effect:

```sql
alter table public.profiles alter column role set default 'public_user';
```

New email users must be created as `public_user`. Do not bulk-demote existing `tester` rows because legitimate Telegram auditors may already use that role; backfill only identities proven to be basic email users. Telegram authorization continues to derive elevated roles from the verified profile mapping.

## 6. Public-user submission boundary — T2

The browser must not receive direct broad table-write policies. T2 owns an additive security-definer RPC such as `submit_public_place` with the following contract:

- caller must be authenticated and mapped to active `public_user`;
- input is only client-generated `place_id`, trimmed `name`, active `category`, `lat`, `lng`, and owned facade `storage_path`;
- server hardcodes `status='gray'`, `moderation_status='published'`, `source='public'`, `created_by=auth.uid()`, and `details={"schema_version":1}`;
- server validates that the private Storage object is owned by the caller and is exactly `{place_id}/facade.jpg`;
- place and photo index are created atomically or fail without a public half-object;
- execute is granted only to `authenticated` and revoked from `public`/`anon`;
- the user cannot update/delete the submitted place or write audit fields/status/moderation/roles.

Every new or replaced `SECURITY DEFINER` function in this sprint must use `SET search_path = ''` and schema-qualify every referenced object/function (`public.*`, `auth.uid()`, `storage.objects`, as applicable). Revoke default execute before granting the minimum role. The older `SET search_path = public` functions are recorded legacy debt; do not copy that pattern or expand T2 into an unrelated rewrite unless the new flow directly replaces one.

The existing Storage insert policy is collector-only and therefore does not authorize `public_user`. T2 must add explicit policies for authenticated `public_user`:

- `INSERT`: bucket `place-photos`, `owner=auth.uid()`, exact fresh `{uuid}/facade.jpg` path only;
- `DELETE`: same owner/bucket/facade shape and only while no `public.photos.storage_path` references the object;
- no `UPDATE`, list-all, extra-photo kind, or cross-owner access.

Bucket remains private. RPC revalidates object ownership/path before indexing it.

## 7. Public read boundary — T1

- `anon` reads active categories, accessibility statuses, and only `places.moderation_status='published'`.
- Published includes gray and verified colors.
- Baseline `photos_read_by_published_place` is `TO authenticated` only. T1 must add a separate `FOR SELECT TO anon` policy on `public.photos` whose sole condition is that the parent place is published.
- Baseline `place_photos_storage_read_authenticated` is also authenticated-only. T1 must add narrow `FOR SELECT TO anon` access on `storage.objects` for bucket `place-photos` only when `storage.objects.name=public.photos.storage_path` and the parent place is published. This is the permission used to create short-lived signed URLs; the bucket itself stays private.
- `anon` has no writes; profiles, bot state, AI/karma tables stay unavailable.
- Public queries use explicit field lists, never `select('*')`.
- Existing authenticated/admin policies stay intact; unsafe RPC execute grants remain revoked.

## 8. Telegram boundary — T3/T4

- T3 runs on the separate BotFather auditor bot **`@Audit_AIS_Bot`**. `@GoApsnyBot` is the product Mini App bot and must never receive the auditor webhook or auditor token/configuration.
- Shared Supabase project secrets must use collision-proof names: `AUDITOR_TELEGRAM_BOT_TOKEN` and `AUDITOR_TELEGRAM_WEBHOOK_SECRET`. `auditor-bot` reads both only from environment and has no literal/default/fallback to `TELEGRAM_BOT_TOKEN`.
- The username is public identity context only; code must not depend on a hard-coded username. Token creation, secret installation, deploy, and webhook registration remain explicit Alkhas gates.
- Edge Function validates `X-Telegram-Bot-Api-Secret-Token` before processing and deduplicates `update_id`.
- `tester`/`operator` and `admin`/`owner` can audit; unknown/`public_user`/`banned` cannot.
- Auditor may claim/update a published gray object to a colored verified state and may add/edit verified published objects.
- Auditor edits preserve IDs, creator/source history where appropriate, unknown `details` keys, and public visibility.
- Coordinator `admin`/`owner` can inspect activity, edit through the trusted audit path, hide, and restore. No approval queue is required.
- Service-role and bot token remain server-only.
- If T3/T4 introduce or replace a database `SECURITY DEFINER` function, it follows the same empty-search-path and fully-qualified-reference rule. T3 does not own the T1/T2 policy fixes.

## 9. Contract gates

Acceptance is executable evidence:

1. Anonymous smoke: published gray and colored rows plus their `public.photos` metadata are visible; hidden/pending invisible; anon writes denied.
2. Role smoke: a newly created email identity receives `profiles.role='public_user'` and `current_user_can_collect()=false`; existing authorized Telegram tester remains unchanged.
3. Public-user smoke: OTP session with `public_user` can upload only its fresh facade path and submit exactly one valid gray object through the hardened RPC; cannot upload extra kinds, choose colored status, edit it, elevate role, or write tables directly.
4. Storage smoke: published gray/colored facade can be signed by anon; hidden/pending cannot; failed upload/RPC can clean only the caller's unreferenced facade and leaves no visible half-object.
5. Function-definition smoke inspects the new RPC and proves empty `search_path`, qualified references, and minimum execute grants.
6. Bot tests: unauthorized denied; duplicate update idempotent; auditor verifies a gray object to colored while it stays published; auditor can create/edit a verified published object.
7. Coordinator tests: only admin/owner can hide/restore and access administrative overview.
8. G2 trace: public user submits gray → anonymous PWA sees gray → auditor verifies the same ID → anonymous PWA sees the colored verdict. Coordinator is not on the visibility path.
9. Secret scan and `git diff --check` are clean.

Out of scope: active pre-publication approval, district/group schema, karma, AI autofill, external export, Rev A, cmux, iPad console, deploy/secrets/webhook registration, and merge to `main`.
