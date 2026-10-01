import { STATUS_META } from '../shared/index';

const LEGEND_ITEMS = [
  { key: 'green', color: STATUS_META.green.color, label: STATUS_META.green.ru },
  { key: 'yellow', color: STATUS_META.yellow.color, label: 'Частично доступно' },
  { key: 'red', color: STATUS_META.red.color, label: STATUS_META.red.ru },
] as const;

interface WelcomeLegendProps {
  onContinue: () => void;
}

export function WelcomeLegend({ onContinue }: WelcomeLegendProps) {
  return (
    <div className="welcome-screen" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <p id="welcome-title" className="welcome-kicker">
        Добро пожаловать в GoApsny
      </p>
      <ul className="welcome-legend-list">
        {LEGEND_ITEMS.map((item) => (
          <li key={item.key} className="welcome-legend-item">
            <span
              className="welcome-legend-dot"
              style={{ backgroundColor: item.color }}
              aria-hidden="true"
            />
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
      <button type="button" className="primary-btn welcome-continue-btn" onClick={onContinue}>
        ОК, поехали!
      </button>
    </div>
  );
}
