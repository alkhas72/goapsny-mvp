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

export const RESTRICTED_STORAGE_PREFIXES = [
  ['pending', T1_SMOKE_FIXTURES.pendingPlaceId],
  ['hidden', T1_SMOKE_FIXTURES.hiddenPlaceId],
];

export const PUBLISHED_STORAGE_PREFIX = T1_SMOKE_FIXTURES.grayPlaceId;

export function isFacadeMetadataDenied(error, data) {
  return !error && !data;
}

export function isSignedUrlDenied(signError, signedData) {
  return Boolean(signError) || !signedData?.signedUrl;
}

export function isBucketPrivate(bucket) {
  return Boolean(bucket) && bucket.public === false;
}

export function adminStorageObjectExists(error, data) {
  return !error && data != null;
}

export function isRestrictedStorageListingHidden(error, entries) {
  if (error) return true;
  return !(entries ?? []).some((entry) => entry.name === 'facade.jpg');
}

export function isRestrictedPrefixAbsentFromRootList(rootEntries, restrictedPrefix) {
  const names = (rootEntries ?? []).map((entry) => entry.name);
  return !names.includes(restrictedPrefix);
}

export function isPublishedStoragePrefixListed(error, entries) {
  if (error) return false;
  return (entries ?? []).some((entry) => entry.name === 'facade.jpg');
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
