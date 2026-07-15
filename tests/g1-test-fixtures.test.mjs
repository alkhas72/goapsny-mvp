// tests/g1-test-fixtures.test.mjs
// Offline tests for G1 test fixtures library

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  fixtures,
  validateFixtureSet,
  buildDeterministicPlan,
  rejectUnsafeTarget,
  applyPlan,
  rawFixtures,
} from '../scripts/lib/g1-test-fixtures.mjs';

// ============================================================================
// FIXTURE STRUCTURE TESTS
// ============================================================================

describe('fixture collection', () => {
  it('should export exactly 4 fixtures', () => {
    assert.strictEqual(fixtures.length, 4);
  });

  it('should have all fixtures frozen (immutable)', () => {
    assert.ok(Object.isFrozen(fixtures));
    assert.ok(Object.isFrozen(rawFixtures));
    for (const f of fixtures) {
      assert.ok(Object.isFrozen(f));
    }
  });

  it('should contain all required slugs', () => {
    const slugs = fixtures.map(f => f.slug);
    assert.ok(slugs.includes('published-gray'));
    assert.ok(slugs.includes('published-colored'));
    assert.ok(slugs.includes('pending-gray'));
    assert.ok(slugs.includes('hidden-rejected'));
  });

  it('should have correct properties for published-gray', () => {
    const f = fixtures.find(f => f.slug === 'published-gray');
    assert.strictEqual(f.category, 'cafe');
    assert.strictEqual(f.publicationState, 'published');
    assert.strictEqual(f.pinState, 'gray');
    assert.strictEqual(f.facadePath, 'g1/published-gray/facade.jpg');
    assert.ok(typeof f.name === 'string' && f.name.length > 0);
  });

  it('should have correct properties for published-colored', () => {
    const f = fixtures.find(f => f.slug === 'published-colored');
    assert.strictEqual(f.category, 'pharmacy');
    assert.strictEqual(f.publicationState, 'published');
    assert.strictEqual(f.pinState, 'colored');
    assert.strictEqual(f.facadePath, 'g1/published-colored/facade.jpg');
  });

  it('should have correct properties for pending-gray', () => {
    const f = fixtures.find(f => f.slug === 'pending-gray');
    assert.strictEqual(f.category, 'shop');
    assert.strictEqual(f.publicationState, 'pending');
    assert.strictEqual(f.pinState, 'gray');
    assert.strictEqual(f.facadePath, 'g1/pending-gray/facade.jpg');
  });

  it('should have correct properties for hidden-rejected', () => {
    const f = fixtures.find(f => f.slug === 'hidden-rejected');
    assert.strictEqual(f.category, 'other');
    assert.strictEqual(f.publicationState, 'rejected');
    assert.strictEqual(f.pinState, 'gray');
    assert.strictEqual(f.facadePath, 'g1/hidden-rejected/facade.jpg');
  });

  it('should have coordinates around Sukhumi', () => {
    for (const f of fixtures) {
      assert.ok(f.lat >= 42.8 && f.lat <= 43.0, `lat ${f.lat} out of range for ${f.slug}`);
      assert.ok(f.lng >= 41.0 && f.lng <= 41.2, `lng ${f.lng} out of range for ${f.slug}`);
    }
  });

  it('should have stable UUID-like ids', () => {
    for (const f of fixtures) {
      assert.ok(f.id.length >= 30, `id too short for ${f.slug}: ${f.id}`);
      assert.ok(/^[a-f0-9-]+$/.test(f.id), `id not UUID-like for ${f.slug}: ${f.id}`);
    }
  });
});

// ============================================================================
// VALIDATION TESTS
// ============================================================================

