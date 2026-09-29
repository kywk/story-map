import {
  DEFAULT_MARKER_TYPE_ID,
  DEFAULT_TILE_ATTRIBUTION,
  DEFAULT_TILE_URL,
} from './types.js';
import type {
  GeoMarker,
  MarkerTooltipDisplay,
  MarkerTypeDefinition,
  MarkerZoomRange,
  StoryInitialSlide,
  StoryLocation,
  StoryMapLayoutMode,
  StoryMapOptions,
  StoryMedia,
  StoryNoteDisplay,
  StoryOrder,
  StorySlide,
  TileSource,
  TileSourceInput,
  TileSources,
} from './types.js';

export function parseWikiLinkRef(value: string): string {
  let ref = value.trim();
  if (ref.startsWith('!')) ref = ref.slice(1).trim();
  if (ref.startsWith('[[') && ref.endsWith(']]')) {
    ref = ref.slice(2, -2);
  }
  ref = ref.split('|', 1)[0] ?? ref;
  ref = ref.split('#', 1)[0] ?? ref;
  return ref.trim();
}

export function stripFrontmatter(markdown: string): string {
  const match = /^\uFEFF?---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/.exec(markdown);
  return match ? markdown.slice(match[0].length) : markdown;
}

export function coerceLocation(value: unknown, zoom?: unknown): StoryLocation | undefined {
  const parsedZoom = typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : undefined;

  if (Array.isArray(value) && value.length >= 2) {
    const lat = Number(value[0]);
    const lng = Number(value[1]);
    if (validCoordinates(lat, lng)) {
      return { lat, lng, ...(parsedZoom === undefined ? {} : { zoom: parsedZoom }) };
    }
  }

  if (typeof value === 'string') {
    const parts = value.split(',').map((part) => Number(part.trim()));
    if (parts.length >= 2 && validCoordinates(parts[0]!, parts[1]!)) {
      return {
        lat: parts[0]!,
        lng: parts[1]!,
        ...(parsedZoom === undefined ? {} : { zoom: parsedZoom }),
      };
    }
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const lat = Number(record.lat ?? record.latitude);
    const lng = Number(record.lng ?? record.long ?? record.longitude);
    const objectZoom = Number(record.zoom);
    if (validCoordinates(lat, lng)) {
      const finalZoom = Number.isFinite(objectZoom) ? objectZoom : parsedZoom;
      return { lat, lng, ...(finalZoom === undefined ? {} : { zoom: finalZoom }) };
    }
  }

  return undefined;
}

export function coerceMedia(value: unknown): StoryMedia | undefined {
  if (typeof value === 'string' && value.trim()) {
    return { type: 'image', src: value.trim() };
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.src !== 'string' || !record.src.trim()) return undefined;
    const type = record.type === 'video' || record.type === 'iframe' ? record.type : 'image';
    return {
      type,
      src: record.src,
      ...(typeof record.alt === 'string' ? { alt: record.alt } : {}),
      ...(typeof record.caption === 'string' ? { caption: record.caption } : {}),
    };
  }

  return undefined;
}

/**
 * Coerce a repeated/comma/whitespace separated scalar list. This is the
 * tag-list rule (`includeTags: a, b`, `markerTag: a b`): whitespace separates
 * entries. It is wrong for anything path-shaped - see `coercePathList`.
 * Returns `undefined` for an absent or empty list.
 */
export function coerceStringList(value: unknown): string[] | undefined {
  return coerceList(value, /[,\s]+/);
}

/**
 * Coerce a repeated/comma separated list of paths, URLs, or folders. `leaflet`
 * content writes `markerFolder: backpacker/2509 Chile/Chile`, so whitespace is
 * part of the value and only a comma separates entries. An array, a repeated key,
 * and a comma-separated string all normalize to the same list.
 */
export function coercePathList(value: unknown): string[] | undefined {
  return coerceList(value, /,/);
}

