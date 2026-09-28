import { describe, expect, it } from 'vitest';
import {
  StoryMapParseError,
  coerceLocation,
  coerceMedia,
  compareNoteDates,
  effectiveNoteDisplay,
  extractFencedBlock,
  extractFrontmatterTags,
  isPathInFolder,
  locationOnlySlide,
  matchesTagFilter,
  mergeResolvedSlide,
  parseStoryMapObject,
  parseStoryMapSourceObject,
  parseStoryMapSourceYaml,
  parseStoryMapYaml,
  parseWikiLinkRef,
  slideFromNoteFrontmatter,
  sortNoteDates,
  stripFrontmatter,
  toStoryMapConfig,
  toTimestamp,
  validCoordinates,
} from './index.js';

describe('parseStoryMapYaml', () => {
  it('parses canonical v1 syntax', () => {
    const story = parseStoryMapYaml(`
      title: Demo
      slides:
        - title: Taipei
          location: [25.033, 121.5654]
          zoom: 13
          media: ./taipei.jpg
    `);

    expect(story.schema).toBe('storymap/v1');
    expect(story.height).toBe('520px');
    expect(story.slides[0]?.location).toEqual({ lat: 25.033, lng: 121.5654, zoom: 13 });
    expect(story.slides[0]?.media).toEqual({ type: 'image', src: './taipei.jpg' });
  });

  it('normalizes Leaflet-style root keys', () => {
    const story = parseStoryMapYaml(`
      lat: 25.033
      long: 121.5654
      defaultZoom: 10
      tileServer: https://example.test/{z}/{x}/{y}.png
      slides:
        - title: Taipei
    `);

    expect(story.map.center).toEqual([25.033, 121.5654]);
    expect(story.map.zoom).toBe(10);
    expect(story.map.tileUrl).toContain('example.test');
    expect(story.map.attribution).toBe('© OpenStreetMap contributors');
    expect(story.map.showPath).toBe(true);
  });

  it('accepts lng as an alias for long', () => {
    const story = parseStoryMapYaml(`
      lat: 25.033
      lng: 121.5654
      slides:
        - title: Taipei
    `);

    expect(story.map.center).toEqual([25.033, 121.5654]);
  });

  it('coerces comma-separated string locations', () => {
    const story = parseStoryMapYaml(`
      slides:
        - title: Taipei
          location: "25.033, 121.5654"
          zoom: 11
    `);

    expect(story.slides[0]?.location).toEqual({ lat: 25.033, lng: 121.5654, zoom: 11 });
  });

  it('coerces object media with explicit type', () => {
    const story = parseStoryMapYaml(`
      slides:
        - media:
            type: video
            src: ./clip.mp4
            caption: On the road
    `);

    expect(story.slides[0]?.media).toEqual({
      type: 'video',
      src: './clip.mp4',
      caption: 'On the road',
    });
  });

  it('fails clearly on an invalid slide location', () => {
    expect(() => parseStoryMapYaml('slides:\n  - location: [999, 999]\n')).toThrow(
      StoryMapParseError,
    );
  });

  it('fails clearly on non-numeric slide coordinates', () => {
    expect(() => parseStoryMapYaml('slides:\n  - location: somewhere\n')).toThrow(
      /not a valid/,
    );
  });

  it('fails clearly on partial root coordinates', () => {
    expect(() => parseStoryMapYaml('lat: 25.033\nslides:\n  - title: Taipei\n')).toThrow(
      /Root coordinates/,
    );
  });
});

describe('parseStoryMapObject', () => {
  it('rejects out-of-range canonical coordinates', () => {
    expect(() =>
      parseStoryMapObject({
        slides: [{ location: { lat: 120, lng: 10 } }],
      }),
    ).toThrow(StoryMapParseError);
  });

  it('applies schema defaults', () => {
    const story = parseStoryMapObject({ slides: [{ title: 'One' }] });

    expect(story.schema).toBe('storymap/v1');
    expect(story.map.zoom).toBe(6);
    expect(story.map.tileUrl).toContain('openstreetmap.org');
    expect(story.map.theme).toBe('light');
    expect(story.layout).toEqual({
      mode: 'card',
      card: { align: 'left' },
      full: { side: 'left', contentRatio: 0.5 },
    });
  });
});

