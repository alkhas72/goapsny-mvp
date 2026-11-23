import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

function setup(submit: (input: SubmitMapperPlaceInput) => Promise<SubmitMapperPlaceResult>) {
  const onSaved = vi.fn();
  const view = render(
    <MapperFlow
      theme="light"
      getCenter={() => ({ lat: 43, lng: 41 })}
      eyes={eyes}
      submit={submit}
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
    expect(submit.mock.calls[0][0].photo).toBe(photo);
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
});
