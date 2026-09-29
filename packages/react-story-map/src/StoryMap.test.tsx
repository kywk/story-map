import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StoryMapConfig, StorySlide } from '@story-map/story-map-core';
import { StoryMap } from './StoryMap.js';
import { formatTimelineDate } from './Timeline.js';

function config(slide: StorySlide): StoryMapConfig {
  return {
    schema: 'storymap/v1',
    height: '400px',
    panelOpacity: 0.85,
    map: {
      theme: 'light',
      zoom: 3,
      tileUrl: 'https://tile.example/{z}/{x}/{y}.png',
      attribution: 'Example',
      showPath: false,
    },
    layout: { mode: 'card', card: { align: 'left' }, full: { side: 'left', contentRatio: 0.5 } },
    slides: [slide],
  };
}

describe('StoryMap slide title', () => {
  it('renders a plain heading when the slide has no notePath', () => {
    const html = renderToStaticMarkup(<StoryMap story={config({ title: 'Santiago' })} />);

    expect(html).toContain('Santiago');
    expect(html).not.toContain('<a ');
  });

  it('renders a plain browser link when notePath has no callbacks', () => {
    const html = renderToStaticMarkup(
      <StoryMap story={config({ title: 'Santiago', notePath: '/docs/santiago/' })} />,
    );

    expect(html).toContain('href="/docs/santiago/"');
    expect(html).toContain('story-map__note-link');
  });

  it('renders an anchor when notePath and onNoteClick are provided', () => {
    const html = renderToStaticMarkup(
      <StoryMap
        story={config({ title: 'Santiago', notePath: '/docs/santiago/' })}
        onNoteClick={() => {}}
      />,
    );

    expect(html).toContain('href="/docs/santiago/"');
    expect(html).toContain('story-map__note-link');
  });
});

describe('StoryMap presentation', () => {
  it('renders the selected theme and full layout in SSR without initializing Leaflet', () => {
    const story = config({ title: 'Santiago' });
    story.map.theme = 'vintage';
    story.layout = { mode: 'full', card: { align: 'right' }, full: { side: 'right', contentRatio: 0.45 } };
    const html = renderToStaticMarkup(<StoryMap story={story} />);
    expect(html).toContain('data-map-theme="vintage"');
    expect(html).toContain('data-layout="full"');
    expect(html).toContain('data-full-side="right"');
    expect(html).toContain('--story-map-content-ratio:45%');
    expect(html).toContain('story-map__map');
  });

  it('renders card ratios and alignment without moving the map element', () => {
    const story = config({ title: 'Santiago' });
    story.layout.card = { align: 'center', widthRatio: 0.55, heightRatio: 0.72 };
    const html = renderToStaticMarkup(<StoryMap story={story} />);
    expect(html).toContain('data-card-align="center"');
    expect(html).toContain('--story-map-card-width:55%');
    expect(html).toContain('--story-map-card-height:72%');
    expect(html.indexOf('story-map__map')).toBeLessThan(html.indexOf('story-map__presentation'));
  });

  it('keeps text-button navigation inside the panel for card layouts', () => {
    const html = renderToStaticMarkup(<StoryMap story={config({ title: 'Santiago' })} />);
    expect(html).toContain('>Previous<');
    expect(html).toContain('>Next<');
    expect(html.indexOf('story-map__nav')).toBeGreaterThan(html.indexOf('story-map__panel'));
  });

  it('floats chevron navigation outside the panel for full layouts', () => {
    const story = config({ title: 'Santiago' });
    story.layout = { mode: 'full', card: { align: 'left' }, full: { side: 'left', contentRatio: 0.5 } };
    const html = renderToStaticMarkup(<StoryMap story={story} />);
    expect(html).toContain('aria-label="Previous">‹<');
    expect(html).toContain('aria-label="Next">›<');
    expect(html).not.toContain('>Previous<');
    expect(html.indexOf('story-map__nav')).toBeGreaterThan(html.indexOf('story-map__panel'));
  });
});

