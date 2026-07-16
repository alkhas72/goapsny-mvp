import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PublicAddSheet } from './PublicAddSheet';
import { SubmitPlaceError } from '../services/submit-place';

vi.mock('./LeafletMap', () => ({
  LeafletMap: ({
    dragMode,
  }: {
    dragMode?: { lat: number; lng: number; onChange: (lat: number, lng: number) => void };
  }) => (
    <div data-testid="add-map">
      <button type="button" onClick={() => dragMode?.onChange(43.01, 41.02)}>
        Установить пин
      </button>
    </div>
  ),
}));

vi.mock('../utils/location', () => ({
  getBrowserLocation: vi.fn().mockResolvedValue({ lat: 43.0033, lng: 41.0237 }),
}));

// Mock the HARDENED submission boundary (submit-place.ts), not the legacy
// publicSubmit path. The sheet must route through submitPublicPlace and branch
// on SubmitPlaceError kinds for deterministic UI feedback.
const { submitPublicPlace } = vi.hoisted(() => ({
  submitPublicPlace: vi.fn(),
}));

vi.mock('../services/submit-place', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/submit-place')>();
  return {
    ...actual,
    submitPublicPlace,
  };
});

const PLACE_ID = '11111111-1111-4111-8111-111111111111';

describe('PublicAddSheet', () => {
  beforeEach(() => {
    submitPublicPlace.mockReset();
    submitPublicPlace.mockResolvedValue({ placeId: PLACE_ID, storagePath: `${PLACE_ID}/facade.jpg` });
  });

  afterEach(() => {
    cleanup();
  });

  it('requires photo, category, name, and location before publish', async () => {
    const user = userEvent.setup();
    render(<PublicAddSheet open theme="light" onClose={() => undefined} onSubmitted={() => undefined} />);

    // Step 1 blocked without a photo.
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
      expect(submitPublicPlace).toHaveBeenCalled();
    });
  });

  it('routes the submit through the hardened boundary with the exact contract (photo required as Blob)', async () => {
    const onSubmitted = vi.fn();
    const user = userEvent.setup();
    render(<PublicAddSheet open theme="light" onClose={() => undefined} onSubmitted={onSubmitted} />);

    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'facade.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/фото входа/i), file);
    await user.click(screen.getByRole('button', { name: /далее/i }));

    await user.type(screen.getByLabelText(/название/i), '  Кафе у моря ');
    await user.click(screen.getByRole('button', { name: /далее/i }));

    await user.click(screen.getByRole('button', { name: /установить пин/i }));
    await user.click(screen.getByRole('button', { name: /далее/i }));

    await user.click(screen.getByRole('button', { name: /опубликовать серую метку/i }));
    await waitFor(() => {
      expect(onSubmitted).toHaveBeenCalledWith(PLACE_ID);
    });

    // Exact hardened-boundary contract: name trimmed, photo required as a Blob.
    expect(submitPublicPlace).toHaveBeenCalledTimes(1);
    const [input] = submitPublicPlace.mock.calls[0];
    expect(input).toMatchObject({ name: 'Кафе у моря', category: 'food', lat: 43.01, lng: 41.02 });
    expect(input.photo).toBeInstanceOf(Blob);
    expect(input.photo).toBe(file);
  });

  it('maps a hardened SubmitPlaceError kind to deterministic Russian copy', async () => {
    submitPublicPlace.mockRejectedValueOnce(
      new SubmitPlaceError('already_submitted', 'submit_public_place: public submission already used', '23505'),
    );
    const user = userEvent.setup();
    render(<PublicAddSheet open theme="light" onClose={() => undefined} onSubmitted={() => undefined} />);

    const file = new File(['x'], 'facade.jpg', { type: 'image/jpeg' });
    await user.upload(screen.getByLabelText(/фото входа/i), file);
    await user.click(screen.getByRole('button', { name: /далее/i }));
    await user.type(screen.getByLabelText(/название/i), 'Кафе');
    await user.click(screen.getByRole('button', { name: /далее/i }));
    await user.click(screen.getByRole('button', { name: /установить пин/i }));
    await user.click(screen.getByRole('button', { name: /далее/i }));
    await user.click(screen.getByRole('button', { name: /опубликовать серую метку/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeTruthy();
    });
    expect(screen.getByRole('alert').textContent).toContain('уже добавили место');
  });
});
