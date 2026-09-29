// Risk-register check: an ALREADY-PUBLISHED Docusaurus page serialized by a
// PRE-CHANGE build must still render under the new renderer. The client does
// JSON.parse with no schema re-validation, so the risk is a required key that
// old payloads lack. Verify by round-tripping a real pre-change payload shape
// through the new schema + renderer.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import {
  parseStoryMapSourceYaml,
  toStoryMapConfig,
  type StoryMapConfig,
} from '@story-map/story-map-core';
import { StoryMap } from './StoryMap.js';

// What a build from BEFORE the timeline milestone emitted: `layout.mode` is
// `card` | `full` only, slides carry no `date`, and nothing emits
// `data-timeline-side`. `panelOpacity` was already a REQUIRED `StoryMapConfig`
// field before this milestone (it landed with the panel-opacity work), so these
// payloads must include it — an older payload lacking it is a different concern.
const PRE_CHANGE_PAYLOADS: { label: string; payload: StoryMapConfig }[] = [
  {
    label: 'card layout, no slide dates',
    payload: {
      schema: 'storymap/v1',
      title: 'Old Card Story',
      height: '520px',
      panelOpacity: 0.85,
      map: {
        theme: 'light',
        zoom: 3,
        tileUrl: 'https://tile.example/{z}/{x}/{y}.png',
        attribution: 'Example',
        showPath: false,
      },
      layout: { mode: 'card', card: { align: 'left' }, full: { side: 'left', contentRatio: 0.5 } },
      initialSlide: 0,
      slides: [
        { title: 'One', text: 'First', location: { lat: 1, lng: 1 } },
        { title: 'Two', notePath: '/notes/two/', location: { lat: 2, lng: 2 } },
      ],
    },
  },
  {
    label: 'full layout, no slide dates',
    payload: {
      schema: 'storymap/v1',
      title: 'Old Full Story',
      height: '100%',
      panelOpacity: 0.85,
      map: {
        theme: 'auto',
        zoom: 4,
        tileUrl: 'https://tile.example/{z}/{x}/{y}.png',
        attribution: 'Example',
        showPath: true,
      },
      layout: { mode: 'full', card: { align: 'left' }, full: { side: 'right', contentRatio: 0.45 } },
      initialSlide: 1,
      slides: [
        { title: 'Alpha', text: 'body', location: { lat: 1, lng: 1 } },
        { title: 'Beta', text: 'body', notePath: '/notes/beta/', location: { lat: 2, lng: 2 } },
      ],
    },
  },
];

describe('pre-change serialized payloads still render', () => {
  for (const { label, payload } of PRE_CHANGE_PAYLOADS) {
    it(`renders a ${label} payload without throwing`, () => {
      // Round-trip exactly as the browser client does: JSON.parse, no re-validation.
      const decoded = JSON.parse(JSON.stringify(payload)) as typeof payload;
      expect(() => renderToStaticMarkup(createElement(StoryMap, { story: decoded }))).not.toThrow();
    });

    it(`keeps a ${label} payload on its original layout mode`, () => {
      const decoded = JSON.parse(JSON.stringify(payload)) as typeof payload;
      const html = renderToStaticMarkup(createElement(StoryMap, { story: decoded }));
      expect(html).toContain(`data-layout="${decoded.layout.mode}"`);
      // A pre-change payload must NOT gain a timeline attribute.
      expect(html).not.toContain('data-timeline-side');
      expect(html).not.toContain('story-map__timeline');
    });
  }

  it('the source parser still accepts old source YAML with no date and no timeline', () => {
    const source = parseStoryMapSourceYaml(`
title: Legacy
layout:
  mode: full
  full:
    side: right
    contentRatio: 0.4
slides:
  - title: A
    location: [1, 2]
  - title: B
    location: [3, 4]
`);
    const config = toStoryMapConfig(source, source.slides ?? []);
    expect(config.layout.mode).toBe('full');
    expect(config.slides.every((s) => s.date === undefined)).toBe(true);
    const html = renderToStaticMarkup(createElement(StoryMap, { story: config }));
    expect(html).toContain('data-layout="full"');
    expect(html).toContain('data-full-side="right"');
  });
});
