#!/usr/bin/env node
/**
 * G1 offline preview-harness — manifest, SW, installability, retry states, dist artifacts.
 * No network, deploy, DB apply, or credential output.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { REPO_ROOT } from './lib/test-db-gate.mjs';
import {
  checkDistPreviewArtifacts,
  runSourcePreviewChecks,
  summarizeChecks,
} from './lib/preview-harness-checks.mjs';

const checks = [];

function record(check) {
  checks.push(check);
  const tag = check.pass ? 'PASS' : 'FAIL';
  const detail = check.detail ? `: ${check.detail}` : '';
  console.log(`[${tag}] ${check.name}${detail}`);
}

function main() {
  console.log('=== GoApsny G1 preview harness (offline) ===\n');

  for (const check of runSourcePreviewChecks(REPO_ROOT)) {
    record(check);
  }

  const distRoot = resolve(REPO_ROOT, 'dist');
  if (existsSync(distRoot)) {
    console.log('\n-- dist preview artifacts --');
    for (const check of checkDistPreviewArtifacts(distRoot)) {
      record(check);
    }
  } else {
    record({
      name: 'dist: build output present',
      pass: false,
      detail: 'run npm run build before preview-harness dist checks',
    });
  }

  const summary = summarizeChecks(checks);
  console.log(`\n=== PREVIEW HARNESS OFFLINE: ${summary.passed}/${summary.total} PASS ===`);
  if (summary.failedLines.length > 0) {
    console.log('\nFailures:');
    for (const line of summary.failedLines) {
      console.log(`  - ${line}`);
    }
  }

  process.exit(summary.allPass ? 0 : 1);
}

main();
