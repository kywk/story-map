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

describe('translateMessage', () => {
  it('maps both keys and already-localized messages', () => {
    configureI18n('zh-TW');
    expect(translateMessage('The request was cancelled.')).toBe('要求已取消。');
    expect(translateMessage('要求已取消。')).toBe('要求已取消。');
    expect(translateMessage('unknown diagnostic')).toBe('unknown diagnostic');
  });
});
