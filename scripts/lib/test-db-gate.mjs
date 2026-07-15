import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = resolve(__dirname, '../..');

export function loadEnvFile(filename) {
  const path = resolve(REPO_ROOT, filename);
  if (!existsSync(path)) return false;
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
    process.env[key] = value;
  }
  return true;
}

export function requireTestSupabaseEnv() {
  const loaded = loadEnvFile('.env.test.local');
  if (!loaded) {
    throw new Error('.env.test.local is required for test DB gate scripts');
  }

  const url = process.env.TEST_SUPABASE_URL ?? '';
  const anonKey = process.env.TEST_SUPABASE_ANON_KEY ?? '';
  const serviceRoleKey = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY ?? '';
  const projectRef = process.env.TEST_SUPABASE_PROJECT_REF ?? '';

  if (!url || !anonKey || !serviceRoleKey || !projectRef) {
    throw new Error(
      'TEST_SUPABASE_URL, TEST_SUPABASE_ANON_KEY, TEST_SUPABASE_SERVICE_ROLE_KEY, and TEST_SUPABASE_PROJECT_REF are required',
    );
  }

  assertTestProjectBoundary(url, projectRef);

  return { url, anonKey, serviceRoleKey, projectRef };
}

export function assertTestProjectBoundary(url, projectRef) {
  let hostname;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error('TEST_SUPABASE_URL is not a valid URL');
  }
  const expected = `${projectRef}.supabase.co`;
  if (hostname !== expected) {
    throw new Error(
      `TEST_SUPABASE_URL host mismatch: expected ${expected}, got ${hostname}`,
    );
  }
}
