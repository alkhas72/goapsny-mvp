import { useState, useEffect } from "react";
import type { Place, Profile, Tab, AccessibilityStatus } from "./types";
import { telegram } from "./utils/telegram";
import { api, categoriesList } from "./services/api";
import { STATUS_META } from "./shared/index";
import { LeafletMap } from "./components/LeafletMap";
import { AddWizard } from "./components/AddWizard";
import { Profile as ProfileView } from "./components/Profile";
import { AdminPanel } from "./components/AdminPanel";
import { Map, Plus, User, ShieldAlert, Compass, Moon, Sun, AlertCircle } from "lucide-react";
import { BrandMark } from "./components/BrandMark";

// Right-Triangle Ramp Icon (Complies with request: Triangle-kлин instead of wheelchair)
function TriangleRampIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: "100%", height: "100%" }}>
      <path d="M3 20h18V8L3 20z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function TelegramApp() {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(telegram.getTelegramTheme);
  const [filter, setFilter] = useState<AccessibilityStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  // Отказ входа/загрузки показываем честно (DG-3), с кнопкой повтора.
  const [initError, setInitError] = useState<string | null>(null);
  const [initAttempt, setInitAttempt] = useState(0);
  
  // Geolocation Primer Splash State
  const [showPrimer, setShowPrimer] = useState(() => {
    return !localStorage.getItem("goapsny_gps_primed");
  });

  // 1. Initial Authentication & Load Data
  useEffect(() => {
    const initApp = async () => {
      setLoading(true);
      setInitError(null);
      try {
        // Sync Initial Telegram Theme
        const tgTheme = telegram.getTelegramTheme();
        setTheme(tgTheme);
        document.documentElement.className = tgTheme;

        // Login using Telegram initialization data. Без моков: отказ
        // auth-telegram (плохая подпись, истёкший initData, сеть) — это
        // ошибка инициализации, а не тихий вход под локальным owner.
        const initData = telegram.getInitData();
        const authData = await api.loginTelegram(initData);
        setProfile(authData.profile);

        // Fetch POIs из общей базы (тот же published-набор, что видит сайт)
        const fetchedPlaces = await api.getPlaces();
        setPlaces(fetchedPlaces);

        telegram.ready();
        telegram.expand();
      } catch (e) {
        console.error("Initialization failed", e);
        setInitError(e instanceof Error ? e.message : "Не удалось запустить приложение");
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, [initAttempt]);

  // 2. React to Theme Change
  useEffect(() => {
    document.documentElement.className = theme;
  }, [theme]);

  const handleGrantGps = async () => {
    try {
      await telegram.getUserLocation();
      localStorage.setItem("goapsny_gps_primed", "true");
      setShowPrimer(false);
      telegram.hapticNotify("success");
    } catch (e) {
      console.warn(e);
      // Fallback but let the user proceed
      localStorage.setItem("goapsny_gps_primed", "true");
      setShowPrimer(false);
    }
  };

  const handleCreatePlace = async (newPlace: Place, freshProfile?: Profile) => {
    setPlaces(prev => [newPlace, ...prev]);
    
    // Карма и статус начисляются серверными триггерами; AddWizard уже
    // перечитал профиль после сохранения — просто применяем свежий.
    // Если свежего нет (перечитать не удалось), дочитываем здесь.
    if (freshProfile) {
      setProfile(freshProfile);
    } else if (profile) {
      try {
        setProfile(await api.getProfile());
      } catch (e) {
        console.error("Failed to sync profile after place creation", e);
      }
    }
    
    setActiveTab("map");
    setSelectedPlaceId(newPlace.id);
  };

  // Админ-действия идут на сервер; RLS сам решит, хватает ли прав.
  // Ошибка пробрасывается в AdminPanel и показывается пользователю.
  const handleDeletePlace = async (id: string) => {
    const name = places.find(p => p.id === id)?.name ?? "этот объект";
    const confirmed = await telegram.confirm(`Вы уверены, что хотите удалить объект "${name}"?`);
    if (!confirmed) return;
    await api.deletePlace(id);
    setPlaces(prev => prev.filter(p => p.id !== id));
    if (selectedPlaceId === id) {
      setSelectedPlaceId(null);
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: AccessibilityStatus) => {
    await api.updatePlaceStatus(id, newStatus);
    setPlaces(prev =>
      prev.map(p => (p.id === id ? { ...p, status: newStatus } : p))
    );
  };

  // Helper to find selected POI details
  const selectedPlace = selectedPlaceId ? places.find(p => p.id === selectedPlaceId) || null : null;
  const visiblePlaces = places.filter(p => filter === "all" || p.status === filter);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: "var(--bg-color)" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          <div style={{ width: 44, height: 44, color: "var(--accent)", margin: "0 auto 16px" }}>
            <BrandMark className="logo-svg" />
          </div>
          <div>Загрузка GoApsny...</div>
        </div>
      </div>
    );
  }

  if (initError) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", backgroundColor: "var(--bg-color)", padding: 24 }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          <div style={{ width: 44, height: 44, color: "var(--status-red)" }}>
            <AlertCircle size={44} />
          </div>
          <div style={{ fontWeight: 600, color: "var(--text-color)" }}>GoApsny не запустился</div>
          <div style={{ fontSize: 13 }}>{initError}</div>
          <button type="button" className="primary-btn" onClick={() => setInitAttempt(a => a + 1)}>
            Повторить
          </button>
        </div>
      </div>
    );
  }

  // Geolocation Onboarding primer screen
  if (showPrimer) {
    return (
      <div className="app-shell">
        <div className="splash-container">
          <div style={{ width: 72, height: 72, color: "var(--accent)" }}>
            <BrandMark className="logo-svg" />
          </div>
          <div>
            <h1 className="splash-title">GoApsny</h1>
            <span style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>
              Официальный слой доступности АИС
            </span>
          </div>
          
          <p className="splash-desc">
            Инструмент сбора карточек доступности Сухума. Чтобы точно отмечать барьеры на карте, приложению требуется доступ к геолокации вашего устройства.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%" }}>
            <button type="button" className="primary-btn" onClick={handleGrantGps}>
              <Compass size={18} />
              Разрешить доступ к GPS
            </button>
            <button 
              type="button" 
              className="secondary-btn" 
              onClick={() => {
                localStorage.setItem("goapsny_gps_primed", "true");
                setShowPrimer(false);
              }}
            >
              Продолжить без GPS (вручную)
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="logo-container">
          <div style={{ width: 24, height: 24, color: "var(--accent)" }}>
            <BrandMark className="logo-svg" />
          </div>
          <span className="app-title">GoApsny</span>
        </div>
        <div className="header-actions">
          <button 
            type="button" 
            className="icon-btn" 
            onClick={() => {
              const next = theme === "dark" ? "light" : "dark";
              setTheme(next);
              telegram.hapticSelection();
            }}
          >
            {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
          </button>
        </div>
      </header>

      {/* Screen Area */}
      <main className={`screen-content ${activeTab === "map" ? "map-tab" : ""}`}>
        {activeTab === "map" && (
          <div className="map-container">
            {/* Map Canvas */}
            <LeafletMap
              places={visiblePlaces}
              selectedPlaceId={selectedPlaceId}
              theme={theme}
              onSelectPlace={setSelectedPlaceId}
              onClearSelection={() => setSelectedPlaceId(null)}
            />

            {/* Overlays */}
            <div className="map-controls-overlay">
              {/* Filter Chips */}
              <div className="map-filter-chips">
                <button
                  type="button"
                  className={`filter-chip ${filter === "all" ? "active" : ""}`}
                  onClick={() => {
                    setFilter("all");
                    telegram.hapticSelection();
                  }}
                >
                  Все
                </button>
                <button
                  type="button"
                  className={`filter-chip ${filter === "green" ? "active" : ""}`}
                  onClick={() => {
                    setFilter("green");
                    telegram.hapticSelection();
                  }}
                >
                  <div className="chip-dot green" />
                  Доступно
                </button>
                <button
                  type="button"
                  className={`filter-chip ${filter === "yellow" ? "active" : ""}`}
                  onClick={() => {
                    setFilter("yellow");
                    telegram.hapticSelection();
                  }}
                >
                  <div className="chip-dot yellow" />
                  Частично
                </button>
                <button
                  type="button"
                  className={`filter-chip ${filter === "red" ? "active" : ""}`}
                  onClick={() => {
                    setFilter("red");
                    telegram.hapticSelection();
                  }}
                >
                  <div className="chip-dot red" />
                  Недоступно
                </button>
              </div>

              {/* Map Legend Overlay */}
              <div className="map-legend" style={{ pointerEvents: "auto", display: "flex", gap: 8, alignSelf: "flex-start", marginTop: -4 }}>
                <span className="legend-item" style={{ 
                  fontSize: 11, 
                  backgroundColor: "var(--bg-color)", 
                  border: "1px solid var(--border-color)", 
                  padding: "4px 10px", 
                  borderRadius: 99, 
                  display: "inline-flex", 
                  alignItems: "center", 
                  gap: 6, 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                  color: "var(--text-secondary)"
                }}>
                  <span style={{ 
                    width: 10, 
                    height: 10, 
                    borderRadius: "50%", 
                    backgroundColor: "#7A5AF8", 
                    border: "1.5px solid #FFFFFF", 
                    display: "inline-block" 
                  }}></span>
                  <span>пурпурный центр = приставной пандус</span>
                </span>
              </div>
            </div>

            {/* Premium POI Detail Bottom Sheet */}
            {selectedPlace && (
              <article className="bottom-sheet">
                <div style={{ width: 40, height: 4, backgroundColor: "var(--border-color)", borderRadius: 2, alignSelf: "center" }} />
                
                <div className="sheet-header">
                  <div>
                    <h3 className="sheet-title">{selectedPlace.name}</h3>
                    <div className="sheet-meta">
                      {categoriesList.find(c => c.slug === selectedPlace.category)?.icon}{" "}
                      {categoriesList.find(c => c.slug === selectedPlace.category)?.name}
                    </div>
                  </div>
                  <span className={`sheet-badge ${selectedPlace.status}`}>
                    {STATUS_META[selectedPlace.status]?.ru ?? selectedPlace.status}
                  </span>
                </div>

                {selectedPlace.mainPhoto && (
                  <img src={selectedPlace.mainPhoto} alt={selectedPlace.name} className="sheet-photo" />
                )}

                {/* Details grid */}
                <div className="details-grid">
                  <div className="detail-card">
                    <div className="detail-card-icon">
                      {/* Stairs Icon */}
                      <svg viewBox="0 0 24 24">
                        <path d="M19 19h-4v-4h-4v-4H7V7H3v12h16z" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </div>
                    <div className="detail-card-info">
                      <span className="detail-card-label">Вход</span>
                      <span className="detail-card-value">
                        {selectedPlace.stepsCount === 0 || selectedPlace.stepsCount === null ? "Без ступеней" : `${selectedPlace.stepsCount} ступ.`}
                      </span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-icon">
                      {/* Triangular Ramp icon instead of wheelchair icon */}
                      <TriangleRampIcon />
                    </div>
                    <div className="detail-card-info">
                      <span className="detail-card-label">Пандус</span>
                      <span className="detail-card-value">
                        {selectedPlace.rampType === "none" ? "Нет" : 
                         selectedPlace.rampType === "permanent" ? "Стационарный" : 
                         selectedPlace.rampType === "portable_available" ? "Приставной" :
                         selectedPlace.rampType === "lift" ? "Подъёмник" : "По запросу"}
                      </span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-icon">
                      {/* Width door */}
                      <svg viewBox="0 0 24 24">
                        <path d="M3 12h18M3 6h4M17 6h4M3 18h4M17 18h4" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </div>
                    <div className="detail-card-info">
                      <span className="detail-card-label">Проем двери</span>
                      <span className="detail-card-value">
                        {selectedPlace.doorWidthCm ? `${selectedPlace.doorWidthCm} см` : "Не указан"}
                      </span>
                    </div>
                  </div>

                  <div className="detail-card">
                    <div className="detail-card-icon">
                      {/* Toilet icon */}
                      <svg viewBox="0 0 24 24">
                        <circle cx="12" cy="7" r="4" stroke="currentColor" strokeWidth="2.2" fill="none" />
                        <path d="M5 22v-5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v5" stroke="currentColor" strokeWidth="2.2" fill="none" />
                      </svg>
                    </div>
                    <div className="detail-card-info">
                      <span className="detail-card-label">Туалет</span>
                      <span className="detail-card-value">
                        {selectedPlace.toiletExists === "no" ? "Нет туалета" : 
                         selectedPlace.toiletAccessible === "yes" ? "Доступен" : 
                         selectedPlace.toiletAccessible === "partial" ? "Частично" : "Недоступен / ?"}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedPlace.comment && (
                  <div className="sheet-comment">
                    {selectedPlace.comment}
                  </div>
                )}
              </article>
            )}
          </div>
        )}

        {activeTab === "add" && profile && (
          <AddWizard
            profile={profile}
            theme={theme}
            onSave={handleCreatePlace}
            onCancel={() => setActiveTab("map")}
          />
        )}

        {activeTab === "profile" && profile && (
          <ProfileView
            profile={profile}
            theme={theme}
            onChangeTheme={t => {
              setTheme(t);
              telegram.hapticSelection();
            }}
          />
        )}

        {activeTab === "admin" && (
          <AdminPanel
            places={places}
            onDeletePlace={handleDeletePlace}
            onUpdateStatus={handleUpdateStatus}
          />
        )}
      </main>

      {/* Navigation tabs bar */}
      <nav className="bottom-nav">
        <button
          type="button"
          className={`nav-tab ${activeTab === "map" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("map");
            telegram.hapticSelection();
          }}
        >
          <Map size={20} />
          <span>Карта</span>
        </button>

        <button
          type="button"
          className={`nav-tab ${activeTab === "add" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("add");
            telegram.hapticSelection();
          }}
        >
          <Plus size={22} />
          <span>Добавить</span>
        </button>

        <button
          type="button"
          className={`nav-tab ${activeTab === "profile" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("profile");
            telegram.hapticSelection();
          }}
        >
          <User size={20} />
          <span>Профиль</span>
        </button>

        {profile && ["owner", "admin", "operator", "tester"].includes(profile.role) && (
          <button
            type="button"
            className={`nav-tab ${activeTab === "admin" ? "active" : ""}`}
            onClick={() => {
              setActiveTab("admin");
              telegram.hapticSelection();
            }}
          >
            <ShieldAlert size={20} />
            <span>Админ</span>
          </button>
        )}
      </nav>
    </div>
  );
}
