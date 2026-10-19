import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ArrowUpRight,
  Building2,
  Bus,
  Camera,
  ChevronDown,
  CircleAlert,
  CircleDashed,
  DoorOpen,
  Dumbbell,
  Footprints,
  GraduationCap,
  Hospital,
  Hotel,
  ImageOff,
  Landmark,
  Map as MapIcon,
  MapPin,
  MoveVertical,
  RotateCw,
  ShieldCheck,
  ShoppingBag,
  SquareParking,
  Ticket,
  Toilet,
  TriangleRight,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react';
import { CATEGORIES } from '../shared/index';
import type { PublicPlace } from '../services/places';
import { hasPortableRamp, rampLabel } from '../services/places';
import { RAMP_COLOR, statusColor, statusLabel } from '../utils/status';
import { accessHighlights, type HighlightKind } from '../utils/accessText';
import { cardVariantFromSearch, externalLinks, type PlaceCardVariant } from '../utils/placeLinks';
import { getFocusableElements } from '../utils/focusTrap';
import { AccessPassport } from './AccessPassport';
import { PlaceActions } from './PlaceActions';
import './placeSheet.css';

export type PlaceSheetState = 'idle' | 'loading' | 'error' | 'partial';

interface PlaceSheetProps {
  open: boolean;
  place: PublicPlace | null;
  state: PlaceSheetState;
  errorMessage?: string;
  onClose: () => void;
  onRetry?: () => void;
  /** Layout override; by default read from `?card=` in the address. */
  variant?: PlaceCardVariant;
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  shops: ShoppingBag,
  food: Utensils,
  public_transport: Bus,
  tourism: MapIcon,
  leisure: Ticket,
  accommodation: Hotel,
  education: GraduationCap,
  government: Building2,
  health: Hospital,
  bank_post: Landmark,
  sport: Dumbbell,
  toilets: Toilet,
};

const HIGHLIGHT_ICONS: Record<HighlightKind, LucideIcon> = {
  steps: Footprints,
  ramp: TriangleRight,
  door: DoorOpen,
  toilet: Toilet,
  elevator: MoveVertical,
  parking: SquareParking,
};

function categoryLabel(slug: string): string | null {
  return CATEGORIES.find((item) => item.slug === slug)?.ru ?? null;
}

function formatVerifiedAt(value?: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date
    .toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
    .replace(/\s?г\.$/, '');
}

/** Raw transport errors are for logs; people get a plain reason. */
function readableReason(message?: string): string {
  if (message && /[а-яё]/i.test(message)) return message;
  return 'Проверьте интернет и попробуйте ещё раз.';
}

function defaultVariant(): PlaceCardVariant {
  return typeof window === 'undefined' ? 'a' : cardVariantFromSearch(window.location.search);
}

/** Inside a closed <details> only the summary can take focus. */
function isReachable(element: HTMLElement): boolean {
  const details = element.closest('details');
  if (!details || details.open) return true;
  return element.tagName === 'SUMMARY' && element.parentElement === details;
}

function PlaceHeader({ place, titleId }: { place: PublicPlace; titleId: string }) {
  const Icon = CATEGORY_ICONS[place.category] ?? MapPin;
  const category = categoryLabel(place.category);
  return (
    <div className="ps-head">
      <span className="ps-cat-icon" style={{ backgroundColor: statusColor(place.status) }} aria-hidden="true">
        <Icon size={22} strokeWidth={2.2} />
      </span>
      <div className="ps-head-text">
        <h3 id={titleId} className="ps-title">
          {place.name}
        </h3>
        {category && <p className="ps-category">{category}</p>}
      </div>
    </div>
  );
}

