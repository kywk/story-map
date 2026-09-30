// The browser client serves both dialects from one lifecycle: the emitted
// `data-story-map-kind` discriminator picks `<StoryMap />` or `<GeoMap />`, and
// the page loads the renderer module - and therefore Leaflet - exactly once no
// matter how many hosts of either kind it holds.
//
// The suite runs under Node, so hosts are plain objects and the only DOM the
// client reaches for (building the diagnostics list) is supplied by a small fake
// element. That keeps the package free of a jsdom devDependency while still
// pinning the observable behavior.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const roots: Array<{ render: ReturnType<typeof vi.fn>; unmount: ReturnType<typeof vi.fn> }> = [];
  const imports: Array<number> = [];
  return { roots, imports };
});

vi.mock('react-dom/client', () => ({
  createRoot: () => {
    const root = { render: vi.fn(), unmount: vi.fn() };
    mocks.roots.push(root);
    return root;
  },
}));

// The factory runs on each module evaluation, so counting it is the direct
// evidence that a page holding a story host and a map host loads the renderer
// once. The components are named so the test can assert which one was chosen.
vi.mock('@story-map/react-story-map', () => {
  mocks.imports.push(mocks.imports.length);
  return {
    StoryMap: function MockStoryMap() {
      return null;
    },
    GeoMap: function MockGeoMap() {
      return null;
    },
  };
});

interface FakeElement {
  tagName: string;
  className: string;
  /** `data-*` attributes, keyed the way `HTMLElement.dataset` exposes them. */
  dataset: Record<string, string>;
  /** Every attribute the client set, keyed by its full name. */
  attributes: Record<string, string>;
  children: FakeElement[];
  textContent: string;
  isConnected: boolean;
  childElementCount: number;
  setAttribute(name: string, value: string): void;
  appendChild(child: FakeElement): FakeElement;
}

function fakeElement(tagName: string): FakeElement {
  return {
    tagName,
    className: '',
    dataset: {},
    attributes: {},
    children: [],
    textContent: '',
    isConnected: true,
    get childElementCount() {
      return this.children.length;
    },
    setAttribute(name, value) {
      this.attributes[name] = value;
      if (name.startsWith('data-')) this.dataset[camelCase(name.slice('data-'.length))] = value;
    },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
  };
}