describe('validateFixtureSet', () => {
  it('should validate the default fixture set successfully', () => {
    const result = validateFixtureSet();
    assert.ok(result.valid);
    assert.strictEqual(result.errors.length, 0);
  });

  it('should detect duplicate ids', () => {
    const badSet = [
      { ...fixtures[0], id: 'same-id' },
      { ...fixtures[1], id: 'same-id' },
      fixtures[2],
      fixtures[3],
    ];
    const result = validateFixtureSet(badSet);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('Duplicate id')));
  });

  it('should detect duplicate slugs', () => {
    const badSet = [
      { ...fixtures[0], slug: 'duplicate' },
      { ...fixtures[1], slug: 'duplicate' },
      fixtures[2],
      fixtures[3],
    ];
    const result = validateFixtureSet(badSet);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('Duplicate slug')));
  });

  it('should detect duplicate facade paths', () => {
    const badSet = [
      { ...fixtures[0], facadePath: 'same/path.jpg' },
      { ...fixtures[1], facadePath: 'same/path.jpg' },
      fixtures[2],
      fixtures[3],
    ];
    const result = validateFixtureSet(badSet);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('Duplicate facadePath')));
  });

  it('should detect out-of-range latitude', () => {
    const badSet = [
      { ...fixtures[0], lat: 90 },
      fixtures[1],
      fixtures[2],
      fixtures[3],
    ];
    const result = validateFixtureSet(badSet);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('lat') && e.includes('out of range')));
  });

  it('should detect out-of-range longitude', () => {
    const badSet = [
      { ...fixtures[0], lng: 180 },
      fixtures[1],
      fixtures[2],
      fixtures[3],
    ];
    const result = validateFixtureSet(badSet);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('lng') && e.includes('out of range')));
  });

  it('should detect missing required visibility cases', () => {
    // Remove one fixture to miss a case
    const badSet = fixtures.slice(0, 3);
    const result = validateFixtureSet(badSet);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('Missing required visibility case')));
  });

  it('should detect wrong count', () => {
    const badSet = fixtures.slice(0, 2);
    const result = validateFixtureSet(badSet);
    assert.ok(!result.valid);
    assert.ok(result.errors.some(e => e.includes('Expected exactly 4 fixtures')));
  });
});

// ============================================================================
// DETERMINISTIC PLAN TESTS
// ============================================================================

describe('buildDeterministicPlan', () => {
  it('should return stable operation order across calls', () => {
    const plan1 = buildDeterministicPlan();
    const plan2 = buildDeterministicPlan();
    
    assert.strictEqual(plan1.operations.length, plan2.operations.length);
    for (let i = 0; i < plan1.operations.length; i++) {
      assert.strictEqual(plan1.operations[i].type, plan2.operations[i].type);
      assert.strictEqual(plan1.operations[i].id, plan2.operations[i].id);
    }
  });

  it('should have exactly 12 operations (4 places x 3 ops each)', () => {
    const plan = buildDeterministicPlan();
    assert.strictEqual(plan.operations.length, 12);
  });

  it('should have correct operation sequence per fixture', () => {
    const plan = buildDeterministicPlan();
    const fixtureIds = fixtures.map(f => f.id);
    
    for (const f of fixtures) {
      // Find all operations for this fixture
      const fixtureOps = plan.operations.filter(op => 
        op.id === f.id || 
        (op.type === 'uploadFacade' && op.payload.fixtureId === f.id) ||
        (op.type === 'upsertPhoto' && op.payload.placeId === f.id)
      );
      
      assert.strictEqual(fixtureOps.length, 3);
      assert.strictEqual(fixtureOps[0].type, 'upsertPlace');
      assert.strictEqual(fixtureOps[1].type, 'uploadFacade');
      assert.strictEqual(fixtureOps[2].type, 'upsertPhoto');
    }
  });

  it('should include fixturesById and fixturesBySlug maps', () => {
    const plan = buildDeterministicPlan();
    assert.ok(plan.fixturesById instanceof Map);
    assert.ok(plan.fixturesBySlug instanceof Map);
    assert.strictEqual(plan.fixturesById.size, 4);
    assert.strictEqual(plan.fixturesBySlug.size, 4);
    
    for (const f of fixtures) {
      assert.ok(plan.fixturesById.has(f.id));
      assert.ok(plan.fixturesBySlug.has(f.slug));
    }
  });

  it('should freeze the operations array', () => {
    const plan = buildDeterministicPlan();
    assert.ok(Object.isFrozen(plan.operations));
  });
});

// ============================================================================
// PRODUCTION GUARD TESTS
// ============================================================================

