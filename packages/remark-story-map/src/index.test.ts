import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import type { Code, Html, Root } from 'mdast';
import { afterAll, describe, expect, it } from 'vitest';
import { parseStoryMapSourceObject } from '@story-map/story-map-core';
import remarkStoryMap, { VaultIndex } from './index.js';

function storyMapTree(value: string): Root {
  return {
    type: 'root',
    children: [{ type: 'code', lang: 'story-map', value }],
  };
}

function readConfig(html: Html): Record<string, unknown> {
  const match = /data-story-map-config="(.+?)"/.exec(html.value);
  if (!match?.[1]) throw new Error('StoryMap host attribute missing');
  return JSON.parse(decodeURIComponent(match[1])) as Record<string, unknown>;
}

describe('remarkStoryMap', () => {
  it('replaces a story-map fence with a serialized host element', () => {
    const tree = storyMapTree('title: Demo\nslides:\n  - title: One\n');

    remarkStoryMap()(tree);

    const node = tree.children[0] as Html;
    expect(node.type).toBe('html');
    expect(node.value).toContain('class="story-map-host"');

    const config = readConfig(node);
    expect(config.schema).toBe('storymap/v1');
    expect((config.slides as Array<{ title: string }>)[0]?.title).toBe('One');
  });

  it('serializes the canonical theme and layout for each host independently', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'code',
          lang: 'story-map',
          value: 'map:\n  theme: cyber\nlayout:\n  mode: full\n  full:\n    side: right\n    contentRatio: 0.6\nslides:\n  - title: First',
        },
        {
          type: 'code',
          lang: 'story-map',
          value: 'map:\n  theme: vintage\nlayout:\n  mode: card\n  card:\n    align: center\n    widthRatio: 0.5\nslides:\n  - title: Second',
        },
      ],
    };

    remarkStoryMap()(tree);

    const [first, second] = tree.children.map((node) => readConfig(node as Html));
    expect(first?.map).toMatchObject({ theme: 'cyber' });
    expect(first?.layout).toEqual({
      mode: 'full',
      card: { align: 'left' },
      full: { side: 'right', contentRatio: 0.6 },
    });
    expect(second?.map).toMatchObject({ theme: 'vintage' });
    expect(second?.layout).toEqual({
      mode: 'card',
      card: { align: 'center', widthRatio: 0.5 },
      full: { side: 'left', contentRatio: 0.5 },
    });
    expect(first?.slides).toEqual([{ title: 'First' }]);
    expect(second?.slides).toEqual([{ title: 'Second' }]);
  });

  it('ignores the legacy storymap fence', () => {
    const tree: Root = {
      type: 'root',
      children: [{ type: 'code', lang: 'storymap', value: 'title: Demo' }],
    };

    remarkStoryMap()(tree);

    expect((tree.children[0] as Code).lang).toBe('storymap');
  });

  it('leaves other fenced code blocks untouched', () => {
    const tree: Root = {
      type: 'root',
      children: [{ type: 'code', lang: 'yaml', value: 'title: Demo' }],
    };

    remarkStoryMap()(tree);

    expect(tree.children[0]).toEqual({ type: 'code', lang: 'yaml', value: 'title: Demo' } satisfies Code);
  });

  it('resolves note frontmatter when vaultRoot is configured', () => {
    const root = mkdtempSync(path.join(tmpdir(), 'storymap-remark-'));
    try {
      writeFileSync(
        path.join(root, 'Santiago.md'),
        matter.stringify('Body', {
          title: 'Santiago',
          location: [-33.4489, -70.6693],
          description: 'Intro',
          cover: './santiago.jpg',
        }),
      );

      const tree = storyMapTree('slides:\n  - note: "[[Santiago]]"\n');
      remarkStoryMap({ vaultRoot: root, assetBase: '/assets' })(tree);

      const config = readConfig(tree.children[0] as Html);
      const slide = (config.slides as Array<Record<string, unknown>>)[0];
      expect(slide?.title).toBe('Santiago');
      expect(slide?.text).toBe('Intro');
      expect(slide?.location).toEqual({ lat: -33.4489, lng: -70.6693 });
      expect(slide?.media).toEqual({ type: 'image', src: '/assets/santiago.jpg' });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('VaultIndex', () => {
  const vaultRoot = mkdtempSync(path.join(tmpdir(), 'storymap-vault-'));
  mkdirSync(path.join(vaultRoot, 'Trips'));
  writeFileSync(
    path.join(vaultRoot, 'Trips', 'Santiago.md'),
    matter.stringify('Body text', {
      title: 'Santiago',
      location: [-33.4489, -70.6693],
      description: 'A short introduction.',
      cover: './santiago.jpg',
      mapmarker: 'city',
    }),
  );

  afterAll(() => rmSync(vaultRoot, { recursive: true, force: true }));

  const baseStory = {
    schema: 'storymap/v1' as const,
    height: '520px',
    map: {
      zoom: 6,
      theme: 'light' as const,
      tileUrl: 'https://example.test/{z}/{x}/{y}.png',
      attribution: 'test',
      showPath: true,
    },
    layout: {
      mode: 'card' as const,
      card: { align: 'left' as const },
      full: { side: 'left' as const, contentRatio: 0.5 },
    },
    slides: [],
  };

  it('inherits frontmatter from a WikiLink note and resolves local media', () => {
    const vault = new VaultIndex({ vaultRoot, assetBase: '/vault-assets' });

    const story = vault.resolveStory({
      ...baseStory,
      slides: [{ note: '[[Santiago]]' }],
    });

    expect(story.slides[0]?.title).toBe('Santiago');
    expect(story.slides[0]?.text).toBe('A short introduction.');
    expect(story.slides[0]?.location).toEqual({ lat: -33.4489, lng: -70.6693 });
    expect(story.slides[0]?.media).toEqual({
      type: 'image',
      src: '/vault-assets/Trips/santiago.jpg',
    });
    expect(story.slides[0]?.mapmarker).toBe('city');
  });

  it('lets explicit slide values override note frontmatter', () => {
    const vault = new VaultIndex({ vaultRoot });

    const story = vault.resolveStory({
      ...baseStory,
      slides: [{ note: '[[Santiago]]', title: 'Explicit', location: { lat: 1, lng: 2 } }],
    });

    expect(story.slides[0]?.title).toBe('Explicit');
    expect(story.slides[0]?.location).toEqual({ lat: 1, lng: 2 });
  });

  it('throws when a basename WikiLink is ambiguous', () => {
    const otherRoot = mkdtempSync(path.join(tmpdir(), 'storymap-ambiguous-'));
    mkdirSync(path.join(otherRoot, 'a'));
    mkdirSync(path.join(otherRoot, 'b'));
    writeFileSync(path.join(otherRoot, 'a', 'Note.md'), '---\ntitle: A\n---\n');
    writeFileSync(path.join(otherRoot, 'b', 'Note.md'), '---\ntitle: B\n---\n');

    try {
      const vault = new VaultIndex({ vaultRoot: otherRoot });
      expect(() => vault.resolveStory({ ...baseStory, slides: [{ note: '[[Note]]' }] })).toThrow(
        /Ambiguous/,
      );
    } finally {
      rmSync(otherRoot, { recursive: true, force: true });
    }
  });
});

describe('VaultIndex folder discovery', () => {
  const vaultRoot = mkdtempSync(path.join(tmpdir(), 'storymap-folder-'));
  mkdirSync(path.join(vaultRoot, 'Places', 'Nested'), { recursive: true });
  writeFileSync(
    path.join(vaultRoot, 'Places', '2026-01 Santiago.md'),
    matter.stringify('Body', {
      'story-map-note': true,
      title: 'Santiago',
      'date-created': '2026-01-15',
      location: [-33.4489, -70.6693],
      cover: './santiago.jpg',
    }),
  );
  writeFileSync(
    path.join(vaultRoot, 'Places', 'Nested', '2026-02 Atacama.md'),
    matter.stringify('Body', { 'story-map-note': true, title: 'Atacama', 'date-created': '2026-02-20' }),
  );
  writeFileSync(path.join(vaultRoot, 'Places', 'No Flag.md'), matter.stringify('Body', { title: 'Ignored' }));
  writeFileSync(
    path.join(vaultRoot, 'Places', 'Undated.md'),
    matter.stringify('Body', { 'story-map-note': true, title: 'Undated' }),
  );
  writeFileSync(path.join(vaultRoot, 'Places', 'santiago.jpg'), 'fake');

  afterAll(() => rmSync(vaultRoot, { recursive: true, force: true }));

  it('recursively resolves flagged notes with date ordering and note-relative media', () => {
    const vault = new VaultIndex({ vaultRoot, assetBase: '/vault-assets' });
    const story = vault.resolveSource(
      parseStoryMapSourceObject({ noteFolder: 'Places' }),
    );

    expect(story.slides.map((slide) => slide.title)).toEqual(['Santiago', 'Atacama', 'Undated']);
    expect(story.slides[0]?.media).toEqual({
      type: 'image',
      src: '/vault-assets/Places/santiago.jpg',
    });
  });

  it('sorts descending while keeping undated notes last', () => {
    const vault = new VaultIndex({ vaultRoot });
    const story = vault.resolveSource(
      parseStoryMapSourceObject({ noteFolder: 'Places', order: 'desc' }),
    );

    expect(story.slides.map((slide) => slide.title)).toEqual(['Atacama', 'Santiago', 'Undated']);
  });

  it('does not append folder notes when explicit slides exist', () => {
    const vault = new VaultIndex({ vaultRoot });
    const story = vault.resolveSource(
      parseStoryMapSourceObject({ noteFolder: 'Places', slides: [{ title: 'Explicit' }] }),
    );

    expect(story.slides).toHaveLength(1);
    expect(story.slides[0]?.title).toBe('Explicit');
  });
});

describe('VaultIndex tag filtering', () => {
  const vaultRoot = mkdtempSync(path.join(tmpdir(), 'storymap-tags-'));
  mkdirSync(path.join(vaultRoot, 'Places'));

  writeFileSync(
    path.join(vaultRoot, 'Places', 'Santiago.md'),
    matter.stringify('Body', {
      'story-map-note': true,
      title: 'Santiago',
      'date-created': '2026-01-15',
      tags: ['travel', 'chile'],
    }),
  );
  writeFileSync(
    path.join(vaultRoot, 'Places', 'Atacama.md'),
    matter.stringify('Body', {
      'story-map-note': true,
      title: 'Atacama',
      'date-created': '2026-02-20',
      tags: ['travel', 'draft'],
    }),
  );
  writeFileSync(
    path.join(vaultRoot, 'Places', 'Lima.md'),
    matter.stringify('Body', {
      'story-map-note': true,
      title: 'Lima',
      'date-created': '2026-03-01',
      tag: 'peru',
    }),
  );

  afterAll(() => rmSync(vaultRoot, { recursive: true, force: true }));

  it('keeps only notes carrying any include tag', () => {
    const vault = new VaultIndex({ vaultRoot });
    const story = vault.resolveSource(
      parseStoryMapSourceObject({ noteFolder: 'Places', includeTags: ['#Chile'] }),
    );

    expect(story.slides.map((slide) => slide.title)).toEqual(['Santiago']);
  });

  it('drops notes carrying any exclude tag', () => {
    const vault = new VaultIndex({ vaultRoot });
    const story = vault.resolveSource(
      parseStoryMapSourceObject({ noteFolder: 'Places', excludeTags: ['draft'] }),
    );

    expect(story.slides.map((slide) => slide.title)).toEqual(['Santiago', 'Lima']);
  });
});

describe('VaultIndex noteDisplay', () => {
  const vaultRoot = mkdtempSync(path.join(tmpdir(), 'storymap-display-'));
  mkdirSync(path.join(vaultRoot, 'Places'));
  writeFileSync(
    path.join(vaultRoot, 'Places', 'Santiago.md'),
    [
      '---',
      'story-map-note: true',
      'title: Santiago',
      'date-created: 2026-01-15',
      'description: Frontmatter summary.',
      '---',
      '',
      '# Real body',
      '',
      'Full note text.',
    ].join('\n'),
  );

  afterAll(() => rmSync(vaultRoot, { recursive: true, force: true }));

  it('basic mode keeps frontmatter text and omits the note link', () => {
    const vault = new VaultIndex({ vaultRoot, resolveNoteHref: () => '/docs/santiago/' });
    const story = vault.resolveSource(parseStoryMapSourceObject({ noteFolder: 'Places', noteDisplay: 'basic' }));

    expect(story.slides[0]?.text).toBe('Frontmatter summary.');
    expect(story.slides[0]?.notePath).toBeUndefined();
  });

  it('link mode resolves the published href through the host callback', () => {
    const seen: string[] = [];
    const vault = new VaultIndex({
      vaultRoot,
      resolveNoteHref: (relativePath) => {
        seen.push(relativePath);
        return '/docs/places/santiago/';
      },
    });
    const story = vault.resolveSource(parseStoryMapSourceObject({ noteFolder: 'Places' }));

    expect(story.slides[0]?.notePath).toBe('/docs/places/santiago/');
    expect(seen).toEqual(['Places/Santiago']);
  });

  it('link mode omits the note link when no resolver is configured', () => {
    const vault = new VaultIndex({ vaultRoot });
    const story = vault.resolveSource(parseStoryMapSourceObject({ noteFolder: 'Places' }));

    expect(story.slides[0]?.notePath).toBeUndefined();
  });

  it('link mode omits the note link when the resolver cannot resolve it', () => {
    const vault = new VaultIndex({ vaultRoot, resolveNoteHref: () => undefined });
    const story = vault.resolveSource(parseStoryMapSourceObject({ noteFolder: 'Places' }));

    expect(story.slides[0]?.notePath).toBeUndefined();
  });

  it('full mode uses the frontmatter-stripped note body', () => {
    const vault = new VaultIndex({ vaultRoot, resolveNoteHref: () => '/docs/santiago/' });
    const story = vault.resolveSource(parseStoryMapSourceObject({ noteFolder: 'Places', noteDisplay: 'full' }));

    expect(story.slides[0]?.text).toBe('# Real body\n\nFull note text.');
    expect(story.slides[0]?.notePath).toBeUndefined();
  });

  it('applies full mode to an explicitly referenced note', () => {
    const vault = new VaultIndex({ vaultRoot });
    const story = vault.resolveSource(
      parseStoryMapSourceObject({ noteDisplay: 'full', slides: [{ note: '[[Santiago]]' }] }),
    );

    expect(story.slides[0]?.title).toBe('Santiago');
    expect(story.slides[0]?.text).toBe('# Real body\n\nFull note text.');
  });
});

describe('VaultIndex source-relative media', () => {
  const vaultRoot = mkdtempSync(path.join(tmpdir(), 'storymap-media-'));
  mkdirSync(path.join(vaultRoot, 'Stories', 'images'), { recursive: true });
  mkdirSync(path.join(vaultRoot, 'Places'));
  writeFileSync(path.join(vaultRoot, 'Stories', 'Trip.md'), '---\nstory-map: true\n---\n');
  writeFileSync(path.join(vaultRoot, 'Stories', 'images', 'photo.jpg'), 'fake');
  writeFileSync(path.join(vaultRoot, 'Places', 'Santiago.md'), matter.stringify('Body', { title: 'Santiago', cover: './santiago.jpg' }));
  writeFileSync(path.join(vaultRoot, 'Places', 'santiago.jpg'), 'fake');

  afterAll(() => rmSync(vaultRoot, { recursive: true, force: true }));

  it('resolves explicit slide media against the StoryMap source document', () => {
    const vault = new VaultIndex({ vaultRoot, assetBase: '/assets' });
    const sourcePath = path.join(vaultRoot, 'Stories', 'Trip.md');
    const story = vault.resolveSource(
      parseStoryMapSourceObject({ slides: [{ title: 'Explicit', media: './images/photo.jpg' }] }),
      sourcePath,
    );

    expect(story.slides[0]?.media).toEqual({ type: 'image', src: '/assets/Stories/images/photo.jpg' });
  });

  it('keeps note-derived media relative to the note', () => {
    const vault = new VaultIndex({ vaultRoot, assetBase: '/assets' });
    const sourcePath = path.join(vaultRoot, 'Stories', 'Trip.md');
    const story = vault.resolveSource(
      parseStoryMapSourceObject({ slides: [{ note: '[[Santiago]]' }] }),
      sourcePath,
    );

    expect(story.slides[0]?.media).toEqual({ type: 'image', src: '/assets/Places/santiago.jpg' });
  });

  it('prefers explicit slide media source over the referenced note', () => {
    const vault = new VaultIndex({ vaultRoot, assetBase: '/assets' });
    const sourcePath = path.join(vaultRoot, 'Stories', 'Trip.md');
    const story = vault.resolveSource(
      parseStoryMapSourceObject({ slides: [{ note: '[[Santiago]]', media: './images/photo.jpg' }] }),
      sourcePath,
    );

    expect(story.slides[0]?.media).toEqual({ type: 'image', src: '/assets/Stories/images/photo.jpg' });
  });
});

describe('VaultIndex scan exclusions', () => {
  const vaultRoot = mkdtempSync(path.join(tmpdir(), 'storymap-scan-'));
  for (const directory of ['node_modules/pkg', 'build', 'dist', 'coverage', '.hidden', 'Places']) {
    mkdirSync(path.join(vaultRoot, directory), { recursive: true });
    writeFileSync(
      path.join(vaultRoot, directory, 'Note.md'),
      matter.stringify('Body', { 'story-map-note': true, title: directory }),
    );
  }

  afterAll(() => rmSync(vaultRoot, { recursive: true, force: true }));

  it('skips tooling and output directories while keeping real content', () => {
    const vault = new VaultIndex({ vaultRoot });
    const story = vault.resolveSource(parseStoryMapSourceObject({ noteFolder: '/' }));

    expect(story.slides.map((slide) => slide.title)).toEqual(['Places']);
  });
});

describe('remarkStoryMap document flag', () => {
  it('marks hosts that come from a story-map: true document', () => {
    const tree = storyMapTree('title: Demo\nslides:\n  - title: One\n');

    remarkStoryMap()(tree, { path: '/vault/Story.md', data: { frontMatter: { 'story-map': true } } });

    expect((tree.children[0] as Html).value).toContain('data-story-map-document="true"');
  });

  it('does not mark hosts from an ordinary document', () => {
    const tree = storyMapTree('title: Demo\nslides:\n  - title: One\n');

    remarkStoryMap()(tree, { path: '/vault/Doc.md', data: { frontMatter: {} } });

    expect((tree.children[0] as Html).value).not.toContain('data-story-map-document');
  });
});

describe('remarkStoryMap host resolution', () => {
  it('resolves published hrefs and source-relative media from the VFile path', () => {
    const vaultRoot = mkdtempSync(path.join(tmpdir(), 'storymap-host-'));
    mkdirSync(path.join(vaultRoot, 'Stories', 'images'), { recursive: true });
    mkdirSync(path.join(vaultRoot, 'Places'));
    writeFileSync(path.join(vaultRoot, 'Stories', 'images', 'photo.jpg'), 'fake');
    writeFileSync(path.join(vaultRoot, 'Places', 'Santiago.md'), matter.stringify('Body', { title: 'Santiago' }));

    try {
      const tree = storyMapTree(
        ['noteDisplay: link', 'slides:', '  - note: "[[Santiago]]"', '  - title: Explicit', '    media: ./images/photo.jpg', ''].join('\n'),
      );
      const file = { path: path.join(vaultRoot, 'Stories', 'Trip.md') };
      const seen: string[] = [];

      remarkStoryMap({
        vaultRoot,
        assetBase: '/assets',
        resolveNoteHref: (relativePath) => {
          seen.push(relativePath);
          return relativePath === 'Places/Santiago' ? '/docs/places/santiago/' : undefined;
        },
      })(tree, file);

      const config = readConfig(tree.children[0] as Html);
      const slides = config.slides as Array<Record<string, unknown>>;
      expect(slides[0]?.notePath).toBe('/docs/places/santiago/');
      expect(slides[1]?.media).toEqual({ type: 'image', src: '/assets/Stories/images/photo.jpg' });
      expect(seen).toEqual(['Places/Santiago']);
      expect(JSON.stringify(config)).not.toContain(vaultRoot);
    } finally {
      rmSync(vaultRoot, { recursive: true, force: true });
    }
  });
});
