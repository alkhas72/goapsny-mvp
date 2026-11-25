// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LIVE_INSTRUCTION as SERVER_INSTRUCTION, liveSetup } from '../../api/_lib/live.js';
import { LIVE_INSTRUCTION, setupMessage } from '../../src/services/geminiLive';

describe('настройка Gemini Live: сервер и браузер говорят одно', () => {
  it('настройка в токене равна первому сообщению браузера', () => {
    expect(SERVER_INSTRUCTION).toBe(LIVE_INSTRUCTION);
    expect(liveSetup('gemini-3.8-live')).toEqual((setupMessage('gemini-3.8-live') as { setup: unknown }).setup);
  });

  it('голосовой ответ задан в generationConfig, как в справочнике Google', () => {
    expect(liveSetup('m')).toMatchObject({ model: 'models/m', generationConfig: { responseModalities: ['AUDIO'] } });
  });
});
