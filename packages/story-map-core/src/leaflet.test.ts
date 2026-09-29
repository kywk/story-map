import { describe, expect, it } from 'vitest';
import {
  DEFAULT_LEAFLET_HEIGHT,
  DEFAULT_MARKER_TYPE_ID,
  DEFAULT_TILE_ATTRIBUTION,
  DEFAULT_TILE_URL,
  LEAFLET_DIAGNOSTIC_CODES,
  LeafletParseError,
  StoryMapParseError,
  coerceMapZoom,
  groupRepeatedTopLevelKeys,
  markerFromNoteFrontmatter,
  parseLeafletSourceObject,
  parseLeafletSourceYaml,
  parseStoryMapYaml,
  resolveMarkerType,
  slideFromNoteFrontmatter,
  tileSourcesFromStoryMap,
  toGeoMapConfig,
  toTileSources,
} from './index.js';

/** The four live `kywk.github.io` fixtures, copied verbatim from
 * `docs/history/2026-09-29-leaflet-compatibility/examples/current-vault-leaflet-blocks.md`. */
const CHILE = `id: chile-2509
height: 600px
lat: -33.0000
long: -70.0000
minZoom: 4
maxZoom: 17
defaultZoom: 5
unit: meters
scale: 1
darkMode: true
markerFolder: backpacker/2509 Chile/Chile
`;

const EGYPT = `id: egypt-2401
height: 500px
lat: 27.50000
long: 29.50000
minZoom: 5
maxZoom: 15
defaultZoom: 6
unit: meters
scale: 1
darkMode: true
markerFolder: backpacker/2401 Egypt/Egypt
`;

const KUALA_LUMPUR = `id: kl-2401
height: 500px
lat: 3.15000
long: 101.67000
minZoom: 11
maxZoom: 17
defaultZoom: 13
unit: meters
scale: 1
darkMode: true
markerFolder: backpacker/2401 Egypt/Kuala Lumpur
`;

const XINJIANG = `id: chile-2509
height: 600px
lat: 42.0000
long: 82.0000
minZoom: 4
maxZoom: 17
defaultZoom: 5
unit: meters
scale: 1
darkMode: true
markerFolder: backpacker/2601 Xinjiang/Xinjiang
`;

describe('parseLeafletSourceYaml - production fixtures', () => {
  it('parses the Chile block', () => {
    const source = parseLeafletSourceYaml(CHILE);

    expect(source.schema).toBe('leaflet/v1');
    expect(source.id).toBe('chile-2509');
    expect(source.height).toBe('600px');
    expect(source.map.center).toEqual([-33, -70]);
    expect(source.map.zoom).toBe(5);
    expect(source.map.minZoom).toBe(4);
    expect(source.map.maxZoom).toBe(17);
    expect(source.markerFolder).toEqual(['backpacker/2509 Chile/Chile']);
    expect(source.map.tiles.light.url).toBe(DEFAULT_TILE_URL);
    expect(source.map.tiles.light.attribution).toBe(DEFAULT_TILE_ATTRIBUTION);
  });

  it('parses the Egypt block', () => {
    const source = parseLeafletSourceYaml(EGYPT);

    expect(source.id).toBe('egypt-2401');
    expect(source.height).toBe('500px');
    expect(source.map.center).toEqual([27.5, 29.5]);
    expect(source.map.zoom).toBe(6);
    expect(source.map.minZoom).toBe(5);
    expect(source.map.maxZoom).toBe(15);
    expect(source.markerFolder).toEqual(['backpacker/2401 Egypt/Egypt']);
  });

  it('parses the Kuala Lumpur block', () => {
    const source = parseLeafletSourceYaml(KUALA_LUMPUR);

    expect(source.id).toBe('kl-2401');
    expect(source.height).toBe('500px');
    expect(source.map.center).toEqual([3.15, 101.67]);
    expect(source.map.zoom).toBe(13);
    expect(source.map.minZoom).toBe(11);
    expect(source.map.maxZoom).toBe(17);
    expect(source.markerFolder).toEqual(['backpacker/2401 Egypt/Kuala Lumpur']);
  });

  it('parses the Xinjiang block and keeps its reused id', () => {
    const source = parseLeafletSourceYaml(XINJIANG);

    expect(source.id).toBe('chile-2509');
    expect(source.height).toBe('600px');
    expect(source.map.center).toEqual([42, 82]);
    expect(source.map.zoom).toBe(5);
    expect(source.map.minZoom).toBe(4);
    expect(source.map.maxZoom).toBe(17);
    expect(source.markerFolder).toEqual(['backpacker/2601 Xinjiang/Xinjiang']);
  });

  it('never treats an authored id as unique', () => {
    expect(parseLeafletSourceYaml(CHILE).id).toBe(parseLeafletSourceYaml(XINJIANG).id);
  });

  it('applies the built-in height and zoom when a block omits them', () => {
    const source = parseLeafletSourceYaml('lat: 1\nlong: 2\n');

    expect(source.height).toBe(DEFAULT_LEAFLET_HEIGHT);
    expect(source.map.zoom).toBe(6);
    expect(source.markerFolder).toEqual([]);
    expect(source.id).toBeUndefined();
  });
});

