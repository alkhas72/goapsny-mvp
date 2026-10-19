import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, ChevronDown, Navigation, Share2 } from 'lucide-react';
import { routeLinks, sharePlace, type ShareOutcome } from '../utils/placeLinks';

interface PlaceActionsProps {
  name: string;
  lat: number;
  lng: number;
  shareText: string;
}

const NOTICE: Partial<Record<ShareOutcome, string>> = {
  copied: 'Ссылка скопирована',
  failed: 'Не удалось скопировать ссылку',
};

export function PlaceActions({ name, lat, lng, shareText }: PlaceActionsProps) {
  const [routeOpen, setRouteOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const routeButtonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  // Escape closes the app list before it can reach the sheet and close the card.
  useEffect(() => {
    const menu = menuRef.current;
    if (!routeOpen || !menu) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      event.preventDefault();
      setRouteOpen(false);
      routeButtonRef.current?.focus();
    };
    menu.addEventListener('keydown', onKeyDown);
    return () => menu.removeEventListener('keydown', onKeyDown);
  }, [routeOpen]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleShare = async () => {
    const outcome = await sharePlace({ title: name, text: shareText, url: window.location.href });
    setNotice(NOTICE[outcome] ?? null);
  };

  return (
    <div className="ps-actions" ref={menuRef}>
      <div className="ps-actions-row">
        <button
          ref={routeButtonRef}
          type="button"
          className="ps-action ps-action--primary"
          aria-expanded={routeOpen}
          aria-controls={menuId}
          onClick={() => setRouteOpen((value) => !value)}
        >
          <Navigation size={18} aria-hidden="true" />
          <span>Маршрут</span>
          <ChevronDown size={16} className="ps-action-chevron" aria-hidden="true" />
        </button>
        <button type="button" className="ps-action" onClick={() => void handleShare()}>
          <Share2 size={18} aria-hidden="true" />
          <span>Поделиться</span>
        </button>
      </div>

      {routeOpen && (
        <ul id={menuId} className="ps-route-list" aria-label="Открыть маршрут в приложении">
          {routeLinks(lat, lng).map((link) => (
            <li key={link.id}>
              <a href={link.href} target="_blank" rel="noreferrer" onClick={() => setRouteOpen(false)}>
                <span>{link.label}</span>
                <ArrowUpRight size={18} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      )}

      <p className="ps-actions-notice" role="status" aria-live="polite">
        {notice}
      </p>
    </div>
  );
}
