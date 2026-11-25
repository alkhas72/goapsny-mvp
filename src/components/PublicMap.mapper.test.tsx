import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Session } from '@supabase/supabase-js';

// Путь картографа в оболочке карты: вход до первого шага, кабинет, очередь проверки.

vi.mock('../services/supabase', () => ({ isSupabaseConfigured: () => true }));

const auth = vi.hoisted(() => ({
  session: null as Session | null,
  listener: null as ((session: Session | null) => void) | null,
}));

vi.mock('../services/publicAuth', () => ({
  getPublicSession: vi.fn(async () => auth.session),
  subscribePublicSession: vi.fn((onChange: (session: Session | null) => void) => {
    auth.listener = onChange;
    return () => undefined;
  }),
  maskEmailDomain: (email: string) => `${email.slice(0, 1)}***`,
  signOutPublicUser: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../services/places', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/places')>()),
  fetchPublishedPlaces: vi.fn().mockResolvedValue([]),
  fetchPlaceById: vi.fn().mockResolvedValue(null),
}));

vi.mock('../services/moderation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/moderation')>()),
  fetchMapperAccount: vi.fn(),
  fetchModerationQueue: vi.fn(),
  fetchMySubmissions: vi.fn().mockResolvedValue([]),
}));

vi.mock('./map/MapLibreMap', () => ({ MapLibreMap: () => <div data-testid="mock-map" /> }));
vi.mock('./PublicAddSheet', () => ({ PublicAddSheet: () => null }));
vi.mock('./EmailOtpSheet', () => ({
  EmailOtpSheet: ({ open, onVerified }: { open: boolean; onVerified: () => void }) =>
    open ? (
      <button type="button" onClick={onVerified}>
        Mock verify OTP
      </button>
    ) : null,
}));
vi.mock('./mapper/MapperFlow', () => ({ MapperFlow: () => <div role="dialog" aria-label="Новый объект" /> }));
vi.mock('./mapper/ModerationQueue', () => ({
  ModerationQueue: () => <div role="dialog" aria-label="Очередь проверки" />,
}));

import { fetchMapperAccount, fetchModerationQueue } from '../services/moderation';
import { PublicMap } from './PublicMap';

const SESSION = { user: { id: 'u3', email: 'moderator@example.test' } } as unknown as Session;

describe('PublicMap: путь картографа', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?mapper=1');
    auth.session = null;
    vi.mocked(fetchMapperAccount).mockClear();
    vi.mocked(fetchModerationQueue).mockClear();
    vi.mocked(fetchMapperAccount).mockResolvedValue(null);
    vi.mocked(fetchModerationQueue).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    window.history.replaceState(null, '', '/');
  });

  it('без входа «Добавить объект» сначала ведёт ко входу, потом открывает шаги', async () => {
    const user = userEvent.setup();
    render(<PublicMap />);

    await user.click(await screen.findByRole('button', { name: /Добавить объект/ }));
    expect(screen.queryByRole('dialog', { name: 'Новый объект' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Mock verify OTP' }));
    expect(screen.getByRole('dialog', { name: 'Новый объект' })).toBeTruthy();
  });

  it('вошедший картограф попадает в шаги сразу', async () => {
    auth.session = SESSION;
    const user = userEvent.setup();
    render(<PublicMap />);

    await screen.findByRole('button', { name: /Добавить объект/ });
    await vi.waitFor(() => expect(fetchMapperAccount).toHaveBeenCalled());
    await user.click(screen.getByRole('button', { name: /Добавить объект/ }));
    expect(screen.getByRole('dialog', { name: 'Новый объект' })).toBeTruthy();
  });

  it('модератор из кабинета открывает очередь проверки', async () => {
    auth.session = SESSION;
    vi.mocked(fetchMapperAccount).mockResolvedValue({ id: 'u3', role: 'admin', karma: 0, karmaStatus: 'pedestrian' });
    vi.mocked(fetchModerationQueue).mockResolvedValue([{}, {}] as never);
    const user = userEvent.setup();
    render(<PublicMap />);

    await user.click(await screen.findByRole('button', { name: 'Кабинет' }));
    const queue = await screen.findByRole('button', { name: /Очередь проверки/ });
    await vi.waitFor(() => expect(queue.textContent).toContain('Ждут решения: 2'));
    await user.click(queue);
    expect(screen.getByRole('dialog', { name: 'Очередь проверки' })).toBeTruthy();
  });

  it('обычный картограф очередь не видит', async () => {
    auth.session = SESSION;
    vi.mocked(fetchMapperAccount).mockResolvedValue({ id: 'u1', role: 'public_user', karma: 5, karmaStatus: 'pedestrian' });
    const user = userEvent.setup();
    render(<PublicMap />);

    await user.click(await screen.findByRole('button', { name: 'Кабинет' }));
    await screen.findByText('Мои объекты');
    expect(screen.queryByRole('button', { name: /Очередь проверки/ })).toBeNull();
    expect(fetchModerationQueue).not.toHaveBeenCalled();
  });
});

describe('PublicMap, живая оболочка: одна кнопка на карте', () => {
  beforeEach(() => {
    window.history.replaceState(null, '', '/?mapper=1');
    document.documentElement.dataset.skin = 'living';
    auth.session = SESSION;
    vi.mocked(fetchMapperAccount).mockClear();
    vi.mocked(fetchMapperAccount).mockResolvedValue(null);
    vi.mocked(fetchModerationQueue).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
    delete document.documentElement.dataset.skin;
    window.history.replaceState(null, '', '/');
  });

  it('плашек «Сегодня» и «+ Добавить объект» нет, объект добавляет центральная кнопка', async () => {
    const user = userEvent.setup();
    render(<PublicMap />);

    const add = await screen.findByRole('button', { name: 'Добавить объект' });
    expect(add.className).toBe('lv-dome');
    expect(screen.queryByRole('button', { name: /Сегодня/ })).toBeNull();
    expect(screen.queryByText('+ Добавить объект')).toBeNull();
    // Отдельного входа к помощнику на карте нет.
    expect(screen.queryByRole('button', { name: /Ассистент/ })).toBeNull();

    await vi.waitFor(() => expect(fetchMapperAccount).toHaveBeenCalled());
    await user.click(add);
    expect(screen.getByRole('dialog', { name: 'Новый объект' })).toBeTruthy();
  });

  it('без входа центральная кнопка сначала ведёт ко входу', async () => {
    auth.session = null;
    const user = userEvent.setup();
    render(<PublicMap />);

    await user.click(await screen.findByRole('button', { name: 'Добавить объект' }));
    expect(screen.queryByRole('dialog', { name: 'Новый объект' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Mock verify OTP' }));
    expect(screen.getByRole('dialog', { name: 'Новый объект' })).toBeTruthy();
  });
});
