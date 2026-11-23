import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { OutboxItem } from '../../services/mapper-outbox';
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

  describe('ждут отправки', () => {
    const ACCOUNT = { id: 'u1', role: 'public_user' as const, karma: 40, karmaStatus: 'explorer' as const };
    const waiting = (over: Partial<OutboxItem> = {}): OutboxItem => ({
      id: 'w1',
      owner: 'u1',
      createdAt: NOW,
      attempts: 1,
      lastTriedAt: NOW,
      reason: 'offline',
      blocked: false,
      input: {
        name: 'Магазин у моста',
        category: 'shops',
        lat: 43,
        lng: 41,
        photo: new Blob(['jpeg']),
        status: 'yellow',
        stepsCount: 1,
        rampType: 'none',
        subtype: null,
        stepHigh: 'unknown',
        doorWide: 'unknown',
      },
      ...over,
    });

    it('показывает объекты с устройства и отправляет их по кнопке', async () => {
      const outbox = {
        list: vi.fn().mockResolvedValue([waiting()]),
        flush: vi.fn().mockResolvedValue({ sent: 1, left: [] }),
        remove: vi.fn(),
      };
      const load = vi.fn().mockResolvedValue([]);
      render(
        <MapperDay account={ACCOUNT} accountLabel={null} queueCount={null} loadSubmissions={load} outbox={outbox} {...handlers()} />,
      );

      expect(await screen.findByText('Магазин у моста')).toBeTruthy();
      expect(screen.getByText(/Ждут отправки: 1/)).toBeTruthy();
      expect(screen.getByText(/нет связи/)).toBeTruthy();

      await userEvent.setup().click(screen.getByRole('button', { name: 'Отправить сейчас' }));

      expect((await screen.findByRole('status')).textContent).toContain('Ушло на проверку: 1');
      expect(outbox.flush).toHaveBeenCalledWith('u1');
      expect(screen.queryByText('Магазин у моста')).toBeNull();
      // Список своих объектов перечитан с сервера.
      expect(load).toHaveBeenCalledTimes(2);
    });

    it('не получилось отправить — объекты остаются, об этом сказано', async () => {
      const outbox = {
        list: vi.fn().mockResolvedValue([waiting()]),
        flush: vi.fn().mockResolvedValue({ sent: 0, left: [waiting({ attempts: 2 })] }),
        remove: vi.fn(),
      };
      render(
        <MapperDay account={ACCOUNT} accountLabel={null} queueCount={null} loadSubmissions={vi.fn().mockResolvedValue([])} outbox={outbox} {...handlers()} />,
      );

      await userEvent.setup().click(await screen.findByRole('button', { name: 'Отправить сейчас' }));

      expect((await screen.findByRole('status')).textContent).toContain('Пока не получилось');
      expect(screen.getByText('Магазин у моста')).toBeTruthy();
    });

    it('удаляет объект с устройства только со второго нажатия', async () => {
      const outbox = {
        list: vi.fn().mockResolvedValue([waiting({ reason: 'card_invalid', blocked: true })]),
        flush: vi.fn(),
        remove: vi.fn().mockResolvedValue(undefined),
      };
      render(
        <MapperDay account={ACCOUNT} accountLabel={null} queueCount={null} loadSubmissions={vi.fn().mockResolvedValue([])} outbox={outbox} {...handlers()} />,
      );
      const user = userEvent.setup();

      expect(await screen.findByText(/Сервер не принял данные входа/)).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Удалить «Магазин у моста»' }));
      expect(outbox.remove).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: 'Точно удалить «Магазин у моста»' }));
      expect(outbox.remove).toHaveBeenCalledWith('w1');
      expect(screen.queryByText('Магазин у моста')).toBeNull();
    });
  });
});
