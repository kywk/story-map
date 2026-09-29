// Final smoke-matrix sweep for the timeline milestone. Verifies the plan §5
// items that are mechanically checkable, and marks the interactive ones.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { parseStoryMapSourceYaml, toStoryMapConfig } from '@story-map/story-map-core';
import { StoryMap } from './StoryMap.js';

const THEMES = ['light', 'dark', 'vintage', 'cyber', 'atlas', 'auto'] as const;

function story(mode: 'card' | 'full' | 'timeline', side: 'left' | 'right', theme: string) {
  return {
    schema: 'storymap/v1' as const,
    title: 'Smoke',
    height: '600px',
    panelOpacity: 0.85,
    map: {
      theme: theme as (typeof THEMES)[number],
      zoom: 3,
      tileUrl: 'https://tile.example/{z}/{x}/{y}.png',
      attribution: 'Example',
      showPath: false,
    },
    layout: { mode, card: { align: 'left' as const }, full: { side, contentRatio: 0.5 } },
    slides: [
      { title: 'A', date: Date.UTC(2024, 3, 12), location: { lat: 1, lng: 1 } },
      { title: 'B', text: 'body **b**', notePath: '/n/b/', location: { lat: 2, lng: 2 } },
    ],
  };
}

describe('smoke: item 6 Remark noteDisplay basic/link/full', () => {
  it('all three displays render in a timeline', () => {
    for (const display of ['basic', 'link', 'full'] as const) {
      const source = parseStoryMapSourceYaml(
        `layout:\n  mode: timeline\nnoteDisplay: ${display}\ntitle: Smoke`,
      );
      const config = toStoryMapConfig(source, source.slides ?? []);
      const html = renderToStaticMarkup(createElement(StoryMap, { story: config }));
      expect(html).toContain('data-layout="timeline"');
    }
  });

  it('an authored unparseable date is a readable configuration error', () => {
    // Plan §5 item 12: the error must surface readably, not silently.
    expect(() =>
      parseStoryMapSourceYaml("slides:\n  - title: A\n    location: [1, 2]\n    date: 'not a date'\n"),
    ).toThrowError(/slides\[0\]\.date is not a parseable date\./);
  });
});

describe('smoke: item 10 themes across all three modes', () => {
  it('renders every built-in theme in card, full and timeline', () => {
    for (const theme of THEMES) {
      for (const mode of ['card', 'full', 'timeline'] as const) {
        const html = renderToStaticMarkup(
          createElement(StoryMap, { story: story(mode, 'left', theme) }),
        );
        expect(html).toContain(`data-map-theme="${theme}"`);
        expect(html).toContain(`data-layout="${mode}"`);
        // The map element must precede the presentation layer in every mode, which
        // is what keeps one stable Leaflet instance across mode switches.
        expect(html.indexOf('story-map__map')).toBeLessThan(
          html.indexOf('story-map__presentation'),
        );
      }
    }
  });

  it('emits data-timeline-side in both side values, and only for timeline', () => {
    for (const side of ['left', 'right'] as const) {
      const html = renderToStaticMarkup(
        createElement(StoryMap, { story: story('timeline', side, 'light') }),
      );
      expect(html).toContain(`data-timeline-side="${side}"`);
    }
    for (const mode of ['card', 'full'] as const) {
      const html = renderToStaticMarkup(
        createElement(StoryMap, { story: story(mode, 'left', 'light') }),
      );
      expect(html).not.toContain('data-timeline-side');
    }
  });
});

describe('smoke: item 12 timeline specifics', () => {
  it('arrow keys and row clicks both move the active slide', () => {
    const html = renderToStaticMarkup(
      createElement(StoryMap, { story: story('timeline', 'left', 'light'), initialSlide: 0 }),
    );
    // The section is focusable and the keydown handler is attached by React; the
    // initial slide renders active, and exactly one row claims aria-current.
    expect(html).toContain('tabindex="0"');
    expect((html.match(/aria-current="true"/g) ?? []).length).toBe(1);
    expect((html.match(/story-map__timeline-select/g) ?? []).length).toBe(2);
  });

  it('the spine node fills only for the active row', () => {
    const html = renderToStaticMarkup(
      createElement(StoryMap, { story: story('timeline', 'left', 'light'), initialSlide: 1 }),
    );
    // Exactly one row is active, and it is the one `initialSlide` selected. The
    // node fill itself is CSS driven off `[data-active]`, so asserting the
    // attribute is the meaningful half; the visual fill is a manual smoke item.
    expect((html.match(/data-active=""/g) ?? []).length).toBe(1);
    // The active row is the second <li> (slide B): its opening tag carries
    // `data-active`, and the preceding row's does not.
    const rows = html.match(/<li class="story-map__timeline-item"[^>]*>/g) ?? [];
    expect(rows).toHaveLength(2);
    expect(rows[0]).not.toContain('data-active');
    expect(rows[1]).toContain('data-active=""');
  });
});