describe('rejectUnsafeTarget', () => {
  it('should not throw for non-production target', () => {
    assert.doesNotThrow(() => rejectUnsafeTarget('http://localhost:3000'));
    assert.doesNotThrow(() => rejectUnsafeTarget('dev-goapsny.vercel.app'));
    assert.doesNotThrow(() => rejectUnsafeTarget('staging.example.com'));
  });

  it('should throw for goapsny-mvp in URL', () => {
    assert.throws(
      () => rejectUnsafeTarget('https://goapsny-mvp.vercel.app'),
      /Unsafe target.*production-like/
    );
  });

  it('should throw for prod in URL', () => {
    assert.throws(
      () => rejectUnsafeTarget('https://prod.supabase.co'),
      /Unsafe target.*production-like/
    );
  });

  it('should throw for goapsny.app', () => {
    assert.throws(
      () => rejectUnsafeTarget('https://goapsny.app'),
      /Unsafe target.*production-like/
    );
  });

  it('should allow production with explicit override', () => {
    assert.doesNotThrow(() => 
      rejectUnsafeTarget('https://goapsny-mvp.vercel.app', true)
    );
    assert.doesNotThrow(() => 
      rejectUnsafeTarget('https://prod.supabase.co', true)
    );
  });

  it('should be case-insensitive', () => {
    assert.throws(
      () => rejectUnsafeTarget('https://GOAPSNY-MVP.vercel.app'),
      /Unsafe target.*production-like/
    );
    assert.throws(
      () => rejectUnsafeTarget('https://GoApSnY-mVp.example.com'),
      /Unsafe target.*production-like/
    );
  });
});

// ============================================================================
// APPLY PLAN TESTS
// ============================================================================

