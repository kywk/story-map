// Cross-host parity for slide dates and the timeline note-display carve-out.
//
// This is the milestone's highest-risk invariant: the Obsidian and Remark adapters
// must select the same notes, in the same order, with the same dates, for the same
// Vault — and must strip frontmatter identically. Each adapter's own suite pins its
// half, but nothing else would catch the two drifting apart.
//
// It lives here so vitest and @story-map/story-map-core resolve normally, and it
// imports the Obsidian adapter's SOURCE by relative path. Test-only: it touches no
// shipped file, and the published tarball contains only `dist/`.
import { describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseLeafletSourceYaml, parseStoryMapSourceObject } from '@story-map/story-map-core';
import { VaultIndex } from './vault.js';
import remarkStoryMap from './index.js';
import { resolveObsidianStory } from '../../obsidian-story-map/src/resolver.js';
import { resolveObsidianGeoMap } from '../../obsidian-story-map/src/leaflet-resolver.js';
import type { App } from 'obsidian';
import type { Code, Html, Root } from 'mdast';
import { LEAFLET_FIXTURES } from './fixtures.js';

interface FakeFile {
  path: string;
  frontmatter: Record<string, unknown>;
  body?: string;
}

const FIXTURE: FakeFile[] = [
  {
    path: 'Trips/2024-01-a.md',
    frontmatter: {
      'story-map-note': true,
      title: 'Alpha',
      description: 'alpha desc',
      location: [25.033, 121.5654],
      'date-created': '2024-01-15T00:00:00.000Z',
      'date-visited': '2024-06-01T00:00:00.000Z',
    },
    body: 'Alpha body.',
  },
  {
    path: 'Trips/2024-02-b.md',
    frontmatter: {
      'story-map-note': true,
      title: 'Bravo',
      description: 'bravo desc',
      location: [35.0116, 135.7681],
      'date-created': '2024-02-20T00:00:00.000Z',
    },
    body: 'Bravo body.',
  },
  {
    path: 'Trips/nested/2024-03-c.md',
    frontmatter: {
      'story-map-note': true,
      title: 'Charlie',
      description: 'charlie desc',
      location: [37.5665, 126.978],
      'date-created': '2024-03-25T00:00:00.000Z',
    },
    body: 'Charlie body.',
  },
  {
    path: 'Trips/2024-04-d.md',
    frontmatter: {
      'story-map-note': true,
      title: 'Delta',
      description: 'delta desc',
      location: [1.3521, 103.8198],
      'date-created': 'not a date',
    },
    body: 'Delta body.',
  },
  {
    path: 'Trips/ignore.md',
    frontmatter: { 'story-map-note': false, 'date-created': '2024-01-01T00:00:00.000Z' },
    body: 'ignored',
  },
];

const basename = (p: string) => (p.split('/').pop() ?? p).replace(/\.md$/i, '');
const normalizeLink = (v: string) => v.replace(/\\/g, '/').replace(/\.md$/i, '').toLowerCase();

function resolveRelative(dir: string, relative: string): string {
  const stack: string[] = [];
  for (const segment of `${dir}/${relative}`.split('/')) {
    if (!segment || segment === '.') continue;
    if (segment === '..') stack.pop();
    else stack.push(segment);
  }
  return stack.join('/');
}

function makeApp(files: FakeFile[]): App {
  const all = files.map((f) => ({ ...f, basename: basename(f.path) }));
  return {
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
          return all.find((f) => normalizeLink(f.path) === target) ?? null;
        }
        const ref = normalizeLink(normalized);
        const exact = all.find((f) => normalizeLink(f.path) === ref);
        if (exact) return exact;
        const base = ref.split('/').pop();
        return all.find((f) => f.basename.toLowerCase() === base) ?? null;
      },
    },
    vault: {
      getMarkdownFiles: () => all.filter((f) => f.path.toLowerCase().endsWith('.md')),
      getResourcePath: (file: { path: string }) => `app://vault/${file.path}`,
      cachedRead: (file: { body?: string }) => Promise.resolve(file.body ?? ''),
    },
  } as unknown as App;
}

