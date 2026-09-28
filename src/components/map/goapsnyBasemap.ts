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

/*
 * Day styles after the MapTiler references the Arbitrator picked on 26.09
 * (Backdrop, Winter, Topo): buildings are the main drawing, streets light.
 * Rebuilt over our own OSM file; no MapTiler key or tiles involved.
 */
const BACKDROP: Flavor = {
  ...LIGHT,
  background: '#EEEEEE',
  earth: '#F5F5F5',
  park_a: '#EEEEEE', park_b: '#EAEAEA',
  wood_a: '#ECECEC', wood_b: '#E8E8E8',
  scrub_a: '#EEEEEE', scrub_b: '#EBEBEB',
  hospital: '#F0F0F0', industrial: '#F0F0F0', school: '#F0F0F0',
  pedestrian: '#FAFAFA', sand: '#F0F0F0', beach: '#F0F0F0',
  aerodrome: '#EEEEEE', runway: '#DDDDDD', zoo: '#EEEEEE', military: '#EEEEEE',
  water: '#DCDCDC', pier: '#E4E4E4',
  buildings: '#4D4D4D',
  highway: '#FFFFFF',
  minor_service_casing: '#DADADA', minor_casing: '#D4D4D4', link_casing: '#CCCCCC',
  major_casing_early: '#C8C8C8', major_casing_late: '#C8C8C8',
  highway_casing_early: '#BDBDBD', highway_casing_late: '#BDBDBD',
  railway: '#BBBBBB', boundaries: '#9A9A9A',
  roads_label_minor: '#6B6B6B', roads_label_major: '#3D3D3D',
  ocean_label: '#8A8A8A',
  subplace_label: '#555555', subplace_label_halo: '#FFFFFF',
  city_label: '#222222', city_label_halo: '#FFFFFF',
  state_label: '#777777', state_label_halo: '#FFFFFF',
  country_label: '#555555',
  address_label: '#777777', address_label_halo: '#FFFFFF',
  pois: neutralPois('#5E5E5E'),
};

const WINTER: Flavor = {
  ...LIGHT,
  background: '#E8F0F3',
  earth: '#F4F8FA',
  park_a: '#E5EEF1', park_b: '#DFEAEE',
  wood_a: '#E2ECEF', wood_b: '#DCE8EC',
  scrub_a: '#E6EFF2', scrub_b: '#E0EBEE',
  hospital: '#EEF3F6', industrial: '#EEF3F5', school: '#EEF3F6',
  pedestrian: '#FAFCFD', sand: '#EEF2F2', beach: '#EEF2F2',
  aerodrome: '#EAF1F4', runway: '#D5E0E5', zoo: '#E5EEF1', military: '#E8F0F3',
  water: '#8ECFE2', pier: '#DCE6EA',
  buildings: '#9DC6C8',
  highway: '#FFFFFF',
  minor_service_casing: '#D3DEE3', minor_casing: '#C8D5DB', link_casing: '#BCCBD2',
  major_casing_early: '#B7C7CF', major_casing_late: '#B7C7CF',
  highway_casing_early: '#A9BCC6', highway_casing_late: '#A9BCC6',
  railway: '#B3C3CB', boundaries: '#8FA7B3',
  roads_label_minor: '#5C7480', roads_label_major: '#3E5560',
  ocean_label: '#3F8FAA',
  subplace_label: '#4E6772', subplace_label_halo: '#FFFFFF',
  city_label: '#1F3440', city_label_halo: '#FFFFFF',
  state_label: '#6D8591', state_label_halo: '#FFFFFF',
  country_label: '#4E6772',
  address_label: '#6D8591', address_label_halo: '#FFFFFF',
  pois: neutralPois('#2F4A5A'),
};