function camelCase(value: string): string {
  return value.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Stub the only DOM the client touches - `document.createElement` for the
 * diagnostics list - and return every element it created, in creation order.
 */
function withFakeDom(): FakeElement[] {
  const created: FakeElement[] = [];
  vi.stubGlobal('document', {
    createElement: (tagName: string) => {
      const element = fakeElement(tagName);
      created.push(element);
      return element;
    },
  });
  return created;
}

function hostElement(kind: string | undefined, config: Record<string, unknown> | string): HTMLElement {
  const payload = typeof config === 'string' ? config : encodeURIComponent(JSON.stringify(config));
  // A plain data property, not a getter/setter pair: the client assigns
  // `textContent` once when a host fails, and reading it back must be trivial.
  const host = {
    dataset: {
      ...(kind === undefined ? {} : { storyMapKind: kind }),
      storyMapConfig: payload,
    },
    children: [] as unknown[],
    textContent: '',
    isConnected: true,
  };
  return host as unknown as HTMLElement;
}

function storyConfig(title: string): Record<string, unknown> {
  return { schema: 'storymap/v1', title, slides: [{ title }] };
}

function mapConfig(id?: string): Record<string, unknown> {
  return {
    schema: 'geomap/v1',
    ...(id === undefined ? {} : { id }),
    height: '600px',
    map: { zoom: 5, theme: 'light', tiles: { light: { url: 'u', attribution: 'a' } } },
    markers: [],
  };
}

function rendered(root: (typeof mocks.roots)[number]) {
  return root.render.mock.calls[0]?.[0] as {
    type: unknown;
    props: Record<string, unknown>;
  };
}

async function renderer() {
  return (await import('@story-map/react-story-map')) as unknown as {
    StoryMap: unknown;
    GeoMap: unknown;
  };
}

async function mount(hosts: HTMLElement[]): Promise<void> {
  const { mountStoryMaps } = await import('./client.js');
  mountStoryMaps({ querySelectorAll: () => hosts } as unknown as ParentNode);
  await vi.waitFor(() => expect(mocks.roots.length).toBeGreaterThan(0));
  // Let any remaining scheduled host run, so a missing mount is observable.
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  // The mocks are module-scoped, so each test starts from an empty root list.
  // `imports` is deliberately NOT reset: the renderer module is evaluated once
  // for the whole file, and the point of the counter is that a test cannot make
  // it grow.
  mocks.roots.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('browser client discriminator', () => {
  it('mounts a story host through the StoryMap renderer', async () => {
    await mount([hostElement('story', storyConfig('Chile'))]);

    const element = rendered(mocks.roots[0]!);
    const { StoryMap } = await renderer();
    expect(element.type).toBe(StoryMap);
    expect(element.props.story).toEqual(storyConfig('Chile'));
    // A story config is passed as `story`, never as `map`.
    expect(element.props.map).toBeUndefined();
  });

  it('mounts a map host through the GeoMap renderer', async () => {
    await mount([hostElement('map', mapConfig('chile-2509'))]);

    const element = rendered(mocks.roots[0]!);
    const { GeoMap } = await renderer();
    expect(element.type).toBe(GeoMap);
    expect(element.props.map).toEqual(mapConfig('chile-2509'));
    expect(element.props.story).toBeUndefined();
  });

  it('defaults a host with no discriminator to the story renderer', async () => {
    // A host emitted before the discriminator existed is still a story host, so
    // an already-published page keeps working.
    await mount([hostElement(undefined, storyConfig('Legacy'))]);

    const element = rendered(mocks.roots[0]!);
    const { StoryMap } = await renderer();
    expect(element.type).toBe(StoryMap);
    expect(element.props.story).toEqual(storyConfig('Legacy'));
  });

  it('mounts a story host and a map host on one page from one renderer import', async () => {
    await mount([
      hostElement('story', storyConfig('Trip')),
      hostElement('map', mapConfig('chile-2509')),
      hostElement('map', mapConfig('chile-2509')),
    ]);

    const { StoryMap, GeoMap } = await renderer();
    // One React root per host; Leaflet is created per root, inside each host.
    expect(mocks.roots).toHaveLength(3);
    // One renderer module evaluation for the page, which is what loads Leaflet.
    expect(mocks.imports).toHaveLength(1);
    expect(rendered(mocks.roots[0]!).type).toBe(StoryMap);
    // The two hosts sharing the authored id are two mounts, not one deduplicated.
    expect(rendered(mocks.roots[1]!).type).toBe(GeoMap);
    expect(rendered(mocks.roots[2]!).type).toBe(GeoMap);
    expect(rendered(mocks.roots[1]!).props.map).toEqual(mapConfig('chile-2509'));
  });

  it('does not double-mount a host across repeated passes', async () => {
    const { mountStoryMaps } = await import('./client.js');
    const hosts = [hostElement('map', mapConfig()), hostElement('story', storyConfig('Trip'))];
    const scope = { querySelectorAll: () => hosts } as unknown as ParentNode;

    mountStoryMaps(scope);
    mountStoryMaps(scope);
    mountStoryMaps(scope);
    await vi.waitFor(() => expect(mocks.roots).toHaveLength(2));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const { StoryMap, GeoMap } = await renderer();
    expect(mocks.roots).toHaveLength(2);
    expect(mocks.imports).toHaveLength(1);
    // Repeated passes reuse both roots: no re-render, no second Leaflet map.
    expect(rendered(mocks.roots[0]!).type).toBe(GeoMap);
    expect(rendered(mocks.roots[1]!).type).toBe(StoryMap);
  });

  it('unmounts a removed host and mounts a new one without leaking a root', async () => {
    const { mountStoryMaps } = await import('./client.js');
    const first = hostElement('map', mapConfig('egypt-2401'));
    const hosts = [first];
    const scope = () => ({ querySelectorAll: () => hosts }) as unknown as ParentNode;

    mountStoryMaps(scope());
    await vi.waitFor(() => expect(mocks.roots).toHaveLength(1));

    // Docusaurus SPA navigation: the old host leaves the DOM, a new one arrives.
    (first as unknown as { isConnected: boolean }).isConnected = false;
    hosts.push(hostElement('story', storyConfig('Next page')));
    mountStoryMaps(scope());
    await vi.waitFor(() => expect(mocks.roots[0]!.unmount).toHaveBeenCalledOnce());

    expect(mocks.roots).toHaveLength(2);
    expect(mocks.imports).toHaveLength(1);
  });
});

describe('browser client map-host diagnostics', () => {
  it('surfaces a recognized-but-unsupported key in the host element', async () => {
    const created = withFakeDom();
    await mount([
      hostElement('map', {
        ...mapConfig('deferred'),
        diagnostics: [
          {
            level: 'warning',
            code: 'leaflet-pending-p1',
            key: 'noUI',
            message: '`noUI` is recognized but not implemented yet (P1).',
          },
          {
            level: 'warning',
            code: 'leaflet-compat-metadata',
            key: 'unit',
            message: '`unit` is metadata only.',
          },
        ],
      }),
    ]);

    const [list, ...items] = created;
    expect(list?.tagName).toBe('ul');
    expect(list?.className).toBe('story-map-host__diagnostics');
    expect(items).toHaveLength(2);
    // Each entry names the offending key, so nothing is silently swallowed.
    expect(items.map((item) => item.dataset.key)).toEqual(['noUI', 'unit']);
    expect(items.map((item) => item.dataset.code)).toEqual([
      'leaflet-pending-p1',
      'leaflet-compat-metadata',
    ]);
    expect(items[0]!.textContent).toContain('(P1)');
    expect(items[1]!.textContent).toContain('metadata only');
  });

  it('marks an error-level diagnostic apart from a warning', async () => {
    const created = withFakeDom();

    await mount([
      hostElement('map', {
        ...mapConfig(),
        diagnostics: [
          { level: 'error', code: 'leaflet-invalid-value', key: 'defaultZoom', message: 'bad zoom' },
        ],
      }),
    ]);

    expect(created[1]?.dataset.level).toBe('error');
  });

  it('adds no diagnostics element for a clean map or a story host', async () => {
    const created = withFakeDom();

    await mount([hostElement('map', mapConfig()), hostElement('story', storyConfig('Trip'))]);

    expect(created).toEqual([]);
  });

  it('ignores a malformed diagnostics entry rather than rendering it', async () => {
    const created = withFakeDom();

    await mount([
      hostElement('map', {
        ...mapConfig(),
        diagnostics: [null, { level: 'warning' }, { level: 'warning', message: 'kept' }],
      }),
    ]);

    const [list, ...items] = created;
    expect(list?.tagName).toBe('ul');
    expect(items).toHaveLength(1);
    expect(items[0]!.textContent).toBe('kept');
  });
});

describe('browser client failure handling', () => {
  it('degrades a malformed payload in place instead of throwing into the page', async () => {
    const { mountStoryMaps } = await import('./client.js');
    const broken = hostElement('map', 'not-valid-json');
    const scope = { querySelectorAll: () => [broken] } as unknown as ParentNode;

    expect(() => mountStoryMaps(scope)).not.toThrow();

    await vi.waitFor(() => expect(broken.textContent).toContain('StoryMap error'));
    // The failure is reported in place as one readable line, and no map root was
    // created for the broken host.
    expect(broken.textContent.split('\n')).toHaveLength(1);
    expect(mocks.roots.every((root) => root.render.mock.calls.length === 0)).toBe(true);
  });

  it('leaves a host with no payload untouched', async () => {
    const { mountStoryMaps } = await import('./client.js');
    const empty = { dataset: { storyMapKind: 'map' }, isConnected: true } as unknown as HTMLElement;
    const scope = { querySelectorAll: () => [empty] } as unknown as ParentNode;

    mountStoryMaps(scope);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect((empty as unknown as { textContent?: string }).textContent).toBeUndefined();
  });

  it('skips a host that left the DOM before the renderer finished loading', async () => {
    const { mountStoryMaps } = await import('./client.js');
    const gone = hostElement('map', mapConfig());
    (gone as unknown as { isConnected: boolean }).isConnected = false;

    mountStoryMaps({ querySelectorAll: () => [gone] } as unknown as ParentNode);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mocks.roots).toHaveLength(0);
  });
});
