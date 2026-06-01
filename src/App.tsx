import { useState, useEffect } from "react";
import type { Place, Profile, Tab, AccessibilityStatus } from "./types";
import { telegram } from "./utils/telegram";
import { api, categoriesList } from "./services/api";
import { LeafletMap } from "./components/LeafletMap";
import { AddWizard } from "./components/AddWizard";
import { Profile as ProfileView } from "./components/Profile";
import { AdminPanel } from "./components/AdminPanel";
import { Map, Plus, User, ShieldAlert, Compass, Moon, Sun } from "lucide-react";

// Official Accessible Icon Project SVG Component
function AccessibleIconLogo() {
  return (
    <svg viewBox="0 0 100 100" className="logo-svg" style={{ stroke: "none", fill: "currentColor" }}>
      {/* Head leaning forward */}
      <circle cx="63" cy="21" r="9.5" />
      {/* Arm reaching back */}
      <path d="M 43,45 C 50,45 53,35 60,35" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* Wheel circle */}
      <path d="M 42,76 A 23,23 0 1,0 60,35 L 53,49" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* Body leaning forward */}
      <path d="M 33,52 L 53,49 L 68,69" stroke="currentColor" strokeWidth="8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Right-Triangle Ramp Icon (Complies with request: Triangle-kлин instead of wheelchair)
function TriangleRampIcon() {
  return (
    <svg viewBox="0 0 24 24" style={{ width: "100%", height: "100%" }}>
      <path d="M3 20h18V8L3 20z" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export function App() {
  const [activeTab, setActiveTab] = useState<Tab>("map");
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [filter, setFilter] = useState<AccessibilityStatus | "all">("all");
  const [loading, setLoading] = useState(true);
  
  // Geolocation Primer Splash State
  const [showPrimer, setShowPrimer] = useState(() => {
    return !localStorage.getItem("goapsny_gps_primed");
  });

  // 1. Initial Authentication & Load Data
  useEffect(() => {
    const initApp = async () => {
      try {
        // Sync Initial Telegram Theme
        const tgTheme = telegram.getTelegramTheme();
        setTheme(tgTheme);
        document.documentElement.className = tgTheme;

        // Login using Telegram initialization data
        const initData = telegram.getInitData();
        const authData = await api.loginTelegram(initData);
        setProfile(authData.profile);

        // Fetch POIs
        const fetchedPlaces = await api.getPlaces();
        setPlaces(fetchedPlaces);

        telegram.ready();
        telegram.expand();
      } catch (e) {
        console.error("Initialization failed", e);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

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

  const handleCreatePlace = (newPlace: Place) => {
    setPlaces(prev => [newPlace, ...prev]);
    
    // Refresh user profile local state for points sync
    if (profile) {
      const karmaBonus = 25 + (newPlace.comment ? 10 : 0);
      setProfile({
        ...profile,
        karma: profile.karma + karmaBonus
      });
    }
    
    setActiveTab("map");
    setSelectedPlaceId(newPlace.id);
  };

  const handleDeletePlace = (id: string) => {
    setPlaces(prev => prev.filter(p => p.id !== id));
    if (selectedPlaceId === id) {
      setSelectedPlaceId(null);
    }
  };

  const handleUpdateStatus = (id: string, newStatus: AccessibilityStatus) => {
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
            <AccessibleIconLogo />
          </div>
          <div>Загрузка GoApsny...</div>
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
            <AccessibleIconLogo />
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
            <AccessibleIconLogo />
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
      <main className="screen-content">
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
                    {selectedPlace.status === "green" ? "Доступно" : selectedPlace.status === "yellow" ? "Частично" : "Недоступно"}
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
                         selectedPlace.rampType === "portable_available" ? "Приставной" : "По запросу"}
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
