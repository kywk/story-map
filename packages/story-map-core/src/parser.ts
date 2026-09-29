import { load } from 'js-yaml';
import { storyMapSchema, storyMapSourceSchema } from './schema.js';
import {
  coerceLocation,
  coerceMedia,
  resolveInitialSlideIndex,
  toTimestamp,
  validCoordinates,
} from './helpers.js';
import type {
  StoryMapConfig,
  StoryMapSourceConfig,
  StoryMapSourceDefaults,
  StorySlide,
} from './types.js';

export class StoryMapParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StoryMapParseError';
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeSlide(value: unknown, index: number): Record<string, unknown> {
  const slide = { ...asRecord(value) };
  const hasLocation = slide.location !== undefined;
  const location = coerceLocation(slide.location, slide.zoom);
  const media = coerceMedia(slide.media);
  const hasDate = slide.date !== undefined;
  const date = hasDate ? toTimestamp(slide.date) : null;

  if (hasLocation && !location) {
    throw new StoryMapParseError(
      `slides[${index}].location is not a valid [lat, lng] coordinate pair.`,
    );
  }

  if (hasDate && date === null) {
    throw new StoryMapParseError(`slides[${index}].date is not a parseable date.`);
  }

  if (location) slide.location = location;
  if (media) slide.media = media;
  if (date !== null) slide.date = date;
  else delete slide.date;
  delete slide.zoom;

  return slide;
}

function coerceTagList(value: string): string[] | undefined {
  const tags = value
    .split(/[,\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  return tags.length > 0 ? tags : undefined;
}

export function normalizeStoryMapInput(value: unknown): unknown {
  const input = { ...asRecord(value) };
  const map = { ...asRecord(input.map) };

  const hasLat = input.lat !== undefined;
  const hasLng = input.long !== undefined || input.lng !== undefined;

  if (hasLat || hasLng) {
    const lat = Number(input.lat);
    const lng = Number(input.long ?? input.lng);
    if (!hasLat || !hasLng || !validCoordinates(lat, lng)) {
      throw new StoryMapParseError(
        'Root coordinates are invalid. Provide both lat and long (or lng) within valid ranges.',
      );
    }
    if (!map.center) map.center = [lat, lng];
  }

  if (map.zoom === undefined && input.defaultZoom !== undefined) map.zoom = Number(input.defaultZoom);
  if (map.tileUrl === undefined && input.tileServer !== undefined) map.tileUrl = input.tileServer;
  if (input.panelOpacity === undefined && input.opacity !== undefined) input.panelOpacity = input.opacity;
  if (input.panelOpacity === undefined && map.opacity !== undefined) input.panelOpacity = map.opacity;

  delete map.opacity;
  delete input.opacity;

  input.map = map;
  if (Array.isArray(input.slides)) {
    const rawSlides = input.slides;
    input.slides = rawSlides.map(normalizeSlide);
    if (input.initialSlide === 'first') {
      input.initialSlide = 0;
    } else if (input.initialSlide === 'last') {
      input.initialSlide = Math.max(0, rawSlides.length - 1);
    } else if (typeof input.initialSlide === 'string' && /^\d+$/.test(input.initialSlide.trim())) {
      input.initialSlide = parseInt(input.initialSlide.trim(), 10);
    }
  }
  if (typeof input.includeTags === 'string') input.includeTags = coerceTagList(input.includeTags);
  if (typeof input.excludeTags === 'string') input.excludeTags = coerceTagList(input.excludeTags);

  delete input.lat;
  delete input.long;
  delete input.lng;
  delete input.defaultZoom;
  delete input.tileServer;

  return input;
}

export function parseStoryMapObject(value: unknown): StoryMapConfig {
  return storyMapSchema.parse(normalizeStoryMapInput(value)) as StoryMapConfig;
}

export function parseStoryMapYaml(source: string): StoryMapConfig {
  return parseStoryMapObject(load(source));
}

export function parseStoryMapSourceObject(
  value: unknown,
  defaults?: StoryMapSourceDefaults,
): StoryMapSourceConfig {
  const normalized = normalizeStoryMapInput(value);
  return storyMapSourceSchema.parse(applySourceDefaults(normalized, defaults)) as StoryMapSourceConfig;
}

export function parseStoryMapSourceYaml(
  source: string,
  defaults?: StoryMapSourceDefaults,
): StoryMapSourceConfig {
  return parseStoryMapSourceObject(load(source), defaults);
}

export function applySourceDefaults(
  value: unknown,
  defaults?: StoryMapSourceDefaults,
): unknown {
  if (!defaults) return value;

  const input = { ...asRecord(value) };
  const map = { ...asRecord(input.map) };

  if (input.order === undefined && defaults.order !== undefined) input.order = defaults.order;
  if (input.dateField === undefined && defaults.dateField !== undefined) {
    input.dateField = defaults.dateField;
  }
  if (input.noteDisplay === undefined && defaults.noteDisplay !== undefined) {
    input.noteDisplay = defaults.noteDisplay;
  }
  if (input.initialSlide === undefined && defaults.initialSlide !== undefined) {
    input.initialSlide = defaults.initialSlide;
  }
  if (input.panelOpacity === undefined && defaults.panelOpacity !== undefined) {
    input.panelOpacity = defaults.panelOpacity;
  }

  const mapDefaults = defaults.map;
  if (mapDefaults) {
    if (map.theme === undefined && mapDefaults.theme !== undefined) map.theme = mapDefaults.theme;
    if (map.zoom === undefined && mapDefaults.zoom !== undefined) map.zoom = mapDefaults.zoom;
    if (map.minZoom === undefined && mapDefaults.minZoom !== undefined) map.minZoom = mapDefaults.minZoom;
    if (map.maxZoom === undefined && mapDefaults.maxZoom !== undefined) map.maxZoom = mapDefaults.maxZoom;
    if (map.tileUrl === undefined && mapDefaults.tileUrl !== undefined) map.tileUrl = mapDefaults.tileUrl;
    if (map.attribution === undefined && mapDefaults.attribution !== undefined) {
      map.attribution = mapDefaults.attribution;
    }
    if (map.showPath === undefined && mapDefaults.showPath !== undefined) {
      map.showPath = mapDefaults.showPath;
    }
  }

  if (Object.keys(map).length > 0) input.map = map;
  return input;
}

export function toStoryMapConfig(source: StoryMapSourceConfig, slides: StorySlide[]): StoryMapConfig {
  const config: StoryMapConfig = {
    schema: source.schema,
    height: source.height,
    panelOpacity: source.panelOpacity,
    map: source.map,
    layout: source.layout,
    slides,
  };
  if (source.id !== undefined) config.id = source.id;
  if (source.title !== undefined) config.title = source.title;
  const initialIndex = resolveInitialSlideIndex(source.initialSlide, slides.length);
  if (initialIndex > 0) config.initialSlide = initialIndex;
  return config;
}

export function extractFencedBlock(markdown: string, language: string): string | null {
  const lines = markdown.split(/\r?\n/);
  const openingFence = new RegExp(
    '^\\s*[`~]{3,}\\s*' + escapeRegExp(language) + '\\s*$',
    'i',
  );
  const closingFence = /^\s*[`~]{3,}\s*$/;
  let collecting = false;
  const collected: string[] = [];

  for (const line of lines) {
    if (!collecting) {
      if (openingFence.test(line)) {
        collecting = true;
      }
      continue;
    }

    if (closingFence.test(line)) {
      break;
    }

    collected.push(line);
  }

  return collecting ? collected.join('\n') : null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
