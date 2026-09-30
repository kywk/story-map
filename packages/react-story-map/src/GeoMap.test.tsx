import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_TILE_ATTRIBUTION,
  DEFAULT_TILE_URL,
  toTileSources,
  type GeoMapConfig,
  type GeoMarker,
  type MarkerTooltipDisplay,
  type MarkerTypeDefinition,
} from '@story-map/story-map-core';
import { bindTooltip, GeoMap, tooltipBinding } from './GeoMap.js';
import { buildMarkerPlan, isMarkerVisibleAtZoom, markerZoomRange, resolveMarkerVisual } from './geoMarker.js';
import { resolveTileSource, tileLayerKey } from './geoTiles.js';
import { noteLinkAttributes } from './noteLink.js';
import { markerIndexForSlide, storyToGeoMapConfig } from './MapCanvas.js';
import type { StoryMapConfig } from '@story-map/story-map-core';

const TYPES: MarkerTypeDefinition[] = [
  { id: 'default' },
  { id: 'restaurant', color: '#b45309', icon: { kind: 'symbol', value: '🍴' } },
  { id: 'photo', icon: { kind: 'image', value: 'https://example.invalid/photo.png' } },
  { id: 'deep', minZoom: 10 },
];

function geoMap(overrides: Partial<GeoMapConfig> = {}): GeoMapConfig {
  return {
    schema: 'geomap/v1',
    height: '600px',
    map: { zoom: 6, theme: 'light', tiles: toTileSources(null) },
    markers: [],
    ...overrides,
  };
}

function marker(overrides: Partial<GeoMarker> = {}): GeoMarker {
  return { location: { lat: 25.03, lng: 121.56 }, ...overrides };
}

/** A partial marker whose optional keys may be explicitly absent (`exactOptionalPropertyTypes`). */
function markerWith(overrides: { tooltip?: MarkerTooltipDisplay | undefined }): GeoMarker {
  return marker(overrides.tooltip === undefined ? {} : { tooltip: overrides.tooltip });
}

describe('GeoMap SSR surface', () => {
  it('imports and renders without a document or a Leaflet instance', () => {
    // The SSR-safety invariant: this suite runs under Node, and importing the
    // renderer module must not have touched Leaflet or the DOM.
    expect(typeof document).toBe('undefined');
    expect(() => renderToStaticMarkup(<GeoMap map={geoMap()} />)).not.toThrow();
  });

  it('renders a standalone root carrying the theme hook, so built-in themes style a plain map', () => {
    // Regression guard: without the `.story-map` + `data-map-theme` root the whole
    // shared theme system silently stops applying to a storyless map.
    for (const theme of ['auto', 'light', 'dark', 'vintage', 'cyber', 'atlas'] as const) {
      const config = geoMap();
      config.map.theme = theme;
      const html = renderToStaticMarkup(<GeoMap map={config} />);
      expect(html).toContain('class="story-map"');
      expect(html).toContain(`data-map-theme="${theme}"`);
      expect(html).toContain('story-map__map');
    }
  });

  it('sizes the container from the configured height', () => {
    const html = renderToStaticMarkup(<GeoMap map={geoMap({ height: '420px' })} />);
    expect(html).toContain('style="height:420px"');
  });

  it('carries an authored id without using it as the DOM id', () => {
    // Two maps may legitimately reuse an authored id, so it must not become a
    // duplicate DOM `id`.
    const html = renderToStaticMarkup(<GeoMap map={geoMap({ id: 'chile-2509' })} />);
    expect(html).not.toContain('id="chile-2509"');
    expect(html).toContain('data-map-theme="light"');
  });

  it('renders only the map element in rootless mode, for StoryMap composition', () => {
    const html = renderToStaticMarkup(<GeoMap map={geoMap()} rootless />);
    expect(html).toBe('<div class="story-map__map"></div>');
  });

  it('adds host classes and a label to the standalone root', () => {
    const html = renderToStaticMarkup(<GeoMap map={geoMap()} className="host" label="Chile" />);
    expect(html).toContain('class="story-map host"');
    expect(html).toContain('aria-label="Chile"');
  });

  it('renders a map with no markers', () => {
    expect(() => renderToStaticMarkup(<GeoMap map={geoMap()} />)).not.toThrow();
  });

  it('renders a map whose options carry P1 controls the renderer deliberately leaves inert', () => {
    // `zoomDelta` and `controls` are P1; core emits a `leaflet-pending-p1`
    // diagnostic for them. Rendering must not crash on their presence.
    const config = geoMap();
    config.map.zoomDelta = 2;
    config.map.controls = { noUI: true, noScrollZoom: true, recenter: true, locked: true };
    expect(() => renderToStaticMarkup(<GeoMap map={config} />)).not.toThrow();
  });
});

