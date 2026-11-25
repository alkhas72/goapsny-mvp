/**
 * Разговор координатора с Gemini Live: голос и камера, прямо из браузера.
 *
 * Сервер (`api/live-token.js`) выдаёт одноразовый короткий токен; с ним
 * браузер открывает WebSocket к Google и шлёт звук микрофона (PCM 16 кГц) и
 * кадры камеры (JPEG, не чаще одного в секунду). Ответ приходит звуком
 * (PCM 24 кГц) и текстом расшифровки.
 *
 * Формат сообщений сверен с документацией Gemini Live API 25.11.2026.
 * С настоящим ключом разговор ещё не запускался: что в документации не
 * нашлось (сообщение о готовности сервера), обрабатывается с запасом, а
 * причина обрыва выводится на экран дословно.
 */

export const LIVE_WS_URL =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';

export const MIC_RATE = 16000;
export const SPEAKER_RATE = 24000;
/** Кадр камеры не чаще одного в секунду (предел сервиса). */
const FRAME_INTERVAL_MS = 1000;
const FRAME_MAX_SIDE = 768;
/** Если сервер не прислал ничего после настройки, начинаем сами. */
const READY_FALLBACK_MS = 3000;

export const LIVE_INSTRUCTION = [
  'Ты цифровой помощник координатора карты доступности GoApsny (Абхазия). Говоришь по-русски, коротко и по делу.',
  'Координатор стоит у входа в здание и показывает его камерой. Помоги описать вход для человека на коляске:',
  'сколько ступеней, какова высота самой высокой ступени, какова ширина дверного проёма, есть ли пандус или подъёмник.',
  'Сантиметры оценивай по знакомым предметам в кадре и называй как примерные. Если видно плохо, попроси подойти или показать ближе.',
  'Граница низкой ступени 5 сантиметров, дверь для коляски от 80 сантиметров.',
  'Когда цифры названы и координатор согласен, вызови функцию save_measure. Это предварительный замер, окончательный делают рулеткой.',
].join(' ');

/** Что помощник записал в разговоре: предварительный замер входа. */
export interface LiveMeasure {
  steps: number | null;
  stepHeightCm: number | null;
  doorWidthCm: number | null;
  note: string | null;
}

/** Те же цифры словами, как их видит человек. */
export function measureText(m: LiveMeasure): string {
  const parts: string[] = [];
  if (m.steps != null) parts.push(`ступеней ${m.steps}`);
  if (m.stepHeightCm != null) parts.push(`ступень ${m.stepHeightCm} см`);
  if (m.doorWidthCm != null) parts.push(`дверь ${m.doorWidthCm} см`);
  return parts.join(' · ');
}

const MEASURE_TOOL = {
  functionDeclarations: [
    {
      name: 'save_measure',
      description: 'Записать предварительный замер входа, когда цифры названы и координатор согласен.',
      parameters: {
        type: 'OBJECT',
        properties: {
          steps: { type: 'INTEGER', description: 'Сколько ступеней ведёт к двери; 0, если ступеней нет.' },
          step_height_cm: { type: 'INTEGER', description: 'Высота самой высокой ступени, сантиметры.' },
          door_width_cm: { type: 'INTEGER', description: 'Ширина дверного проёма, сантиметры.' },
          note: { type: 'STRING', description: 'Короткое замечание о входе.' },
        },
      },
    },
  ],
};

/**
 * Первое сообщение разговора: модель, голосовой ответ, указание, функция,
 * расшифровки. Та же настройка зашита сервером в короткий токен
 * (api/_lib/live.js), и по справочнику Google действует именно она; копии
 * сверяет tests/api/live-setup.test.ts.
 */
export function setupMessage(model: string, instruction: string = LIVE_INSTRUCTION): unknown {
  return {
    setup: {
      model: `models/${model}`,
      generationConfig: { responseModalities: ['AUDIO'] },
      systemInstruction: { parts: [{ text: instruction }] },
      tools: [MEASURE_TOOL],
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      // Без сжатия окна разговор со звуком и видео живёт около двух минут.
      contextWindowCompression: { slidingWindow: {} },
    },
  };
}

function wholeIn(value: unknown, min: number, max: number): number | null {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n);
  return rounded >= min && rounded <= max ? rounded : null;
}

/** Аргументы функции от модели → замер; всё вне пределов базы отбрасывается. */
export function measureFromArgs(args: unknown): LiveMeasure {
  const a = (args && typeof args === 'object' ? args : {}) as Record<string, unknown>;
  const note = typeof a.note === 'string' ? a.note.trim().slice(0, 300) : '';
  return {
    steps: wholeIn(a.steps, 0, 60),
    stepHeightCm: wholeIn(a.step_height_cm, 0, 100),
    doorWidthCm: wholeIn(a.door_width_cm, 30, 500),
    note: note || null,
  };
}

