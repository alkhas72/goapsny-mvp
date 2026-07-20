// scripts/lib/g1-test-fixtures.mjs
// Deterministic G1 test fixtures library for GoApsny PWA test environment
// Offline-safe, no Supabase SDK calls

// ============================================================================
// FROZEN FIXTURE COLLECTION
// ============================================================================

/**
 * @typedef {Object} PlaceFixture
 * @property {string} id - Stable UUID-like identifier
 * @property {string} slug - URL-safe identifier
 * @property {string} name - Russian display name
 * @property {string} category - One of: cafe, pharmacy, shop, other
 * @property {number} lat - Latitude around Sukhumi (42.8-43.0, 41.0-41.2)
 * @property {number} lng - Longitude around Sukhumi
 * @property {'published' | 'pending' | 'rejected'} publicationState
 * @property {'gray' | 'colored'} pinState - gray for standard, colored for verified
 * @property {string} facadePath - Relative path to facade JPEG
 */

/** @type {readonly PlaceFixture[]} */
const rawFixtures = Object.freeze([
  {
    id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a110',
    slug: 'published-gray',
    name: 'Кафе Уют',
    category: 'cafe',
    lat: 42.8748,
    lng: 41.0236,
    publicationState: 'published',
    pinState: 'gray',
    facadePath: 'g1/published-gray/facade.jpg',
  },
  {
    id: 'b1ffc999-8d1c-4fc9-aa7e-7cc9ce391b22',
    slug: 'published-colored',
    name: 'Аптека Здоровье',
    category: 'pharmacy',
    lat: 42.8701,
    lng: 41.0184,
    publicationState: 'published',
    pinState: 'colored',
    facadePath: 'g1/published-colored/facade.jpg',
  },
  {
    id: 'c2dddc00-7e2d-4bb0-bb8f-8dd0de402c33',
    slug: 'pending-gray',
    name: 'Магазин Угловой',
    category: 'shop',
    lat: 42.8655,
    lng: 41.0278,
    publicationState: 'pending',
    pinState: 'gray',
    facadePath: 'g1/pending-gray/facade.jpg',
  },
  {
    id: 'd3eeec11-6f3e-4bc1-9c9f-9ee1ef513d44',
    slug: 'hidden-rejected',
    name: 'Объект Скрытый',
    category: 'other',
    lat: 42.8800,
    lng: 41.0300,
    publicationState: 'rejected',
    pinState: 'gray',
    facadePath: 'g1/hidden-rejected/facade.jpg',
  },
]);

// Deep-freeze each fixture object first
const frozenFixtures = rawFixtures.map(f => Object.freeze(f));

// Frozen exported collection
/** @type {readonly PlaceFixture[]} */
export const fixtures = Object.freeze(frozenFixtures);

// ============================================================================
// VALIDATION
// ============================================================================

/** @typedef {Object} ValidationResult
 * @property {boolean} valid
 * @property {string[]} errors
 */

// Valid coordinate ranges for Sukhumi area
const VALID_LAT_MIN = 42.8;
const VALID_LAT_MAX = 43.0;
const VALID_LNG_MIN = 41.0;
const VALID_LNG_MAX = 41.2;

// Required visibility cases (publicationState + pinState combinations)
const REQUIRED_CASES = new Set([
  'published-gray',
  'published-colored',
  'pending-gray',
  'rejected-gray',
]);

/**
 * Validate the entire fixture set.
 * @param {readonly PlaceFixture[]} [set=fixtures]
 * @returns {ValidationResult}
 */
