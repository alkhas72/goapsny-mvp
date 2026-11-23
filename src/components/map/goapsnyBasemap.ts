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

/*
 * Monochrome with light presets — after Mapbox Standard "Monochrome" the
 * Arbitrator showed on 28.09: one grey map, four lights (dawn, day, dusk,
 * night) and a 2D/3D view. MapLibre does this in core: `light`, `sky`,
 * fill-extrusion and camera pitch; no plugin needed.
 */
export type LightPreset = 'dawn' | 'day' | 'dusk' | 'night';

export const LIGHT_PRESETS: readonly LightPreset[] = ['dawn', 'day', 'dusk', 'night'];

interface MonoTokens {
  background: string;
  land: string;
  area: string;
  water: string;
  road: string;
  roadMajor: string;
  building: string;
  building3d: string;
  label: string;
  labelStrong: string;
  halo: string;
  line: string;
}

function monoFlavor(t: MonoTokens): Flavor {
  const areas = {
    park_a: t.area, park_b: t.area, wood_a: t.area, wood_b: t.area,
    scrub_a: t.area, scrub_b: t.area, hospital: t.area, industrial: t.area,
    school: t.area, pedestrian: t.land, glacier: t.land, sand: t.area,
    beach: t.area, aerodrome: t.area, zoo: t.area, military: t.area,
  };
  return {
    ...namedFlavor('light'),
    ...areas,
    background: t.background,
    earth: t.land,
    runway: t.road,
    water: t.water,
    pier: t.area,
    buildings: t.building,
    other: t.road, minor_service: t.road, minor_a: t.road, minor_b: t.road,
    link: t.roadMajor, major: t.roadMajor, highway: t.roadMajor,
    minor_service_casing: t.land, minor_casing: t.land, link_casing: t.land,
    major_casing_early: t.land, major_casing_late: t.land,
    highway_casing_early: t.land, highway_casing_late: t.land,
    tunnel_other_casing: t.land, tunnel_minor_casing: t.land, tunnel_link_casing: t.land,
    tunnel_major_casing: t.land, tunnel_highway_casing: t.land,
    tunnel_other: t.road, tunnel_minor: t.road, tunnel_link: t.roadMajor,
    tunnel_major: t.roadMajor, tunnel_highway: t.roadMajor,
    bridges_other_casing: t.land, bridges_minor_casing: t.land, bridges_link_casing: t.land,
    bridges_major_casing: t.land, bridges_highway_casing: t.land,
    bridges_other: t.road, bridges_minor: t.road, bridges_link: t.roadMajor,
    bridges_major: t.roadMajor, bridges_highway: t.roadMajor,
    railway: t.line, boundaries: t.line,
    roads_label_minor: t.label, roads_label_minor_halo: t.halo,
    roads_label_major: t.label, roads_label_major_halo: t.halo,
    ocean_label: t.label,
    subplace_label: t.label, subplace_label_halo: t.halo,
    city_label: t.labelStrong, city_label_halo: t.halo,
    state_label: t.label, state_label_halo: t.halo,
    country_label: t.label,
    address_label: t.label, address_label_halo: t.halo,
    pois: neutralPois(t.label),
  };
}

interface PresetSpec {
  tokens: MonoTokens;
  sprite: 'light' | 'dark';
  light: NonNullable<StyleSpecification['light']>;
  sky: NonNullable<StyleSpecification['sky']>;
}

