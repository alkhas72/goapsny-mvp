import { describe, expect, it, vi } from 'vitest';
import {
  FACADE_MIME_TYPE,
  FACADE_PHOTO_FILENAME,
  FACADE_STORAGE_BUCKET,
  SUBMIT_PUBLIC_PLACE_RPC,
  SubmitPlaceError,
  type SubmitPublicPlaceOptions,
  classifySubmitError,
  facadeStoragePath,
  generatePlaceId,
  isPlaceId,
  submitPublicPlace,
} from './submit-place';

const UUID_A = '11111111-1111-4111-8111-111111111111';

/**
 * Structural shape of the Supabase surface exercised by submitPublicPlace.
 * Only the two methods actually called are implemented, so no `any` cast is
 * needed when injecting the fake into the typed `SubmitPublicPlaceOptions`.
 */
type SubmitSupabaseLike = {
  storage: { from: (bucket: string) => { upload: (path: string, body: Blob, opts: unknown) => Promise<unknown> } };
  rpc: (fn: string, args: unknown) => Promise<unknown>;
};

/** Minimal fake of the Supabase surface used by submitPublicPlace. */
function makeFakeSupabase(options: {
  uploadError?: { message: string } | null;
  rpcError?: { code: string; message: string } | null;
  rpcData?: unknown;
} = {}) {
  const upload = vi.fn().mockResolvedValue({ data: { path: 'x' }, error: options.uploadError ?? null });
  const rpc = vi.fn().mockResolvedValue({ data: options.rpcData ?? null, error: options.rpcError ?? null });
  const client: SubmitSupabaseLike = {
    storage: { from: vi.fn(() => ({ upload })) },
    rpc,
  };
  return { client, upload, rpc };
}

/** Cast helper: the fake only implements the structural slice submitPublicPlace touches. */
function asSupabase(client: SubmitSupabaseLike): SubmitPublicPlaceOptions['supabase'] {
  return client as unknown as SubmitPublicPlaceOptions['supabase'];
}

const validInput = {
  name: 'Кафе у моря',
  category: 'food',
  lat: 43.00085,
  lng: 41.0159,
  photo: new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
};

describe('facadeStoragePath', () => {
  it('builds the exact {place_id}/facade.jpg path the RPC revalidates', () => {
    expect(facadeStoragePath(UUID_A)).toBe(`${UUID_A}/facade.jpg`);
    expect(FACADE_PHOTO_FILENAME).toBe('facade.jpg');
  });
});

describe('place id generation', () => {
  it('generates a valid lowercase UUID usable as the first path segment', () => {
    const id = generatePlaceId();
    expect(isPlaceId(id)).toBe(true);
    expect(facadeStoragePath(id)).toMatch(/^[0-9a-f-]{36}\/facade\.jpg$/);
  });

  it('isPlaceId rejects non-uuid and malformed shapes', () => {
    expect(isPlaceId('not-a-uuid')).toBe(false);
    expect(isPlaceId(UUID_A)).toBe(true);
    // The Storage/RPC canonical path regex requires a full 36-char uuid;
    // it does not enforce the RFC version digit, so any 8-4-4-4-12 hex passes.
    expect(isPlaceId('11111111-1111-1111-1111-111111111111')).toBe(true);
    expect(isPlaceId('111111111111111111111111111111111111')).toBe(false);
    expect(isPlaceId('11111111-1111-1111-8111-111111111111-extra')).toBe(false);
  });
});

