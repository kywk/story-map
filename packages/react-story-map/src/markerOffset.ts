import type { StoryMapLayoutOptions } from '@story-map/story-map-core';

/** Viewport width at or below which the renderer switches to its vertical fallback. */
export const NARROW_VIEWPORT_PX = 640;

export interface ContainerSize {
  width: number;
  height: number;
}

/** Screen fractions (0..1) of the map container where the active marker should land. */
export interface MarkerFocus {
  fx: number;
  fy: number;
}

/**
 * Where the active marker should sit so the presentation overlay never covers it:
 * - `card` + center align parks the marker at the top quarter (the bottom-centered
 *   card would otherwise hide it). On narrow viewports every card alignment becomes
 *   a bottom sheet, so the same rule applies there.
 * - `full` centers the marker in the remaining map width beside the story surface
 *   (left/right aware), or the top band in the narrow vertical fallback.
 * - all other cases keep the marker centered.
 */
export function getMarkerFocus(
  layout: StoryMapLayoutOptions,
  viewportWidth: number,
): MarkerFocus {
  if (layout.mode === 'full') {
    if (viewportWidth <= NARROW_VIEWPORT_PX) return { fx: 0.5, fy: 0.12 };
    const ratio = layout.full.contentRatio;
    return layout.full.side === 'left'
      ? { fx: (1 + ratio) / 2, fy: 0.5 }
      : { fx: (1 - ratio) / 2, fy: 0.5 };
  }

  if (layout.card.align === 'center' || viewportWidth <= NARROW_VIEWPORT_PX) {
    return { fx: 0.5, fy: 0.25 };
  }
  return { fx: 0.5, fy: 0.5 };
}

/** Pixel offset of the focus point from the container center. Zero-size containers yield no offset. */
export function focusPixelOffset(size: ContainerSize, focus: MarkerFocus): { x: number; y: number } {
  if (!(size.width > 0) || !(size.height > 0)) return { x: 0, y: 0 };
  return { x: (focus.fx - 0.5) * size.width, y: (focus.fy - 0.5) * size.height };
}
