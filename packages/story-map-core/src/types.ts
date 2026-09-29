export type LatLngTuple = [lat: number, lng: number];

export interface StoryLocation {
  lat: number;
  lng: number;
  zoom?: number;
}

export type StoryMediaType = 'image' | 'video' | 'iframe';

export interface StoryMedia {
  type: StoryMediaType;
  src: string;
  alt?: string;
  caption?: string;
}

export interface StorySlide {
  id?: string;
  note?: string;
  notePath?: string;
  title?: string;
  text?: string;
  /**
   * Optional entry date in epoch milliseconds, normalized by the parser from
   * `Date`, `number`, and `string` sources. Consumed by the timeline layout;
   * adapters fill it from the configured `dateField` for folder-discovered notes.
   */
  date?: number;
  location?: StoryLocation;
  media?: StoryMedia;
  mapmarker?: string;
}

export type StoryOrder = 'asc' | 'desc';

export const DEFAULT_STORY_ORDER: StoryOrder = 'asc';
export const DEFAULT_DATE_FIELD = 'date-created';

export type StoryNoteDisplay = 'basic' | 'link' | 'full';

export const DEFAULT_NOTE_DISPLAY: StoryNoteDisplay = 'link';

export type StoryInitialSlide = 'first' | 'last' | number;
export const DEFAULT_INITIAL_SLIDE: StoryInitialSlide = 'first';

export type StoryMapTheme = 'auto' | 'light' | 'dark' | 'vintage' | 'cyber' | 'atlas';
export const DEFAULT_MAP_THEME: StoryMapTheme = 'light';

/**
 * Built-in raster tile source. The OpenStreetMap tile usage policy asks applications
 * to use the standard single-host endpoint rather than hard-coding a rotated
 * `{s}.tile.openstreetmap.org` subdomain, so the shared default is the plain host.
 * Attribution must stay visible: it is required by the same policy.
 */
export const DEFAULT_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const DEFAULT_TILE_ATTRIBUTION = '© OpenStreetMap contributors';
export const DEFAULT_PANEL_OPACITY = 0.85;

export type StoryMapLayoutMode = 'card' | 'full' | 'timeline';
export const DEFAULT_LAYOUT_MODE: StoryMapLayoutMode = 'card';
export const DEFAULT_CARD_ALIGN: StoryMapCardLayout['align'] = 'left';
export const DEFAULT_FULL_SIDE: StoryMapFullLayout['side'] = 'left';
export const DEFAULT_FULL_CONTENT_RATIO = 0.5;

export interface StoryMapCardLayout {
  align: 'left' | 'center' | 'right';
  widthRatio?: number;
  heightRatio?: number;
}

export interface StoryMapFullLayout {
  side: 'left' | 'right';
  contentRatio: number;
}

export interface StoryMapLayoutOptions {
  mode: StoryMapLayoutMode;
  card: StoryMapCardLayout;
  full: StoryMapFullLayout;
}

export interface StoryMapOptions {
  center?: LatLngTuple;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  theme: StoryMapTheme;
  tileUrl: string;
  attribution: string;
  showPath: boolean;
}

export interface StoryMapConfig {
  schema: 'storymap/v1';
  id?: string;
  title?: string;
  height: string;
  panelOpacity: number;
  initialSlide?: number | undefined;
  map: StoryMapOptions;
  layout: StoryMapLayoutOptions;
  slides: StorySlide[];
}

export interface StoryMapSourceDefaults {
  order?: StoryOrder | undefined;
  dateField?: string | undefined;
  noteDisplay?: StoryNoteDisplay | undefined;
  initialSlide?: StoryInitialSlide | undefined;
  panelOpacity?: number | undefined;
  map?: Partial<Omit<StoryMapOptions, 'center'>> | undefined;
}

/**
 * One raster tile source. A theme is presentation and a tile source is map data,
 * so a theme never replaces a configured URL and a URL never selects a theme.
 */
export interface TileSource {
  url: string;
  attribution: string;
  subdomains?: string | string[];
  minZoom?: number;
  maxZoom?: number;
}

/**
 * The internal canonical tile shape. `light` is always present because every map
 * needs a rendered background; `dark` exists only when a host configured a
 * light/dark pair. `storymap/v1` keeps its published `map.tileUrl` /
 * `map.attribution` pair and normalizes it into `light` (see `toTileSources`).
 */
export interface TileSources {
  light: TileSource;
  dark?: TileSource;
}

/** Loosely typed tile-source input, so hosts can pass partial settings through. */
export interface TileSourceInput {
  url?: string | undefined;
  attribution?: string | undefined;
  subdomains?: string | string[] | undefined;
  minZoom?: number | undefined;
  maxZoom?: number | undefined;
}

export interface GeoMapControlOptions {
  noUI?: boolean;
  noScrollZoom?: boolean;
  recenter?: boolean;
  locked?: boolean;
}

/**
 * The storyless map model. It shares the theme union and the tile constants with
 * `storymap/v1` on purpose: one Leaflet runtime serves both dialects.
 */
export interface GeoMapOptions {
  center?: LatLngTuple;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  zoomDelta?: number;
  theme: StoryMapTheme;
  tiles: TileSources;
  controls?: GeoMapControlOptions;
}

export type MarkerTooltipDisplay = 'always' | 'hover' | 'never';

/**
 * Leaflet-compatible `mapzoom` range. Note frontmatter is more specific than a
 * marker type definition, so note bounds win and type bounds fill the gaps.
 */
