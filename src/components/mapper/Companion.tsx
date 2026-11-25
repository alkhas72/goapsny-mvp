import { Mic, Send, Square, Video } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  assistantErrorText,
  guideAssistant,
  type ChatTurn,
  type GuidePatch,
} from '../../services/assistantApi';
import { BrandMark } from '../BrandMark';

/**
 * Помощник внутри пути картографа: полоса внизу каждого шага.
 *
 * Отдельного пути у помощника нет (слово Алхаса 25.11: «Никаких 2, 3, 10
 * путей картографа быть не может»). Он сопровождает человека в тех же шагах:
 * отвечает текстом и голосом и заполняет поля карточки с его слов. Разговор с
 * камерой для координатора открывается этой же полосой.
 */
interface CompanionProps {
  step: 1 | 2 | 3 | 4 | 5;
  /** Что сейчас в карточке: помощник видит это и не спрашивает заново. */
  card: Record<string, string | number>;
  /** Поля, которые помощник заполнил со слов человека. */
  onPatch: (patch: GuidePatch) => void;
  /** Координатору, администратору и владельцу доступен разговор с камерой. */
  canLive?: boolean;
  onLive?: () => void;
  // Шов для тестов.
  guide?: typeof guideAssistant;
}

/** Что можно сказать на этом шаге: подсказка в поле ввода. */
const HINT: Record<CompanionProps['step'], string> = {
  1: 'Спросите помощника',
  2: 'Две ступени, дверь 90',
  3: 'Какой цвет выбрать?',
  4: 'Туалет есть, поручней нет',
  5: 'Спросите помощника',
};

const MAX_TURNS = 8;

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

export function Companion({ step, card, onPatch, canLive = false, onLive, guide = guideAssistant }: CompanionProps) {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [reply, setReply] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hearing, setHearing] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const canHear = speechRecognition() != null;

  // Шаги закрылись: микрофон и речь останавливаются.
  useEffect(
    () => () => {
      recognitionRef.current?.stop();
      if (typeof window.speechSynthesis !== 'undefined') window.speechSynthesis.cancel();
    },
    [],
  );

  const send = async (said: string, spoken: boolean) => {
    const clean = said.trim();
    if (!clean || busy) return;
    const history = [...turns, { role: 'user' as const, text: clean }].slice(-MAX_TURNS);
    setTurns(history);
    setText('');
    setError(null);
    setBusy(true);
    try {
      const answer = await guide(history, step, card);
      if (Object.keys(answer.patch).length > 0) onPatch(answer.patch);
      const words = answer.reply || 'Записал.';
      setReply(words);
      setTurns((current) => [...current, { role: 'assistant' as const, text: words }].slice(-MAX_TURNS));
      if (spoken) speak(words);
    } catch (failure) {
      setError(assistantErrorText(failure));
    } finally {
      setBusy(false);
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
      if (said.trim()) void send(said, true);
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

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void send(text, false);
  };

  const typed = text.trim().length > 0;

  return (
    <div className="nf-companion">
      {(busy || reply) && !error && (
        <p className="nf-companion-say" role="status">
          <BrandMark size={16} />
          <span>{busy ? 'Думаю…' : reply}</span>
        </p>
      )}
      {error && (
        <p className="nf-companion-say is-error" role="alert">
          {error}
        </p>
      )}
      <form className="nf-companion-bar" onSubmit={submit}>
        <input
          className="nf-companion-input"
          aria-label="Помощник"
          placeholder={hearing ? 'Слушаю…' : HINT[step]}
          value={text}
          maxLength={500}
          enterKeyHint="send"
          onChange={(event) => setText(event.target.value)}
        />
        {typed ? (
          <button type="submit" className="is-send" aria-label="Отправить" disabled={busy}>
            <Send size={18} aria-hidden="true" />
          </button>
        ) : (
          canHear && (
            <button
              type="button"
              className={hearing ? 'is-on' : ''}
              aria-label={hearing ? 'Остановить запись' : 'Сказать голосом'}
              aria-pressed={hearing}
              disabled={busy}
              onClick={hear}
            >
              {hearing ? <Square size={16} aria-hidden="true" /> : <Mic size={18} aria-hidden="true" />}
            </button>
          )
        )}
        {canLive && onLive && (
          <button type="button" className="is-live" aria-label="Камера и голос" onClick={onLive}>
            <Video size={18} aria-hidden="true" />
          </button>
        )}
      </form>
    </div>
  );
}
