import { normalizePath, type App } from 'obsidian';
import type { MarkerTypeDefinition } from '@story-map/story-map-core';
import {
  patchSettings,
  readTags,
  type MarkerSectionSettings,
  type StoryMapPluginSettings,
} from './settings-data.js';

/** Community plugin id of the historical Obsidian Leaflet plugin. */
const LEGACY_PLUGIN_ID = 'obsidian-leaflet';

export interface LeafletImportResult {
  settings: StoryMapPluginSettings;
  /** What was carried over, for the completion notice. */
  imported: string[];
  /** What was skipped, and why. A CARTO URL is never applied silently. */
  warnings: string[];
}

/**
 * A small, deterministic translation from the historical Font Awesome marker icon
 * names to portable symbols. Font Awesome is not a cross-platform contract, so the
 * plugin ships no Font Awesome dependency: a name in this table becomes a symbol,
 * and anything else keeps the default visual plus a warning.
 */
const ICON_SYMBOLS: Record<string, string> = {
  // The `mapmarker` values observed in existing travel content.
  restaurant: '🍴',
  food: '🍴',
  shop: '🛍',
  store: '🏪',
  marathon: '🏃',
  // Location and route.
  'map-marker': '📍',
  'map-marker-alt': '📍',
  'map-pin': '📍',
  plane: '✈️',
  train: '🚆',
  car: '🚗',
  bus: '🚌',
  bicycle: '🚲',
  ship: '🚢',
  anchor: '⚓',
  // Stay and place.
  hotel: '🏨',
  bed: '🛏',
  home: '🏠',
  building: '🏢',
  church: '⛪',
  monument: '🗿',
  tree: '🌳',
  leaf: '🌿',
  droplet: '💧',
  // Food and drink.
  utensils: '🍴',
  'utensils-crossed': '🍴',
  'fork-knife': '🍴',
  coffee: '☕',
  'mug-hot': '☕',
  beer: '🍺',
  // Services and activity.
  camera: '📷',
  image: '🖼',
  'shopping-bag': '🛍',
  'shopping-cart': '🛒',
  gift: '🎁',
  ticket: '🎫',
  tent: '⛺',
  campground: '🏕',
  hiking: '🥾',
  mountain: '⛰',
  swimming: '🏊',
  hospital: '🏥',
  'person-running': '🏃',
  'person-walking': '🚶',
  dumbbell: '🏋️',
  trophy: '🏆',
  medal: '🏅',
  // Personality and emphasis.
  star: '⭐',
  heart: '❤️',
  flag: '🚩',
  bookmark: '🔖',
  users: '👥',
};

/**
 * Read the historical plugin's saved data, if the user has it.
 *
 * The read is strictly optional and read-only, through the Vault adapter: the
 * plugin never requires the community plugin to be installed, loaded, or enabled.
 * Returns `null` when no readable data file exists, which the caller reports
 * rather than guessing.
 */
export async function readLegacyLeafletSettings(
  app: App,
): Promise<Record<string, unknown> | null> {
  const path = `${normalizePath(app.vault.configDir)}/plugins/${LEGACY_PLUGIN_ID}/data.json`;
  try {
    if (!(await app.vault.adapter.exists(path))) return null;
    const parsed: unknown = JSON.parse(await app.vault.adapter.read(path));
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Import the durable map and marker concepts from the historical settings.
 *
 * Exactly the candidate list is imported. Mutable marker state (`mapMarkers`),
 * overlays and shapes, CSV state, map-view state, version flags, and
 * `configDirectory` are deliberately not read: they are internal persistence of a
 * plugin whose store this one does not recreate.
 */
export function importLegacyLeafletSettings(
  current: StoryMapPluginSettings,
  data: Record<string, unknown>,
): LeafletImportResult {
  const imported: string[] = [];
  const warnings: string[] = [];
  const existingTiles = current.map.tiles;
  let settings = current;

  const light = importTile(data.defaultTile, data.defaultAttribution, data.defaultTileSubdomains, warnings);
  const dark = importTile(data.defaultTileDark, undefined, undefined, warnings);

  if (light || dark) {
    // Each side the old plugin had is replaced outright, so a stale URL is never
    // left underneath. The other side keeps whatever the user configured here.
    settings = patchSettings(settings, 'map', {
      tiles: {
        ...(light ?? existingTiles?.light ? { light: light ?? existingTiles?.light } : {}),
        ...(dark ?? existingTiles?.dark ? { dark: dark ?? existingTiles?.dark } : {}),
      },
    });
    imported.push('tiles');
  }

  const markers = importMarkers(data, warnings, imported);
  if (markers) settings = patchSettings(settings, 'markers', markers);

  const center = readLegacyCenter(data);
  const unitSystem = data.defaultUnitType === 'metric' || data.defaultUnitType === 'imperial'
    ? data.defaultUnitType
    : undefined;
  if (center || unitSystem) {
    settings = patchSettings(settings, 'leafletCompatibility', {
      ...(center ? { defaultCenter: center } : {}),
      ...(unitSystem ? { unitSystem } : {}),
    });
  }
  if (center) imported.push('defaultCenter');
  if (unitSystem) imported.push('unitSystem');

  const interaction: { notePreview?: boolean; copyCoordinatesOnShiftClick?: boolean } = {};
  if (typeof data.notePreview === 'boolean') {
    interaction.notePreview = data.notePreview;
    imported.push('notePreview');
  }
  if (typeof data.copyOnClick === 'boolean') {
    interaction.copyCoordinatesOnShiftClick = data.copyOnClick;
    imported.push('copyCoordinatesOnShiftClick');
  }
  if (interaction.notePreview !== undefined || interaction.copyCoordinatesOnShiftClick !== undefined) {
    settings = patchSettings(settings, 'interaction', interaction);
  }

  return { settings, imported, warnings };
}

/**
 * One tile source. A CARTO Basemaps URL without an API key is reported and not
 * applied: CARTO requires a key for Basemaps, and a fenced block or a generated
 * page is public source, so the plugin never turns a keyless CARTO URL into a
 * silent default that then fails on every tile request.
 */
function importTile(
  urlValue: unknown,
  attributionValue: unknown,
  subdomainsValue: unknown,
  warnings: string[],
): { url?: string; attribution?: string; subdomains?: string[] } | undefined {
  const url = typeof urlValue === 'string' && urlValue.trim() ? urlValue.trim() : undefined;
  const attribution = typeof attributionValue === 'string' && attributionValue.trim()
    ? attributionValue.trim()
    : undefined;
  const subdomains = readTags(subdomainsValue);
  if (url === undefined && attribution === undefined && subdomains === undefined) return undefined;

  if (url !== undefined && isKeylessCarto(url)) {
    warnings.push(
      'This CARTO Basemaps URL does not contain an API key. CARTO now requires keys for Basemaps. Configure a CARTO key or switch to another tile provider.',
    );
    return undefined;
  }

  return {
    ...(url === undefined ? {} : { url }),
    ...(attribution === undefined ? {} : { attribution }),
    ...(subdomains === undefined ? {} : { subdomains }),
  };
}

/** CARTO Basemaps under `basemaps.cartocdn.com` that carries no key parameter. */
export function isKeylessCarto(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url.replace('{s}', 'a'), 'https://placeholder.invalid');
  } catch {
    return false;
  }
  if (!/(^|\.)basemaps\.cartocdn\.com$/i.test(parsed.hostname)) return false;
  return !['apikey', 'api_key', 'key', 'token'].some((name) => parsed.searchParams.has(name));
}