const TOPO: Flavor = {
  ...LIGHT,
  background: '#E7E5E1',
  earth: '#F0EFEC',
  park_a: '#DCE9C8', park_b: '#D3E4BC',
  wood_a: '#D6E6C0', wood_b: '#CCE0B3',
  scrub_a: '#DFEACD', scrub_b: '#D8E6C4',
  hospital: '#F2E8E4', industrial: '#EAE7E2', school: '#F1ECDD',
  pedestrian: '#F7F6F3', sand: '#F3E6AE', beach: '#F5E7A8',
  aerodrome: '#E9E6E1', runway: '#D8D3CC', zoo: '#DCE9C8', military: '#E7E5E1',
  water: '#5B9BD1', pier: '#E2DFDA',
  buildings: '#CFC6BB',
  other: '#FFFFFF', minor_service: '#FFFFFF', minor_a: '#FFFFFF', minor_b: '#FFFFFF',
  link: '#FFE9A8', major: '#FFE9A8', highway: '#FFD582',
  minor_service_casing: '#DAD6D0', minor_casing: '#D2CDC6', link_casing: '#E6C878',
  major_casing_early: '#E6C878', major_casing_late: '#E6C878',
  highway_casing_early: '#E2A94E', highway_casing_late: '#E2A94E',
  railway: '#B8B2AA', boundaries: '#9C948A',
  roads_label_minor: '#666058', roads_label_major: '#4A443C',
  ocean_label: '#E8F1F8',
  subplace_label: '#57514A', subplace_label_halo: '#FFFFFF',
  city_label: '#2B2722', city_label_halo: '#FFFFFF',
  state_label: '#7A736A', state_label_halo: '#FFFFFF',
  country_label: '#57514A',
  address_label: '#7A736A', address_label_halo: '#FFFFFF',
  pois: neutralPois('#6A635A'),
};

/** Named basemap variants; the theme picks the default until one is chosen. */
export type BasemapVariant = 'paper' | 'navy' | 'backdrop' | 'winter' | 'topo';

interface VariantSpec {
  flavor: Flavor;
  sprite: 'light' | 'dark';
  /** Buildings as solid drawing (reference styles) vs faint default. */
  solidBuildings: boolean;
}

const VARIANTS: Record<BasemapVariant, VariantSpec> = {
  paper: { flavor: LIGHT, sprite: 'light', solidBuildings: false },
  navy: { flavor: DARK, sprite: 'dark', solidBuildings: false },
  backdrop: { flavor: BACKDROP, sprite: 'light', solidBuildings: true },
  winter: { flavor: WINTER, sprite: 'light', solidBuildings: true },
  topo: { flavor: TOPO, sprite: 'light', solidBuildings: true },
};

const THEME_DEFAULT: Record<BasemapTheme, BasemapVariant> = { light: 'paper', dark: 'navy' };

function isVariant(value: string | null | undefined): value is BasemapVariant {
  return !!value && value in VARIANTS;
}

/** `?basemap=` (for review on the phone) → env → theme default. */
export function resolveVariant(theme: BasemapTheme): BasemapVariant {
  const fromQuery =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('basemap') : null;
  if (isVariant(fromQuery)) return fromQuery;
  const fromEnv = import.meta.env.VITE_MAP_BASEMAP as string | undefined;
  if (isVariant(fromEnv)) return fromEnv;
  return THEME_DEFAULT[theme];
}

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

function solidBuildings(layer: Layer): Layer {
  if (layer.id !== 'buildings' || layer.type !== 'fill') return layer;
  return { ...layer, paint: { ...layer.paint, 'fill-opacity': 1 } };
}

export function getPmtilesUrl(): string {
  const override = import.meta.env.VITE_MAP_PMTILES_URL as string | undefined;
  const url = override || DEFAULT_PMTILES_URL;
  // The pmtiles protocol needs an absolute URL.
  if (/^https?:\/\//.test(url) || typeof window === 'undefined') return url;
  return new URL(url, window.location.origin).href;
}

export function buildGoApsnyStyle(theme: BasemapTheme): StyleSpecification {
  const variant = resolveVariant(theme);
  const spec = VARIANTS[variant];
  const sprite = spec.sprite;
  let styleLayers = (layers(SOURCE_ID, spec.flavor, { lang: LABEL_LANG }) as Layer[]).map(quietPois);
  if (spec.solidBuildings) styleLayers = styleLayers.map(solidBuildings);
  return {
    version: 8,
    name: `GoApsny · ${theme} · ${variant}`,
    glyphs: `${ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${ASSETS}/sprites/v4/${sprite}`,
    sources: {
      [SOURCE_ID]: {
        type: 'vector',
        url: `pmtiles://${getPmtilesUrl()}`,
      },
    },
    layers: styleLayers,
  };
}