describe('applyPlan', () => {
  const mockFacadeBytes = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG magic bytes

  it('should throw if adapter missing required method', async () => {
    const plan = buildDeterministicPlan();
    const badAdapter = {
      upsertPlace: async () => ({}),
      // missing uploadFacade, upsertPhoto, verify
    };
    
    await assert.rejects(
      applyPlan(plan, badAdapter, mockFacadeBytes),
      /Adapter missing required method/
    );
  });

  it('should execute all operations successfully with fake adapter', async () => {
    const plan = buildDeterministicPlan();
    const callLog = [];
    
    const fakeAdapter = {
      upsertPlace: async (place) => {
        callLog.push({ type: 'upsertPlace', payload: place });
        return { id: place.id };
      },
      uploadFacade: async (path, bytes) => {
        callLog.push({ type: 'uploadFacade', path, bytesLength: bytes.length });
        return { path };
      },
      upsertPhoto: async (photo) => {
        callLog.push({ type: 'upsertPhoto', payload: photo });
        return { id: photo.placeId };
      },
      verify: async () => {
        callLog.push({ type: 'verify' });
        return { status: 'ok', seededCount: 4 };
      },
    };

    const summary = await applyPlan(plan, fakeAdapter, mockFacadeBytes);
    
    assert.strictEqual(summary.totalOperations, 12);
    assert.strictEqual(summary.completedOperations, 12);
    assert.strictEqual(summary.failedOperations, 0);
    assert.strictEqual(summary.errors.length, 0);
    assert.ok(summary.verification);
    assert.strictEqual(summary.verification.status, 'ok');
    
    // Check call order
    assert.strictEqual(callLog.length, 13); // 12 ops + 1 verify
    assert.strictEqual(callLog[0].type, 'upsertPlace');
    assert.strictEqual(callLog[1].type, 'uploadFacade');
    assert.strictEqual(callLog[2].type, 'upsertPhoto');
    assert.strictEqual(callLog[12].type, 'verify');
  });

  it('should stop on first failure and not run verification', async () => {
    const plan = buildDeterministicPlan();
    const callLog = [];
    
    const failingAdapter = {
      upsertPlace: async (place) => {
        callLog.push({ type: 'upsertPlace', payload: place });
        if (place.id === fixtures[0].id) {
          throw new Error('Simulated failure');
        }
        return { id: place.id };
      },
      uploadFacade: async () => {
        callLog.push({ type: 'uploadFacade' });
        return {};
      },
      upsertPhoto: async () => {
        callLog.push({ type: 'upsertPhoto' });
        return {};
      },
      verify: async () => {
        callLog.push({ type: 'verify' });
        return { status: 'ok' };
      },
    };

    const summary = await applyPlan(plan, failingAdapter, mockFacadeBytes);
    
    assert.strictEqual(summary.failedOperations, 1);
    assert.strictEqual(summary.completedOperations, 0);
    assert.strictEqual(summary.errors.length, 1);
    assert.ok(summary.errors[0].includes('failed'));
    assert.strictEqual(callLog.length, 1); // Only first upsertPlace was called
    assert.ok(!summary.verification); // No verification run
  });

  it('should fail if facade bytes are empty', async () => {
    const plan = buildDeterministicPlan();
    const callLog = [];
    
    const adapter = {
      upsertPlace: async (place) => {
        callLog.push({ type: 'upsertPlace' });
        return { id: place.id };
      },
      uploadFacade: async (path, bytes) => {
        callLog.push({ type: 'uploadFacade' });
        return {};
      },
      upsertPhoto: async () => {
        callLog.push({ type: 'upsertPhoto' });
        return {};
      },
      verify: async () => ({ status: 'ok' }),
    };

    const emptyBytes = new Uint8Array([]);
    const summary = await applyPlan(plan, adapter, emptyBytes);
    
    assert.strictEqual(summary.failedOperations, 1);
    assert.strictEqual(summary.completedOperations, 1); // First upsertPlace succeeded
    assert.ok(summary.errors[0].includes('No facade bytes'));
  });

  it('should fail if facade bytes are not provided', async () => {
    const plan = buildDeterministicPlan();
    const callLog = [];
    
    const adapter = {
      upsertPlace: async (place) => {
        callLog.push({ type: 'upsertPlace' });
        return { id: place.id };
      },
      uploadFacade: async (path, bytes) => {
        callLog.push({ type: 'uploadFacade' });
        return {};
      },
      upsertPhoto: async () => {
        callLog.push({ type: 'upsertPhoto' });
        return {};
      },
      verify: async () => ({ status: 'ok' }),
    };

    const summary = await applyPlan(plan, adapter, undefined);
    
    assert.strictEqual(summary.failedOperations, 1);
    assert.strictEqual(summary.completedOperations, 1);
    assert.ok(summary.errors[0].includes('No facade bytes'));
  });

  it('should produce identical calls on repeated apply (idempotency)', async () => {
    const plan = buildDeterministicPlan();
    
    let firstCallLog = null;
    
    const adapter = {
      upsertPlace: async (place) => {
        if (firstCallLog === null) {
          firstCallLog = [];
        }
        firstCallLog.push({ type: 'upsertPlace', id: place.id });
        return { id: place.id };
      },
      uploadFacade: async (path, bytes) => {
        firstCallLog.push({ type: 'uploadFacade', path });
        return {};
      },
      upsertPhoto: async (photo) => {
        firstCallLog.push({ type: 'upsertPhoto', placeId: photo.placeId });
        return {};
      },
      verify: async () => ({ status: 'ok' }),
    };

    // First apply
    const firstSummary = await applyPlan(plan, adapter, mockFacadeBytes);
    assert.strictEqual(firstSummary.failedOperations, 0);
    
    // Second apply - should produce same call sequence
    const secondCallLog = [];
    const adapter2 = {
      upsertPlace: async (place) => {
        secondCallLog.push({ type: 'upsertPlace', id: place.id });
        return { id: place.id };
      },
      uploadFacade: async (path, bytes) => {
        secondCallLog.push({ type: 'uploadFacade', path });
        return {};
      },
      upsertPhoto: async (photo) => {
        secondCallLog.push({ type: 'upsertPhoto', placeId: photo.placeId });
        return {};
      },
      verify: async () => ({ status: 'ok' }),
    };
    
    const secondSummary = await applyPlan(plan, adapter2, mockFacadeBytes);
    assert.strictEqual(secondSummary.failedOperations, 0);
    
    // Compare call sequences
    assert.strictEqual(firstCallLog.length, secondCallLog.length);
    for (let i = 0; i < firstCallLog.length; i++) {
      assert.deepStrictEqual(firstCallLog[i], secondCallLog[i]);
    }
  });

  it('should propagate adapter errors safely', async () => {
    const plan = buildDeterministicPlan();
    
    const errorAdapter = {
      upsertPlace: async (place) => {
        throw new Error('Database connection failed');
      },
      uploadFacade: async () => ({}),
      upsertPhoto: async () => ({}),
      verify: async () => ({}),
    };

    const summary = await applyPlan(plan, errorAdapter, mockFacadeBytes);
    
    assert.strictEqual(summary.failedOperations, 1);
    assert.strictEqual(summary.completedOperations, 0);
    assert.ok(summary.errors[0].includes('Database connection failed'));
  });

  it('should handle verification failure', async () => {
    const plan = buildDeterministicPlan();
    
    const failingVerifyAdapter = {
      upsertPlace: async (place) => ({ id: place.id }),
      uploadFacade: async () => ({}),
      upsertPhoto: async () => ({}),
      verify: async () => {
        throw new Error('Verification query failed');
      },
    };

    const summary = await applyPlan(plan, failingVerifyAdapter, mockFacadeBytes);
    
    assert.strictEqual(summary.completedOperations, 12);
    assert.strictEqual(summary.failedOperations, 1);
    assert.ok(summary.errors.some(e => e.includes('Verification failed')));
  });
});

