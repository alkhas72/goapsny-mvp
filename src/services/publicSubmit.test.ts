import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  buildFacadeStoragePath,
  cleanupOrphanFacade,
  submitPublicPlace,
  submitPublicPlaceWithPhoto,
  uploadFacadePhoto,
} from './publicSubmit';

const upload = vi.fn();
const remove = vi.fn();
const rpc = vi.fn();

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => true,
  getSupabaseClient: () => ({
    storage: {
      from: () => ({
        upload,
        remove,
      }),
    },
    rpc,
  }),
}));

const placeId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const facadePath = `${placeId}/facade.jpg`;

describe('buildFacadeStoragePath', () => {
  it('returns exact place_id/facade.jpg path', () => {
    expect(buildFacadeStoragePath(placeId)).toBe(facadePath);
  });
});

describe('uploadFacadePhoto', () => {
  beforeEach(() => {
    upload.mockReset();
  });

  it('uploads to place-photos bucket at facade.jpg with image/jpeg', async () => {
    upload.mockResolvedValueOnce({ error: null });
    const file = new File(['x'], 'photo.png', { type: 'image/png' });
    await uploadFacadePhoto(placeId, file);
    expect(upload).toHaveBeenCalledWith(facadePath, file, {
      upsert: false,
      contentType: 'image/jpeg',
    });
  });
});

describe('cleanupOrphanFacade', () => {
  beforeEach(() => {
    remove.mockReset();
  });

  it('removes the owned facade path', async () => {
    remove.mockResolvedValueOnce({ error: null });
    await cleanupOrphanFacade(placeId);
    expect(remove).toHaveBeenCalledWith([facadePath]);
  });
});

describe('submitPublicPlace', () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it('calls submit_public_place RPC with exact parameters', async () => {
    rpc.mockResolvedValueOnce({
      data: {
        id: placeId,
        name: 'Кафе',
        category: 'food',
        lat: 43,
        lng: 41,
        status: 'gray',
        moderation_status: 'published',
        source: 'public',
      },
      error: null,
    });

    const result = await submitPublicPlace({
      placeId,
      name: '  Кафе ',
      category: 'food',
      lat: 43,
      lng: 41,
    });

    expect(rpc).toHaveBeenCalledWith('submit_public_place', {
      p_place_id: placeId,
      p_name: 'Кафе',
      p_category: 'food',
      p_lat: 43,
      p_lng: 41,
      p_storage_path: facadePath,
    });
    expect(result.status).toBe('gray');
    expect(result.moderationStatus).toBe('published');
    expect(result.source).toBe('public');
  });
});

describe('submitPublicPlaceWithPhoto', () => {
  beforeEach(() => {
    upload.mockReset();
    remove.mockReset();
    rpc.mockReset();
  });

  it('uploads facade then submits via RPC', async () => {
    upload.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({
      data: {
        id: placeId,
        name: 'Кафе',
        category: 'food',
        lat: 43,
        lng: 41,
        status: 'gray',
        moderation_status: 'published',
        source: 'public',
      },
      error: null,
    });
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    const result = await submitPublicPlaceWithPhoto({
      placeId,
      name: 'Кафе',
      category: 'food',
      lat: 43,
      lng: 41,
      photoFile: file,
    });
    expect(upload).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalled();
    expect(result.id).toBe(placeId);
  });

  it('cleans up orphan facade when RPC fails', async () => {
    upload.mockResolvedValueOnce({ error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'rpc failed' } });
    remove.mockResolvedValueOnce({ error: null });
    const file = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
    await expect(
      submitPublicPlaceWithPhoto({
        placeId,
        name: 'Кафе',
        category: 'food',
        lat: 43,
        lng: 41,
        photoFile: file,
      }),
    ).rejects.toThrow('rpc failed');
    expect(remove).toHaveBeenCalledWith([facadePath]);
  });
});
