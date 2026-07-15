import { T1_SMOKE_FIXTURES } from '../fixtures/t1-smoke-fixtures.mjs';

/** Fixture keys that must be present before anon positive proofs run. */
export const REQUIRED_FIXTURE_FIELDS = [
  ['gray published place', 'gray'],
  ['colored published place', 'colored'],
  ['hidden place', 'hidden'],
  ['pending place', 'pending'],
  ['gray published facade path', 'grayFacadePath'],
  ['colored published facade path', 'coloredFacadePath'],
  ['pending facade path', 'pendingFacadePath'],
  ['hidden facade path', 'hiddenFacadePath'],
];

export function isFacadeMetadataDenied(error, data) {
  return !error && !data;
}

export function isSignedUrlDenied(signError, signedData) {
  return Boolean(signError) || !signedData?.signedUrl;
}

export function isBucketPrivate(bucket) {
  return Boolean(bucket) && bucket.public === false;
}

export function isStorageListDenied(error, data) {
  if (error) return true;
  return (data?.length ?? 0) === 0;
}

export function isStorageUploadDenied(error) {
  return Boolean(error);
}

export function stableFixturePaths() {
  return {
    grayFacadePath: T1_SMOKE_FIXTURES.grayFacadePath,
    coloredFacadePath: T1_SMOKE_FIXTURES.coloredFacadePath,
    pendingFacadePath: T1_SMOKE_FIXTURES.pendingFacadePath,
    hiddenFacadePath: T1_SMOKE_FIXTURES.hiddenFacadePath,
  };
}