describe('parseLeafletSourceYaml - repeated and list markerFolder forms', () => {
  it('keeps every historical repeated markerFolder line', () => {
    const source = parseLeafletSourceYaml(`markerFolder: A
markerFolder: B
markerFolder: C
lat: 1
long: 2
`);

    expect(source.markerFolder).toEqual(['A', 'B', 'C']);
  });

  it('accepts the YAML array form', () => {
    const source = parseLeafletSourceYaml('markerFolder: [A, B, C]\n');

    expect(source.markerFolder).toEqual(['A', 'B', 'C']);
  });

  it('accepts a comma separated string and keeps spaces inside a folder name', () => {
    expect(parseLeafletSourceYaml('markerFolder: A, B\n').markerFolder).toEqual(['A', 'B']);
    expect(parseLeafletSourceYaml('markerFolder: backpacker/2509 Chile/Chile\n').markerFolder).toEqual([
      'backpacker/2509 Chile/Chile',
    ]);
  });

  it('splits tag-style keys on whitespace as well as commas', () => {
    const source = parseLeafletSourceYaml('markerTag: eats shop\nfilterTag: draft, wip\n');

    expect(source.pending.markerTag).toEqual(['eats', 'shop']);
    expect(source.pending.filterTag).toEqual(['draft', 'wip']);
  });

  it('yields the same list from all three forms', () => {
    const repeated = parseLeafletSourceYaml('markerFolder: A\nmarkerFolder: B\n').markerFolder;
    const array = parseLeafletSourceYaml('markerFolder: [A, B]\n').markerFolder;
    const comma = parseLeafletSourceYaml('markerFolder: A, B\n').markerFolder;

    expect(repeated).toEqual(['A', 'B']);
    expect(array).toEqual(repeated);
    expect(comma).toEqual(repeated);
  });

  it('reads repeated keys from an already-loaded value as a list', () => {
    const source = parseLeafletSourceObject({ markerFolder: ['A', 'B'] });

    expect(source.markerFolder).toEqual(['A', 'B']);
  });
});

