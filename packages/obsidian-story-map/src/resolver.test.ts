import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import { parseStoryMapSourceObject, toTimestamp } from '@story-map/story-map-core';
import { resolveObsidianStory } from './resolver.js';

interface FakeFile {
  path: string;
  frontmatter: Record<string, unknown>;
  body?: string;
}

function basename(filePath: string): string {
  const name = filePath.split('/').pop() ?? filePath;
  return name.replace(/\.md$/i, '');
}

function normalizeLink(value: string): string {
  return value.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();
}

function resolveRelative(dir: string, relative: string): string {
  const segments = `${dir}/${relative}`.split('/');
  const stack: string[] = [];
  for (const segment of segments) {
    if (!segment || segment === '.') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }
  return stack.join('/');
}

function makeApp(files: FakeFile[]): App {
  const all = files.map((file) => ({ ...file, basename: basename(file.path) }));

  const app = {
    metadataCache: {
      getFileCache: (file: { frontmatter?: Record<string, unknown> }) => ({
        frontmatter: file.frontmatter ?? {},
      }),
      getFirstLinkpathDest: (link: string, sourcePath: string) => {
        const normalized = link.replace(/\\/g, '/');
        if (normalized.startsWith('./') || normalized.startsWith('../')) {
          const dir = sourcePath.includes('/')
            ? sourcePath.slice(0, sourcePath.lastIndexOf('/'))
            : '';
          const target = normalizeLink(resolveRelative(dir, normalized));
          return all.find((file) => normalizeLink(file.path) === target) ?? null;
        }
        const ref = normalizeLink(normalized);
        const exact = all.find((file) => normalizeLink(file.path) === ref);
        if (exact) return exact;
        const base = ref.split('/').pop();
        return all.find((file) => file.basename.toLowerCase() === base) ?? null;
      },
    },
    vault: {
      getMarkdownFiles: () => all.filter((file) => file.path.toLowerCase().endsWith('.md')),
      getResourcePath: (file: { path: string }) => `app://vault/${file.path}`,
      cachedRead: (file: { body?: string }) => Promise.resolve(file.body ?? ''),
    },
  };

  return app as unknown as App;
}

function note(path: string, frontmatter: Record<string, unknown>, body?: string): FakeFile {
  return { path, frontmatter, ...(body === undefined ? {} : { body }) };
}

describe('resolveObsidianStory with explicit slides', () => {
  const files: FakeFile[] = [
    note('Places/Santiago.md', {
      title: 'Santiago',
      location: [-33.4489, -70.6693],
      description: 'The starting point.',
      cover: './santiago.jpg',
      mapmarker: 'city',
    }),
    { path: 'Places/santiago.jpg', frontmatter: {} },
    note('Places/Valparaiso.md', { title: 'Valparaiso' }),
  ];

  it('resolves a WikiLink alias and inherits frontmatter', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      slides: [{ note: '[[Santiago|First stop]]' }],
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    const slide = story.slides[0];

    expect(slide?.title).toBe('Santiago');
    expect(slide?.text).toBe('The starting point.');
    expect(slide?.location).toEqual({ lat: -33.4489, lng: -70.6693 });
    expect(slide?.mapmarker).toBe('city');
    expect(slide?.media).toEqual({ type: 'image', src: 'app://vault/Places/santiago.jpg' });
  });

  it('resolves heading links', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      slides: [{ note: '[[Santiago#Food]]' }],
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides[0]?.title).toBe('Santiago');
  });

  it('lets explicit slide properties override note frontmatter', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      slides: [{ note: '[[Santiago]]', title: 'Explicit', location: [1, 2] }],
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides[0]?.title).toBe('Explicit');
    expect(story.slides[0]?.location).toEqual({ lat: 1, lng: 2 });
  });

  it('inherits the note dateField value and lets an authored date win', async () => {
    const app = makeApp([
      note('Places/Santiago.md', { title: 'Santiago', 'date-created': '2026-01-15' }),
    ]);
    const source = parseStoryMapSourceObject({
      slides: [{ note: '[[Santiago]]' }, { note: '[[Santiago]]', date: '1999-12-31' }],
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides[0]?.date).toBe(toTimestamp('2026-01-15'));
    expect(story.slides[1]?.date).toBe(toTimestamp('1999-12-31'));
  });

  it('reads the note date from a custom dateField', async () => {
    const app = makeApp([
      note('Places/Santiago.md', {
        title: 'Santiago',
        'date-created': '2026-01-15',
        'date-visited': '2024-04-12',
      }),
    ]);
    const source = parseStoryMapSourceObject({
      dateField: 'date-visited',
      slides: [{ note: '[[Santiago]]' }],
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides[0]?.date).toBe(toTimestamp('2024-04-12'));
  });
});