/**
 * Marker types: name, color, tag associations, and zoom bounds are preserved. The
 * historical Font Awesome icon name becomes a portable symbol when the small known
 * set covers it, and otherwise the type keeps the default visual with a warning.
 * `layerBaseMarker` is a Font Awesome composition detail and is not carried.
 */
function importMarkers(
  data: Record<string, unknown>,
  warnings: string[],
  imported: string[],
): Partial<MarkerSectionSettings> | undefined {
  const patch: Partial<MarkerSectionSettings> = {};
  const types: MarkerTypeDefinition[] = [];
  const seen = new Set<string>();

  if (Array.isArray(data.markerIcons)) {
    for (const entry of data.markerIcons) {
      const type = importMarkerType(entry, warnings);
      if (!type) continue;
      const key = type.id.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      types.push(type);
    }
  }

  if (types.length > 0) {
    patch.types = types;
    imported.push('markerTypes');
  }

  const defaultType = typeof data.defaultMarker === 'string' ? data.defaultMarker.trim() : '';
  if (defaultType) {
    // An unknown name is still carried: the renderer falls back visually and keeps
    // the authored type, so a typo does not silently lose the user's default.
    patch.defaultType = defaultType;
    imported.push('defaultMarkerType');
  }

  if (data.displayMarkerTooltips === 'always' || data.displayMarkerTooltips === 'hover' || data.displayMarkerTooltips === 'never') {
    patch.tooltip = data.displayMarkerTooltips;
    imported.push('tooltip');
  }

  return Object.keys(patch).length === 0 ? undefined : patch;
}

function importMarkerType(entry: unknown, warnings: string[]): MarkerTypeDefinition | undefined {
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return undefined;
  const record = entry as Record<string, unknown>;
  const id = typeof record.name === 'string' ? record.name.trim() : '';
  if (!id) return undefined;

  const symbol = resolvePortableSymbol(record.iconName, id);
  if (symbol === undefined) {
    warnings.push(
      `The marker type "${id}" uses an icon this plugin cannot translate to a portable symbol. It keeps the default marker visual; set a symbol or image in settings to change it.`,
    );
  }

  const color = typeof record.color === 'string' && record.color.trim() ? record.color.trim() : undefined;
  const tags = readTags(record.tags);
  const minZoom = finiteNumber(record.minZoom);
  const maxZoom = finiteNumber(record.maxZoom);

  return {
    id,
    ...(symbol === undefined ? {} : { icon: { kind: 'symbol' as const, value: symbol } }),
    ...(color === undefined ? {} : { color }),
    ...(tags === undefined ? {} : { tags }),
    ...(minZoom === undefined ? {} : { minZoom }),
    ...(maxZoom === undefined ? {} : { maxZoom }),
  };
}

function resolvePortableSymbol(iconName: unknown, typeId: string): string | undefined {
  const fromIcon = typeof iconName === 'string' ? ICON_SYMBOLS[iconName.trim().toLowerCase()] : undefined;
  if (fromIcon) return fromIcon;
  // Older saved data recorded only the type name, so the observed `mapmarker`
  // values are matched directly when the icon name is absent.
  return typeof iconName === 'string' && iconName.trim()
    ? undefined
    : ICON_SYMBOLS[typeId.trim().toLowerCase()];
}

function readLegacyCenter(data: Record<string, unknown>): [number, number] | undefined {
  const lat = finiteNumber(data.lat);
  const long = finiteNumber(data.long);
  if (lat === undefined || long === undefined) return undefined;
  if (lat < -90 || lat > 90 || long < -180 || long > 180) return undefined;
  return [lat, long];
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}