function coerceList(value: unknown, separator: RegExp): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return [String(value)];

  if (typeof value === 'string') {
    const items = value.split(separator).map((item) => item.trim()).filter(Boolean);
    return items.length > 0 ? items : undefined;
  }

  if (Array.isArray(value)) {
    const items: string[] = [];
    for (const entry of value) {
      if (typeof entry === 'number' && Number.isFinite(entry)) items.push(String(entry));
      else if (typeof entry === 'string') items.push(...entry.split(separator));
    }
    const cleaned = items.map((item) => item.trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned : undefined;
  }

  return undefined;
}

export function mergeResolvedSlide(base: StorySlide, resolved: Partial<StorySlide>): StorySlide {
  const merged: StorySlide = { ...resolved, ...base };
  const location = base.location ?? resolved.location;
  const media = base.media ?? resolved.media;

  if (location) merged.location = location;
  else delete merged.location;

  if (media) merged.media = media;
  else delete merged.media;

  return merged;
}

export function validCoordinates(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

/**
 * Note display mode after layout is taken into account. The `full` layout always
 * shows the complete note body, so it resolves notes with `full` semantics no
 * matter which `noteDisplay` the document configured. Every other mode keeps the
 * configured value, including `timeline`, which renders compact entries.
 */
export function effectiveNoteDisplay(
  layoutMode: StoryMapLayoutMode,
  noteDisplay: StoryNoteDisplay,
): StoryNoteDisplay {
  return layoutMode === 'full' ? 'full' : noteDisplay;
}

/**
 * Frontmatter contribution for full-text slides. The slide shows the note body as-is,
 * so frontmatter-derived display fields (title, text, media, date) are dropped and
 * never duplicate body content; only the map location (plus the marker hint) survives.
 * Fields the story document set explicitly are merged back by the caller.
 *
 * A `timeline` row is a list entry, not a full-screen body, so a timeline that
 * resolves notes as `full` deliberately keeps the frontmatter basics next to the
 * body. Both adapters gate on `noteDisplay === 'full' && layoutMode !== 'timeline'`;
 * the trade-off is that a timeline row can then show a title and cover that the body
 * also mentions.
 */
export function locationOnlySlide(resolved: Partial<StorySlide>): Partial<StorySlide> {
  const out: Partial<StorySlide> = {};
  if (resolved.location) out.location = resolved.location;
  if (resolved.mapmarker !== undefined) out.mapmarker = resolved.mapmarker;
  return out;
}

/**
 * The note frontmatter both dialects read. `storymap/v1` turns it into a
 * `StorySlide` and the `leaflet` dialect into a `GeoMarker`, so the coordinates,
 * title, description, marker name, and `mapzoom` range are extracted once here and
 * never re-implemented per dialect.
 */
export interface NoteFrontmatter {
  title?: string;
  description?: string;
  location?: StoryLocation;
  media?: StoryMedia;
  mapmarker?: string;
  mapzoom?: MarkerZoomRange;
  tags: string[];
}

export function extractNoteFrontmatter(
  frontmatter: Record<string, unknown>,
  fallbackTitle?: string,
): NoteFrontmatter {
  const location = coerceLocation(frontmatter.location, frontmatter.zoom ?? frontmatter.defaultZoom);
  const media = coerceMedia(frontmatter.cover ?? frontmatter.image ?? frontmatter.media);
  const title =
    typeof frontmatter.title === 'string' && frontmatter.title.trim()
      ? frontmatter.title
      : fallbackTitle;
  const description =
    typeof frontmatter.description === 'string'
      ? frontmatter.description
      : typeof frontmatter.summary === 'string'
        ? frontmatter.summary
        : undefined;
  const mapmarker = typeof frontmatter.mapmarker === 'string' ? frontmatter.mapmarker : undefined;
  const mapzoom = coerceMapZoom(frontmatter.mapzoom);

  return {
    ...(title ? { title } : {}),
    ...(description !== undefined ? { description } : {}),
    ...(location ? { location } : {}),
    ...(media ? { media } : {}),
    ...(mapmarker !== undefined ? { mapmarker } : {}),
    ...(mapzoom ? { mapzoom } : {}),
    tags: extractFrontmatterTags(frontmatter),
  };
}

export function slideFromNoteFrontmatter(
  frontmatter: Record<string, unknown>,
  fallbackTitle?: string,
): Partial<StorySlide> {
  const note = extractNoteFrontmatter(frontmatter, fallbackTitle);

  return {
    ...(note.title ? { title: note.title } : {}),
    ...(note.description !== undefined ? { text: note.description } : {}),
    ...(note.location ? { location: note.location } : {}),
    ...(note.media ? { media: note.media } : {}),
    ...(note.mapmarker !== undefined ? { mapmarker: note.mapmarker } : {}),
  };
}

/**
 * `mapzoom` is Leaflet-compatible note frontmatter that normalizes into marker
 * min/max zoom visibility. Tolerant forms: `[5, 18]`, `5`, `'5'`, `'5-18'`, and
 * `{ min: 5, max: 18 }`. A single value is a lower bound. An unparseable value is
 * ignored rather than thrown, because a marker without a visibility range is
 * better than a broken block.
 */
export function coerceMapZoom(value: unknown): MarkerZoomRange | undefined {
  const toNumber = (input: unknown): number | undefined => {
    if (typeof input === 'number') return Number.isFinite(input) ? input : undefined;
    if (typeof input === 'string' && input.trim()) {
      const parsed = Number(input.trim());
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };

  const range = (min: unknown, max: unknown): MarkerZoomRange | undefined => {
    const minZoom = toNumber(min);
    const maxZoom = toNumber(max);
    if (minZoom === undefined && maxZoom === undefined) return undefined;
    return {
      ...(minZoom === undefined ? {} : { minZoom }),
      ...(maxZoom === undefined ? {} : { maxZoom }),
    };
  };

  if (Array.isArray(value)) {
    return range(value[0], value[1]);
  }

  if (typeof value === 'string') {
    // `5-18` and `5 - 18` are historical spellings; only a digit/dash/digit pair is split.
    const normalized = value.trim().replace(/(\d)\s*-\s*(?=\d)/g, '$1,');
    const parts = normalized.split(/[,\s]+/).filter(Boolean);
    if (parts.length === 0) return undefined;
    if (parts.length === 1) return range(parts[0], undefined);
    return range(parts[0], parts[1]);
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return range(record.min ?? record.minZoom, record.max ?? record.maxZoom);
  }

  return range(value, undefined);
}

export interface MarkerTypeResolution {
  /** The resolved type id. An unknown authored name is preserved here. */
  type: string;
  /** The configured definition behind `type`, when one exists. */
  definition?: MarkerTypeDefinition;
  /** True when the authored type is not a configured type; the renderer falls back visually. */
  unknown: boolean;
  minZoom?: number;
  maxZoom?: number;
}

export interface ResolveMarkerTypeRequest {
  authoredType?: string | undefined;
  frontmatter?: Record<string, unknown> | undefined;
  types?: readonly MarkerTypeDefinition[] | undefined;
  defaultTypeId?: string | undefined;
}

function findMarkerType(
  types: readonly MarkerTypeDefinition[] | undefined,
  id: string,
): MarkerTypeDefinition | undefined {
  const wanted = id.trim().toLowerCase();
  return types?.find((type) => type.id.trim().toLowerCase() === wanted);
}

/**
 * Marker type precedence for a note-derived marker: explicit note `mapmarker`,
 * then the first configured type whose tags match the note, then the configured
 * default type, then the built-in generic default. An unknown authored type still
 * resolves so the marker renders, keeping the authored name for diagnostics.
 * A definition's own `minZoom` / `maxZoom` is folded into the resolution and
 * still yields to the note's `mapzoom`.
 */
export function resolveMarkerType(request: ResolveMarkerTypeRequest): MarkerTypeResolution {
  const types = request.types;
  const authored = request.authoredType?.trim();

  if (authored) {
    const definition = findMarkerType(types, authored);
    if (definition) return withTypeZoom({ type: definition.id, definition, unknown: false });
    return { type: authored, unknown: true };
  }

  const tags = new Set(extractFrontmatterTags(request.frontmatter ?? {}));
  if (tags.size > 0) {
    const matched = types?.find((type) =>
      (type.tags ?? []).some((tag) => {
        const normalized = normalizeTag(tag);
        return normalized !== '' && tags.has(normalized);
      }),
    );
    if (matched) return withTypeZoom({ type: matched.id, definition: matched, unknown: false });
  }

  const fallbackId = request.defaultTypeId?.trim();
  if (fallbackId) {
    const definition = findMarkerType(types, fallbackId);
    if (definition) return withTypeZoom({ type: definition.id, definition, unknown: false });
  }

  const builtIn = findMarkerType(types, DEFAULT_MARKER_TYPE_ID);
  if (builtIn) return withTypeZoom({ type: builtIn.id, definition: builtIn, unknown: false });
  return { type: DEFAULT_MARKER_TYPE_ID, unknown: false };
}

function withTypeZoom(resolution: MarkerTypeResolution): MarkerTypeResolution {
  const { minZoom, maxZoom } = resolution.definition ?? {};
  return {
    ...resolution,
    ...(minZoom === undefined ? {} : { minZoom }),
    ...(maxZoom === undefined ? {} : { maxZoom }),
  };
}

export interface MarkerFromNoteOptions {
  fallbackTitle?: string;
  notePath?: string;
  id?: string;
  types?: readonly MarkerTypeDefinition[] | undefined;
  defaultTypeId?: string | undefined;
  tooltip?: MarkerTooltipDisplay | undefined;
}

/**
 * Build a generic `GeoMarker` from the same frontmatter extraction the story
 * slide path uses. Returns `undefined` when the note has no valid `location`:
 * a note without coordinates is skipped, not fatal. The note's `mapzoom` bounds
 * win over the resolved type's own bounds; `frontmatter.zoom` is a story-slide
 * concern and is deliberately dropped here.
 */
export function markerFromNoteFrontmatter(
  frontmatter: Record<string, unknown>,
  options: MarkerFromNoteOptions = {},
): GeoMarker | undefined {
  const note = extractNoteFrontmatter(frontmatter, options.fallbackTitle);
  if (!note.location) return undefined;

  const resolved = resolveMarkerType({
    authoredType: note.mapmarker,
    frontmatter,
    types: options.types,
    defaultTypeId: options.defaultTypeId,
  });
  const minZoom = note.mapzoom?.minZoom ?? resolved.minZoom;
  const maxZoom = note.mapzoom?.maxZoom ?? resolved.maxZoom;

  return {
    location: { lat: note.location.lat, lng: note.location.lng },
    type: resolved.type,
    ...(options.id === undefined ? {} : { id: options.id }),
    ...(note.title ? { title: note.title } : {}),
    ...(note.description !== undefined ? { description: note.description } : {}),
    ...(options.notePath === undefined ? {} : { notePath: options.notePath }),
    ...(minZoom === undefined ? {} : { minZoom }),
    ...(maxZoom === undefined ? {} : { maxZoom }),
    ...(options.tooltip === undefined ? {} : { tooltip: options.tooltip }),
  };
}

/**
 * Canonical tile sources. `storymap/v1` keeps its published `map.tileUrl` /
 * `map.attribution` pair, so `tileSourcesFromStoryMap` normalizes it into `light`
 * and published 0.3.x/0.4.x consumers keep working against the shared renderer.
 * Attribution is never dropped: a source with no authored attribution still
 * renders the built-in OpenStreetMap notice.
 */
export function toTileSources(
  light?: TileSourceInput | null,
  dark?: TileSourceInput | null,
): TileSources {
  const lightSource = toTileSource(light, {
    url: DEFAULT_TILE_URL,
    attribution: DEFAULT_TILE_ATTRIBUTION,
  });
  if (!dark) return { light: lightSource };
  return { light: lightSource, dark: toTileSource(dark, lightSource) };
}

export function tileSourcesFromStoryMap(
  map: Pick<StoryMapOptions, 'tileUrl' | 'attribution'>,
  dark?: TileSourceInput | null,
): TileSources {
  return toTileSources(
    { url: map.tileUrl, attribution: map.attribution },
    dark,
  );
}

function toTileSource(input: TileSourceInput | null | undefined, fallback: TileSource): TileSource {
  return {
    url: input?.url ?? fallback.url,
    attribution: input?.attribution ?? fallback.attribution,
    ...(input?.subdomains === undefined ? {} : { subdomains: input.subdomains }),
    ...(input?.minZoom === undefined ? {} : { minZoom: input.minZoom }),
    ...(input?.maxZoom === undefined ? {} : { maxZoom: input.maxZoom }),
  };
}

export interface NoteDateInfo {
  path: string;
  date: number | null;
}

export function toTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isNaN(time) ? null : time;
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
}

export function compareNoteDates(a: NoteDateInfo, b: NoteDateInfo, order: StoryOrder): number {
  const aValid = a.date !== null;
  const bValid = b.date !== null;

  if (aValid && !bValid) return -1;
  if (!aValid && bValid) return 1;

  if (aValid && bValid && a.date !== b.date) {
    return order === 'asc' ? a.date! - b.date! : b.date! - a.date!;
  }

  if (a.path === b.path) return 0;
  return a.path < b.path ? -1 : 1;
}

export function sortNoteDates<T extends NoteDateInfo>(notes: T[], order: StoryOrder): T[] {
  return [...notes].sort((a, b) => compareNoteDates(a, b, order));
}

export function normalizeVaultFolder(folder: string): string {
  return folder
    .replace(/\\/g, '/')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '');
}

