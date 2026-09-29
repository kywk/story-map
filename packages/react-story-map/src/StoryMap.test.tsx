import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { StoryMapConfig, StorySlide } from '@story-map/story-map-core';
import { StoryMap } from './StoryMap.js';

function config(slide: StorySlide): StoryMapConfig {
  return {
    schema: 'storymap/v1',
    height: '400px',
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
