import { useEffect, useRef, type RefObject } from 'react';
import { Check, X } from 'lucide-react';
import { CATEGORIES, STATUS_META } from '../shared/index';
import type { PlaceFilters, StatusFilter } from '../services/places';
import { trapFocus } from '../utils/focusTrap';
import { CategoryIcon } from './PlaceList';
import { STATUS_ORDER, STATUS_WORD, placesWord } from './PlaceListModel';
import './discovery.css';

interface MapFiltersProps {
  open: boolean;
  filters: PlaceFilters;
  onChange: (next: PlaceFilters) => void;
  onClose: () => void;
  onApplyStatus: (status: StatusFilter) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
  /** Places per category in the visible area (status and search applied). */
  categoryCounts?: Record<string, number>;
  /** Places the current filter leaves in the visible area. */
  resultCount?: number;
}

export function MapFilters({
  open,
  filters,
  onChange,
  onClose,
  onApplyStatus,
  returnFocusRef,
  categoryCounts,
  resultCount,
}: MapFiltersProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    return trapFocus(panelRef.current, {
      initialFocus: closeButtonRef.current,
      onEscape: () => {
        onClose();
        returnFocusRef?.current?.focus();
      },
    });
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  const toggleCategory = (slug: string) => {
    const selected = filters.categories.includes(slug)
      ? filters.categories.filter((item) => item !== slug)
      : [...filters.categories, slug];
    onChange({ ...filters, categories: selected });
  };

  const handleClose = () => {
    onClose();
    returnFocusRef?.current?.focus();
  };

  const hasSelection = filters.categories.length > 0 || filters.status !== 'all';

  return (
    <div className="dv-sheet-scrim" onClick={handleClose}>
      <section
        ref={panelRef}
        className="dv-sheet dv-filter"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dv-filter-title"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="dv-sheet-grabber" aria-hidden="true" />
        <header className="dv-sheet-header">
          <h2 id="dv-filter-title" className="dv-sheet-title">
            Фильтр
          </h2>
          <button
            ref={closeButtonRef}
            type="button"
            className="dv-icon-btn"
            aria-label="Закрыть фильтр"
            onClick={handleClose}
          >
            <X size={20} aria-hidden />
          </button>
        </header>

        <div className="dv-sheet-body dv-filter-body">
          <h3 className="dv-filter-label" id="dv-filter-categories">
            Категории
          </h3>
          <div className="dv-cat-grid" role="group" aria-labelledby="dv-filter-categories">
            {CATEGORIES.map((category) => {
              const active = filters.categories.includes(category.slug);
              const count = categoryCounts?.[category.slug];
              return (
                <button
                  key={category.slug}
                  type="button"
                  className={`dv-cat${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => toggleCategory(category.slug)}
                >
                  <span className="dv-cat-icon" aria-hidden="true">
                    {active ? <Check size={18} strokeWidth={2.5} aria-hidden /> : <CategoryIcon slug={category.slug} />}
                  </span>
                  <span className="dv-cat-name">{category.ru}</span>
                  {count !== undefined && <span className="dv-cat-count">{count}</span>}
                </button>
              );
            })}
          </div>

          <h3 className="dv-filter-label" id="dv-filter-status">
            Доступность
          </h3>
          <div className="dv-status-list" role="group" aria-labelledby="dv-filter-status">
            {(['all', ...STATUS_ORDER] as StatusFilter[]).map((value) => {
              const active = filters.status === value;
              return (
                <button
                  key={value}
                  type="button"
                  className={`dv-status-option${active ? ' is-active' : ''}`}
                  aria-pressed={active}
                  onClick={() => onApplyStatus(value)}
                >
                  {value === 'all' ? (
                    <span className="dv-dot dv-dot--all" aria-hidden="true" />
                  ) : (
                    <span className="dv-dot" style={{ backgroundColor: STATUS_META[value].color }} aria-hidden="true" />
                  )}
                  <span>{value === 'all' ? 'Все' : STATUS_WORD[value]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <footer className="dv-sheet-footer">
          <button
            type="button"
            className="dv-btn dv-btn--ghost"
            disabled={!hasSelection}
            onClick={() => onChange({ ...filters, categories: [], status: 'all' })}
          >
            Сбросить
          </button>
          <button type="button" className="dv-btn dv-btn--primary" onClick={handleClose}>
            {resultCount === undefined ? 'Готово' : `Показать ${resultCount} ${placesWord(resultCount)}`}
          </button>
        </footer>
      </section>
    </div>
  );
}
