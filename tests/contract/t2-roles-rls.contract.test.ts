/**
 * T2-Z contract / definition tests.
 *
 * These are deterministic static assertions over the migration SQL source and
 * the immutable baseline schema. They do NOT require a live database and do NOT
 * execute the migrations. Per `briefs/T2-Z-RLS.md` §"Required tests":
 *
 *   "If local Supabase/Postgres is unavailable, build deterministic
 *    definition/contract tests and record the live DB suite as a prerequisite.
 *    Do not label unexecuted database behavior PASS."
 *
 * So these tests prove the DEFINITIONS / CONTRACTS (what the SQL says), not the
 * runtime behavior (which requires a live DB and is recorded as a prerequisite
 * in T2-Z-REPORT.md). Every assertion below maps to
 * one of the 12 required areas in the brief.
 *
 * Convention note: 0001_initial_schema.sql is IMMUTABLE (we assert against its
 * text; we never edit it). The two T2 migrations are additive and own the new
 * behavior.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const migrationsDir = resolve(repoRoot, 'supabase', 'migrations');

function readMigration(name: string): string {
  return readFileSync(resolve(migrationsDir, name), 'utf8');
}

function listMigrations(): string[] {
  return readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
}

const baseline = readMigration('0001_initial_schema.sql');
const migrationA = readMigration('20260715100000_profiles_public_user_default.sql');
const migrationB = readMigration('20260715120000_submit_public_place_rls_rpc.sql');
const migrationCName = '20260715123000_public_user_orphan_storage_read.sql';
const migrationC = existsSync(resolve(migrationsDir, migrationCName))
  ? readMigration(migrationCName)
  : '';
const t2Source = [migrationA, migrationB, migrationC].join('\n');

// Fold to a single space + lower-case for resilient substring matching of SQL
// constructs where incidental whitespace/casing must not break the assertion.
const norm = (s: string): string => s.replace(/\s+/g, ' ').toLowerCase();
const stripLineComments = (s: string): string =>
  s.replace(/^\s*--.*$/gm, '');

function extractFunctionSql(source: string, qualifiedName: string): string {
  const start = source.toLowerCase().indexOf(
    `create or replace function ${qualifiedName.toLowerCase()}(`,
  );
  expect(start, `${qualifiedName} definition must exist`).toBeGreaterThanOrEqual(0);
  const end = source.indexOf('\n$$;', start);
  expect(end, `${qualifiedName} definition must close with $$;`).toBeGreaterThan(start);
  return stripLineComments(source.slice(start, end + 4));
}

const executableA = stripLineComments(migrationA);
const executableB = stripLineComments(migrationB);
const t2Executable = [executableA, executableB].join('\n');
const triggerSql = extractFunctionSql(
  migrationA,
  'public.tg_create_profile_on_auth_user',
);
const rpcSql = extractFunctionSql(migrationB, 'public.submit_public_place');

describe('T2-Z migration inventory (required area #11)', () => {
  it('contains the baseline plus the two additive T2 migrations', () => {
    expect(listMigrations()).toEqual(expect.arrayContaining([
      '0001_initial_schema.sql',
      '20260715100000_profiles_public_user_default.sql',
      '20260715120000_submit_public_place_rls_rpc.sql',
    ]));
  });

  it('T2 timestamps do not collide with T1/T3 reserved filenames', () => {
    // T1 owns 20260714141000_public_read_published.sql and
    // 20260714142000_align_active_categories.sql on feat/pwa-public; T3 owns
    // auditor-bot tables/RPC. T3 may also use a later 20260715 timestamp, so
    // assert the two exact T2 names plus global timestamp uniqueness.
    expect(listMigrations()).toEqual(expect.arrayContaining([
      '20260715100000_profiles_public_user_default.sql',
      '20260715120000_submit_public_place_rls_rpc.sql',
    ]));
    // Integration-safe: T1's files may later coexist in this directory, but
    // no two migration files may share a timestamp.
    const allTimestamps = listMigrations().map((f) => f.split('_')[0]);
    expect(new Set(allTimestamps).size).toBe(allTimestamps.length);
  });
});

describe('Block A — safe profile default (required area #1, #2)', () => {
  it('applies the exact forward safety effect: role default public_user', () => {
    // Exact literal required by OBJECT-CONTRACT §5 and FIELD-DELTA "Queued T2".
    expect(migrationA).toContain(
      "alter table public.profiles alter column role set default 'public_user'",
    );
  });

  it('does NOT relax the role CHECK enum (escalation surface stays closed)', () => {
    // T2 must not widen the allowed role values; only change the default.
    expect(t2Source).not.toMatch(/alter table public\.profiles.*drop constraint/);
    expect(norm(t2Source)).not.toContain('check (role in');
  });

  it('baseline 0001 default remains tester only in 0001 (T2 changes the default, not history)', () => {
    // The immutable baseline records the pre-fix state; T2 forward-migrates it.
    expect(baseline).toContain("role text not null default 'tester'");
  });

  it('block A creates the missing auth.users -> profiles trigger', () => {
    // Baseline has no such trigger; A must add it so a native email identity
    // gets exactly one profile row with role='public_user'.
    expect(baseline).not.toMatch(/on_auth_user_created/i);
    expect(norm(migrationA)).toContain('create trigger on_auth_user_created');
    expect(norm(migrationA)).toContain('after insert on auth.users');
    expect(norm(migrationA)).toContain(
      'for each row execute function public.tg_create_profile_on_auth_user()',
    );
  });

  it('the trigger inserts exactly role=public_user (fresh email identity is public_user)', () => {
    expect(norm(migrationA)).toContain(
      "insert into public.profiles (id, role) values (new.id, 'public_user')",
    );
  });

  it('current_user_can_collect() (baseline) excludes public_user', () => {
    // area #2: fresh email identity -> public_user -> cannot collect.
    // The helper lives in immutable 0001; we assert its contract is unchanged
    // and does not include 'public_user'.
    const functionSql = extractFunctionSql(
      baseline,
      'public.current_user_can_collect',
    );
    expect(norm(functionSql)).toContain("in ('owner', 'admin', 'operator', 'tester')");
    expect(norm(functionSql)).not.toContain('public_user');
  });
});

describe('Block A — no blanket demotion / metadata trust (required area #3, #4)', () => {
  it('does NOT blanket-update existing tester rows', () => {
    // brief A.4: legitimate Telegram testers must remain unchanged.
    expect(t2Executable).not.toMatch(/update\s+public\.profiles\s+set\s+role/i);
    expect(norm(t2Executable)).not.toContain('set role =');
  });

  it('trigger function does NOT read user metadata for role or admin fields', () => {
    // A client must not escalate by stuffing metadata at signup.
    expect(triggerSql).not.toMatch(/raw_app_meta_data/i);
    expect(triggerSql).not.toMatch(/raw_user_meta_data/i);
    expect(triggerSql).not.toMatch(/encrypted_password/i);
    expect(triggerSql).not.toMatch(/new\.email_metadata/i);
    // Role is hard-coded, never assigned from new.* / metadata.
    expect(triggerSql).not.toMatch(/role\s*[:=]\s*new\./i);
  });

  it('trigger is ON CONFLICT DO NOTHING so it cannot clobber an elevated profile', () => {
    // Trusted Telegram path may create the profile first with an elevated role;
    // the trigger must not overwrite it.
    expect(norm(migrationA)).toContain('on conflict (id) do nothing');
  });
});

describe('Block B — public-user Storage boundary (required area #5, #6)', () => {
  it('adds a public_user INSERT policy scoped to owned facade path only', () => {
    expect(norm(migrationB)).toContain(
      'create policy place_photos_storage_insert_public_user_facade',
    );
    expect(norm(migrationB)).toContain('for insert to authenticated');
    // owned by caller, public_user role, facade shape only.
    const policy = norm(migrationB).match(
      /create policy place_photos_storage_insert_public_user_facade[\s\S]*?\);/,
    )?.[0];
    expect(policy, 'insert policy block must be present').toBeTruthy();
    expect(policy!).toContain("bucket_id = 'place-photos'");
    expect(policy!).toContain('owner = (select auth.uid())');
    expect(policy!).toContain('select 1 from public.profiles p');
    expect(policy!).toContain('p.id = (select auth.uid())');
    expect(policy!).toContain("p.role = 'public_user'");
    expect(policy!).toContain(
      "name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/facade\\.jpg$'",
    );
  });

  it('INSERT policy rejects extra photo kinds (facade only)', () => {
    const policy = norm(migrationB).match(
      /create policy place_photos_storage_insert_public_user_facade[\s\S]*?\);/,
    )?.[0];
    // Must NOT allow steps/ramp/toilet/interior for the public_user path.
    expect(policy!).not.toMatch(/steps|ramp|toilet|interior/);
  });

  it('does NOT add a public_user Storage UPDATE grant', () => {
    // brief: "No public-user Storage update". The only UPDATE policy T2 touches
    // is the existing owner/admin one, which it hardens to EXCLUDE public_user.
    expect(t2Source).not.toMatch(
      /create policy [\w_]*update[\w_]*\s+on storage\.objects.*public_user/i,
    );
  });

  it('hardens the existing owner-UPDATE policy to exclude public_user', () => {
    expect(norm(migrationB)).toContain(
      'drop policy place_photos_storage_update_owner_or_admin on storage.objects',
    );
    const recreated = norm(migrationB).match(
      /create policy place_photos_storage_update_owner_or_admin[\s\S]*?\);[\s\S]*?\);/,
    )?.[0];
    expect(recreated, 'recreated update policy must be present').toBeTruthy();
    expect(recreated!).toContain("(select public.current_user_role()) <> 'public_user'");
  });

  it('replaces bucket-wide authenticated read with published-or-collector read', () => {
    expect(norm(executableB)).toContain(
      'drop policy place_photos_storage_read_authenticated on storage.objects',
    );
    const readPolicy = norm(executableB).match(
      /create policy place_photos_storage_read_authenticated[\s\S]*?pl\.moderation_status = 'published'[\s\S]*?\);/,
    )?.[0];
    expect(readPolicy, 'narrow authenticated Storage read must exist').toBeTruthy();
    expect(readPolicy!).toContain('public.current_user_can_collect()');
    expect(readPolicy!).toContain('ph.storage_path = storage.objects.name');
    expect(readPolicy!).not.toContain("using (bucket_id = 'place-photos');");
  });

  it('adds a public_user DELETE policy that only removes an UNREFERENCED owned facade', () => {
    // area #6: cleanup rejects referenced / cross-owner objects.
    expect(norm(migrationB)).toContain(
      'create policy place_photos_storage_delete_public_user_unreferenced',
    );
    const del = norm(migrationB).match(
      /create policy place_photos_storage_delete_public_user_unreferenced[\s\S]*?\);/,
    )?.[0];
    expect(del, 'delete policy block must be present').toBeTruthy();
    expect(del!).toContain("bucket_id = 'place-photos'");
    expect(del!).toContain('owner = (select auth.uid())');
    expect(del!).toContain('select 1 from public.profiles p');
    expect(del!).toContain('p.id = (select auth.uid())');
    expect(del!).toContain("p.role = 'public_user'");
    expect(del!).toContain(
      "name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/facade\\.jpg$'",
    );
    // The RLS-safe helper checks all photo rows, including hidden parents that
    // are not visible to the public_user caller.
    expect(del!).toContain(
      'goapsny_private.claim_unreferenced_storage_path(storage.objects.name)',
    );
  });

  it('serializes cleanup in a non-public SECURITY DEFINER helper', () => {
    const helper = extractFunctionSql(
      migrationB,
      'goapsny_private.claim_unreferenced_storage_path',
    );
    expect(norm(helper)).toContain('security definer');
    expect(norm(helper)).toContain("set search_path = ''");
    expect(norm(helper)).toContain(
      'pg_catalog.pg_advisory_xact_lock( pg_catalog.hashtextextended(p_storage_path, 0) )',
    );
    expect(norm(helper)).toContain(
      'return not exists ( select 1 from public.photos ph where ph.storage_path = p_storage_path )',
    );
    expect(norm(executableB)).toContain(
      'alter function goapsny_private.claim_unreferenced_storage_path(text) owner to postgres',
    );
    expect(norm(executableB)).toContain(
      'revoke execute on function goapsny_private.claim_unreferenced_storage_path(text) from public, anon',
    );
    expect(norm(executableB)).toContain(
      'grant execute on function goapsny_private.claim_unreferenced_storage_path(text) to authenticated',
    );
    expect(norm(executableB)).not.toContain(
      'create or replace function public.t2_storage_path_is_unreferenced',
    );
  });

  it('blocks direct place/photo UPDATE by public_user while preserving collectors', () => {
    for (const [policyName, table, ownerColumn] of [
      ['places_update_admin_or_author', 'public.places', 'created_by'],
      ['photos_update_admin_or_owner', 'public.photos', 'uploaded_by'],
    ] as const) {
      expect(norm(executableB)).toContain(`drop policy ${policyName} on ${table}`);
      const policy = norm(executableB).match(
        new RegExp(`create policy ${policyName}[\\s\\S]*?with check \\([\\s\\S]*?\\);`),
      )?.[0];
      expect(policy, `${policyName} replacement must exist`).toBeTruthy();
      expect(policy!).toContain(`${ownerColumn} = (select auth.uid())`);
      expect(policy!).toContain('public.current_user_can_collect()');
    }
  });

  it('keeps the bucket private (no public bucket mutation in T2)', () => {
    expect(t2Source).not.toMatch(/update storage\.buckets[\s\S]*public\s*=\s*true/i);
    expect(t2Source).not.toMatch(
      /insert into storage\.buckets[\s\S]*true/i,
    );
  });
});

describe('Block B follow-up — Storage API orphan cleanup regression', () => {
  it('adds only the narrow SELECT visibility required to delete an owned orphan facade', () => {
    expect(listMigrations()).toContain(migrationCName);
    const policy = norm(migrationC).match(
      /create policy place_photos_storage_read_public_user_unreferenced_facade[\s\S]*?\);/,
    )?.[0];
    expect(policy, 'orphan facade SELECT policy must exist').toBeTruthy();
    expect(policy!).toContain('for select to authenticated');
    expect(policy!).toContain("bucket_id = 'place-photos'");
    expect(policy!).toContain('owner = (select auth.uid())');
    expect(policy!).toContain('select 1 from public.profiles p');
    expect(policy!).toContain('p.id = (select auth.uid())');
    expect(policy!).toContain("p.role = 'public_user'");
    expect(policy!).toContain(
      "name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/facade\\.jpg$'",
    );
    expect(policy!).toContain(
      'goapsny_private.claim_unreferenced_storage_path(storage.objects.name)',
    );
  });

  it('does not widen Storage writes or replace existing policies', () => {
    const executableC = norm(stripLineComments(migrationC));
    expect(executableC).not.toMatch(/for (insert|update|delete)/);
    expect(executableC).not.toContain('drop policy');
    expect(executableC).not.toContain('alter table');
  });

  it('does not COMMENT on a policy attached to extension-owned storage.objects', () => {
    expect(norm(stripLineComments(migrationC))).not.toContain('comment on policy');
  });
});

describe('Block C — submit_public_place RPC signature & surface (required area #7, #4)', () => {
  it('takes only the minimum typed client inputs', () => {
    const sig = migrationB.match(
      /create or replace function public\.submit_public_place\(([\s\S]*?)\)\s+returns public\.places/,
    )?.[1];
    expect(sig, 'function signature must be parseable').toBeTruthy();
    const params = norm(sig!).split(',').map((p) => p.trim());
    expect(params).toEqual([
      'p_place_id uuid',
      'p_name text',
      'p_category text',
      'p_lat double precision',
      'p_lng double precision',
      'p_storage_path text',
    ]);
  });

  it('accepts NO forgeable parameter (role/creator/status/moderation/source/details/audit)', () => {
    // area #4 / #7: the client cannot supply role, creator, status, moderation,
    // source, details, audit fields, or an arbitrary photo kind/path.
    const sigParams = [
      'role', 'created_by', 'status', 'moderation', 'moderation_status', 'source',
      'details', 'steps', 'ramp', 'door', 'toilet', 'parking', 'comment',
      'trust', 'karma', 'kind', 'uploaded_by',
    ];
    for (const p of sigParams) {
      expect(t2Source).not.toMatch(new RegExp(`p_${p}\\b`, 'i'));
    }
  });

  it('is SECURITY DEFINER with an EMPTY search_path', () => {
    // areas #10: empty search_path + security definer.
    expect(norm(migrationB)).toContain('security definer');
    expect(norm(migrationB)).toContain("set search_path = ''");
  });

  it('uses only fully-qualified references (no unqualified table/function)', () => {
    // No bare `places`, `photos`, `profiles`, `categories`, `storage.objects`,
    // `auth.uid()` misuse. Every table ref must be schema-qualified.
    // We assert the RPC body qualifies its relations.
    const body = rpcSql;
    // Reject bare relation names only in SQL relation positions. Searching for
    // every occurrence would falsely match the legitimate bucket literal
    // `place-photos`.
    expect(body).not.toMatch(
      /\b(?:from|into|update|join)\s+(?:places|photos|profiles|categories)\b/i,
    );
    // storage.objects and auth.uid() must be referenced qualified.
    expect(body).toContain('storage.objects');
    expect(body).toContain('auth.uid()');
    expect(body).toContain('public.profiles');
    expect(body).toContain('public.categories');
    expect(body).toContain('public.places');
    expect(body).toContain('public.photos');
  });
});

describe('Block C — RPC guard branches (required area #7)', () => {
  // Pull the function body once; each guard is a distinct raise branch.
  const body = rpcSql;

  it('rejects unauthenticated callers (auth.uid() is null)', () => {
    expect(norm(body)).toContain('v_uid is null');
    expect(body).toContain('authentication required');
    expect(body).toMatch(/errcode\s*=\s*'42501'/);
  });

  it('rejects missing profile', () => {
    expect(body).toContain('profile not found');
  });

  it('rejects any role other than public_user (rejects elevated-forged caller)', () => {
    expect(norm(body)).toContain("v_role <> 'public_user'");
    expect(body).toContain('caller must be public_user');
  });

  // Историческая правда: T2 вводила лимит одной подачи. Файл миграции
  // неизменяем, поэтому проверка остаётся — но лимит отменён более поздней
  // миграцией, см. следующий блок.
  it('T2 introduced a one-submission-per-contributor limit', () => {
    expect(norm(executableB)).toContain(
      'create unique index places_one_public_submission_per_creator_idx on public.places (created_by) where source = \'public\' and created_by is not null',
    );
    expect(body).toContain('public submission already used');
  });

  it('the submission limit is dropped by a later migration (Арбитр, 20.07)', () => {
    const dropMigration = readMigration('20260720080000_drop_one_public_submission_limit.sql');
    // Индекс снят.
    expect(norm(dropMigration)).toContain(
      'drop index if exists public.places_one_public_submission_per_creator_idx',
    );
    // И проверка внутри функции больше не отклоняет повторную подачу.
    expect(dropMigration).not.toContain('public submission already used');
    // Остальные защиты обязаны сохраниться: снимается ровно одно ограничение.
    expect(dropMigration).toContain('caller must be public_user');
    expect(dropMigration).toContain('owned facade object not found');
    expect(dropMigration).toContain('place_id already used');
    expect(dropMigration).toContain('inactive or unknown category');
  });

  it('rejects empty / whitespace-only name', () => {
    expect(norm(body)).toContain("btrim(p_name) = ''");
    expect(body).toContain('name is required');
  });

  it('rejects inactive / unknown category', () => {
    expect(norm(body)).toContain('c.slug = p_category and c.is_active = true');
    expect(body).toContain('inactive or unknown category');
  });

  it('rejects non-finite / out-of-bounds coordinates', () => {
    const g = norm(body);
    expect(g).toContain('p_lat < -90');
    expect(g).toContain('p_lat > 90');
    expect(g).toContain('p_lng < -180');
    expect(g).toContain('p_lng > 180');
    // NaN / Infinity rejection (finite check).
    expect(g).toMatch(/nan/i);
  });

  it('rejects a storage_path that is not exactly {place_id}/facade.jpg', () => {
    expect(norm(body)).toContain(
      "v_expected_path text := p_place_id::text || '/facade.jpg'",
    );
    expect(norm(body)).toContain(
      "coalesce(p_storage_path, '') <> v_expected_path",
    );
    expect(body).toContain('storage_path must equal');
  });

  it('takes the same transaction lock as cleanup before object revalidation', () => {
    expect(norm(body)).toContain(
      'pg_catalog.pg_advisory_xact_lock( pg_catalog.hashtextextended(v_expected_path, 0) )',
    );
    const helper = extractFunctionSql(
      migrationB,
      'goapsny_private.claim_unreferenced_storage_path',
    );
    expect(norm(helper)).toContain(
      'pg_catalog.pg_advisory_xact_lock( pg_catalog.hashtextextended(p_storage_path, 0) )',
    );
  });

  it('rejects a reused place_id', () => {
    expect(body).toContain('place_id already used');
    expect(body).toMatch(/errcode\s*=\s*'23505'/);
  });

  it('rejects an already-indexed facade path', () => {
    expect(body).toContain('facade already indexed');
  });

  it('requires the caller-owned private Storage object to exist (revalidation)', () => {
    expect(body).toContain('owned facade object not found');
    expect(norm(body)).toMatch(
      /not exists \([\s\S]*?storage\.objects[\s\S]*?so\.owner = v_uid[\s\S]*?\)/,
    );
  });
});

describe('Block C — atomic success writes exact fields (required area #8, #9, #10)', () => {
  const body = rpcSql;

  it('hardcodes status=gray', () => {
    expect(norm(body)).toContain("'gray'");
  });

  it('hardcodes moderation_status=published', () => {
    expect(norm(body)).toContain("'published'");
  });

  it('hardcodes source=public', () => {
    expect(norm(body)).toContain("'public'");
  });

  it('hardcodes created_by = auth.uid() (never from input)', () => {
    const placeInsert = norm(body).match(
      /insert into public\.places[\s\S]*?values[\s\S]*?\);/,
    )?.[0];
    expect(placeInsert, 'place insert must be present').toBeTruthy();
    expect(placeInsert!).toContain('v_uid');
    // The literal column list explicitly sets created_by to the server value.
    expect(placeInsert!).toContain('created_by');
  });

  it('hardcodes details schema_version=1 and nothing else', () => {
    expect(norm(body)).toContain("jsonb_build_object('schema_version', 1)");
  });

  it('writes exactly one facade photo with kind=facade and uploaded_by=auth.uid()', () => {
    const photoInsert = norm(body).match(
      /insert into public\.photos \(place_id, storage_path, kind, uploaded_by\)[\s\S]*?\);/,
    )?.[0];
    expect(photoInsert, 'photo insert must be present').toBeTruthy();
    expect(photoInsert!).toContain("'facade'");
    expect(photoInsert!).toContain('v_uid');
    expect(photoInsert!).toContain('v_expected_path');
  });

  it('place + photo are inserted in the same SECURITY DEFINER function (single tx)', () => {
    // area #9: a failed photo insert rolls back the place insert — no half-object.
    // Single function = single transaction; there are no autonomous commits.
    expect(norm(body)).toMatch(/insert into public\.places/);
    expect(norm(body)).toMatch(/insert into public\.photos/);
    expect(body).not.toMatch(/commit;/i);
    expect(body).not.toMatch(/dblink/i);
    expect(body).not.toMatch(/perform\s+pg_advisory/i);
  });

  it('has exactly two inserts (one place, one facade) and nothing else writing data', () => {
    const insertCount = (body.match(/insert into /gi) ?? []).length;
    expect(insertCount).toBe(2);
  });
});

describe('Block C — minimum execute grants (required area #10)', () => {
  it('revokes execute from PUBLIC and anon, grants only authenticated', () => {
    expect(norm(executableB)).toContain(
      'revoke execute on function public.submit_public_place( uuid, text, text, double precision, double precision, text ) from public, anon',
    );
    expect(norm(executableB)).toContain(
      'grant execute on function public.submit_public_place( uuid, text, text, double precision, double precision, text ) to authenticated',
    );
    const targets = [
      ...executableB.matchAll(
        /grant execute on function public\.submit_public_place\([\s\S]*?\)\s+to\s+(\w+)/gi,
      ),
    ].map((match) => match[1].toLowerCase());
    expect(targets).toEqual(['authenticated']);
  });

  it('the trigger function is not left default-executable by anon/public either', () => {
    expect(norm(migrationA)).toContain(
      'revoke execute on function public.tg_create_profile_on_auth_user() from public, anon',
    );
    expect(norm(executableA)).toContain(
      'alter function public.tg_create_profile_on_auth_user() owner to postgres',
    );
    expect(norm(executableB)).toContain(
      'alter function public.submit_public_place( uuid, text, text, double precision, double precision, text ) owner to postgres',
    );
  });
});

describe('Non-collision with T1 (required area #12)', () => {
  it('does NOT recreate T1 anon photo/Storage read policies', () => {
    // T1 owns these names on feat/pwa-public. T2 must not redefine them.
    const t1OwnedPolicyNames = [
      'photos_read_published_anon',
      'place_photos_storage_read_anon_published',
      'places_read_published_anon',
      'categories_read_active_anon',
      'accessibility_statuses_read_anon',
    ];
    for (const name of t1OwnedPolicyNames) {
      expect(t2Source).not.toContain(`create policy ${name}`);
      expect(t2Source).not.toContain(`drop policy ${name}`);
    }
  });

  it('does NOT grant anon any new privilege (anon reads stay T1-owned)', () => {
    expect(t2Source).not.toMatch(/grant\s+\w+\s+on\s+.*to\s+anon/i);
    expect(t2Source).not.toMatch(/to anon\b/i);
  });

  it('records the T1 dependency (anon published photo + storage read) as a named contract', () => {
    // Dependency is encoded in T2-Z-REPORT.md and the migration header. We
    // assert the migration header names the T1 migration file so
    // the cross-branch dependency is explicit in-repo.
    expect(migrationB).toContain('20260714141000_public_read_published.sql');
  });
});

describe('Secret / unsafe-pattern scan (brief verification gate)', () => {
  // Mirrors the brief's security scan without embedding credential names as
  // literal fixtures inside the test source itself.
  const allT2 = [migrationA, migrationB];

  it('T2 introduces no new "default \'tester\'" (the escalation source)', () => {
    // baseline still HAS it (immutable), but T2 must not add another.
    for (const f of allT2) {
      expect(f).not.toContain("default 'tester'");
    }
  });

  it('T2 migrations contain no Telegram bot credential name', () => {
    const forbidden = ['TELEGRAM', 'BOT', 'TOKEN'].join('_');
    for (const f of allT2) {
      expect(f).not.toContain(forbidden);
    }
  });

  it('T2 migrations contain no service-role credential name', () => {
    const forbidden = ['service', 'role'].join('_');
    for (const f of allT2) {
      expect(f.toLowerCase()).not.toContain(forbidden);
    }
  });

  it('every SECURITY DEFINER function T2 adds sets an empty search_path', () => {
    // Trigger, cleanup claim helper and submission RPC must all pin it.
    const secDef = executableA + '\n' + executableB;
    // Count security definer occurrences and search_path = '' occurrences among
    // the new functions.
    const definerCount = (secDef.match(/security definer/gi) ?? []).length;
    const emptyPathCount = (secDef.match(/set search_path = ''/gi) ?? []).length;
    expect(definerCount).toBeGreaterThanOrEqual(3);
    expect(emptyPathCount).toBeGreaterThanOrEqual(3);
    // And T2 must NOT introduce the legacy `set search_path = public` pattern.
    expect(t2Executable).not.toMatch(/set search_path\s*=\s*public/i);
  });
});
