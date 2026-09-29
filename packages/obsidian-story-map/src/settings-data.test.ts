import { describe, expect, it } from 'vitest';
import { parseStoryMapSourceObject } from '@story-map/story-map-core';
import { toSourceDefaults, type StoryMapPluginSettings } from './settings-data.js';

describe('toSourceDefaults', () => {
  it('returns an empty defaults object for empty settings', () => {
    expect(toSourceDefaults({})).toEqual({});
  });

  it('maps populated settings into source defaults', () => {
    const settings: StoryMapPluginSettings = {
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

    expect(toSourceDefaults(settings)).toEqual({
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
    const settings: StoryMapPluginSettings = {
      dateField: '   ',
      mapZoom: Number.NaN,
      panelOpacity: Number.NaN,
      mapTileUrl: '  ',
    };

    expect(toSourceDefaults(settings)).toEqual({});
  });

  it('lets the document theme override the plugin default', () => {
    const defaults = toSourceDefaults({ mapTheme: 'auto' });
    expect(parseStoryMapSourceObject({}, defaults).map.theme).toBe('auto');
    const cyberDefaults = toSourceDefaults({ mapTheme: 'cyber' });
    expect(parseStoryMapSourceObject({}, cyberDefaults).map.theme).toBe('cyber');
    expect(parseStoryMapSourceObject({ map: { theme: 'atlas' } }, cyberDefaults).map.theme).toBe('atlas');
    expect(parseStoryMapSourceObject({}).map.theme).toBe('light');
  });

  it('lets the document panel opacity override the plugin default', () => {
    const defaults = toSourceDefaults({ panelOpacity: 0.4 });
    expect(parseStoryMapSourceObject({}, defaults).panelOpacity).toBe(0.4);
    expect(parseStoryMapSourceObject({ panelOpacity: 0.8 }, defaults).panelOpacity).toBe(0.8);
    expect(parseStoryMapSourceObject({}).panelOpacity).toBe(0.85);
  });

  it('migrates legacy mapOpacity setting to panelOpacity default', () => {
    const defaults = toSourceDefaults({ mapOpacity: 0.4 } as unknown as StoryMapPluginSettings);
    expect(defaults.panelOpacity).toBe(0.4);
  });
});
