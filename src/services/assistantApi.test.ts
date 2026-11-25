import { describe, expect, it, vi } from 'vitest';
import { AssistantApiError, assistantErrorText, canUseLive, fetchLiveToken, guideAssistant } from './assistantApi';

function server(body: unknown, status = 200) {
  return vi.fn(async () => ({ ok: status < 400, status, json: async () => body })) as unknown as typeof fetch;
}
const getToken = async () => 'jwt';

describe('assistantApi', () => {
  it('помощник в шагах: слова, шаг и карточка уходят на сервер, назад приходят ответ и поля', async () => {
    const fetchImpl = server({ reply: ' Записал. ', patch: { steps: 2 } });
    const answer = await guideAssistant([{ role: 'user', text: 'две ступени' }], 2, { name: 'Аптека' }, { getToken, fetchImpl });
    expect(answer).toEqual({ reply: 'Записал.', patch: { steps: 2 } });
    const [url, init] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe('/api/assistant');
    expect(JSON.parse(init.body)).toEqual({
      mode: 'guide',
      messages: [{ role: 'user', text: 'две ступени' }],
      step: 2,
      card: { name: 'Аптека' },
    });
  });

  it('поля без слов годятся, пустой ответ без полей за ответ не выдаётся', async () => {
    const turn = [{ role: 'user' as const, text: 'а' }];
    expect(await guideAssistant(turn, 1, {}, { getToken, fetchImpl: server({ reply: '', patch: { steps: 0 } }) })).toEqual({
      reply: '',
      patch: { steps: 0 },
    });
    await expect(guideAssistant(turn, 1, {}, { getToken, fetchImpl: server({ reply: '', patch: [] }) })).rejects.toBeInstanceOf(
      AssistantApiError,
    );
  });

  it('обрыв связи и отказ сервера различаются', async () => {
    const turn = [{ role: 'user' as const, text: 'а' }];
    const down = vi.fn(async () => {
      throw new TypeError('Failed to fetch');
    }) as unknown as typeof fetch;
    await expect(guideAssistant(turn, 1, {}, { getToken, fetchImpl: down })).rejects.toMatchObject({ code: 'network' });
    await expect(
      guideAssistant(turn, 1, {}, { getToken, fetchImpl: server({ error: 'too_many_requests' }, 429) }),
    ).rejects.toMatchObject({ code: 'too_many_requests', status: 429 });
  });

  it('токен разговора с камерой', async () => {
    const fetchImpl = server({ token: 'auth_tokens/abc', model: 'gemini-3.8-live' });
    expect(await fetchLiveToken({ getToken, fetchImpl })).toEqual({ token: 'auth_tokens/abc', model: 'gemini-3.8-live' });
    await expect(fetchLiveToken({ getToken, fetchImpl: server({ error: 'coordinator_required' }, 403) })).rejects.toMatchObject({
      code: 'coordinator_required',
    });
  });

  it('причины названы по-русски, незнакомая даёт общий текст', () => {
    expect(assistantErrorText(new AssistantApiError('assistant_not_configured'))).toContain('нет ключа модели');
    expect(assistantErrorText(new AssistantApiError('live_not_configured'))).toContain('Gemini');
    expect(assistantErrorText(new Error('boom'))).toBe('Помощник не ответил. Попробуйте ещё раз.');
  });

  it('разговор с камерой показываем координатору, администратору и владельцу', () => {
    expect(canUseLive('coordinator')).toBe(true);
    expect(canUseLive('admin')).toBe(true);
    expect(canUseLive('owner')).toBe(true);
    expect(canUseLive('public_user')).toBe(false);
    expect(canUseLive(null)).toBe(false);
  });
});
