import { afterEach, describe, expect, it, vi, type Mock } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
    stepHeightCm: null,
    doorWidthCm: null,
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
  // Шаг «Туалет и удобства» можно пропустить целиком.
  await user.click(screen.getByRole('button', { name: 'Пропустить' }));
  return screen.findByRole('button', { name: /Отправить на проверку/ });
}

/** До шага «Данные»: фото снято, помощник заполнил поля. */
async function walkToData(user: ReturnType<typeof userEvent.setup>) {
  const camera = document.querySelector('input[capture]') as HTMLInputElement;
  await user.upload(camera, photo);
  await user.click(await screen.findByRole('button', { name: 'Далее' }));
  await waitFor(() => expect((screen.getByLabelText(/Название/) as HTMLInputElement).value).toBe('Аптека «Здоровье»'));
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
      stepHeightCm: null,
      doorWidthCm: null,
      toilet: 'unknown',
      toiletPhotos: [],
      handWash: 'unknown',
      accessibleParking: 'unknown',
      elevator: 'unknown',
    });
    await expectSamePhoto(submit.mock.calls[0][0].photo);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('сантиметры вводятся цифрой и уходят как предварительный замер от человека', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({ placeId: 'p1', storagePath: 'p1/facade.jpg', place: {}, toiletPhotosSaved: 0 });
    setup(submit);

    await walkToData(user);
    expect(screen.getByText('предварительно')).toBeTruthy();
    // Прежних вопросов «выше 5 см» и «шире 80 см» больше нет.
    expect(screen.queryByText(/Ступень выше 5 см/)).toBeNull();
    expect(screen.queryByText(/Дверь шире 80 см/)).toBeNull();
    await user.type(screen.getByLabelText(/Высота ступени, см/), '12');
    await user.type(screen.getByLabelText(/Ширина двери, см/), '85');
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Пропустить' }));
    await user.click(await screen.findByRole('button', { name: /Отправить на проверку/ }));

    await screen.findByText(/на проверке/);
    expect(submit.mock.calls[0][0]).toMatchObject({
      stepHeightCm: 12,
      doorWidthCm: 85,
      stepHeightSource: 'person',
      doorWidthSource: 'person',
      stepHigh: 'yes',
      doorWide: 'yes',
    });
  });

  it('число вне допустимого не уходит на сервер', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({ placeId: 'p1', storagePath: 'p1/facade.jpg', place: {}, toiletPhotosSaved: 0 });
    setup(submit);

    await walkToData(user);
    const door = screen.getByLabelText(/Ширина двери, см/);
    await user.type(door, '9');
    expect(door.getAttribute('aria-invalid')).toBe('true');
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Пропустить' }));
    await user.click(await screen.findByRole('button', { name: /Отправить на проверку/ }));

    await screen.findByText(/на проверке/);
    expect(submit.mock.calls[0][0]).toMatchObject({ doorWidthCm: null, doorWide: 'unknown' });
  });

  it('в поле «Пандус» есть подъёмник', async () => {
    const user = userEvent.setup();
    setup(vi.fn());
    await walkToData(user);
    const ramp = screen.getAllByRole('combobox')[0] as HTMLSelectElement;
    expect([...ramp.options].map((o) => o.textContent)).toContain('Подъёмник');
  });

  it('шаг «Туалет и удобства»: туалет с фото и описанием, отметки одним нажатием', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({ placeId: 'p1', storagePath: 'p1/facade.jpg', place: {}, toiletPhotosSaved: 1 });
    setup(submit);

    await walkToData(user);
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));

    expect(screen.getByText(/Шаг 4 из 5/)).toBeTruthy();
    // Пока туалет не отмечен, фото и описание не спрашиваем.
    expect(screen.queryByLabelText(/Описание/)).toBeNull();
    await user.click(within(screen.getByRole('group', { name: 'Туалет' })).getByRole('button', { name: 'Есть' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Доступен на коляске' })).getByRole('button', { name: 'Частично' }),
    );
    const toiletInput = document.querySelectorAll('input[type="file"]')[2] as HTMLInputElement;
    await user.upload(toiletInput, new File(['wc'], 'wc.jpg', { type: 'image/jpeg' }));
    await screen.findByAltText('Фото туалета 1');
    await user.type(screen.getByLabelText(/Описание/), 'Узкая дверь');
    await user.click(within(screen.getByRole('group', { name: 'Можно помыть руки' })).getByRole('button', { name: 'Да' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Парковка для людей с инвалидностью' })).getByRole('button', { name: 'Нет' }),
    );
    // Лифт отметили и сняли отметку: ответа нет.
    const elevator = within(screen.getByRole('group', { name: 'Лифт между этажами' }));
    await user.click(elevator.getByRole('button', { name: 'Да' }));
    await user.click(elevator.getByRole('button', { name: 'Да' }));

    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(await screen.findByRole('button', { name: /Отправить на проверку/ }));
    await screen.findByText(/на проверке/);

    const sent = submit.mock.calls[0][0] as SubmitMapperPlaceInput;
    expect(sent).toMatchObject({
      toilet: 'yes',
      toiletAccessible: 'partial',
      toiletNote: 'Узкая дверь',
      handWash: 'yes',
      accessibleParking: 'no',
      elevator: 'unknown',
    });
    expect(sent.toiletPhotos).toHaveLength(1);
    expect(await sent.toiletPhotos![0].text()).toBe('wc');
    expect(screen.queryByText(/Фото туалета не сохранились/)).toBeNull();
  });

  it('фото туалета сервер не взял: об этом сказано на экране', async () => {
    const user = userEvent.setup();
    const submit = vi.fn().mockResolvedValue({ placeId: 'p1', storagePath: 'p1/facade.jpg', place: {}, toiletPhotosSaved: 0 });
    setup(submit);

    await walkToData(user);
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(within(screen.getByRole('group', { name: 'Туалет' })).getByRole('button', { name: 'Есть' }));
    const toiletInput = document.querySelectorAll('input[type="file"]')[2] as HTMLInputElement;
    await user.upload(toiletInput, new File(['wc'], 'wc.jpg', { type: 'image/jpeg' }));
    await screen.findByAltText('Фото туалета 1');
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(await screen.findByRole('button', { name: /Отправить на проверку/ }));

    await screen.findByText(/на проверке/);
    expect(screen.getByText(/Фото туалета не сохранились/)).toBeTruthy();
  });

  it('помощник описывает фото туалета, если человек ещё ничего не написал', async () => {
    const user = userEvent.setup();
    const describing: AssistantEyes = { ...eyes, describeToilet: async () => 'Широкая дверь, есть поручни' };
    render(
      <MapperFlow
        theme="light"
        getCenter={() => ({ lat: 43, lng: 41 })}
        eyes={describing}
        submit={vi.fn()}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        onOpenDay={vi.fn()}
        onAnother={vi.fn()}
      />,
    );
    await walkToData(user);
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(screen.getByRole('button', { name: 'Далее' }));
    await user.click(within(screen.getByRole('group', { name: 'Туалет' })).getByRole('button', { name: 'Есть' }));
    const toiletInput = document.querySelectorAll('input[type="file"]')[2] as HTMLInputElement;
    await user.upload(toiletInput, new File(['wc'], 'wc.jpg', { type: 'image/jpeg' }));
    await waitFor(() =>
      expect((screen.getByLabelText(/Описание/) as HTMLTextAreaElement).value).toBe('Широкая дверь, есть поручни'),
    );
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
