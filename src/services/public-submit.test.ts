import { describe, expect, it } from 'vitest';
import { makeFakeSupabaseClient } from '../test/fake-supabase';
import {
  buildFacadeStoragePath,
  PHOTO_BUCKET,
  PUBLIC_SUBMIT_MODERATION_STATUS,
  PUBLIC_SUBMIT_SOURCE,
  PUBLIC_SUBMIT_STATUS,
  submitPublicPlace,
  uploadFacadePhoto,
} from '../test/g1-contract-harness';

describe('public place submission contract', () => {
  it('facade storage path is {place_id}/facade.jpg', () => {
    expect(buildFacadeStoragePath('a1111111-1111-4111-8111-111111111101')).toBe(
      'a1111111-1111-4111-8111-111111111101/facade.jpg',
    );
  });

  it('submitPublicPlace calls exact submit_public_place RPC shape', async () => {
    const client = makeFakeSupabaseClient({
      rpcHandlers: {
        submit_public_place: () => ({
          place_id: 'a1111111-1111-4111-8111-111111111102',
        }),
      },
    });

    const result = await submitPublicPlace(client, {
      name: 'Кафе',
      category: 'food',
      lat: 43,
      lng: 41,
      facade_path: 'a1111111-1111-4111-8111-111111111102/facade.jpg',
    });

    expect(result.place_id).toBe('a1111111-1111-4111-8111-111111111102');

    const call = client.calls.find((c) => c.method === 'rpc');
    expect(call?.args[0]).toBe('submit_public_place');
    expect(call?.args[1]).toEqual({
      name: 'Кафе',
      category: 'food',
      lat: 43,
      lng: 41,
      status: PUBLIC_SUBMIT_STATUS,
      source: PUBLIC_SUBMIT_SOURCE,
      moderation_status: PUBLIC_SUBMIT_MODERATION_STATUS,
      facade_path: 'a1111111-1111-4111-8111-111111111102/facade.jpg',
    });
  });

  it('uploadFacadePhoto uploads to place-photos/{place_id}/facade.jpg', async () => {
    const client = makeFakeSupabaseClient();
    const file = new Blob(['jpeg'], { type: 'image/jpeg' });

    const result = await uploadFacadePhoto(
      client,
      'a1111111-1111-4111-8111-111111111103',
      file,
    );

    expect(result.path).toBe(
      'a1111111-1111-4111-8111-111111111103/facade.jpg',
    );

    const call = client.calls.find((c) => c.method === 'storage.upload');
    expect(call?.args[0]).toBe(PHOTO_BUCKET);
    expect(call?.args[1]).toBe(
      'a1111111-1111-4111-8111-111111111103/facade.jpg',
    );
    expect(call?.args[3]).toEqual({ contentType: 'image/jpeg', upsert: false });
  });
});
