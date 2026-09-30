// SSR safety for the browser entry: importing it under Node must create no
// Leaflet map and mount nothing. The renderer and the React root are stubbed so
// an accidental import or mount would be counted rather than passing silently.
import { describe, expect, it, vi } from 'vitest';

const renderCalls = vi.hoisted(() => ({ count: 0 }));
const moduleLoads = vi.hoisted(() => ({ count: 0 }));

// Both entry points are stubbed so a Leaflet import or a React mount during SSR
// would be observable here rather than silently succeeding.
vi.mock('react-dom/client', () => ({
  createRoot: () => {
    renderCalls.count += 1;
    return { render: vi.fn(), unmount: vi.fn() };
  },
}));

vi.mock('@story-map/react-story-map', () => {
  moduleLoads.count += 1;
  return { StoryMap: () => null, GeoMap: () => null };
});

describe('browser client SSR import', () => {
  it('imports without a document and creates no Leaflet map', async () => {
    expect(typeof document).toBe('undefined');

    const client = await import('./client.js');

    expect(typeof client.mountStoryMaps).toBe('function');
    expect(typeof client.startStoryMapClient()).toBe('function');
    // Importing the browser entry under Node must not mount anything: the module
    // top level is guarded on `typeof document`, so the renderer is never even
    // imported, let alone Leaflet.
    expect(renderCalls.count).toBe(0);
    expect(moduleLoads.count).toBe(0);
  });

  it('returns a no-op teardown from startStoryMapClient without a document', async () => {
    const { startStoryMapClient } = await import('./client.js');

    const stop = startStoryMapClient();

    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
    expect(renderCalls.count).toBe(0);
  });
});
