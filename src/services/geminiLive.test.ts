import { describe, expect, it } from 'vitest';
import {
  bytesToBase64,
  downsample,
  floatToPcm16,
  measureFromArgs,
  parseServerMessage,
  pcm16Base64ToFloat,
  setupMessage,
} from './geminiLive';

describe('Gemini Live: сообщения', () => {
  it('первое сообщение: модель, голосовой ответ, указание, функция замера, расшифровки', () => {
    const { setup } = setupMessage('gemini-3.8-live', 'Говори коротко') as { setup: Record<string, unknown> };
    expect(setup.model).toBe('models/gemini-3.8-live');
    expect(setup.generationConfig).toEqual({ responseModalities: ['AUDIO'] });
    expect(setup.systemInstruction).toEqual({ parts: [{ text: 'Говори коротко' }] });
    expect(setup.inputAudioTranscription).toEqual({});
    expect(setup.outputAudioTranscription).toEqual({});
    expect(setup.contextWindowCompression).toEqual({ slidingWindow: {} });
    const tool = (setup.tools as { functionDeclarations: { name: string }[] }[])[0];
    expect(tool.functionDeclarations[0].name).toBe('save_measure');
  });

  it('разбирает ответ сервера: звук, расшифровки, перебивание, вызов функции', () => {
    const event = parseServerMessage({
      serverContent: {
        modelTurn: { parts: [{ inlineData: { data: 'AAA=' } }, { text: 'x' }, { inlineData: { data: 'BBB=' } }] },
        inputTranscription: { text: 'сколько ступеней' },
        outputTranscription: { text: 'Две ступени' },
        interrupted: true,
        turnComplete: true,
      },
      toolCall: { functionCalls: [{ id: 'c1', name: 'save_measure', args: { steps: 2 } }, { id: 'c2' }] },
    });
    expect(event.audio).toEqual(['AAA=', 'BBB=']);
    expect(event.heard).toBe('сколько ступеней');
    expect(event.said).toBe('Две ступени');
    expect(event.interrupted).toBe(true);
    expect(event.turnComplete).toBe(true);
    expect(event.toolCalls).toEqual([{ id: 'c1', name: 'save_measure', args: { steps: 2 } }]);
    expect(event.goAway).toBe(false);
  });

  it('незнакомое сообщение не роняет разбор', () => {
    expect(parseServerMessage({ setupComplete: {} })).toMatchObject({ audio: [], heard: null, toolCalls: [] });
    expect(parseServerMessage(null).audio).toEqual([]);
    expect(parseServerMessage({ goAway: { timeLeft: '10s' } }).goAway).toBe(true);
  });

  it('замер от модели: вне пределов базы отбрасывается', () => {
    expect(measureFromArgs({ steps: 2, step_height_cm: 14.6, door_width_cm: '85', note: ' Крыльцо ' })).toEqual({
      steps: 2,
      stepHeightCm: 15,
      doorWidthCm: 85,
      note: 'Крыльцо',
    });
    expect(measureFromArgs({ steps: -1, step_height_cm: 900, door_width_cm: 5 })).toEqual({
      steps: null,
      stepHeightCm: null,
      doorWidthCm: null,
      note: null,
    });
    expect(measureFromArgs(undefined).steps).toBeNull();
  });
});

describe('Gemini Live: звук', () => {
  it('понижает частоту до 16 кГц', () => {
    const input = new Float32Array(480).fill(0.5);
    const out = downsample(input, 48000);
    expect(out.length).toBe(160);
    expect(out[0]).toBeCloseTo(0.5);
    // Уже 16 кГц или ниже: без изменений.
    expect(downsample(input, 16000)).toBe(input);
  });

  it('переводит отсчёты в 16-битный PCM и обратно', () => {
    const pcm = floatToPcm16(new Float32Array([0, 1, -1, 0.5, 2]));
    expect(pcm.length).toBe(10);
    const view = new DataView(pcm.buffer);
    expect(view.getInt16(0, true)).toBe(0);
    expect(view.getInt16(2, true)).toBe(32767);
    expect(view.getInt16(4, true)).toBe(-32768);
    // Перегруз обрезается.
    expect(view.getInt16(8, true)).toBe(32767);
    const back = pcm16Base64ToFloat(bytesToBase64(pcm));
    expect(back[0]).toBeCloseTo(0);
    expect(back[1]).toBeCloseTo(1, 3);
    expect(back[2]).toBeCloseTo(-1);
    expect(back[3]).toBeCloseTo(0.5, 3);
  });
});
