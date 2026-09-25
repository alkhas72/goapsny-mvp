import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AdminPanel } from './AdminPanel';

const { getPendingPublicPlaces, confirm, onReviewPublicPlace } = vi.hoisted(() => ({
  getPendingPublicPlaces: vi.fn(),
  confirm: vi.fn(),
  onReviewPublicPlace: vi.fn(),
}));

vi.mock('../services/api', () => ({
  api: { getPendingPublicPlaces },
  categoriesList: [{ slug: 'food', icon: '☕', name: 'Кафе' }],
}));
vi.mock('../utils/telegram', () => ({
  telegram: { confirm, hapticNotify: vi.fn(), hapticSelection: vi.fn(), alert: vi.fn() },
}));

const pending = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Кафе у моря',
  category: 'food',
  lat: 43.0033,
  lng: 41.0237,
  createdAt: '2026-09-25T12:00:00Z',
  photoUrl: 'https://example.test/facade.jpg',
};

function show(canModerate: boolean) {
  return render(
    <AdminPanel
      places={[]}
      onDeletePlace={vi.fn()}
      onUpdateStatus={vi.fn()}
      canModerate={canModerate}
      onReviewPublicPlace={onReviewPublicPlace}
    />,
  );
}

describe('AdminPanel moderation', () => {
  beforeEach(() => {
    getPendingPublicPlaces.mockReset().mockResolvedValue([pending]);
    confirm.mockReset().mockResolvedValue(true);
    onReviewPublicPlace.mockReset().mockResolvedValue(undefined);
  });
  afterEach(cleanup);

  it('shows pending photo only to a moderator and publishes after confirmation', async () => {
    const user = userEvent.setup();
    show(true);
    expect(await screen.findByText('Кафе у моря')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Фасад: Кафе у моря' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Опубликовать' }));
    await waitFor(() => expect(onReviewPublicPlace).toHaveBeenCalledWith(pending.id, 'published'));
    await waitFor(() => expect(screen.queryByText('Кафе у моря')).toBeNull());
  });

  it('does not request or show the queue for a non-moderator', () => {
    show(false);
    expect(getPendingPublicPlaces).not.toHaveBeenCalled();
    expect(screen.queryByRole('region', { name: 'Заявки на проверке' })).toBeNull();
  });
});
