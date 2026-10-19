import { useEffect, useRef, type ComponentType, type KeyboardEvent, type RefObject } from 'react';
import {
  Building2,
  Bus,
  ChevronRight,
  Dumbbell,
  GraduationCap,
  Hospital,
  Hotel,
  Landmark,
  Map as MapIcon,
  MapPin,
  SearchX,
  ShoppingBag,
  Ticket,
  Toilet,
  Utensils,
  X,
} from 'lucide-react';
import type { PublicPlace } from '../services/places';
import { STATUS_META } from '../shared/index';
import { trapFocus } from '../utils/focusTrap';
import { STATUS_WORD, categoryName, entranceDetail, placesWord } from './PlaceListModel';
import './discovery.css';

type IconComponent = ComponentType<{ size?: number; strokeWidth?: number; 'aria-hidden'?: boolean }>;

const CATEGORY_ICONS: Record<string, IconComponent> = {
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

export function CategoryIcon({ slug, size = 18 }: { slug: string; size?: number }) {
  const Icon = CATEGORY_ICONS[slug] ?? MapPin;
  return <Icon size={size} strokeWidth={2} aria-hidden />;
}

interface PlaceRowsProps {
  places: PublicPlace[];
  onSelect: (placeId: string) => void;
  listLabel: string;
  firstRowRef?: RefObject<HTMLButtonElement | null>;
  onRowKeyDown?: (event: KeyboardEvent<HTMLButtonElement>, index: number) => void;
}

/** Rows shared by the area list and the search results. */
export function PlaceRows({ places, onSelect, listLabel, firstRowRef, onRowKeyDown }: PlaceRowsProps) {
  return (
    <ul className="dv-rows" aria-label={listLabel}>
      {places.map((place, index) => {
        const category = categoryName(place.category);
        const detail = entranceDetail(place);
        const status = STATUS_WORD[place.status];
        return (
          <li key={place.id}>
            <button
              type="button"
              className="dv-row"
              ref={index === 0 ? firstRowRef : undefined}
              data-row-index={index}
              onClick={() => onSelect(place.id)}
              onKeyDown={onRowKeyDown ? (event) => onRowKeyDown(event, index) : undefined}
            >
              <span className={`dv-row-badge dv-row-badge--${place.status}`} aria-hidden="true">
                <CategoryIcon slug={place.category} />
              </span>
              <span className="dv-row-text">
                <span className="dv-row-name">{place.name}</span>
                <span className="dv-row-meta">
                  {category && <span>{category}</span>}
                  {category && <span aria-hidden="true"> · </span>}
                  <span className="dv-row-status">
                    <span
                      className="dv-dot"
                      style={{ backgroundColor: STATUS_META[place.status].color }}
                      aria-hidden="true"
                    />
                    {status}
                  </span>
                </span>
                {detail && <span className="dv-row-detail">{detail}</span>}
              </span>
              <ChevronRight className="dv-row-chevron" size={18} aria-hidden />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/** Arrow keys walk the rows; ArrowUp on the first row goes back to `onExitTop`. */
function useRowKeys(listRef: RefObject<HTMLElement | null>, onExitTop?: () => void) {
  return (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const next = index + (event.key === 'ArrowDown' ? 1 : -1);
    if (next < 0) {
      onExitTop?.();
      return;
    }
    listRef.current?.querySelector<HTMLButtonElement>(`[data-row-index="${next}"]`)?.focus();
  };
}

interface PlaceListSheetProps {
  open: boolean;
  places: PublicPlace[];
  onSelect: (placeId: string) => void;
  onClose: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

/** Bottom sheet with every place of the visible area, nearest to the map centre first. */
export function PlaceListSheet({ open, places, onSelect, onClose, returnFocusRef }: PlaceListSheetProps) {
  const sheetRef = useRef<HTMLElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const onRowKeyDown = useRowKeys(sheetRef, () => closeRef.current?.focus());

  useEffect(() => {
    if (!open || !sheetRef.current) return;
    return trapFocus(sheetRef.current, {
      initialFocus: closeRef.current,
      onEscape: () => {
        onClose();
        returnFocusRef?.current?.focus();
      },
    });
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  const handleClose = () => {
    onClose();
    returnFocusRef?.current?.focus();
  };

  return (
    <div className="dv-sheet-scrim" onClick={handleClose}>
      <section
        ref={sheetRef}
        className="dv-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dv-list-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="dv-sheet-grabber" aria-hidden="true" />
        <header className="dv-sheet-header">
          <div>
            <h2 id="dv-list-title" className="dv-sheet-title">
              Места на карте
            </h2>
            <p className="dv-sheet-sub">
              {places.length} {placesWord(places.length)} в этой области
            </p>
          </div>
          <button
            ref={closeRef}
            type="button"
            className="dv-icon-btn"
            aria-label="Закрыть список"
            onClick={handleClose}
          >
            <X size={20} aria-hidden />
          </button>
        </header>
        <div className="dv-sheet-body">
          <PlaceRows
            places={places}
            onSelect={onSelect}
            listLabel="Места в видимой области"
            onRowKeyDown={onRowKeyDown}
          />
        </div>
      </section>
    </div>
  );
}

interface SearchResultsProps {
  id: string;
  query: string;
  places: PublicPlace[];
  onSelect: (placeId: string) => void;
  firstRowRef: RefObject<HTMLButtonElement | null>;
  onBackToInput: () => void;
  onClose: () => void;
  /** Present when a category or status filter narrows the search. */
  onResetFilters?: () => void;
}

/** Search matches right under the search bar, over the map. */
export function SearchResults({
  id,
  query,
  places,
  onSelect,
  firstRowRef,
  onBackToInput,
  onClose,
  onResetFilters,
}: SearchResultsProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const onRowKeyDown = useRowKeys(panelRef, onBackToInput);

  return (
    <div
      ref={panelRef}
      id={id}
      className="dv-search-panel"
      role="region"
      aria-label="Результаты поиска"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      }}
    >
      {places.length === 0 ? (
        <div className="dv-search-empty" role="status">
          <SearchX size={22} aria-hidden />
          <div className="dv-search-empty-text">
            <p className="dv-search-empty-title">Ничего не найдено</p>
            <p className="dv-search-empty-sub">По запросу «{query.trim()}»{onResetFilters ? ' с фильтром' : ''}</p>
          </div>
          {onResetFilters && (
            <button type="button" className="dv-btn dv-btn--small" onClick={onResetFilters}>
              Искать везде
            </button>
          )}
        </div>
      ) : (
        <>
          <p className="dv-search-count" role="status">
            {places.length} {placesWord(places.length)}
          </p>
          <PlaceRows
            places={places}
            onSelect={onSelect}
            listLabel="Найденные места"
            firstRowRef={firstRowRef}
            onRowKeyDown={onRowKeyDown}
          />
        </>
      )}
    </div>
  );
}