describe('resolveObsidianStory folder discovery', () => {
  const files: FakeFile[] = [
    note('Places/2026-01 Santiago.md', {
      'story-map-note': true,
      title: 'Santiago',
      'date-created': '2026-01-15',
      location: [-33.4489, -70.6693],
    }),
    note('Places/Nested/2026-02 Atacama.md', {
      'story-map-note': true,
      title: 'Atacama',
      'date-created': '2026-02-20',
    }),
    note('Places/No Flag.md', { title: 'Ignored' }),
    note('Places/Undated.md', { 'story-map-note': true, title: 'Undated' }),
    note('Elsewhere/2020 Old.md', {
      'story-map-note': true,
      'date-created': '2020-01-01',
    }),
  ];

  it('recursively discovers flagged notes and ignores unflagged or external ones', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({ noteFolder: 'Places' });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides.map((slide) => slide.title)).toEqual([
      'Santiago',
      'Atacama',
      'Undated',
    ]);
  });

  it('sorts descending while keeping undated notes last', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({ noteFolder: 'Places', order: 'desc' });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides.map((slide) => slide.title)).toEqual([
      'Atacama',
      'Santiago',
      'Undated',
    ]);
  });

  it('resolves initialSlide to the last slide when configured with initialSlide: last', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({ noteFolder: 'Places', order: 'asc', initialSlide: 'last' });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides.map((slide) => slide.title)).toEqual([
      'Santiago',
      'Atacama',
      'Undated',
    ]);
    expect(story.initialSlide).toBe(2);
  });

  it('honors a custom dateField', async () => {
    const app = makeApp([
      note('Places/A.md', { 'story-map-note': true, title: 'A', visited: '2026-03-01' }),
      note('Places/B.md', { 'story-map-note': true, title: 'B', visited: '2026-01-01' }),
    ]);
    const source = parseStoryMapSourceObject({ noteFolder: 'Places', dateField: 'visited' });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides.map((slide) => slide.title)).toEqual(['B', 'A']);
  });

  it('carries the discovered dateField value on each slide', async () => {
    const app = makeApp([
      note('Places/A.md', { 'story-map-note': true, title: 'A', 'date-created': '2026-01-15' }),
      // Obsidian hands unquoted YAML timestamps to the resolver as Date instances.
      note('Places/B.md', {
        'story-map-note': true,
        title: 'B',
        'date-created': new Date('2026-02-20T00:00:00Z'),
      }),
    ]);
    const source = parseStoryMapSourceObject({ noteFolder: 'Places' });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides.map((slide) => slide.date)).toEqual([
      toTimestamp('2026-01-15'),
      Date.UTC(2026, 1, 20),
    ]);
  });

  it('dateField moves which frontmatter key feeds both ordering and slide date', async () => {
    const app = makeApp([
      note('Places/A.md', {
        'story-map-note': true,
        title: 'A',
        'date-created': '2026-05-05',
        'date-visited': '2026-01-01',
      }),
      note('Places/B.md', {
        'story-map-note': true,
        title: 'B',
        'date-created': '2026-02-02',
        'date-visited': '2026-06-06',
      }),
    ]);

    const byCreated = await resolveObsidianStory(
      app,
      parseStoryMapSourceObject({ noteFolder: 'Places' }),
      'Story.md',
    );
    expect(byCreated.slides.map((slide) => slide.title)).toEqual(['B', 'A']);
    expect(byCreated.slides.map((slide) => slide.date)).toEqual([
      toTimestamp('2026-02-02'),
      toTimestamp('2026-05-05'),
    ]);

    const byVisited = await resolveObsidianStory(
      app,
      parseStoryMapSourceObject({ noteFolder: 'Places', dateField: 'date-visited' }),
      'Story.md',
    );
    expect(byVisited.slides.map((slide) => slide.title)).toEqual(['A', 'B']);
    expect(byVisited.slides.map((slide) => slide.date)).toEqual([
      toTimestamp('2026-01-01'),
      toTimestamp('2026-06-06'),
    ]);
  });

  it('discovers a note with an unparseable dateField value and gives it no date', async () => {
    const app = makeApp([
      note('Places/A.md', { 'story-map-note': true, title: 'A', 'date-created': '2026-01-15' }),
      note('Places/B.md', {
        'story-map-note': true,
        title: 'B',
        'date-created': 'sometime in spring',
      }),
    ]);
    const source = parseStoryMapSourceObject({ noteFolder: 'Places' });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides.map((slide) => slide.title)).toEqual(['A', 'B']);
    expect(story.slides[0]?.date).toBe(toTimestamp('2026-01-15'));
    expect(Object.keys(story.slides[1] ?? {})).not.toContain('date');
  });

  it('does not append folder notes when explicit slides exist', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      noteFolder: 'Places',
      slides: [{ title: 'Only explicit' }],
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides).toHaveLength(1);
    expect(story.slides[0]?.title).toBe('Only explicit');
  });
});

