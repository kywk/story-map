import { DEFAULT_TILE_ATTRIBUTION, DEFAULT_TILE_URL } from '@story-map/story-map-core';
import type { GeoMapOptions, TileSource, TileSources } from '@story-map/story-map-core';

/** The class the renderer's theme stylesheet already filters per preset. */
export const TILE_CLASS = 'story-map__tiles';

export interface ResolvedTileSource {
  url: string;
  attribution: string;
  subdomains?: string | string[];
  minZoom?: number;
  maxZoom?: number;
}

/**
 * The raster background the map actually requests.
 *
 * A theme is presentation and a tile source is map data, so the selected theme
 * never replaces a configured URL. `tiles.light` is the rendered source: dynamic
 * light/dark provider switching is a host concern (the `darkMode` dialect key
 * reports exactly that as `leaflet-compat-flag`), and the built-in `auto` preset
 * already restyles tiles through the theme rather than through a second provider.
 * Attribution is never dropped - a source with none still renders the OpenStreetMap
 * notice, which the tile usage policy requires.
 */
export function resolveTileSource(tiles: TileSources | undefined): ResolvedTileSource {
  const light = tiles?.light;
  const url = typeof light?.url === 'string' && light.url ? light.url : DEFAULT_TILE_URL;
  const attribution =
    typeof light?.attribution === 'string' && light.attribution
      ? light.attribution
      : DEFAULT_TILE_ATTRIBUTION;
  return {
    url,
    attribution,
    ...(light?.subdomains === undefined ? {} : { subdomains: light.subdomains }),
    ...(light?.minZoom === undefined ? {} : { minZoom: light.minZoom }),
    ...(light?.maxZoom === undefined ? {} : { maxZoom: light.maxZoom }),
  };
}

/**
 * Tile source zoom limits fall back to the map's own bounds, so a `leaflet` block
 * that sets only `minZoom` / `maxZoom` still constrains its background layer the
 * way the historical plugin did.
 */
export function tileSourceZoomBounds(
  source: TileSource,
  map: GeoMapOptions,
): { minZoom?: number; maxZoom?: number } {
  const minZoom = source.minZoom ?? map.minZoom;
  const maxZoom = source.maxZoom ?? map.maxZoom;
  return {
    ...(minZoom === undefined ? {} : { minZoom }),
    ...(maxZoom === undefined ? {} : { maxZoom }),
  };
}

/**
 * Identity of the rendered tile layer. A change replaces the layer in place: the
 * old one is removed rather than stacked underneath, so repeated config updates
 * can never leave a stale provider underneath a new one.
 */
export function tileLayerKey(map: GeoMapOptions): string {
  const source = resolveTileSource(map.tiles);
  const bounds = tileSourceZoomBounds(source, map);
  return [
    source.url,
    source.attribution,
    Array.isArray(source.subdomains) ? source.subdomains.join(',') : (source.subdomains ?? ''),
    bounds.minZoom ?? '',
    bounds.maxZoom ?? '',
  ].join('|');
}
