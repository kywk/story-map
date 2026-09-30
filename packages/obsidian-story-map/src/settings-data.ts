import {
  DEFAULT_MARKER_TYPE_ID,
  type LeafletSourceDefaults,
  type LatLngTuple,
  type MarkerTooltipDisplay,
  type MarkerTypeDefinition,
  type StoryInitialSlide,
  type StoryMapSourceDefaults,
  type StoryMapTheme,
  type StoryNoteDisplay,
  type StoryOrder,
  type TileSource,
} from '@story-map/story-map-core';

/** Persisted settings schema version. Bump when the section layout changes. */
export const SETTINGS_VERSION = 2;

/** The historical Leaflet unit setting, carried for future measurement tooling. */
export type UnitSystem = 'metric' | 'imperial';

/**
 * Defaults for the `storymap/v1` keys a document's `story-map` block may omit.
 * Everything here resolves for `story-map` only; nothing here is a `leaflet` default.
 */
export interface StorySectionSettings {
  order?: StoryOrder | undefined;
  dateField?: string | undefined;
  noteDisplay?: StoryNoteDisplay | undefined;
  initialSlide?: StoryInitialSlide | undefined;
  panelOpacity?: number | undefined;
}

/**
 * Shared map presentation and provider defaults.
 *
 * `tiles` is the one part both dialects read: a tile provider is map data rather
 * than story data, and the historical Obsidian Leaflet "Default Tile Server" is
 * adopted straight into the light source. The theme and zoom keys stay
 * `story-map`-only, because `auto` is an Obsidian chrome preset and a `leaflet`
 * block has no story chrome to match.
 */
export interface MapSectionSettings {
  theme?: StoryMapTheme | undefined;
  zoom?: number | undefined;
  minZoom?: number | undefined;
  maxZoom?: number | undefined;
  tiles?: {
    light?: Partial<TileSource> | undefined;
    dark?: Partial<TileSource> | undefined;
  } | undefined;
  showPath?: boolean | undefined;
}

/**
 * The portable marker registry. A type carries a symbol or an image, never a Font
 * Awesome name, and an unregistered `mapmarker` still renders through the default
 * visual while keeping its authored name. Consumed by `<GeoMap />` only, so a
 * native StoryMap is never styled by it.
 */
export interface MarkerSectionSettings {
  defaultType: string;
  types: MarkerTypeDefinition[];
  tooltip: MarkerTooltipDisplay;
}

/** Host behaviors around a rendered marker or note link. */
export interface InteractionSectionSettings {
  /** Obsidian Page preview on hover. Applies to every note link the plugin renders. */
  notePreview: boolean;
  /** Shift-click a `leaflet` marker to copy its `location: [lat, lng]` line. */
  copyCoordinatesOnShiftClick: boolean;
}

/**
 * Defaults that only ever apply to a legacy `leaflet` fenced block. A value here
 * must never reach a native StoryMap: `defaultCenter` in particular must not
 * re-center a story that authored its own `map.center`.
 */
export interface LeafletCompatibilitySettings {
  defaultCenter?: LatLngTuple | undefined;
  /**
   * Theme for a `leaflet` block, which has no source key of its own. A `leaflet`
   * block never reads the `story-map` `map.theme` default, so without this an
   * inline map in a dark vault would keep the fixed `light` palette while every
   * StoryMap beside it followed Obsidian. Defaults to `auto` for the same reason
   * the StoryMap default does.
   */
  theme?: StoryMapTheme | undefined;
  /** Carried for future measurement tooling. Nothing in the plugin measures yet. */
  unitSystem?: UnitSystem | undefined;
  /** Render `GeoMapConfig.diagnostics` under the map. On by default. */
  diagnostics: boolean;
}

export interface StoryMapPluginSettings {
  version: number;
  story: StorySectionSettings;
  map: MapSectionSettings;
  markers: MarkerSectionSettings;
  interaction: InteractionSectionSettings;
  leafletCompatibility: LeafletCompatibilitySettings;
}