function makeVaultRoot(files: FakeFile[]): string {
  const root = mkdtempSync(join(tmpdir(), 'story-map-parity-'));
  for (const file of files) {
    const abs = join(root, file.path);
    mkdirSync(dirname(abs), { recursive: true });
    const lines = Object.entries(file.frontmatter)
      .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
      .join('\n');
    writeFileSync(abs, `---\n${lines}\n---\n\n${file.body ?? ''}\n`);
  }
  return root;
}

type Row = { title?: string; date?: number; text?: string };
const rows = (slides: Row[]): Row[] =>
  slides.map((s) => ({ title: s.title, date: s.date }));

async function both(sourceObject: Record<string, unknown>) {
  const source = parseStoryMapSourceObject(sourceObject);
  const obsidian = await resolveObsidianStory(makeApp(FIXTURE), source, 'Trips/story-map.md');
  // A real Docusaurus host supplies resolveNoteHref (SPEC §6.3). Without it
  // Remark correctly omits notePath, so the harness must provide one to compare
  // link-bearing slides across hosts.
  const vault = new VaultIndex({
    vaultRoot: makeVaultRoot(FIXTURE),
    resolveNoteHref: (p) => `/notes/${p.replace(/\.md$/i, '')}`,
  });
  const remark = vault.resolveSource(source, 'Trips/story-map.md');
  return { obsidian, remark };
}

