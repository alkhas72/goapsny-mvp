import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PlaceSheet } from './PlaceSheet';
import { isPartialPlace, type PublicPlace } from '../services/places';

const GREEN: PublicPlace = {
  id: 'p-green',
  name: 'Кафе «Набережная»',
  category: 'food',
  lat: 42.9985,
  lng: 41.0125,
  status: 'green',
  stepsCount: 0,
  stepHeightCm: null,
  rampType: 'none',
  doorWidthCm: 95,
  entranceNotes: null,
  toiletExists: 'yes',
  toiletAccessible: 'yes',
  parking: 'yes',
  comment: 'Вход с набережной.',
  osmTags: {},
  details: {
    schema_version: 1,
    address: 'наб. Махаджиров, 8',
    verification: { verified_at: '2026-09-20T10:00:00Z', verified_by_role: 'аудитор' },
    external_links: { osm: 'https://osm.org/node/1', yandex: 'https://yandex.ru/maps/org/1' },
  },
  moderationStatus: 'published',
  source: 'public',
  createdBy: null,
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
  facadePhotoUrl: 'https://example.com/facade.jpg',
};

const GRAY: PublicPlace = {
  ...GREEN,
  id: 'p-gray',
  name: 'Магазин «Апсны»',
  category: 'shops',
  status: 'gray',
  stepsCount: null,
  doorWidthCm: null,
  toiletExists: 'unknown',
  toiletAccessible: 'unknown',
  parking: 'unknown',
  comment: null,
  details: { schema_version: 1 },
  facadePhotoUrl: null,
};

function renderSheet(props: Partial<Parameters<typeof PlaceSheet>[0]> = {}) {
  const onClose = vi.fn();
  render(<PlaceSheet open place={GREEN} state="idle" onClose={onClose} {...props} />);
  return { onClose };
}

/** Position of each block in document order: a text node equal to the needle, or 'IMG'. */
function order(...needles: string[]): number[] {
  const dialog = screen.getByRole('dialog');
  const nodes: Node[] = [];
  const walker = document.createTreeWalker(dialog, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) nodes.push(node);
  return needles.map((needle) =>
    nodes.findIndex((node) =>
      needle === 'IMG' ? node.nodeName === 'IMG' : node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === needle,
    ),
  );
}

