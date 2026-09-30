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
}

export function createLinkedTooltipController(
  closeDelay: number = LINKED_TOOLTIP_CLOSE_DELAY,
): LinkedTooltipController {
  const tracked = new Set<Layer>();
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
    tracked.add(raw);

    layer.on('mouseover', () => {
      const tooltip = layer.getTooltip?.();
      openFor(layer, tooltip?.getElement?.() ?? null);
    });
    layer.on('mouseout', () => {
      if (open?.layer !== layer) return;
      // The pointer may still be travelling toward the tooltip, so this is a
      // delayed close rather than an immediate one.
      scheduleClose();
    });
  }

  function closeAll() {
    cancelPendingClose();
    for (const layer of tracked) {
      const tooltipLayer = layer as TooltipLayerLike;
      tooltipLayer.off?.('mouseover', () => undefined);
      tooltipLayer.closeTooltip?.();
    }
    tracked.clear();
    open = null;
  }

  return { track, closeAll };
}