describe('groupRepeatedTopLevelKeys', () => {
  it('folds repeated top-level keys into one flow sequence and keeps line numbers', () => {
    expect(groupRepeatedTopLevelKeys('markerFolder: A\nmarkerFolder: B\nlat: 1')).toBe(
      'markerFolder: [A, B]\n#\nlat: 1',
    );
  });

  it('leaves comments alone', () => {
    const grouped = groupRepeatedTopLevelKeys(`# a note
markerFolder: A # first
markerFolder: B
# trailing note
`);

    expect(grouped).toBe(`# a note
markerFolder: [A, B] # first
#
# trailing note
`);
    expect(parseLeafletSourceYaml(grouped).markerFolder).toEqual(['A', 'B']);
  });

  it('keeps quoted values that contain a colon intact', () => {
    const grouped = groupRepeatedTopLevelKeys(`title: "Chile: 2509"
markerFolder: "backpacker/2509 Chile: North"
markerFolder: 'backpacker/2509 Chile: South' # keep both
`);

    expect(parseLeafletSourceYaml(grouped).markerFolder).toEqual([
      'backpacker/2509 Chile: North',
      'backpacker/2509 Chile: South',
    ]);
  });

  it('never rewrites a repeated key nested inside a block', () => {
    const nested = `map:
  markerFolder: A
  markerFolder: B
`;

    expect(groupRepeatedTopLevelKeys(nested)).toBe(nested);
    expect(() => parseLeafletSourceYaml(nested)).toThrow(/duplicated mapping key/);
  });

  it('never rewrites a repeated key that is not a repeatable one', () => {
    const singleton = 'id: a\nid: b\n';

    expect(groupRepeatedTopLevelKeys(singleton)).toBe(singleton);
    expect(() => parseLeafletSourceYaml(singleton)).toThrow(/duplicated mapping key/);
  });

  it('leaves list items untouched', () => {
    const listy = `markerFolder: A
marker:
  - note-one
  - note-two
markerFolder: B
`;

    expect(groupRepeatedTopLevelKeys(listy)).toBe(`markerFolder: [A, B]
marker:
  - note-one
  - note-two
#
`);
  });

  it('skips block scalar bodies that look like keys', () => {
    const block = `description: |
  markerFolder: not-a-folder
markerFolder: real
`;

    expect(groupRepeatedTopLevelKeys(block)).toBe(block);

    const source = parseLeafletSourceYaml(block);
    expect(source.markerFolder).toEqual(['real']);
    expect(parseLeafletSourceObject({ description: 'x\nmarkerFolder: not-a-folder\n' }).markerFolder).toEqual(
      [],
    );
  });
});

describe('parseLeafletSourceYaml - compatibility metadata', () => {
  it('accepts unit and scale without a parse error and reports them', () => {
    const source = parseLeafletSourceYaml(CHILE);

    expect(source.pending.unit).toBe('meters');
    expect(source.pending.scale).toBe(1);
    expect(
      source.diagnostics.filter((diagnostic) => diagnostic.code === LEAFLET_DIAGNOSTIC_CODES.compatMetadata),
    ).toEqual([
      expect.objectContaining({ level: 'warning', key: 'unit' }),
      expect.objectContaining({ level: 'warning', key: 'scale' }),
    ]);
  });

  it('parses darkMode as a flag without touching the theme or tiles', () => {
    const source = parseLeafletSourceYaml(CHILE);

    expect(source.pending.darkMode).toBe(true);
    expect(source.map.theme).toBe('light');
    expect(source.map.tiles).toEqual({
      light: { url: DEFAULT_TILE_URL, attribution: DEFAULT_TILE_ATTRIBUTION },
    });
    expect(
      source.diagnostics.filter((diagnostic) => diagnostic.code === LEAFLET_DIAGNOSTIC_CODES.compatFlag),
    ).toEqual([expect.objectContaining({ level: 'warning', key: 'darkMode' })]);
  });

  it('reads a quoted darkMode: false without treating it as true', () => {
    const source = parseLeafletSourceYaml('darkMode: "false"\n');

    expect(source.pending.darkMode).toBe(false);
  });

  it('reports an unusable value as an error diagnostic and keeps the default', () => {
    const source = parseLeafletSourceYaml('height: [600, 500]\nscale: wide\n');

    expect(source.height).toBe(DEFAULT_LEAFLET_HEIGHT);
    expect(
      source.diagnostics.filter(
        (diagnostic) => diagnostic.code === LEAFLET_DIAGNOSTIC_CODES.invalidValue,
      ),
    ).toEqual([
      expect.objectContaining({ level: 'error', key: 'height' }),
      expect.objectContaining({ level: 'error', key: 'scale' }),
    ]);
  });

  it('accepts any authored height string, as storymap/v1 does', () => {
    expect(parseLeafletSourceYaml('height: 50%\n').height).toBe('50%');
  });

  it('accepts a numeric height', () => {
    expect(parseLeafletSourceYaml('height: 480\n').height).toBe('480px');
  });
});

