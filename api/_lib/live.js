// Gemini Live: настройка разговора и выпуск короткого токена.
//
// Проверено 25.11.2026 по справочнику Google (api-reference/generate-content/
// create-token) и на живом ответе сервиса: токен выдаёт POST /v1beta/auth_tokens
// с ключом в x-goog-api-key; настройка разговора лежит в поле
// bidiGenerateContentSetup (имя liveConnectConstraints из примера в
// документации сервис отвергает); сам токен приходит в поле name. Если
// fieldMask пуст, разговор идёт с настройкой из токена, а настройка,
// присланная браузером, не учитывается. Поэтому указание и функция живут
// здесь, на сервере; src/services/geminiLive.ts держит такую же копию, их
// сверяет tests/api/live-setup.test.ts.

export const TOKEN_URL = 'https://generativelanguage.googleapis.com/v1beta/auth_tokens';
export const DEFAULT_LIVE_MODEL = 'gemini-3.8-live';

/** Минута, чтобы начать разговор; полчаса на сам разговор. */
export const START_WINDOW_MS = 60 * 1000;
export const SESSION_WINDOW_MS = 30 * 60 * 1000;

export const LIVE_INSTRUCTION = [
  'Ты цифровой помощник координатора карты доступности GoApsny (Абхазия). Говоришь по-русски, коротко и по делу.',
  'Координатор стоит у входа в здание и показывает его камерой. Помоги описать вход для человека на коляске:',
  'сколько ступеней, какова высота самой высокой ступени, какова ширина дверного проёма, есть ли пандус или подъёмник.',
  'Сантиметры оценивай по знакомым предметам в кадре и называй как примерные. Если видно плохо, попроси подойти или показать ближе.',
  'Граница низкой ступени 5 сантиметров, дверь для коляски от 80 сантиметров.',
  'Когда цифры названы и координатор согласен, вызови функцию save_measure. Это предварительный замер, окончательный делают рулеткой.',
].join(' ');

export const MEASURE_TOOL = {
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

/** Настройка разговора: модель, голосовой ответ, указание, функция, расшифровки. */
export function liveSetup(model) {
  return {
    model: `models/${model}`,
    generationConfig: { responseModalities: ['AUDIO'] },
    systemInstruction: { parts: [{ text: LIVE_INSTRUCTION }] },
    tools: [MEASURE_TOOL],
    inputAudioTranscription: {},
    outputAudioTranscription: {},
    // Без сжатия окна разговор со звуком и видео живёт около двух минут.
    contextWindowCompression: { slidingWindow: {} },
  };
}

/**
 * Одноразовый короткий токен. Ответ: { ok, status, token, model, detail }.
 * detail — текст отказа сервиса (в нём нет ключа), для журнала и проверки.
 */
export async function createLiveToken({ fetchImpl = fetch, env = process.env, now = () => Date.now() } = {}) {
  const model = env.GEMINI_LIVE_MODEL || DEFAULT_LIVE_MODEL;
  const response = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uses: 1,
      expireTime: new Date(now() + SESSION_WINDOW_MS).toISOString(),
      newSessionExpireTime: new Date(now() + START_WINDOW_MS).toISOString(),
      bidiGenerateContentSetup: liveSetup(model),
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.error?.message === 'string' ? data.error.message : '';
    return { ok: false, status: response.status, token: '', model, detail: message.slice(0, 300) };
  }
  const token = typeof data?.name === 'string' ? data.name : '';
  return { ok: Boolean(token), status: response.status, token, model, detail: token ? '' : 'no token in response' };
}
