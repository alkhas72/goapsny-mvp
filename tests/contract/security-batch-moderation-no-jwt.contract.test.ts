import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  resolve(
    here,
    '..',
    '..',
    'supabase',
    'migrations',
    '20260919223000_moderation_lock_allow_no_jwt.sql',
  ),
  'utf8',
);

describe('moderation lock: no-JWT service path', () => {
  it('allows empty request.jwt.claims and API service_role', () => {
    expect(sql).toMatch(/current_setting\('request\.jwt\.claims',\s*true\)/);
    expect(sql).toMatch(/auth\.role\(\),\s*''\)\s*=\s*'service_role'/);
  });

  it('does not reopen a self-select on places', () => {
    expect(sql).not.toMatch(/select p\.moderation_status from public\.places/i);
  });
});
