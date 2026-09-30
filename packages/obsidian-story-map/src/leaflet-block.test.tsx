// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { flushSync } from 'react-dom';
import type { App, MarkdownPostProcessorContext } from 'obsidian';
import type { GeoMapProps, GeoMapRuntime } from '@story-map/react-story-map';
import type { GeoMarker } from '@story-map/story-map-core';

/**
 * The `obsidian` package ships type definitions only, so nothing in this suite
 * imports it for real; the mock below is the single source of both the render
 * child instances and the notices the block raises.
 */
const obsidian = vi.hoisted(() => ({
  children: [] as Array<{ onunload(): void }>,
  notices: [] as string[],
}));

const recorded = vi.hoisted(() => ({ props: [] as unknown[] }));

vi.mock('obsidian', () => {
  class MarkdownRenderChild {
    constructor(public containerEl: unknown) {
      obsidian.children.push(this);
    }
    onunload(): void {}
  }
  class Notice {
    constructor(message: unknown) { obsidian.notices.push(String(message)); }
  }
  const normalizePath = (value: string) => value;
  return { MarkdownRenderChild, Notice, normalizePath };
});

// `<GeoMap />` is the shared renderer and is covered by its own suite. This suite
// asserts the host half: which config, callbacks, and options reach it, and that
// the surrounding block chrome and mount lifetime behave.
vi.mock('@story-map/react-story-map', async () => {
  const { createElement } = await import('react');
  return {
    GeoMap: (props: GeoMapProps) => {
      recorded.props.push(props);
      props.onReady?.(runtime);
      return createElement('div', { className: props.className, 'data-markers': props.map.markers.length });
    },
  };
});

import { LEAFLET_FENCE, LeafletBlockController } from './leaflet-block.js';
import { defaultSettings, type StoryMapPluginSettings } from './settings-data.js';

/** A point with Leaflet's `distanceTo`, matching what `GeoMap` calls. */
function point(lat: number, lng: number) {
  const x = lng * 10;
  const y = -lat * 10;
  return { x, y, distanceTo(other: { x: number; y: number }) { return Math.hypot(other.x - x, other.y - y); } };
}

const clickHandlers: Array<(event: unknown) => void> = [];
const runtime: GeoMapRuntime = {
  map: {
    on: (_type: string, handler: (event: unknown) => void) => { clickHandlers.push(handler); },
    off: (_type: string, handler: (event: unknown) => void) => {
      const index = clickHandlers.indexOf(handler);
      if (index >= 0) clickHandlers.splice(index, 1);
    },
    latLngToContainerPoint: ([lat, lng]: [number, number]) => point(lat, lng),
  } as unknown as GeoMapRuntime['map'],
  element: null,
  flyTo() {},
};

function emitClick(latlng: { lat: number; lng: number }, original: Record<string, unknown>): void {
  for (const handler of [...clickHandlers]) handler({ latlng, originalEvent: original });
}

beforeAll(() => {
  // Obsidian extends `HTMLElement` with `empty`, `addClass`, `removeClass`, and
  // `setText`; the block host uses all four, so a plain jsdom element needs them.
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.empty = function empty(this: HTMLElement) { this.replaceChildren(); };
  proto.addClass = function addClass(this: HTMLElement, ...classes: string[]) { this.classList.add(...classes); };
  proto.removeClass = function removeClass(this: HTMLElement, ...classes: string[]) { this.classList.remove(...classes); };
  proto.setText = function setText(this: HTMLElement, text: string) { this.textContent = text; };
});

