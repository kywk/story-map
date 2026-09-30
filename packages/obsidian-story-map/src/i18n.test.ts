import { afterEach, describe, expect, it } from 'vitest';
import { configureI18n, resolveLocale, t, translateMessage } from './i18n.js';

afterEach(() => configureI18n('en'));

describe('resolveLocale', () => {
  it('maps Traditional Chinese Obsidian languages to zh-TW', () => {
    expect(resolveLocale('zh-TW')).toBe('zh-TW');
    expect(resolveLocale('zh_Hant')).toBe('zh-TW');
    expect(resolveLocale('zh-HK')).toBe('zh-TW');
  });

  it('falls back to English for other languages', () => {
    expect(resolveLocale('en')).toBe('en');
    expect(resolveLocale('zh-CN')).toBe('en');
  });
});

describe('t', () => {
  it('returns the key in English and the translation in Chinese', () => {
    configureI18n('en');
    expect(t('Find coordinates with AI')).toBe('Find coordinates with AI');
    configureI18n('zh-TW');
    expect(t('Find coordinates with AI')).toBe('用 AI 查找座標');
  });

  it('interpolates named values', () => {
    configureI18n('en');
    expect(t('Test succeeded: {answer}', { answer: 'OK' })).toBe('Test succeeded: OK');
  });
});

describe('inline leaflet block messages', () => {
  it('translates every user-facing string a leaflet block can raise', () => {
    configureI18n('zh-TW');
    const keys = [
      'Map',
      'Compatibility notices ({count})',
      'Leaflet block configuration error',
      'Leaflet block error',
      'Marker type: {id}',
      'Add marker type',
      'Remove marker type',
      'Import settings from Obsidian Leaflet',
      'Reads the old plugin settings once, if they exist in this vault. Mutable markers, overlays, CSV data, and map-view state are not imported.',
      'No saved Obsidian Leaflet settings were found in this vault.',
      'No importable Obsidian Leaflet settings were found.',
      'Imported Obsidian Leaflet settings: {items}',
    ] as const;

    for (const key of keys) {
      // A missing translation would echo the English key, which is the failure
      // this guards against.
      expect(t(key, { count: 2, id: 'food', items: 'tiles' })).not.toBe(key);
    }
  });

  it('localizes an importer warning at the notice boundary', () => {
    configureI18n('zh-TW');
    const warning =
      'This CARTO Basemaps URL does not contain an API key. CARTO now requires keys for Basemaps. Configure a CARTO key or switch to another tile provider.';
    expect(translateMessage(warning)).toContain('CARTO');
    expect(translateMessage(warning)).not.toBe(warning);

    const icon = 'The marker type "{id}" uses an icon this plugin cannot translate to a portable symbol. It keeps the default marker visual; set a symbol or image in settings to change it.';
    expect(translateMessage(icon.replace('{id}', 'food'))).toContain('food');
  });

  it('interpolates a count and a marker id in Chinese', () => {
    configureI18n('zh-TW');
    expect(t('Compatibility notices ({count})', { count: 3 })).toBe('相容性提示（3）');
    expect(t('Marker type: {id}', { id: 'food' })).toBe('標記類型：food');
  });
});

describe('translateMessage', () => {
  it('maps both keys and already-localized messages', () => {
    configureI18n('zh-TW');
    expect(translateMessage('The request was cancelled.')).toBe('要求已取消。');
    expect(translateMessage('要求已取消。')).toBe('要求已取消。');
    expect(translateMessage('unknown diagnostic')).toBe('unknown diagnostic');
  });
});
