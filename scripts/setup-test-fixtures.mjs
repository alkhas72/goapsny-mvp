#!/usr/bin/env node
/**
 * Idempotent T1 smoke fixtures for the approved isolated test project only.
 * Uses TEST_SUPABASE_SERVICE_ROLE_KEY from .env.test.local (never logged).
 * Does not read VITE_* or production SUPABASE_* fallbacks.
 */
import { createClient } from '@supabase/supabase-js';
import { requireTestSupabaseEnv } from './lib/test-db-gate.mjs';
import {
  T1_SMOKE_FIXTURES,
  T1_SMOKE_PLACE_NAMES,
} from './fixtures/t1-smoke-fixtures.mjs';

const MIN_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==',
  'base64',
);

const SUKHUM = { lat: 43.0015, lng: 41.0232 };

function basePlace(id, name, status, moderationStatus) {
  return {
    id,
    name,
    category: 'food',
    lat: SUKHUM.lat,
    lng: SUKHUM.lng,
    status,
    ramp_type: 'none',
    toilet_exists: 'unknown',
    toilet_accessible: 'unknown',
    parking: 'unknown',
    osm_tags: {},
    details: { schema_version: 1, address: 'T1 smoke fixture' },
    moderation_status: moderationStatus,
    source: 'public',
    created_by: null,
  };
}

async function upsertPlace(admin, row) {
  const { error } = await admin.from('places').upsert(row, { onConflict: 'id' });
  if (error) throw new Error(`places upsert ${row.id}: ${error.message}`);
}

async function upsertPhoto(admin, placeId, storagePath) {
  const { error } = await admin.from('photos').upsert(
    {
      place_id: placeId,
      storage_path: storagePath,
      kind: 'facade',
      uploaded_by: null,
    },
    { onConflict: 'storage_path' },
  );
  if (error) throw new Error(`photos upsert ${storagePath}: ${error.message}`);
}

async function ensureStorageObject(admin, storagePath) {
  const { error } = await admin.storage.from('place-photos').upload(storagePath, MIN_JPEG, {
    contentType: 'image/jpeg',
    upsert: true,
  });
  if (error && !error.message?.includes('already exists')) {
    throw new Error(`storage upload ${storagePath}: ${error.message}`);
  }
}

async function main() {
  console.log('=== T1 test fixture setup (idempotent) ===\n');
  const { url, serviceRoleKey, projectRef } = requireTestSupabaseEnv();
  console.log(`target project ref: ${projectRef}`);

  const admin = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const places = [
    basePlace(
      T1_SMOKE_FIXTURES.grayPlaceId,
      T1_SMOKE_PLACE_NAMES.gray,
      'gray',
      'published',
    ),
    basePlace(
      T1_SMOKE_FIXTURES.coloredPlaceId,
      T1_SMOKE_PLACE_NAMES.colored,
      'green',
      'published',
    ),
    basePlace(
      T1_SMOKE_FIXTURES.pendingPlaceId,
      T1_SMOKE_PLACE_NAMES.pending,
      'gray',
      'pending',
    ),
    basePlace(
      T1_SMOKE_FIXTURES.hiddenPlaceId,
      T1_SMOKE_PLACE_NAMES.hidden,
      'gray',
      'hidden',
    ),
  ];

  for (const row of places) {
    await upsertPlace(admin, row);
    console.log(`[ok] place ${row.moderation_status} ${row.id}`);
  }

  const photos = [
    [T1_SMOKE_FIXTURES.grayPlaceId, T1_SMOKE_FIXTURES.grayFacadePath],
    [T1_SMOKE_FIXTURES.coloredPlaceId, T1_SMOKE_FIXTURES.coloredFacadePath],
    [T1_SMOKE_FIXTURES.pendingPlaceId, T1_SMOKE_FIXTURES.pendingFacadePath],
    [T1_SMOKE_FIXTURES.hiddenPlaceId, T1_SMOKE_FIXTURES.hiddenFacadePath],
  ];

  for (const [placeId, storagePath] of photos) {
    await upsertPhoto(admin, placeId, storagePath);
    await ensureStorageObject(admin, storagePath);
    console.log(`[ok] facade ${storagePath}`);
  }

  console.log('\n=== FIXTURE SETUP COMPLETE ===');
}

main().catch((error) => {
  console.error('\nFixture setup failed:', error.message);
  process.exit(1);
});
