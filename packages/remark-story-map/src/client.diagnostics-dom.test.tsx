import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { GeoMapConfig } from '@story-map/story-map-core';
import { MapHost } from './client.js';

/**
 * A map host is a React *tree*, not a container plus some appended nodes.
 *
 * React takes ownership of a `createRoot` container and clears its existing
 * children on the first commit, so a host that appended its diagnostics list
 * around `root.render()` produced a page where the diagnostics silently
 * vanished. A test that mocks `react-dom/client` cannot catch that, because
 * nothing ever mounts - so this renders the real component with the real React
 * renderer and asserts the list is part of the output.
 */

vi.mock('@story-map/react-story-map', () => ({
  StoryMap: function MockStoryMap() {
    return null;
  },
  GeoMap: function MockGeoMap() {
    return <div className="map-surface" />;
  },
}));

const renderer = await import('@story-map/react-story-map');

const config: GeoMapConfig = {
  schema: 'geomap/v1',
  height: '500px',
  map: {
    theme: 'light',
    zoom: 6,
    tiles: {
      light: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OSM' },
    },
  },
  markers: [],
};

function render(value: GeoMapConfig): string {
  return renderToStaticMarkup(<MapHost config={value} GeoMap={renderer.GeoMap} />);
}

describe('map host markup, rendered by real React', () => {
  it('renders the map and keeps the diagnostics list in the same tree', () => {
    const html = render({
      ...config,
      diagnostics: [
        {
          level: 'warning',
          code: 'leaflet-compat-metadata',
          key: 'unit',
          message: 'unit is accepted but has no effect yet.',
        },
      ],
    });

    expect(html).toContain('map-surface');
    expect(html).toContain('story-map-host__diagnostics');
    expect(html).toContain('unit is accepted but has no effect yet.');
    expect(html).toContain('data-key="unit"');
    expect(html).toContain('data-code="leaflet-compat-metadata"');
    expect(html).toContain('data-level="warning"');
  });

  it('marks an error-level diagnostic apart from a warning', () => {
    const html = render({
      ...config,
      diagnostics: [
        { level: 'error', code: 'leaflet-invalid-value', key: 'lat', message: 'lat is invalid.' },
      ],
    });

    expect(html).toContain('data-level="error"');
  });

  it('renders every diagnostic, not only the first', () => {
    const html = render({
      ...config,
      diagnostics: [
        { level: 'warning', code: 'leaflet-pending-p1', key: 'markerFile', message: 'markerFile is pending.' },
        { level: 'warning', code: 'leaflet-pending-p2', key: 'gpx', message: 'gpx is pending.' },
        { level: 'warning', code: 'leaflet-pending-p3', key: 'image', message: 'image is pending.' },
      ],
    });

    expect(html.match(/story-map-host__diagnostics/g)).toHaveLength(1);
    expect(html).toContain('markerFile is pending.');
    expect(html).toContain('gpx is pending.');
    expect(html).toContain('image is pending.');
  });

  it('renders a clean map with no diagnostics element', () => {
    const html = render(config);

    expect(html).toContain('map-surface');
    expect(html).not.toContain('story-map-host__diagnostics');
  });

  it('ignores a malformed diagnostic instead of rendering it', () => {
    const malformed = {
      ...config,
      // A payload that reached the browser from a hand-edited or stale host.
      diagnostics: [
        null,
        { level: 'warning' },
        { level: 'warning', message: '' },
        { level: 'warning', message: 'kept' },
      ],
    } as unknown as GeoMapConfig;

    const html = render(malformed);

    expect(html).toContain('kept');
    expect(html.match(/<li/g)).toHaveLength(1);
  });
});