afterEach(() => {
  recorded.props.length = 0;
  obsidian.children.length = 0;
  obsidian.notices.length = 0;
  clickHandlers.length = 0;
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

type RenderChild = { onunload(): void };

const FILES = [
  { path: 'Trips/Chile/Santiago.md', frontmatter: { title: 'Santiago', location: [-33.4489, -70.6693], mapmarker: 'restaurant' } },
  { path: 'Trips/Chile/Index.md', frontmatter: { title: 'Index' } },
];

function makeApp(): App & { triggered: unknown[]; opened: Array<[string, string, boolean]> } {
  const all = FILES.map((file) => ({ ...file, basename: file.path.split('/').pop() ?? file.path }));
  const triggered: unknown[] = [];
  const opened: Array<[string, string, boolean]> = [];
  const leaf = { view: { file: { path: 'Index of Chile.md' } } };
  const app = {
    triggered,
    opened,
    metadataCache: { getFileCache: (file: { frontmatter?: Record<string, unknown> }) => ({ frontmatter: file.frontmatter ?? {} }) },
    vault: { getMarkdownFiles: () => all, configDir: '.obsidian' },
    workspace: {
      trigger: (name: string, payload: unknown) => triggered.push([name, payload]),
      openLinkText: (link: string, source: string, newLeaf: boolean) => opened.push([link, source, newLeaf]),
      getLeavesOfType: () => [leaf],
      activeLeaf: leaf,
    },
  };
  return app as unknown as App & { triggered: unknown[]; opened: Array<[string, string, boolean]> };
}

function makeController(
  settings: Partial<StoryMapPluginSettings> = {},
  app: App = makeApp(),
): { controller: LeafletBlockController; app: ReturnType<typeof makeApp> } {
  const controller = new LeafletBlockController({
    app,
    getSettings: () => ({ ...defaultSettings(), ...settings }),
  });
  return { controller, app: app as ReturnType<typeof makeApp> };
}

/**
 * A fake Markdown render context. The render child Obsidian is asked to add is
 * collected so a test can unload it exactly the way the host does.
 */
function context(sourcePath = 'Index of Chile.md'): { ctx: MarkdownPostProcessorContext; children: RenderChild[] } {
  const children: RenderChild[] = [];
  const ctx = {
    sourcePath,
    addChild: (child: RenderChild) => { children.push(child); },
  } as unknown as MarkdownPostProcessorContext;
  return { ctx, children };
}

/**
 * `createRoot().render()` schedules its commit, so a test that reads the DOM or
 * the recorded props immediately needs the work flushed inside the same tick.
 */
function mount(
  controller: LeafletBlockController,
  source: string,
  el: HTMLElement,
  ctx: MarkdownPostProcessorContext,
): void {
  flushSync(() => controller.process(source, el, ctx));
}

function lastProps(): GeoMapProps {
  const props = recorded.props.at(-1) as GeoMapProps | undefined;
  if (!props) throw new Error('GeoMap was not rendered');
  return props;
}

const CHILE = 'lat: -33\nlong: -70\nheight: 600px\nmarkerFolder: Trips/Chile\n';

describe('leaflet code block processor', () => {
  it('claims exactly the historical fence language', () => {
    expect(LEAFLET_FENCE).toBe('leaflet');
  });

  it('mounts a map that uses the block height, not the forced full-leaf 100%', () => {
    const { controller } = makeController();
    const el = document.createElement('div');
    document.body.append(el);

    mount(controller, CHILE, el, context().ctx);

    expect(lastProps().map.height).toBe('600px');
    expect(lastProps().className).toBe('geo-story-map-block__map');
    expect(el.querySelector('.geo-story-map-block__map')).not.toBeNull();
  });

  it('resolves the marker folder into linked markers', () => {
    const { controller } = makeController();
    const el = document.createElement('div');
    mount(controller, CHILE, el, context().ctx);

    const markers = lastProps().map.markers;
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({
      title: 'Santiago',
      type: 'restaurant',
      location: { lat: -33.4489, lng: -70.6693 },
      notePath: 'Trips/Chile/Santiago.md',
    });
  });

  it('passes the note-link callbacks so markers open and preview like a story map', () => {
    const { controller, app } = makeController();
    const el = document.createElement('div');
    mount(controller, CHILE, el, context('Index of Chile.md').ctx);

    const { onNoteClick, onNoteHover } = lastProps();
    expect(lastProps().noteLinkClassName).toBe('internal-link');

    onNoteClick?.('Trips/Chile/Santiago.md', new MouseEvent('click'));
    expect(app.opened).toEqual([['Trips/Chile/Santiago.md', 'Index of Chile.md', true]]);

    const target = document.createElement('a');
    const event = new MouseEvent('mouseover');
    onNoteHover?.('Trips/Chile/Santiago.md', target, event);
    const [name, payload] = app.triggered[0] as [string, Record<string, unknown>];
    expect(name).toBe('hover-link');
    // The plugin's own registered source is reused; a second one is never built.
    expect(payload.source).toBe('geo-story-map');
    expect(payload.linktext).toBe('Trips/Chile/Santiago.md');
    expect(payload.sourcePath).toBe('Index of Chile.md');
    expect(payload.hoverParent).not.toBeNull();
  });

  it('omits the preview callback when the interaction setting is off', () => {
    const { controller, app } = makeController({
      interaction: { notePreview: false, copyCoordinatesOnShiftClick: false },
    });
    const el = document.createElement('div');
    mount(controller, CHILE, el, context().ctx);

    expect(lastProps().onNoteHover).toBeUndefined();
    // The link still opens, so switching the preview off never breaks navigation.
    lastProps().onNoteClick?.('Trips/Chile/Santiago.md', new MouseEvent('click'));
    expect(app.opened).toHaveLength(1);
  });

  it('shows parser diagnostics under the map so a pending key is never swallowed', () => {
    const { controller } = makeController();
    const el = document.createElement('div');
    mount(controller, 'lat: 1\nlong: 2\ngeojson: places.geojson\n', el, context().ctx);

    const items = [...el.querySelectorAll('.geo-story-map-diagnostics li')].map((item) => item.textContent);
    expect(items).toHaveLength(1);
    expect(items[0]).toContain('geojson');
    expect(items[0]).toContain('not implemented yet (P2)');
    expect(el.querySelector('.geo-story-map-diagnostics summary')?.textContent).toContain('1');
  });

  it('drops the diagnostics list when compatibility warnings are switched off', () => {
    const { controller } = makeController({ leafletCompatibility: { diagnostics: false } });
    const el = document.createElement('div');
    mount(controller, 'lat: 1\nlong: 2\ngeojson: places.geojson\n', el, context().ctx);

    expect(el.querySelector('.geo-story-map-diagnostics')).toBeNull();
    // The diagnostic is still on the config for a host that wants to show it.
    expect(lastProps().map.diagnostics).toHaveLength(1);
  });

  it('renders nothing extra for a clean block', () => {
    const { controller } = makeController();
    const el = document.createElement('div');
    mount(controller, 'lat: 1\nlong: 2\n', el, context().ctx);
    expect(el.querySelector('.geo-story-map-diagnostics')).toBeNull();
  });

  it('reports an unreadable block inside itself and leaves the element usable', () => {
    const { controller } = makeController();
    const el = document.createElement('div');
    document.body.append(el);

    mount(controller, 'lat: 1\nlong: not-a-number\n', el, context().ctx);

    expect(el.classList.contains('story-map-host--error')).toBe(true);
    expect(el.textContent).toContain('Leaflet block configuration error');
    expect(el.querySelector('.geo-story-map-block')).toBeNull();
  });

  it('reports a non-mapping block without throwing', () => {
    const { controller } = makeController();
    const el = document.createElement('div');
    mount(controller, '- just\n- a list\n', el, context().ctx);
    expect(el.classList.contains('story-map-host--error')).toBe(true);
  });
});

describe('mount lifetime', () => {
  it('releases the React root when Obsidian discards the block', () => {
    const { controller } = makeController();
    const el = document.createElement('div');
    const { ctx, children } = context();

    mount(controller, CHILE, el, ctx);
    expect(el.querySelector('.geo-story-map-block')).not.toBeNull();

    children[0]?.onunload();
    expect(el.querySelector('.geo-story-map-block')).toBeNull();
  });

  it('replaces the previous root on a re-render instead of stacking a second map', () => {
    const { controller } = makeController();
    const el = document.createElement('div');

    mount(controller, CHILE, el, context().ctx);
    mount(controller, CHILE, el, context().ctx);

    expect(recorded.props).toHaveLength(2);
    expect(el.querySelectorAll('.geo-story-map-block')).toHaveLength(1);
  });

  it('ignores a stale unload from a superseded render', () => {
    const { controller } = makeController();
    const el = document.createElement('div');

    const first = context();
    mount(controller, CHILE, el, first.ctx);
    const second = context();
    mount(controller, CHILE, el, second.ctx);

    // The first child unloads after the second render already replaced the root.
    first.children[0]?.onunload();
    expect(el.querySelector('.geo-story-map-block')).not.toBeNull();
  });

  it('keeps sibling blocks independent', () => {
    const { controller } = makeController();
    const first = document.createElement('div');
    const second = document.createElement('div');
    const a = context('A.md');
    const b = context('B.md');

    mount(controller, CHILE, first, a.ctx);
    mount(controller, CHILE, second, b.ctx);
    a.children[0]?.onunload();

    expect(first.querySelector('.geo-story-map-block')).toBeNull();
    expect(second.querySelector('.geo-story-map-block')).not.toBeNull();
  });

  it('re-renders open blocks on a settings change and stops after dispose', () => {
    const { controller } = makeController();
    const el = document.createElement('div');
    mount(controller, CHILE, el, context().ctx);

    flushSync(() => controller.refresh());
    expect(recorded.props).toHaveLength(2);

    controller.dispose();
    expect(el.querySelector('.geo-story-map-block')).toBeNull();

    mount(controller, CHILE, el, context().ctx);
    flushSync(() => controller.refresh());
    // A disposed controller neither mounts nor refreshes, so an unload can never
    // resurrect a Leaflet instance.
    expect(recorded.props).toHaveLength(2);
  });
});

describe('shift-click coordinate copy', () => {
  const CLOSE_ENOUGH = 'lat: -33.4489\nlong: -70.6693\nmarkerFolder: Trips/Chile\n';

  function withClipboard() {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    return writeText;
  }

  it('copies location: [lat, lng] for a shift-clicked marker', async () => {
    const writeText = withClipboard();
    const { controller } = makeController({
      interaction: { notePreview: true, copyCoordinatesOnShiftClick: true },
    });
    const el = document.createElement('div');
    mount(controller, CLOSE_ENOUGH, el, context().ctx);

    const preventDefault = vi.fn();
    emitClick({ lat: -33.449, lng: -70.6694 }, { shiftKey: true, preventDefault, target: null });
    await Promise.resolve();

    expect(writeText).toHaveBeenCalledWith('location: [-33.4489, -70.6693]');
    expect(preventDefault).toHaveBeenCalled();
  });

  it('ignores a plain click, a click far from any marker, and a click on a note link', async () => {
    const writeText = withClipboard();
    const { controller } = makeController({
      interaction: { notePreview: true, copyCoordinatesOnShiftClick: true },
    });
    const el = document.createElement('div');
    mount(controller, CLOSE_ENOUGH, el, context().ctx);

    emitClick({ lat: -33.4489, lng: -70.6693 }, { shiftKey: false, preventDefault: vi.fn(), target: null });
    emitClick({ lat: 10, lng: 20 }, { shiftKey: true, preventDefault: vi.fn(), target: null });

    const anchor = document.createElement('a');
    document.body.append(anchor);
    emitClick({ lat: -33.4489, lng: -70.6693 }, { shiftKey: true, preventDefault: vi.fn(), target: anchor });
    await Promise.resolve();

    expect(writeText).not.toHaveBeenCalled();
  });

  it('copies nothing while the setting is off', async () => {
    const writeText = withClipboard();
    const { controller } = makeController();
    const el = document.createElement('div');
    mount(controller, CLOSE_ENOUGH, el, context().ctx);

    emitClick({ lat: -33.4489, lng: -70.6693 }, { shiftKey: true, preventDefault: vi.fn(), target: null });
    await Promise.resolve();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('removes its map listener when the block unmounts', () => {
    const { controller } = makeController({
      interaction: { notePreview: true, copyCoordinatesOnShiftClick: true },
    });
    const el = document.createElement('div');
    const { ctx, children } = context();
    mount(controller, CLOSE_ENOUGH, el, ctx);

    expect(clickHandlers).toHaveLength(1);
    children[0]?.onunload();
    expect(clickHandlers).toHaveLength(0);
  });

  it('reports a copy failure instead of throwing', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: vi.fn(async () => { throw new Error('denied'); }) },
      configurable: true,
    });
    const { controller } = makeController({
      interaction: { notePreview: true, copyCoordinatesOnShiftClick: true },
    });
    const el = document.createElement('div');
    mount(controller, CLOSE_ENOUGH, el, context().ctx);

    emitClick({ lat: -33.4489, lng: -70.6693 }, { shiftKey: true, preventDefault: vi.fn(), target: null });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(obsidian.notices).toContain('Could not copy to clipboard');
  });
});

describe('block diagnostics and the note link contract', () => {
  it('keeps a clean marker list free of stray diagnostics in the DOM', () => {
    const { controller } = makeController();
    const el = document.createElement('div');
    mount(controller, 'lat: 1\nlong: 2\nmarkerFolder: Trips/Chile\n', el, context().ctx);
    expect(el.querySelectorAll('.geo-story-map-diagnostics li')).toHaveLength(0);
    expect(lastProps().map.markers).toHaveLength(1);
  });

  it('never fabricates a marker for a note without coordinates', () => {
    const { controller } = makeController();
    const el = document.createElement('div');
    mount(controller, 'lat: 1\nlong: 2\nmarkerFolder: Trips/Chile\n', el, context().ctx);
    const markers: GeoMarker[] = lastProps().map.markers;
    expect(markers.map((marker) => marker.notePath)).not.toContain('Trips/Chile/Index.md');
  });
});