describe('theme and layout contract', () => {
  const oneSlide = [{ title: 'One' }];

  it.each(['auto', 'light', 'dark', 'vintage', 'cyber', 'atlas'])(
    'accepts the %s map theme',
    (theme) => {
      expect(parseStoryMapObject({ map: { theme }, slides: oneSlide }).map.theme).toBe(theme);
    },
  );

  it('rejects invalid map themes and layout modes', () => {
    expect(() => parseStoryMapObject({ map: { theme: 'sepia' }, slides: oneSlide })).toThrow(
      /theme/,
    );
    expect(() => parseStoryMapObject({ layout: { mode: 'sidebar' }, slides: oneSlide })).toThrow(
      /mode/,
    );
  });

  it('normalizes partial card and full options independently', () => {
    const story = parseStoryMapObject({
      layout: {
        mode: 'full',
        card: { align: 'center', widthRatio: 0.55, heightRatio: 0.72 },
        full: { side: 'right', contentRatio: 0.45 },
      },
      slides: oneSlide,
    });

    expect(story.layout).toEqual({
      mode: 'full',
      card: { align: 'center', widthRatio: 0.55, heightRatio: 0.72 },
      full: { side: 'right', contentRatio: 0.45 },
    });
    expect(parseStoryMapObject({ layout: { mode: 'full', full: {} }, slides: oneSlide }).layout)
      .toEqual({ mode: 'full', card: { align: 'left' }, full: { side: 'left', contentRatio: 0.5 } });
  });

  it.each([
    { card: { widthRatio: 0.19 } },
    { card: { widthRatio: 0.81 } },
    { card: { heightRatio: 0.19 } },
    { card: { heightRatio: 0.96 } },
    { full: { contentRatio: 0.29 } },
    { full: { contentRatio: 0.71 } },
  ])('rejects out-of-range ratios in %j', (layout) => {
    expect(() => parseStoryMapObject({ layout, slides: oneSlide })).toThrow();
  });

  it('accepts inclusive ratio boundaries', () => {
    const layout = parseStoryMapObject({
      layout: {
        card: { widthRatio: 0.20, heightRatio: 0.95 },
        full: { contentRatio: 0.70 },
      },
      slides: oneSlide,
    }).layout;
    expect(layout.card).toEqual({ align: 'left', widthRatio: 0.20, heightRatio: 0.95 });
    expect(layout.full).toEqual({ side: 'left', contentRatio: 0.70 });
  });
});

describe('coerceLocation', () => {
  it('reads frontmatter latitude/longitude aliases', () => {
    expect(coerceLocation({ latitude: 25.033, longitude: 121.5654, zoom: 9 })).toEqual({
      lat: 25.033,
      lng: 121.5654,
      zoom: 9,
    });
  });

  it('returns undefined for unsupported input instead of throwing', () => {
    expect(coerceLocation('not a place')).toBeUndefined();
    expect(coerceLocation(undefined)).toBeUndefined();
  });
});

describe('coerceMedia', () => {
  it('treats a bare string as an image', () => {
    expect(coerceMedia(' ./a.jpg ')).toEqual({ type: 'image', src: './a.jpg' });
  });

  it('ignores empty or invalid values', () => {
    expect(coerceMedia('')).toBeUndefined();
    expect(coerceMedia({ type: 'video' })).toBeUndefined();
  });
});

describe('mergeResolvedSlide', () => {
  it('lets explicit slide values win over resolved frontmatter', () => {
    const merged = mergeResolvedSlide(
      { title: 'Explicit', location: { lat: 1, lng: 2 } },
      { title: 'From note', text: 'Inherited', location: { lat: 9, lng: 9 } },
    );

    expect(merged.title).toBe('Explicit');
    expect(merged.text).toBe('Inherited');
    expect(merged.location).toEqual({ lat: 1, lng: 2 });
  });
});