export interface MarkerZoomRange {
  minZoom?: number;
  maxZoom?: number;
}

export interface GeoMarker {
  id?: string;
  type?: string;
  location: Pick<StoryLocation, 'lat' | 'lng'>;
  title?: string;
  description?: string;
  notePath?: string;
  minZoom?: number;
  maxZoom?: number;
  tooltip?: MarkerTooltipDisplay;
}

export interface MarkerTypeIcon {
  kind: 'symbol' | 'image';
  value: string;
}

/**
 * A portable marker type. Font Awesome is not a cross-platform contract, so a
 * type carries a symbol or an image; an unknown authored type still resolves and
 * keeps its name for diagnostics while the renderer falls back visually.
 */
export interface MarkerTypeDefinition {
  id: string;
  icon?: MarkerTypeIcon;
  color?: string;
  tags?: string[];
  minZoom?: number;
  maxZoom?: number;
}

export const DEFAULT_MARKER_TYPE_ID = 'default';

export interface GeoMapDiagnostic {
  level: 'warning' | 'error';
  code: string;
  key?: string;
  message: string;
}

export interface GeoMapConfig {
  schema: 'geomap/v1';
  /** Authored identity. It may repeat across maps on one page; host instance identity is separate. */
  id?: string;
  height: string;
  map: GeoMapOptions;
  markers: GeoMarker[];
  /** Recognized-but-unimplemented keys and invalid values, surfaced by the host. */
  diagnostics?: GeoMapDiagnostic[];
}

/**
 * Leaflet-dialect source defaults. These are the Leaflet *compatibility* settings
 * only (the Obsidian `leafletCompatibility` section, or a host equivalent): they
 * are never a StoryMap setting, and a `storymap/v1` setting is never assumed to
 * exist for a `leaflet` block. Resolution order is authored key -> these defaults
 * -> built-in compatibility default.
 */
export interface LeafletSourceDefaults {
  height?: string | undefined;
  center?: LatLngTuple | undefined;
  zoom?: number | undefined;
  minZoom?: number | undefined;
  maxZoom?: number | undefined;
  zoomDelta?: number | undefined;
  theme?: StoryMapTheme | undefined;
  tileUrl?: string | undefined;
  attribution?: string | undefined;
  tileSubdomains?: string | string[] | undefined;
  darkTileUrl?: string | undefined;
  darkAttribution?: string | undefined;
  darkTileSubdomains?: string | string[] | undefined;
  /** Configured marker type registry used by `resolveMarkerType`. */
  markerTypes?: readonly MarkerTypeDefinition[] | undefined;
  /** Configured default marker type id, used before the built-in generic default. */
  defaultMarkerType?: string | undefined;
  tooltip?: MarkerTooltipDisplay | undefined;
}

/**
 * Recognized `leaflet` keys this phase parses and carries but does not implement.
 * Keeping them here means a later phase can implement behavior without teaching
 * the parser to read the dialect again, and the diagnostics stay honest about
 * which keys are still pending.
 */
export interface LeafletPendingKeys {
  /** P0 accept / P3 measurement. Metadata only; measurement tooling does not exist. */
  unit?: string;
  /** P0 accept / P3 image + measurement. Metadata only. */
  scale?: number;
  /** P0 parse / P1 semantics. Never changes `theme` or `tiles` by itself. */
  darkMode?: boolean;
  width?: string;
  noUI?: boolean;
  noScrollZoom?: boolean;
  recenter?: boolean;
  lock?: unknown;
  verbose?: boolean;
  osmLayer?: boolean;
  markerFile?: string[];
  marker?: unknown[];
  markerTag?: string[];
  filterTag?: string[];
  linksTo?: string[];
  linksFrom?: string[];
  tileServer?: string[];
  tileSubdomains?: string[];
}

/**
 * The pre-resolution shape of a `leaflet` fenced block. Marker and Vault
 * resolution stays in the adapters: core never lists files. `deferred` holds the
 * raw recognized P2/P3 values (and the rejected host-only keys) so nothing
 * authored disappears before its phase lands.
 */
export interface LeafletSourceConfig {
  schema: 'leaflet/v1';
  id?: string;
  height: string;
  map: GeoMapOptions;
  markerFolder: string[];
  pending: LeafletPendingKeys;
  deferred: Record<string, unknown>;
  diagnostics: GeoMapDiagnostic[];
}

/**
 * Built-in compatibility defaults for a `leaflet` block that omits the key. They
 * deliberately mirror the `storymap/v1` built-ins (`520px`, zoom `6`,
 * `DEFAULT_MAP_THEME`, `DEFAULT_TILE_URL`) so one authoring mental model covers
 * both dialects, while staying separate from the StoryMap *plugin* settings, which
 * never apply to a `leaflet` block.
 */
export const DEFAULT_LEAFLET_HEIGHT = '520px';
export const DEFAULT_LEAFLET_ZOOM = 6;

export interface StoryMapSourceConfig {
  schema: 'storymap/v1';
  id?: string;
  title?: string;
  height: string;
  noteFolder?: string;
  order: StoryOrder;
  dateField: string;
  noteDisplay: StoryNoteDisplay;
  initialSlide: StoryInitialSlide;
  panelOpacity: number;
  includeTags?: string[];
  excludeTags?: string[];
  map: StoryMapOptions;
  layout: StoryMapLayoutOptions;
  slides?: StorySlide[];
}
