import { UserRound } from 'lucide-react';
import './map/mapChrome.css';

interface MapFooterProps {
  onCabinet: () => void;
  /** Kept for the shell; links without an address are not drawn at all. */
  onDisabledLink?: (label: string) => void;
}

interface ExternalLink {
  label: string;
  /** Outside address; a link without one is not shown. */
  href: string | null;
  side: 'start' | 'end';
}

/** DESIGN.md §7: centre — Кабинет, edges — Instagram / Telegram / сайт. */
const EXTERNAL_LINKS: readonly ExternalLink[] = [
  { label: 'Instagram', href: null, side: 'start' },
  { label: 'Telegram', href: null, side: 'start' },
  { label: 'Сайт', href: null, side: 'end' },
];

function RailLinks({ links }: { links: readonly ExternalLink[] }) {
  return (
    <>
      {links.map((link) => (
        <a
          key={link.label}
          className="map-rail-link"
          href={link.href ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.label}
        </a>
      ))}
    </>
  );
}

export function MapFooter({ onCabinet }: MapFooterProps) {
  const live = EXTERNAL_LINKS.filter((link) => Boolean(link.href));
  const start = live.filter((link) => link.side === 'start');
  const end = live.filter((link) => link.side === 'end');

  return (
    <footer className="public-bottom-rail map-rail" aria-label="Кабинет и ссылки">
      <div className="map-rail-side map-rail-side--start">
        <RailLinks links={start} />
      </div>
      <button type="button" className="map-rail-cabinet" onClick={onCabinet}>
        <UserRound size={20} strokeWidth={2.25} aria-hidden="true" />
        Кабинет
      </button>
      <div className="map-rail-side map-rail-side--end">
        <RailLinks links={end} />
      </div>
    </footer>
  );
}
