import { load } from 'js-yaml';
import { coercePathList, coerceStringList, toTileSources, validCoordinates } from './helpers.js';
import { StoryMapParseError } from './parser.js';
import {
  DEFAULT_LEAFLET_HEIGHT,
  DEFAULT_LEAFLET_ZOOM,
  DEFAULT_MAP_THEME,
} from './types.js';
import type {
  GeoMapConfig,
  GeoMapDiagnostic,
  GeoMapOptions,
  GeoMarker,
  LeafletPendingKeys,
  LeafletSourceConfig,
  LeafletSourceDefaults,
  LatLngTuple,
} from './types.js';

/**
 * Raised for a `leaflet` block this package cannot read as configuration. It
 * extends `StoryMapParseError` on purpose: both dialects fail the same way, so a
 * host catches one error type for a malformed block of either language, while
 * `name` still tells the two apart in a message.
 */
export class LeafletParseError extends StoryMapParseError {
  constructor(message: string) {
    super(message);
    this.name = 'LeafletParseError';
  }
}

/**
 * Diagnostic codes emitted by the `leaflet` parser. They are stable so a host can
 * filter or localize them. Unknown-key diagnostics are deliberately a separate
 * code from the recognized-but-deferred ones: a typo and a scheduled feature are
 * different problems for the author.
 */
export const LEAFLET_DIAGNOSTIC_CODES = {
  /** Recognized, parsed, carried, not implemented yet (P1 static maps). */
  pendingP1: 'leaflet-pending-p1',
  /** Recognized file/layer key, not implemented yet (P2). */
  pendingP2: 'leaflet-pending-p2',
  /** Recognized specialized/image/measurement key, not implemented yet (P3). */
  pendingP3: 'leaflet-pending-p3',
  /** Recognized, intentionally not cloned as portable map behavior. */
  rejected: 'leaflet-rejected-key',
  /** Not a known `leaflet` key at all. */
  unknownKey: 'leaflet-unknown-key',
  /** Accepted compatibility metadata (measurement/image keys) with no effect yet. */
  compatMetadata: 'leaflet-compat-metadata',
  /** Accepted compatibility flag (light/dark tiles) with no effect yet. */
  compatFlag: 'leaflet-compat-flag',
  /** A recognized key whose value could not be coerced; the default is used. */
  invalidValue: 'leaflet-invalid-value',
} as const;

type LeafletPendingPhase = 'P1' | 'P2' | 'P3' | 'reject';

const PHASE_CODES = {
  P1: LEAFLET_DIAGNOSTIC_CODES.pendingP1,
  P2: LEAFLET_DIAGNOSTIC_CODES.pendingP2,
  P3: LEAFLET_DIAGNOSTIC_CODES.pendingP3,
  reject: LEAFLET_DIAGNOSTIC_CODES.rejected,
} as const;

/**
 * The `leaflet` dialect never enters the `storymap/v1` Zod schema, so this table
 * is the compatibility matrix in code form. It is the single source for both the
 * "recognized" test and the reported phase, which keeps the promise that an
 * unsupported key is always reported from going stale.
 */
const LEAFLET_PENDING_KEYS: Record<string, LeafletPendingPhase> = {
  // P1 - common static-map behavior.
  width: 'P1',
  markerFile: 'P1',
  marker: 'P1',
  markerTag: 'P1',
  filterTag: 'P1',
  linksTo: 'P1',
  linksFrom: 'P1',
  tileServer: 'P1',
  tileSubdomains: 'P1',
  osmLayer: 'P1',
  noUI: 'P1',
  noScrollZoom: 'P1',
  recenter: 'P1',
  lock: 'P1',
  verbose: 'P1',
  // P2 - file and overlay layers.
  geojson: 'P2',
  geojsonFolder: 'P2',
  geojsonColor: 'P2',
  gpx: 'P2',
  gpxFolder: 'P2',
  gpxColor: 'P2',
  gpxMarkers: 'P2',
  tileOverlay: 'P2',
  imageOverlay: 'P2',
  overlay: 'P2',
  overlayTag: 'P2',
  overlayColor: 'P2',
  showAllMarkers: 'P2',
  zoomFeatures: 'P2',
  mapmarkers: 'P2',
  mapoverlay: 'P2',
  // P3 - image maps, measurement, drawing.
  image: 'P3',
  layers: 'P3',
  bounds: 'P3',
  coordinates: 'P3',
  preserveAspect: 'P3',
  draw: 'P3',
  drawColor: 'P3',
  distanceMultiplier: 'P3',
  // Not portable: host concerns or dropped.
  commandMarker: 'reject',
  isMapView: 'reject',
  isInitiativeView: 'reject',
};

