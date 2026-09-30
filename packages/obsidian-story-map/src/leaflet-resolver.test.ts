import { describe, expect, it } from 'vitest';
import type { App } from 'obsidian';
import {
  DEFAULT_LEAFLET_HEIGHT,
  DEFAULT_TILE_URL,
  LEAFLET_DIAGNOSTIC_CODES,
  parseLeafletSourceYaml,
  type LeafletSourceDefaults,
  type MarkerTypeDefinition,
} from '@story-map/story-map-core';
import { resolveMarkerFolder, resolveObsidianGeoMap } from './leaflet-resolver.js';

interface FakeFile {
  path: string;
  frontmatter: Record<string, unknown>;
}

function basename(filePath: string): string {
  const name = filePath.split('/').pop() ?? filePath;
  return name.replace(/\.md$/i, '');
}

/** Mirrors `resolver.test.ts`: only the Vault surface the leaflet path reads. */
function makeApp(files: FakeFile[]): App {
  const all = files.map((file) => ({ ...file, basename: basename(file.path) }));
  return {
    metadataCache: {
      getFileCache: (file: { frontmatter?: Record<string, unknown> }) => ({
        frontmatter: file.frontmatter ?? {},
      }),
    },
    vault: {
      getMarkdownFiles: () => all.filter((file) => file.path.toLowerCase().endsWith('.md')),
    },
  } as unknown as App;
}

function note(path: string, frontmatter: Record<string, unknown>): FakeFile {
  return { path, frontmatter };
}

const TYPES: MarkerTypeDefinition[] = [
  { id: 'default' },
  { id: 'restaurant', color: '#b45309', icon: { kind: 'symbol', value: '🍴' } },
  { id: 'shop', tags: ['shopping'] },
  { id: 'deep', minZoom: 10, maxZoom: 14 },
];

function defaults(overrides: LeafletSourceDefaults = {}): LeafletSourceDefaults {
  return { tooltip: 'hover', ...overrides };
}