export function defaultSettings(): StoryMapPluginSettings {
  return {
    version: SETTINGS_VERSION,
    story: {},
    map: { theme: 'auto', showPath: true },
    markers: { defaultType: DEFAULT_MARKER_TYPE_ID, types: [], tooltip: 'hover' },
    interaction: { notePreview: true, copyCoordinatesOnShiftClick: false },
    leafletCompatibility: { theme: 'auto', diagnostics: true },
  };
}

/**
 * Read persisted data as the current version. Version 1 was a flat object with
 * `map`-prefixed keys; every one of those values is carried into its section, so
 * an existing user's StoryMap defaults survive the upgrade unchanged. Unknown or
 * unreadable data falls back to the built-in defaults rather than throwing, since
 * a corrupt settings file must not stop the plugin from loading.
 */
export function migrateSettings(stored: unknown): StoryMapPluginSettings {
  const base = defaultSettings();
  if (!isRecord(stored)) return base;

  if (stored.version === SETTINGS_VERSION) return mergeV2(base, stored);

  return {
    ...base,
    story: migrateV1Story(base.story, stored),
    map: migrateV1Map(base.map, stored),
  };
}

/** Flat version 1 -> `story` / `map`. `mapOpacity` is the pre-0.3 panel opacity key. */
function migrateV1Story(base: StorySectionSettings, stored: Record<string, unknown>): StorySectionSettings {
  const story: StorySectionSettings = { ...base };
  const order = asOrder(stored.order);
  if (order) story.order = order;
  const dateField = text(stored.dateField);
  if (dateField !== undefined) story.dateField = dateField;
  const noteDisplay = asNoteDisplay(stored.noteDisplay);
  if (noteDisplay) story.noteDisplay = noteDisplay;
  const initialSlide = asInitialSlide(stored.initialSlide);
  if (initialSlide !== undefined) story.initialSlide = initialSlide;
  const panelOpacity = clampOpacity(finite(stored.panelOpacity) ?? finite(stored.mapOpacity));
  if (panelOpacity !== undefined) story.panelOpacity = panelOpacity;
  return story;
}

function migrateV1Map(base: MapSectionSettings, stored: Record<string, unknown>): MapSectionSettings {
  const map: MapSectionSettings = { ...base };
  const theme = asTheme(stored.mapTheme);
  if (theme) map.theme = theme;
  const zoom = finite(stored.mapZoom);
  if (zoom !== undefined) map.zoom = zoom;
  const minZoom = finite(stored.mapMinZoom);
  if (minZoom !== undefined) map.minZoom = minZoom;
  const maxZoom = finite(stored.mapMaxZoom);
  if (maxZoom !== undefined) map.maxZoom = maxZoom;
  if (typeof stored.mapShowPath === 'boolean') map.showPath = stored.mapShowPath;

  const url = text(stored.mapTileUrl);
  const attribution = text(stored.mapAttribution);
  if (url !== undefined || attribution !== undefined) {
    map.tiles = {
      ...base.tiles,
      light: {
        ...base.tiles?.light,
        ...(url === undefined ? {} : { url }),
        ...(attribution === undefined ? {} : { attribution }),
      },
    };
  }
  return map;
}