/** P0 keys are consumed by the normalizer; the rest fall through to the table. */
const LEAFLET_HANDLED_KEYS: ReadonlySet<string> = new Set([
  'id',
  'height',
  'lat',
  'long',
  'lng',
  'defaultZoom',
  'minZoom',
  'maxZoom',
  'zoomDelta',
  'markerFolder',
  'unit',
  'scale',
  'darkMode',
]);

/**
 * Keys the historical dialect allowed to repeat. Only these are grouped by the
 * pre-pass, so a duplicated singleton key stays a plain YAML duplicate-key error
 * instead of being silently reinterpreted as a list.
 */
export const LEAFLET_REPEATABLE_KEYS: ReadonlySet<string> = new Set([
  'markerFolder',
  'markerFile',
  'marker',
  'markerTag',
  'filterTag',
  'linksTo',
  'linksFrom',
  'tileServer',
  'tileSubdomains',
  'geojson',
  'geojsonFolder',
  'gpx',
  'gpxFolder',
  'imageOverlay',
  'overlay',
  'image',
  'layers',
  'commandMarker',
]);

/**
 * Parse a `leaflet` fenced block body. Marker and Vault resolution stays in the
 * adapters: this returns the normalized source plus the diagnostics that name
 * which recognized keys are still waiting for a phase.
 */
export function parseLeafletSourceYaml(
  source: string,
  defaults?: LeafletSourceDefaults,
): LeafletSourceConfig {
  // js-yaml rejects a document with no content, and an empty fence is a legal
  // (if pointless) block that should read as "all defaults".
  if (isDocumentless(source)) return normalizeLeafletSource({}, defaults);
  return parseLeafletSourceObject(load(groupRepeatedTopLevelKeys(source)), defaults);
}

/** True for an empty or comment-only block, which carries no YAML document. */
function isDocumentless(source: string): boolean {
  return source
    .split('\n')
    .every((line) => line.trim() === '' || line.trimStart().startsWith('#'));
}

/**
 * Same normalization for an already-loaded value. Historical repeated keys are a
 * source-text concern, so a host that loads YAML itself can only offer the
 * collapsed form here.
 */
export function parseLeafletSourceObject(
  value: unknown,
  defaults?: LeafletSourceDefaults,
): LeafletSourceConfig {
  if (value !== undefined && value !== null && !isPlainRecord(value)) {
    throw new LeafletParseError('Leaflet block configuration must be a mapping of keys.');
  }
  return normalizeLeafletSource(asRecord(value), defaults);
}

/**
 * Finalize a parsed source into renderer input. Adapters call this after turning
 * resolved notes into markers; core never lists files, so the marker list is an
 * argument. An authored `id` is passed through untouched - it may repeat across
 * maps on one page, and host instance identity is a separate concern.
 */
export function toGeoMapConfig(
  source: LeafletSourceConfig,
  markers: GeoMarker[],
): GeoMapConfig {
  return {
    schema: 'geomap/v1',
    height: source.height,
    map: source.map,
    markers,
    ...(source.id === undefined ? {} : { id: source.id }),
    ...(source.diagnostics.length === 0 ? {} : { diagnostics: [...source.diagnostics] }),
  };
}

/**
 * Group repeated top-level keys into one flow sequence, so plain YAML can carry
 * the historical `markerFolder: A` / `markerFolder: B` form that otherwise fails
 * to load with "duplicated mapping key".
 *
 * It is deliberately a narrow, line-oriented pre-pass for the flat `leaflet`
 * blocks it must read:
 *
 * - only top-level keys are grouped, so a repeated key inside a nested mapping
 *   still raises the normal YAML duplicate-key error;
 * - the rewrite keeps every other line byte-identical and turns the extra
 *   occurrences into comment lines, so line numbers in later errors still match
 *   the authored block;
 * - a value that is empty, a block scalar (`|`, `>`), a flow collection, or only
 *   a trailing comment is not regrouped, and block-scalar bodies are skipped
 *   entirely, so content that merely looks like a key is never touched.
 */