describe('cross-host date parity', () => {
  it('folder discovery, default dateField, asc', async () => {
    const { obsidian, remark } = await both({ title: 'P', noteFolder: 'Trips' });
    expect(obsidian.slides.map((s) => s.title)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    expect(rows(remark.slides)).toEqual(rows(obsidian.slides));
  });

  it('a non-default dateField moves both hosts together', async () => {
    const { obsidian, remark } = await both({
      title: 'P',
      noteFolder: 'Trips',
      dateField: 'date-visited',
    });
    // Only Alpha has date-visited; the rest sort last.
    expect(obsidian.slides[0]?.title).toBe('Alpha');
    expect(rows(remark.slides)).toEqual(rows(obsidian.slides));
  });

  it('descending order matches', async () => {
    const { obsidian, remark } = await both({
      title: 'P',
      noteFolder: 'Trips',
      order: 'desc',
    });
    // Dateless notes sort last in BOTH directions (existing `compareNoteDates`
    // behavior), so desc is Charlie, Bravo, Alpha, Delta — not Delta first.
    expect(obsidian.slides.map((s) => s.title)).toEqual(['Charlie', 'Bravo', 'Alpha', 'Delta']);
    expect(rows(remark.slides)).toEqual(rows(obsidian.slides));
  });

  it('an unparseable note date yields no date in either host', async () => {
    const { obsidian, remark } = await both({ title: 'P', noteFolder: 'Trips' });
    const deltaObsidian = obsidian.slides.find((s) => s.title === 'Delta');
    const deltaRemark = remark.slides.find((s) => s.title === 'Delta');
    expect(deltaObsidian?.date).toBeUndefined();
    expect(deltaRemark?.date).toBeUndefined();
  });

  it('timeline mode selects identically and keeps dates', async () => {
    const { obsidian, remark } = await both({
      title: 'P',
      noteFolder: 'Trips',
      layout: { mode: 'timeline' },
    });
    expect(rows(remark.slides)).toEqual(rows(obsidian.slides));
    expect(obsidian.slides[0]?.date).toBe(Date.UTC(2024, 0, 15));
  });

  it('timeline + noteDisplay full keeps title and date in BOTH hosts', async () => {
    const { obsidian, remark } = await both({
      title: 'P',
      noteFolder: 'Trips',
      layout: { mode: 'timeline' },
      noteDisplay: 'full',
    });
    for (const story of [obsidian, remark]) {
      const alpha = story.slides.find((s) => s.title === 'Alpha');
      expect(alpha?.title).toBe('Alpha');
      expect(alpha?.date).toBe(Date.UTC(2024, 0, 15));
      expect(alpha?.notePath).toBeTruthy();
      // the body text is still the slide text under full
      expect(alpha?.text).toContain('Alpha body.');
    }
    expect(rows(remark.slides)).toEqual(rows(obsidian.slides));
  });

  it('both hosts omit notePath when Remark cannot resolve a route (SPEC 6.3)', async () => {
    const source = parseStoryMapSourceObject({
      title: 'P',
      noteFolder: 'Trips',
      noteDisplay: 'link',
    });
    const obsidian = await resolveObsidianStory(makeApp(FIXTURE), source, 'Trips/story-map.md');
    const remark = new VaultIndex({ vaultRoot: makeVaultRoot(FIXTURE) }).resolveSource(
      source,
      'Trips/story-map.md',
    );
    // Obsidian always has a Vault path; Remark has none without a resolver.
    expect(obsidian.slides.every((s) => s.notePath)).toBe(true);
    expect(remark.slides.every((s) => !s.notePath)).toBe(true);
    expect(rows(remark.slides)).toEqual(rows(obsidian.slides));
  });

  it('card + noteDisplay full still strips in BOTH hosts (carve-out is narrow)', async () => {
    const { obsidian, remark } = await both({
      title: 'P',
      noteFolder: 'Trips',
      layout: { mode: 'card' },
      noteDisplay: 'full',
    });
    for (const story of [obsidian, remark]) {
      const alpha = story.slides.find((s) => s.title === 'Alpha');
      expect(alpha).toBeUndefined();
      expect(story.slides.every((s) => s.title === undefined)).toBe(true);
    }
  });

  it('full layout + noteDisplay full still strips in BOTH hosts', async () => {
    const { obsidian, remark } = await both({
      title: 'P',
      noteFolder: 'Trips',
      layout: { mode: 'full' },
      noteDisplay: 'full',
    });
    for (const story of [obsidian, remark]) {
      expect(story.slides.every((s) => s.title === undefined)).toBe(true);
    }
  });
});

// Cross-host parity for the `leaflet` dialect. The same promise as above, one
// layer down: an inline `leaflet` block in Obsidian and a `leaflet` node in
// Docusaurus must produce the same map - same center, zoom, tile source, markers,
// and titles - for the same authored source and the same notes. Only the note
// link is platform-specific by design: Obsidian carries a Vault path, Docusaurus
// a published href.
describe('cross-host leaflet parity', () => {
  /** The marker facts both hosts must agree on, minus the platform link. */
  function comparable(markers: Array<Record<string, unknown>>) {
    return markers.map((marker) => ({
      title: marker.title,
      type: marker.type,
      location: marker.location,
      description: marker.description,
      minZoom: marker.minZoom,
      maxZoom: marker.maxZoom,
    }));
  }

  /**
   * The four production fixtures, with a small note tree under each authored
   * `markerFolder`, run through both adapters and the real Remark transform.
   */
  function fixtureNotes(): FakeFile[] {
    const files: FakeFile[] = [];
    for (const fixture of LEAFLET_FIXTURES) {
      // `.md` is part of the path: the Obsidian fake App only hands back Markdown
      // files and the Remark scanner only indexes them, so both hosts must see a
      // real file name.
      files.push(
        {
          path: `${fixture.markerFolder}/Santiago.md`,
          frontmatter: { title: 'Santiago', location: [-33.4489, -70.6693], mapmarker: 'restaurant' },
          body: 'Santiago body.',
        },
        // A nested note proves both hosts walk subfolders.
        {
          path: `${fixture.markerFolder}/Regions/Valparaiso.md`,
          frontmatter: { title: 'Valparaiso', location: [-33.0472, -71.6127], mapzoom: [5, 18] },
          body: 'Valparaiso body.',
        },
        // No valid `location`: skipped by both hosts, never fatal.
        {
          path: `${fixture.markerFolder}/Index.md`,
          frontmatter: { title: 'Index' },
          body: 'Index body.',
        },
        // An unknown `mapmarker` still yields a marker with the authored name.
        {
          path: `${fixture.markerFolder}/Marathon.md`,
          frontmatter: { title: 'Marathon', location: [1, 2], mapmarker: 'marathon' },
          body: 'Marathon body.',
        },
        // Outside the folder.
        { path: 'elsewhere/Lima.md', frontmatter: { title: 'Lima', location: [-12, -77] }, body: 'Lima.' },
      );
    }
    return files;
  }

  function transformToGeoMap(fixtureIndex: number, files: FakeFile[]) {
    const fixture = LEAFLET_FIXTURES[fixtureIndex]!;
    const tree: Root = { type: 'root', children: [{ type: 'code', lang: 'leaflet', value: fixture.block }] };
    remarkStoryMap({ vaultRoot: makeVaultRoot(files) })(
      tree,
      { path: join('/vault', fixture.source) },
    );
    const node = tree.children[0] as Html;
    const match = /data-story-map-config="(.+?)"/.exec(node.value);
    if (!match?.[1]) throw new Error('Map host attribute missing');
    return JSON.parse(decodeURIComponent(match[1])) as {
      schema: string;
      id?: string;
      height: string;
      map: Record<string, unknown>;
      markers: Array<Record<string, unknown>>;
    };
  }

  for (const [index, fixture] of LEAFLET_FIXTURES.entries()) {
    it(`resolves the ${fixture.name} fixture identically in both hosts`, () => {
      const files = fixtureNotes();
      const source = parseLeafletSourceYaml(fixture.block);
      const obsidian = resolveObsidianGeoMap(makeApp(files), source);
      const remark = transformToGeoMap(index, files);

      expect(obsidian.schema).toBe('geomap/v1');
      expect(remark.schema).toBe('geomap/v1');
      // Authored identity, height, and the whole map option block.
      expect(obsidian.id).toBe(fixture.id);
      expect(remark.id).toBe(fixture.id);
      expect(obsidian.height).toBe(fixture.height);
      expect(remark.height).toBe(fixture.height);
      expect(remark.map).toEqual(obsidian.map);
      // Same selection, same order, same titles and types.
      expect(remark.markers.map((marker) => marker.title)).toEqual(
        obsidian.markers.map((marker) => marker.title),
      );
      expect(comparable(remark.markers)).toEqual(
        comparable(obsidian.markers as unknown as Array<Record<string, unknown>>),
      );
      // Both hosts skip the note without a location and keep the unknown type.
      expect(remark.markers.map((marker) => marker.title)).not.toContain('Index');
      expect(remark.markers.find((marker) => marker.title === 'Marathon')?.type).toBe('marathon');
      // `mapzoom` becomes marker zoom visibility in both hosts.
      expect(remark.markers.find((marker) => marker.title === 'Valparaiso')?.minZoom).toBe(5);
      expect(remark.markers.find((marker) => marker.title === 'Valparaiso')?.maxZoom).toBe(18);
    });
  }

  it('agrees on which notes a folder selects, in the same order', () => {
    const files = fixtureNotes();
    const fixture = LEAFLET_FIXTURES[0]!;
    const source = parseLeafletSourceYaml(fixture.block);
    const obsidian = resolveObsidianGeoMap(makeApp(files), source);
    const vault = new VaultIndex({ vaultRoot: makeVaultRoot(files) });
    const remark = vault.resolveLeafletSource(source);

    expect(remark.markers.map((marker) => marker.title)).toEqual(
      obsidian.markers.map((marker) => marker.title),
    );
    // Both hosts order by Vault path, so a re-scan cannot reshuffle markers.
    expect(remark.markers.map((marker) => marker.title)).toEqual([
      'Marathon',
      'Valparaiso',
      'Santiago',
    ]);
  });

  it('agrees on the built-in tile source and the unit/scale diagnostics', () => {
    const files = fixtureNotes();
    const fixture = LEAFLET_FIXTURES[0]!;
    const source = parseLeafletSourceYaml(fixture.block);
    const obsidian = resolveObsidianGeoMap(makeApp(files), source);
    const remark = new VaultIndex({ vaultRoot: makeVaultRoot(files) }).resolveLeafletSource(source);

    expect(remark.map.tiles).toEqual(obsidian.map.tiles);
    expect((remark.map.tiles as { light: { url: string } }).light.url).toBe(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    );
    // The compatibility metadata is reported, not dropped, in both hosts.
    const keys = (config: { diagnostics?: Array<{ key?: string }> }) =>
      (config.diagnostics ?? []).map((diagnostic) => diagnostic.key);
    expect(keys(remark)).toEqual(keys(obsidian));
    expect(keys(remark)).toEqual(expect.arrayContaining(['unit', 'scale', 'darkMode']));
  });

  it('keeps a marker unlinked in Docusaurus while Obsidian keeps its Vault path', () => {
    // The only intentional divergence: a published route is the host's authority.
    // With no resolver, Remark omits `notePath` rather than guessing a slug.
    const files = fixtureNotes();
    const fixture = LEAFLET_FIXTURES[0]!;
    const source = parseLeafletSourceYaml(fixture.block);
    const obsidian = resolveObsidianGeoMap(makeApp(files), source);
    const remark = new VaultIndex({ vaultRoot: makeVaultRoot(files) }).resolveLeafletSource(source);

    expect(obsidian.markers.every((marker) => marker.notePath)).toBe(true);
    expect(remark.markers.every((marker) => marker.notePath === undefined)).toBe(true);
    // Titles still match, so the two maps look the same apart from the link.
    expect(remark.markers.map((marker) => marker.title)).toEqual(
      obsidian.markers.map((marker) => marker.title),
    );
  });

  it('resolves the same markers from a host-supplied published route', () => {
    const files = fixtureNotes();
    const fixture = LEAFLET_FIXTURES[0]!;
    const source = parseLeafletSourceYaml(fixture.block);
    const obsidian = resolveObsidianGeoMap(makeApp(files), source);
    const remark = new VaultIndex({
      vaultRoot: makeVaultRoot(files),
      resolveNoteHref: (relativePath) => `/docs/${relativePath.toLowerCase()}/`,
    }).resolveLeafletSource(source);

    expect(remark.markers.every((marker) => marker.notePath?.startsWith('/docs/'))).toBe(true);
    // Note the extension-free, forward-slash key the host receives.
    expect(remark.markers[0]?.notePath).toBe('/docs/backpacker/2509 chile/chile/marathon/');
    // Selection and order are unaffected by route resolution.
    expect(remark.markers.map((marker) => marker.title)).toEqual(
      obsidian.markers.map((marker) => marker.title),
    );
  });

  it('leaves the story dialect untouched by the leaflet path', async () => {
    // One document carrying both dialects: each resolves through its own parser.
    const files = fixtureNotes();
    const tree: Root = {
      type: 'root',
      children: [
        { type: 'code', lang: 'story-map', value: 'title: Trip\nnoteFolder: Trips\n' },
        { type: 'code', lang: 'leaflet', value: LEAFLET_FIXTURES[0]!.block },
      ] satisfies Code[],
    };
    remarkStoryMap({ vaultRoot: makeVaultRoot(files) })(tree, { path: '/vault/Story.md' });

    const schemas = (tree.children as Html[]).map((node) => {
      const match = /data-story-map-config="(.+?)"/.exec(node.value);
      if (!match?.[1]) throw new Error('Host attribute missing');
      return (JSON.parse(decodeURIComponent(match[1])) as { schema: string }).schema;
    });
    expect(schemas).toEqual(['storymap/v1', 'geomap/v1']);
  });
});
