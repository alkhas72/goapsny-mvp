import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MySubmission } from '../../services/moderation';
import { MapperDay } from './MapperDay';

const NOW = new Date().toISOString();

const SUBMISSIONS: MySubmission[] = [
  { id: 'a', name: 'Аптека', category: 'health', status: 'red', moderationStatus: 'pending', createdAt: NOW },
  { id: 'b', name: 'Кафе', category: 'food', status: 'green', moderationStatus: 'published', createdAt: '2026-10-01T10:00:00Z' },
  { id: 'c', name: 'Киоск', category: 'shops', status: 'yellow', moderationStatus: 'hidden', createdAt: '2026-10-02T10:00:00Z' },
];

const handlers = () => ({
  onClose: vi.fn(),
  onSignIn: vi.fn(),
  onSignOut: vi.fn(),
  onOpenQueue: vi.fn(),
});

describe('MapperDay', () => {
  afterEach(cleanup);

  it('без входа предлагает войти и не ходит на сервер', async () => {
    const load = vi.fn();
    const h = handlers();
    render(<MapperDay account={null} accountLabel={null} queueCount={null} loadSubmissions={load} {...h} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Войти по почте' }));
    expect(h.onSignIn).toHaveBeenCalled();
    expect(load).not.toHaveBeenCalled();
  });

  it('показывает свои объекты с состоянием проверки и счёт', async () => {
    const load = vi.fn().mockResolvedValue(SUBMISSIONS);
    render(
      <MapperDay
        account={{ id: 'u1', role: 'public_user', karma: 40, karmaStatus: 'explorer' }}
        accountLabel="m***@example.test"
        queueCount={null}
        loadSubmissions={load}
        {...handlers()}
      />,
    );

    expect(await screen.findByText('Аптека')).toBeTruthy();
    expect(load).toHaveBeenCalledWith('u1');
    const rows = screen.getAllByRole('listitem');
    expect((rows[0]).textContent).toContain('на проверке');
    expect((rows[1]).textContent).toContain('на карте');
    expect((rows[2]).textContent).toContain('отклонён');
    expect(screen.getByText('40')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Очередь проверки/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Выйти · m\*\*\*@example.test/ })).toBeTruthy();
  });

  it('модератор видит вход в очередь с числом карточек', async () => {
    const h = handlers();
    render(
      <MapperDay
        account={{ id: 'u3', role: 'admin', karma: 0, karmaStatus: 'pedestrian' }}
        accountLabel={null}
        queueCount={3}
        loadSubmissions={vi.fn().mockResolvedValue([])}
        {...h}
      />,
    );

    const queue = await screen.findByRole('button', { name: /Очередь проверки/ });
    expect((queue).textContent).toContain('Ждут решения: 3');
    await userEvent.setup().click(queue);
    expect(h.onOpenQueue).toHaveBeenCalled();
  });

  it('сбой загрузки не выдаётся за пустой список', async () => {
    render(
      <MapperDay
        account={{ id: 'u1', role: 'public_user', karma: 0, karmaStatus: 'pedestrian' }}
        accountLabel={null}
        queueCount={null}
        loadSubmissions={vi.fn().mockRejectedValue(new Error('offline'))}
        {...handlers()}
      />,
    );

    expect((await screen.findByRole('alert')).textContent).toContain('Не удалось загрузить список');
    expect(screen.queryByText(/Пока пусто/)).toBeNull();
  });
});