export function isPathInFolder(filePath: string, folder: string): boolean {
  const normalizedFolder = normalizeVaultFolder(folder);
  const normalizedFile = filePath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalizedFolder) return true;
  return normalizedFile.startsWith(`${normalizedFolder}/`);
}

export function normalizeTag(value: string): string {
  return value.trim().replace(/^#+/, '').toLowerCase();
}

export function extractFrontmatterTags(frontmatter: Record<string, unknown>): string[] {
  const collected: string[] = [];

  for (const raw of [frontmatter.tags, frontmatter.tag]) {
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string') collected.push(...item.split(/[,\s]+/));
      }
    } else if (typeof raw === 'string') {
      collected.push(...raw.split(/[,\s]+/));
    }
  }

  const tags = new Set<string>();
  for (const token of collected) {
    const tag = normalizeTag(token);
    if (tag) tags.add(tag);
  }
  return [...tags];
}

export function matchesTagFilter(
  frontmatter: Record<string, unknown>,
  includeTags?: readonly string[],
  excludeTags?: readonly string[],
): boolean {
  const include = normalizeTagList(includeTags);
  const exclude = normalizeTagList(excludeTags);
  if (include.length === 0 && exclude.length === 0) return true;

  const tags = new Set(extractFrontmatterTags(frontmatter));
  if (exclude.some((tag) => tags.has(tag))) return false;
  if (include.length > 0 && !include.some((tag) => tags.has(tag))) return false;
  return true;
}

function normalizeTagList(values?: readonly string[]): string[] {
  const tags = new Set<string>();
  for (const value of values ?? []) {
    const tag = normalizeTag(value);
    if (tag) tags.add(tag);
  }
  return [...tags];
}

export function resolveInitialSlideIndex(
  initialSlide: StoryInitialSlide | undefined,
  slideCount: number,
): number {
  if (slideCount <= 0) return 0;
  if (initialSlide === 'last') return slideCount - 1;
  if (typeof initialSlide === 'number') {
    return Math.max(0, Math.min(initialSlide, slideCount - 1));
  }
  return 0;
}