export function groupRepeatedTopLevelKeys(
  source: string,
  repeatable: ReadonlySet<string> = LEAFLET_REPEATABLE_KEYS,
): string {
  const lines = source.split('\n');
  const groups = new Map<string, { first: number; values: string[]; rest: number[]; comment: string }>();
  let blockIndent: number | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (line.trim() === '') continue;

    const indent = indentOf(line);
    if (blockIndent !== null) {
      if (indent > blockIndent) continue;
      blockIndent = null;
    }

    const match = KEY_LINE.exec(line);
    if (!match) continue;

    const key = match[2] ?? '';
    const value = (match[3] ?? '').trimStart();

    if (value.startsWith('|') || value.startsWith('>')) {
      blockIndent = match[1]?.length ?? indent;
      continue;
    }
    if (indent !== 0 || !repeatable.has(key)) continue;

    const { value: scalar, comment } = splitInlineComment(value);
    if (scalar === '' || scalar.startsWith('[') || scalar.startsWith('{')) continue;

    const group = groups.get(key);
    if (group) {
      group.values.push(scalar);
      group.rest.push(index);
    } else {
      groups.set(key, { first: index, values: [scalar], rest: [], comment });
    }
  }

  let rewrote = false;
  for (const [key, group] of groups) {
    if (group.rest.length === 0) continue;
    rewrote = true;
    for (const index of group.rest) lines[index] = '#';
    // The first occurrence keeps its trailing comment; later ones cannot keep
    // theirs without corrupting the sequence, so only the first is carried over.
    const comment = group.comment === '' ? '' : ` ${group.comment}`;
    lines[group.first] = `${key}: [${group.values.join(', ')}]${comment}`;
  }

  return rewrote ? lines.join('\n') : source;
}

const KEY_LINE = /^(\s*)([A-Za-z_$][A-Za-z0-9_$.-]*)[ \t]*:(.*)$/;

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

/**
 * Split a trailing YAML comment off a value, ignoring `#` inside single or double
 * quotes so `"a: b # c"` stays one value.
 */
function splitInlineComment(value: string): { value: string; comment: string } {
  let quote: string | null = null;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (quote) {
      if (char === '\\' && quote === '"') {
        index += 1;
        continue;
      }
      if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === '#' && (index === 0 || /\s/.test(value[index - 1] ?? ''))) {
      return { value: value.slice(0, index).trim(), comment: value.slice(index).trim() };
    }
  }

  return { value: value.trim(), comment: '' };
}

