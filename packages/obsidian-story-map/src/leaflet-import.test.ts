import { describe, expect, it, vi } from 'vitest';
import type { App } from 'obsidian';
import { importLegacyLeafletSettings, isKeylessCarto, readLegacyLeafletSettings } from './leaflet-import.js';
import { defaultSettings, type StoryMapPluginSettings } from './settings-data.js';

vi.mock('obsidian', () => ({ normalizePath: (value: string) => value }));

function current(patch: Partial<StoryMapPluginSettings> = {}): StoryMapPluginSettings {
  return { ...defaultSettings(), ...patch };
}

describe('readLegacyLeafletSettings', () => {
  function makeApp(files: Record<string, string>): App {
    return {
      vault: {
        configDir: '.obsidian',
        adapter: {
          exists: async (path: string) => path in files,
          read: async (path: string) => files[path] as string,
        },
      },
    } as unknown as App;
  }

  it('reads the saved data only when the old plugin left a file', async () => {
    const app = makeApp({ '.obsidian/plugins/obsidian-leaflet/data.json': '{"defaultTile":"https://a.test/{z}/{x}/{y}.png"}' });
    expect(await readLegacyLeafletSettings(app)).toEqual({ defaultTile: 'https://a.test/{z}/{x}/{y}.png' });
  });

  it('returns null when the old plugin was never installed', async () => {
    expect(await readLegacyLeafletSettings(makeApp({}))).toBeNull();
  });

  it('returns null for unreadable or non-object data instead of throwing', async () => {
    expect(await readLegacyLeafletSettings(makeApp({ '.obsidian/plugins/obsidian-leaflet/data.json': '{oops' }))).toBeNull();
    expect(await readLegacyLeafletSettings(makeApp({ '.obsidian/plugins/obsidian-leaflet/data.json': '[1,2]' }))).toBeNull();
  });
});

describe('import candidate list', () => {
  const legacy = {
    defaultTile: 'https://tile.example.test/{z}/{x}/{y}.png',
    defaultTileDark: 'https://dark.example.test/{z}/{x}/{y}.png',
    defaultTileSubdomains: 'a, b',
    defaultAttribution: '© Example',
    defaultMarker: 'food',
    markerIcons: [
      { name: 'food', iconName: 'utensils', color: '#b45309', tags: 'eats', minZoom: 4, maxZoom: 18, layerBaseMarker: 'map-marker' },
      { name: 'shop', iconName: 'shopping-bag', color: '#0f766e' },
    ],
    displayMarkerTooltips: 'always',
    notePreview: false,
    copyOnClick: true,
    defaultUnitType: 'imperial',
    lat: 25.033,
    long: 121.5654,
  };

  it('imports exactly the documented candidates', () => {
    const result = importLegacyLeafletSettings(current(), legacy);

    expect(result.imported).toEqual(expect.arrayContaining([
      'tiles', 'markerTypes', 'defaultMarkerType', 'tooltip',
      'notePreview', 'copyCoordinatesOnShiftClick', 'defaultCenter', 'unitSystem',
    ]));
    expect(result.settings.map.tiles).toEqual({
      light: { url: 'https://tile.example.test/{z}/{x}/{y}.png', attribution: '© Example', subdomains: ['a', 'b'] },
      dark: { url: 'https://dark.example.test/{z}/{x}/{y}.png' },
    });
    expect(result.settings.markers).toEqual({
      defaultType: 'food',
      tooltip: 'always',
      types: [
        { id: 'food', icon: { kind: 'symbol', value: '🍴' }, color: '#b45309', tags: ['eats'], minZoom: 4, maxZoom: 18 },
        { id: 'shop', icon: { kind: 'symbol', value: '🛍' }, color: '#0f766e' },
      ],
    });
    expect(result.settings.interaction).toEqual({ notePreview: false, copyCoordinatesOnShiftClick: true });
    expect(result.settings.leafletCompatibility).toEqual({
      defaultCenter: [25.033, 121.5654],
      unitSystem: 'imperial',
      diagnostics: true,
    });
    expect(result.warnings).toEqual([]);
  });

  it('never imports mutable state, overlays, CSV data, map-view state, or the config directory', () => {
    const result = importLegacyLeafletSettings(current(), {
      ...legacy,
      mapMarkers: { 'Trips/A.md': [{ lat: 1, lng: 2 }] },
      overlay: { 'Trips/A.md': 'a,b,1,2' },
      geojson: 'places.geojson',
      verbose: true,
      isMapView: true,
      isInitiativeView: false,
      configDirectory: 'leaflet-config',
      version: 4,
    });

    expect(JSON.stringify(result.settings)).not.toContain('Trips/A.md');
    expect(JSON.stringify(result.settings)).not.toContain('places.geojson');
    expect(JSON.stringify(result.settings)).not.toContain('leaflet-config');
    expect(Object.keys(result.settings)).toEqual(['version', 'story', 'map', 'markers', 'interaction', 'leafletCompatibility']);
  });

  it('keeps a dark tile source the old plugin never had', () => {
    const result = importLegacyLeafletSettings(
      current({ map: { theme: 'auto', showPath: true, tiles: { dark: { url: 'https://mine.test/{z}/{x}/{y}.png' } } } }),
      { defaultTile: 'https://theirs.test/{z}/{x}/{y}.png' },
    );
    expect(result.settings.map.tiles).toEqual({
      light: { url: 'https://theirs.test/{z}/{x}/{y}.png' },
      dark: { url: 'https://mine.test/{z}/{x}/{y}.png' },
    });
  });

  it('leaves unrelated settings untouched and never mutates the current object', () => {
    const before = current({ story: { dateField: 'visited' } });
    importLegacyLeafletSettings(before, legacy);
    expect(before).toEqual(current({ story: { dateField: 'visited' } }));
  });

  it('reports nothing to import for an empty payload', () => {
    const result = importLegacyLeafletSettings(current(), {});
    expect(result.imported).toEqual([]);
    expect(result.settings).toEqual(current());
  });

  it('skips values of the wrong shape instead of importing them', () => {
    const result = importLegacyLeafletSettings(current(), {
      defaultTile: 42,
      notePreview: 'yes',
      copyOnClick: null,
      defaultUnitType: 'furlongs',
      lat: 25.033,
      long: 'east',
      displayMarkerTooltips: 'sometimes',
    });
    expect(result.imported).toEqual([]);
    expect(result.settings).toEqual(current());
  });
});