describe('resolveObsidianStory tag filtering', () => {
  const files: FakeFile[] = [
    note('Places/Santiago.md', {
      'story-map-note': true,
      title: 'Santiago',
      'date-created': '2026-01-15',
      tags: ['travel', 'chile'],
    }),
    note('Places/Atacama.md', {
      'story-map-note': true,
      title: 'Atacama',
      'date-created': '2026-02-20',
      tags: ['travel', 'draft'],
    }),
    note('Places/Lima.md', {
      'story-map-note': true,
      title: 'Lima',
      'date-created': '2026-03-01',
      tag: 'peru',
    }),
    note('Places/Untagged.md', {
      'story-map-note': true,
      title: 'Untagged',
      'date-created': '2026-04-01',
    }),
  ];

  it('keeps only notes carrying any include tag', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({ noteFolder: 'Places', includeTags: ['#Chile'] });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides.map((slide) => slide.title)).toEqual(['Santiago']);
  });

  it('drops notes carrying any exclude tag', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({ noteFolder: 'Places', excludeTags: ['draft'] });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides.map((slide) => slide.title)).toEqual([
      'Santiago',
      'Lima',
      'Untagged',
    ]);
  });

  it('combines include and exclude filters', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      noteFolder: 'Places',
      includeTags: ['travel'],
      excludeTags: ['draft'],
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides.map((slide) => slide.title)).toEqual(['Santiago']);
  });

  it('does not filter explicit slides', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      noteFolder: 'Places',
      includeTags: ['nonexistent'],
      slides: [{ title: 'Explicit' }],
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');
    expect(story.slides.map((slide) => slide.title)).toEqual(['Explicit']);
  });
});

describe('resolveObsidianStory noteDisplay', () => {
  const body = [
    '---',
    'unused: true',
    '---',
    '',
    '# Real body',
    '',
    'Full note text.',
  ].join('\n');
  const files: FakeFile[] = [
    note(
      'Places/Santiago.md',
      {
        'story-map-note': true,
        title: 'Santiago',
        'date-created': '2026-01-15',
        description: 'Frontmatter summary.',
        cover: 'cover.jpg',
      },
      body,
    ),
  ];

  it('defaults to link mode and attaches the source note path', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({ noteFolder: 'Places' });

    const story = await resolveObsidianStory(app, source, 'Story.md');

    expect(source.noteDisplay).toBe('link');
    expect(story.slides[0]?.notePath).toBe('Places/Santiago.md');
    expect(story.slides[0]?.text).toBe('Frontmatter summary.');
    expect(story.slides[0]?.media).toEqual({ type: 'image', src: 'cover.jpg' });
  });

  it('basic mode omits the note link and keeps frontmatter text', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({ noteFolder: 'Places', noteDisplay: 'basic' });

    const story = await resolveObsidianStory(app, source, 'Story.md');

    expect(story.slides[0]?.notePath).toBeUndefined();
    expect(story.slides[0]?.text).toBe('Frontmatter summary.');
  });

  it('full mode shows the body only and drops frontmatter title and cover', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({ noteFolder: 'Places', noteDisplay: 'full' });

    const story = await resolveObsidianStory(app, source, 'Story.md');

    expect(story.slides[0]?.notePath).toBe('Places/Santiago.md');
    expect(story.slides[0]?.title).toBeUndefined();
    expect(story.slides[0]?.media).toBeUndefined();
    expect(story.slides[0]?.text).toBe('# Real body\n\nFull note text.');
  });

  it('full layout forces the note body even when link mode is configured', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      noteFolder: 'Places',
      noteDisplay: 'link',
      layout: { mode: 'full' },
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');

    expect(story.slides[0]?.notePath).toBe('Places/Santiago.md');
    expect(story.slides[0]?.title).toBeUndefined();
    expect(story.slides[0]?.media).toBeUndefined();
    expect(story.slides[0]?.text).toBe('# Real body\n\nFull note text.');
  });

  it('full mode keeps a title the story document set explicitly', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      noteDisplay: 'full',
      slides: [{ note: '[[Santiago]]', title: 'Kept title' }],
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');

    expect(story.slides[0]?.title).toBe('Kept title');
    expect(story.slides[0]?.text).toBe('# Real body\n\nFull note text.');
  });

  it('applies full mode to explicitly referenced notes', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      noteDisplay: 'full',
      slides: [{ note: '[[Santiago]]' }],
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');

    expect(story.slides[0]?.text).toBe('# Real body\n\nFull note text.');
  });
});