describe('GeoMap marker types', () => {
  it('renders every configured marker and never drops an unknown type', () => {
    const plans = buildMarkerPlan(
      [
        marker({ title: 'Plain' }),
        marker({ type: 'restaurant', title: 'Noodle bar' }),
        marker({ type: 'photo', title: 'Photo' }),
        marker({ type: 'marathon', title: 'Unknown kind' }),
      ],
      TYPES,
      undefined,
    );

    expect(plans).toHaveLength(4);
    expect(plans[0]?.visual).toMatchObject({ kind: 'circle', type: 'default', unknown: false });
    expect(plans[1]?.visual).toMatchObject({ kind: 'symbol', symbol: '🍴', color: '#b45309', unknown: false });
    expect(plans[2]?.visual).toMatchObject({ kind: 'image', iconUrl: 'https://example.invalid/photo.png' });
    // The critical case: an unknown authored type still produces a marker, and the
    // authored name survives for diagnostics.
    expect(plans[3]?.visual).toMatchObject({ kind: 'circle', type: 'marathon', unknown: true });
  });

  it('falls back to the default visual for a type with no icon', () => {
    expect(resolveMarkerVisual(marker({ type: 'deep' }), TYPES)).toMatchObject({
      kind: 'circle',
      type: 'deep',
      unknown: false,
    });
  });

  it('treats an empty registry as "everything is the generic default"', () => {
    const visual = resolveMarkerVisual(marker({ type: 'restaurant' }), []);
    expect(visual).toMatchObject({ kind: 'circle', unknown: true, type: 'restaurant' });
    expect(resolveMarkerVisual(marker(), undefined).kind).toBe('circle');
  });

  it('keeps the shared marker class on every visual so the themes keep painting it', () => {
    for (const type of [undefined, 'restaurant', 'photo', 'marathon']) {
      const { className } = resolveMarkerVisual(marker(type === undefined ? {} : { type }), TYPES);
      expect(className.split(' ')).toContain('story-map__marker');
    }
  });
});

describe('GeoMap marker zoom visibility', () => {
  it('hides a marker with a mapzoom range outside that range and shows it inside', () => {
    const plans = buildMarkerPlan(
      [marker({ title: 'Deep', minZoom: 10, maxZoom: 14 })],
      TYPES,
      undefined,
    );
    const range = plans[0]!.range;

    expect(isMarkerVisibleAtZoom(range, 9)).toBe(false);
    expect(isMarkerVisibleAtZoom(range, 10)).toBe(true);
    expect(isMarkerVisibleAtZoom(range, 12)).toBe(true);
    expect(isMarkerVisibleAtZoom(range, 14)).toBe(true);
    expect(isMarkerVisibleAtZoom(range, 15)).toBe(false);
  });

  it('keeps an unbounded marker visible at every zoom', () => {
    const range = buildMarkerPlan([marker()], TYPES, undefined)[0]!.range;
    for (const zoom of [0, 6, 22]) expect(isMarkerVisibleAtZoom(range, zoom)).toBe(true);
  });

  it('honours a half-open range and a type-level bound', () => {
    expect(isMarkerVisibleAtZoom({ minZoom: 5 }, 4)).toBe(false);
    expect(isMarkerVisibleAtZoom({ maxZoom: 9 }, 10)).toBe(false);
    // A type with its own bound supplies the range when the marker has none.
    expect(markerZoomRange(marker({ type: 'deep' }), TYPES)).toEqual({ minZoom: 10 });
  });

  it('prefers the note mapzoom range over the marker type range', () => {
    expect(markerZoomRange(marker({ type: 'deep', minZoom: 3, maxZoom: 17 }), TYPES)).toEqual({
      minZoom: 3,
      maxZoom: 17,
    });
  });
});