const PRESETS: Record<LightPreset, PresetSpec> = {
  dawn: {
    sprite: 'light',
    tokens: {
      background: '#DEDDE0', land: '#E7E6E9', area: '#E0DFE3', water: '#C4C5CA',
      road: '#F4F3F5', roadMajor: '#FAF9FB', building: '#D6D5DA', building3d: '#E4E1E6',
      label: '#86848C', labelStrong: '#4E4C54', halo: '#EFEEF1', line: '#BDBBC2',
    },
    light: { anchor: 'map', color: '#FFF1EA', intensity: 0.35, position: [1.5, 80, 70] },
    sky: {
      'sky-color': '#C9CCE0', 'horizon-color': '#F6D8CC', 'fog-color': '#E7E6E9',
      'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.6, 'atmosphere-blend': 0.6,
    },
  },
  day: {
    sprite: 'light',
    tokens: {
      background: '#ECECEC', land: '#F4F4F4', area: '#ECECEC', water: '#D2D2D2',
      road: '#FFFFFF', roadMajor: '#FFFFFF', building: '#E2E2E2', building3d: '#F0F0F0',
      label: '#8C8C8C', labelStrong: '#4A4A4A', halo: '#FFFFFF', line: '#C4C4C4',
    },
    light: { anchor: 'map', color: '#FFFFFF', intensity: 0.35, position: [1.5, 210, 35] },
    sky: {
      'sky-color': '#DCE3EA', 'horizon-color': '#F4F4F4', 'fog-color': '#F4F4F4',
      'sky-horizon-blend': 0.5, 'horizon-fog-blend': 0.6, 'fog-ground-blend': 0.7, 'atmosphere-blend': 0.5,
    },
  },
  dusk: {
    sprite: 'dark',
    tokens: {
      background: '#4E4E50', land: '#5A5A5C', area: '#545456', water: '#38383A',
      road: '#6E6E70', roadMajor: '#7A7A7C', building: '#4A4A4C', building3d: '#6A6664',
      label: '#D2D2D4', labelStrong: '#EDEDEE', halo: '#454547', line: '#707072',
    },
    light: { anchor: 'map', color: '#FFE2CF', intensity: 0.35, position: [1.5, 280, 70] },
    sky: {
      'sky-color': '#3F4458', 'horizon-color': '#C98C6E', 'fog-color': '#5A5A5C',
      'sky-horizon-blend': 0.7, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.6, 'atmosphere-blend': 0.7,
    },
  },
  night: {
    sprite: 'dark',
    tokens: {
      background: '#202022', land: '#2A2A2C', area: '#262628', water: '#121213',
      road: '#3A3A3D', roadMajor: '#454548', building: '#1E1E20', building3d: '#34363C',
      label: '#BDBDC0', labelStrong: '#E4E4E6', halo: '#18181A', line: '#46464A',
    },
    light: { anchor: 'map', color: '#9FB2D0', intensity: 0.3, position: [1.5, 210, 40] },
    sky: {
      'sky-color': '#0E1118', 'horizon-color': '#2A2F3C', 'fog-color': '#2A2A2C',
      'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.6, 'atmosphere-blend': 0.5,
    },
  },
};

/*
 * Base palettes the user picks from; each then takes the four lights.
 * Gray is tuned per light by hand; blue and violet (after the Arbitrator's
 * own Mapbox styles) are derived from their day colours.
 */
export type BasemapPalette = 'gray' | 'blue' | 'violet';

export const BASEMAP_PALETTES: readonly BasemapPalette[] = ['gray', 'blue', 'violet'];

/** Swatch shown in the palette picker. */
export const PALETTE_SWATCH: Record<BasemapPalette, string> = {
  gray: '#D9D9D9',
  blue: '#7F99B8',
  violet: '#8C96E6',
};

