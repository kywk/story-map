import { describe, expect, it } from 'vitest';
import { parseLeafletSourceYaml, parseStoryMapSourceObject } from '@story-map/story-map-core';
import {
  defaultSettings,
  migrateSettings,
  patchSettings,
  toLeafletSourceDefaults,
  toSourceDefaults,
  type StoryMapPluginSettings,
} from './settings-data.js';

function settings(patch: Partial<StoryMapPluginSettings> = {}): StoryMapPluginSettings {
  return { ...defaultSettings(), ...patch };
}

describe('settings version and shape', () => {
  it('ships every section with a built-in default', () => {
    expect(defaultSettings()).toEqual({
      version: 2,
      story: {},
      map: { theme: 'auto', showPath: true },
      markers: { defaultType: 'default', types: [], tooltip: 'hover' },
      interaction: { notePreview: true, copyCoordinatesOnShiftClick: false },
      leafletCompatibility: { diagnostics: true },
    });
  });

  it('falls back to the built-in defaults for absent or unreadable data', () => {
    expect(migrateSettings(null)).toEqual(defaultSettings());
    expect(migrateSettings('nope')).toEqual(defaultSettings());
    expect(migrateSettings({ version: 2, story: 'broken', map: 7 })).toEqual(defaultSettings());
  });

  it('clears a key when a patch value is undefined', () => {
    const withTheme = settings({ map: { theme: 'atlas', showPath: true } });
    const cleared = patchSettings(withTheme, 'map', { theme: undefined });
    expect(cleared.map).toEqual({ showPath: true });
    // The previous object is untouched, so an aborted edit cannot corrupt settings.
    expect(withTheme.map.theme).toBe('atlas');
  });
});