describe('parseLeafletSourceYaml - diagnostics for unrecognized behavior', () => {
  it('reports a P1 key by name and carries it', () => {
    const source = parseLeafletSourceYaml(`tileServer: https://example.test/{z}/{x}/{y}.png
noUI: true
markerFile: A.md
markerFile: B.md
`);

    expect(source.pending.tileServer).toEqual(['https://example.test/{z}/{x}/{y}.png']);
    expect(source.pending.noUI).toBe(true);
    expect(source.pending.markerFile).toEqual(['A.md', 'B.md']);
    expect(
      source.diagnostics.filter((diagnostic) => diagnostic.code === LEAFLET_DIAGNOSTIC_CODES.pendingP1),
    ).toEqual([
      expect.objectContaining({ level: 'warning', key: 'tileServer' }),
      expect.objectContaining({ level: 'warning', key: 'noUI' }),
      expect.objectContaining({ level: 'warning', key: 'markerFile' }),
    ]);
    // A pending key never quietly becomes the rendered tile source.
    expect(source.map.tiles.light.url).toBe(DEFAULT_TILE_URL);
    expect(source.map.controls).toBeUndefined();
  });

  it('reports a P2 file-layer key by name and carries it', () => {
    const source = parseLeafletSourceYaml('geojson: route.geojson\ngpx: trip.gpx\n');

    expect(source.deferred).toEqual({ geojson: 'route.geojson', gpx: 'trip.gpx' });
    expect(
      source.diagnostics.filter((diagnostic) => diagnostic.code === LEAFLET_DIAGNOSTIC_CODES.pendingP2),
    ).toEqual([
      expect.objectContaining({ level: 'warning', key: 'geojson' }),
      expect.objectContaining({ level: 'warning', key: 'gpx' }),
    ]);
  });

  it('reports a P3 key by name and carries it', () => {
    const source = parseLeafletSourceYaml('image: floor.png\nbounds: [[0, 0], [10, 10]]\ndraw: true\n');

    expect(source.deferred.image).toBe('floor.png');
    expect(
      source.diagnostics.filter((diagnostic) => diagnostic.code === LEAFLET_DIAGNOSTIC_CODES.pendingP3),
    ).toEqual([
      expect.objectContaining({ key: 'image' }),
      expect.objectContaining({ key: 'bounds' }),
      expect.objectContaining({ key: 'draw' }),
    ]);
  });

  it('reports a rejected host-only key without carrying its value', () => {
    const source = parseLeafletSourceYaml('isMapView: true\ncommandMarker: Open note\n');

    expect(source.deferred).toEqual({});
    expect(
      source.diagnostics.filter((diagnostic) => diagnostic.code === LEAFLET_DIAGNOSTIC_CODES.rejected),
    ).toEqual([
      expect.objectContaining({ key: 'isMapView' }),
      expect.objectContaining({ key: 'commandMarker' }),
    ]);
  });

  it('gives an unknown key its own diagnostic code', () => {
    const source = parseLeafletSourceYaml('lat: 1\nlong: 2\ncentr: [1, 2]\n');

    const unknown = source.diagnostics.filter(
      (diagnostic) => diagnostic.code === LEAFLET_DIAGNOSTIC_CODES.unknownKey,
    );
    expect(unknown).toEqual([
      expect.objectContaining({ level: 'warning', key: 'centr', message: expect.stringContaining('centr') }),
    ]);
    expect(unknown[0]?.code).not.toBe(LEAFLET_DIAGNOSTIC_CODES.pendingP1);
  });

  it('normalizes zoomDelta into the map while reporting it as pending', () => {
    const source = parseLeafletSourceYaml('zoomDelta: 2\n');

    expect(source.map.zoomDelta).toBe(2);
    expect(source.diagnostics).toEqual([
      expect.objectContaining({
        level: 'warning',
        code: LEAFLET_DIAGNOSTIC_CODES.pendingP1,
        key: 'zoomDelta',
      }),
    ]);
  });
});