/** A stored version 2 payload is re-validated key by key, so a partial file loads. */
function mergeV2(base: StoryMapPluginSettings, stored: Record<string, unknown>): StoryMapPluginSettings {
  const story = isRecord(stored.story) ? stored.story : {};
  const map = isRecord(stored.map) ? stored.map : {};
  const markers = isRecord(stored.markers) ? stored.markers : {};
  const interaction = isRecord(stored.interaction) ? stored.interaction : {};
  const compat = isRecord(stored.leafletCompatibility) ? stored.leafletCompatibility : {};

  const defaultCenter = readCenter(compat.defaultCenter);
  const merged: StoryMapPluginSettings = {
    version: SETTINGS_VERSION,
    story: {
      ...base.story,
      ...pick(story, 'order', asOrder),
      ...pick(story, 'dateField', text),
      ...pick(story, 'noteDisplay', asNoteDisplay),
      ...pick(story, 'initialSlide', asInitialSlide),
      ...pick(story, 'panelOpacity', (value) => clampOpacity(finite(value))),
    },
    map: {
      ...base.map,
      ...pick(map, 'theme', asTheme),
      ...pick(map, 'zoom', finite),
      ...pick(map, 'minZoom', finite),
      ...pick(map, 'maxZoom', finite),
      ...pick(map, 'showPath', (value) => (typeof value === 'boolean' ? value : undefined)),
    },
    markers: {
      defaultType: text(markers.defaultType) ?? base.markers.defaultType,
      types: readMarkerTypes(markers.types) ?? base.markers.types,
      tooltip: asTooltip(markers.tooltip) ?? base.markers.tooltip,
    },
    interaction: {
      notePreview:
        typeof interaction.notePreview === 'boolean' ? interaction.notePreview : base.interaction.notePreview,
      copyCoordinatesOnShiftClick:
        typeof interaction.copyCoordinatesOnShiftClick === 'boolean'
          ? interaction.copyCoordinatesOnShiftClick
          : base.interaction.copyCoordinatesOnShiftClick,
    },
    leafletCompatibility: {
      ...(defaultCenter ? { defaultCenter } : {}),
      // `theme` has a built-in default, so an absent or invalid value falls back
      // to it rather than staying unset: a partially corrupt settings file must
      // not silently drop an inline `leaflet` map back to the fixed light palette.
      // `defaultCenter` has no default (the parser's is 0,0), so it stays optional.
      ...pick(compat, 'unitSystem', asUnitSystem),
      theme: asMapTheme(compat.theme) ?? base.leafletCompatibility.theme,
      diagnostics:
        typeof compat.diagnostics === 'boolean' ? compat.diagnostics : base.leafletCompatibility.diagnostics,
    },
  };

  const tiles = readTiles(map.tiles);
  if (tiles) merged.map.tiles = tiles;
  return merged;
}

function readTiles(value: unknown): MapSectionSettings['tiles'] | undefined {
  if (!isRecord(value)) return undefined;
  const light = readTileSource(value.light);
  const dark = readTileSource(value.dark);
  if (!light && !dark) return undefined;
  return {
    ...(light ? { light } : {}),
    ...(dark ? { dark } : {}),
  };
}

function readTileSource(value: unknown): Partial<TileSource> | undefined {
  if (!isRecord(value)) return undefined;
  const source: Partial<TileSource> = {};
  const url = text(value.url);
  if (url !== undefined) source.url = url;
  const attribution = text(value.attribution);
  if (attribution !== undefined) source.attribution = attribution;
  const subdomains = readSubdomains(value.subdomains);
  if (subdomains !== undefined) source.subdomains = subdomains;
  const minZoom = finite(value.minZoom);
  if (minZoom !== undefined) source.minZoom = minZoom;
  const maxZoom = finite(value.maxZoom);
  if (maxZoom !== undefined) source.maxZoom = maxZoom;
  return Object.keys(source).length === 0 ? undefined : source;
}

export function readSubdomains(value: unknown): string | string[] | undefined {
  if (Array.isArray(value)) {
    const list = value.map((item) => text(item)).filter((item): item is string => item !== undefined);
    return list.length === 0 ? undefined : list;
  }
  return text(value);
}

