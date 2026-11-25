import { useEffect, useRef, type RefObject } from 'react';
import { X } from 'lucide-react';
import { CATEGORIES, STATUS_META, placeTypesOf } from '../shared/index';
import type { AccessibilityStatus } from '../shared/index';
import type { PlaceFilters, StatusFilter } from '../services/places';
import { trapFocus } from '../utils/focusTrap';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'green', label: STATUS_META.green.ru },
  { value: 'yellow', label: 'Частично' },
  { value: 'red', label: STATUS_META.red.ru },
  { value: 'gray', label: STATUS_META.gray.ru },
];

interface MapFiltersProps {
  open: boolean;
  filters: PlaceFilters;
  onChange: (next: PlaceFilters) => void;
  onClose: () => void;
  onApplyStatus: (status: StatusFilter) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
}

export function MapFilters({
  open,
  filters,
  onChange,
  onClose,
  onApplyStatus,
  returnFocusRef,
}: MapFiltersProps) {
  const panelRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    return trapFocus(panelRef.current, {
      // Открыли лупой: строка поиска сразу готова к вводу.
      initialFocus: searchRef.current ?? closeButtonRef.current,
      onEscape: () => {
        onClose();
        returnFocusRef?.current?.focus();
      },
    });
  }, [open, onClose, returnFocusRef]);

  if (!open) return null;

  // Типы показываем, когда выбрана ровно одна группа: «Здоровье» раскрывается
  // в аптеку, поликлинику, больницу. Смена набора групп сбрасывает типы.
  const openGroup =
    filters.categories.length === 1 ? CATEGORIES.find((item) => item.slug === filters.categories[0]) : undefined;
  const groupTypes = openGroup ? placeTypesOf(openGroup.slug) : [];
  const selectedTypes = filters.types ?? [];

  const toggleCategory = (slug: string) => {
    const selected = filters.categories.includes(slug)
      ? filters.categories.filter((item) => item !== slug)
      : [...filters.categories, slug];
    onChange({ ...filters, categories: selected, types: [] });
  };

  const toggleType = (slug: string) => {
    const next = selectedTypes.includes(slug)
      ? selectedTypes.filter((item) => item !== slug)
      : [...selectedTypes, slug];
    onChange({ ...filters, types: next });
  };

  const handleClose = () => {
    onClose();
    returnFocusRef?.current?.focus();
  };

  return (
    <div className="overlay-scrim" onClick={handleClose}>
      <section
        ref={panelRef}
        className="filter-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Поиск и фильтр"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="filter-panel-header">
          <span>Поиск и фильтр</span>
          <button
            ref={closeButtonRef}
            type="button"
            className="icon-btn"
            aria-label="Закрыть фильтр"
            onClick={handleClose}
          >
            <X size={20} />
          </button>
        </div>

        <label className="visually-hidden" htmlFor="filter-search">
          Поиск по улице или названию
        </label>
        <input
          id="filter-search"
          ref={searchRef}
          type="search"
          enterKeyHint="search"
          className="filter-search-input"
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          placeholder="Улица или название…"
          autoComplete="off"
        />

        <div className="filter-category-grid" role="group" aria-label="Категории">
          {CATEGORIES.map((category) => {
            const active = filters.categories.includes(category.slug);
            return (
              <button
                key={category.slug}
                type="button"
                className={`filter-category-chip${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() => toggleCategory(category.slug)}
              >
                {category.ru}
                {active ? ' ✓' : ''}
              </button>
            );
          })}
        </div>

        {openGroup && groupTypes.length > 0 && (
          <div className="filter-types" role="group" aria-label={`${openGroup.ru}: что именно`}>
            <span className="filter-types-title">{openGroup.ru}: что именно</span>
            <div className="filter-types-row">
              <button
                type="button"
                className={`filter-type-chip${selectedTypes.length === 0 ? ' active' : ''}`}
                aria-pressed={selectedTypes.length === 0}
                onClick={() => onChange({ ...filters, types: [] })}
              >
                Все
              </button>
              {groupTypes.map((type) => {
                const active = selectedTypes.includes(type.slug);
                return (
                  <button
                    key={type.slug}
                    type="button"
                    className={`filter-type-chip${active ? ' active' : ''}`}
                    aria-pressed={active}
                    onClick={() => toggleType(type.slug)}
                  >
                    {type.ru}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="filter-status-row" role="group" aria-label="Статус доступности">
          {STATUS_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`filter-status-chip${filters.status === option.value ? ' active' : ''}`}
              aria-pressed={filters.status === option.value}
              onClick={() => onApplyStatus(option.value)}
            >
              {option.value !== 'all' && (
                <span
                  className="filter-status-dot"
                  style={{ backgroundColor: STATUS_META[option.value as AccessibilityStatus]?.color ?? 'transparent' }}
                  aria-hidden="true"
                />
              )}
              {option.label}
            </button>
          ))}
        </div>
        <div className="filter-status-row filter-amenity-row" role="group" aria-label="Удобства">
          <button
            type="button"
            className={`filter-status-chip${filters.accessibleToilet ? ' active' : ''}`}
            aria-pressed={filters.accessibleToilet === true}
            onClick={() => onChange({ ...filters, accessibleToilet: !filters.accessibleToilet })}
          >
            Есть доступный туалет
          </button>
        </div>
      </section>
    </div>
  );
}