describe('parseLeafletSourceYaml - coordinates and defaults', () => {
  it('accepts lng as an alias for long', () => {
    expect(parseLeafletSourceYaml('lat: 3.15\nlng: 101.67\n').map.center).toEqual([3.15, 101.67]);
  });

  it('rejects out-of-range coordinates clearly', () => {
    expect(() => parseLeafletSourceYaml('lat: 999\nlong: 999\n')).toThrow(LeafletParseError);
    expect(() => parseLeafletSourceYaml('lat: 999\nlong: 999\n')).toThrow(/Root coordinates are invalid/);
  });

  it('rejects a partial coordinate pair clearly', () => {
    expect(() => parseLeafletSourceYaml('lat: 25.033\n')).toThrow(/both lat and long/);
  });

  it('rejects non-numeric coordinates clearly', () => {
    expect(() => parseLeafletSourceYaml('lat: somewhere\nlong: else\n')).toThrow(
      /Root coordinates are invalid/,
    );
  });

  it('is catchable as a StoryMapParseError so one host catch covers both dialects', () => {
    expect(() => parseLeafletSourceYaml('lat: nope\nlong: nope\n')).toThrow(StoryMapParseError);
  });

  it('rejects a block that is not a mapping', () => {
    expect(() => parseLeafletSourceYaml('- just\n- a list\n')).toThrow(LeafletParseError);
  });

  it('reads an empty block as defaults', () => {
    expect(parseLeafletSourceYaml('').height).toBe(DEFAULT_LEAFLET_HEIGHT);
    expect(parseLeafletSourceYaml('# nothing but a note\n').height).toBe(DEFAULT_LEAFLET_HEIGHT);
  });

  it('resolves authored key, then compatibility setting, then built-in default', () => {
    const authored = parseLeafletSourceYaml('height: 320px\nminZoom: 3\nlat: 1\nlong: 2\n', {
      height: '700px',
      minZoom: 9,
      center: [10, 20],
    });
    expect(authored.height).toBe('320px');
    expect(authored.map.minZoom).toBe(3);
    expect(authored.map.center).toEqual([1, 2]);

    const fromSetting = parseLeafletSourceYaml('lat: 1\nlong: 2\n', {
      height: '700px',
      minZoom: 9,
      zoom: 8,
      center: [10, 20],
      theme: 'dark',
    });
    expect(fromSetting.height).toBe('700px');
    expect(fromSetting.map.minZoom).toBe(9);
    expect(fromSetting.map.zoom).toBe(8);
    expect(fromSetting.map.center).toEqual([1, 2]);

    const defaultCenter = parseLeafletSourceYaml('zoomDelta: 1\n', { center: [10, 20] });
    expect(defaultCenter.map.center).toEqual([10, 20]);

    const builtIn = parseLeafletSourceYaml('markerFolder: A\n');
    expect(builtIn.height).toBe(DEFAULT_LEAFLET_HEIGHT);
    expect(builtIn.map.zoom).toBe(6);
    expect(builtIn.map.minZoom).toBeUndefined();
    expect(builtIn.map.theme).toBe('light');
  });

  it('uses a host-configured tile pair and never invents a dark source', () => {
    const source = parseLeafletSourceYaml('lat: 1\nlong: 2\n', {
      tileUrl: 'https://light.example/{z}/{x}/{y}.png',
      attribution: 'Light',
      darkTileUrl: 'https://dark.example/{z}/{x}/{y}.png',
      darkAttribution: 'Dark',
    });

    expect(source.map.tiles).toEqual({
      light: { url: 'https://light.example/{z}/{x}/{y}.png', attribution: 'Light' },
      dark: { url: 'https://dark.example/{z}/{x}/{y}.png', attribution: 'Dark' },
    });
    expect(parseLeafletSourceYaml('lat: 1\nlong: 2\n').map.tiles.dark).toBeUndefined();
  });
});

describe('toGeoMapConfig', () => {
  it('produces the canonical storyless map config', () => {
    const source = parseLeafletSourceYaml(CHILE);
    const marker = markerFromNoteFrontmatter(
      { title: 'Santiago', location: [-33.4489, -70.6693], mapmarker: 'city' },
      { notePath: 'backpacker/2509 Chile/Chile/Santiago.md' },
    );

    const config = toGeoMapConfig(source, marker ? [marker] : []);

    expect(config.schema).toBe('geomap/v1');
    expect(config.id).toBe('chile-2509');
    expect(config.height).toBe('600px');
    expect(config.map.center).toEqual([-33, -70]);
    expect(config.map.zoom).toBe(5);
    expect(config.map.tiles.light.url).toBe(DEFAULT_TILE_URL);
    expect(config.markers).toEqual([
      {
        location: { lat: -33.4489, lng: -70.6693 },
        type: 'city',
        title: 'Santiago',
        notePath: 'backpacker/2509 Chile/Chile/Santiago.md',
      },
    ]);
    expect(config.diagnostics?.length).toBeGreaterThan(0);
  });

  it('omits diagnostics and id when there is nothing to report', () => {
    const source = parseLeafletSourceYaml('lat: 1\nlong: 2\n');
    const config = toGeoMapConfig(source, []);

    expect(config.diagnostics).toBeUndefined();
    expect('id' in config).toBe(false);
    expect(config.markers).toEqual([]);
  });
});