/** Marker-type tags are always a list, so a single authored value is split. */
export function readTags(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    const list = value.map((item) => text(item)).filter((item): item is string => item !== undefined);
    return list.length === 0 ? undefined : list;
  }
  const single = text(value);
  if (single === undefined) return undefined;
  return single
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Marker types are user data, so every field is re-validated before it is used. */
export function readMarkerTypes(value: unknown): MarkerTypeDefinition[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const types: MarkerTypeDefinition[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    const id = text(entry.id);
    if (id === undefined) continue;
    const icon = readMarkerIcon(entry.icon);
    const color = text(entry.color);
    const tags = readTags(entry.tags);
    const minZoom = finite(entry.minZoom);
    const maxZoom = finite(entry.maxZoom);
    types.push({
      id,
      ...(icon ? { icon } : {}),
      ...(color === undefined ? {} : { color }),
      ...(tags === undefined ? {} : { tags }),
      ...(minZoom === undefined ? {} : { minZoom }),
      ...(maxZoom === undefined ? {} : { maxZoom }),
    });
  }
  return types;
}

function readMarkerIcon(value: unknown): { kind: 'symbol' | 'image'; value: string } | undefined {
  if (!isRecord(value)) return undefined;
  const iconValue = text(value.value);
  if (iconValue === undefined) return undefined;
  return value.kind === 'image' ? { kind: 'image', value: iconValue } : { kind: 'symbol', value: iconValue };
}

function readCenter(value: unknown): LatLngTuple | undefined {
  if (!Array.isArray(value) || value.length < 2) return undefined;
  const lat = Number(value[0]);
  const lng = Number(value[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return undefined;
  return [lat, lng];
}

/**
 * `story-map` default resolution: document key -> this section -> built-in.
 * A Leaflet-compatibility value is structurally absent here, so a `leaflet`-only
 * default center can never re-center a native StoryMap.
 */
export function toSourceDefaults(settings: StoryMapPluginSettings): StoryMapSourceDefaults {
  const defaults: StoryMapSourceDefaults = {};
  const { story, map } = settings;

  if (story.order !== undefined) defaults.order = story.order;
  const dateField = text(story.dateField);
  if (dateField !== undefined) defaults.dateField = dateField;
  if (story.noteDisplay !== undefined) defaults.noteDisplay = story.noteDisplay;
  if (story.initialSlide !== undefined) defaults.initialSlide = story.initialSlide;
  if (finite(story.panelOpacity) !== undefined) defaults.panelOpacity = clampOpacity(story.panelOpacity)!;

  const mapDefaults: NonNullable<StoryMapSourceDefaults['map']> = {};
  if (map.theme !== undefined) mapDefaults.theme = map.theme;
  if (finite(map.zoom) !== undefined) mapDefaults.zoom = map.zoom!;
  if (finite(map.minZoom) !== undefined) mapDefaults.minZoom = map.minZoom!;
  if (finite(map.maxZoom) !== undefined) mapDefaults.maxZoom = map.maxZoom!;
  const light = map.tiles?.light;
  const url = text(light?.url);
  if (url !== undefined) mapDefaults.tileUrl = url;
  const attribution = text(light?.attribution);
  if (attribution !== undefined) mapDefaults.attribution = attribution;
  if (map.showPath !== undefined) mapDefaults.showPath = map.showPath;
  if (Object.keys(mapDefaults).length > 0) defaults.map = mapDefaults;

  return defaults;
}

/**
 * `leaflet` default resolution: fenced-block key -> Leaflet compatibility setting
 * -> built-in compatibility default. `story` never appears here, so a StoryMap
 * default is never assumed to exist for a legacy block, and the light/dark tile
 * pair is the shared provider configuration both dialects render.
 */
export function toLeafletSourceDefaults(settings: StoryMapPluginSettings): LeafletSourceDefaults {
  const light = settings.map.tiles?.light;
  const dark = settings.map.tiles?.dark;
  const defaults: LeafletSourceDefaults = {};

  const center = settings.leafletCompatibility.defaultCenter;
  if (center) defaults.center = center;
  // A `leaflet` block has no theme key, so this is the only way it can follow
  // Obsidian's light/dark. It stays in the compatibility section on purpose:
  // the `story-map` default must not become a `leaflet` default by accident.
  if (settings.leafletCompatibility.theme !== undefined) {
    defaults.theme = settings.leafletCompatibility.theme;
  }
  const url = text(light?.url);
  if (url !== undefined) defaults.tileUrl = url;
  const attribution = text(light?.attribution);
  if (attribution !== undefined) defaults.attribution = attribution;
  const subdomains = readSubdomains(light?.subdomains);
  if (subdomains !== undefined) defaults.tileSubdomains = subdomains;
  const darkUrl = text(dark?.url);
  const darkAttribution = text(dark?.attribution);
  if (darkUrl !== undefined) defaults.darkTileUrl = darkUrl;
  if (darkAttribution !== undefined) defaults.darkAttribution = darkAttribution;
  const darkSubdomains = readSubdomains(dark?.subdomains);
  if (darkSubdomains !== undefined) defaults.darkTileSubdomains = darkSubdomains;

  defaults.markerTypes = settings.markers.types;
  defaults.defaultMarkerType = settings.markers.defaultType;
  defaults.tooltip = settings.markers.tooltip;
  return defaults;
}

/**
 * Immutably replace one section; used by the settings tab.
 *
 * A `undefined` patch value means "clear this override" rather than "set it to
 * undefined": empty keys are dropped, so the section falls back to the built-in
 * default instead of serializing a dead value.
 */
export function patchSettings<K extends SettingsSection>(
  settings: StoryMapPluginSettings,
  section: K,
  patch: SectionPatch<StoryMapPluginSettings[K]>,
): StoryMapPluginSettings {
  const merged: Record<string, unknown> = { ...settings[section] };
  for (const [key, value] of Object.entries(patch)) {
    // An `undefined` value clears the override rather than storing a dead key, so
    // clearing a text field in the settings tab returns the section to its default.
    if (value === undefined) delete merged[key];
    else merged[key] = value;
  }
  return { ...settings, [section]: merged } as StoryMapPluginSettings;
}

/** The five persisted sections. The version number itself is never patched. */
export type SettingsSection = 'story' | 'map' | 'markers' | 'interaction' | 'leafletCompatibility';

/** Drop keys whose value is `undefined`, so an optional field becomes absent. */
export function compact<T extends object>(value: T): Partial<T> {
  const result: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry !== undefined) result[key] = entry;
  }
  return result as Partial<T>;
}