function StatusBlock({ place }: { place: PublicPlace }) {
  const verification = place.details.verification;
  const verifiedAt = formatVerifiedAt(verification?.verified_at);
  return (
    <div className="ps-status">
      <p
        className={`ps-status-pill ps-status-pill--${place.status}`}
        style={{ '--ps-status': statusColor(place.status) } as CSSProperties}
      >
        <span className="ps-status-dot" aria-hidden="true" />
        {statusLabel(place.status)}
      </p>
      {place.status === 'gray' ? (
        <p className="ps-verified">
          <CircleDashed size={16} aria-hidden="true" />
          Ещё не проверено волонтёром
        </p>
      ) : (
        verifiedAt && (
          <p className="ps-verified">
            <ShieldCheck size={16} aria-hidden="true" />
            Проверено: {verification?.verified_by_role ?? 'аудитор'} · {verifiedAt}
          </p>
        )
      )}
    </div>
  );
}

function Highlights({ place }: { place: PublicPlace }) {
  const items = accessHighlights(place);
  if (items.length === 0) {
    return <p className="ps-highlights-empty">Данных о входе пока нет</p>;
  }
  return (
    <ul className="ps-highlights" aria-label="Главное о доступности">
      {items.map((item) => {
        const Icon = HIGHLIGHT_ICONS[item.kind];
        return (
          <li key={item.kind} className="ps-chip">
            {item.portableRamp ? (
              <span className="ps-ramp-dot" style={{ backgroundColor: RAMP_COLOR }} aria-hidden="true" />
            ) : (
              <Icon size={16} aria-hidden="true" />
            )}
            {item.text}
          </li>
        );
      })}
    </ul>
  );
}