describe('parseWikiLinkRef', () => {
  it('removes alias and heading', () => {
    expect(parseWikiLinkRef('[[Trips/Santiago#Food|Santiago]]')).toBe('Trips/Santiago');
  });

  it('removes embed and alias syntax', () => {
    expect(parseWikiLinkRef('![[assets/map.png|Map]]')).toBe('assets/map.png');
  });

  it('handles plain references and trims whitespace', () => {
    expect(parseWikiLinkRef('  Note Name  ')).toBe('Note Name');
  });
});

describe('validCoordinates', () => {
  it('checks finite ranges', () => {
    expect(validCoordinates(25.033, 121.5654)).toBe(true);
    expect(validCoordinates(91, 0)).toBe(false);
    expect(validCoordinates(0, 181)).toBe(false);
    expect(validCoordinates(Number.NaN, 0)).toBe(false);
  });
});

describe('parseStoryMapSourceYaml', () => {
  it('applies source defaults for order and dateField', () => {
    const source = parseStoryMapSourceYaml(`
      title: Chile
      noteFolder: Travel/Chile/Places
    `);

    expect(source.order).toBe('asc');
    expect(source.dateField).toBe('date-created');
    expect(source.noteFolder).toBe('Travel/Chile/Places');
    expect(source.slides).toBeUndefined();
  });

  it('accepts asc and desc orders', () => {
    expect(parseStoryMapSourceYaml('order: asc').order).toBe('asc');
    expect(parseStoryMapSourceYaml('order: desc').order).toBe('desc');
  });

  it('keeps explicit slides optional but preserves configured values', () => {
    const source = parseStoryMapSourceYaml(`
      noteFolder: Places
      slides:
        - note: "[[Santiago]]"
    `);

    expect(source.slides).toHaveLength(1);
    expect(source.slides?.[0]?.note).toBe('[[Santiago]]');
  });

  it('rejects invalid order values', () => {
    expect(() => parseStoryMapSourceYaml('order: sideways')).toThrow();
  });

  it('defaults noteDisplay to link and accepts basic or full', () => {
    expect(parseStoryMapSourceYaml('title: Chile').noteDisplay).toBe('link');
    expect(parseStoryMapSourceYaml('noteDisplay: basic').noteDisplay).toBe('basic');
    expect(parseStoryMapSourceYaml('noteDisplay: full').noteDisplay).toBe('full');
  });

  it('rejects invalid noteDisplay values', () => {
    expect(() => parseStoryMapSourceYaml('noteDisplay: fancy')).toThrow();
  });

  it('accepts an empty slides array', () => {
    const source = parseStoryMapSourceYaml('slides: []');
    expect(source.slides).toEqual([]);
  });
});

describe('includeTags and excludeTags', () => {
  it('parses tag arrays and keeps them out of the render config', () => {
    const source = parseStoryMapSourceYaml(
      ['noteFolder: Places', 'includeTags: [Travel, chile]', 'excludeTags: [draft]'].join('\n'),
    );

    expect(source.includeTags).toEqual(['Travel', 'chile']);
    expect(source.excludeTags).toEqual(['draft']);
  });

  it('coerces a comma or space separated tag string into a list', () => {
    expect(parseStoryMapSourceYaml('includeTags: Travel, chile').includeTags).toEqual([
      'Travel',
      'chile',
    ]);
    expect(parseStoryMapSourceYaml('excludeTags: draft').excludeTags).toEqual(['draft']);
  });

  it('leaves the keys unset when omitted', () => {
    const source = parseStoryMapSourceYaml('noteFolder: Places');
    expect(source.includeTags).toBeUndefined();
    expect(source.excludeTags).toBeUndefined();
  });

  it('is document-only and ignores plugin defaults', () => {
    const source = parseStoryMapSourceYaml('noteFolder: Places', {
      order: 'desc',
      noteDisplay: 'full',
    });
    expect(source.includeTags).toBeUndefined();
    expect(source.excludeTags).toBeUndefined();
  });
});

