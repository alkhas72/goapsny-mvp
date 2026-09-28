/**
 * GoApsny basemap: own vector style over the Abkhazia PMTiles extract
 * (OpenStreetMap data, Protomaps v4 schema).
 *
 * The basemap is a quiet background for the accessibility pins: green,
 * yellow, red and the coral ramp dot must be the only saturated colours on
 * screen. So parks and woods are desaturated sage, POI icons are neutral,
 * and the palette follows the app themes — warm paper for the light
 * (orange) theme, deep navy for the dark (blue) theme.
 */
import { layers, namedFlavor, type Flavor } from '@protomaps/basemaps';
import type { StyleSpecification } from 'maplibre-gl';

export type BasemapTheme = 'light' | 'dark';

const SOURCE_ID = 'protomaps';

/** Default location of the Abkhazia extract; overridden per environment. */
const DEFAULT_PMTILES_URL = '/tiles/abkhazia.pmtiles';

const ASSETS = 'https://protomaps.github.io/basemaps-assets';

const LABEL_LANG = 'ru';

function neutralPois(color: string): NonNullable<Flavor['pois']> {
  return {
    blue: color,
    green: color,
    lapis: color,
    pink: color,
    red: color,
    slategray: color,
    tangerine: color,
    turquoise: color,
  };
}

const LIGHT: Flavor = {
  ...namedFlavor('light'),
  background: '#EDE5DC',
  earth: '#F5EFE8',
  park_a: '#E4E6D8',
  park_b: '#DDE1CF',
  wood_a: '#E1E4D4',
  wood_b: '#D9DECB',
  scrub_a: '#E6E7D9',
  scrub_b: '#DFE2D1',
  hospital: '#F3E6E1',
  industrial: '#EEE8E0',
  school: '#F1E9DC',
  pedestrian: '#F8F3ED',
  glacier: '#F7F5F2',
  sand: '#EFE6D3',
  beach: '#F1E7D2',
  aerodrome: '#ECE5DC',
  runway: '#E2D8CD',
  zoo: '#E4E6D8',
  military: '#EDE5DC',
  water: '#BDD8E8',
  pier: '#EDE5DC',
  buildings: '#E7DDD2',
  other: '#FFFFFF',
  minor_service: '#FFFFFF',
  minor_a: '#FFFFFF',
  minor_b: '#FFFFFF',
  link: '#FFFFFF',
  major: '#FFFFFF',
  highway: '#FFF4E8',
  minor_service_casing: '#E6DBD0',
  minor_casing: '#E2D6CA',
  link_casing: '#DDCFC2',
  major_casing_early: '#DDCFC2',
  major_casing_late: '#DDCFC2',
  highway_casing_early: '#E8C9A8',
  highway_casing_late: '#E8C9A8',
  railway: '#CDC1B5',
  boundaries: '#B5A393',
  roads_label_minor: '#9A8574',
  roads_label_minor_halo: '#FFFFFF',
  roads_label_major: '#86705F',
  roads_label_major_halo: '#FFFFFF',
  ocean_label: '#7FA6BD',
  subplace_label: '#8E7867',
  subplace_label_halo: '#F5EFE8',
  city_label: '#4A3B2F',
  city_label_halo: '#F5EFE8',
  state_label: '#A1897A',
  state_label_halo: '#F5EFE8',
  country_label: '#8E7867',
  address_label: '#A1897A',
  address_label_halo: '#F5EFE8',
  pois: neutralPois('#A1897A'),
};

const DARK: Flavor = {
  ...namedFlavor('dark'),
  background: '#0B141C',
  earth: '#101C27',
  park_a: '#14232A',
  park_b: '#152628',
  wood_a: '#142329',
  wood_b: '#152527',
  scrub_a: '#13212A',
  scrub_b: '#142328',
  hospital: '#1A1F2A',
  industrial: '#121E29',
  school: '#141F2A',
  pedestrian: '#15222E',
  glacier: '#1B2733',
  sand: '#1A2129',
  beach: '#1A2129',
  aerodrome: '#131F2A',
  runway: '#1E2C3A',
  zoo: '#14232A',
  military: '#101C27',
  water: '#0A2233',
  pier: '#15222E',
  buildings: '#172533',
  other: '#1C2B3A',
  minor_service: '#1C2B3A',
  minor_a: '#223344',
  minor_b: '#223344',
  link: '#2A3D50',
  major: '#2A3D50',
  highway: '#34506A',
  minor_service_casing: '#101C27',
  minor_casing: '#101C27',
  link_casing: '#101C27',
  major_casing_early: '#101C27',
  major_casing_late: '#101C27',
  highway_casing_early: '#101C27',
  highway_casing_late: '#101C27',
  railway: '#2A3B4B',
  boundaries: '#3E5569',
  roads_label_minor: '#6F869A',
  roads_label_minor_halo: '#101C27',
  roads_label_major: '#8FA3B5',
  roads_label_major_halo: '#101C27',
  ocean_label: '#4B7A99',
  subplace_label: '#7F95A8',
  subplace_label_halo: '#101C27',
  city_label: '#D5E0EA',
  city_label_halo: '#101C27',
  state_label: '#6F869A',
  state_label_halo: '#101C27',
  country_label: '#8FA3B5',
  address_label: '#6F869A',
  address_label_halo: '#101C27',
  pois: neutralPois('#6F869A'),
};

const FLAVORS: Record<BasemapTheme, Flavor> = { light: LIGHT, dark: DARK };

type Layer = StyleSpecification['layers'][number];

/**
 * POI sprite icons are full-colour (green parks, pink theatres) and would
 * compete with the status pins; keep POI names as quiet text only.
 */
function quietPois(layer: Layer): Layer {
  if (layer.id !== 'pois' || layer.type !== 'symbol') return layer;
  const layout = { ...layer.layout };
  delete layout['icon-image'];
  delete layout['text-variable-anchor'];
  layout['text-offset'] = [0, 0];
  layout['text-anchor'] = 'center';
  layout['text-justify'] = 'center';
  return { ...layer, layout };
}

export function getPmtilesUrl(): string {
  const override = import.meta.env.VITE_MAP_PMTILES_URL as string | undefined;
  const url = override || DEFAULT_PMTILES_URL;
  // The pmtiles protocol needs an absolute URL.
  if (/^https?:\/\//.test(url) || typeof window === 'undefined') return url;
  return new URL(url, window.location.origin).href;
}

export function buildGoApsnyStyle(theme: BasemapTheme): StyleSpecification {
  const sprite = theme === 'dark' ? 'dark' : 'light';
  return {
    version: 8,
    name: `GoApsny · ${theme}`,
    glyphs: `${ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${ASSETS}/sprites/v4/${sprite}`,
    sources: {
      [SOURCE_ID]: {
        type: 'vector',
        url: `pmtiles://${getPmtilesUrl()}`,
      },
    },
    layers: (layers(SOURCE_ID, FLAVORS[theme], { lang: LABEL_LANG }) as Layer[]).map(quietPois),
  };
}