describe('markerFolder resolution', () => {
  const app = makeApp([
    note('Trips/Chile/Santiago.md', {
      title: 'Santiago',
      location: [-33.4489, -70.6693],
      description: 'The starting point.',
      mapmarker: 'restaurant',
    }),
    note('Trips/Chile/Nested/Valparaiso.md', {
      title: 'Valparaiso',
      location: [-33.0472, -71.6127],
      mapzoom: [8, 16],
    }),
    note('Trips/Chile/Nested/Assets/photo.md', { title: 'Photo', location: [-33, -70] }),
    note('Trips/Chile/Index.md', { title: 'Index', 'story-map-note': true }),
    note('Other/Quito.md', { title: 'Quito', location: [-0.18, -78.47] }),
    note('Trips/Chile/NotAMarkdown.txt', { title: 'Ignored' }),
  ]);

  it('resolves notes recursively and carries title, location, type, and notePath', () => {
    const source = parseLeafletSourceYaml('markerFolder: Trips/Chile', defaults());
    const config = resolveObsidianGeoMap(app, source, { types: TYPES, defaultTypeId: 'default', tooltip: 'hover' });

    expect(config.schema).toBe('geomap/v1');
    expect(config.markers).toEqual([
      {
        id: 'Trips/Chile/Nested/Assets/photo.md',
        type: 'default',
        location: { lat: -33, lng: -70 },
        title: 'Photo',
        notePath: 'Trips/Chile/Nested/Assets/photo.md',
        tooltip: 'hover',
      },
      {
        id: 'Trips/Chile/Nested/Valparaiso.md',
        type: 'default',
        location: { lat: -33.0472, lng: -71.6127 },
        title: 'Valparaiso',
        notePath: 'Trips/Chile/Nested/Valparaiso.md',
        minZoom: 8,
        maxZoom: 16,
        tooltip: 'hover',
      },
      {
        id: 'Trips/Chile/Santiago.md',
        type: 'restaurant',
        location: { lat: -33.4489, lng: -70.6693 },
        title: 'Santiago',
        description: 'The starting point.',
        notePath: 'Trips/Chile/Santiago.md',
        tooltip: 'hover',
      },
    ]);
  });

  it('orders markers by Vault path so two hosts agree', () => {
    const markers = resolveMarkerFolder(app, ['Trips/Chile'], { types: TYPES });
    expect(markers.map((marker) => marker.notePath)).toEqual([
      'Trips/Chile/Nested/Assets/photo.md',
      'Trips/Chile/Nested/Valparaiso.md',
      'Trips/Chile/Santiago.md',
    ]);
  });

  it('merges repeated markerFolder keys from the historical dialect', () => {
    const source = parseLeafletSourceYaml(
      'markerFolder: Trips/Chile\nmarkerFolder: Other\n',
      defaults(),
    );
    expect(source.markerFolder).toEqual(['Trips/Chile', 'Other']);
    // Two folders merge into one stable, path-ordered list rather than two lists.
    expect(resolveMarkerFolder(app, source.markerFolder).map((marker) => marker.title)).toEqual([
      'Quito',
      'Photo',
      'Valparaiso',
      'Santiago',
    ]);
  });

  it('skips a note without a valid location instead of failing', () => {
    const broken = makeApp([
      note('Trips/Chile/Index.md', { title: 'Index' }),
      note('Trips/Chile/OutOfRange.md', { title: 'Bad', location: [200, 400] }),
      note('Trips/Chile/Ok.md', { title: 'Ok', location: [1, 2] }),
    ]);
    const markers = resolveMarkerFolder(broken, ['Trips/Chile']);
    expect(markers.map((marker) => marker.title)).toEqual(['Ok']);
  });

  it('renders an unknown mapmarker through the default visual and keeps the name', () => {
    const unknown = makeApp([note('Trips/Unicorn.md', { title: 'A', location: [1, 2], mapmarker: 'unicorn' })]);
    const [marker] = resolveMarkerFolder(unknown, ['Trips'], { types: TYPES, defaultTypeId: 'restaurant' });
    // The authored name survives so the renderer can fall back visually and so a
    // diagnostic can still name what the author wrote.
    expect(marker?.type).toBe('unicorn');
  });

  it('falls back from a note tag to the configured default type', () => {
    const tagged = makeApp([note('Trips/Shop.md', { title: 'A', location: [1, 2], tags: ['shopping'] })]);
    // A tag match outranks the configured default type.
    expect(resolveMarkerFolder(tagged, ['Trips'], { types: TYPES, defaultTypeId: 'restaurant' })[0]?.type).toBe('shop');
    const untagged = makeApp([note('Trips/Plain.md', { title: 'B', location: [1, 2] })]);
    // With no tag match, the configured default wins over the built-in one.
    expect(resolveMarkerFolder(untagged, ['Trips'], { types: TYPES, defaultTypeId: 'restaurant' })[0]?.type)
      .toBe('restaurant');
  });

  it('lets a note mapzoom win over the marker type zoom bounds', () => {
    const app2 = makeApp([
      note('Trips/A.md', { title: 'A', location: [1, 2], mapzoom: [4, 9], mapmarker: 'deep' }),
      note('Trips/B.md', { title: 'B', location: [1, 2], mapmarker: 'deep' }),
    ]);
    const [pinned, typed] = resolveMarkerFolder(app2, ['Trips'], { types: TYPES });
    expect(pinned).toMatchObject({ type: 'deep', minZoom: 4, maxZoom: 9 });
    expect(typed).toMatchObject({ type: 'deep', minZoom: 10, maxZoom: 14 });
  });

  it('uses the note basename when no title is authored', () => {
    const app2 = makeApp([note('Trips/Nameless Place.md', { location: [1, 2] })]);
    expect(resolveMarkerFolder(app2, ['Trips'])[0]?.title).toBe('Nameless Place');
  });

  it('returns no markers when no folder is configured', () => {
    expect(resolveMarkerFolder(app, [])).toEqual([]);
    expect(resolveObsidianGeoMap(app, parseLeafletSourceYaml(''), {}).markers).toEqual([]);
  });
});