/** Звук микрофона с частотой устройства → 16 кГц (усреднение соседних отсчётов). */
export function downsample(input: Float32Array, inputRate: number, outputRate: number = MIC_RATE): Float32Array {
  if (inputRate <= outputRate) return input;
  const ratio = inputRate / outputRate;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    for (let j = start; j < end; j += 1) sum += input[j];
    output[i] = end > start ? sum / (end - start) : 0;
  }
  return output;
}

/** Отсчёты −1…1 → 16-битный PCM, младший байт первым. */
export function floatToPcm16(input: Float32Array): Uint8Array {
  const bytes = new Uint8Array(input.length * 2);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < input.length; i += 1) {
    const s = Math.max(-1, Math.min(1, input[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/** Звук ответа (base64, 16-битный PCM) → отсчёты −1…1. */
export function pcm16Base64ToFloat(base64: string): Float32Array {
  const binary = atob(base64);
  const length = Math.floor(binary.length / 2);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i += 1) {
    const value = binary.charCodeAt(i * 2) | (binary.charCodeAt(i * 2 + 1) << 8);
    output[i] = (value >= 0x8000 ? value - 0x10000 : value) / 0x8000;
  }
  return output;
}

/** Что пришло от сервера, в удобном для экрана виде. */
export interface LiveEvent {
  audio: string[];
  heard: string | null;
  said: string | null;
  interrupted: boolean;
  turnComplete: boolean;
  toolCalls: { id: string; name: string; args: unknown }[];
  /** Сервер предупредил, что скоро закроет разговор. */
  goAway: boolean;
}

export function parseServerMessage(raw: unknown): LiveEvent {
  const m = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const content = (m.serverContent && typeof m.serverContent === 'object' ? m.serverContent : {}) as Record<string, unknown>;
  const turn = (content.modelTurn && typeof content.modelTurn === 'object' ? content.modelTurn : {}) as { parts?: unknown };
  const audio: string[] = [];
  for (const part of Array.isArray(turn.parts) ? turn.parts : []) {
    const data = (part as { inlineData?: { data?: unknown } })?.inlineData?.data;
    if (typeof data === 'string' && data) audio.push(data);
  }
  const text = (value: unknown): string | null => {
    const t = (value as { text?: unknown })?.text;
    return typeof t === 'string' && t ? t : null;
  };
  const calls = (m.toolCall as { functionCalls?: unknown })?.functionCalls;
  const toolCalls = (Array.isArray(calls) ? calls : [])
    .map((c) => c as { id?: unknown; name?: unknown; args?: unknown })
    .filter((c) => typeof c.name === 'string')
    .map((c) => ({ id: typeof c.id === 'string' ? c.id : '', name: c.name as string, args: c.args }));
  return {
    audio,
    heard: text(content.inputTranscription),
    said: text(content.outputTranscription),
    interrupted: content.interrupted === true,
    turnComplete: content.turnComplete === true,
    toolCalls,
    goAway: m.goAway != null,
  };
}

export type LiveState = 'connecting' | 'listening' | 'ended';

export interface LiveHandlers {
  onState(state: LiveState): void;
  /** Строка расшифровки: что услышал помощник или что он сказал. */
  onText(who: 'you' | 'assistant', text: string): void;
  onMeasure(measure: LiveMeasure): void;
  /** Причина обрыва человеческими словами плюс то, что сказал сервер. */
  onError(message: string): void;
}

export interface LiveSession {
  stop(): void;
}

type AudioContextCtor = typeof AudioContext;

function audioCtor(): AudioContextCtor | undefined {
  return window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
}

/**
 * Приготовить звук прямо в обработчике нажатия. Safari на iPhone даёт звук
 * только по действию человека, а токен разговора приходит позже.
 */
export function primeLiveAudio(): AudioContext | null {
  const Ctor = audioCtor();
  if (!Ctor) return null;
  const context = new Ctor();
  void context.resume().catch(() => undefined);
  return context;
}

/**
 * Открыть разговор. Вызывать из обработчика нажатия: браузер даёт микрофон,
 * камеру и звук только по действию человека. `primed` это звук, приготовленный
 * в самом нажатии через primeLiveAudio.
 */
export async function startLive(
  token: string,
  model: string,
  video: HTMLVideoElement,
  handlers: LiveHandlers,
  primed?: AudioContext | null,
): Promise<LiveSession> {
  const Ctor = audioCtor();
  if ((!Ctor && !primed) || !navigator.mediaDevices?.getUserMedia) {
    void primed?.close().catch(() => undefined);
    throw new Error('Этот браузер не даёт микрофон и камеру.');
  }
  const audioContext = primed ?? new (Ctor as AudioContextCtor)();
  void audioContext.resume().catch(() => undefined);

  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 },
      video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    });
  } catch {
    void audioContext.close().catch(() => undefined);
    throw new Error('Нет доступа к микрофону и камере. Разрешите их в настройках браузера.');
  }
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  void video.play().catch(() => undefined);

  let stopped = false;
  let ready = false;
  let playAt = 0;
  const playing = new Set<AudioBufferSourceNode>();
  const socket = new WebSocket(`${LIVE_WS_URL}?access_token=${encodeURIComponent(token)}`);
  const send = (message: unknown) => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };

  const source = audioContext.createMediaStreamSource(stream);
  // ScriptProcessor устарел, но работает в Safari на iPhone без отдельного файла-обработчика.
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silent = audioContext.createGain();
  silent.gain.value = 0;
  processor.onaudioprocess = (event) => {
    if (!ready || stopped) return;
    const pcm = floatToPcm16(downsample(event.inputBuffer.getChannelData(0), audioContext.sampleRate));
    send({ realtimeInput: { audio: { data: bytesToBase64(pcm), mimeType: `audio/pcm;rate=${MIC_RATE}` } } });
  };
  source.connect(processor);
  processor.connect(silent);
  silent.connect(audioContext.destination);

  const canvas = document.createElement('canvas');
  const frameTimer = window.setInterval(() => {
    if (!ready || stopped || !video.videoWidth) return;
    const scale = Math.min(1, FRAME_MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/jpeg', 0.6).split(',')[1];
    if (data) send({ realtimeInput: { video: { data, mimeType: 'image/jpeg' } } });
  }, FRAME_INTERVAL_MS);

  const hush = () => {
    playing.forEach((node) => {
      try {
        node.stop();
      } catch {
        // Уже отыграл.
      }
    });
    playing.clear();
    playAt = 0;
  };

  const play = (base64: string) => {
    const samples = pcm16Base64ToFloat(base64);
    if (samples.length === 0) return;
    const buffer = audioContext.createBuffer(1, samples.length, SPEAKER_RATE);
    buffer.getChannelData(0).set(samples);
    const node = audioContext.createBufferSource();
    node.buffer = buffer;
    node.connect(audioContext.destination);
    playAt = Math.max(playAt, audioContext.currentTime + 0.05);
    node.start(playAt);
    playAt += buffer.duration;
    playing.add(node);
    node.onended = () => playing.delete(node);
  };

  const stop = () => {
    if (stopped) return;
    stopped = true;
    window.clearInterval(frameTimer);
    window.clearTimeout(readyTimer);
    hush();
    processor.onaudioprocess = null;
    try {
      source.disconnect();
      processor.disconnect();
      silent.disconnect();
    } catch {
      // Узлы уже отключены.
    }
    stream.getTracks().forEach((track) => track.stop());
    video.srcObject = null;
    if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) socket.close(1000);
    void audioContext.close().catch(() => undefined);
    handlers.onState('ended');
  };

  const begin = () => {
    if (ready || stopped) return;
    ready = true;
    handlers.onState('listening');
  };
  let readyTimer = 0;

  handlers.onState('connecting');
  socket.onopen = () => {
    send(setupMessage(model));
    readyTimer = window.setTimeout(begin, READY_FALLBACK_MS);
  };
  socket.onmessage = (message) => {
    void (async () => {
      const text = typeof message.data === 'string' ? message.data : await (message.data as Blob).text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        return;
      }
      // Любое первое сообщение сервера после настройки значит, что он готов слушать.
      begin();
      const event = parseServerMessage(parsed);
      if (event.interrupted) hush();
      event.audio.forEach(play);
      if (event.heard) handlers.onText('you', event.heard);
      if (event.said) handlers.onText('assistant', event.said);
      if (event.toolCalls.length > 0) {
        const responses = event.toolCalls.map((call) => {
          if (call.name === 'save_measure') handlers.onMeasure(measureFromArgs(call.args));
          return { id: call.id, name: call.name, response: { result: call.name === 'save_measure' ? 'saved' : 'unknown' } };
        });
        send({ toolResponse: { functionResponses: responses } });
      }
      if (event.goAway) handlers.onError('Разговор скоро закончится: сервис закрывает длинные разговоры. Начните новый.');
    })();
  };
  socket.onerror = () => {
    if (!stopped) handlers.onError('Связь с Gemini оборвалась.');
  };
  socket.onclose = (event) => {
    if (stopped) return;
    if (event.code !== 1000) {
      const reason = event.reason ? ` Ответ сервиса: ${event.reason}` : '';
      handlers.onError(`Разговор закрыт (код ${event.code}).${reason}`);
    }
    stop();
  };

  return { stop };
}
