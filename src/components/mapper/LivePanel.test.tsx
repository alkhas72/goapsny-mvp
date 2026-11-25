import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { fetchLiveToken } from '../../services/assistantApi';
import { measureText, type LiveHandlers, type startLive } from '../../services/geminiLive';
import { LivePanel, type LivePanelHandle } from './LivePanel';

type Token = typeof fetchLiveToken;
type Start = typeof startLive;

function setup(liveToken: Token, liveStart: Start) {
  const onMeasure = vi.fn();
  const ref = createRef<LivePanelHandle>();
  render(<LivePanel ref={ref} onMeasure={onMeasure} liveToken={liveToken} liveStart={liveStart} />);
  return { onMeasure, ref };
}

describe('LivePanel: камера и голос внутри шагов', () => {
  afterEach(cleanup);

  it('разговор идёт с токеном координатора, записанные цифры уходят в карточку', async () => {
    const user = userEvent.setup();
    const stop = vi.fn();
    let handlers: LiveHandlers | null = null;
    const liveToken = vi.fn<Token>().mockResolvedValue({ token: 'tok', model: 'gemini-live' });
    const liveStart = vi.fn<Start>(async (_token, _model, _video, given) => {
      handlers = given;
      return { stop };
    });
    const { onMeasure, ref } = setup(liveToken, liveStart);
    // Пока разговор не начат, панель скрыта.
    expect(screen.queryByRole('button', { name: /Закончить/ })).toBeNull();

    await act(async () => ref.current?.begin());
    expect(liveStart).toHaveBeenCalledWith('tok', 'gemini-live', expect.any(HTMLVideoElement), expect.anything(), null);

    act(() => {
      handlers?.onState('listening');
      handlers?.onText('assistant', 'Вижу две ');
      handlers?.onText('assistant', 'ступени.');
      handlers?.onMeasure({ steps: 2, stepHeightCm: 14, doorWidthCm: null, note: null });
    });
    expect(screen.getByRole('status').textContent).toBe('Слушаю и смотрю');
    expect(screen.getByText('Вижу две ступени.')).toBeTruthy();
    expect(screen.getByText(/ступеней 2 · ступень 14 см/)).toBeTruthy();
    expect(onMeasure).toHaveBeenCalledWith({ steps: 2, stepHeightCm: 14, doorWidthCm: null, note: null });

    await user.click(screen.getByRole('button', { name: /Закончить/ }));
    expect(stop).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Закончить/ })).toBeNull();
  });

  it('отказ назван словами и закрывается', async () => {
    const user = userEvent.setup();
    const liveStart = vi.fn<Start>().mockRejectedValue(new Error('Нет доступа к микрофону и камере.'));
    const { ref } = setup(vi.fn<Token>().mockResolvedValue({ token: 'tok', model: 'm' }), liveStart);

    await act(async () => ref.current?.begin());
    expect((await screen.findByRole('alert')).textContent).toBe('Нет доступа к микрофону и камере.');
    await user.click(screen.getByRole('button', { name: /Закрыть/ }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('цифры называются по-человечески', () => {
    expect(measureText({ steps: 1, stepHeightCm: null, doorWidthCm: 90, note: null })).toBe('ступеней 1 · дверь 90 см');
    expect(measureText({ steps: null, stepHeightCm: null, doorWidthCm: null, note: null })).toBe('');
  });
});