describe('coerceMapZoom', () => {
  it('coerces the documented two-value form', () => {
    expect(coerceMapZoom([5, 18])).toEqual({ minZoom: 5, maxZoom: 18 });
  });

  it('coerces a single number, a one-element array, and a string', () => {
    expect(coerceMapZoom(12)).toEqual({ minZoom: 12 });
    expect(coerceMapZoom([12])).toEqual({ minZoom: 12 });
    expect(coerceMapZoom('12')).toEqual({ minZoom: 12 });
  });

  it('coerces a range string and an object', () => {
    expect(coerceMapZoom('5-18')).toEqual({ minZoom: 5, maxZoom: 18 });
    expect(coerceMapZoom('5, 18')).toEqual({ minZoom: 5, maxZoom: 18 });
    expect(coerceMapZoom({ min: 5, max: 18 })).toEqual({ minZoom: 5, maxZoom: 18 });
    expect(coerceMapZoom({ minZoom: 5 })).toEqual({ minZoom: 5 });
  });

  it('ignores unparseable values instead of throwing', () => {
    expect(coerceMapZoom(undefined)).toBeUndefined();
    expect(coerceMapZoom(null)).toBeUndefined();
    expect(coerceMapZoom('nope')).toBeUndefined();
    expect(coerceMapZoom({})).toBeUndefined();
    expect(coerceMapZoom([])).toBeUndefined();
    expect(coerceMapZoom(Number.NaN)).toBeUndefined();
    expect(coerceMapZoom([Number.POSITIVE_INFINITY, 3])).toEqual({ maxZoom: 3 });
  });
});

describe('markerFromNoteFrontmatter', () => {
  it('builds a marker from shared note frontmatter', () => {
    const marker = markerFromNoteFrontmatter({
      title: 'Example Place',
      location: [25.033, 121.5654],
      mapmarker: 'restaurant',
      description: 'A good stop.',
      mapzoom: [5, 18],
    });

    expect(marker).toEqual({
      location: { lat: 25.033, lng: 121.5654 },
      type: 'restaurant',
      title: 'Example Place',
      description: 'A good stop.',
      minZoom: 5,
      maxZoom: 18,
    });
  });

  it('skips a note without a valid location instead of failing', () => {
    expect(markerFromNoteFrontmatter({ title: 'Nowhere' })).toBeUndefined();
    expect(markerFromNoteFrontmatter({ location: 'somewhere' })).toBeUndefined();
  });

  it('ignores the story-slide zoom hint and prefers mapzoom', () => {
    const marker = markerFromNoteFrontmatter({ location: [1, 2], zoom: 9, mapzoom: [4] });

    expect(marker).toEqual({ location: { lat: 1, lng: 2 }, type: DEFAULT_MARKER_TYPE_ID, minZoom: 4 });
  });

  it('carries the fallback title and the resolved note path', () => {
    const marker = markerFromNoteFrontmatter(
      { location: [1, 2] },
      { fallbackTitle: 'Santiago.md', notePath: 'Places/Santiago', tooltip: 'hover' },
    );

    expect(marker?.title).toBe('Santiago.md');
    expect(marker?.notePath).toBe('Places/Santiago');
    expect(marker?.tooltip).toBe('hover');
  });
});