const PALETTE_DAY: Record<Exclude<BasemapPalette, 'gray'>, MonoTokens> = {
  blue: {
    background: '#B9C8DA', land: '#C6D3E2', area: '#BCCADC', water: '#6F87A3',
    road: '#E6EDF5', roadMajor: '#F2F6FA', building: '#B3C2D4', building3d: '#D3DEEA',
    label: '#4F6682', labelStrong: '#2C3E55', halo: '#DCE5EF', line: '#98ABC2',
  },
  violet: {
    background: '#AEB6EE', land: '#B9C0F2', area: '#A3A9E4', water: '#64C0EC',
    road: '#F1F4FF', roadMajor: '#FFFFFF', building: '#A2A8E6', building3d: '#CDD2FA',
    label: '#4A4F9E', labelStrong: '#2E3278', halo: '#D5DAFB', line: '#8E95DA',
  },
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${c(ar, br)}${c(ag, bg)}${c(ab, bb)}`;
}

function mapTokens(t: MonoTokens, fn: (hex: string) => string): MonoTokens {
  return Object.fromEntries(Object.entries(t).map(([k, v]) => [k, fn(v)])) as unknown as MonoTokens;
}

/** Palette colours under a light: dawn slightly rosy, dusk and night dimmed. */
function paletteTokens(palette: BasemapPalette, preset: LightPreset): MonoTokens {
  if (palette === 'gray') return PRESETS[preset].tokens;
  const day = PALETTE_DAY[palette];
  if (preset === 'day') return day;
  if (preset === 'dawn') return mapTokens(day, (c) => mix(mix(c, '#F2D2C8', 0.14), '#707078', 0.06));
  const shade = preset === 'dusk' ? { tone: '#2E2E38', t: 0.55 } : { tone: '#0E0E14', t: 0.78 };
  const dim = mapTokens(day, (c) => mix(c, shade.tone, shade.t));
  const warm = preset === 'dusk' ? (c: string) => mix(c, '#6A4A3A', 0.08) : (c: string) => c;
  return {
    ...mapTokens(dim, warm),
    // Labels flip to light on dark ground.
    label: mix(day.halo, '#FFFFFF', 0.2),
    labelStrong: '#FFFFFF',
    halo: dim.background,
    building3d: mix(day.building3d, shade.tone, shade.t - 0.12),
  };
}

export function defaultLightPreset(theme: BasemapTheme): LightPreset {
  return theme === 'dark' ? 'night' : 'day';
}

/** Named basemap variants; the theme picks the default until one is chosen. */
export type BasemapVariant = 'mono' | 'paper' | 'navy' | 'backdrop' | 'winter' | 'topo';

interface VariantSpec {
  flavor: Flavor;
  sprite: 'light' | 'dark';
  /** Buildings as solid drawing (reference styles) vs faint default. */
  solidBuildings: boolean;
}

const VARIANTS: Record<Exclude<BasemapVariant, 'mono'>, VariantSpec> = {
  paper: { flavor: LIGHT, sprite: 'light', solidBuildings: false },
  navy: { flavor: DARK, sprite: 'dark', solidBuildings: false },
  backdrop: { flavor: BACKDROP, sprite: 'light', solidBuildings: true },
  winter: { flavor: WINTER, sprite: 'light', solidBuildings: true },
  topo: { flavor: TOPO, sprite: 'light', solidBuildings: true },
};


function isVariant(value: string | null | undefined): value is BasemapVariant {
  return value === 'mono' || (!!value && value in VARIANTS);
}

/** `?basemap=` (for review on the phone) → env → monochrome. */
export function resolveVariant(): BasemapVariant {
  const fromQuery =
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('basemap') : null;
  if (isVariant(fromQuery)) return fromQuery;
  const fromEnv = import.meta.env.VITE_MAP_BASEMAP as string | undefined;
  if (isVariant(fromEnv)) return fromEnv;
  return 'mono';
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

/** Extruded buildings; OSM height where mapped, else a low Sukhum default. */
function buildings3d(color: string, visible: boolean): Layer {
  return {
    id: 'buildings-3d',
    type: 'fill-extrusion',
    source: SOURCE_ID,
    'source-layer': 'buildings',
    minzoom: 14,
    layout: { visibility: visible ? 'visible' : 'none' },
    paint: {
      'fill-extrusion-color': color,
      'fill-extrusion-height': ['coalesce', ['get', 'height'], 9],
      'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0],
      'fill-extrusion-opacity': 0.92,
      'fill-extrusion-vertical-gradient': true,
    },
  };
}

function withLayerAfter(list: Layer[], afterId: string, layer: Layer): Layer[] {
  const i = list.findIndex((l) => l.id === afterId);
  if (i < 0) return [...list, layer];
  return [...list.slice(0, i + 1), layer, ...list.slice(i + 1)];
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

export interface BasemapOptions {
  /** Base palette the user picked; defaults to gray (Monochrome). */
  palette?: BasemapPalette;
  /** Light preset; defaults from the app theme. */
  preset?: LightPreset;
  /** 3D view: extruded buildings (camera pitch is set by the map). */
  threeD?: boolean;
}

export function buildGoApsnyStyle(theme: BasemapTheme, options: BasemapOptions = {}): StyleSpecification {
  const variant = resolveVariant();
  const threeD = options.threeD ?? false;
  const presetId = options.preset ?? defaultLightPreset(theme);
  const preset = PRESETS[presetId];
  const palette = options.palette ?? 'gray';

  let flavor: Flavor;
  let sprite: 'light' | 'dark';
  let solid = false;
  let extrusionColor: string;
  if (variant === 'mono') {
    const tokens = paletteTokens(palette, presetId);
    flavor = monoFlavor(tokens);
    sprite = preset.sprite;
    extrusionColor = tokens.building3d;
  } else {
    const spec = VARIANTS[variant];
    flavor = spec.flavor;
    sprite = spec.sprite;
    solid = spec.solidBuildings;
    extrusionColor = spec.flavor.buildings;
  }

  let styleLayers = (layers(SOURCE_ID, flavor, { lang: LABEL_LANG }) as Layer[]).map(quietPois);
  if (solid) styleLayers = styleLayers.map(solidBuildings);
  styleLayers = withLayerAfter(styleLayers, 'buildings', buildings3d(extrusionColor, threeD));

  const presetName = variant === 'mono' ? ` · ${palette} · ${presetId}` : '';
  return {
    version: 8,
    name: `GoApsny · ${theme} · ${variant}${presetName}`,
    glyphs: `${ASSETS}/fonts/{fontstack}/{range}.pbf`,
    sprite: `${ASSETS}/sprites/v4/${sprite}`,
    light: preset.light,
    sky: preset.sky,
    sources: {
      [SOURCE_ID]: {
        type: 'vector',
        url: `pmtiles://${getPmtilesUrl()}`,
      },
    },
    layers: styleLayers,
  };
}
