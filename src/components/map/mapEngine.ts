export type MapEngine = 'leaflet' | 'maplibre';

type EnvLike = Record<string, string | undefined>;

export function resolveMapEngine(env: EnvLike = import.meta.env): MapEngine {
  const raw = env.VITE_MAP_ENGINE?.trim().toLowerCase();
  if (raw === 'maplibre') return 'maplibre';
  return 'leaflet';
}

export function isMapLibreEnabled(env: EnvLike = import.meta.env): boolean {
  return resolveMapEngine(env) === 'maplibre';
}
