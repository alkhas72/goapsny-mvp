import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublicAddSheet } from './PublicAddSheet';

vi.mock('./LeafletMap', () => ({
  LeafletMap: ({
    dragMode,
  }: {
    dragMode?: { lat: number; lng: number; onChange: (lat: number, lng: number) => void };
  }) => (
    <div data-testid="add-map">
      <button
        type="button"
        onClick={() => dragMode?.onChange(43.01, 41.02)}
      >
        Установить пин
      </button>
    </div>
  ),
}));

vi.mock('../utils/location', () => ({
  getBrowserLocation: vi.fn().mockResolvedValue({ lat: 43.0033, lng: 41.0237 }),
}));

const { submitPublicPlaceWithPhoto } = vi.hoisted(() => ({
  submitPublicPlaceWithPhoto: vi.fn(),
}));

vi.mock('../services/publicSubmit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/publicSubmit')>();
  return {
    ...actual,
    createPlaceId: () => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    submitPublicPlaceWithPhoto,
  };
});

describe('PublicAddSheet', () => {
  beforeEach(() => {
    submitPublicPlaceWithPhoto.mockReset();
    submitPublicPlaceWithPhoto.mockResolvedValue({
      id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      name: 'Кафе',
      category: 'food',
      lat: 43.01,
      lng: 41.02,
      status: 'gray',
      moderationStatus: 'published',
      source: 'public',
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('requires photo, category, name, and location before publish', async () => {
    const user = userEvent.setup();
    render(
      <PublicAddSheet
        open
        theme="light"
        onClose={() => undefined}
        onSubmitted={() => undefined}
      />,
    );

    await user.click(screen.getByRole('button', { name: /далее/i }));
    expect(screen.getByRole('alert')).toBeTruthy();

    const file = new File(['x'], 'facade.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/фото входа/i), file);
    await user.click(screen.getByRole('button', { name: /далее/i }));

    await user.type(screen.getByLabelText(/название/i), 'Кафе');
    await user.click(screen.getByRole('button', { name: /далее/i }));

    await user.click(screen.getByRole('button', { name: /установить пин/i }));
    await user.click(screen.getByRole('button', { name: /далее/i }));

    await user.click(screen.getByRole('button', { name: /опубликовать серую метку/i }));
    await waitFor(() => {
      expect(submitPublicPlaceWithPhoto).toHaveBeenCalled();
    });
  });
});
