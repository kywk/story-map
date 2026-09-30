import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GeoMapConfig, GeoMarker, LatLngTuple, StoryMapConfig, StorySlide } from '@story-map/story-map-core';
import { tileSourcesFromStoryMap } from '@story-map/story-map-core';
import { GeoMap } from './GeoMap.js';
import type { GeoMapFocusContext, GeoMapRuntime } from './GeoMap.js';
import { focusPixelOffset, getMarkerFocus } from './markerOffset.js';

interface MapCanvasProps {
  story: StoryMapConfig;
  activeIndex: number;
}

/**
 * The StoryMap-specific layer above the shared `<GeoMap />`: it turns slides into
 * the generic marker/path model, owns the layout-aware focus offset, and drives
 * `flyTo` for slide navigation.
 *
 * The Leaflet instance itself - tiles, marker lifecycle, zoom visibility,
 * tooltips, resize invalidation, cleanup - belongs to `<GeoMap />`. Switching
 * slides or layouts only refreshes layers, so the map element and the runtime
 * stay mounted and the Leaflet instance is never recreated.
 */
export function MapCanvas({ story, activeIndex }: MapCanvasProps) {
  const [runtime, setRuntime] = useState<GeoMapRuntime | null>(null);
  const handleReady = useCallback((next: GeoMapRuntime | null) => setRuntime(next), []);

  const config = useMemo(() => storyToGeoMapConfig(story), [story]);
  const markers = config.markers;
  const activeMarkerIndex = useMemo(
    () => markerIndexForSlide(story.slides, activeIndex),
    [story.slides, activeIndex],
  );

  const path = useMemo(
    () =>
      story.map.showPath
        ? markers.map((marker) => [marker.location.lat, marker.location.lng] as LatLngTuple)
        : undefined,
    [markers, story.map.showPath],
  );

  // Same rule as before: park the active marker on the layout-aware focus point so
  // the card/full/timeline overlay never covers it.
  const focusOffset = useCallback(
    ({ width, height, viewportWidth }: GeoMapFocusContext) =>
      focusPixelOffset({ width, height }, getMarkerFocus(story.layout, viewportWidth)),
    [story.layout.mode, story.layout.card.align, story.layout.full.side, story.layout.full.contentRatio],
  );

  // `<GeoMap />` already opens on the active marker, so the first runtime must not
  // animate a second time; only later slide or layout changes fly.
  const flownRef = useRef<string | null>(null);
  const activeLocation = story.slides[activeIndex]?.location;
  const activeZoom = activeLocation?.zoom ?? story.map.zoom;
  const flyKey = activeMarkerIndex === null ? null : `${activeMarkerIndex}:${activeZoom}`;

  useEffect(() => {
    if (!runtime || !activeLocation || flyKey === null) return;
    if (flownRef.current === flyKey) return;
    flownRef.current = flyKey;
    runtime.flyTo([activeLocation.lat, activeLocation.lng], activeZoom, { duration: 1.1 });
  }, [runtime, activeLocation, activeZoom, flyKey]);

  return (
    <GeoMap
      map={config}
      rootless
      activeMarkerIndex={activeMarkerIndex}
      path={path}
      focusOffset={focusOffset}
      onReady={handleReady}
    />
  );
}

/**
 * The StoryMap -> GeoMap projection. Slides keep their own `storymap/v1` shape;
 * a located slide becomes a generic marker carrying only map data, and the
 * published `map.tileUrl` / `map.attribution` pair is normalized into the shared
 * tile model instead of being removed.
 */
export function storyToGeoMapConfig(story: StoryMapConfig): GeoMapConfig {
  const markers: GeoMarker[] = [];
  for (const slide of story.slides) {
    if (!slide.location) continue;
    markers.push({ location: { lat: slide.location.lat, lng: slide.location.lng } });
  }

  return {
    schema: 'geomap/v1',
    ...(story.id === undefined ? {} : { id: story.id }),
    height: story.height,
    map: {
      ...(story.map.center === undefined ? {} : { center: story.map.center }),
      zoom: story.map.zoom,
      ...(story.map.minZoom === undefined ? {} : { minZoom: story.map.minZoom }),
      ...(story.map.maxZoom === undefined ? {} : { maxZoom: story.map.maxZoom }),
      theme: story.map.theme,
      tiles: tileSourcesFromStoryMap(story.map),
    },
    markers,
  };
}

/**
 * The marker index for a slide, or `null` when the slide has no location. Markers
 * only exist for located slides, so a slide index is not a marker index.
 */
export function markerIndexForSlide(slides: readonly StorySlide[], slideIndex: number): number | null {
  let markerIndex = 0;
  for (let index = 0; index < slides.length; index += 1) {
    if (!slides[index]?.location) continue;
    if (index === slideIndex) return markerIndex;
    markerIndex += 1;
  }
  return null;
}
