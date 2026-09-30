export { StoryMap } from './StoryMap.js';
export type { StoryMapProps } from './StoryMap.js';
export { GeoMap } from './GeoMap.js';
export type { GeoMapProps, GeoMapRuntime, GeoMapFocusContext } from './GeoMap.js';
export type {
  // StoryMap (storymap/v1) - unchanged public surface.
  StoryMapConfig,
  StoryMapOptions,
  StoryNoteDisplay,
  StorySlide,
  StoryLocation,
  StoryMedia,
  // GeoMap (geomap/v1) - the storyless map model sharing the same renderer.
  GeoMapConfig,
  GeoMapOptions,
  GeoMapControlOptions,
  GeoMapDiagnostic,
  GeoMarker,
  MarkerTypeDefinition,
  MarkerTypeIcon,
  MarkerTooltipDisplay,
  MarkerZoomRange,
  TileSource,
  TileSourceInput,
  TileSources,
  LatLngTuple,
  StoryMapTheme,
} from '@story-map/story-map-core';
export {
  // Tile helpers, so a host normalizes its own settings into the shared model.
  DEFAULT_TILE_URL,
  DEFAULT_TILE_ATTRIBUTION,
  DEFAULT_MARKER_TYPE_ID,
  toTileSources,
  tileSourcesFromStoryMap,
} from '@story-map/story-map-core';
