#!/usr/bin/env node
/**
 * Offline smoke-harness checks — no network, DB apply, or credential output.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from './lib/test-db-gate.mjs';
import {
  REQUIRED_FIXTURE_FIELDS,
  isBucketPrivate,
  isFacadeMetadataDenied,
  isSignedUrlDenied,
  isStorageListDenied,
  isStorageUploadDenied,
  stableFixturePaths,
} from './lib/smoke-storage-proofs.mjs';
import { T1_SMOKE_FIXTURES } from './fixtures/t1-smoke-fixtures.mjs';

const checks = [];

function pass(name) {
  checks.push({ name, pass: true });
  console.log(`[PASS] ${name}`);
}

function fail(name, detail) {
  checks.push({ name, pass: false });
  console.log(`[FAIL] ${name}: ${detail}`);
}

const smokeSource = readFileSync(resolve(REPO_ROOT, 'scripts/smoke-public.mjs'), 'utf8');

for (const [, field] of REQUIRED_FIXTURE_FIELDS) {
  if (smokeSource.includes(field)) {
    pass(`smoke source references fixture field ${field}`);
  } else {
    fail(`smoke source references fixture field ${field}`, 'missing in smoke-public.mjs');
  }
}

const requiredSnippets = [
  'pendingFacadePath',
  'pending facade metadata',
  'pending facade',
  'proveStorageGate',
  'anon storage: place-photos list denied',
  'anon storage: place-photos upload denied',
  'storage: place-photos bucket private',
];

for (const snippet of requiredSnippets) {
  if (smokeSource.includes(snippet)) {
    pass(`smoke source includes proof ${snippet}`);
  } else {
    fail(`smoke source includes proof ${snippet}`, 'missing');
  }
}

if (T1_SMOKE_FIXTURES.pendingFacadePath.endsWith('/facade.jpg')) {
  pass('stable pendingFacadePath shape');
} else {
  fail('stable pendingFacadePath shape', T1_SMOKE_FIXTURES.pendingFacadePath);
}

const paths = stableFixturePaths();
if (paths.pendingFacadePath === T1_SMOKE_FIXTURES.pendingFacadePath) {
  pass('stableFixturePaths exports pendingFacadePath');
} else {
  fail('stableFixturePaths exports pendingFacadePath', 'mismatch');
}

if (isFacadeMetadataDenied(null, null)) pass('predicate: facade metadata denied');
else fail('predicate: facade metadata denied', 'unexpected');

if (isSignedUrlDenied(new Error('denied'), null)) pass('predicate: signed URL denied on error');
else fail('predicate: signed URL denied on error', 'unexpected');

if (isBucketPrivate({ public: false })) pass('predicate: bucket private');
else fail('predicate: bucket private', 'unexpected');

if (isStorageListDenied(new Error('denied'), null)) pass('predicate: storage list denied on error');
else fail('predicate: storage list denied on error', 'unexpected');

if (isStorageUploadDenied(new Error('denied'))) pass('predicate: storage upload denied');
else fail('predicate: storage upload denied', 'unexpected');

const passed = checks.filter((c) => c.pass).length;
console.log(`\n=== OFFLINE SMOKE HARNESS: ${passed}/${checks.length} PASS ===`);
process.exit(checks.every((c) => c.pass) ? 0 : 1);
