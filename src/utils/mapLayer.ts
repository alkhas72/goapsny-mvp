/**
 * Слой карты. Карта одна, слоёв два: «Карта доступности» (добавление мест)
 * и «Замеры» (замер входа и заявка на приставной пандус, мастер живёт в Stopgap).
 * Слой помнится в адресе (?layer=ramps), чтобы возврат из Stopgap попадал в него же.
 */
export type MapLayer = 'access' | 'ramps';

const PARAM = 'layer';

export function readMapLayer(search: string = window.location.search): MapLayer {
  return new URLSearchParams(search).get(PARAM) === 'ramps' ? 'ramps' : 'access';
}

export function writeMapLayer(layer: MapLayer): void {
  const url = new URL(window.location.href);
  if (layer === 'ramps') url.searchParams.set(PARAM, 'ramps');
  else url.searchParams.delete(PARAM);
  window.history.replaceState(window.history.state, '', url);
}