function normalizeLeafletSource(
  input: Record<string, unknown>,
  defaults?: LeafletSourceDefaults,
): LeafletSourceConfig {
  const diagnostics: GeoMapDiagnostic[] = [];
  const pending: LeafletPendingKeys = {};
  const deferred: Record<string, unknown> = {};

  const id = readString(input.id, diagnostics, 'id');
  const height = readHeight(input.height, diagnostics, defaults);
  const center = readCenter(input, defaults);
  const zoom = readNumber(input.defaultZoom, diagnostics, 'defaultZoom')
    ?? defaults?.zoom
    ?? DEFAULT_LEAFLET_ZOOM;
  const minZoom = readNumber(input.minZoom, diagnostics, 'minZoom') ?? defaults?.minZoom;
  const maxZoom = readNumber(input.maxZoom, diagnostics, 'maxZoom') ?? defaults?.maxZoom;
  const zoomDelta = readNumber(input.zoomDelta, diagnostics, 'zoomDelta') ?? defaults?.zoomDelta;
  const markerFolder = coercePathList(input.markerFolder) ?? [];

  // P0 compatibility metadata: accepted, kept, and reported as unimplemented.
  // `unit`/`scale` belong to measurement and image-map transforms (P3), so they
  // are metadata here - never a parse failure and never a silent no-op.
  const unit = readString(input.unit, diagnostics, 'unit');
  if (unit !== undefined) {
    pending.unit = unit;
    diagnostics.push(
      warning(
        LEAFLET_DIAGNOSTIC_CODES.compatMetadata,
        'unit',
        '`unit` is kept as compatibility metadata; measurement support is not implemented yet (P3).',
      ),
    );
  }

  const scale = readNumber(input.scale, diagnostics, 'scale');
  if (scale !== undefined) {
    pending.scale = scale;
    diagnostics.push(
      warning(
        LEAFLET_DIAGNOSTIC_CODES.compatMetadata,
        'scale',
        '`scale` is kept as compatibility metadata; image-map and measurement transforms are not implemented yet (P3).',
      ),
    );
  }

  const darkMode = readBoolean(input.darkMode, diagnostics, 'darkMode');
  if (darkMode !== undefined) {
    pending.darkMode = darkMode;
    // Tile provider and theme are orthogonal, so this flag never rewrites either.
    diagnostics.push(
      warning(
        LEAFLET_DIAGNOSTIC_CODES.compatFlag,
        'darkMode',
        '`darkMode` is parsed for compatibility, but dynamic light/dark tile switching is not wired yet; the theme and tile source stay as configured.',
      ),
    );
  }

  for (const [key, value] of Object.entries(input)) {
    if (LEAFLET_HANDLED_KEYS.has(key)) continue;
    const phase = LEAFLET_PENDING_KEYS[key];
    if (!phase) {
      diagnostics.push(
        warning(
          LEAFLET_DIAGNOSTIC_CODES.unknownKey,
          key,
          `\`${key}\` is not a recognized \`leaflet\` key and was ignored.`,
        ),
      );
      continue;
    }
    if (phase === 'reject') {
      diagnostics.push(
        warning(
          LEAFLET_DIAGNOSTIC_CODES.rejected,
          key,
          `\`${key}\` is historical host state and is not part of the portable map model.`,
        ),
      );
      continue;
    }
    if (phase === 'P1') carryPendingKey(key, value, pending, diagnostics);
    else deferred[key] = value;
    diagnostics.push(
      warning(PHASE_CODES[phase], key, `\`${key}\` is recognized but not implemented yet (${phase}).`),
    );
  }

  // `zoomDelta` is a canonical map field, so it normalizes into the map and is
  // still reported as pending until the renderer honors the zoom step (P1).
  if (zoomDelta !== undefined) {
    diagnostics.push(
      warning(
        LEAFLET_DIAGNOSTIC_CODES.pendingP1,
        'zoomDelta',
        '`zoomDelta` is normalized into the map, but the rendered zoom step is not implemented yet (P1).',
      ),
    );
  }

  const map: GeoMapOptions = {
    zoom,
    theme: defaults?.theme ?? DEFAULT_MAP_THEME,
    tiles: toTileSources(
      {
        url: defaults?.tileUrl,
        attribution: defaults?.attribution,
        subdomains: defaults?.tileSubdomains,
      },
      defaults?.darkTileUrl === undefined && defaults?.darkAttribution === undefined
        ? undefined
        : {
            url: defaults?.darkTileUrl,
            attribution: defaults?.darkAttribution,
            subdomains: defaults?.darkTileSubdomains,
          },
    ),
    ...(center === undefined ? {} : { center }),
    ...(minZoom === undefined ? {} : { minZoom }),
    ...(maxZoom === undefined ? {} : { maxZoom }),
    ...(zoomDelta === undefined ? {} : { zoomDelta }),
  };

  return {
    schema: 'leaflet/v1',
    height,
    map,
    markerFolder,
    pending,
    deferred,
    diagnostics,
    ...(id === undefined ? {} : { id }),
  };
}