describe('marker type translation', () => {
  it('translates a known Font Awesome icon to a portable symbol', () => {
    const result = importLegacyLeafletSettings(current(), {
      markerIcons: [{ name: 'marathon', iconName: 'person-running' }],
    });
    expect(result.settings.markers.types).toEqual([{ id: 'marathon', icon: { kind: 'symbol', value: '🏃' } }]);
  });

  it('falls back to the default visual and warns for an icon it cannot translate', () => {
    const result = importLegacyLeafletSettings(current(), {
      markerIcons: [{ name: 'weird', iconName: 'fa-solid fa-otter' }],
    });
    // The type still exists, so the user's notes keep rendering; only the visual
    // falls back, and the reason is reported instead of being swallowed.
    expect(result.settings.markers.types).toEqual([{ id: 'weird' }]);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('weird');
  });

  it('matches the observed mapmarker values when the old data has no icon name', () => {
    const result = importLegacyLeafletSettings(current(), {
      markerIcons: [{ name: 'restaurant' }, { name: 'shop' }],
    });
    expect(result.settings.markers.types.map((type) => type.icon?.value)).toEqual(['🍴', '🛍']);
    expect(result.warnings).toEqual([]);
  });

  it('keeps an unknown default marker name so it still renders through the fallback', () => {
    const result = importLegacyLeafletSettings(current(), { defaultMarker: 'unicorn' });
    expect(result.settings.markers.defaultType).toBe('unicorn');
  });

  it('drops nameless and duplicated entries', () => {
    const result = importLegacyLeafletSettings(current(), {
      markerIcons: [{ color: '#fff' }, { name: 'Food' }, { name: 'food' }],
    });
    expect(result.settings.markers.types).toEqual([{ name: 'food' }].map((entry) => ({
      id: 'Food',
      icon: { kind: 'symbol' as const, value: '🍴' },
    })));
  });
});

describe('CARTO detection', () => {
  it('recognizes a keyless CARTO Basemaps URL', () => {
    expect(isKeylessCarto('https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png')).toBe(true);
    expect(isKeylessCarto('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png')).toBe(true);
    expect(isKeylessCarto('https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?api_key=abc')).toBe(false);
    expect(isKeylessCarto('https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png?key=abc')).toBe(false);
  });

  it('does not touch unrelated providers', () => {
    expect(isKeylessCarto('https://tile.openstreetmap.org/{z}/{x}/{y}.png')).toBe(false);
    expect(isKeylessCarto('not a url')).toBe(false);
    expect(isKeylessCarto('https://cartocdn.com/light_all/{z}/{x}/{y}.png')).toBe(false);
  });

  it('warns and does not make a keyless CARTO URL the default', () => {
    const result = importLegacyLeafletSettings(current(), {
      defaultTile: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      defaultAttribution: '© CARTO',
    });
    expect(result.settings.map.tiles).toBeUndefined();
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('does not contain an API key');
  });

  it('applies a keyed CARTO URL normally', () => {
    const result = importLegacyLeafletSettings(current(), {
      defaultTile: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?api_key=abc',
    });
    expect(result.settings.map.tiles?.light?.url).toContain('api_key=abc');
    expect(result.warnings).toEqual([]);
  });

  it('never treats a key-like value in the data as a secret to be hidden', () => {
    const result = importLegacyLeafletSettings(current(), {
      defaultTile: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?api_key=abc',
    });
    // The key is a public client credential in a settings file, not a secret, so it
    // is stored verbatim rather than redacted or dropped.
    expect(result.settings.map.tiles?.light?.url).toBe('https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png?api_key=abc');
  });
});
