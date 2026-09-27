import { describe, expect, it } from 'vitest';
import {
  MAX_COORDINATE_CANDIDATES,
  coordinateLookupPrompt,
  formatLocationLine,
  parseCoordinateCandidates,
} from './coordinates.js';

describe('coordinateLookupPrompt', () => {
  it('states multilingual support and requires JSON only', () => {
    const prompt = coordinateLookupPrompt();
    expect(prompt).toContain('Chinese');
    expect(prompt).toContain('JSON array');
    expect(prompt).toContain('mapmarker');
  });
});

describe('parseCoordinateCandidates', () => {
  it('parses a plain JSON array', () => {
    const candidates = parseCoordinateCandidates(
      '[{"name":"Taipei 101","lat":25.033964,"lng":121.564468,"mapmarker":"building"}]',
    );
    expect(candidates).toEqual([
      { name: 'Taipei 101', lat: 25.033964, lng: 121.564468, mapmarker: 'building' },
    ]);
  });

  it('accepts fenced output and surrounding prose', () => {
    const fenced = '```json\n[{"name":"高雄","lat":22.6273,"lng":120.3014}]\n```';
    expect(parseCoordinateCandidates(fenced)[0]?.name).toBe('高雄');
    const prose = 'Here are the results:\n[{"name":"Kyoto","lat":35.0116,"lng":135.7681}]\nDone.';
    expect(parseCoordinateCandidates(prose)[0]?.name).toBe('Kyoto');
  });

  it('rejects invalid entries and throws when nothing is valid', () => {
    expect(() => parseCoordinateCandidates('[{"name":"Nowhere","lat":999,"lng":999}]')).toThrow();
    expect(() => parseCoordinateCandidates('not json')).toThrow();
  });

  it('deduplicates by rounded coordinates and caps the list', () => {
    const entries = Array.from({ length: 8 }, (_, index) => ({
      name: `Place ${index}`,
      lat: 25.033964,
      lng: 121.564468,
    }));
    entries.push({ name: 'Unique', lat: 22.6273, lng: 120.3014 });
    const candidates = parseCoordinateCandidates(JSON.stringify(entries));
    expect(candidates).toHaveLength(Math.min(MAX_COORDINATE_CANDIDATES, 2));
  });
});

describe('formatLocationLine', () => {
  it('emits a YAML frontmatter line without trailing zeros', () => {
    expect(formatLocationLine(-33.4489, -70.6693)).toBe('location: [-33.4489, -70.6693]');
    expect(formatLocationLine(25.033, 121.5)).toBe('location: [25.033, 121.5]');
  });
});