describe('block geometry and identity', () => {
  it('keeps the block height instead of the forced full-leaf 100%', () => {
    const source = parseLeafletSourceYaml('height: 600px', defaults());
    const config = resolveObsidianGeoMap(makeApp([]), source, {});
    expect(config.height).toBe('600px');
    expect(config.height).not.toBe('100%');
  });

  it('accepts a numeric height and falls back to the built-in default', () => {
    expect(parseLeafletSourceYaml('height: 400', defaults()).height).toBe('400px');
    expect(parseLeafletSourceYaml('', defaults()).height).toBe(DEFAULT_LEAFLET_HEIGHT);
  });

  it('passes a repeated authored id through without changing it', () => {
    // Host instance identity is separate: two blocks may legitimately share `id`.
    const chile = parseLeafletSourceYaml('id: chile-2509\nlat: -33\nlong: -70');
    const xinjiang = parseLeafletSourceYaml('id: chile-2509\nlat: 42\nlong: 82');
    expect(resolveObsidianGeoMap(makeApp([]), chile, {}).id).toBe('chile-2509');
    expect(resolveObsidianGeoMap(makeApp([]), xinjiang, {}).id).toBe('chile-2509');
    expect(xinjiang.map.center).toEqual([42, 82]);
  });

  it('uses the built-in OpenStreetMap tile source when no provider is configured', () => {
    expect(parseLeafletSourceYaml('lat: 1\nlong: 2', defaults()).map.tiles.light).toEqual({
      url: DEFAULT_TILE_URL,
      attribution: '© OpenStreetMap contributors',
    });
  });
});

