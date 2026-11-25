import { Camera, Mic, Send, Square, Video, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  askAssistant,
  assistantErrorText,
  canUseLive,
  fetchLiveToken,
  type ChatTurn,
} from '../services/assistantApi';
import { startLive, type LiveMeasure, type LiveSession, type LiveState } from '../services/geminiLive';
import { fetchMapperAccount } from '../services/moderation';
import { shrinkToBase64 } from '../utils/photo';
import { BrandMark } from './BrandMark';

/** Имя ассистента в интерфейсе. Вопрос «Нуца или без имени» у Алхаса открыт. */
export const ASSISTANT_NAME = 'Нуца';

interface AssistantDockProps {
  /** Вошёл ли человек: помощник отвечает только вошедшим. */
  signedIn?: boolean;
  onSignIn?: () => void;
  /** Замер из разговора с камерой: открыть «Новый объект» с этими цифрами. */
  onMeasure?: (measure: LiveMeasure) => void;
  // Ниже швы для тестов.
  ask?: typeof askAssistant;
  loadRole?: () => Promise<string | null>;
  liveToken?: typeof fetchLiveToken;
  liveStart?: typeof startLive;
  shrink?: (file: Blob) => Promise<string>;
}

interface Bubble extends ChatTurn {
  /** Превью приложенного фото (только на экране, в историю не идёт). */
  photoUrl?: string;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

function speechRecognition(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function speak(text: string) {
  if (typeof window.speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ru-RU';
  window.speechSynthesis.speak(utterance);
}

async function defaultRole(): Promise<string | null> {
  return (await fetchMapperAccount())?.role ?? null;
}

function measureText(m: LiveMeasure): string {
  const parts: string[] = [];
  if (m.steps != null) parts.push(`ступеней ${m.steps}`);
  if (m.stepHeightCm != null) parts.push(`ступень ${m.stepHeightCm} см`);
  if (m.doorWidthCm != null) parts.push(`дверь ${m.doorWidthCm} см`);
  return parts.join(' · ');
}

const LIVE_STATE_TEXT: Record<Exclude<LiveState, 'ended'>, string> = {
  connecting: 'Соединяю…',
  listening: 'Слушаю и смотрю',
};

/**
 * Цифровой помощник: кнопка-купол внизу экрана и шторка разговора.
 *
 * Два помощника в одном месте (решение Алхаса 25.11). Волонтёрам и
 * аудиторам отвечает DeepSeek Flash: текст, голос, фото. Координаторам
 * района доступен разговор с камерой на Gemini Live. Виден только в
 * оболочке «живой интерфейс» (стили в src/skin-living.css).
 */
export function AssistantDock({
  signedIn = false,
  onSignIn,
  onMeasure,
  ask = askAssistant,
  loadRole = defaultRole,
  liveToken = fetchLiveToken,
  liveStart = startLive,
  shrink = shrinkToBase64,
}: AssistantDockProps) {
  const [open, setOpen] = useState(false);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState<{ image: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [hearing, setHearing] = useState(false);
  const [liveState, setLiveState] = useState<LiveState | null>(null);
  const [liveLines, setLiveLines] = useState<{ who: 'you' | 'assistant'; text: string }[]>([]);
  const [measure, setMeasure] = useState<LiveMeasure | null>(null);
  const domeRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const urlsRef = useRef<string[]>([]);

  const liveOn = liveState === 'connecting' || liveState === 'listening';
  const canHear = speechRecognition() != null;

  useEffect(() => {
    if (!open) return;
    const dome = domeRef.current;
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      dome?.focus();
    };
  }, [open]);

  // Роль нужна только чтобы показать разговор с камерой; сервер проверяет её сам.
  useEffect(() => {
    if (!open || !signedIn) return;
    let cancelled = false;
    loadRole()
      .then((next) => {
        if (!cancelled) setRole(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [open, signedIn, loadRole]);

  // Шторка закрылась: микрофон, камера и речь останавливаются.
  useEffect(() => {
    if (open) return;
    sessionRef.current?.stop();
    sessionRef.current = null;
    recognitionRef.current?.stop();
    if (typeof window.speechSynthesis !== 'undefined') window.speechSynthesis.cancel();
  }, [open]);

  useEffect(
    () => () => {
      sessionRef.current?.stop();
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [bubbles, busy, liveLines]);

  const sendTurn = async (question: string, spoken: boolean) => {
    const clean = question.trim();
    if ((!clean && !photo) || busy) return;
    const turn: Bubble = { role: 'user', text: clean || 'Что на фото?', photoUrl: photo?.url };
    const image = photo?.image ?? null;
    const history = [...bubbles, turn];
    setBubbles(history);
    setText('');
    setPhoto(null);
    setError(null);
    setBusy(true);
    try {
      const reply = await ask(
        history.map(({ role: who, text: said }) => ({ role: who, text: said })),
        image,
      );
      setBubbles((current) => [...current, { role: 'assistant', text: reply }]);
      if (spoken) speak(reply);
    } catch (failure) {
      setError(assistantErrorText(failure));
    } finally {
      setBusy(false);
    }
  };

  const attach = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    try {
      const image = await shrink(file);
      const url = URL.createObjectURL(file);
      urlsRef.current.push(url);
      setPhoto({ image, url });
    } catch {
      setError('Фото не прочиталось. Снимите ещё раз.');
    }
  };

  const hear = () => {
    const Recognition = speechRecognition();
    if (!Recognition || busy) return;
    if (hearing) {
      recognitionRef.current?.stop();
      return;
    }
    const recognition = new Recognition();
    recognition.lang = 'ru-RU';
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const said = event.results[0]?.[0]?.transcript ?? '';
      if (said.trim()) void sendTurn(said, true);
    };
    recognition.onend = () => setHearing(false);
    recognition.onerror = () => setHearing(false);
    recognitionRef.current = recognition;
    setHearing(true);
    try {
      recognition.start();
    } catch {
      setHearing(false);
    }
  };

  const beginLive = async () => {
    if (liveOn || !videoRef.current) return;
    setError(null);
    setLiveLines([]);
    setMeasure(null);
    setLiveState('connecting');
    try {
      const { token, model } = await liveToken();
      sessionRef.current = await liveStart(token, model, videoRef.current, {
        onState: (state) => setLiveState(state === 'ended' ? null : state),
        onText: (who, said) =>
          setLiveLines((lines) => {
            const last = lines[lines.length - 1];
            // Расшифровка приходит кусками: дописываем реплику того же говорящего.
            if (last && last.who === who) return [...lines.slice(0, -1), { who, text: last.text + said }];
            return [...lines, { who, text: said }].slice(-8);
          }),
        onMeasure: setMeasure,
        onError: setError,
      });
    } catch (failure) {
      setLiveState(null);
      setError(failure instanceof Error && failure.name === 'Error' ? failure.message : assistantErrorText(failure));
    }
  };

  const endLive = () => {
    sessionRef.current?.stop();
    sessionRef.current = null;
    setLiveState(null);
  };

  return (
    <>
      <button
        ref={domeRef}
        type="button"
        className="lv-dome"
        aria-label={`Ассистент ${ASSISTANT_NAME}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <BrandMark size={34} />
      </button>
      {open && (
        <div className="lv-assistant-scrim" onClick={() => setOpen(false)}>
          <div
            className="lv-assistant-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lv-assistant-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="lv-assistant-grabber" aria-hidden="true" />
            <div className="lv-assistant-head">
              <span className="lv-assistant-face">
                <BrandMark size={25} />
              </span>
              <div>
                <p className="lv-assistant-kicker">Цифровой ассистент</p>
                <h2 id="lv-assistant-title" className="lv-assistant-title">
                  {ASSISTANT_NAME}
                </h2>
              </div>
              <button
                ref={closeRef}
                type="button"
                className="lv-assistant-close"
                aria-label="Закрыть"
                onClick={() => setOpen(false)}
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            {!signedIn && (
              <>
                <p className="lv-assistant-text">Войдите по почте, чтобы говорить с помощником.</p>
                {onSignIn && (
                  <button
                    type="button"
                    className="lv-assistant-wide"
                    onClick={() => {
                      setOpen(false);
                      onSignIn();
                    }}
                  >
                    Войти
                  </button>
                )}
              </>
            )}

            {signedIn && (
              <>
                {/* Видео стоит в разметке всегда: разговор с камерой начинается по нажатию и сразу получает его. */}
                <div className={`lv-live${liveOn ? ' is-on' : ''}`}>
                  <video ref={videoRef} className="lv-live-video" muted playsInline aria-label="Камера" />
                  {liveOn && (
                    <>
                      <p className="lv-live-state" role="status">
                        {LIVE_STATE_TEXT[liveState === 'listening' ? 'listening' : 'connecting']}
                      </p>
                      <div className="lv-live-lines" ref={logRef}>
                        {liveLines.map((line, index) => (
                          <p key={index} className={line.who === 'you' ? 'is-you' : ''}>
                            {line.text}
                          </p>
                        ))}
                      </div>
                      {measure && measureText(measure) && (
                        <div className="lv-live-measure">
                          <p>
                            <b>Замер, предварительно</b>
                            {measureText(measure)}
                          </p>
                          {onMeasure && (
                            <button
                              type="button"
                              className="lv-assistant-wide"
                              onClick={() => {
                                endLive();
                                setOpen(false);
                                onMeasure(measure);
                              }}
                            >
                              Добавить объект с этими цифрами
                            </button>
                          )}
                        </div>
                      )}
                      <button type="button" className="lv-assistant-wide is-quiet" onClick={endLive}>
                        <Square size={16} aria-hidden="true" /> Закончить
                      </button>
                    </>
                  )}
                </div>

                {!liveOn && (
                  <>
                    <div className="lv-chat" ref={logRef} aria-live="polite">
                      {bubbles.length === 0 && !busy && (
                        <p className="lv-assistant-text">Спросите текстом или голосом. Можно приложить фото входа.</p>
                      )}
                      {bubbles.map((bubble, index) => (
                        <div key={index} className={`lv-bubble is-${bubble.role}`}>
                          {bubble.photoUrl && <img src={bubble.photoUrl} alt="Приложенное фото" />}
                          {bubble.text}
                        </div>
                      ))}
                      {busy && <div className="lv-bubble is-assistant is-busy">Думаю…</div>}
                    </div>

                    {canUseLive(role) && (
                      <button type="button" className="lv-assistant-wide" onClick={() => void beginLive()}>
                        <Video size={18} aria-hidden="true" /> Камера и голос
                      </button>
                    )}

                    {photo && (
                      <div className="lv-chat-photo">
                        <img src={photo.url} alt="Фото к вопросу" />
                        <button type="button" aria-label="Убрать фото" onClick={() => setPhoto(null)}>
                          <X size={14} />
                        </button>
                      </div>
                    )}

                    <form
                      className="lv-composer"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void sendTurn(text, false);
                      }}
                    >
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(event) => {
                          const input = event.target;
                          void attach(input.files).finally(() => {
                            input.value = '';
                          });
                        }}
                      />
                      <button type="button" aria-label="Приложить фото" onClick={() => fileRef.current?.click()}>
                        <Camera size={20} />
                      </button>
                      <input
                        className="lv-composer-input"
                        aria-label="Вопрос помощнику"
                        placeholder="Вопрос"
                        value={text}
                        maxLength={2000}
                        onChange={(event) => setText(event.target.value)}
                      />
                      {canHear && (
                        <button
                          type="button"
                          aria-label={hearing ? 'Остановить запись' : 'Сказать голосом'}
                          aria-pressed={hearing}
                          onClick={hear}
                        >
                          <Mic size={20} />
                        </button>
                      )}
                      <button
                        type="submit"
                        className="is-send"
                        aria-label="Отправить"
                        disabled={busy || (!text.trim() && !photo)}
                      >
                        <Send size={18} />
                      </button>
                    </form>
                  </>
                )}

                {error && (
                  <p className="lv-assistant-error" role="alert">
                    {error}
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
