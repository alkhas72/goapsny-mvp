#!/usr/bin/env node
/**
 * T1 public-read smoke: fail-closed test-project gate with stable fixture IDs.
 * Reads ONLY .env.test.local / TEST_SUPABASE_* (no VITE_* or SUPABASE_* fallbacks).
 */
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { requireTestSupabaseEnv, REPO_ROOT } from './lib/test-db-gate.mjs';
import { T1_SMOKE_FIXTURES } from './fixtures/t1-smoke-fixtures.mjs';

const verdicts = [];

function record(name, pass, detail = '') {
  verdicts.push({ name, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? `: ${detail}` : ''}`);
}

function readExportedConstant(name) {
  const source = readFileSync(resolve(REPO_ROOT, 'src/services/places.ts'), 'utf8');
  const match = source.match(new RegExp(`export const ${name}\\s*=\\s*\\n?\\s*'([^']+)'`));
  if (!match) throw new Error(`Could not parse ${name} from src/services/places.ts`);
  return match[1];
}

function printSummary() {
  const passed = verdicts.filter((v) => v.pass).length;
  const failed = verdicts.length - passed;
  console.log(`\n=== SUMMARY: ${passed}/${verdicts.length} PASS, ${failed} FAIL ===`);
}

async function verifyStableFixtures(admin) {
  const f = T1_SMOKE_FIXTURES;
  const fixtures = {
    gray: '',
    colored: '',
    hidden: '',
    pending: '',
    grayFacadePath: '',
    coloredFacadePath: '',
    hiddenFacadePath: '',
  };

  const { data: grayRow } = await admin
    .from('places')
    .select('id,status,moderation_status')
    .eq('id', f.grayPlaceId)
    .maybeSingle();
  if (grayRow?.moderation_status === 'published' && grayRow.status === 'gray') {
    fixtures.gray = grayRow.id;
  }

  const { data: coloredRow } = await admin
    .from('places')
    .select('id,status,moderation_status')
    .eq('id', f.coloredPlaceId)
    .maybeSingle();
  if (
    coloredRow?.moderation_status === 'published' &&
    ['green', 'yellow', 'red'].includes(coloredRow.status ?? '')
  ) {
    fixtures.colored = coloredRow.id;
  }

  const { data: hiddenRow } = await admin
    .from('places')
    .select('id,moderation_status')
    .eq('id', f.hiddenPlaceId)
    .maybeSingle();
  if (hiddenRow?.moderation_status === 'hidden') {
    fixtures.hidden = hiddenRow.id;
  }

  const { data: pendingRow } = await admin
    .from('places')
    .select('id,moderation_status')
    .eq('id', f.pendingPlaceId)
    .maybeSingle();
  if (pendingRow?.moderation_status === 'pending') {
    fixtures.pending = pendingRow.id;
  }

  for (const [key, placeId, path] of [
    ['grayFacadePath', f.grayPlaceId, f.grayFacadePath],
    ['coloredFacadePath', f.coloredPlaceId, f.coloredFacadePath],
    ['hiddenFacadePath', f.hiddenPlaceId, f.hiddenFacadePath],
  ]) {
    const { data: photo } = await admin
      .from('photos')
      .select('storage_path,place_id')
      .eq('place_id', placeId)
      .eq('storage_path', path)
      .eq('kind', 'facade')
      .maybeSingle();
    if (photo?.storage_path === path) {
      fixtures[key] = path;
    }
  }

  return fixtures;
}

async function main() {
  console.log('=== GoApsny T1 public-read smoke (fail-closed test gate) ===\n');

  let env;
  try {
    env = requireTestSupabaseEnv();
    record('env: .env.test.local + TEST_SUPABASE_*', true, 'loaded');
    record('env: project host boundary', true, env.projectRef);
  } catch (error) {
    record('env: test gate preflight', false, error.message);
    printSummary();
    process.exit(1);
  }

  const { url: supabaseUrl, anonKey, serviceRoleKey } = env;

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const fixtures = await verifyStableFixtures(admin);
  const required = [
    ['gray published place', fixtures.gray],
    ['colored published place', fixtures.colored],
    ['hidden place', fixtures.hidden],
    ['pending place', fixtures.pending],
    ['gray published facade path', fixtures.grayFacadePath],
    ['colored published facade path', fixtures.coloredFacadePath],
    ['hidden facade path', fixtures.hiddenFacadePath],
  ];

  for (const [label, value] of required) {
    record(`fixtures: ${label} present`, Boolean(value), value ? 'ok' : 'run npm run smoke:setup after migrations');
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

  for (const [label, path] of [
    ['gray published facade metadata', fixtures.grayFacadePath],
    ['colored published facade metadata', fixtures.coloredFacadePath],
  ]) {
    const { data: photo, error: photoError } = await anon
      .from('photos')
      .select(photoColumns)
      .eq('storage_path', path)
      .maybeSingle();
    record(
      `anon read: ${label}`,
      !photoError && photo?.kind === 'facade',
      photoError?.message ?? 'ok',
    );
  }

  const { data: hiddenPhoto, error: hiddenPhotoError } = await anon
    .from('photos')
    .select('id')
    .eq('storage_path', fixtures.hiddenFacadePath)
    .maybeSingle();
  record(
    'anon read: hidden facade metadata denied',
    !hiddenPhotoError && !hiddenPhoto,
    hiddenPhotoError?.message ?? (hiddenPhoto ? 'leaked' : 'hidden'),
  );

  for (const [label, path] of [
    ['gray published facade', fixtures.grayFacadePath],
    ['colored published facade', fixtures.coloredFacadePath],
  ]) {
    const { data: signed, error: signError } = await anon.storage
      .from('place-photos')
      .createSignedUrl(path, 120);
    record(
      `anon signed URL: ${label} succeeds`,
      !signError && Boolean(signed?.signedUrl),
      signError?.message ?? 'ok',
    );
  }

  const { data: signedHidden, error: signHiddenError } = await anon.storage
    .from('place-photos')
    .createSignedUrl(fixtures.hiddenFacadePath, 120);
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
  console.error('\nUnhandled error:', error.message);
  process.exit(1);
});
