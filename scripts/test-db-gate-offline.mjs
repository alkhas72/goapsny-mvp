#!/usr/bin/env node
/**
 * Offline gate checks — no network, no DB apply, no credential output.
 */
import { assertTestProjectBoundary } from './lib/test-db-gate.mjs';

const checks = [];

function pass(name) {
  checks.push({ name, pass: true });
  console.log(`[PASS] ${name}`);
}

function fail(name, detail) {
  checks.push({ name, pass: false });
  console.log(`[FAIL] ${name}: ${detail}`);
}

try {
  assertTestProjectBoundary('https://abc123.supabase.co', 'abc123');
  pass('host boundary accepts matching ref');
} catch (error) {
  fail('host boundary accepts matching ref', error.message);
}

try {
  assertTestProjectBoundary('https://wrong.supabase.co', 'abc123');
  fail('host boundary rejects mismatch', 'expected throw');
} catch {
  pass('host boundary rejects mismatch');
}

try {
  assertTestProjectBoundary('not-a-url', 'abc123');
  fail('host boundary rejects invalid URL', 'expected throw');
} catch {
  pass('host boundary rejects invalid URL');
}

const passed = checks.filter((c) => c.pass).length;
console.log(`\n=== OFFLINE GATE: ${passed}/${checks.length} PASS ===`);
process.exit(checks.every((c) => c.pass) ? 0 : 1);
