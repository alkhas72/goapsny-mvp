import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { MapperOutbox } from '../../services/mapper-outbox';
import { SubmitPlaceError } from '../../services/submit-place';
import type { SubmitMapperPlaceInput, SubmitMapperPlaceResult } from '../../services/submit-mapper-place';
import { MapperFlow } from './MapperFlow';
import type { AssistantEyes } from './eyes';

vi.mock('../map/MapLibreMap', () => ({
  MapLibreMap: () => <div data-testid="map" />,
}));

vi.mock('../../utils/location', () => ({
  getBrowserLocation: vi.fn().mockResolvedValue({ lat: 43.0033, lng: 41.0237 }),
}));

vi.mock('../../utils/photo', async (original) => ({
  ...(await original<typeof import('../../utils/photo')>()),
  prepareFacadePhoto: vi.fn(async (file: File) => file),
}));

const eyes: AssistantEyes = {
  look: async () => ({
    name: 'Аптека «Здоровье»',
    category: 'health',
    subtype: 'Аптека',
    stepsVisible: 2,
    ramp: 'none',
  }),
};

const photo = new File(['jpeg'], 'entrance.jpg', { type: 'image/jpeg' });

/** Снимок уходит копией в памяти (см. holdPhotoInMemory): байты, имя и тип те же. */
async function expectSamePhoto(sent: Blob) {
  expect(sent).not.toBe(photo);
  expect((sent as File).name).toBe('entrance.jpg');
  expect(sent.type).toBe('image/jpeg');
  expect(await sent.text()).toBe('jpeg');
}

function setup(
  submit: (input: SubmitMapperPlaceInput) => Promise<SubmitMapperPlaceResult>,
  keep: { ownerId?: string; outbox?: { add: Mock<MapperOutbox['add']> } } = {},
) {
  const onSaved = vi.fn();
  const view = render(
    <MapperFlow
      theme="light"
      getCenter={() => ({ lat: 43, lng: 41 })}
      eyes={eyes}
      submit={submit}
      ownerId={keep.ownerId}
      outbox={keep.outbox}
      onClose={vi.fn()}
      onSaved={onSaved}
      onOpenDay={vi.fn()}
      onAnother={vi.fn()}
    />,
  );
  return { onSaved, ...view };
}

async function walkToLastStep(user: ReturnType<typeof userEvent.setup>) {
  const camera = document.querySelector('input[capture]') as HTMLInputElement;
  await user.upload(camera, photo);
  await user.click(await screen.findByRole('button', { name: 'Далее' }));
  await waitFor(() => expect((screen.getByLabelText(/Название/) as HTMLInputElement).value).toBe('Аптека «Здоровье»'));
  await user.click(screen.getByRole('button', { name: 'Далее' }));
  await user.click(screen.getByRole('button', { name: 'Далее' }));
  return screen.findByRole('button', { name: /Отправить на проверку/ });
}

