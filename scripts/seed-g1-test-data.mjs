#!/usr/bin/env node
// scripts/seed-g1-test-data.mjs
// CLI for seeding G1 test data

import { readFile } from 'node:fs/promises';
import { buildDeterministicPlan, fixtures, rejectUnsafeTarget, applyPlan } from './lib/g1-test-fixtures.mjs';

// ============================================================================
// CLI ENTRY POINT
// ============================================================================


// SUPABASE ADAPTER
// ============================================================================

// Table and bucket constants - easy to adjust
const PLACES_TABLE = 'places';
const PHOTOS_TABLE = 'place_photos';
const FACADE_BUCKET = 'facades';

/**
 * Create a Supabase adapter for the apply mode.
 * Uses dynamic import of @supabase/supabase-js only when needed.
 */
async function createSupabaseAdapter(supabaseUrl, serviceRoleKey) {
  const { createClient } = await import('@supabase/supabase-js');

  const client = createClient(supabaseUrl, serviceRoleKey);

  return {
    async upsertPlace(place) {
      const { data, error } = await client
        .from(PLACES_TABLE)
        .upsert(place, { onConflict: 'id' })
        .select();
      if (error) throw error;
      return data;
    },

    async uploadFacade(path, bytes) {
      const { data, error } = await client
        .storage
        .from(FACADE_BUCKET)
        .upload(path, bytes, {
          contentType: 'image/jpeg',
          upsert: true,
        });
      if (error) throw error;
      return data;
    },

    async upsertPhoto(photo) {
      const { data, error } = await client
        .from(PHOTOS_TABLE)
        .upsert(photo, { onConflict: 'place_id,path' })
        .select();
      if (error) throw error;
      return data;
    },

    async verify() {
      // Verify all fixtures are present
      const placeIds = fixtures.map(f => f.id);
      const { data: places, error: placeError } = await client
        .from(PLACES_TABLE)
        .select('id, slug')
        .in('id', placeIds);

      if (placeError) throw placeError;

      const seededIds = new Set(places.map(p => p.id));
      const missingIds = placeIds.filter(id => !seededIds.has(id));

      if (missingIds.length > 0) {
        throw new Error(`Verification failed: missing places with ids ${missingIds.join(', ')}`);
      }

      return {
        status: 'ok',
        seededCount: places.length,
        details: places.map(p => ({ id: p.id, slug: p.slug })),
      };
    },
  };
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

async function main() {
  const args = process.argv.slice(2);

  // Parse arguments
  let planMode = false;
  let applyMode = false;
  let allowProduction = false;

  for (const arg of args) {
    if (arg === '--apply') {
      applyMode = true;
    } else if (arg === '--plan') {
      planMode = true;
    } else if (arg === '--allow-production') {
      allowProduction = true;
    } else if (arg.startsWith('--')) {
      console.error(`Unknown flag: ${arg}`);
      process.exit(1);
    }
  }

  // Default to plan mode if no mode specified
  if (!planMode && !applyMode) {
    planMode = true;
  }

  // Reject simultaneous --plan and --apply
  if (applyMode && planMode) {
    console.error('Cannot specify both --apply and --plan');
    process.exit(1);
  }

  // Build plan
  const plan = buildDeterministicPlan();

  if (planMode) {
    // Default mode: print JSON plan and exit
    console.log(JSON.stringify({
      mode: 'plan',
      fixtures: fixtures.map(f => ({
        id: f.id,
        slug: f.slug,
        name: f.name,
        category: f.category,
        lat: f.lat,
        lng: f.lng,
        publicationState: f.publicationState,
        pinState: f.pinState,
        facadePath: f.facadePath,
      })),
      operationCount: plan.operations.length,
      operationTypes: {
        upsertPlace: plan.operations.filter(o => o.type === 'upsertPlace').length,
        uploadFacade: plan.operations.filter(o => o.type === 'uploadFacade').length,
        upsertPhoto: plan.operations.filter(o => o.type === 'upsertPhoto').length,
      },
    }, null, 2));
    process.exit(0);
  }

  // Apply mode
  if (applyMode) {
    // Check required environment
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const facadeJpegPath = process.env.G1_FACADE_JPEG_PATH;

    if (!supabaseUrl) {
      console.error('Error: SUPABASE_URL environment variable is required for --apply mode');
      process.exit(1);
    }
    if (!serviceRoleKey) {
      console.error('Error: SUPABASE_SERVICE_ROLE_KEY environment variable is required for --apply mode');
      process.exit(1);
    }
    if (!facadeJpegPath) {
      console.error('Error: G1_FACADE_JPEG_PATH environment variable is required for --apply mode');
      process.exit(1);
    }

    // Check production safety
    try {
      rejectUnsafeTarget(supabaseUrl, allowProduction);
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }

    // Read facade JPEG
    let facadeBytes;
    try {
      facadeBytes = new Uint8Array(await readFile(facadeJpegPath));
    } catch (error) {
      console.error(`Error: Cannot read facade JPEG at "${facadeJpegPath}": ${error.message}`);
      process.exit(1);
    }

    if (facadeBytes.length === 0) {
      console.error('Error: Facade JPEG file is empty');
      process.exit(1);
    }

    // Create adapter and apply
    let adapter;
    try {
      adapter = await createSupabaseAdapter(supabaseUrl, serviceRoleKey);
    } catch (error) {
      console.error(`Error: Failed to create Supabase adapter: ${error.message}`);
      process.exit(1);
    }

    const summary = await applyPlan(plan, adapter, facadeBytes);

    // Print summary (no secrets)
    console.log(JSON.stringify({
      mode: 'apply',
      totalOperations: summary.totalOperations,
      completedOperations: summary.completedOperations,
      failedOperations: summary.failedOperations,
      errors: summary.errors,
      verification: summary.verification,
    }, null, 2));

    if (summary.failedOperations > 0) {
      process.exit(1);
    }
    process.exit(0);
  }

  // No mode specified defaults to plan
  console.log(JSON.stringify({
    mode: 'plan',
    fixtures: fixtures.map(f => ({
      id: f.id,
      slug: f.slug,
      name: f.name,
      category: f.category,
      lat: f.lat,
      lng: f.lng,
      publicationState: f.publicationState,
      pinState: f.pinState,
      facadePath: f.facadePath,
    })),
    operationCount: plan.operations.length,
    operationTypes: {
      upsertPlace: plan.operations.filter(o => o.type === 'upsertPlace').length,
      uploadFacade: plan.operations.filter(o => o.type === 'uploadFacade').length,
      upsertPhoto: plan.operations.filter(o => o.type === 'upsertPhoto').length,
    },
  }, null, 2));
  process.exit(0);
}

main().catch(error => {
  console.error(`Unexpected error: ${error.message}`);
  process.exit(1);
});