describe('resolveObsidianStory timeline layout', () => {
  const body = [
    '---',
    'unused: true',
    '---',
    '',
    '# Real body',
    '',
    'Full note text.',
  ].join('\n');
  const files: FakeFile[] = [
    note(
      'Places/Santiago.md',
      {
        'story-map-note': true,
        title: 'Santiago',
        'date-created': '2026-01-15',
        description: 'Frontmatter summary.',
        cover: 'cover.jpg',
        location: [-33.4489, -70.6693],
        mapmarker: 'city',
      },
      body,
    ),
    { path: 'Places/cover.jpg', frontmatter: {} },
  ];
  const cover = { type: 'image', src: 'app://vault/Places/cover.jpg' };
  const bodyText = '# Real body\n\nFull note text.';

  it('keeps frontmatter basics in link mode, which timeline does not force to full', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      noteFolder: 'Places',
      layout: { mode: 'timeline' },
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');

    expect(source.noteDisplay).toBe('link');
    expect(story.slides[0]?.text).toBe('Frontmatter summary.');
    expect(story.slides[0]?.media).toEqual(cover);
    expect(story.slides[0]?.notePath).toBe('Places/Santiago.md');
    expect(story.slides[0]?.date).toBe(toTimestamp('2026-01-15'));
  });

  it('keeps title, cover, date, and notePath next to the body in full mode', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      noteFolder: 'Places',
      noteDisplay: 'full',
      layout: { mode: 'timeline' },
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');

    expect(story.slides[0]?.title).toBe('Santiago');
    expect(story.slides[0]?.media).toEqual(cover);
    expect(story.slides[0]?.date).toBe(toTimestamp('2026-01-15'));
    expect(story.slides[0]?.notePath).toBe('Places/Santiago.md');
    expect(story.slides[0]?.text).toBe(bodyText);
  });

  it('keeps frontmatter on an explicitly referenced note in a full mode timeline', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      noteDisplay: 'full',
      layout: { mode: 'timeline' },
      slides: [{ note: '[[Santiago]]' }],
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');

    expect(story.slides[0]?.title).toBe('Santiago');
    expect(story.slides[0]?.media).toEqual(cover);
    expect(story.slides[0]?.date).toBe(toTimestamp('2026-01-15'));
    expect(story.slides[0]?.notePath).toBe('Places/Santiago.md');
    expect(story.slides[0]?.text).toBe(bodyText);
  });

  it('still strips card mode down to the location in full mode', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      noteFolder: 'Places',
      noteDisplay: 'full',
      layout: { mode: 'card' },
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');

    expect(story.slides[0]?.title).toBeUndefined();
    expect(story.slides[0]?.media).toBeUndefined();
    expect(story.slides[0]?.date).toBeUndefined();
    expect(story.slides[0]?.location).toEqual({ lat: -33.4489, lng: -70.6693 });
    expect(story.slides[0]?.mapmarker).toBe('city');
    expect(story.slides[0]?.notePath).toBe('Places/Santiago.md');
    expect(story.slides[0]?.text).toBe(bodyText);
  });

  it('still strips the full layout down to the location in full mode', async () => {
    const app = makeApp(files);
    const source = parseStoryMapSourceObject({
      noteFolder: 'Places',
      noteDisplay: 'full',
      layout: { mode: 'full' },
    });

    const story = await resolveObsidianStory(app, source, 'Story.md');

    expect(story.slides[0]?.title).toBeUndefined();
    expect(story.slides[0]?.media).toBeUndefined();
    expect(story.slides[0]?.date).toBeUndefined();
    expect(story.slides[0]?.location).toEqual({ lat: -33.4489, lng: -70.6693 });
    expect(story.slides[0]?.mapmarker).toBe('city');
    expect(story.slides[0]?.notePath).toBe('Places/Santiago.md');
    expect(story.slides[0]?.text).toBe(bodyText);
  });
});
