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
import { parseStoryMapSourceObject } from '@story-map/story-map-core';
import { VaultIndex } from './vault.js';
import { resolveObsidianStory } from '../../obsidian-story-map/src/resolver.js';
import type { App } from 'obsidian';

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
