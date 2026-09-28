import { useEffect, useRef } from 'react';
import type { CircleMarker, LayerGroup, Map as LeafletMap, Polyline, TileLayer } from 'leaflet';
import type { StoryMapConfig } from '@story-map/story-map-core';

interface MapCanvasProps {
  story: StoryMapConfig;
  activeIndex: number;
}

/** The map element and Leaflet instance stay mounted while presentation changes. */
export function MapCanvas({ story, activeIndex }: MapCanvasProps) {
  const elementRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tileRef = useRef<TileLayer | null>(null);
  const markersRef = useRef<CircleMarker[]>([]);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const pathRef = useRef<Polyline | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const tileKeyRef = useRef('');
  const slidesRef = useRef<StoryMapConfig['slides'] | null>(null);
  const showPathRef = useRef<boolean | null>(null);
  const storyRef = useRef(story);
  const activeIndexRef = useRef(activeIndex);
  storyRef.current = story;
  activeIndexRef.current = activeIndex;

  function updateLayers(current: StoryMapConfig) {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;

    map.setMinZoom(current.map.minZoom ?? 0);
    map.setMaxZoom(current.map.maxZoom ?? 18);
    const tileKey = [current.map.tileUrl, current.map.attribution, current.map.minZoom, current.map.maxZoom].join('|');
    if (tileKeyRef.current !== tileKey) {
      tileRef.current?.remove();
      tileRef.current = L.tileLayer(current.map.tileUrl, {
        attribution: current.map.attribution,
        className: 'story-map__tiles',
        ...(current.map.minZoom === undefined ? {} : { minZoom: current.map.minZoom }),
        ...(current.map.maxZoom === undefined ? {} : { maxZoom: current.map.maxZoom }),
      }).addTo(map);
      tileKeyRef.current = tileKey;
    }

    if (slidesRef.current === current.slides && showPathRef.current === current.map.showPath) {
      updateMarkerStyles(current, activeIndexRef.current, markersRef.current);
      return;
    }

    markerLayerRef.current?.remove();
    pathRef.current?.remove();
    const layer = L.layerGroup().addTo(map);
    markerLayerRef.current = layer;
    const located = current.slides.filter((slide) => slide.location);
    markersRef.current = located.map((slide) => {
      const location = slide.location!;
      return L.circleMarker([location.lat, location.lng], {
        className: 'story-map__marker', radius: 6, weight: 2, fillOpacity: 0.85,
      }).addTo(layer);
    });
    pathRef.current = current.map.showPath && located.length >= 2
      ? L.polyline(
          located.map((slide) => [slide.location!.lat, slide.location!.lng] as [number, number]),
          { className: 'story-map__path', weight: 3, opacity: 0.65 },
        ).addTo(map)
      : null;
    slidesRef.current = current.slides;
    showPathRef.current = current.map.showPath;
    updateMarkerStyles(current, activeIndexRef.current, markersRef.current);
  }

  // Leaflet is imported only in a browser effect. A config or layout change never
  // creates another map on the same element.
  useEffect(() => {
    let cancelled = false;
    async function mount() {
      const element = elementRef.current;
      if (!element) return;
      const L = await import('leaflet');
      if (cancelled || !elementRef.current) return;
      leafletRef.current = L;
      const current = storyRef.current;
      const initial = current.slides[activeIndexRef.current]?.location;
      const center = initial
        ? [initial.lat, initial.lng] as [number, number]
        : current.map.center ?? [0, 0];
      mapRef.current = L.map(element).setView(center, initial?.zoom ?? current.map.zoom);
      updateLayers(current);
    }
    void mount();
    return () => {
      cancelled = true;
      pathRef.current = null;
      markersRef.current = [];
      markerLayerRef.current = null;
      tileRef.current = null;
      leafletRef.current = null;
      tileKeyRef.current = '';
      slidesRef.current = null;
      showPathRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    updateLayers(story);
  }, [story]);

  useEffect(() => {
    const location = story.slides[activeIndex]?.location;
    if (location) {
      mapRef.current?.flyTo([location.lat, location.lng], location.zoom ?? story.map.zoom, { duration: 1.1 });
    }
    updateMarkerStyles(story, activeIndex, markersRef.current);
  }, [activeIndex, story.slides, story.map.zoom]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return <div className="story-map__map" ref={elementRef} />;
}

function updateMarkerStyles(story: StoryMapConfig, activeIndex: number, markers: CircleMarker[]) {
  let markerIndex = 0;
  story.slides.forEach((slide, slideIndex) => {
    if (!slide.location) return;
    const marker = markers[markerIndex++];
    if (!marker) return;
    marker.setRadius(slideIndex === activeIndex ? 8 : 5);
    marker.setStyle({
      weight: slideIndex === activeIndex ? 3 : 2,
      fillOpacity: slideIndex === activeIndex ? 1 : 0.7,
    });
    marker.getElement()?.classList.toggle('story-map__marker--active', slideIndex === activeIndex);
  });
}
