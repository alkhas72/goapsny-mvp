import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AssistantApiError, type guideAssistant } from '../../services/assistantApi';
import { Companion } from './Companion';

type Guide = typeof guideAssistant;

function setup(guide: Guide, extra: { canLive?: boolean; onLive?: () => void } = {}) {
  const onPatch = vi.fn();
  render(
    <Companion step={2} card={{ name: 'Аптека', category: 'health' }} onPatch={onPatch} guide={guide} {...extra} />,
  );
  return { onPatch };
}

describe('Companion: помощник внутри шагов', () => {
  afterEach(cleanup);

  it('слова человека уходят помощнику вместе с шагом и карточкой, поля возвращаются в карточку', async () => {
    const user = userEvent.setup();
    const guide = vi.fn<Guide>().mockResolvedValue({
      reply: 'Записал: 2 ступени, дверь 90 см.',
      patch: { steps: 2, door_width_cm: 90 },
    });
    const { onPatch } = setup(guide);

    await user.type(screen.getByLabelText('Помощник'), 'две ступени, дверь 90');
    await user.click(screen.getByRole('button', { name: 'Отправить' }));

    expect(await screen.findByText('Записал: 2 ступени, дверь 90 см.')).toBeTruthy();
    expect(guide).toHaveBeenCalledWith([{ role: 'user', text: 'две ступени, дверь 90' }], 2, {
      name: 'Аптека',
      category: 'health',
    });
    expect(onPatch).toHaveBeenCalledWith({ steps: 2, door_width_cm: 90 });
    expect((screen.getByLabelText('Помощник') as HTMLInputElement).value).toBe('');
  });

  it('вопрос без полей карточку не трогает, разговор продолжается с историей', async () => {
    const user = userEvent.setup();
    const guide = vi
      .fn<Guide>()
      .mockResolvedValueOnce({ reply: 'Дверь меряют по проёму.', patch: {} })
      .mockResolvedValueOnce({ reply: '', patch: { door_width_cm: 85 } });
    const { onPatch } = setup(guide);

    await user.type(screen.getByLabelText('Помощник'), 'как мерить дверь?{Enter}');
    expect(await screen.findByText('Дверь меряют по проёму.')).toBeTruthy();
    expect(onPatch).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText('Помощник'), '85{Enter}');
    // Помощник заполнил поле и промолчал: человек всё равно видит, что записано.
    expect(await screen.findByText('Записал.')).toBeTruthy();
    expect(guide.mock.calls[1][0]).toEqual([
      { role: 'user', text: 'как мерить дверь?' },
      { role: 'assistant', text: 'Дверь меряют по проёму.' },
      { role: 'user', text: '85' },
    ]);
    expect(onPatch).toHaveBeenCalledWith({ door_width_cm: 85 });
  });

  it('отказ сервиса назван словами', async () => {
    const user = userEvent.setup();
    setup(vi.fn<Guide>().mockRejectedValue(new AssistantApiError('assistant_off')));

    await user.type(screen.getByLabelText('Помощник'), 'привет{Enter}');
    expect((await screen.findByRole('alert')).textContent).toBeTruthy();
  });

  it('разговор с камерой открывается этой же полосой и только у тех, кому он доступен', async () => {
    const user = userEvent.setup();
    const onLive = vi.fn();
    setup(vi.fn<Guide>(), { canLive: true, onLive });
    await user.click(screen.getByRole('button', { name: 'Камера и голос' }));
    expect(onLive).toHaveBeenCalledTimes(1);

    cleanup();
    setup(vi.fn<Guide>());
    expect(screen.queryByRole('button', { name: 'Камера и голос' })).toBeNull();
  });
});
