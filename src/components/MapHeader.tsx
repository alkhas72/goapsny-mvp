import { Menu, Search } from 'lucide-react';
import type { RefObject } from 'react';
import { BrandMark } from './BrandMark';

interface MapHeaderProps {
  onOpenMenu: () => void;
  onOpenFilters: () => void;
  filterQuery: string;
  onFilterQueryChange: (value: string) => void;
  menuOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  filterButtonRef: RefObject<HTMLButtonElement | null>;
}

export function MapHeader({
  onOpenMenu,
  onOpenFilters,
  filterQuery,
  onFilterQueryChange,
  menuOpen,
  menuButtonRef,
  filterButtonRef,
}: MapHeaderProps) {
  return (
    <header className="public-map-header">
      <div className="public-top-rail">
        <div className="logo-container" aria-label="GoApsny">
          <div style={{ width: 24, height: 24, color: 'var(--accent)' }}>
            <BrandMark className="logo-svg" />
          </div>
          <span className="app-title">GoApsny</span>
        </div>
        <button
          ref={menuButtonRef}
          type="button"
          className="icon-btn"
          aria-label="Меню"
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          onClick={onOpenMenu}
        >
          <Menu size={20} />
        </button>
      </div>
      <div className="public-filter-rail">
        <button
          ref={filterButtonRef}
          type="button"
          className="public-search-trigger"
          onClick={onOpenFilters}
          aria-label="Поиск и фильтр"
          aria-haspopup="dialog"
        >
          <Search size={18} aria-hidden="true" />
          <span className="public-search-placeholder">
            {filterQuery || 'Улица или название…'}
          </span>
        </button>
        <label className="visually-hidden" htmlFor="public-search-input">
          Поиск по улице или названию
        </label>
        <input
          id="public-search-input"
          className="public-search-input"
          value={filterQuery}
          onChange={(event) => onFilterQueryChange(event.target.value)}
          onFocus={onOpenFilters}
          placeholder="Улица или название…"
          autoComplete="off"
        />
      </div>
    </header>
  );
}