describe('extractFrontmatterTags', () => {
  it('reads tags and tag, arrays or strings, normalized and deduped', () => {
    expect(
      extractFrontmatterTags({ tags: ['#Travel', 'Chile', 'travel'], tag: 'draft notes' }),
    ).toEqual(['travel', 'chile', 'draft', 'notes']);
  });

  it('ignores missing or non-string values', () => {
    expect(extractFrontmatterTags({})).toEqual([]);
    expect(extractFrontmatterTags({ tags: 42 })).toEqual([]);
  });
});

describe('matchesTagFilter', () => {
  const note = { tags: ['travel', 'chile'] };

  it('accepts any note when no filter is configured', () => {
    expect(matchesTagFilter(note)).toBe(true);
    expect(matchesTagFilter({}, [], [])).toBe(true);
  });

  it('includes a note when it has any listed include tag', () => {
    expect(matchesTagFilter(note, ['chile'], undefined)).toBe(true);
    expect(matchesTagFilter(note, ['#Chile', 'peru'], undefined)).toBe(true);
    expect(matchesTagFilter(note, ['peru'], undefined)).toBe(false);
  });

  it('excludes a note when it has any listed exclude tag', () => {
    expect(matchesTagFilter(note, undefined, ['chile'])).toBe(false);
    expect(matchesTagFilter(note, undefined, ['peru'])).toBe(true);
  });

  it('applies include and exclude together', () => {
    expect(matchesTagFilter(note, ['travel'], ['draft'])).toBe(true);
    expect(matchesTagFilter(note, ['travel'], ['chile'])).toBe(false);
    expect(matchesTagFilter(note, ['peru'], undefined)).toBe(false);
  });
});

describe('effectiveNoteDisplay', () => {
  it('keeps the configured mode for card layouts', () => {
    expect(effectiveNoteDisplay('card', 'basic')).toBe('basic');
    expect(effectiveNoteDisplay('card', 'link')).toBe('link');
    expect(effectiveNoteDisplay('card', 'full')).toBe('full');
  });

  it('forces full mode for full layouts so the story surface shows the whole note', () => {
    expect(effectiveNoteDisplay('full', 'basic')).toBe('full');
    expect(effectiveNoteDisplay('full', 'link')).toBe('full');
    expect(effectiveNoteDisplay('full', 'full')).toBe('full');
  });
});

describe('locationOnlySlide', () => {
  it('keeps only the map location and marker hint from frontmatter fields', () => {
    expect(
      locationOnlySlide({
        title: 'Santiago',
        text: 'Summary.',
        location: { lat: 1, lng: 2 },
        media: { type: 'image', src: 'cover.jpg' },
        mapmarker: 'city',
        notePath: '/docs/santiago/',
      }),
    ).toEqual({ location: { lat: 1, lng: 2 }, mapmarker: 'city' });
  });

  it('returns an empty slide when no location survives', () => {
    expect(locationOnlySlide({ title: 'Santiago' })).toEqual({});
  });
});