describe('version 1 migration', () => {
  // A realistic pre-v2 payload: every defaultable key a user could have set.
  const v1 = {
    order: 'desc',
    dateField: ' visited ',
    noteDisplay: 'full',
    initialSlide: 'last',
    panelOpacity: 0.6,
    mapTheme: 'vintage',
    mapZoom: 5,
    mapMinZoom: 2,
    mapMaxZoom: 18,
    mapTileUrl: ' https://tiles.test/{z}/{x}/{y}.png ',
    mapAttribution: ' © Test ',
    mapShowPath: false,
  };

  it('carries every existing StoryMap default into its section without loss', () => {
    const migrated = migrateSettings(v1);

    expect(migrated.version).toBe(2);
    expect(migrated.story).toEqual({
      order: 'desc',
      dateField: 'visited',
      noteDisplay: 'full',
      initialSlide: 'last',
      panelOpacity: 0.6,
    });
    expect(migrated.map).toEqual({
      theme: 'vintage',
      zoom: 5,
      minZoom: 2,
      maxZoom: 18,
      showPath: false,
      tiles: { light: { url: 'https://tiles.test/{z}/{x}/{y}.png', attribution: '© Test' } },
    });
    // Sections the flat format never had come up with their built-in defaults.
    expect(migrated.markers).toEqual(defaultSettings().markers);
    expect(migrated.interaction).toEqual(defaultSettings().interaction);
    expect(migrated.leafletCompatibility).toEqual(defaultSettings().leafletCompatibility);
  });

  it('produces the same source defaults after migration as before it', () => {
    expect(toSourceDefaults(migrateSettings(v1))).toEqual({
      order: 'desc',
      dateField: 'visited',
      noteDisplay: 'full',
      initialSlide: 'last',
      panelOpacity: 0.6,
      map: {
        theme: 'vintage',
        zoom: 5,
        minZoom: 2,
        maxZoom: 18,
        tileUrl: 'https://tiles.test/{z}/{x}/{y}.png',
        attribution: '© Test',
        showPath: false,
      },
    });
  });

  it('migrates the pre-0.3 mapOpacity key to panelOpacity', () => {
    expect(migrateSettings({ mapOpacity: 0.4 }).story.panelOpacity).toBe(0.4);
  });

  it('ignores blank text, non-finite numbers, and unusable enum values', () => {
    const migrated = migrateSettings({
      dateField: '   ',
      order: 'sideways',
      noteDisplay: 'poster',
      mapZoom: Number.NaN,
      mapTheme: 'neon',
      mapTileUrl: '  ',
      mapOpacity: 5,
    });

    expect(migrated.story).toEqual({ panelOpacity: 1 });
    expect(migrated.map).toEqual({ theme: 'auto', showPath: true });
  });

  it('re-validates a stored version 2 payload instead of trusting it', () => {
    const migrated = migrateSettings({
      version: 2,
      story: { order: 'asc', noteDisplay: 'poster' },
      map: { tiles: { light: { url: 'https://a.test/{z}/{x}/{y}.png', subdomains: 'a b' } } },
      markers: {
        defaultType: 'food',
        types: [{ id: 'food', color: '#b45309', tags: 'eats', minZoom: 5 }, { color: 'nameless' }],
        tooltip: 'sometimes',
      },
      interaction: { notePreview: false, copyCoordinatesOnShiftClick: true },
      leafletCompatibility: { defaultCenter: [25.03, 121.56], unitSystem: 'metric', diagnostics: false },
    });

    expect(migrated.story).toEqual({ order: 'asc' });
    expect(migrated.map.theme).toBe('auto');
    expect(migrated.map.tiles).toEqual({ light: { url: 'https://a.test/{z}/{x}/{y}.png', subdomains: 'a b' } });
    expect(migrated.markers).toEqual({
      defaultType: 'food',
      types: [{ id: 'food', color: '#b45309', tags: ['eats'], minZoom: 5 }],
      tooltip: 'hover',
    });
    expect(migrated.interaction).toEqual({ notePreview: false, copyCoordinatesOnShiftClick: true });
    expect(migrated.leafletCompatibility).toEqual({
      defaultCenter: [25.03, 121.56],
      unitSystem: 'metric',
      diagnostics: false,
    });
  });

  it('drops an out-of-range or malformed compatibility center', () => {
    expect(migrateSettings({ version: 2, leafletCompatibility: { defaultCenter: [91, 0] } }).leafletCompatibility)
      .toEqual({ diagnostics: true });
    expect(migrateSettings({ version: 2, leafletCompatibility: { defaultCenter: [1] } }).leafletCompatibility)
      .toEqual({ diagnostics: true });
  });
});

describe('story-map default resolution', () => {
  it('returns an empty defaults object when nothing is configured', () => {
    expect(toSourceDefaults({ ...defaultSettings(), map: {} })).toEqual({});
  });

  it('maps populated sections into source defaults', () => {
    const defaults = toSourceDefaults(
      settings({
        story: { order: 'desc', dateField: 'visited', noteDisplay: 'full', initialSlide: 'last', panelOpacity: 0.6 },
        map: {
          theme: 'vintage',
          zoom: 5,
          minZoom: 2,
          maxZoom: 18,
          showPath: false,
          tiles: { light: { url: 'https://tiles.test/{z}/{x}/{y}.png', attribution: '© Test' } },
        },
      }),
    );

    expect(defaults).toEqual({
      order: 'desc',
      dateField: 'visited',
      noteDisplay: 'full',
      initialSlide: 'last',
      panelOpacity: 0.6,
      map: {
        theme: 'vintage',
        zoom: 5,
        minZoom: 2,
        maxZoom: 18,
        tileUrl: 'https://tiles.test/{z}/{x}/{y}.png',
        attribution: '© Test',
        showPath: false,
      },
    });
  });

  it('ignores blank text and non-finite numbers', () => {
    const defaults = toSourceDefaults(
      settings({
        story: { dateField: '   ', panelOpacity: Number.NaN },
        map: { zoom: Number.NaN, tiles: { light: { url: '  ' } } },
      }),
    );
    expect(defaults).toEqual({});
  });

  it('clamps the panel opacity into range', () => {
    expect(toSourceDefaults(settings({ story: { panelOpacity: 3 } })).panelOpacity).toBe(1);
    expect(toSourceDefaults(settings({ story: { panelOpacity: -1 } })).panelOpacity).toBe(0);
  });

  it('lets the document theme override the plugin default', () => {
    const defaults = toSourceDefaults(settings({ map: { theme: 'cyber' } }));
    expect(parseStoryMapSourceObject({}, defaults).map.theme).toBe('cyber');
    expect(parseStoryMapSourceObject({ map: { theme: 'atlas' } }, defaults).map.theme).toBe('atlas');
    expect(parseStoryMapSourceObject({}).map.theme).toBe('light');
  });

  it('lets the document panel opacity override the plugin default', () => {
    const defaults = toSourceDefaults(settings({ story: { panelOpacity: 0.4 } }));
    expect(parseStoryMapSourceObject({}, defaults).panelOpacity).toBe(0.4);
    expect(parseStoryMapSourceObject({ panelOpacity: 0.8 }, defaults).panelOpacity).toBe(0.8);
    expect(parseStoryMapSourceObject({}).panelOpacity).toBe(0.85);
  });

  it('never lets a Leaflet-only default center a native story map', () => {
    const compat = settings({ leafletCompatibility: { defaultCenter: [25.03, 121.56], diagnostics: true } });
    expect(toSourceDefaults(compat)).toEqual({ map: { theme: 'auto', showPath: true } });
    expect(parseStoryMapSourceObject({}, toSourceDefaults(compat)).map.center).toBeUndefined();
  });
});

