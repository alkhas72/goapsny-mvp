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
    <svg viewBox="0 0 451 451" className="logo-svg" style={{ stroke: "none", fill: "currentColor" }}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M299.817 44.264c7.569-5.321 17.729-8.346 28.609-6.4 7.479 1.338 13.424 4.58 18.258 9.035 7.214 6.649 11.979 15.999 12.233 27.292.499 22.133-16.917 39.711-40.654 38.208-11.318-.716-19.489-5.664-25.975-13.363-4.363-5.181-7.109-10.312-8.47-18.634-2.612-15.985 6.452-29.426 15.999-36.138zM109.34 217.991c14.626-13.856 32.161-24.429 55.148-29.175 1.534-.316 3.369-.188 4.706-.752 1.543-.652 4.108-4.602 5.082-5.646 17.673-18.982 34.038-38.667 51.196-57.972-10.198-6.364-20.875-12.252-31.433-18.257-12.37 10.319-23.871 21.479-36.326 32.374-5.657 4.948-15.165 10.418-25.41 6.211-8.557-3.513-15.057-12.045-14.304-23.527.628-9.595 8.002-14.739 14.116-20.328 12.522-11.449 25.411-23.192 38.396-34.445 4.452-3.856 8.609-8.4 15.435-9.976.802-.185 2.08.116 2.635-.941.288.916 2.936.206 4.894.377 5.782.504 10.736 4.083 15.434 6.776 23.316 13.362 47.015 27.078 70.582 40.467 4.574 2.599 9.273 5.373 13.929 8.282 4.675 2.924 9.979 4.966 14.116 8.093 8.295 6.271 12.083 20.271 7.34 31.057-2.927 6.659-8.819 11.796-13.552 17.316-10.895 12.71-22.68 25.843-33.879 38.773 23.524-.947 50.077-2.709 72.841-4.517 3.396.49 7.315-.235 11.482.564 11.157 2.143 19.149 11.679 17.88 25.598-3.065 33.617-5.544 69.509-8.282 105.027-.75 9.749-1.192 16.809-6.211 22.587-5.236 6.025-15.641 10.39-25.221 6.399-7.929-3.305-14.661-10.555-14.494-21.27.081-5.145.971-10.818 1.318-16.375 1.528-24.485 4.284-51.931 5.835-75.664-8.874.014-20.349 1.24-29.928 1.506 8.887 18.267 14.441 45.366 9.599 72.088-4.277 23.608-15.495 43.49-29.549 57.406-9.928-9.458-19.488-19.286-29.363-28.798 7.571-8.275 14.315-19.437 17.316-31.997 3.063-12.814 2.794-26.058-.94-38.773-10.455-30.812-34.41-52.358-73.406-53.077-9.432-.174-19.531 2.795-27.104 6.21-8.044 3.63-14.584 7.909-20.892 13.176-9.824-9.438-19.096-19.427-28.986-28.797zM229.987 362.92c7.847 6.831 15.138 14.572 22.587 22.021 2.449 2.45 5.354 4.478 7.153 7.341-19.905 15.379-47.352 26.005-80.747 23.904-12.206-.768-23.082-4.09-32.938-7.529-3.02-1.054-5.926-2.636-8.658-3.951-6.062-2.923-12.049-6.073-17.128-9.788-5.209-3.812-9.731-8.247-14.305-12.611-16.981-16.206-30.782-42.661-32.75-72.653-.955-14.557 1.035-31.216 5.458-44.23 4.511-13.272 10.954-24.095 18.446-34.445 7.558 6.623 14.521 14.112 21.834 21.27 2.5 2.447 5.179 4.847 7.34 7.529.987.967-.851 2.699-1.505 3.765-5.525 8.976-9.613 20.43-10.54 33.88-1.083 15.705 3.326 30.263 9.787 41.029 6.092 10.155 14.549 19.32 25.221 25.976 10.588 6.603 24.173 11.311 38.962 11.293 17.27-.022 30.648-5.655 41.783-12.801z"
      />
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
  const [theme, setTheme] = useState<"dark" | "light">(telegram.getTelegramTheme);
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

  const handleCreatePlace = async (newPlace: Place) => {
    setPlaces(prev => [newPlace, ...prev]);
    
    // Refresh user profile state by re-running loginTelegram to sync mock/server awards
    if (profile) {
      try {
        const initData = telegram.getInitData();
        const authData = await api.loginTelegram(initData);
        setProfile(authData.profile);
      } catch (e) {
        console.error("Failed to sync profile after place creation", e);
      }
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

                  <div className="detail-card">
                    <div className="detail-card-icon">
                      {/* Parking icon */}
                      <svg viewBox="0 0 24 24">
                        <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="2.2" fill="none" />
                        <path d="M9 17V7h3.5a2.5 2.5 0 0 1 0 5H9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </div>
                    <div className="detail-card-info">
                      <span className="detail-card-label">Парковка</span>
                      <span className="detail-card-value">
                        {selectedPlace.parking === "yes" ? "Есть" :
                         selectedPlace.parking === "no" ? "Нет" : "Не указана"}
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