describe('parseStoryMapSourceYaml defaults', () => {
  const defaults = {
    order: 'desc' as const,
    dateField: 'visited',
    noteDisplay: 'full' as const,
    map: { theme: 'dark' as const, zoom: 10, showPath: false, tileUrl: 'https://tiles.test/{z}/{x}/{y}.png' },
  };

  it('fills keys a document omits', () => {
    const source = parseStoryMapSourceYaml('map:\n  minZoom: 3\n', defaults);

    expect(source.order).toBe('desc');
    expect(source.dateField).toBe('visited');
    expect(source.noteDisplay).toBe('full');
    expect(source.map.zoom).toBe(10);
    expect(source.map.theme).toBe('dark');
    expect(source.map.showPath).toBe(false);
    expect(source.map.tileUrl).toBe('https://tiles.test/{z}/{x}/{y}.png');
    expect(source.map.minZoom).toBe(3);
  });

  it('lets document values win over defaults', () => {
    const source = parseStoryMapSourceYaml(
      [
        'order: asc',
        'dateField: date-created',
        'noteDisplay: basic',
        'map:',
        '  zoom: 4',
        '  theme: vintage',
        '  showPath: true',
      ].join('\n'),
      defaults,
    );

    expect(source.order).toBe('asc');
    expect(source.dateField).toBe('date-created');
    expect(source.noteDisplay).toBe('basic');
    expect(source.map.zoom).toBe(4);
    expect(source.map.theme).toBe('vintage');
    expect(source.map.showPath).toBe(true);
  });

  it('lets document Leaflet-style root keys win over map defaults', () => {
    const source = parseStoryMapSourceYaml(
      'lat: 1\nlong: 2\ndefaultZoom: 7\ntileServer: https://doc.test/{z}/{x}/{y}.png\n',
      defaults,
    );

    expect(source.map.center).toEqual([1, 2]);
    expect(source.map.zoom).toBe(7);
    expect(source.map.tileUrl).toBe('https://doc.test/{z}/{x}/{y}.png');
  });

  it('still applies code defaults when no defaults are provided', () => {
    const source = parseStoryMapSourceYaml('title: Only title');

    expect(source.order).toBe('asc');
    expect(source.dateField).toBe('date-created');
    expect(source.noteDisplay).toBe('link');
    expect(source.map.zoom).toBe(6);
    expect(source.map.theme).toBe('light');
    expect(source.layout.mode).toBe('card');
  });

  it('keeps layout document-owned when source defaults are supplied', () => {
    const source = parseStoryMapSourceYaml(
      'layout:\n  mode: full\n  full:\n    side: right\n    contentRatio: 0.6',
      defaults,
    );
    expect(source.layout).toEqual({
      mode: 'full',
      card: { align: 'left' },
      full: { side: 'right', contentRatio: 0.6 },
    });
  });
});

describe('toStoryMapConfig', () => {
  it('drops source-only keys and keeps a canonical config', () => {
    const source = parseStoryMapSourceObject({
      title: 'Chile',
      noteFolder: 'Places',
      slides: [],
    });

    const config = toStoryMapConfig(source, [{ title: 'Santiago' }]);

    expect(config).toEqual({
      schema: 'storymap/v1',
      title: 'Chile',
      height: '520px',
      map: {
        zoom: 6,
        theme: 'light',
        tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors',
        showPath: true,
      },
      layout: {
        mode: 'card',
        card: { align: 'left' },
        full: { side: 'left', contentRatio: 0.5 },
      },
      slides: [{ title: 'Santiago' }],
    });
    expect('noteFolder' in config).toBe(false);
  });

  it('copies the selected theme and document layout into the render config', () => {
    const source = parseStoryMapSourceObject({
      map: { theme: 'atlas' },
      layout: { mode: 'full', full: { side: 'right', contentRatio: 0.45 } },
    });

    const config = toStoryMapConfig(source, [{ title: 'Santiago' }]);
    expect(config.map.theme).toBe('atlas');
    expect(config.layout).toEqual({
      mode: 'full',
      card: { align: 'left' },
      full: { side: 'right', contentRatio: 0.45 },
    });
  });
});

describe('extractFencedBlock', () => {
  it('extracts a story-map fenced block case-insensitively', () => {
    const markdown = [
      '---',
      'story-map: true',
      '---',
      '',
      '```story-map',
      'title: Demo',
      '```',
      '',
      'After',
    ].join('\n');

    expect(extractFencedBlock(markdown, 'story-map')).toBe('title: Demo');
  });

  it('ignores other languages and returns null when absent', () => {
    expect(extractFencedBlock('```storymap\ntitle: Demo\n```', 'story-map')).toBeNull();
    expect(extractFencedBlock('no fences here', 'story-map')).toBeNull();
  });

  it('supports longer fences and tildes', () => {
    expect(extractFencedBlock('~~~story-map\ntitle: Demo\n~~~', 'story-map')).toBe('title: Demo');
    expect(extractFencedBlock('````story-map\ntitle: Demo\n````', 'story-map')).toBe('title: Demo');
  });
});