describe('leaflet default resolution', () => {
  it('never applies a story-map default to a legacy block', () => {
    const defaults = toLeafletSourceDefaults(
      settings({
        story: { order: 'desc', dateField: 'visited', noteDisplay: 'full', panelOpacity: 0.4 },
        map: { theme: 'cyber', zoom: 11, minZoom: 3, maxZoom: 19, showPath: false },
      }),
    );

    const parsed = parseLeafletSourceYaml('lat: 25\nlong: 121\n', defaults);
    expect(parsed.map.theme).toBe('light');
    expect(parsed.map.zoom).toBe(6);
    expect(parsed.map.minZoom).toBeUndefined();
    expect(parsed.map.maxZoom).toBeUndefined();
  });

  it('resolves a compatibility center only when the block omits lat/long', () => {
    const defaults = toLeafletSourceDefaults(
      settings({ leafletCompatibility: { defaultCenter: [25.03, 121.56], diagnostics: true } }),
    );
    expect(parseLeafletSourceYaml('', defaults).map.center).toEqual([25.03, 121.56]);
    expect(parseLeafletSourceYaml('lat: 10\nlong: 20\n', defaults).map.center).toEqual([10, 20]);
  });

  it('shares the light/dark tile pair with story maps', () => {
    const defaults = toLeafletSourceDefaults(
      settings({
        map: {
          theme: 'auto',
          tiles: {
            light: { url: 'https://light.test/{z}/{x}/{y}.png', attribution: '© Light', subdomains: 'a b' },
            dark: { url: 'https://dark.test/{z}/{x}/{y}.png', attribution: '© Dark' },
          },
        },
      }),
    );

    const parsed = parseLeafletSourceYaml('', defaults);
    expect(parsed.map.tiles.light).toEqual({
      url: 'https://light.test/{z}/{x}/{y}.png',
      attribution: '© Light',
      subdomains: 'a b',
    });
    expect(parsed.map.tiles.dark).toEqual({ url: 'https://dark.test/{z}/{x}/{y}.png', attribution: '© Dark' });
  });

  it('carries the marker registry and tooltip default to the storyless renderer', () => {
    const types = [{ id: 'food', color: '#b45309', icon: { kind: 'symbol' as const, value: '🍴' } }];
    const defaults = toLeafletSourceDefaults(
      settings({ markers: { defaultType: 'food', types, tooltip: 'always' } }),
    );
    expect(defaults.markerTypes).toBe(types);
    expect(defaults.defaultMarkerType).toBe('food');
    expect(defaults.tooltip).toBe('always');
  });
});
