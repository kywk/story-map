import { describe, expect, it } from 'vitest';
import type { StoryMapLayoutOptions } from '@story-map/story-map-core';
import { focusPixelOffset, getMarkerFocus } from './markerOffset.js';

function layout(
  mode: StoryMapLayoutOptions['mode'],
  cardAlign: StoryMapLayoutOptions['card']['align'] = 'left',
  side: StoryMapLayoutOptions['full']['side'] = 'left',
  contentRatio = 0.5,
): StoryMapLayoutOptions {
  return { mode, card: { align: cardAlign }, full: { side, contentRatio } };
}

const DESKTOP = 1280;
const NARROW = 500;

describe('getMarkerFocus', () => {
  it('parks the marker at the top quarter for centered cards', () => {
    expect(getMarkerFocus(layout('card', 'center'), DESKTOP)).toEqual({ fx: 0.5, fy: 0.25 });
  });

  it('keeps the marker centered for side cards on wide viewports', () => {
    expect(getMarkerFocus(layout('card', 'left'), DESKTOP)).toEqual({ fx: 0.5, fy: 0.5 });
    expect(getMarkerFocus(layout('card', 'right'), DESKTOP)).toEqual({ fx: 0.5, fy: 0.5 });
  });

  it('uses the top quarter for every card alignment on narrow viewports', () => {
    for (const align of ['left', 'center', 'right'] as const) {
      expect(getMarkerFocus(layout('card', align), NARROW)).toEqual({ fx: 0.5, fy: 0.25 });
    }
  });

  it('centers the marker in the remaining map width for full layouts', () => {
    expect(getMarkerFocus(layout('full', 'left', 'left', 0.5), DESKTOP)).toEqual({ fx: 0.75, fy: 0.5 });
    expect(getMarkerFocus(layout('full', 'left', 'right', 0.5), DESKTOP)).toEqual({ fx: 0.25, fy: 0.5 });
    expect(getMarkerFocus(layout('full', 'left', 'left', 0.3), DESKTOP).fx).toBeCloseTo(0.65, 10);
    expect(getMarkerFocus(layout('full', 'left', 'right', 0.7), DESKTOP).fx).toBeCloseTo(0.15, 10);
  });

  it('uses the top band for full layouts on narrow viewports', () => {
    expect(getMarkerFocus(layout('full', 'left', 'left'), NARROW)).toEqual({ fx: 0.5, fy: 0.12 });
    expect(getMarkerFocus(layout('full', 'left', 'right'), NARROW)).toEqual({ fx: 0.5, fy: 0.12 });
  });
});

describe('focusPixelOffset', () => {
  it('converts focus fractions to a container-center offset', () => {
    expect(focusPixelOffset({ width: 1000, height: 800 }, { fx: 0.5, fy: 0.25 })).toEqual({ x: 0, y: -200 });
    expect(focusPixelOffset({ width: 1000, height: 800 }, { fx: 0.75, fy: 0.5 })).toEqual({ x: 250, y: 0 });
  });

  it('returns zero offset for zero-size containers', () => {
    expect(focusPixelOffset({ width: 0, height: 800 }, { fx: 0.75, fy: 0.5 })).toEqual({ x: 0, y: 0 });
  });
});