export function validateFixtureSet(set = fixtures) {
  const errors = [];

  // Check exact count
  if (set.length !== 4) {
    errors.push(`Expected exactly 4 fixtures, got ${set.length}`);
  }

  const seenIds = new Set();
  const seenSlugs = new Set();
  const seenPaths = new Set();
  const seenCases = new Set();

  for (const f of set) {
    // Type checks
    if (typeof f.id !== 'string' || f.id.length === 0) {
      errors.push(`Fixture has invalid id: ${JSON.stringify(f.id)}`);
    }
    if (typeof f.slug !== 'string' || f.slug.length === 0) {
      errors.push(`Fixture has invalid slug: ${JSON.stringify(f.slug)}`);
    }
    if (typeof f.name !== 'string' || f.name.length === 0) {
      errors.push(`Fixture has invalid name: ${JSON.stringify(f.name)}`);
    }
    if (typeof f.category !== 'string' || f.category.length === 0) {
      errors.push(`Fixture has invalid category: ${JSON.stringify(f.category)}`);
    }
    if (typeof f.lat !== 'number' || isNaN(f.lat)) {
      errors.push(`Fixture has invalid lat: ${JSON.stringify(f.lat)}`);
    }
    if (typeof f.lng !== 'number' || isNaN(f.lng)) {
      errors.push(`Fixture has invalid lng: ${JSON.stringify(f.lng)}`);
    }
    if (typeof f.publicationState !== 'string') {
      errors.push(`Fixture has invalid publicationState: ${JSON.stringify(f.publicationState)}`);
    }
    if (typeof f.pinState !== 'string') {
      errors.push(`Fixture has invalid pinState: ${JSON.stringify(f.pinState)}`);
    }
    if (typeof f.facadePath !== 'string' || f.facadePath.length === 0) {
      errors.push(`Fixture has invalid facadePath: ${JSON.stringify(f.facadePath)}`);
    }

    // Uniqueness
    if (seenIds.has(f.id)) {
      errors.push(`Duplicate id: ${f.id}`);
    } else {
      seenIds.add(f.id);
    }
    if (seenSlugs.has(f.slug)) {
      errors.push(`Duplicate slug: ${f.slug}`);
    } else {
      seenSlugs.add(f.slug);
    }
    if (seenPaths.has(f.facadePath)) {
      errors.push(`Duplicate facadePath: ${f.facadePath}`);
    } else {
      seenPaths.add(f.facadePath);
    }

    // Coordinate validation
    if (f.lat < VALID_LAT_MIN || f.lat > VALID_LAT_MAX) {
      errors.push(`Fixture "${f.slug}" lat ${f.lat} out of range [${VALID_LAT_MIN}, ${VALID_LAT_MAX}]`);
    }
    if (f.lng < VALID_LNG_MIN || f.lng > VALID_LNG_MAX) {
      errors.push(`Fixture "${f.slug}" lng ${f.lng} out of range [${VALID_LNG_MIN}, ${VALID_LNG_MAX}]`);
    }

    // Case tracking
    const caseKey = `${f.publicationState}-${f.pinState}`;
    seenCases.add(caseKey);
  }

  // Check required visibility cases
  for (const requiredCase of REQUIRED_CASES) {
    if (!seenCases.has(requiredCase)) {
      errors.push(`Missing required visibility case: ${requiredCase}`);
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================================================
// DETERMINISTIC OPERATION PLAN
// ============================================================================

/**
 * @typedef {Object} Operation
 * @property {'upsertPlace' | 'uploadFacade' | 'upsertPhoto'} type
 * @property {string} id - For upsertPlace: place id; for uploadFacade/upsertPhoto: facadePath
 * @property {Object} [payload] - Additional data for the operation
 */

/**
 * @typedef {Object} OperationPlan
 * @property {Operation[]} operations - Deterministic ordered operations
 * @property {Map<string, PlaceFixture>} fixturesById
 * @property {Map<string, PlaceFixture>} fixturesBySlug
 */

/**
 * Build a deterministic operation plan from fixtures.
 * Order: sorted by id for determinism.
 * Each place: upsertPlace -> uploadFacade -> upsertPhoto
 * @param {readonly PlaceFixture[]} [set=fixtures]
 * @returns {OperationPlan}
 */
export function buildDeterministicPlan(set = fixtures) {
  // Sort by id for deterministic order
  const sorted = [...set].sort((a, b) => a.id.localeCompare(b.id));

  const operations = [];
  const fixturesById = new Map();
  const fixturesBySlug = new Map();

  for (const f of sorted) {
    fixturesById.set(f.id, f);
    fixturesBySlug.set(f.slug, f);

    // 1. Upsert the place record
    operations.push({
      type: 'upsertPlace',
      id: f.id,
      payload: {
        id: f.id,
        slug: f.slug,
        name: f.name,
        category: f.category,
        lat: f.lat,
        lng: f.lng,
        publicationState: f.publicationState,
        pinState: f.pinState,
        facadePath: f.facadePath,
      },
    });

    // 2. Upload facade image
    operations.push({
      type: 'uploadFacade',
      id: f.facadePath,
      payload: {
        path: f.facadePath,
        fixtureId: f.id,
      },
    });

    // 3. Upsert photo record referencing the uploaded facade
    operations.push({
      type: 'upsertPhoto',
      id: `${f.id}-photo`,
      payload: {
        placeId: f.id,
        path: f.facadePath,
        isPrimary: true,
      },
    });
  }

  return {
    operations: Object.freeze(operations),
    fixturesById: Object.freeze(new Map(fixturesById)),
    fixturesBySlug: Object.freeze(new Map(fixturesBySlug)),
  };
}

// ============================================================================
// PRODUCTION GUARD
// ============================================================================

/**
 * Production-like URL/host patterns that should be rejected.
 * @type {string[]}
 */
const PRODUCTION_PATTERNS = Object.freeze([
  'goapsny-mvp',
  'prod',
  'goapsny-mvp.vercel.app',
  'goapsny.app',
]);

/**
 * Check if a target (URL or reference) looks production-like.
 * @param {string} target
 * @returns {boolean}
 */
function isProductionLike(target) {
  const lower = target.toLowerCase();
  for (const pattern of PRODUCTION_PATTERNS) {
    if (lower.includes(pattern)) {
      return true;
    }
  }
  return false;
}

/**
 * Reject unsafe target before any write.
 * @param {string} target - Project URL or reference
 * @param {boolean} [allowProduction=false]
 * @returns {void}
 * @throws {Error} if target is production-like and not explicitly allowed
 */
export function rejectUnsafeTarget(target, allowProduction = false) {
  if (isProductionLike(target) && !allowProduction) {
    throw new Error(
      `Unsafe target: "${target}" appears production-like. ` +
        `Use --allow-production to override.`
    );
  }
}

// ============================================================================
// PLAN APPLICATION
// ============================================================================

/**
 * @typedef {Object} Adapter
 * @property {Function} upsertPlace - async (place: Object) => Object
 * @property {Function} uploadFacade - async (path: string, bytes: Uint8Array) => Object
 * @property {Function} upsertPhoto - async (photo: Object) => Object
 * @property {Function} verify - async () => Object verification result
 */

/**
 * @typedef {Object} ApplySummary
 * @property {number} totalOperations
 * @property {number} completedOperations
 * @property {number} failedOperations
 * @property {string[]} errors
 * @property {Object} [verification]
 */

/**
 * Apply the plan through an injected async adapter.
 * Operations are executed in order; stops on first failure.
 * Idempotent by stable IDs/paths.
 * @param {OperationPlan} plan
 * @param {Adapter} adapter
 * @param {Uint8Array} [facadeBytes]
 * @returns {Promise<ApplySummary>}
 */
export async function applyPlan(plan, adapter, facadeBytes) {
  const summary = {
    totalOperations: plan.operations.length,
    completedOperations: 0,
    failedOperations: 0,
    errors: [],
  };

  // Validate adapter has required methods
  const requiredMethods = ['upsertPlace', 'uploadFacade', 'upsertPhoto', 'verify'];
  for (const method of requiredMethods) {
    if (typeof adapter[method] !== 'function') {
      throw new Error(`Adapter missing required method: ${method}`);
    }
  }

  for (const op of plan.operations) {
    try {
      switch (op.type) {
        case 'upsertPlace':
          await adapter.upsertPlace(op.payload);
          summary.completedOperations++;
          break;
        case 'uploadFacade':
          if (!facadeBytes || facadeBytes.length === 0) {
            throw new Error(`No facade bytes provided for upload: ${op.payload.path}`);
          }
          await adapter.uploadFacade(op.payload.path, facadeBytes);
          summary.completedOperations++;
          break;
        case 'upsertPhoto':
          await adapter.upsertPhoto(op.payload);
          summary.completedOperations++;
          break;
        default:
          throw new Error(`Unknown operation type: ${op.type}`);
      }
    } catch (error) {
      summary.failedOperations++;
      summary.errors.push(`Operation ${op.type}(${JSON.stringify(op.id)}) failed: ${error.message}`);
      // Stop on first failure for safety
      break;
    }
  }

  // Run verification if we completed all operations
  if (summary.failedOperations === 0 && summary.completedOperations === summary.totalOperations) {
    try {
      summary.verification = await adapter.verify();
    } catch (error) {
      summary.errors.push(`Verification failed: ${error.message}`);
      summary.failedOperations++;
    }
  }

  return Object.freeze(summary);
}

// ============================================================================
// EXPORTS
// ============================================================================

export { rawFixtures };
export default fixtures;
