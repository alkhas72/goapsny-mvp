import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(
  resolve(here, '..', '..', 'supabase', 'migrations', '20260919120000_lock_karma_and_author_moderation.sql'),
  'utf8',
);

describe('security-batch moderation lock', () => {
  it('revokes client execute on add_karma', () => {
    expect(sql).toMatch(/revoke execute on function public\.add_karma/i);
    expect(sql).toMatch(/from authenticated/i);
  });

  it('locks moderation with a trigger, not a self-select on places', () => {
    expect(sql).toMatch(/tg_places_lock_moderation_status/);
    expect(sql).toMatch(/create trigger places_lock_moderation_status/i);
    expect(sql).not.toMatch(/select p\.moderation_status from public\.places/i);
  });
});
