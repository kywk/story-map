import { describe, expect, it } from 'vitest';

describe('StoryMap browser client SSR import', () => {
  it('imports without a document or a Leaflet map', async () => {
    expect(typeof document).toBe('undefined');
    const client = await import('./client.js');
    expect(typeof client.mountStoryMaps).toBe('function');
    expect(typeof client.startStoryMapClient()).toBe('function');
  });
});
