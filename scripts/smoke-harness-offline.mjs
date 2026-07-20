#!/usr/bin/env node
/**
 * Offline smoke-harness checks — no network, DB apply, or credential output.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from './lib/test-db-gate.mjs';
import {
  REQUIRED_FIXTURE_FIELDS,
  adminStorageObjectExists,
  isBucketPrivate,
  isFacadeMetadataDenied,
  isPublishedStoragePrefixListed,
  isRestrictedPrefixAbsentFromRootList,
  isRestrictedStorageListingHidden,
  isSignedUrlDenied,
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
  'admin storage: pending fixture object exists',
  'admin storage: hidden fixture object exists',
  'anon storage: pending prefix absent from root',
  'anon storage: hidden prefix absent from root',
  'anon storage: pending prefix listing hidden',
  'anon storage: hidden prefix listing hidden',
  'anon storage: published prefix listable',
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

if (smokeSource.includes('anon storage: place-photos list denied')) {
  fail('smoke source excludes obsolete global list-denial proof', 'still present');
} else {
  pass('smoke source excludes obsolete global list-denial proof');
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

if (isStorageUploadDenied(new Error('denied'))) pass('predicate: storage upload denied');
else fail('predicate: storage upload denied', 'unexpected');

if (adminStorageObjectExists(null, Buffer.from('x'))) pass('predicate: admin object exists when downloaded');
else fail('predicate: admin object exists when downloaded', 'unexpected');

if (!adminStorageObjectExists(new Error('missing'), null)) pass('predicate: admin object missing on error');
else fail('predicate: admin object missing on error', 'unexpected');

const pendingPrefix = T1_SMOKE_FIXTURES.pendingPlaceId;
const hiddenPrefix = T1_SMOKE_FIXTURES.hiddenPlaceId;
const publishedPrefix = T1_SMOKE_FIXTURES.grayPlaceId;

if (isRestrictedPrefixAbsentFromRootList([], pendingPrefix)) {
  pass('predicate: restricted prefix absent on empty root');
} else {
  fail('predicate: restricted prefix absent on empty root', 'unexpected');
}

if (!isRestrictedPrefixAbsentFromRootList([{ name: pendingPrefix }], pendingPrefix)) {
  pass('predicate: restricted prefix detected when leaked at root');
} else {
  fail('predicate: restricted prefix detected when leaked at root', 'always-true predicate');
}

if (isRestrictedPrefixAbsentFromRootList([{ name: publishedPrefix }], pendingPrefix)) {
  pass('predicate: published-only root still hides restricted prefix');
} else {
  fail('predicate: published-only root still hides restricted prefix', 'unexpected');
}

if (!isRestrictedPrefixAbsentFromRootList([{ name: publishedPrefix }], publishedPrefix)) {
  pass('predicate: published prefix visible when present at root');
} else {
  fail('predicate: published prefix visible when present at root', 'unexpected');
}

if (isRestrictedStorageListingHidden(null, [])) {
  pass('predicate: restricted prefix listing hidden when empty');
} else {
  fail('predicate: restricted prefix listing hidden when empty', 'unexpected');
}

if (isRestrictedStorageListingHidden(new Error('denied'), null)) {
  pass('predicate: restricted prefix listing hidden on error');
} else {
  fail('predicate: restricted prefix listing hidden on error', 'unexpected');
}

if (!isRestrictedStorageListingHidden(null, [{ name: 'facade.jpg' }])) {
  pass('predicate: restricted prefix listing fails when facade.jpg listed');
} else {
  fail('predicate: restricted prefix listing fails when facade.jpg listed', 'always-true predicate');
}

if (isPublishedStoragePrefixListed(null, [{ name: 'facade.jpg' }])) {
  pass('predicate: published prefix listed when facade.jpg present');
} else {
  fail('predicate: published prefix listed when facade.jpg present', 'unexpected');
}

if (!isPublishedStoragePrefixListed(null, [])) {
  pass('predicate: published prefix not listed when empty');
} else {
  fail('predicate: published prefix not listed when empty', 'always-true predicate');
}

if (!isPublishedStoragePrefixListed(new Error('denied'), [{ name: 'facade.jpg' }])) {
  pass('predicate: published prefix not listed on error');
} else {
  fail('predicate: published prefix not listed on error', 'unexpected');
}

if (!isRestrictedPrefixAbsentFromRootList([{ name: hiddenPrefix }], hiddenPrefix)) {
  pass('predicate: hidden prefix detected when leaked at root');
} else {
  fail('predicate: hidden prefix detected when leaked at root', 'always-true predicate');
}

const passed = checks.filter((c) => c.pass).length;
console.log(`\n=== OFFLINE SMOKE HARNESS: ${passed}/${checks.length} PASS ===`);
process.exit(checks.every((c) => c.pass) ? 0 : 1);
