import { Menu, Search } from 'lucide-react';
import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { BrandMark } from './BrandMark';

interface MapHeaderProps {
  onOpenMenu: () => void;
  onOpenFilters: () => void;
  /** Поиск или фильтр что-то отбирают: на кнопке с лупой горит точка. */
  filterActive: boolean;
  menuOpen: boolean;
  menuButtonRef: RefObject<HTMLButtonElement | null>;
  filterButtonRef: RefObject<HTMLButtonElement | null>;
}

export function MapHeader({
  onOpenMenu,
  onOpenFilters,
  filterActive,
  menuOpen,
  menuButtonRef,
  filterButtonRef,
}: MapHeaderProps) {
  const logoRef = useRef<HTMLDivElement | null>(null);
  const titleRef = useRef<HTMLSpanElement | null>(null);

  // Знак в шапке должен стоять ровно в границах надписи: от верха букв до низа
  // «p» и «y». Эти границы зависят от шрифта устройства, поэтому меряем их на
  // месте и отдаём стилям двумя переменными.
  useLayoutEffect(() => {
    const logo = logoRef.current;
    const title = titleRef.current;
    if (!logo || !title) return;
    const measure = () => {
      try {
        const cs = getComputedStyle(title);
        const ctx = document.createElement('canvas').getContext('2d');
        if (!ctx) return;
        ctx.font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        const m = ctx.measureText(title.textContent ?? '');
        if (!(m.actualBoundingBoxAscent > 0)) return;
        logo.style.setProperty('--title-ink-asc', `${m.actualBoundingBoxAscent}px`);
        logo.style.setProperty('--title-ink-desc', `${Math.max(m.actualBoundingBoxDescent, 0)}px`);
      } catch {
        // Без замера остаются запасные значения из стилей.
      }
    };
    measure();
    void document.fonts?.ready.then(measure);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(title);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="public-map-header">
      <div className="public-top-rail">
        <div ref={logoRef} className="logo-container" aria-label="GoApsny">
          <div style={{ width: 24, height: 24, color: 'var(--accent)' }}>
            <BrandMark className="logo-svg" />
          </div>
          <span ref={titleRef} className="app-title">GoApsny</span>
        </div>
        {/* Поиск свёрнут в кнопку рядом с меню (слово Алхаса 25.11): строка поиска
            открывается по нажатию и не занимает экран карты. */}
        <button
          ref={filterButtonRef}
          type="button"
          className={`icon-btn public-search-btn${filterActive ? ' is-active' : ''}`}
          onClick={onOpenFilters}
          aria-label="Поиск и фильтр"
          aria-haspopup="dialog"
        >
          <Search size={20} aria-hidden="true" />
          {filterActive && <span className="public-search-dot" aria-hidden="true" />}
        </button>
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
    </header>
  );
}
