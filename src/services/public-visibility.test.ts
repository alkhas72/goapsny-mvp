import { describe, expect, it } from 'vitest';
import { makeFakeSupabaseClient } from '../test/fake-supabase';
import { fetchAnonymousPublishedPlace } from '../test/g1-contract-harness';

const GRAY_PLACE_ID = 'a1111111-1111-4111-8111-111111111101';

describe('anonymous visibility contract', () => {
  it('anonymous client can read a published gray place by id, but not hidden or pending', async () => {
    const client = makeFakeSupabaseClient({
      tables: {
        places: [
          {
            id: GRAY_PLACE_ID,
            name: 'Smoke Gray',
            category: 'food',
            lat: 43,
            lng: 41,
            status: 'gray',
            moderation_status: 'published',
            source: 'public',
          },
          {
            id: 'hidden',
            name: 'Hidden',
            category: 'food',
            lat: 43,
            lng: 41,
            status: 'gray',
            moderation_status: 'hidden',
            source: 'public',
          },
          {
            id: 'pending',
            name: 'Pending',
            category: 'food',
            lat: 43,
            lng: 41,
            status: 'gray',
            moderation_status: 'pending',
            source: 'public',
          },
        ],
      },
    });

    const place = await fetchAnonymousPublishedPlace(client, GRAY_PLACE_ID);

    expect(place).not.toBeNull();
    expect(place?.status).toBe('gray');
    expect(place?.moderation_status).toBe('published');

    const hidden = await fetchAnonymousPublishedPlace(client, 'hidden');
    expect(hidden).toBeNull();

    const pending = await fetchAnonymousPublishedPlace(client, 'pending');
    expect(pending).toBeNull();
  });
});