function Photo({ place, hero }: { place: PublicPlace; hero?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (place.facadePhotoUrl && !failed) {
    return (
      <img
        src={place.facadePhotoUrl}
        alt={`Фото входа: ${place.name}`}
        className={hero ? 'ps-photo ps-photo--hero' : 'ps-photo'}
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }
  if (place.facadePhotoError || failed) {
    return (
      <p className="ps-photo-missing">
        <ImageOff size={18} aria-hidden="true" />
        Фото недоступно
      </p>
    );
  }
  return (
    <p className="ps-photo-missing">
      <Camera size={18} aria-hidden="true" />
      Фото входа пока нет
    </p>
  );
}

function Address({ place }: { place: PublicPlace }) {
  const address = place.details.address?.trim();
  if (!address) return null;
  return (
    <p className="ps-address">
      <MapPin size={18} aria-hidden="true" />
      {address}
    </p>
  );
}

function RampLine({ place }: { place: PublicPlace }) {
  if (place.rampType === 'none') return null;
  return (
    <p className="ps-ramp-line">
      {hasPortableRamp(place.rampType) ? (
        <span className="ps-ramp-dot" style={{ backgroundColor: RAMP_COLOR }} aria-hidden="true" />
      ) : (
        <TriangleRight size={18} aria-hidden="true" />
      )}
      {rampLabel(place.rampType)}
    </p>
  );
}

function ExternalLinks({ place }: { place: PublicPlace }) {
  const links = externalLinks(place.details.external_links);
  if (links.length === 0) return null;
  return (
    <details className="ps-links">
      <summary>
        <span className="ps-links-title">Есть на: {links.map((link) => link.short).join(' · ')}</span>
        <ChevronDown size={18} className="ps-links-chevron" aria-hidden="true" />
      </summary>
      <ul className="ps-links-list">
        {links.map((link) => (
          <li key={link.id}>
            <a href={link.href} target="_blank" rel="noreferrer">
              <span>{link.label}</span>
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function Comment({ place }: { place: PublicPlace }) {
  const text = place.comment?.trim();
  if (!text) return null;
  return (
    <section className="ps-comment" aria-label="Комментарий">
      <h4 className="ps-section-title">Комментарий</h4>
      <p>{text}</p>
    </section>
  );
}

function PartialNote({ onRetry }: { onRetry?: () => void }) {
  return (
    <div className="ps-partial" role="status">
      <CircleAlert size={18} aria-hidden="true" />
      <span>Часть данных не загрузилась</span>
      {onRetry && (
        <button type="button" className="ps-text-btn" onClick={onRetry}>
          Повторить
        </button>
      )}
    </div>
  );
}

function SkeletonHead() {
  return (
    <div className="ps-head" aria-hidden="true">
      <span className="ps-sk ps-sk-icon" />
      <div className="ps-head-text">
        <span className="ps-sk ps-sk-line ps-sk-line--title" />
        <span className="ps-sk ps-sk-line ps-sk-line--short" />
      </div>
    </div>
  );
}

function SkeletonBody() {
  return (
    <div className="ps-skeleton" role="status" aria-live="polite">
      <span className="ps-visually-hidden">Загрузка места…</span>
      <span className="ps-sk ps-sk-pill" aria-hidden="true" />
      <span className="ps-sk ps-sk-line ps-sk-line--mid" aria-hidden="true" />
      <div className="ps-sk-chips" aria-hidden="true">
        <span className="ps-sk ps-sk-chip" />
        <span className="ps-sk ps-sk-chip" />
        <span className="ps-sk ps-sk-chip ps-sk-chip--short" />
      </div>
      <div className="ps-sk-actions" aria-hidden="true">
        <span className="ps-sk ps-sk-action" />
        <span className="ps-sk ps-sk-action" />
      </div>
      <span className="ps-sk ps-sk-photo" aria-hidden="true" />
    </div>
  );
}

export function PlaceSheet({
  open,
  place,
  state,
  errorMessage,
  onClose,
  onRetry,
  variant: variantProp,
}: PlaceSheetProps) {
  const variant = variantProp ?? defaultVariant();
  const sheetRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();

  const placeId = place?.id ?? null;
  const [expanded, setExpanded] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [trackedId, setTrackedId] = useState(placeId);
  if (trackedId !== placeId) {
    // A different place starts again in the half-open position.
    setTrackedId(placeId);
    setExpanded(false);
    setScrolled(false);
  }

  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Focus goes into the sheet once; Tab cycles through what is reachable now
  // (the content changes from skeleton to place without re-trapping).
  useEffect(() => {
    const sheet = sheetRef.current;
    if (!open || !sheet) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = getFocusableElements(sheet).filter(isReachable);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (event.shiftKey && (active === first || !sheet.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    sheet.addEventListener('keydown', onKeyDown);
    return () => sheet.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    sheetRef.current?.scrollTo?.({ top: 0 });
  }, [placeId]);

  // The half-open height follows the top block (header, status, summary,
  // actions), so it never cuts a button in half on any screen.
  useLayoutEffect(() => {
    const sheet = sheetRef.current;
    const peek = peekRef.current;
    if (!open || !sheet) return;
    const measure = () => {
      if (!peek) {
        sheet.style.removeProperty('--ps-peek');
        return;
      }
      // On short screens the top block may not fit: stop at the last whole
      // element that does, never in the middle of a button or a line.
      // Half-open keeps the map in sight: at most ~45% of the screen.
      const room = (sheet.offsetParent as HTMLElement | null)?.clientHeight ?? window.innerHeight;
      const limit = Math.min(room * 0.74, window.innerHeight * 0.45);
      let bottom = peek.offsetTop + peek.offsetHeight + 20;
      if (bottom > limit) {
        bottom = 0;
        for (const child of Array.from(peek.children) as HTMLElement[]) {
          // The sheet is the offset parent of every block inside it.
          const childBottom = child.offsetTop + child.offsetHeight + 16;
          if (childBottom > limit) break;
          bottom = childBottom;
        }
        if (bottom === 0) bottom = limit;
      }
      sheet.style.setProperty('--ps-peek', `${Math.ceil(bottom)}px`);
    };
    measure();
    window.addEventListener('resize', measure);
    const observer = peek && typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (peek) observer?.observe(peek);
    return () => {
      window.removeEventListener('resize', measure);
      observer?.disconnect();
    };
  }, [open, placeId, state, variant]);

  if (!open) return null;

  const showSkeleton = state === 'loading' && !place;
  const showError = state === 'error';
  const current = !showSkeleton && !showError ? place : null;
  const photoFirst = variant === 'b' && Boolean(current?.facadePhotoUrl);
  const partial = state === 'partial';

  const handleScroll = () => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    const top = sheet.scrollTop;
    if (!expanded && top > 4) setExpanded(true);
    const threshold = photoFirst ? Math.max((heroRef.current?.offsetHeight ?? 0) - 56, 0) : 2;
    const nextScrolled = top > threshold;
    if (nextScrolled !== scrolled) setScrolled(nextScrolled);
  };

  const toggleExpanded = () => {
    if (expanded) sheetRef.current?.scrollTo?.({ top: 0 });
    setExpanded(!expanded);
  };

  const shareText = current
    ? [current.name, statusLabel(current.status), current.details.address?.trim()].filter(Boolean).join(' · ')
    : '';

  const actions = current && (
    <PlaceActions name={current.name} lat={current.lat} lng={current.lng} shareText={shareText} />
  );

  return (
    <article
      ref={sheetRef}
      className={`ps ps--${variant}${photoFirst ? ' ps--photo-first' : ''}`}
      data-expanded={expanded}
      data-scrolled={scrolled}
      role="dialog"
      aria-modal="true"
      aria-labelledby={current ? titleId : undefined}
      aria-label={current ? undefined : 'Карточка места'}
      onScroll={handleScroll}
    >
      <div className="ps-bar">
        <button
          type="button"
          className="ps-grabber"
          aria-label={expanded ? 'Свернуть карточку' : 'Развернуть карточку'}
          aria-expanded={expanded}
          onClick={toggleExpanded}
        >
          <span className="ps-grabber-bar" aria-hidden="true" />
        </button>
        {showSkeleton && <SkeletonHead />}
        {current && !photoFirst && <PlaceHeader place={current} titleId={titleId} />}
        {current && photoFirst && (
          <span className="ps-bar-title" aria-hidden="true">
            {current.name}
          </span>
        )}
        <button
          ref={closeButtonRef}
          type="button"
          className="ps-close"
          aria-label="Закрыть карточку"
          onClick={() => onCloseRef.current()}
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      {showSkeleton && <SkeletonBody />}

      {showError && (
        <div className="ps-error" role="alert">
          <span className="ps-error-icon" aria-hidden="true">
            <CircleAlert size={24} />
          </span>
          <p className="ps-error-title">Не удалось открыть место</p>
          <p className="ps-error-reason">{readableReason(errorMessage)}</p>
          {onRetry && (
            <button type="button" className="ps-action ps-action--primary ps-error-retry" onClick={onRetry}>
              <RotateCw size={18} aria-hidden="true" />
              Повторить
            </button>
          )}
        </div>
      )}

      {current && variant === 'a' && (
        <>
          <div className="ps-peek" ref={peekRef}>
            <StatusBlock place={current} />
            <Highlights place={current} />
            {actions}
            {partial && <PartialNote onRetry={onRetry} />}
          </div>
          <Photo key={current.facadePhotoUrl ?? 'none'} place={current} />
          <Address place={current} />
          <AccessPassport place={current} />
          <ExternalLinks place={current} />
          <Comment place={current} />
        </>
      )}

      {current && variant === 'b' && (
        <>
          <div className="ps-peek" ref={peekRef}>
            {photoFirst && (
              <div className="ps-hero" ref={heroRef}>
                <Photo key={current.facadePhotoUrl ?? 'none'} place={current} hero />
              </div>
            )}
            {photoFirst && <PlaceHeader place={current} titleId={titleId} />}
            <StatusBlock place={current} />
            <Address place={current} />
            <RampLine place={current} />
            {actions}
            {partial && <PartialNote onRetry={onRetry} />}
          </div>
          {!photoFirst && <Photo key={current.facadePhotoUrl ?? 'none'} place={current} />}
          <AccessPassport place={current} />
          <ExternalLinks place={current} />
          <Comment place={current} />
        </>
      )}
    </article>
  );
}