describe('toTimestamp', () => {
  it('parses dates, ISO strings, and epoch numbers', () => {
    expect(toTimestamp(new Date('2026-01-15T00:00:00.000Z'))).toBe(Date.UTC(2026, 0, 15));
    expect(toTimestamp('2026-01-15')).toBe(Date.UTC(2026, 0, 15));
    expect(toTimestamp(0)).toBe(0);
  });

  it('returns null for missing or unparseable values', () => {
    expect(toTimestamp(undefined)).toBeNull();
    expect(toTimestamp('')).toBeNull();
    expect(toTimestamp('not a date')).toBeNull();
    expect(toTimestamp(Number.NaN)).toBeNull();
  });
});

describe('sortNoteDates', () => {
  const older = { path: 'Places/a.md', date: Date.UTC(2026, 0, 1) };
  const newer = { path: 'Places/b.md', date: Date.UTC(2026, 5, 1) };
  const missing = { path: 'Places/c.md', date: null };
  const alsoMissing = { path: 'Places/d.md', date: null };

  it('sorts ascending with valid dates first and path ties ascending', () => {
    const sorted = sortNoteDates([missing, newer, older, alsoMissing], 'asc');
    expect(sorted.map((note) => note.path)).toEqual([
      'Places/a.md',
      'Places/b.md',
      'Places/c.md',
      'Places/d.md',
    ]);
  });

  it('sorts descending while keeping invalid dates last', () => {
    const sorted = sortNoteDates([older, missing, newer], 'desc');
    expect(sorted.map((note) => note.path)).toEqual([
      'Places/b.md',
      'Places/a.md',
      'Places/c.md',
    ]);
  });

  it('compares a missing date after a valid date regardless of order', () => {
    expect(compareNoteDates(missing, older, 'desc')).toBe(1);
  });

  it('does not mutate the input array', () => {
    const input = [newer, older];
    sortNoteDates(input, 'asc');
    expect(input).toEqual([newer, older]);
  });
});

describe('slideFromNoteFrontmatter', () => {
  it('maps Leaflet-compatible frontmatter into slide values', () => {
    const slide = slideFromNoteFrontmatter(
      {
        title: 'Santiago',
        location: [-33.4489, -70.6693],
        mapmarker: 'city',
        description: 'The start.',
        cover: './santiago.jpg',
      },
      'fallback',
    );

    expect(slide).toEqual({
      title: 'Santiago',
      text: 'The start.',
      location: { lat: -33.4489, lng: -70.6693 },
      media: { type: 'image', src: './santiago.jpg' },
      mapmarker: 'city',
    });
  });

  it('falls back to summary and the supplied title', () => {
    const slide = slideFromNoteFrontmatter({ summary: 'Summary text' }, 'Note Name');
    expect(slide.title).toBe('Note Name');
    expect(slide.text).toBe('Summary text');
  });
});

describe('stripFrontmatter', () => {
  it('removes a leading YAML frontmatter block', () => {
    expect(stripFrontmatter('---\ntitle: A\n---\n\nBody')).toBe('\nBody');
  });

  it('leaves content without frontmatter untouched', () => {
    expect(stripFrontmatter('# Title\n\nBody')).toBe('# Title\n\nBody');
    expect(stripFrontmatter('')).toBe('');
  });
});

describe('isPathInFolder', () => {
  it('matches nested files under a vault-relative folder', () => {
    expect(isPathInFolder('Places/Santiago.md', 'Places')).toBe(true);
    expect(isPathInFolder('Places/Chile/Santiago.md', 'Places')).toBe(true);
    expect(isPathInFolder('Places2/Santiago.md', 'Places')).toBe(false);
    expect(isPathInFolder('Places/Santiago.md', '/Places/')).toBe(true);
  });

  it('matches every file for a root folder', () => {
    expect(isPathInFolder('Anywhere/Note.md', '')).toBe(true);
  });
});