describe('production fixture key sets', () => {
  // The four live `kywk.github.io` blocks, verbatim. They are the minimum
  // Phase 1 source-compatibility bar and must render without source edits.
  const FIXTURES = [
    {
      name: 'Chile',
      source: [
        'id: chile-2509',
        'height: 600px',
        'lat: -33.0000',
        'long: -70.0000',
        'minZoom: 4',
        'maxZoom: 17',
        'defaultZoom: 5',
        'unit: meters',
        'scale: 1',
        'darkMode: true',
        'markerFolder: backpacker/2509 Chile/Chile',
      ].join('\n'),
      expected: {
        id: 'chile-2509',
        height: '600px',
        center: [-33, -70] as [number, number],
        zoom: 5,
        minZoom: 4,
        maxZoom: 17,
        markerFolder: ['backpacker/2509 Chile/Chile'],
      },
    },
    {
      name: 'Egypt',
      source: [
        'id: egypt-2401',
        'height: 500px',
        'lat: 27.50000',
        'long: 29.50000',
        'minZoom: 5',
        'maxZoom: 15',
        'defaultZoom: 6',
        'unit: meters',
        'scale: 1',
        'darkMode: true',
        'markerFolder: backpacker/2401 Egypt/Egypt',
      ].join('\n'),
      expected: {
        id: 'egypt-2401',
        height: '500px',
        center: [27.5, 29.5] as [number, number],
        zoom: 6,
        minZoom: 5,
        maxZoom: 15,
        markerFolder: ['backpacker/2401 Egypt/Egypt'],
      },
    },
    {
      name: 'Kuala Lumpur',
      source: [
        'id: kl-2401',
        'height: 500px',
        'lat: 3.15000',
        'long: 101.67000',
        'minZoom: 11',
        'maxZoom: 17',
        'defaultZoom: 13',
        'unit: meters',
        'scale: 1',
        'darkMode: true',
        'markerFolder: backpacker/2401 Egypt/Kuala Lumpur',
      ].join('\n'),
      expected: {
        id: 'kl-2401',
        height: '500px',
        center: [3.15, 101.67] as [number, number],
        zoom: 13,
        minZoom: 11,
        maxZoom: 17,
        markerFolder: ['backpacker/2401 Egypt/Kuala Lumpur'],
      },
    },
    {
      // Reuses the Chile id on purpose: authored identity is never rewritten.
      name: 'Xinjiang',
      source: [
        'id: chile-2509',
        'height: 600px',
        'lat: 42.0000',
        'long: 82.0000',
        'minZoom: 4',
        'maxZoom: 17',
        'defaultZoom: 5',
        'unit: meters',
        'scale: 1',
        'darkMode: true',
        'markerFolder: backpacker/2601 Xinjiang/Xinjiang',
      ].join('\n'),
      expected: {
        id: 'chile-2509',
        height: '600px',
        center: [42, 82] as [number, number],
        zoom: 5,
        minZoom: 4,
        maxZoom: 17,
        markerFolder: ['backpacker/2601 Xinjiang/Xinjiang'],
      },
    },
  ];

  for (const fixture of FIXTURES) {
    it(`parses the ${fixture.name} block without a parse error`, () => {
      const parsed = parseLeafletSourceYaml(fixture.source, defaults());
      expect(parsed.schema).toBe('leaflet/v1');
      expect(parsed.id).toBe(fixture.expected.id);
      expect(parsed.height).toBe(fixture.expected.height);
      expect(parsed.map.center).toEqual(fixture.expected.center);
      expect(parsed.map.zoom).toBe(fixture.expected.zoom);
      expect(parsed.map.minZoom).toBe(fixture.expected.minZoom);
      expect(parsed.map.maxZoom).toBe(fixture.expected.maxZoom);
      expect(parsed.markerFolder).toEqual(fixture.expected.markerFolder);
    });

    it(`keeps ${fixture.name} unit, scale, and darkMode as reported compatibility metadata`, () => {
      const parsed = parseLeafletSourceYaml(fixture.source, defaults());
      expect(parsed.pending.unit).toBe('meters');
      expect(parsed.pending.scale).toBe(1);
      expect(parsed.pending.darkMode).toBe(true);
      // Accepted without a parse failure, and reported rather than swallowed.
      expect(parsed.diagnostics.every((item) => item.level === 'warning')).toBe(true);
      const codes = parsed.diagnostics.map((item) => item.code);
      expect(codes).toContain(LEAFLET_DIAGNOSTIC_CODES.compatMetadata);
      expect(codes).toContain(LEAFLET_DIAGNOSTIC_CODES.compatFlag);
      expect(parsed.diagnostics.some((item) => item.level === 'error')).toBe(false);
    });
  }
});

describe('diagnostics reach the render config', () => {
  it('reports a recognized-but-unimplemented key and an unknown one by name', () => {
    const parsed = parseLeafletSourceYaml('lat: 1\nlong: 2\ngeojson: x.geojson\nnonsenseKey: 1', defaults());
    const config = resolveObsidianGeoMap(makeApp([]), parsed, {});

    expect(config.diagnostics).toBeDefined();
    const byKey = new Map(config.diagnostics?.map((item) => [item.key, item.code]));
    expect(byKey.get('geojson')).toBe(LEAFLET_DIAGNOSTIC_CODES.pendingP2);
    expect(byKey.get('nonsenseKey')).toBe(LEAFLET_DIAGNOSTIC_CODES.unknownKey);
    expect(config.diagnostics?.every((item) => item.message.includes(item.key ?? ' '))).toBe(true);
  });

  it('omits the diagnostics key entirely for a clean block', () => {
    const config = resolveObsidianGeoMap(makeApp([]), parseLeafletSourceYaml('lat: 1\nlong: 2', defaults()), {});
    expect(config.diagnostics).toBeUndefined();
  });

  it('reports an invalid value without discarding the rest of the block', () => {
    const parsed = parseLeafletSourceYaml('lat: 1\nlong: 2\ndefaultZoom: far\nheight: 900px', defaults());
    const config = resolveObsidianGeoMap(makeApp([]), parsed, {});
    expect(config.height).toBe('900px');
    expect(config.map.zoom).toBe(6);
    expect(config.diagnostics?.map((item) => [item.key, item.level])).toContainEqual(['defaultZoom', 'error']);
  });
});
