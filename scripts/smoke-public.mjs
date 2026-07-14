#!/usr/bin/env node
/**
 * T1 public-read smoke: fixture-backed anon proofs (FIELD-DELTA + T1-REVIEW).
 * Loads .env + .env.test.local (values never logged). Uses TEST_SUPABASE_* for
 * privileged fixture discovery, then exercises a fresh anon client.
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const verdicts = [];

function record(name, pass, detail = '') {
  verdicts.push({ name, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? `: ${detail}` : ''}`);
}

function loadEnvFile(filename) {
  const path = resolve(ROOT, filename);
  if (!existsSync(path)) return false;
  try {
    const raw = readFileSync(path, 'utf8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
    return true;
  } catch {
    return false;
  }
}

function readExportedConstant(name) {
  const source = readFileSync(resolve(ROOT, 'src/services/places.ts'), 'utf8');
  const match = source.match(new RegExp(`export const ${name}\\s*=\\s*\\n?\\s*'([^']+)'`));
  if (!match) throw new Error(`Could not parse ${name} from src/services/places.ts`);
  return match[1];
}

function env(name, aliases = []) {
  for (const key of [name, ...aliases]) {
    const value = process.env[key];
    if (value) return value;
  }
  return '';
}

function printSummary() {
  const passed = verdicts.filter((v) => v.pass).length;
  const failed = verdicts.length - passed;
  console.log(`\n=== SUMMARY: ${passed}/${verdicts.length} PASS, ${failed} FAIL ===`);
}

async function discoverFixtures(admin) {
  const explicit = {
    gray: env('SMOKE_GRAY_PUBLISHED_PLACE_ID'),
    colored: env('SMOKE_COLORED_PUBLISHED_PLACE_ID'),
    hidden: env('SMOKE_HIDDEN_PLACE_ID'),
    pending: env('SMOKE_PENDING_PLACE_ID'),
    publishedPath: env('SMOKE_PUBLISHED_FACADE_PATH'),
    hiddenPath: env('SMOKE_HIDDEN_FACADE_PATH'),
  };

  if (Object.values(explicit).every(Boolean)) {
    return explicit;
  }

  const { data: grayRow } = await admin
    .from('places')
    .select('id')
    .eq('moderation_status', 'published')
    .eq('status', 'gray')
    .limit(1)
    .maybeSingle();

  const { data: coloredRow } = await admin
    .from('places')
    .select('id')
    .eq('moderation_status', 'published')
    .in('status', ['green', 'yellow', 'red'])
    .limit(1)
    .maybeSingle();

  const { data: hiddenRow } = await admin
    .from('places')
    .select('id')
    .eq('moderation_status', 'hidden')
    .limit(1)
    .maybeSingle();

  const { data: pendingRow } = await admin
    .from('places')
    .select('id')
    .eq('moderation_status', 'pending')
    .limit(1)
    .maybeSingle();

  const grayId = explicit.gray || grayRow?.id || '';
  const coloredId = explicit.colored || coloredRow?.id || '';

  let publishedPath = explicit.publishedPath;
  if (!publishedPath && grayId) {
    const { data: photo } = await admin
      .from('photos')
      .select('storage_path')
      .eq('place_id', grayId)
      .eq('kind', 'facade')
      .maybeSingle();
    publishedPath = photo?.storage_path ?? '';
  }

  let hiddenPath = explicit.hiddenPath;
  const hiddenId = explicit.hidden || hiddenRow?.id || '';
  if (!hiddenPath && hiddenId) {
    const { data: photo } = await admin
      .from('photos')
      .select('storage_path')
      .eq('place_id', hiddenId)
      .eq('kind', 'facade')
      .maybeSingle();
    hiddenPath = photo?.storage_path ?? '';
  }

  return {
    gray: grayId,
    colored: coloredId,
    hidden: hiddenId,
    pending: explicit.pending || pendingRow?.id || '',
    publishedPath: publishedPath ?? '',
    hiddenPath: hiddenPath ?? '',
  };
}

async function main() {
  console.log('=== GoApsny T1 public-read smoke (fixture-backed) ===\n');
  loadEnvFile('.env');
  const hasTestEnv = loadEnvFile('.env.test.local');
  record('env: .env.test.local present', hasTestEnv, hasTestEnv ? 'loaded' : 'missing');

  const supabaseUrl = env('TEST_SUPABASE_URL', ['SUPABASE_URL', 'VITE_SUPABASE_URL']);
  const anonKey = env('TEST_SUPABASE_ANON_KEY', ['SUPABASE_ANON_KEY', 'VITE_SUPABASE_ANON_KEY']);
  const serviceRoleKey = env('TEST_SUPABASE_SERVICE_ROLE_KEY', [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SMOKE_SERVICE_ROLE_KEY',
  ]);

  record(
    'env: test Supabase URL + anon key',
    Boolean(supabaseUrl && anonKey),
    supabaseUrl ? 'configured' : 'missing TEST_SUPABASE_URL / anon',
  );
  record(
    'env: test service role for fixture discovery',
    Boolean(serviceRoleKey),
    serviceRoleKey ? 'configured' : 'missing TEST_SUPABASE_SERVICE_ROLE_KEY',
  );

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    printSummary();
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const fixtures = await discoverFixtures(admin);
  const required = [
    ['gray published place', fixtures.gray],
    ['colored published place', fixtures.colored],
    ['hidden place', fixtures.hidden],
    ['pending place', fixtures.pending],
    ['published facade path', fixtures.publishedPath],
    ['hidden facade path', fixtures.hiddenPath],
  ];

  for (const [label, value] of required) {
    record(`fixtures: ${label} discovered`, Boolean(value), value ? 'ok' : 'not found in test DB');
  }

  if (required.some(([, value]) => !value)) {
    printSummary();
    process.exit(1);
  }

  const placeColumns = readExportedConstant('PLACE_COLUMNS');
  const photoColumns = readExportedConstant('PHOTO_COLUMNS');

  const anon = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: grayRow, error: grayError } = await anon
    .from('places')
    .select(placeColumns)
    .eq('id', fixtures.gray)
    .maybeSingle();
  record(
    'anon read: gray published place',
    !grayError && grayRow?.status === 'gray',
    grayError?.message ?? grayRow?.status ?? 'missing',
  );

  const { data: coloredRow, error: coloredError } = await anon
    .from('places')
    .select('id,status,moderation_status')
    .eq('id', fixtures.colored)
    .maybeSingle();
  record(
    'anon read: colored published place',
    !coloredError &&
      coloredRow?.moderation_status === 'published' &&
      ['green', 'yellow', 'red'].includes(coloredRow?.status ?? ''),
    coloredError?.message ?? coloredRow?.status ?? 'missing',
  );

  for (const [label, id] of [
    ['hidden', fixtures.hidden],
    ['pending', fixtures.pending],
  ]) {
    const { data, error } = await anon.from('places').select('id').eq('id', id).maybeSingle();
    record(`anon read: ${label} place denied`, !error && !data, error?.message ?? (data ? 'leaked' : 'hidden'));
  }

  const { data: publishedPhoto, error: publishedPhotoError } = await anon
    .from('photos')
    .select(photoColumns)
    .eq('storage_path', fixtures.publishedPath)
    .maybeSingle();
  record(
    'anon read: published facade metadata',
    !publishedPhotoError && publishedPhoto?.kind === 'facade',
    publishedPhotoError?.message ?? 'ok',
  );

  const { data: hiddenPhoto, error: hiddenPhotoError } = await anon
    .from('photos')
    .select('id')
    .eq('storage_path', fixtures.hiddenPath)
    .maybeSingle();
  record(
    'anon read: hidden facade metadata denied',
    !hiddenPhotoError && !hiddenPhoto,
    hiddenPhotoError?.message ?? (hiddenPhoto ? 'leaked' : 'hidden'),
  );

  const { data: signedPublished, error: signPublishedError } = await anon.storage
    .from('place-photos')
    .createSignedUrl(fixtures.publishedPath, 120);
  record(
    'anon signed URL: published facade succeeds',
    !signPublishedError && Boolean(signedPublished?.signedUrl),
    signPublishedError?.message ?? 'ok',
  );

  const { data: signedHidden, error: signHiddenError } = await anon.storage
    .from('place-photos')
    .createSignedUrl(fixtures.hiddenPath, 120);
  record(
    'anon signed URL: hidden facade denied',
    Boolean(signHiddenError) || !signedHidden?.signedUrl,
    signHiddenError?.message ?? 'unexpected signed URL',
  );

  const { error: writeError } = await anon.from('places').insert({
    name: 'smoke-should-fail',
    category: 'food',
    lat: 43,
    lng: 41,
    status: 'gray',
    moderation_status: 'published',
    source: 'public',
  });
  record('anon write: places denied', Boolean(writeError), writeError?.message ?? 'unexpected insert');

  const { error: photoWriteError } = await anon.from('photos').insert({
    place_id: fixtures.gray,
    storage_path: `${randomUUID()}/facade.jpg`,
    kind: 'facade',
  });
  record('anon write: photos denied', Boolean(photoWriteError), photoWriteError?.message ?? 'unexpected insert');

  const { data: profiles } = await anon.from('profiles').select('id').limit(1);
  record('anon read: profiles denied', (profiles?.length ?? 0) === 0, `rows=${profiles?.length ?? 0}`);

  printSummary();
  process.exit(verdicts.every((v) => v.pass) ? 0 : 1);
}

main().catch((error) => {
  console.error('\nUnhandled error:', error);
  process.exit(1);
});