describe('GeoMap tooltips', () => {
  const plans = (tooltip: MarkerTooltipDisplay | undefined, title = 'Place') =>
    buildMarkerPlan([markerWith({ tooltip })], TYPES, undefined)[0]!;

  it('binds always as a permanent tooltip and hover as an on-hover tooltip', () => {
    expect(plans('always').tooltip).toEqual({ permanent: true });
    expect(plans('hover').tooltip).toEqual({ permanent: false });
  });

  it('binds no tooltip for never', () => {
    expect(plans('never').tooltip).toBeNull();
  });

  it('binds a linked tooltip permanent and interactive, so its anchor is usable', () => {
    // Leaflet closes a non-permanent tooltip the moment the pointer leaves the
    // marker and ships tooltips with `pointer-events: none`. Without both of these
    // a marker whose tooltip holds a note link cannot be clicked, and the hover
    // source a host uses for an out-of-element preview leaves the DOM at once.
    const links = { onNoteClick: () => {}, onNoteHover: () => {} };
    const marker = { location: { lat: 1, lng: 2 }, title: 'Place', notePath: 'n.md' };

    expect(tooltipBinding(marker, { permanent: false }, links)).toEqual({
      permanent: true,
      interactive: true,
      linked: true,
    });
  });

  it('leaves an unlinked tooltip on plain Leaflet hover behavior', () => {
    const links = { onNoteClick: () => {}, onNoteHover: () => {} };
    const noNote = { location: { lat: 1, lng: 2 }, title: 'Place' };

    expect(tooltipBinding(noNote, { permanent: false }, links)).toEqual({
      permanent: false,
      interactive: false,
      linked: false,
    });
    // A permanent mode is still honored when there is no link to protect.
    expect(tooltipBinding(noNote, { permanent: true }, links).permanent).toBe(true);
  });

  it('leaves a note link on plain hover when the host has no callbacks', () => {
    // No callback means a normal `href` (Docusaurus), which is a real link the
    // pointer can follow, so Leaflet's own lifecycle is correct here.
    const marker = { location: { lat: 1, lng: 2 }, title: 'Place', notePath: '/notes/place' };

    expect(tooltipBinding(marker, { permanent: false }, {})).toEqual({
      permanent: false,
      interactive: false,
      linked: false,
    });
  });

  it('closes a linked tooltip right after binding it, so none stay open', () => {
    // Binding a permanent tooltip while the layer is already on the map makes
    // Leaflet open it, which once left every marker on the map showing a tooltip
    // that never closed. The fix is the immediate close in the same tick, and only
    // a linked tooltip takes that path.
    //
    // The suite runs under Node, so the tooltip content is built against a minimal
    // `document`; only its shape matters here, not its rendering.
    vi.stubGlobal('document', {
      createElement: () => {
        const element = {
          className: '',
          textContent: '',
          children: [] as unknown[],
          attributes: {} as Record<string, string>,
          setAttribute(name: string, value: string) {
            this.attributes[name] = value;
          },
          addEventListener() {},
          removeEventListener() {},
          appendChild(child: unknown) {
            this.children.push(child);
          },
        };
        return element;
      },
    });

    try {
      const links = { onNoteClick: () => {}, onNoteHover: () => {} };
      const marker = { location: { lat: 1, lng: 2 }, title: 'Place', notePath: 'n.md' };
      const plan = buildMarkerPlan([marker], TYPES, undefined)[0]!;

      const calls: string[] = [];
      const bindable = {
        bindTooltip: () => calls.push('bind'),
        closeTooltip: () => calls.push('close'),
      };
      const controller = { track: () => calls.push('track'), closeAll: () => {}, reset: () => {} };

      bindTooltip(bindable as never, plan, () => links, controller as never);
      expect(calls).toEqual(['bind', 'close', 'track']);

      calls.length = 0;
      const plain = buildMarkerPlan([{ location: { lat: 1, lng: 2 }, title: 'Place' }], TYPES, undefined)[0]!;
      bindTooltip(bindable as never, plain, () => links, controller as never);
      // An unlinked tooltip keeps Leaflet's own lifecycle, so nothing is closed here.
      expect(calls).toEqual(['bind']);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('defaults to hover, and lets the host default override it', () => {
    expect(plans(undefined).tooltip).toEqual({ permanent: false });
    const always = buildMarkerPlan([marker({ title: 'Place' })], TYPES, 'always')[0]!;
    expect(always.tooltip).toEqual({ permanent: true });
    const none = buildMarkerPlan([marker({ title: 'Place' })], TYPES, 'never')[0]!;
    expect(none.tooltip).toBeNull();
  });

  it('lets a marker override the host default', () => {
    const plan = buildMarkerPlan([marker({ title: 'Place', tooltip: 'never' })], TYPES, 'always')[0]!;
    expect(plan.tooltip).toBeNull();
  });

  it('knows whether a marker has anything to show', () => {
    expect(buildMarkerPlan([marker({ title: 'T' })], TYPES, 'hover')[0]!.hasTooltipContent).toBe(true);
    expect(buildMarkerPlan([marker({ description: 'D' })], TYPES, 'hover')[0]!.hasTooltipContent).toBe(true);
    expect(buildMarkerPlan([marker({ notePath: '/n/' })], TYPES, 'hover')[0]!.hasTooltipContent).toBe(true);
    expect(buildMarkerPlan([marker()], TYPES, 'hover')[0]!.hasTooltipContent).toBe(false);
  });
});

describe('GeoMap note links', () => {
  it('renders a plain href with no host callbacks (Docusaurus)', () => {
    const shape = noteLinkAttributes('/docs/santiago/', {});
    expect(shape).toEqual({
      className: 'story-map__note-link',
      href: '/docs/santiago/',
      dataHref: undefined,
      callbackDriven: false,
    });
  });

  it('becomes a callback-driven link with data-href once a host callback exists', () => {
    for (const shape of [
      { onNoteClick: () => undefined },
      { onNoteHover: () => undefined },
    ]) {
      const attributes = noteLinkAttributes('Notes/Santiago.md', shape);
      expect(attributes.callbackDriven).toBe(true);
      expect(attributes.dataHref).toBe('Notes/Santiago.md');
      expect(attributes.href).toBe('Notes/Santiago.md');
    }
  });

  it('keeps host classes without replacing the shared base class', () => {
    const attributes = noteLinkAttributes('/n/', { className: 'extra', noteLinkClassName: 'internal-link' });
    expect(attributes.className).toBe('story-map__note-link extra internal-link');
  });
});

describe('GeoMap tile sources', () => {
  it('uses the configured light url and attribution', () => {
    const config = geoMap();
    config.map.tiles = toTileSources({ url: 'https://tile.example/{z}/{x}/{y}.png', attribution: 'Example' });
    expect(resolveTileSource(config.map.tiles)).toMatchObject({
      url: 'https://tile.example/{z}/{x}/{y}.png',
      attribution: 'Example',
    });
  });

  it('falls back to the built-in OpenStreetMap source when a url or attribution is missing', () => {
    // `toTileSources` normalizes, and the renderer defends again so a hand-built
    // config with a blank source still requests the documented default.
    expect(resolveTileSource(undefined).url).toBe(DEFAULT_TILE_URL);
    expect(resolveTileSource(undefined).attribution).toBe(DEFAULT_TILE_ATTRIBUTION);
    expect(resolveTileSource({ light: { url: '', attribution: '' } }).url).toBe(DEFAULT_TILE_URL);
    expect(resolveTileSource({ light: { url: '', attribution: '' } }).attribution).toBe(DEFAULT_TILE_ATTRIBUTION);
    expect(DEFAULT_TILE_URL).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  });

  it('never treats a configured tile source as theme-selected or the reverse', () => {
    const tiles = toTileSources({ url: 'https://example.invalid/{z}/{x}/{y}.png', attribution: 'Example' });
    const light = geoMap();
    light.map.tiles = tiles;
    const dark = geoMap();
    dark.map.theme = 'vintage';
    dark.map.tiles = tiles;
    // Theme is presentation; the provider is unchanged by it.
    expect(resolveTileSource(dark.map.tiles).url).toBe(resolveTileSource(light.map.tiles).url);
  });

  it('changes its layer identity when the source, its bounds, or the map bounds change', () => {
    const base = geoMap().map;
    const initial = tileLayerKey(base);
    expect(tileLayerKey({ ...base, tiles: toTileSources({ url: 'https://b.invalid/{z}/{x}/{y}.png' }) })).not.toBe(initial);
    expect(tileLayerKey({ ...base, minZoom: 3 })).not.toBe(initial);
    expect(tileLayerKey({ ...base, maxZoom: 12 })).not.toBe(initial);
    // Re-deriving the same config must not churn the layer.
    expect(tileLayerKey({ ...base })).toBe(initial);
  });

  it('gives a tile source its own zoom bounds ahead of the map bounds', () => {
    const config = geoMap();
    config.map.minZoom = 4;
    config.map.tiles = toTileSources({ url: 'https://a.invalid/{z}/{x}/{y}.png', minZoom: 8, maxZoom: 11 });
    expect(resolveTileSource(config.map.tiles)).toMatchObject({ minZoom: 8, maxZoom: 11 });
  });
});

describe('StoryMap composition over GeoMap', () => {  const story: StoryMapConfig = {
    schema: 'storymap/v1',
    height: '520px',
    panelOpacity: 0.85,
    map: {
      theme: 'vintage',
      zoom: 5,
      minZoom: 4,
      maxZoom: 17,
      tileUrl: 'https://tile.example/{z}/{x}/{y}.png',
      attribution: 'Example',
      showPath: true,
    },
    layout: { mode: 'card', card: { align: 'left' }, full: { side: 'left', contentRatio: 0.5 } },
    slides: [
      { title: 'A', location: { lat: 1, lng: 1 } },
      { title: 'No location' },
      { title: 'B', location: { lat: 2, lng: 2, zoom: 9 } },
    ],
  };

  it('projects located slides into generic markers and bridges the published tile fields', () => {
    const config = storyToGeoMapConfig(story);
    expect(config.schema).toBe('geomap/v1');
    expect(config.height).toBe('520px');
    expect(config.markers).toEqual([
      { location: { lat: 1, lng: 1 } },
      { location: { lat: 2, lng: 2 } },
    ]);
    // `map.tileUrl` / `map.attribution` stay published and normalize into `tiles`.
    expect(config.map.tiles.light).toMatchObject({
      url: 'https://tile.example/{z}/{x}/{y}.png',
      attribution: 'Example',
    });
    expect(config.map).toMatchObject({ theme: 'vintage', zoom: 5, minZoom: 4, maxZoom: 17 });
  });

  it('renders through GeoMap as a rootless map element', () => {
    const html = renderToStaticMarkup(<GeoMap map={storyToGeoMapConfig(story)} rootless />);
    expect(html).toBe('<div class="story-map__map"></div>');
  });

  it('maps a slide index to the right marker index when some slides have no location', () => {
    expect(markerIndexForSlide(story.slides, 0)).toBe(0);
    expect(markerIndexForSlide(story.slides, 1)).toBeNull();
    expect(markerIndexForSlide(story.slides, 2)).toBe(1);
    expect(markerIndexForSlide(story.slides, 9)).toBeNull();
  });

  it('opens on the active marker, so an ordinary storyless map can too', () => {
    const config = storyToGeoMapConfig(story);
    const html = renderToStaticMarkup(<GeoMap map={config} activeMarkerIndex={1} />);
    expect(html).toContain('data-geomap');
    expect(html).toContain('story-map__map');
  });
});