describe('StoryMap initial slide', () => {
  it('respects initialSlide from story config', () => {
    const story: StoryMapConfig = {
      ...config({ title: 'First' }),
      slides: [{ title: 'First' }, { title: 'Second' }, { title: 'Third' }],
      initialSlide: 2,
    };
    const html = renderToStaticMarkup(<StoryMap story={story} />);
    expect(html).toContain('Third');
    expect(html).toContain('3 / 3');
  });

  it('lets initialSlide prop override story config initialSlide', () => {
    const story: StoryMapConfig = {
      ...config({ title: 'First' }),
      slides: [{ title: 'First' }, { title: 'Second' }, { title: 'Third' }],
      initialSlide: 2,
    };
    const html = renderToStaticMarkup(<StoryMap story={story} initialSlide={1} />);
    expect(html).toContain('Second');
    expect(html).toContain('2 / 3');
  });
});

describe('StoryMap panelOpacity', () => {
  it('renders data-panel-opacity and style variable for panelOpacity', () => {
    const story = config({ title: 'Santiago' });
    story.panelOpacity = 0.5;
    const html = renderToStaticMarkup(<StoryMap story={story} />);
    expect(html).toContain('data-panel-opacity="0.5"');
    expect(html).toContain('--story-map-panel-opacity:0.5');
  });

  it('renders default panelOpacity of 0.85 when unchanged', () => {
    const story = config({ title: 'Santiago' });
    const html = renderToStaticMarkup(<StoryMap story={story} />);
    expect(html).toContain('data-panel-opacity="0.85"');
    expect(html).toContain('--story-map-panel-opacity:0.85');
  });
});

const TIMELINE_SLIDES: StorySlide[] = [
  { title: 'Leaving Home', date: 1712880000000, text: 'First **day** on the road.' },
  { title: 'On the Road', text: 'This stop has no frontmatter date.' },
  {
    title: 'Arriving',
    date: 1715558400000,
    media: { type: 'image', src: '/assets/arriving.jpg', alt: 'Arriving' },
    notePath: '/docs/arriving/',
  },
];

/** A timeline story that reuses `layout.full.side`/`contentRatio`; no timeline block exists. */
function timelineStory(slides: StorySlide[] = TIMELINE_SLIDES): StoryMapConfig {
  const story = config(slides[0]!);
  story.layout = { mode: 'timeline', card: { align: 'left' }, full: { side: 'right', contentRatio: 0.45 } };
  story.slides = slides;
  return story;
}

function timelineRows(html: string): string[] {
  return html.split('<li class="story-map__timeline-item"').slice(1);
}

function activeRowIndex(html: string): number {
  return timelineRows(html).findIndex((row) => row.includes('data-active'));
}

function classList(anchor: Record<string, string>): string[] {
  return (anchor['class'] ?? '').split(' ');
}

/** Every anchor opening tag as an attribute map, so two surfaces can be compared by shape. */
function anchors(html: string): Record<string, string>[] {
  return [...html.matchAll(/<a ([^>]*)>/g)].map((match) =>
    Object.fromEntries(
      (match[1] ?? '')
        .split(/\s+(?=[-\w]+=)/)
        .map((pair) => [pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 2, -1)]),
    ),
  );
}

describe('formatTimelineDate', () => {
  it('formats epoch milliseconds as a fixed en-US UTC date', () => {
    expect(formatTimelineDate(1712880000000)).toBe('Apr 12, 2024');
  });

  it('does not shift a UTC-midnight date to the previous day', () => {
    expect(formatTimelineDate(Date.parse('2024-01-01T00:00:00Z'))).toBe('Jan 1, 2024');
  });
});