describe('resolveMarkerType', () => {
  const types = [
    { id: 'food', tags: ['eats', 'cuisine'], color: '#f00' },
    { id: 'shop', tags: ['shopping'] },
    { id: 'default', minZoom: 3 },
  ];

  it('prefers the explicit note mapmarker', () => {
    expect(
      resolveMarkerType({ authoredType: 'shop', frontmatter: { tags: ['eats'] }, types }),
    ).toEqual({ type: 'shop', definition: types[1], unknown: false });
  });

  it('falls back to the first tag-matched type', () => {
    expect(resolveMarkerType({ frontmatter: { tags: ['#Eats'] }, types })?.type).toBe('food');
    expect(resolveMarkerType({ frontmatter: { tag: 'cuisine travel' }, types })?.type).toBe('food');
  });

  it('uses the configured default type before the built-in one', () => {
    expect(resolveMarkerType({ frontmatter: {}, types, defaultTypeId: 'shop' })).toEqual({
      type: 'shop',
      definition: types[1],
      unknown: false,
    });
  });

  it('uses the built-in generic default last', () => {
    expect(resolveMarkerType({ frontmatter: {}, types: [] })).toEqual({
      type: DEFAULT_MARKER_TYPE_ID,
      unknown: false,
    });
  });

  it('ignores a configured default type that is not registered', () => {
    expect(resolveMarkerType({ frontmatter: {}, types, defaultTypeId: 'nope' }).type).toBe(
      DEFAULT_MARKER_TYPE_ID,
    );
  });

  it('resolves an unknown authored type without dropping its name', () => {
    expect(resolveMarkerType({ authoredType: 'marathon', frontmatter: {}, types })).toEqual({
      type: 'marathon',
      unknown: true,
    });
  });

  it('folds a type definition min/max zoom into the resolution', () => {
    expect(resolveMarkerType({ frontmatter: {}, types }).minZoom).toBe(3);
  });

  it('never matches nested tags partially', () => {
    expect(resolveMarkerType({ frontmatter: { tags: ['travel/eats'] }, types })?.type).toBe(
      DEFAULT_MARKER_TYPE_ID,
    );
  });

  it('folds a type definition min/max zoom into the resolved marker', () => {
    const types = [
      { id: 'food', tags: ['eats'], minZoom: 4, maxZoom: 16 },
      { id: 'default' },
    ];

    expect(markerFromNoteFrontmatter({ location: [1, 2], tags: ['eats'] }, { types })).toMatchObject({
      type: 'food',
      minZoom: 4,
      maxZoom: 16,
    });
    // A note's own `mapzoom` is more specific than the type's range.
    expect(
      markerFromNoteFrontmatter({ location: [1, 2], tags: ['eats'], mapzoom: [8] }, { types }),
    ).toMatchObject({ minZoom: 8, maxZoom: 16 });
  });
});

describe('tile sources', () => {
  it('normalizes the storymap/v1 pair into the light source', () => {
    const story = parseStoryMapYaml(`
      slides:
        - title: Taipei
    `);

    expect(tileSourcesFromStoryMap(story.map)).toEqual({
      light: { url: DEFAULT_TILE_URL, attribution: DEFAULT_TILE_ATTRIBUTION },
    });
    expect(
      tileSourcesFromStoryMap({ tileUrl: 'https://tiles.example/{z}/{x}/{y}.png', attribution: 'Someone' }, {
        url: 'https://dark.example/{z}/{x}/{y}.png',
        attribution: 'Someone Dark',
        subdomains: ['a', 'b'],
      }),
    ).toEqual({
      light: { url: 'https://tiles.example/{z}/{x}/{y}.png', attribution: 'Someone' },
      dark: {
        url: 'https://dark.example/{z}/{x}/{y}.png',
        attribution: 'Someone Dark',
        subdomains: ['a', 'b'],
      },
    });
  });

  it('falls back to the built-in source and keeps a dark source without a url', () => {
    expect(toTileSources(undefined, undefined)).toEqual({
      light: { url: DEFAULT_TILE_URL, attribution: DEFAULT_TILE_ATTRIBUTION },
    });
    expect(toTileSources({ subdomains: 'abc' }, { attribution: 'Dark' })).toEqual({
      light: { url: DEFAULT_TILE_URL, attribution: DEFAULT_TILE_ATTRIBUTION, subdomains: 'abc' },
      dark: { url: DEFAULT_TILE_URL, attribution: 'Dark' },
    });
  });
});

describe('storymap/v1 stays untouched', () => {
  it('still shares one note-frontmatter extraction with the slide path', () => {
    const frontmatter = {
      title: 'Santiago',
      location: [-33.4489, -70.6693],
      mapmarker: 'city',
      description: 'The start.',
      cover: './santiago.jpg',
      mapzoom: [5, 18],
    };

    expect(slideFromNoteFrontmatter(frontmatter, 'fallback')).toEqual({
      title: 'Santiago',
      text: 'The start.',
      location: { lat: -33.4489, lng: -70.6693 },
      media: { type: 'image', src: './santiago.jpg' },
      mapmarker: 'city',
    });
  });
});
