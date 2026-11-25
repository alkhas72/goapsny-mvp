import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantApiError } from '../services/assistantApi';
import type { LiveHandlers } from '../services/geminiLive';
import { AssistantDock } from './AssistantDock';

afterEach(cleanup);

async function openDock(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: /Ассистент/ }));
  return screen.findByRole('dialog');
}

describe('AssistantDock: разговор', () => {
  it('без входа просит войти и ведёт ко входу', async () => {
    const user = userEvent.setup();
    const onSignIn = vi.fn();
    const ask = vi.fn();
    render(<AssistantDock signedIn={false} onSignIn={onSignIn} ask={ask} />);
    await openDock(user);
    expect(screen.getByText(/Войдите по почте/)).toBeTruthy();
    expect(screen.queryByLabelText('Вопрос помощнику')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Войти' }));
    expect(onSignIn).toHaveBeenCalledTimes(1);
    expect(ask).not.toHaveBeenCalled();
  });

  it('вопрос текстом уходит помощнику вместе с историей, ответ встаёт в ленту', async () => {
    const user = userEvent.setup();
    const ask = vi.fn().mockResolvedValueOnce('Здравствуйте').mockResolvedValueOnce('Ступень до 5 см считается низкой.');
    render(<AssistantDock signedIn ask={ask} loadRole={async () => 'public_user'} />);
    await openDock(user);

    await user.type(screen.getByLabelText('Вопрос помощнику'), 'Привет');
    await user.click(screen.getByRole('button', { name: 'Отправить' }));
    await screen.findByText('Здравствуйте');
    await user.type(screen.getByLabelText('Вопрос помощнику'), 'Какая ступень низкая?{Enter}');
    await screen.findByText('Ступень до 5 см считается низкой.');

    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1][0]).toEqual([
      { role: 'user', text: 'Привет' },
      { role: 'assistant', text: 'Здравствуйте' },
      { role: 'user', text: 'Какая ступень низкая?' },
    ]);
    expect(ask.mock.calls[1][1]).toBeNull();
  });

  it('фото прикладывается к вопросу и уходит уменьшенным', async () => {
    const user = userEvent.setup();
    const ask = vi.fn().mockResolvedValue('Вижу две ступени.');
    const shrink = vi.fn().mockResolvedValue('BASE64');
    render(<AssistantDock signedIn ask={ask} shrink={shrink} loadRole={async () => null} />);
    await openDock(user);

    const file = new File(['jpeg'], 'in.jpg', { type: 'image/jpeg' });
    await user.upload(document.querySelector('.lv-composer input[type="file"]') as HTMLInputElement, file);
    await screen.findByAltText('Фото к вопросу');
    // С фото можно отправить и без текста.
    await user.click(screen.getByRole('button', { name: 'Отправить' }));
    await screen.findByText('Вижу две ступени.');
    expect(ask.mock.calls[0]).toEqual([[{ role: 'user', text: 'Что на фото?' }], 'BASE64']);
  });

  it('помощник не подключён: причина на экране, выдуманного ответа нет', async () => {
    const user = userEvent.setup();
    const ask = vi.fn().mockRejectedValue(new AssistantApiError('assistant_not_configured', 503));
    render(<AssistantDock signedIn ask={ask} loadRole={async () => null} />);
    await openDock(user);
    await user.type(screen.getByLabelText('Вопрос помощнику'), 'Привет{Enter}');
    expect((await screen.findByRole('alert')).textContent).toContain('нет ключа модели');
    expect(document.querySelectorAll('.lv-bubble.is-assistant')).toHaveLength(0);
  });
});

describe('AssistantDock: разговор с камерой', () => {
  it('волонтёр кнопку «Камера и голос» не видит', async () => {
    const user = userEvent.setup();
    render(<AssistantDock signedIn ask={vi.fn()} loadRole={async () => 'public_user'} />);
    await openDock(user);
    await waitFor(() => expect(screen.getByLabelText('Вопрос помощнику')).toBeTruthy());
    expect(screen.queryByRole('button', { name: /Камера и голос/ })).toBeNull();
  });

  it('координатор начинает разговор, видит замер и открывает с ним новый объект', async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    let handlers: LiveHandlers | null = null;
    const liveToken = vi.fn().mockResolvedValue({ token: 'auth_tokens/abc', model: 'gemini-3.8-live' });
    const liveStart = vi.fn(async (_token: string, _model: string, _video: HTMLVideoElement, h: LiveHandlers) => {
      handlers = h;
      h.onState('listening');
      return { stop };
    });
    const onMeasure = vi.fn();
    render(
      <AssistantDock
        signedIn
        ask={vi.fn()}
        loadRole={async () => 'coordinator'}
        liveToken={liveToken}
        liveStart={liveStart}
        onMeasure={onMeasure}
      />,
    );
    await openDock(user);
    await user.click(await screen.findByRole('button', { name: /Камера и голос/ }));

    await screen.findByText('Слушаю и смотрю');
    expect(liveStart.mock.calls[0][0]).toBe('auth_tokens/abc');
    expect(liveStart.mock.calls[0][2]).toBeInstanceOf(HTMLVideoElement);

    handlers!.onText('assistant', 'Вижу две ');
    handlers!.onText('assistant', 'ступени.');
    await screen.findByText('Вижу две ступени.');
    handlers!.onMeasure({ steps: 2, stepHeightCm: 15, doorWidthCm: 90, note: null });
    await screen.findByText(/ступеней 2 · ступень 15 см · дверь 90 см/);

    await user.click(screen.getByRole('button', { name: 'Добавить объект с этими цифрами' }));
    expect(stop).toHaveBeenCalled();
    expect(onMeasure).toHaveBeenCalledWith({ steps: 2, stepHeightCm: 15, doorWidthCm: 90, note: null });
  });

  it('токен не выдан: причина на экране, разговор не начат', async () => {
    const user = userEvent.setup();
    const liveStart = vi.fn();
    render(
      <AssistantDock
        signedIn
        ask={vi.fn()}
        loadRole={async () => 'admin'}
        liveToken={vi.fn().mockRejectedValue(new AssistantApiError('live_not_configured', 503))}
        liveStart={liveStart}
      />,
    );
    await openDock(user);
    await user.click(await screen.findByRole('button', { name: /Камера и голос/ }));
    expect((await screen.findByRole('alert')).textContent).toContain('нет ключа Gemini');
    expect(liveStart).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Вопрос помощнику')).toBeTruthy();
  });

  it('закрытие шторки останавливает камеру и микрофон', async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    render(
      <AssistantDock
        signedIn
        ask={vi.fn()}
        loadRole={async () => 'owner'}
        liveToken={vi.fn().mockResolvedValue({ token: 't', model: 'm' })}
        liveStart={vi.fn(async (_t: string, _m: string, _v: HTMLVideoElement, h: LiveHandlers) => {
          h.onState('listening');
          return { stop };
        })}
      />,
    );
    await openDock(user);
    await user.click(await screen.findByRole('button', { name: /Камера и голос/ }));
    await screen.findByText('Слушаю и смотрю');
    await user.click(screen.getByRole('button', { name: 'Закрыть' }));
    expect(stop).toHaveBeenCalled();
  });
});