describe('StoryMap timeline layout', () => {
  it('marks the timeline layout and the full side it reuses', () => {
    const html = renderToStaticMarkup(<StoryMap story={timelineStory()} />);
    expect(html).toContain('data-layout="timeline"');
    expect(html).toContain('data-timeline-side="right"');
  });

  it('renders every slide as a row, not only the active one', () => {
    const html = renderToStaticMarkup(<StoryMap story={timelineStory()} />);
    expect(timelineRows(html)).toHaveLength(3);
    for (const title of ['Leaving Home', 'On the Road', 'Arriving']) {
      expect(html).toMatch(new RegExp(`story-map__timeline-select"[^>]*>${title}</button>`));
    }
  });

  it('renders a UTC date chip per dated slide and omits it otherwise', () => {
    const html = renderToStaticMarkup(<StoryMap story={timelineStory()} />);
    // React serializes the `dateTime` prop verbatim (`dateTime`, not `datetime`);
    // HTML attribute names are case-insensitive, so the parsed DOM is the documented
    // `datetime` attribute. The UTC-midnight ISO value and the text are what matter.
    expect(html).toContain('2024-04-12T00:00:00.000Z"');
    expect(html).toContain('Apr 12, 2024');
    expect(timelineRows(html)[0]).toContain('story-map__timeline-date');
    expect(timelineRows(html)[1]).not.toContain('<time');
  });

  it('marks the active row and honours initialSlide', () => {
    const html = renderToStaticMarkup(<StoryMap story={timelineStory()} />);
    expect(activeRowIndex(html)).toBe(0);
    expect(timelineRows(html)[0]).toContain('aria-current="true"');
    expect(timelineRows(html)[1]).not.toContain('aria-current');

    const third = renderToStaticMarkup(<StoryMap story={timelineStory()} initialSlide={2} />);
    expect(activeRowIndex(third)).toBe(2);
    expect(timelineRows(third)[2]).toContain('aria-current="true"');
  });

  it('renders a thumbnail for image media only', () => {
    const html = renderToStaticMarkup(
      <StoryMap
        story={timelineStory([
          { title: 'Photo', media: { type: 'image', src: '/a.jpg' } },
          { title: 'Clip', media: { type: 'video', src: '/a.mp4' } },
          { title: 'Embed', media: { type: 'iframe', src: 'https://example.com/' } },
        ])}
      />,
    );
    expect(html.match(/story-map__timeline-media/g)).toHaveLength(1);
    expect(html).not.toContain('<video');
    expect(html).not.toContain('<iframe');
  });

  it('keeps a two-line clamped Markdown description per row', () => {
    const html = renderToStaticMarkup(<StoryMap story={timelineStory()} />);
    expect(html).toContain('story-map__timeline-text');
    expect(html).toContain('<strong>day</strong>');
  });

  it('drops prev/next navigation and keeps the map before the story column', () => {
    const html = renderToStaticMarkup(<StoryMap story={timelineStory()} />);
    expect(html).not.toContain('story-map__nav');
    expect(html).not.toContain('>Previous<');
    expect(html).not.toContain('>Next<');
    expect(html.indexOf('story-map__map')).toBeLessThan(html.indexOf('story-map__presentation'));
  });

  it('renders the story title in a sticky column header', () => {
    const story = timelineStory();
    story.title = 'Chile Trip';
    const html = renderToStaticMarkup(<StoryMap story={story} />);
    expect(html).toMatch(/story-map__story-title story-map__timeline-header">Chile Trip<\/div>/);
    expect(html.indexOf('story-map__timeline-header')).toBeLessThan(html.indexOf('story-map__timeline"'));
  });
});

describe('StoryMap timeline note links', () => {
  it('builds the chip anchor through the same helper as the panel title', () => {
    const slide: StorySlide = { title: 'Santiago', notePath: '/docs/santiago/' };
    const panel = anchors(
      renderToStaticMarkup(
        <StoryMap
          story={config(slide)}
          noteLinkClassName="internal-link"
          onNoteClick={() => {}}
          onNoteHover={() => {}}
        />,
      ),
    );
    const timeline = anchors(
      renderToStaticMarkup(
        <StoryMap
          story={timelineStory([slide])}
          noteLinkClassName="internal-link"
          onNoteClick={() => {}}
          onNoteHover={() => {}}
        />,
      ),
    );

    expect(panel).toHaveLength(1);
    expect(timeline).toHaveLength(1);
    const panelAnchor = panel[0] ?? {};
    const chipAnchor = timeline[0] ?? {};
    // Host callbacks present: both surfaces emit the same note-link attributes,
    // including the `data-href` Obsidian registers as a Page preview hover source.
    // The chip adds only its own visual class and an `aria-label`.
    for (const attribute of ['class', 'href', 'data-href'] as const) {
      expect(Object.keys(chipAnchor).sort()).toContain(attribute);
      expect(Object.keys(panelAnchor).sort()).toContain(attribute);
    }
    expect(chipAnchor['href']).toBe(panelAnchor['href']);
    expect(chipAnchor['data-href']).toBe(panelAnchor['data-href']);
    expect(classList(chipAnchor)).toEqual(
      expect.arrayContaining(['story-map__note-link', 'story-map__timeline-note', 'internal-link']),
    );
    expect(classList(panelAnchor)).toEqual(expect.arrayContaining(['story-map__note-link', 'internal-link']));
    expect(panelAnchor['aria-label']).toBeUndefined();
    expect(chipAnchor['aria-label']).toBe('Open note: Santiago');
  });

  it('falls back to a plain browser link for the chip without host callbacks', () => {
    const html = renderToStaticMarkup(
      <StoryMap story={timelineStory([{ title: 'Santiago', notePath: '/docs/santiago/' }])} />,
    );
    const chip = anchors(html)[0] ?? {};
    expect(chip['href']).toBe('/docs/santiago/');
    expect(chip['data-href']).toBeUndefined();
    expect(classList(chip)).toEqual(
      expect.arrayContaining(['story-map__note-link', 'story-map__timeline-note']),
    );
  });

  it('omits the chip when the slide has no notePath', () => {
    const html = renderToStaticMarkup(
      <StoryMap story={timelineStory([{ title: 'Santiago' }, { title: 'Valparaiso', notePath: '/v/' }])} />,
    );
    expect(timelineRows(html)[0]).not.toContain('story-map__timeline-note');
    expect(timelineRows(html)[1]).toContain('story-map__timeline-note');
  });

  it('emits the callback-variant anchor for the chip exactly like the panel title', () => {
    // `data-href` is the marker that the host-callback branch was taken — it is what
    // Obsidian registers as a Page-preview hover source, so it is the observable
    // proxy for "the callbacks are wired" without standing up a DOM. (A jsdom
    // dispatch test is not possible here: `jsdom` is not a dependency of this
    // package, and adding one is out of scope. The renderer package stays
    // SSR-only; the Obsidian host's own tests cover the callback round trip.)
    const withCallbacks = renderToStaticMarkup(
      <StoryMap
        story={timelineStory([{ title: 'Santiago', notePath: '/docs/santiago/' }])}
        onNoteClick={() => {}}
      />,
    );
    const withoutCallbacks = renderToStaticMarkup(
      <StoryMap story={timelineStory([{ title: 'Santiago', notePath: '/docs/santiago/' }])} />,
    );

    expect(anchors(withCallbacks)[0]?.['data-href']).toBe('/docs/santiago/');
    expect(anchors(withoutCallbacks)[0]?.['data-href']).toBeUndefined();
    // Both variants stay real navigable links, so a host without callbacks still works.
    expect(anchors(withCallbacks)[0]?.['href']).toBe('/docs/santiago/');
    expect(anchors(withoutCallbacks)[0]?.['href']).toBe('/docs/santiago/');
  });
});
