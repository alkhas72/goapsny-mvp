import { useEffect, useState } from "react";
import type { Place, AccessibilityStatus } from "../types";
import { api, categoriesList, type PendingPlace } from "../services/api";
import { Trash2, Edit2, ShieldAlert, Calendar, User } from "lucide-react";
import { telegram } from "../utils/telegram";

interface AdminPanelProps {
  places: Place[];
  onDeletePlace: (id: string) => Promise<void>;
  onUpdateStatus: (id: string, status: AccessibilityStatus) => Promise<void>;
  canModerate: boolean;
  onReviewPublicPlace: (id: string, decision: "published" | "hidden") => Promise<void>;
}

const SOURCE_LABELS: Record<Place["source"], string> = {
  operator: "Оператор",
  public: "Публичная заявка",
  import: "Импорт",
  ai_seed: "AI-импорт"
};

export function AdminPanel({ places, onDeletePlace, onUpdateStatus, canModerate, onReviewPublicPlace }: AdminPanelProps) {
  const [filterStatus, setFilterStatus] = useState<AccessibilityStatus | "all">("all");
  const [editingPlaceId, setEditingPlaceId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPlace[]>([]);
  const [pendingError, setPendingError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    if (!canModerate) return;
    let active = true;
    api.getPendingPublicPlaces().then(items => {
      if (active) setPending(items);
    }).catch(error => {
      if (active) setPendingError(error instanceof Error ? error.message : "Не удалось загрузить заявки");
    });
    return () => { active = false; };
  }, [canModerate]);

  const review = async (id: string, decision: "published" | "hidden") => {
    const confirmed = await telegram.confirm(decision === "published"
      ? "Опубликовать заявку на карте?"
      : "Скрыть заявку без публикации?");
    if (!confirmed) return;
    setReviewingId(id);
    setPendingError(null);
    try {
      await onReviewPublicPlace(id, decision);
      setPending(items => items.filter(item => item.id !== id));
      telegram.hapticNotify("success");
    } catch (error) {
      setPendingError(error instanceof Error ? error.message : "Не удалось обработать заявку");
    } finally {
      setReviewingId(null);
    }
  };


  const filteredPlaces = places.filter(
    p => filterStatus === "all" || p.status === filterStatus
  );

  const getCategoryName = (slug: string) => {
    const cat = categoriesList.find(c => c.slug === slug);
    return cat ? `${cat.icon} ${cat.name}` : `📍 Другое`;
  };

  const handleDelete = (id: string, name: string) => {
    void (async () => {
      const confirmed = await telegram.confirm(`Вы уверены, что хотите удалить объект "${name}"?`);
      if (!confirmed) return;
      try {
        await onDeletePlace(id);
        telegram.hapticNotify("warning");
      } catch (e) {
        telegram.alert(e instanceof Error ? e.message : "Не удалось удалить объект.");
      }
    })();
  };

  const handleEditStatus = (id: string) => {
    setEditingPlaceId(editingPlaceId === id ? null : id);
    telegram.hapticSelection();
  };

  const handleSelectNewStatus = (id: string, newStatus: AccessibilityStatus) => {
    void (async () => {
      try {
        await onUpdateStatus(id, newStatus);
        setEditingPlaceId(null);
        telegram.hapticNotify("success");
      } catch (e) {
        telegram.alert(e instanceof Error ? e.message : "Не удалось изменить статус.");
      }
    })();
  };

  return (
    <div className="admin-container">
      <h2 className="wizard-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ShieldAlert className="gps-icon" style={{ color: "var(--status-yellow)" }} />
        Админ-панель
      </h2>
      <p className="wizard-sub">Оперативное управление картой: редактирование статусов и удаление точек.</p>

      {canModerate && (
        <section aria-label="Заявки на проверке" className="admin-list">
          <h3>Заявки на проверке ({pending.length})</h3>
          {pendingError && <p role="alert">{pendingError}</p>}
          {pending.length === 0 && !pendingError && <p>Заявок на проверке нет.</p>}
          {pending.map(item => (
            <article key={item.id} className="admin-item-card" style={{ display: "grid", gap: 10 }}>
              <strong>{item.name}</strong>
              <span>{getCategoryName(item.category)} · {new Date(item.createdAt).toLocaleDateString("ru-RU")}</span>
              <span>Координаты: {item.lat.toFixed(5)}, {item.lng.toFixed(5)}</span>
              {item.photoUrl ? <img src={item.photoUrl} alt={`Фасад: ${item.name}`} style={{ width: "100%", maxHeight: 240, objectFit: "cover", borderRadius: 8 }} /> : <span>Фото недоступно</span>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" className="primary-btn" disabled={reviewingId !== null} onClick={() => void review(item.id, "published")}>Опубликовать</button>
                <button type="button" className="secondary-btn" disabled={reviewingId !== null} onClick={() => void review(item.id, "hidden")}>Скрыть</button>
              </div>
            </article>
          ))}
        </section>
      )}

      {/* Filter Chips */}
      <div className="map-filter-chips" style={{ pointerEvents: "auto", margin: "4px 0" }}>
        <button
          type="button"
          className={`filter-chip ${filterStatus === "all" ? "active" : ""}`}
          onClick={() => setFilterStatus("all")}
        >
          Все ({places.length})
        </button>
        {(["green", "yellow", "red"] as const).map(st => {
          const count = places.filter(p => p.status === st).length;
          return (
            <button
              key={st}
              type="button"
              className={`filter-chip ${filterStatus === st ? "active" : ""}`}
              onClick={() => setFilterStatus(st)}
            >
              <div className={`chip-dot ${st}`} />
              {st === "green" ? "Доступно" : st === "yellow" ? "Частично" : "Недоступно"} ({count})
            </button>
          );
        })}
      </div>

      {/* Listing */}
      <div className="admin-list">
        {filteredPlaces.length === 0 ? (
          <div style={{ textAlign: "center", padding: "30px 16px", color: "var(--text-secondary)", fontSize: 14 }}>
            Объектов в данной категории не найдено.
          </div>
        ) : (
          filteredPlaces.map(place => (
            <div key={place.id} style={{ display: "flex", flexDirection: "column", gap: 8 }} className="admin-item-card">
              <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div className="admin-item-left">
                  <div className={`admin-status-dot ${place.status}`} />
                  <div className="admin-item-info">
                    <span className="admin-item-name">{place.name}</span>
                    <span className="admin-item-sub">{getCategoryName(place.category)}</span>
                  </div>
                </div>

                <div className="admin-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 36, height: 36 }}
                    onClick={() => handleEditStatus(place.id)}
                    title="Изменить статус"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    style={{ width: 36, height: 36, color: "var(--status-red)" }}
                    onClick={() => handleDelete(place.id, place.name)}
                    title="Удалить"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Status editing drawer (inline accordion) */}
              {editingPlaceId === place.id && (
                <div style={{ 
                  display: "flex", 
                  gap: 8, 
                  backgroundColor: "var(--bg-color)", 
                  padding: 8, 
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  marginTop: 4,
                  width: "100%"
                }}>
                  <span style={{ fontSize: 12, fontWeight: 600, alignSelf: "center", marginRight: "auto", paddingLeft: 4 }}>
                    Сменить статус:
                  </span>
                  <button
                    type="button"
                    className="filter-chip"
                    style={{ border: "1px solid var(--status-green)", color: "var(--status-green)", padding: "4px 8px" }}
                    onClick={() => handleSelectNewStatus(place.id, "green")}
                  >
                    Доступно
                  </button>
                  <button
                    type="button"
                    className="filter-chip"
                    style={{ border: "1px solid var(--status-yellow)", color: "var(--status-yellow)", padding: "4px 8px" }}
                    onClick={() => handleSelectNewStatus(place.id, "yellow")}
                  >
                    Частично
                  </button>
                  <button
                    type="button"
                    className="filter-chip"
                    style={{ border: "1px solid var(--status-red)", color: "var(--status-red)", padding: "4px 8px" }}
                    onClick={() => handleSelectNewStatus(place.id, "red")}
                  >
                    Недост.
                  </button>
                </div>
              )}

              <div style={{ display: "flex", gap: 12, fontSize: 11, color: "var(--text-secondary)", borderTop: "1px solid var(--border-color)", paddingTop: 6, width: "100%" }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <User size={12} /> {SOURCE_LABELS[place.source] ?? place.source}
                </span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <Calendar size={12} /> {new Date(place.createdAt).toLocaleDateString("ru-RU")}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
