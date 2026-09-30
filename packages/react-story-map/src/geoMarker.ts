import { resolveMarkerType } from '@story-map/story-map-core';
import type {
  GeoMarker,
  MarkerTooltipDisplay,
  MarkerTypeDefinition,
  MarkerZoomRange,
} from '@story-map/story-map-core';

/**
 * The three marker visuals a portable marker type can ask for. A type carries a
 * symbol or an image; everything else - including a type that is not registered -
 * falls back to the built-in generic circle, so a marker is never dropped because
 * its type is unknown or unimportable.
 */
export type MarkerVisualKind = 'circle' | 'image' | 'symbol';

/** The class the renderer's own theme stylesheet already knows how to paint. */
export const MARKER_CLASS = 'story-map__marker';

export interface MarkerVisual {
  kind: MarkerVisualKind;
  /**
   * Classes for the marker's element. The shared base class is always present and
   * is the only class a story marker carries, so the six built-in themes and the
   * `--story-map-*` variables keep painting it exactly as before.
   */
  className: string;
  /** The resolved type id, or the authored name when it is not registered. */
  type: string;
  /** True when the authored type has no definition and the circle visual was used. */
  unknown: boolean;
  /** Registry color, applied as a `--story-map-marker` override on the element. */
  color?: string;
  /** Image URL for the `image` visual. */
  iconUrl?: string;
  /** Portable glyph text for the `symbol` visual. */
  symbol?: string;
}

const IMAGE_CLASS = 'story-map__marker--image';
const SYMBOL_CLASS = 'story-map__marker--symbol';

/**
 * Resolve one `GeoMarker` against a host's marker type registry.
 *
 * The precedence itself is not re-implemented here: `resolveMarkerType` in
 * `story-map-core` owns it (authored `mapmarker` -> tag match -> configured
 * default -> built-in generic default) and reports `unknown` for a name that is
 * not registered. The renderer only turns the resulting definition into a visual,
 * so a `mapmarker` this package has never heard of still produces a marker and
 * keeps its authored name for diagnostics.
 */
export function resolveMarkerVisual(
  marker: GeoMarker,
  types: readonly MarkerTypeDefinition[] | undefined,
): MarkerVisual {
  const resolution = resolveMarkerType({ authoredType: marker.type, types });
  const definition = resolution.definition;
  const icon = definition?.icon;
  const base: MarkerVisual = {
    kind: 'circle',
    className: MARKER_CLASS,
    type: resolution.type,
    unknown: resolution.unknown,
    ...(definition?.color ? { color: definition.color } : {}),
  };

  if (icon?.kind === 'image' && icon.value) {
    return { ...base, kind: 'image', className: `${MARKER_CLASS} ${IMAGE_CLASS}`, iconUrl: icon.value };
  }
  if (icon?.kind === 'symbol' && icon.value) {
    return { ...base, kind: 'symbol', className: `${MARKER_CLASS} ${SYMBOL_CLASS}`, symbol: icon.value };
  }

  return base;
}

/**
 * The marker's zoom visibility range. Note `mapzoom` frontmatter is more specific
 * than a marker type definition, so note bounds win and type bounds fill the gaps.
 */
export function markerZoomRange(
  marker: GeoMarker,
  types: readonly MarkerTypeDefinition[] | undefined,
): MarkerZoomRange {
  const resolution = resolveMarkerType({ authoredType: marker.type, types });
  const minZoom = marker.minZoom ?? resolution.minZoom;
  const maxZoom = marker.maxZoom ?? resolution.maxZoom;
  return {
    ...(minZoom === undefined ? {} : { minZoom }),
    ...(maxZoom === undefined ? {} : { maxZoom }),
  };
}

/**
 * Whether a marker is inside its `mapzoom` range at `zoom`. A marker with no range
 * is always visible; the range is inclusive at both bounds, like the historical
 * plugin's zoom filters.
 */
export function isMarkerVisibleAtZoom(range: MarkerZoomRange, zoom: number): boolean {
  if (range.minZoom !== undefined && zoom < range.minZoom) return false;
  if (range.maxZoom !== undefined && zoom > range.maxZoom) return false;
  return true;
}

/**
 * The tooltip mode for a marker: its own value, else the host default, else
 * `hover`. Historical Obsidian Leaflet revealed a marker tooltip on hover, which
 * is the portable default; a host that wants something else (a plugin setting, a
 * `leaflet` compatibility default) passes `defaultTooltip`.
 */
export function effectiveTooltipMode(
  marker: GeoMarker,
  fallback: MarkerTooltipDisplay = 'hover',
): MarkerTooltipDisplay {
  return marker.tooltip ?? fallback;
}

/**
 * Leaflet tooltip binding for a mode, or `null` when no tooltip should be bound.
 * `always` is permanent, `hover` is the default interaction, `never` binds nothing.
 */
export function tooltipBinding(mode: MarkerTooltipDisplay): { permanent: boolean } | null {
  if (mode === 'never') return null;
  return { permanent: mode === 'always' };
}

export interface MarkerPlan {
  marker: GeoMarker;
  visual: MarkerVisual;
  range: MarkerZoomRange;
  /** Leaflet tooltip options, or `null` when this marker binds no tooltip. */
  tooltip: { permanent: boolean } | null;
  /** True when the marker has something to put in a tooltip. */
  hasTooltipContent: boolean;
}

/**
 * Turn the configured markers into the pure, testable description of what the
 * Leaflet layer should contain. Nothing here touches Leaflet or the DOM, which is
 * what lets the marker rules (unknown type, `mapzoom` visibility, tooltip mode)
 * be asserted without a browser.
 */
export function buildMarkerPlan(
  markers: readonly GeoMarker[],
  types: readonly MarkerTypeDefinition[] | undefined,
  defaultTooltip: MarkerTooltipDisplay | undefined,
): MarkerPlan[] {
  return markers.map((marker) => {
    const mode = effectiveTooltipMode(marker, defaultTooltip);
    return {
      marker,
      visual: resolveMarkerVisual(marker, types),
      range: markerZoomRange(marker, types),
      tooltip: tooltipBinding(mode),
      hasTooltipContent: marker.title !== undefined || marker.description !== undefined || marker.notePath !== undefined,
    };
  });
}
