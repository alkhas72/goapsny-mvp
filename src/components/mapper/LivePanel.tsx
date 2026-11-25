import { Square } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { assistantErrorText, fetchLiveToken } from '../../services/assistantApi';
import {
  measureText,
  primeLiveAudio,
  startLive,
  type LiveMeasure,
  type LiveSession,
  type LiveState,
} from '../../services/geminiLive';

/**
 * Разговор координатора с помощником через камеру и голос (Gemini Live),
 * внутри тех же шагов «Новый объект». Цифры, которые помощник записал в
 * разговоре, сразу уходят в поля карточки.
 */
interface LivePanelProps {
  onMeasure: (measure: LiveMeasure) => void;
  // Швы для тестов.
  liveToken?: typeof fetchLiveToken;
  liveStart?: typeof startLive;
}

export interface LivePanelHandle {
  /** Начать разговор. Вызывать из обработчика нажатия: так браузер даёт звук. */
  begin(): void;
}

const STATE_TEXT: Record<Exclude<LiveState, 'ended'>, string> = {
  connecting: 'Соединяю…',
  listening: 'Слушаю и смотрю',
};

export const LivePanel = forwardRef<LivePanelHandle, LivePanelProps>(function LivePanel(
  { onMeasure, liveToken = fetchLiveToken, liveStart = startLive },
  ref,
) {
  const [state, setState] = useState<LiveState | null>(null);
  const [lines, setLines] = useState<{ who: 'you' | 'assistant'; text: string }[]>([]);
  const [noted, setNoted] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  // Закрыли, пока шло соединение: сессию, которая откроется позже, надо сразу остановить.
  const wantedRef = useRef(false);

  const on = state === 'connecting' || state === 'listening';
  const shown = on || error != null;

  useEffect(
    () => () => {
      wantedRef.current = false;
      sessionRef.current?.stop();
    },
    [],
  );

  useEffect(() => {
    const log = logRef.current;
    if (log) log.scrollTop = log.scrollHeight;
  }, [lines]);

  const end = () => {
    wantedRef.current = false;
    sessionRef.current?.stop();
    sessionRef.current = null;
    setState(null);
    setError(null);
  };

  const begin = async () => {
    if (on || !videoRef.current) return;
    // Звук готовим прямо в нажатии: после ожидания токена браузер его уже не даст.
    const audio = primeLiveAudio();
    wantedRef.current = true;
    setError(null);
    setLines([]);
    setNoted(null);
    setState('connecting');
    try {
      const { token, model } = await liveToken();
      const session = await liveStart(
        token,
        model,
        videoRef.current,
        {
          onState: (next) => setState(next === 'ended' ? null : next),
          onText: (who, said) =>
            setLines((current) => {
              const last = current[current.length - 1];
              // Расшифровка приходит кусками: дописываем реплику того же говорящего.
              if (last && last.who === who) return [...current.slice(0, -1), { who, text: last.text + said }];
              return [...current, { who, text: said }].slice(-8);
            }),
          onMeasure: (measure) => {
            onMeasure(measure);
            const words = measureText(measure);
            if (words) setNoted(words);
          },
          onError: setError,
        },
        audio,
      );
      if (!wantedRef.current) {
        session.stop();
        return;
      }
      sessionRef.current = session;
    } catch (failure) {
      void audio?.close().catch(() => undefined);
      setState(null);
      setError(failure instanceof Error && failure.name === 'Error' ? failure.message : assistantErrorText(failure));
    }
  };

  useImperativeHandle(ref, () => ({ begin: () => void begin() }));

  // Видео стоит в разметке всегда: разговор начинается по нажатию и сразу получает его.
  return (
    <div className={`nf-live${shown ? ' is-on' : ''}`} role="dialog" aria-label="Камера и голос" aria-hidden={!shown}>
      <video ref={videoRef} className="nf-live-video" muted playsInline aria-label="Камера" />
      {shown && (
        <div className="nf-live-panel">
          {on && (
            <p className="nf-live-state" role="status">
              {STATE_TEXT[state === 'listening' ? 'listening' : 'connecting']}
            </p>
          )}
          {error && (
            <p className="nf-live-error" role="alert">
              {error}
            </p>
          )}
          <div className="nf-live-lines" ref={logRef}>
            {lines.map((line, index) => (
              <p key={index} className={line.who === 'you' ? 'is-you' : ''}>
                {line.text}
              </p>
            ))}
          </div>
          {noted && (
            <p className="nf-live-noted">
              <b>Записал в карточку, предварительно</b>
              {noted}
            </p>
          )}
          <button type="button" className="nf-btn is-ghost" onClick={end}>
            <Square size={16} aria-hidden="true" /> {on ? 'Закончить' : 'Закрыть'}
          </button>
        </div>
      )}
    </div>
  );
});
