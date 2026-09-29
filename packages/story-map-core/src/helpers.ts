import type {
  StoryInitialSlide,
  StoryLocation,
  StoryMapLayoutMode,
  StoryMedia,
  StoryNoteDisplay,
  StoryOrder,
  StorySlide,
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
 * matter which `noteDisplay` the document configured.
 */
export function effectiveNoteDisplay(
  layoutMode: StoryMapLayoutMode,
  noteDisplay: StoryNoteDisplay,
): StoryNoteDisplay {
  return layoutMode === 'full' ? 'full' : noteDisplay;
}

/**
 * Frontmatter contribution for full-text slides. The slide shows the note body as-is,
 * so frontmatter-derived display fields (title, text, media) are dropped and never
 * duplicate body content; only the map location (plus the marker hint) survives.
 * Fields the story document set explicitly are merged back by the caller.
 */
export function locationOnlySlide(resolved: Partial<StorySlide>): Partial<StorySlide> {
  const out: Partial<StorySlide> = {};
  if (resolved.location) out.location = resolved.location;
  if (resolved.mapmarker !== undefined) out.mapmarker = resolved.mapmarker;
  return out;
}

export function slideFromNoteFrontmatter(
  frontmatter: Record<string, unknown>,
  fallbackTitle?: string,
): Partial<StorySlide> {
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

  return {
    ...(title ? { title } : {}),
    ...(description !== undefined ? { text: description } : {}),
    ...(location ? { location } : {}),
    ...(media ? { media } : {}),
    ...(typeof frontmatter.mapmarker === 'string' ? { mapmarker: frontmatter.mapmarker } : {}),
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