function carryPendingKey(
  key: string,
  value: unknown,
  pending: LeafletPendingKeys,
  diagnostics: GeoMapDiagnostic[],
): void {
  // Tags separate on whitespace as well as commas; paths and URLs only on commas.
  const tagKeys = ['markerTag', 'filterTag'] as const;
  const pathKeys = [
    'markerFile',
    'linksTo',
    'linksFrom',
    'tileServer',
    'tileSubdomains',
  ] as const;

  if ((tagKeys as readonly string[]).includes(key)) {
    const list = coerceStringList(value);
    if (list === undefined) return;
    if (key === 'markerTag') pending.markerTag = list;
    else pending.filterTag = list;
    return;
  }

  if ((pathKeys as readonly string[]).includes(key)) {
    const list = coercePathList(value);
    if (list === undefined) return;
    switch (key) {
      case 'markerFile':
        pending.markerFile = list;
        return;
      case 'linksTo':
        pending.linksTo = list;
        return;
      case 'linksFrom':
        pending.linksFrom = list;
        return;
      case 'tileServer':
        pending.tileServer = list;
        return;
      default:
        pending.tileSubdomains = list;
    }
    return;
  }

  switch (key) {
    case 'width': {
      const width = readString(value, diagnostics, 'width');
      if (width !== undefined) pending.width = width;
      return;
    }
    case 'noUI':
    case 'noScrollZoom':
    case 'recenter':
    case 'verbose':
    case 'osmLayer': {
      const flag = readBoolean(value, diagnostics, key);
      if (flag === undefined) return;
      if (key === 'noUI') pending.noUI = flag;
      else if (key === 'noScrollZoom') pending.noScrollZoom = flag;
      else if (key === 'recenter') pending.recenter = flag;
      else if (key === 'verbose') pending.verbose = flag;
      else pending.osmLayer = flag;
      return;
    }
    case 'marker': {
      if (Array.isArray(value)) pending.marker = value;
      else if (value !== undefined) pending.marker = [value];
      return;
    }
    case 'lock': {
      pending.lock = value;
      return;
    }
    default:
  }
}

function readHeight(
  value: unknown,
  diagnostics: GeoMapDiagnostic[],
  defaults?: LeafletSourceDefaults,
): string {
  const fallback = defaults?.height ?? DEFAULT_LEAFLET_HEIGHT;
  if (value === undefined || value === null) return fallback;
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
  const height = readString(value, undefined, 'height');
  if (height !== undefined) return height;
  diagnostics.push(invalidValue('height', value, 'Expected a CSS length such as `600px`.'));
  return fallback;
}

function readCenter(
  input: Record<string, unknown>,
  defaults?: LeafletSourceDefaults,
): LatLngTuple | undefined {
  const hasLat = input.lat !== undefined;
  const hasLng = input.long !== undefined || input.lng !== undefined;

  if (hasLat || hasLng) {
    if (!hasLat || !hasLng) throw invalidCoordinates();
    const lat = Number(input.lat);
    const lng = Number(input.long ?? input.lng);
    if (!validCoordinates(lat, lng)) throw invalidCoordinates();
    return [lat, lng];
  }

  return defaults?.center;
}

function invalidCoordinates(): LeafletParseError {
  // The same wording and error family as the `storymap/v1` root-coordinate check,
  // so one host catch covers both dialects.
  return new LeafletParseError(
    'Root coordinates are invalid. Provide both lat and long (or lng) within valid ranges.',
  );
}

function readString(
  value: unknown,
  diagnostics: GeoMapDiagnostic[] | undefined,
  key: string,
): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return undefined;
    return trimmed;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (diagnostics) diagnostics.push(invalidValue(key, value, 'Expected a string.'));
  return undefined;
}

function readNumber(
  value: unknown,
  diagnostics: GeoMapDiagnostic[] | undefined,
  key: string,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'boolean') {
    if (diagnostics) diagnostics.push(invalidValue(key, value, 'Expected a number.'));
    return undefined;
  }
  const parsed = typeof value === 'number' ? value : Number(typeof value === 'string' ? value.trim() : NaN);
  if (Number.isFinite(parsed)) return parsed;
  if (diagnostics) diagnostics.push(invalidValue(key, value, 'Expected a number.'));
  return undefined;
}

function readBoolean(
  value: unknown,
  diagnostics: GeoMapDiagnostic[] | undefined,
  key: string,
): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  const flag = toBoolean(value);
  if (flag === undefined) {
    if (diagnostics) diagnostics.push(invalidValue(key, value, 'Expected a boolean.'));
    return undefined;
  }
  return flag;
}

function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'on', '1'].includes(normalized)) return true;
    if (['false', 'no', 'off', '0'].includes(normalized)) return false;
  }
  return undefined;
}

function warning(code: string, key: string, message: string): GeoMapDiagnostic {
  return { level: 'warning', code, key, message };
}

function invalidValue(key: string, value: unknown, detail: string): GeoMapDiagnostic {
  return {
    level: 'error',
    code: LEAFLET_DIAGNOSTIC_CODES.invalidValue,
    key,
    message: `\`${key}\` is not usable: ${detail} (received ${describe(value)})`,
  };
}

function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return 'a list';
  if (value === null) return 'null';
  return typeof value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> {
  return isPlainRecord(value) ? value : {};
}