/** A patch whose values may be `undefined`, which clears that key. */
export type SectionPatch<S> = { [K in keyof S]?: S[K] | undefined };

function pick<T>(
  record: Record<string, unknown>,
  key: string,
  read: (value: unknown) => T | undefined,
): Record<string, T> {
  const value = read(record[key]);
  return value === undefined ? {} : ({ [key]: value } as Record<string, T>);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

function finite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function clampOpacity(value: number | undefined): number | undefined {
  return value === undefined ? undefined : Math.max(0, Math.min(1, value));
}

function asOrder(value: unknown): StoryOrder | undefined {
  return value === 'asc' || value === 'desc' ? value : undefined;
}

function asNoteDisplay(value: unknown): StoryNoteDisplay | undefined {
  return value === 'basic' || value === 'link' || value === 'full' ? value : undefined;
}

function asInitialSlide(value: unknown): StoryInitialSlide | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return value === 'first' || value === 'last' ? value : undefined;
}

function asTheme(value: unknown): StoryMapTheme | undefined {
  return value === 'auto' || value === 'light' || value === 'dark' || value === 'vintage' || value === 'cyber' || value === 'atlas'
    ? value
    : undefined;
}

function asTooltip(value: unknown): MarkerTooltipDisplay | undefined {
  return value === 'always' || value === 'hover' || value === 'never' ? value : undefined;
}

function asUnitSystem(value: unknown): UnitSystem | undefined {
  return value === 'metric' || value === 'imperial' ? value : undefined;
}

function asMapTheme(value: unknown): StoryMapTheme | undefined {
  return value === 'auto' ||
    value === 'light' ||
    value === 'dark' ||
    value === 'vintage' ||
    value === 'cyber' ||
    value === 'atlas'
    ? value
    : undefined;
}