// ============================================================================
// IMMUTABILITY TESTS
// ============================================================================

describe('immutability', () => {
  it('should not allow modification of exported fixtures array', () => {
    assert.throws(() => {
      fixtures.push({ id: 'new', slug: 'new' });
    }, /Cannot add property/);
  });

  it('should not allow modification of individual fixture objects', () => {
    const f = fixtures[0];
    assert.throws(() => {
      f.name = 'Modified';
    }, /Cannot assign to read only property/);
  });

  it('should return frozen plan objects', () => {
    const plan = buildDeterministicPlan();
    assert.throws(() => {
      plan.operations.push({ type: 'fake', id: 'fake' });
    }, /Cannot add property/);
  });
});

// ============================================================================
// OFFLINE CLI SMOKE TEST
// ============================================================================

describe('CLI offline smoke test', () => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const seedScriptPath = path.resolve(__dirname, '../scripts/seed-g1-test-data.mjs');

  it('should output valid JSON plan with --plan flag offline', async () => {
    // Remove apply-related env vars to ensure offline mode
    const env = {
      ...process.env,
    };
    delete env.SUPABASE_URL;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    delete env.G1_FACADE_JPEG_PATH;

    const child = spawn(process.execPath, [seedScriptPath, '--plan'], {
      env,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.strictEqual(exitCode, 0, `CLI exited with code ${exitCode}. stderr: ${stderr}`);
    assert.strictEqual(stderr, '', `CLI produced stderr: ${stderr}`);

    const output = JSON.parse(stdout);
    assert.strictEqual(output.mode, 'plan');
    assert.strictEqual(output.fixtures.length, 4);
    assert.strictEqual(output.operationCount, 12);
    assert.ok(output.operationTypes.upsertPlace === 4);
    assert.ok(output.operationTypes.uploadFacade === 4);
    assert.ok(output.operationTypes.upsertPhoto === 4);
  });

  it('should reject simultaneous --plan and --apply flags', async () => {
    const env = {
      ...process.env,
    };
    delete env.SUPABASE_URL;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    delete env.G1_FACADE_JPEG_PATH;

    const child = spawn(process.execPath, [seedScriptPath, '--plan', '--apply'], {
      env,
      stdio: 'pipe',
    });

    let stderr = '';
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.notStrictEqual(exitCode, 0, 'CLI should fail with both --plan and --apply');
    assert.ok(stderr.includes('Cannot specify both'), `Expected error message in stderr: ${stderr}`);
  });

  it('should default to plan mode with no flags', async () => {
    const env = {
      ...process.env,
    };
    delete env.SUPABASE_URL;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    delete env.G1_FACADE_JPEG_PATH;

    const child = spawn(process.execPath, [seedScriptPath], {
      env,
      stdio: 'pipe',
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });

    const exitCode = await new Promise((resolve) => {
      child.on('close', resolve);
    });

    assert.strictEqual(exitCode, 0, `CLI exited with code ${exitCode}. stderr: ${stderr}`);
    const output = JSON.parse(stdout);
    assert.strictEqual(output.mode, 'plan');
  });
});
