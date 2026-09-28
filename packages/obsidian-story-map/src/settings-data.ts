import {
  type StoryMapSourceDefaults,
  type StoryMapTheme,
  type StoryNoteDisplay,
  type StoryOrder,
} from '@story-map/story-map-core';

export interface StoryMapPluginSettings {
  order?: StoryOrder | undefined;
  dateField?: string | undefined;
  noteDisplay?: StoryNoteDisplay | undefined;
  mapTheme?: StoryMapTheme | undefined;
  mapZoom?: number | undefined;
  mapMinZoom?: number | undefined;
  mapMaxZoom?: number | undefined;
  mapTileUrl?: string | undefined;
  mapAttribution?: string | undefined;
  mapShowPath?: boolean | undefined;
}

export const DEFAULT_STORY_MAP_SETTINGS: StoryMapPluginSettings = {
  mapTheme: 'auto',
  mapShowPath: true,
};

export function toSourceDefaults(settings: StoryMapPluginSettings): StoryMapSourceDefaults {
  const defaults: StoryMapSourceDefaults = {};

  if (settings.order !== undefined) defaults.order = settings.order;
  const dateField = nonEmpty(settings.dateField);
  if (dateField !== undefined) defaults.dateField = dateField;
  if (settings.noteDisplay !== undefined) defaults.noteDisplay = settings.noteDisplay;

  const map: NonNullable<StoryMapSourceDefaults['map']> = {};
  if (settings.mapTheme !== undefined) map.theme = settings.mapTheme;
  if (isFiniteNumber(settings.mapZoom)) map.zoom = settings.mapZoom;
  if (isFiniteNumber(settings.mapMinZoom)) map.minZoom = settings.mapMinZoom;
  if (isFiniteNumber(settings.mapMaxZoom)) map.maxZoom = settings.mapMaxZoom;
  const tileUrl = nonEmpty(settings.mapTileUrl);
  if (tileUrl !== undefined) map.tileUrl = tileUrl;
  const attribution = nonEmpty(settings.mapAttribution);
  if (attribution !== undefined) map.attribution = attribution;
  if (settings.mapShowPath !== undefined) map.showPath = settings.mapShowPath;
  if (Object.keys(map).length > 0) defaults.map = map;

  return defaults;
}

function nonEmpty(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function isFiniteNumber(value: number | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