describe('MapperFlow: отправка на проверку', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it('последний шаг отправляет на сервер всё, что собрал картограф', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({ placeId: 'p1', storagePath: 'p1/facade.jpg', place: {} });
    const { onSaved } = setup(submit);

    await user.click(await walkToLastStep(user));

    await screen.findByText(/на проверке/);
    expect(submit).toHaveBeenCalledTimes(1);
    expect(submit.mock.calls[0][0]).toMatchObject({
      name: 'Аптека «Здоровье»',
      category: 'health',
      lat: 43.0033,
      lng: 41.0237,
      status: 'red',
      stepsCount: 2,
      rampType: 'none',
      subtype: 'Аптека',
      stepHigh: 'unknown',
      doorWide: 'unknown',
    });
    await expectSamePhoto(submit.mock.calls[0][0].photo);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('отказ сервера: причина на экране, успеха нет, можно повторить', async () => {
    const user = userEvent.setup();
    const submit = vi
      .fn()
      .mockRejectedValueOnce(new SubmitPlaceError('server_not_ready', 'no rpc', 'PGRST202'))
      .mockResolvedValueOnce({ placeId: 'p1', storagePath: 'p1/facade.jpg', place: {} });
    const { onSaved } = setup(submit);

    await user.click(await walkToLastStep(user));

    expect((await screen.findByRole('alert')).textContent).toContain('Сервер пока не принимает объекты');
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByText(/— на проверке/)).toBeNull();

    await user.click(screen.getByRole('button', { name: /Повторить отправку/ }));
    await screen.findByText(/— на проверке/);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('сервер не ответил: объект остаётся на устройстве и ждёт отправки', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockRejectedValue(new SubmitPlaceError('unknown', 'Failed to fetch'));
    const add = vi.fn<MapperOutbox['add']>().mockResolvedValue({} as never);
    const { onSaved } = setup(submit, { ownerId: 'u1', outbox: { add } });

    await user.click(await walkToLastStep(user));

    await screen.findByText(/— сохранён на устройстве/);
    expect(screen.getByText(/Сервер не ответил/)).toBeTruthy();
    expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][0]).toBe('u1');
    expect(add.mock.calls[0][1]).toMatchObject({ name: 'Аптека «Здоровье»', status: 'red' });
    await expectSamePhoto(add.mock.calls[0][1].photo);
    expect(add.mock.calls[0][2]).toBe('unknown');
    // Кармы и записи «Сегодня» нет: сервер объект ещё не видел.
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.queryByText(/кармы/)).toBeNull();
  });

  it('сервер ещё не принимает: объект ждёт на устройстве, причина названа', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockRejectedValue(new SubmitPlaceError('server_not_ready', 'no rpc', 'PGRST202'));
    const add = vi.fn<MapperOutbox['add']>().mockResolvedValue({} as never);
    setup(submit, { ownerId: 'u1', outbox: { add } });

    await user.click(await walkToLastStep(user));

    await screen.findByText(/— сохранён на устройстве/);
    expect(screen.getByText(/Сервер пока не принимает объекты/)).toBeTruthy();
    expect(add.mock.calls[0][2]).toBe('server_not_ready');
  });

  it('связь есть, но фото не дошло: экран не говорит «нет связи»', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockRejectedValue(new SubmitPlaceError('missing_photo', 'upload failed'));
    const add = vi.fn<MapperOutbox['add']>().mockResolvedValue({} as never);
    setup(submit, { ownerId: 'u1', outbox: { add } });

    await user.click(await walkToLastStep(user));

    await screen.findByText(/— сохранён на устройстве/);
    expect(screen.getByText(/Фото не дошло до сервера/)).toBeTruthy();
    expect(screen.queryByText(/Нет связи/)).toBeNull();
    expect(add.mock.calls[0][2]).toBe('missing_photo');
  });

  it('отказ по существу на устройство не откладывается: причина на экране', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockRejectedValue(new SubmitPlaceError('card_invalid', 'invalid card', '22P02'));
    const add = vi.fn<MapperOutbox['add']>();
    setup(submit, { ownerId: 'u1', outbox: { add } });

    await user.click(await walkToLastStep(user));

    expect((await screen.findByRole('alert')).textContent).toContain('Сервер не принял данные входа');
    expect(add).not.toHaveBeenCalled();
  });

  it('хранилище устройства недоступно: остаётся отказ с повтором', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockRejectedValue(new SubmitPlaceError('unknown', 'Failed to fetch'));
    const add = vi.fn<MapperOutbox['add']>().mockRejectedValue(new Error('IndexedDB is blocked'));
    setup(submit, { ownerId: 'u1', outbox: { add } });

    await user.click(await walkToLastStep(user));

    expect((await screen.findByRole('alert')).textContent).toContain('Не удалось отправить');
    expect(screen.getByRole('button', { name: /Повторить отправку/ })).toBeTruthy();
  });
});
