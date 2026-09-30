import type { Layer } from 'leaflet';

/**
 * How long a linked marker tooltip stays open after the pointer leaves both the
 * marker and the tooltip.
 *
 * The value is not cosmetic. When a marker resolves a note, its tooltip holds the
 * anchor a host uses as the hover source for an out-of-element preview - Obsidian's
 * Page preview, for instance. That preview renders somewhere else on screen, so the
 * pointer has to travel across the map to reach it. Leaflet closes a non-permanent
 * tooltip the instant the pointer leaves the marker, which removes the hover source
 * from the DOM and collapses the preview before the pointer can arrive, leaving no
 * way to open the note.
 *
 * Holding the tooltip open briefly is what makes the travel possible. It is short
 * enough that walking away still dismisses it, and long enough to cross a gap.
 */
export const LINKED_TOOLTIP_CLOSE_DELAY = 400;

/** The subset of a Leaflet layer this controller needs. */
interface TooltipLayerLike {
  openTooltip?: () => unknown;
  closeTooltip?: () => unknown;
  getTooltip?: () => { getElement?: () => HTMLElement | null } | null | undefined;
  on?: (type: string, handler: (event: unknown) => void) => unknown;
  off?: (type: string, handler: (event: unknown) => void) => unknown;
}

/**
 * Keeps one linked marker tooltip open while the pointer moves between the marker
 * and the tooltip itself.
 *
 * Leaflet's own tooltip lifecycle is deliberately not used here: a marker whose
 * tooltip carries a link is bound permanently and opened, held, and closed by this
 * controller, so the hover source stays in the DOM for the whole interaction.
 * Markers without a link keep Leaflet's normal hover tooltip.
 */
export interface LinkedTooltipController {
  /** Track a marker whose tooltip holds an interactive note link. */
  track(layer: Layer): void;
  /** Close immediately and stop tracking: map interaction or teardown. */
  closeAll(): void;
  /**
   * Drop tracking for layers that have been detached from the map. Call this
   * before rebuilding markers, so a rebuilt map does not accumulate dead layers.
   */
  reset(): void;
}

export function createLinkedTooltipController(
  closeDelay: number = LINKED_TOOLTIP_CLOSE_DELAY,
): LinkedTooltipController {
  // The handlers are kept so they can be detached again. Clearing the set alone is
  // not enough: the closures live in the layer's own event registry, so a re-tracked
  // layer would fire twice.
  const tracked = new Map<Layer, { over: () => void; out: () => void }>();
  let open: { layer: TooltipLayerLike; element: HTMLElement | null } | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function cancelPendingClose() {
    if (timer === null) return;
    clearTimeout(timer);
    timer = null;
  }

  function closeNow() {
    cancelPendingClose();
    if (!open) return;
    open.layer.closeTooltip?.();
    open = null;
  }

  function scheduleClose() {
    cancelPendingClose();
    timer = setTimeout(() => {
      timer = null;
      closeNow();
    }, closeDelay);
  }

  function openFor(layer: TooltipLayerLike, element: HTMLElement | null) {
    // Only one linked tooltip at a time, so travelling to a preview never leaves a
    // second tooltip behind on the map.
    if (open && open.layer !== layer) closeNow();
    cancelPendingClose();
    open = { layer, element };
    layer.openTooltip?.();
    element?.addEventListener('mouseover', cancelPendingClose);
    element?.addEventListener('mouseenter', cancelPendingClose);
    element?.addEventListener('mouseout', scheduleClose);
    element?.addEventListener('mouseleave', scheduleClose);
  }

  function track(raw: Layer) {
    const layer = raw as TooltipLayerLike;
    if (typeof layer.on !== 'function' || typeof layer.openTooltip !== 'function') return;
    if (tracked.has(raw)) return;

    const over = () => {
      const tooltip = layer.getTooltip?.();
      openFor(layer, tooltip?.getElement?.() ?? null);
    };
    const out = () => {
      if (open?.layer !== layer) return;
      // The pointer may still be travelling toward the tooltip, so this is a
      // delayed close rather than an immediate one.
      scheduleClose();
    };
    tracked.set(raw, { over, out });
    layer.on('mouseover', over);
    layer.on('mouseout', out);
  }

  function detachAll() {
    for (const [raw, handlers] of tracked) {
      const layer = raw as TooltipLayerLike;
      layer.off?.('mouseover', handlers.over);
      layer.off?.('mouseout', handlers.out);
    }
  }

  function closeAll() {
    cancelPendingClose();
    for (const layer of tracked.keys()) {
      (layer as TooltipLayerLike).closeTooltip?.();
    }
    open = null;
  }

  /**
   * Forget the tracked layers as well as closing them. Used when the marker layer
   * group is rebuilt or the map is torn down: those layers are detached, so keeping
   * them would both grow the set and leave stale handlers on them.
   */
  function reset() {
    closeAll();
    detachAll();
    tracked.clear();
  }

  return { track, closeAll, reset };
}
