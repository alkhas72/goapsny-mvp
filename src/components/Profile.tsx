import type { Profile as ProfileType } from "../types";
import { telegram } from "../utils/telegram";
import { Award, Heart, History, Moon, Sun, ToggleLeft, ToggleRight } from "lucide-react";
import { karmaNext } from "/Users/alkhas.abaza/Documents/03-IDLAB/goapsny-shared/index";

interface ProfileProps {
  profile: ProfileType;
  theme: "dark" | "light";
  onChangeTheme: (theme: "dark" | "light") => void;
}

export function Profile({ profile, theme, onChangeTheme }: ProfileProps) {
  const status = profile.karmaStatus || "Пешеход";
  const { next } = karmaNext(profile.karma);
  const nextLimit = next ? next.threshold : 99999;

  // Define points required for current level start
  const getPrevLimit = (statusName: string) => {
    const limits: Record<string, number> = {
      "Пешеход": 0,
      "Исследователь": 30,
      "Картограф": 100,
      "Проводник": 250,
      "Знаток города": 500,
      "Хранитель доступности": 1000,
      "Легенда GoApsny": 1800
    };
    return limits[statusName] || 0;
  };

  const prevLimit = getPrevLimit(status);
  const nextDiff = nextLimit - prevLimit;
  const currentDiff = profile.karma - prevLimit;
  
  // Percent of current level completion
  const progressPercent = nextLimit === 99999 ? 100 : Math.min(100, Math.max(0, (currentDiff / nextDiff) * 100));
  const pointsToNext = nextLimit === 99999 ? 0 : nextLimit - profile.karma;

  const handleToggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    onChangeTheme(nextTheme);
    telegram.hapticSelection();
  };

  return (
    <div className="profile-container">
      {/* Profile Card */}
      <div className="profile-card">
        <div className="profile-avatar-wrap">
          <Award size={28} />
        </div>
        <div className="profile-identity">
          <span className="profile-name">{profile.displayName || "Тестер GoApsny"}</span>
          <span className="profile-username">
            {profile.username ? `@${profile.username}` : "Пользователь Telegram"}
          </span>
        </div>
      </div>

      {/* Karma Status Card */}
      <div className="karma-meter-card">
        <div className="karma-meter-header">
          <span className="karma-title">Ваша карма</span>
          <span className="karma-status-badge">{status}</span>
        </div>
        <div>
          <span className="karma-points-span">{profile.karma}</span>
          <span style={{ fontSize: 13, color: "var(--text-secondary)", marginLeft: 6 }}>баллов</span>
        </div>

        {nextLimit !== 99999 && (
          <>
            <div className="karma-progress-wrap">
              <div className="karma-progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <span className="karma-next-status-hint">
              До следующего уровня осталось {pointsToNext} кармы
            </span>
          </>
        )}
      </div>

      {/* Contribution Stats */}
      <div className="stats-grid">
        <div className="stat-item">
          <span className="stat-val" style={{ color: "var(--accent)" }}>
            {Math.floor(profile.karma / 25)}
          </span>
          <span className="stat-lbl">Объекты</span>
        </div>
        <div className="stat-item">
          <span className="stat-val" style={{ color: "var(--status-green)" }}>
            {profile.karma > 100 ? 5 : 2}
          </span>
          <span className="stat-lbl">Аудиты</span>
        </div>
        <div className="stat-item">
          <span className="stat-val" style={{ color: "var(--status-yellow)" }}>
            #4
          </span>
          <span className="stat-lbl">В городе</span>
        </div>
      </div>

      {/* Settings / Controls */}
      <div className="detail-card" style={{ justifyContent: "space-between", padding: "12px 16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {theme === "dark" ? <Moon size={20} className="gps-icon" /> : <Sun size={20} className="gps-icon" />}
          <span style={{ fontSize: 14, fontWeight: 500 }}>Темная тема</span>
        </div>
        <button
          type="button"
          onClick={handleToggleTheme}
          style={{ background: "transparent", border: "none", color: "var(--accent)", cursor: "pointer", display: "grid", placeItems: "center" }}
        >
          {theme === "dark" ? <ToggleRight size={36} /> : <ToggleLeft size={36} style={{ color: "var(--text-secondary)" }} />}
        </button>
      </div>

      {/* Recent Contribution History Mock */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
        <h3 style={{ fontSize: 15, fontWeight: 700, margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: 8 }}>
          <History size={18} style={{ color: "var(--text-secondary)" }} />
          История вклада
        </h3>
        
        <div className="detail-card" style={{ gap: 10, padding: 12 }}>
          <div className="detail-card-icon" style={{ color: "var(--status-green)" }}>
            <Heart size={16} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Добавлен объект "Кафе у моря"</span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>Вчера · +25 кармы</span>
          </div>
        </div>

        <div className="detail-card" style={{ gap: 10, padding: 12 }}>
          <div className="detail-card-icon" style={{ color: "var(--status-green)" }}>
            <Heart size={16} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Добавлен объект "Абхазская государственная филармония"</span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>30 мая · +25 кармы</span>
          </div>
        </div>
      </div>
    </div>
  );
}
