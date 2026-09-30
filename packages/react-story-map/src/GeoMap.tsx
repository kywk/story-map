import { useEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { CircleMarker, Layer, LayerGroup, Map as LeafletMap, Marker, Polyline, TileLayer } from 'leaflet';
import type {
  GeoMapConfig,
  GeoMarker,
  LatLngTuple,
  MarkerTooltipDisplay,
  MarkerTypeDefinition,
  MarkerZoomRange,
} from '@story-map/story-map-core';
import { buildMarkerPlan, isMarkerVisibleAtZoom } from './geoMarker.js';
import type { MarkerPlan } from './geoMarker.js';
import { resolveTileSource, TILE_CLASS, tileLayerKey, tileSourceZoomBounds } from './geoTiles.js';
import { attachNoteLinkHandlers, noteLinkAttributes } from './noteLink.js';
import type { NoteLinkShape } from './noteLink.js';
import { createLinkedTooltipController, type LinkedTooltipController } from './tooltipLifecycle.js';

/** The Leaflet module, imported dynamically so the package stays SSR-import-safe. */
type Leaflet = typeof import('leaflet');

const ACTIVE_CLASS = 'story-map__marker--active';
const TOOLTIP_CLASS = 'story-map__marker-tooltip';
/** The exact idle/active geometry StoryMap has always used for its markers. */
const IDLE_STYLE = { radius: 5, weight: 2, fillOpacity: 0.7 };
const ACTIVE_STYLE = { radius: 8, weight: 3, fillOpacity: 1 };

/** A Leaflet layer that may carry a tooltip. `Layer` itself does not declare one. */
type TooltipLayer = Layer & {
  bindTooltip?: (
    content: HTMLElement,
    options: { permanent: boolean; interactive?: boolean; direction: 'top'; className: string },
  ) => unknown;
};

/**
 * The live map, handed to a composing host once Leaflet exists and `null` again on
 * teardown. `StoryMap` uses it for the slide `flyTo`, which is story navigation
 * rather than map data, while the projection math stays here.
 */
export interface GeoMapRuntime {
  readonly map: LeafletMap;
  readonly element: HTMLDivElement | null;
  /**
   * `flyTo` that applies the configured `focusOffset` first, so the marker lands
   * on the host's focus point instead of the container center and the story
   * overlay never covers it.
   */
  flyTo(center: LatLngTuple, zoom: number, options?: { duration?: number }): void;
}

/** Pixel offset of the focus point from the container center. */
export interface GeoMapFocusContext {
  element: HTMLDivElement | null;
  width: number;
  height: number;
  viewportWidth: number;
  zoom: number;
}

export interface GeoMapProps {
  /** The storyless map model. */
  map: GeoMapConfig;
  /**
   * Marker type registry. An unregistered `marker.type` still renders through the
   * default visual, keeping the authored name in the config for diagnostics.
   */
  markerTypes?: readonly MarkerTypeDefinition[];
  /**
   * Tooltip mode for markers that do not set their own. Defaults to `hover`, the
   * historical Obsidian Leaflet behavior; a host overrides it from its marker
   * tooltip setting or its `leaflet` compatibility default.
   */
  defaultTooltip?: MarkerTooltipDisplay;
  /** Extra classes on the themed root. */
  className?: string;
  /** Accessible name for the map. */
  label?: string;
  /**
   * Render only the map element, because the host already renders the themed
   * `.story-map` root. This is how `StoryMap` composes `<GeoMap />` without
   * changing its DOM.
   */
  rootless?: boolean;
  /**
   * Index of the emphasized marker, or `null` / `undefined` for none. It is also
   * the map's opening view, so a storyless map can open on a chosen marker.
   */
  activeMarkerIndex?: number | null;
  /** Optional polyline through these points, drawn in the shared path style. */
  path?: readonly LatLngTuple[] | undefined;
  /**
   * Pixel offset applied to every programmatic view, so the focused point clears a
   * host overlay. `StoryMap` supplies its layout-aware offset; a storyless map
   * centers normally.
   */
  focusOffset?: (context: GeoMapFocusContext) => { x: number; y: number } | undefined;
  /** Extra class on marker note links, matching `StoryMap`'s prop. */
  noteLinkClassName?: string;
  onNoteClick?: (notePath: string, event: MouseEvent) => void;
  onNoteHover?: (notePath: string, targetEl: HTMLElement, event: MouseEvent) => void;
  /** Receives the live map for host-driven navigation, and `null` on teardown. */
  onReady?: (runtime: GeoMapRuntime | null) => void;
}

interface MarkerEntry {
  layer: Layer;
  range: MarkerZoomRange;
  element: Element | null;
  emphasis(active: boolean): void;
}

/**
 * The shared Leaflet runtime: one map instance per mounted host, generic tile
 * sources, generic markers with zoom visibility and tooltips, note-link callbacks,
 * resize invalidation, and full cleanup.
 *
 * `StoryMap` composes this instead of owning Leaflet itself. Config and marker
 * changes refresh layers in place and never recreate the map; a tile change
 * removes the previous layer rather than stacking a second one.
 *
 * Everything Leaflet-related happens inside a client effect, so importing this
 * module under Node touches neither Leaflet nor the DOM.
 */
export function GeoMap({
  map: config,
  markerTypes,
  defaultTooltip = 'hover',
  className,
  label,
  rootless = false,
  activeMarkerIndex,
  path,
  focusOffset,
  noteLinkClassName,
  onNoteClick,
  onNoteHover,
  onReady,
}: GeoMapProps) {
  const elementRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const leafletRef = useRef<Leaflet | null>(null);
  const tileRef = useRef<TileLayer | null>(null);
  const markerLayerRef = useRef<LayerGroup | null>(null);
  const markersRef = useRef<MarkerEntry[]>([]);
  const markersConfigRef = useRef<GeoMarker[] | undefined>(undefined);
  const pathLayerRef = useRef<Polyline | null>(null);
  const tileKeyRef = useRef('');
  const markerKeyRef = useRef('');
  const pathKeyRef = useRef('');

  // Latest values, so a data change refreshes layers without re-running the mount
  // effect and therefore without ever creating a second map.
  const configRef = useRef(config);
  const markerTypesRef = useRef(markerTypes);
  const tooltipRef = useRef(defaultTooltip);
  const pathPropRef = useRef(path);
  const focusRef = useRef(focusOffset);
  const activeRef = useRef(activeMarkerIndex);
  const onReadyRef = useRef(onReady);
  const linksRef = useRef<NoteLinkShape>({ noteLinkClassName, onNoteClick, onNoteHover });
  // One controller per mounted map, so a linked tooltip in one map never closes or
  // reopens a tooltip in another.
  const linkedTooltipsRef = useRef<LinkedTooltipController | null>(null);
  linkedTooltipsRef.current ??= createLinkedTooltipController();
  const linkedTooltips = linkedTooltipsRef.current;
  configRef.current = config;
  markerTypesRef.current = markerTypes;
  tooltipRef.current = defaultTooltip;
  pathPropRef.current = path;
  focusRef.current = focusOffset;
  activeRef.current = activeMarkerIndex;
  onReadyRef.current = onReady;
  linksRef.current = { noteLinkClassName, onNoteClick, onNoteHover };

  const readLinks = () => linksRef.current;

  function applyEmphasis() {
    const active = activeRef.current ?? -1;
    markersRef.current.forEach((entry, index) => entry.emphasis(index === active));
  }

  /** Add or remove each marker so only those inside their `mapzoom` range show. */
  function applyZoomVisibility(group: LayerGroup, zoom: number) {
    for (const entry of markersRef.current) {
      if (isMarkerVisibleAtZoom(entry.range, zoom)) group.addLayer(entry.layer);
      else group.removeLayer(entry.layer);
    }
  }

  function buildMarkers(leaflet: Leaflet, group: LayerGroup, plans: MarkerPlan[]): MarkerEntry[] {
    return plans.map((plan) => createMarker(leaflet, group, plan, readLinks, linkedTooltips));
  }

  function updateLayers() {
    const map = mapRef.current;
    const leaflet = leafletRef.current;
    if (!map || !leaflet) return;
    const current = configRef.current;

    map.setMinZoom(current.map.minZoom ?? 0);
    map.setMaxZoom(current.map.maxZoom ?? 18);

    // Tiles: replace in place. A changed source removes the previous layer, so a
    // stale provider never accumulates underneath the current one.
    const nextTileKey = tileLayerKey(current.map);
    if (tileKeyRef.current !== nextTileKey) {
      const source = resolveTileSource(current.map.tiles);
      tileRef.current?.remove();
      tileRef.current = leaflet
        .tileLayer(source.url, {
          attribution: source.attribution,
          className: TILE_CLASS,
          ...(source.subdomains === undefined ? {} : { subdomains: source.subdomains }),
          ...tileSourceZoomBounds(source, current.map),
        })
        .addTo(map);
      tileKeyRef.current = nextTileKey;
    }

    // Markers: rebuild only when the marker data or the registry/tooltip rules
    // change. Restyling and zoom visibility never touch the map instance.
    const nextMarkerKey = registryKey(markerTypesRef.current, tooltipRef.current);
    if (nextMarkerKey !== markerKeyRef.current || current.markers !== markersConfigRef.current) {
      markerLayerRef.current?.remove();
      const group = leaflet.layerGroup().addTo(map);
      markerLayerRef.current = group;
      markersRef.current = buildMarkers(
        leaflet,
        group,
        buildMarkerPlan(current.markers, markerTypesRef.current, tooltipRef.current),
      );
      markerKeyRef.current = nextMarkerKey;
      markersConfigRef.current = current.markers;
    }

    applyZoomVisibility(markerLayerRef.current as LayerGroup, map.getZoom());
    applyEmphasis();

    // Optional connecting path.
    const nextPath = pathPropRef.current;
    const nextPathKey = pathKey(nextPath);
    if (pathKeyRef.current !== nextPathKey) {
      pathLayerRef.current?.remove();
      pathLayerRef.current =
        nextPath && nextPath.length >= 2
          ? leaflet
              .polyline([...nextPath], { className: 'story-map__path', weight: 3, opacity: 0.65 })
              .addTo(map)
          : null;
      pathKeyRef.current = nextPathKey;
    }
  }

  function projectFocus(
    map: LeafletMap,
    leaflet: Leaflet,
    element: HTMLDivElement | null,
    center: LatLngTuple,
    zoom: number,
  ): LatLngTuple {
    const resolve = focusRef.current;
    if (!resolve) return center;
    const width = element?.clientWidth ?? 0;
    const height = element?.clientHeight ?? 0;
    const offset = resolve({
      element,
      width,
      height,
      viewportWidth: typeof window === 'undefined' ? width : window.innerWidth,
      zoom,
    }) ?? { x: 0, y: 0 };
    // A zero-size container yields no offset, and Leaflet cannot project it either.
    if (offset.x === 0 && offset.y === 0) return center;
    const projected = map.project(center, zoom).subtract(leaflet.point(offset.x, offset.y));
    const focused = map.unproject(projected, zoom);
    return [focused.lat, focused.lng];
  }

  // Leaflet is imported only in a browser effect. A config, marker, or layout
  // change never creates another map on the same element.
  useEffect(() => {
    let cancelled = false;
    async function mount() {
      const element = elementRef.current;
      if (!element) return;
      const leaflet = await import('leaflet');
      if (cancelled || !elementRef.current) return;
      leafletRef.current = leaflet;

      const current = configRef.current;
      const zoom = current.map.zoom;
      const map = leaflet.map(element);
      mapRef.current = map;
      const center = projectFocus(map, leaflet, element, initialCenter(current, activeRef.current), zoom);
      map.setView(center, zoom);
      updateLayers();

      // `mapzoom` is real behavior, not collected metadata: visibility follows the
      // live zoom, whether the user zoomed or a `flyTo` moved the map.
      const onZoom = () => {
        const group = markerLayerRef.current;
        if (group) applyZoomVisibility(group, map.getZoom());
      };
      map.on('zoom', onZoom);

      // A linked tooltip holds a hover source for an out-of-element preview. Any
      // other map interaction ends that interaction, so the tooltip does not stay
      // open over a map the user has moved on from.
      const dismissLinked = () => linkedTooltips.closeAll();
      map.on('click', dismissLinked);
      map.on('movestart', dismissLinked);
      map.on('zoomstart', dismissLinked);

      const runtime: GeoMapRuntime = {
        map,
        element,
        flyTo: (target, targetZoom, options) => {
          map.flyTo(projectFocus(map, leaflet, element, target, targetZoom), targetZoom, options);
        },
      };
      onReadyRef.current?.(runtime);
    }
    void mount();
    return () => {
      cancelled = true;
      onReadyRef.current?.(null);
      linkedTooltips.closeAll();
      pathLayerRef.current = null;
      markersRef.current = [];
      markerLayerRef.current = null;
      markersConfigRef.current = undefined;
      tileRef.current = null;
      leafletRef.current = null;
      tileKeyRef.current = '';
      markerKeyRef.current = '';
      pathKeyRef.current = '';
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    updateLayers();
  }, [config]);

  useEffect(() => {
    applyEmphasis();
  }, [activeMarkerIndex]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => mapRef.current?.invalidateSize());
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (rootless) return <div className="story-map__map" ref={elementRef} />;

  return (
    <div
      className={['story-map', className].filter(Boolean).join(' ')}
      style={{ height: config.height } as CSSProperties}
      data-map-theme={config.map.theme}
      data-geomap=""
      aria-label={label ?? 'Map'}
    >
      <div className="story-map__map" ref={elementRef} />
    </div>
  );
}

/**
 * One marker, in whichever visual its type resolved to. A circle is styled and
 * sized directly; an image or symbol marker is a Leaflet `Marker`, so emphasis
 * switches its opacity, z-index, and the shared active class instead.
 *
 * A type that is not registered still produces a circle - the authored name is
 * preserved on the element and in the config, never dropped.
 */
function createMarker(
  leaflet: Leaflet,
  group: LayerGroup,
  plan: MarkerPlan,
  readLinks: () => NoteLinkShape,
  linkedTooltips: LinkedTooltipController,
): MarkerEntry {
  const { marker, visual } = plan;
  const position: LatLngTuple = [marker.location.lat, marker.location.lng];
  const color = visual.color ? { color: visual.color, fillColor: visual.color } : {};

  let layer: Layer;
  let emphasis: (active: boolean) => void;

  if (visual.kind === 'image' && visual.iconUrl) {
    const image = leaflet.marker(position, {
      icon: leaflet.icon({ iconUrl: visual.iconUrl, className: visual.className }),
      keyboard: false,
      ...color,
    });
    layer = image;
    emphasis = (active) => {
      image.setOpacity(active ? 1 : 0.85);
      image.setZIndexOffset(active ? 1000 : 0);
    };
  } else if (visual.kind === 'symbol' && visual.symbol !== undefined) {
    const symbol = leaflet.marker(position, {
      icon: leaflet.divIcon({
        className: visual.className,
        html: escapeHtml(visual.symbol),
        iconSize: [22, 22],
        iconAnchor: [11, 11],
      }),
      keyboard: false,
      ...color,
    });
    layer = symbol;
    emphasis = (active) => {
      symbol.setOpacity(active ? 1 : 0.85);
      symbol.setZIndexOffset(active ? 1000 : 0);
    };
  } else {
    const circle = leaflet.circleMarker(position, {
      className: visual.className,
      radius: IDLE_STYLE.radius,
      weight: IDLE_STYLE.weight,
      fillOpacity: IDLE_STYLE.fillOpacity,
      ...color,
    });
    layer = circle;
    emphasis = (active) => {
      circle.setStyle(active ? ACTIVE_STYLE : IDLE_STYLE);
      circle.setRadius(active ? ACTIVE_STYLE.radius : IDLE_STYLE.radius);
    };
  }

  layer.addTo(group);
  bindTooltip(layer, plan, readLinks, linkedTooltips);

  const element = (layer as CircleMarker).getElement?.() ?? null;
  if (element) {
    // The theme paints a circle through `fill: var(--story-map-marker)`, which is
    // an SVG property only a circle has. A registered type color is therefore set
    // on the element, so it wins for every visual without a second variable.
    if (visual.color) element.setAttribute('style', `--story-map-marker: ${visual.color}`);
    element.setAttribute('data-marker-type', visual.type);
    if (visual.unknown) element.setAttribute('data-marker-type-unknown', '');
  }
  // Emphasis writes the class on the element, which only exists once the layer is
  // on the map, so the initial state is applied after insertion.
  const styled = (active: boolean) => {
    emphasis(active);
    element?.classList.toggle(ACTIVE_CLASS, active);
  };
  return { layer, range: plan.range, element, emphasis: styled };
}

/**
 * How a marker's tooltip is bound.
 *
 * A tooltip holding a note link is bound permanent and interactive, and its
 * lifecycle is handed to the linked-tooltip controller. That is what keeps the link
 * clickable and keeps the element a host uses as its hover source in the DOM long
 * enough to reach an out-of-element preview. A tooltip with no link keeps Leaflet's
 * ordinary hover binding, which is cheaper and needs no controller.
 */
export function tooltipBinding(
  marker: GeoMarker,
  tooltip: { permanent: boolean } | null,
  links: NoteLinkShape,
): { permanent: boolean; interactive: boolean; linked: boolean } {
  const linksAreInteractive =
    marker.notePath !== undefined &&
    (links.onNoteClick !== undefined || links.onNoteHover !== undefined);
  return {
    // A permanent binding would leave every tooltip open at once, so only a linked
    // tooltip takes over its own lifecycle, and then only while hovered.
    permanent: linksAreInteractive ? true : (tooltip?.permanent ?? false),
    interactive: linksAreInteractive,
    linked: linksAreInteractive,
  };
}

/**
 * Bind a marker's tooltip, when it has a mode with content. Tooltips carry the
 * same note link as every other surface, so a host never sees two different link
 * shapes for one note.
 */
function bindTooltip(
  layer: Layer,
  plan: MarkerPlan,
  readLinks: () => NoteLinkShape,
  linkedTooltips: LinkedTooltipController,
) {
  const { marker, tooltip, hasTooltipContent } = plan;
  if (!tooltip || !hasTooltipContent) return;
  const content = markerTooltipElement(marker, readLinks);
  if (!content) return;
  const bindable = layer as TooltipLayer;
  if (typeof bindable.bindTooltip !== 'function') return;

  const binding = tooltipBinding(marker, tooltip, readLinks());
  bindable.bindTooltip(content, {
    permanent: binding.permanent,
    interactive: binding.interactive,
    direction: 'top',
    className: TOOLTIP_CLASS,
  });

  if (binding.linked) linkedTooltips.track(layer);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Tooltip content for one marker: title, description, and - when the marker
 * resolves a note - the shared note link, so a marker carries exactly the same
 * link shape as the StoryMap panel heading and the timeline note chip.
 */
function markerTooltipElement(marker: GeoMarker, readLinks: () => NoteLinkShape): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const root = document.createElement('div');
  root.className = 'story-map__marker-content';

  if (marker.title) {
    const title = document.createElement('div');
    title.className = 'story-map__marker-title';
    title.textContent = marker.title;
    root.appendChild(title);
  }
  if (marker.description) {
    const description = document.createElement('div');
    description.className = 'story-map__marker-description';
    description.textContent = marker.description;
    root.appendChild(description);
  }
  if (marker.notePath !== undefined) {
    const attributes = noteLinkAttributes(marker.notePath, readLinks());
    const anchor = document.createElement('a');
    anchor.className = attributes.className;
    anchor.setAttribute('href', attributes.href);
    if (attributes.dataHref !== undefined) anchor.setAttribute('data-href', attributes.dataHref);
    attachNoteLinkHandlers(anchor, marker.notePath, readLinks);
    anchor.textContent = marker.title ?? 'Open note';
    root.appendChild(anchor);
  }
  return root;
}

/** Stable identity of the marker registry and tooltip default, for layer rebuilds. */
function registryKey(
  types: readonly MarkerTypeDefinition[] | undefined,
  tooltip: MarkerTooltipDisplay,
): string {
  const rendered = (types ?? [])
    .map((type) => `${type.id}:${type.color ?? ''}:${type.icon?.kind ?? ''}:${type.icon?.value ?? ''}:${type.minZoom ?? ''}:${type.maxZoom ?? ''}`)
    .join(',');
  return `${rendered}|${tooltip}`;
}

/** Stable identity of the connecting path, so an equal array never rebuilds it. */
function pathKey(path: readonly LatLngTuple[] | undefined): string {
  return path ? path.map(([lat, lng]) => `${lat},${lng}`).join(';') : '';
}

/** Where the map opens: the active marker, else the configured center, else the origin. */
function initialCenter(config: GeoMapConfig, activeIndex: number | null | undefined): LatLngTuple {
  if (activeIndex !== null && activeIndex !== undefined) {
    const location = config.markers[activeIndex]?.location;
    if (location) return [location.lat, location.lng];
  }
  return config.map.center ?? [0, 0];
}
