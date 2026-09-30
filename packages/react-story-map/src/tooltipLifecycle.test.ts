import { describe, expect, it, vi } from 'vitest';
import {
  createLinkedTooltipController,
  LINKED_TOOLTIP_CLOSE_DELAY,
} from './tooltipLifecycle.js';

/**
 * A marker tooltip that holds a note link is the hover source a host uses for an
 * out-of-element preview. Leaflet closes a non-permanent tooltip the moment the
 * pointer leaves the marker, which removes that source from the DOM and collapses
 * the preview before the pointer can reach it - the note becomes unopenable.
 *
 * These tests pin the hover-intent behavior that keeps the source alive, without a
 * real Leaflet or a DOM: the controller only needs open/close and a tooltip element.
 */

class FakeTooltipElement {
  readonly listeners = new Map<string, Set<() => void>>();

  addEventListener(type: string, handler: () => void) {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler);
    this.listeners.set(type, set);
  }

  fire(type: string) {
    for (const handler of this.listeners.get(type) ?? []) handler();
  }
}

class FakeLayer {
  readonly handlers = new Map<string, Set<() => void>>();
  readonly element = new FakeTooltipElement();
  openCount = 0;
  closeCount = 0;
  closed = false;

  on(type: string, handler: () => void) {
    const set = this.handlers.get(type) ?? new Set();
    set.add(handler);
    this.handlers.set(type, set);
  }

  off(type: string, handler: () => void) {
    this.handlers.get(type)?.delete(handler);
  }

  fire(type: string) {
    for (const handler of [...(this.handlers.get(type) ?? [])]) handler();
  }

  openTooltip() {
    this.openCount += 1;
  }

  closeTooltip() {
    this.closeCount += 1;
    this.closed = true;
  }

  getTooltip() {
    return { getElement: () => this.element };
  }
}

/** A layer shaped enough for the controller, without Leaflet's nominal types. */
function layer(fake: FakeLayer) {
  return fake as unknown as Parameters<ReturnType<typeof createLinkedTooltipController>['track']>[0];
}

describe('linked marker tooltip lifecycle', () => {
  it('opens on hover and stays open after the pointer leaves the marker', () => {
    vi.useFakeTimers();
    try {
      const controller = createLinkedTooltipController();
      const fake = new FakeLayer();
      controller.track(layer(fake));

      fake.fire('mouseover');
      expect(fake.openCount).toBe(1);
      expect(fake.closed).toBe(false);

      // The pointer starts travelling toward the preview; the tooltip must survive
      // the crossing, because its anchor is that preview's hover source.
      fake.fire('mouseout');
      vi.advanceTimersByTime(LINKED_TOOLTIP_CLOSE_DELAY - 1);
      expect(fake.closed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('closes once the pointer has been away for the full delay', () => {
    vi.useFakeTimers();
    try {
      const controller = createLinkedTooltipController();
      const fake = new FakeLayer();
      controller.track(layer(fake));

      fake.fire('mouseover');
      fake.fire('mouseout');
      vi.advanceTimersByTime(LINKED_TOOLTIP_CLOSE_DELAY);

      expect(fake.closed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels the pending close while the pointer is over the tooltip', () => {
    vi.useFakeTimers();
    try {
      const controller = createLinkedTooltipController();
      const fake = new FakeLayer();
      controller.track(layer(fake));

      fake.fire('mouseover');
      fake.fire('mouseout');
      // The pointer arrived on the tooltip itself, so the close is abandoned.
      fake.element.fire('mouseover');
      vi.advanceTimersByTime(LINKED_TOOLTIP_CLOSE_DELAY * 3);

      expect(fake.closed).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('restarts the delay when the pointer returns to the tooltip and leaves again', () => {
    vi.useFakeTimers();
    try {
      const controller = createLinkedTooltipController();
      const fake = new FakeLayer();
      controller.track(layer(fake));

      fake.fire('mouseover');
      fake.fire('mouseout');
      vi.advanceTimersByTime(LINKED_TOOLTIP_CLOSE_DELAY - 1);
      fake.element.fire('mouseover');
      fake.element.fire('mouseout');
      vi.advanceTimersByTime(LINKED_TOOLTIP_CLOSE_DELAY - 1);
      expect(fake.closed).toBe(false);

      vi.advanceTimersByTime(1);
      expect(fake.closed).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps only one linked tooltip open, so travelling never strands a second', () => {
    const controller = createLinkedTooltipController();
    const first = new FakeLayer();
    const second = new FakeLayer();
    controller.track(layer(first));
    controller.track(layer(second));

    first.fire('mouseover');
    expect(first.openCount).toBe(1);

    second.fire('mouseover');
    expect(first.closed).toBe(true);
    expect(second.openCount).toBe(1);
    expect(second.closed).toBe(false);
  });

  it('closes on demand for map interaction and teardown', () => {
    const controller = createLinkedTooltipController();
    const fake = new FakeLayer();
    controller.track(layer(fake));
    fake.fire('mouseover');

    controller.closeAll();

    expect(fake.closed).toBe(true);
  });

  it('tracks a layer once, so repeated marker rebuilds do not stack handlers', () => {
    const controller = createLinkedTooltipController();
    const fake = new FakeLayer();

    controller.track(layer(fake));
    controller.track(layer(fake));
    fake.fire('mouseover');

    expect(fake.openCount).toBe(1);
  });
});