describe('PlaceSheet', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('variant A: header, one status line, summary, actions, then photo, address and passport', () => {
    renderSheet({ variant: 'a' });
    const dialog = screen.getByRole('dialog', { name: 'Кафе «Набережная»' });
    expect(within(dialog).getAllByText('Доступно')).toHaveLength(1);
    expect(within(dialog).getByText('Еда и напитки')).toBeTruthy();
    expect(within(dialog).getByText(/Проверено: аудитор · 20 сентября 2026/)).toBeTruthy();
    const summary = within(dialog).getByRole('list', { name: 'Главное о доступности' });
    expect(within(summary).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Без ступеней',
      'Дверь 95 см',
      'Доступный туалет',
    ]);
    const [status, actions, photo, address, passport] = order('Доступно', 'Маршрут', 'IMG', 'наб. Махаджиров, 8', 'Доступность');
    expect(status).toBeLessThan(actions);
    expect(actions).toBeLessThan(photo);
    expect(photo).toBeLessThan(address);
    expect(address).toBeLessThan(passport);
  });

  it('variant B: photo first, then name, status, address and the passport', () => {
    renderSheet({ variant: 'b', place: { ...GREEN, rampType: 'portable_on_request' } });
    expect(screen.queryByRole('list', { name: 'Главное о доступности' })).toBeNull();
    const [photo, title, status, address, ramp, passport] = order(
      'IMG',
      'Еда и напитки',
      'Доступно',
      'наб. Махаджиров, 8',
      'Пандус по запросу',
      'Доступность',
    );
    expect(photo).toBeLessThan(title);
    expect(title).toBeLessThan(status);
    expect(status).toBeLessThan(address);
    expect(address).toBeLessThan(ramp);
    expect(ramp).toBeLessThan(passport);
  });

  it('reads the variant from ?card=b', () => {
    window.history.replaceState(null, '', '/?card=b');
    try {
      renderSheet();
      expect(screen.getByRole('dialog').className).toContain('ps--b');
    } finally {
      window.history.replaceState(null, '', '/');
    }
  });

  it('a place with nothing recorded is calm, not "partly unavailable"', () => {
    renderSheet({ place: GRAY });
    expect(screen.getByText('Ещё не оценено')).toBeTruthy();
    expect(screen.getByText('Ещё не проверено волонтёром')).toBeTruthy();
    expect(screen.getByText('Данных о входе пока нет')).toBeTruthy();
    expect(screen.getByText('Фото входа пока нет')).toBeTruthy();
    expect(screen.queryByText('Фото недоступно')).toBeNull();
    expect(screen.queryByText(/не загрузилась|временно недоступна/)).toBeNull();
    expect(screen.queryByText(/Есть на/)).toBeNull();
  });

  it('shows the partial note only when loading really failed, with a retry', async () => {
    const onRetry = vi.fn();
    renderSheet({ place: { ...GRAY, facadePhotoError: true }, state: 'partial', onRetry });
    expect(screen.getByText('Часть данных не загрузилась')).toBeTruthy();
    expect(screen.getByText('Фото недоступно')).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('lists only the other maps the place is on, Yandex first', () => {
    renderSheet();
    expect(screen.getByText('Есть на: Яндекс · OSM')).toBeTruthy();
    const links = screen.getAllByRole('link', { hidden: true }).map((link) => link.textContent);
    expect(links).toEqual(['Яндекс Карты', 'OpenStreetMap']);
  });

  it('opens the route apps with the place coordinates; Escape closes the list, not the card', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSheet();
    const route = screen.getByRole('button', { name: 'Маршрут' });
    await user.click(route);
    expect(route.getAttribute('aria-expanded')).toBe('true');
    const apps = within(screen.getByRole('list', { name: 'Открыть маршрут в приложении' }));
    const yandex = apps.getByRole('link', { name: 'Яндекс Карты' });
    expect(yandex.getAttribute('href')).toBe('https://yandex.ru/maps/?rtext=~42.9985,41.0125&rtt=pd');
    expect(apps.getByRole('link', { name: 'Google Maps' }).getAttribute('href')).toContain('destination=42.9985,41.0125');
    expect(apps.getByRole('link', { name: 'Apple Maps' }).getAttribute('href')).toContain('daddr=42.9985,41.0125');
    yandex.focus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('list', { name: 'Открыть маршрут в приложении' })).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(route);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shares with the system sheet', async () => {
    const user = userEvent.setup();
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { share });
    renderSheet();
    await user.click(screen.getByRole('button', { name: 'Поделиться' }));
    expect(share).toHaveBeenCalledWith({
      title: 'Кафе «Набережная»',
      text: 'Кафе «Набережная» · Доступно · наб. Махаджиров, 8',
      url: window.location.href,
    });
    expect(screen.queryByText('Ссылка скопирована')).toBeNull();
  });

  it('copies the link and says so when there is no share sheet', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    renderSheet();
    await user.click(screen.getByRole('button', { name: 'Поделиться' }));
    expect(writeText).toHaveBeenCalledWith(window.location.href);
    expect(await screen.findByText('Ссылка скопирована')).toBeTruthy();
  });

  it('has no "report an error" button while there is nowhere to send it', () => {
    renderSheet();
    expect(screen.queryByRole('button', { name: /ошибк/i })).toBeNull();
  });

  it('shows a skeleton while loading without data, and the known place while refreshing', () => {
    renderSheet({ place: null, state: 'loading' });
    expect(screen.getByRole('status').textContent).toContain('Загрузка места');
    cleanup();
    renderSheet({ state: 'loading' });
    expect(screen.getByRole('dialog', { name: 'Кафе «Набережная»' })).toBeTruthy();
  });

  it('error: plain reason and a retry', () => {
    renderSheet({ place: null, state: 'error', errorMessage: 'Failed to load place: fetch failed', onRetry: vi.fn() });
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Не удалось открыть место');
    expect(alert.textContent).toContain('Проверьте интернет');
    expect(alert.textContent).not.toContain('fetch failed');
    expect(within(alert).getByRole('button', { name: 'Повторить' })).toBeTruthy();
  });

  it('focuses the close button, closes on it, and the grabber expands the sheet', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSheet();
    const close = screen.getByRole('button', { name: 'Закрыть карточку' });
    expect(document.activeElement).toBe(close);
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('data-expanded')).toBe('false');
    await user.click(screen.getByRole('button', { name: 'Развернуть карточку' }));
    expect(dialog.getAttribute('data-expanded')).toBe('true');
    expect(screen.getByRole('button', { name: 'Свернуть карточку' })).toBeTruthy();
    await user.click(close);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('keeps Tab inside the card after the content changes', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { rerender } = render(<PlaceSheet open place={null} state="loading" onClose={onClose} variant="a" />);
    rerender(<PlaceSheet open place={GREEN} state="idle" onClose={onClose} variant="a" />);
    await user.tab();
    expect(document.activeElement?.textContent).toBe('Маршрут');
  });
});

describe('isPartialPlace', () => {
  it('is false for data that was simply never recorded', () => {
    expect(isPartialPlace(GRAY)).toBe(false);
    expect(isPartialPlace({ ...GREEN, details: { schema_version: 1 } })).toBe(false);
  });

  it('is true when the photo exists but failed to load', () => {
    expect(isPartialPlace({ ...GRAY, facadePhotoError: true })).toBe(true);
  });
});
