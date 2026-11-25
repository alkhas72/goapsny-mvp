import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ModerationCard } from '../../services/moderation';
import { mapPlaceRow, type PlaceRow } from '../../services/places';
import { ModerationQueue } from './ModerationQueue';

function card(id: string, name: string): ModerationCard {
  const row = {
    id,
    name,
    category: 'health',
    lat: 43,
    lng: 41,
    status: 'red',
    steps_count: 2,
    step_height_cm: null,
    ramp_type: 'portable_on_request',
    door_width_cm: null,
    entrance_notes: null,
    toilet_exists: 'unknown',
    toilet_accessible: 'unknown',
    parking: 'unknown',
    comment: null,
    osm_tags: {},
    details: { schema_version: 1 },
    moderation_status: 'pending',
    source: 'public',
    created_by: 'u1',
    created_at: '2026-11-23T08:00:00Z',
    updated_at: '2026-11-23T08:00:00Z',
  } as PlaceRow;
  return {
    place: mapPlaceRow(row),
    facts: {
      subtype: 'Аптека',
      stepHigh: 'yes',
      doorWide: 'unknown',
      toiletNote: null,
      handWash: 'unknown',
      accessibleParking: 'unknown',
      elevator: 'unknown',
    },
    photoUrl: `https://signed/${id}`,
    toiletPhotoUrls: [],
  };
}

function setup(over: Partial<Parameters<typeof ModerationQueue>[0]> = {}) {
  const onChanged = vi.fn();
  const decide = vi.fn().mockResolvedValue(undefined);
  render(
    <ModerationQueue
      theme="light"
      showMap={false}
      onClose={vi.fn()}
      onChanged={onChanged}
      loadQueue={vi.fn().mockResolvedValue([card('p1', 'Аптека «Здоровье»'), card('p2', 'Кафе «Пингвин»')])}
      decide={decide}
      {...over}
    />,
  );
  return { onChanged, decide };
}

describe('ModerationQueue', () => {
  afterEach(cleanup);

  it('показывает карточку целиком: фото, оценку и ответы картографа', async () => {
    setup();

    expect(await screen.findByRole('heading', { name: 'Аптека «Здоровье»' })).toBeTruthy();
    expect(screen.getByText('Проверка · 1 из 2')).toBeTruthy();
    expect((screen.getByRole('img', { name: /Фото входа/ })).getAttribute('src')).toBe('https://signed/p1');
    expect(screen.getByText('Недоступно')).toBeTruthy();
    expect(screen.getByText('приставной, по просьбе')).toBeTruthy();
    expect(screen.getByText('да')).toBeTruthy();
    expect(screen.getByText('не проверено')).toBeTruthy();
  });

  it('публикация убирает карточку из очереди и сообщает наружу', async () => {
    const user = userEvent.setup();
    const { onChanged, decide } = setup();

    await user.click(await screen.findByRole('button', { name: /Опубликовать/ }));

    expect(decide).toHaveBeenCalledWith('p1', 'published');
    expect(await screen.findByRole('heading', { name: 'Кафе «Пингвин»' })).toBeTruthy();
    expect(onChanged).toHaveBeenCalledWith(1, true);
    expect((screen.getByRole('status')).textContent).toContain('опубликован');
  });

  it('отклонение не считается публикацией', async () => {
    const user = userEvent.setup();
    const { onChanged, decide } = setup();

    await user.click(await screen.findByRole('button', { name: /Отклонить/ }));

    expect(decide).toHaveBeenCalledWith('p1', 'hidden');
    expect(onChanged).toHaveBeenCalledWith(1, false);
  });

  it('отказ сервера оставляет карточку на месте', async () => {
    const user = userEvent.setup();
    const { onChanged } = setup({
      decide: vi.fn().mockRejectedValue(new Error('Карточка уже обработана или у вас нет прав на проверку')),
    });

    await user.click(await screen.findByRole('button', { name: /Опубликовать/ }));

    expect((await screen.findByRole('alert')).textContent).toContain('нет прав');
    expect(screen.getByRole('heading', { name: 'Аптека «Здоровье»' })).toBeTruthy();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('пустая очередь так и называется', async () => {
    setup({ loadQueue: vi.fn().mockResolvedValue([]) });
    expect(await screen.findByRole('heading', { name: 'Очередь пуста' })).toBeTruthy();
  });
});