describe('classifySubmitError', () => {
  it('maps each RPC SQLSTATE + message to a stable kind', () => {
    const cases: Array<{ code: string; message: string; kind: string }> = [
      { code: '42501', message: 'submit_public_place: authentication required', kind: 'auth_required' },
      { code: '42501', message: 'submit_public_place: profile not found', kind: 'profile_required' },
      { code: '42501', message: 'submit_public_place: caller must be public_user', kind: 'role_required' },
      { code: '23502', message: 'submit_public_place: name is required', kind: 'name_required' },
      { code: '23503', message: 'submit_public_place: inactive or unknown category', kind: 'category_invalid' },
      { code: '23503', message: 'submit_public_place: owned facade object not found', kind: 'facade_object_missing' },
      { code: '23505', message: 'submit_public_place: public submission already used', kind: 'already_submitted' },
      { code: '23505', message: 'submit_public_place: place_id already used', kind: 'place_id_reused' },
      { code: '23505', message: 'submit_public_place: facade already indexed', kind: 'facade_reused' },
      { code: '22P02', message: 'submit_public_place: invalid coordinates', kind: 'coordinates_invalid' },
      { code: '22P02', message: 'submit_public_place: storage_path must equal {place_id}/facade.jpg', kind: 'storage_path_invalid' },
    ];
    for (const { code, message, kind } of cases) {
      const err = classifySubmitError({ code, message });
      expect(err.kind, message).toBe(kind);
      expect(err.code).toBe(code);
      expect(err).toBeInstanceOf(SubmitPlaceError);
    }
  });

  it('falls back to SQLSTATE kind on message drift, then unknown', () => {
    // Unmapped code -> unknown regardless of message.
    expect(classifySubmitError({ code: '42P01', message: 'syntax error' }).kind).toBe('unknown');
    // Mapped SQLSTATE with drifted message -> still classified by the code
    // (defensive against RPC message wording changes).
    expect(classifySubmitError({ code: '23505', message: 'something else unique' }).kind).toBe('already_submitted');
    expect(classifySubmitError({ code: '22P02', message: 'wat' }).kind).toBe('coordinates_invalid');
    // No shape at all -> unknown with null code.
    expect(classifySubmitError(null).kind).toBe('unknown');
    expect(classifySubmitError('boom').kind).toBe('unknown');
    expect(classifySubmitError(undefined).code).toBeNull();
  });
});

describe('submitPublicPlace', () => {
  it('throws not_configured when Supabase is not configured and no client is injected', async () => {
    await expect(submitPublicPlace(validInput)).rejects.toMatchObject({ kind: 'not_configured' });
  });

  it('uploads facade to the exact place-photos/{place_id}/facade.jpg path and calls the RPC with the exact signature', async () => {
    const fake = makeFakeSupabase();
    const result = await submitPublicPlace(validInput, {
      supabase: asSupabase(fake.client),
      generateId: () => UUID_A,
    });

    expect(result).toEqual({ placeId: UUID_A, storagePath: `${UUID_A}/facade.jpg` });

    // Storage: exact bucket + exact path + jpeg content type, no upsert.
    expect(fake.client.storage.from).toHaveBeenCalledWith(FACADE_STORAGE_BUCKET);
    expect(fake.upload).toHaveBeenCalledWith(
      `${UUID_A}/facade.jpg`,
      validInput.photo,
      expect.objectContaining({ contentType: FACADE_MIME_TYPE, upsert: false }),
    );
    expect(FACADE_MIME_TYPE).toBe('image/jpeg');

    // RPC: exact name + exact argument keys matching submit_public_place(p_place_id, p_name, p_category, p_lat, p_lng, p_storage_path).
    expect(fake.rpc).toHaveBeenCalledWith(SUBMIT_PUBLIC_PLACE_RPC, {
      p_place_id: UUID_A,
      p_name: validInput.name,
      p_category: validInput.category,
      p_lat: validInput.lat,
      p_lng: validInput.lng,
      p_storage_path: `${UUID_A}/facade.jpg`,
    });
    expect(SUBMIT_PUBLIC_PLACE_RPC).toBe('submit_public_place');
  });

  it('maps a facade upload failure to missing_photo and never calls the RPC', async () => {
    const fake = makeFakeSupabase({ uploadError: { message: 'The resource already exists' } });
    await expect(
      submitPublicPlace(validInput, { supabase: asSupabase(fake.client), generateId: () => UUID_A }),
    ).rejects.toMatchObject({ kind: 'missing_photo' });
    expect(fake.rpc).not.toHaveBeenCalled();
  });

  it('classifies an RPC failure deterministically and surfaces its SQLSTATE', async () => {
    const fake = makeFakeSupabase({
      rpcError: { code: '23505', message: 'submit_public_place: public submission already used' },
    });
    await expect(
      submitPublicPlace(validInput, { supabase: asSupabase(fake.client), generateId: () => UUID_A }),
    ).rejects.toMatchObject({ kind: 'already_submitted', code: '23505' });
  });

  it('passes finite lat/lng through as numbers (double precision params)', async () => {
    const fake = makeFakeSupabase();
    await submitPublicPlace(validInput, { supabase: asSupabase(fake.client), generateId: () => UUID_A });
    const args = fake.rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(typeof args.p_lat).toBe('number');
    expect(typeof args.p_lng).toBe('number');
    expect(args.p_lat).toBeCloseTo(43.00085, 5);
    expect(args.p_lng).toBeCloseTo(41.0159, 5);
  });
});
