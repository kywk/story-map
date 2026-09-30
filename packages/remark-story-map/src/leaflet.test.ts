// The Docusaurus half of Leaflet fenced-block compatibility: the build-time
// transform for the `leaflet` dialect, its `markerFolder` resolution through the
// existing VaultIndex, and the discriminator that drives the one browser client.
//
// The four production fixtures are parsed verbatim (see `fixtures.ts`) because
// Phase 1's whole promise is that existing content renders without source edits.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import matter from 'gray-matter';
import type { Code, Html, Root } from 'mdast';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_TILE_ATTRIBUTION,
  DEFAULT_TILE_URL,
  LEAFLET_DIAGNOSTIC_CODES,
  parseLeafletSourceYaml,
  type GeoMapConfig,
} from '@story-map/story-map-core';
import remarkStoryMap, { LEAFLET_FENCE, STORY_MAP_FENCE, VaultIndex } from './index.js';
import { LEAFLET_FIXTURES } from './fixtures.js';

const roots: string[] = [];

function tempVault(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'storymap-leaflet-'));
  roots.push(root);
  return root;
}

function note(root: string, relativePath: string, frontmatter: Record<string, unknown>): void {
  const absolute = path.join(root, `${relativePath}.md`);
  mkdirSync(path.dirname(absolute), { recursive: true });
  writeFileSync(absolute, matter.stringify('Note body.', frontmatter));
}

function fenceTree(...blocks: Array<{ lang: string; value: string }>): Root {
  return { type: 'root', children: blocks.map(({ lang, value }) => ({ type: 'code', lang, value })) };
}

interface HostElement {
  kind: string | undefined;
  instance: string | undefined;
  isDocument: boolean;
  value: string;
}

function host(html: Html): HostElement {
  const attribute = (name: string) => new RegExp(`${name}="([^"]*)"`).exec(html.value)?.[1];
  return {
    kind: attribute('data-story-map-kind'),
    instance: attribute('data-story-map-instance'),
    isDocument: html.value.includes('data-story-map-document="true"'),
    value: html.value,
  };
}

function payload(html: Html): GeoMapConfig {
  const match = /data-story-map-config="(.+?)"/.exec(html.value);
  if (!match?.[1]) throw new Error('Map host attribute missing');
  return JSON.parse(decodeURIComponent(match[1])) as GeoMapConfig;
}

function diagnosticKeys(config: GeoMapConfig): string[] {
  return (config.diagnostics ?? [])
    .map((diagnostic) => diagnostic.key)
    .filter((key): key is string => typeof key === 'string');
}

afterEach(() => {
  while (roots.length > 0) {
    const root = roots.pop();
    if (root) rmSync(root, { recursive: true, force: true });
  }
});

describe('remarkStoryMap leaflet fixtures', () => {
  it('leaves the fence language constant and the story fence distinct', () => {
    expect(LEAFLET_FENCE).toBe('leaflet');
    expect(STORY_MAP_FENCE).toBe('story-map');
  });

  for (const fixture of LEAFLET_FIXTURES) {
    it(`transforms the ${fixture.name} block without source edits`, () => {
      const tree = fenceTree({ lang: LEAFLET_FENCE, value: fixture.block });

      remarkStoryMap()(tree, { path: '/vault/' + fixture.source });

      const node = tree.children[0] as Html;
      expect(node.type).toBe('html');
      expect(host(node).kind).toBe('map');

      const config = payload(node);
      expect(config.schema).toBe('geomap/v1');
      // The authored id passes through untouched, even where it repeats.
      expect(config.id).toBe(fixture.id);
      expect(config.height).toBe(fixture.height);
      expect(config.map.center).toEqual(fixture.center);
      expect(config.map.zoom).toBe(fixture.zoom);
      expect(config.map.minZoom).toBe(fixture.minZoom);
      expect(config.map.maxZoom).toBe(fixture.maxZoom);
    });
  }

  it('renders both blocks that share the authored id chile-2509 without colliding', () => {
    const shared = LEAFLET_FIXTURES.filter((fixture) => fixture.id === 'chile-2509');
    expect(shared.map((fixture) => fixture.name)).toEqual(['Chile', 'Xinjiang']);

    // One page, one authored id, two unrelated maps.
    const tree = fenceTree(
      { lang: LEAFLET_FENCE, value: shared[0]!.block },
      { lang: LEAFLET_FENCE, value: shared[1]!.block },
    );

    remarkStoryMap()(tree, { path: '/vault/backpacker/Combined.md' });

    const [chile, xinjiang] = tree.children as Html[];
    // The authored id is preserved verbatim on both...
    expect(payload(chile!).id).toBe('chile-2509');
    expect(payload(xinjiang!).id).toBe('chile-2509');
    // ...while the hosts are two distinct instances with their own maps.
    expect(host(chile!).instance).toBeDefined();
    expect(host(xinjiang!).instance).toBeDefined();
    expect(host(chile!).instance).not.toBe(host(xinjiang!).instance);
    expect(payload(chile!).map.center).toEqual([-33, -70]);
    expect(payload(xinjiang!).map.center).toEqual([42, 82]);
  });

  it('renders the two maps that share one source document independently', () => {
    // Egypt and Kuala Lumpur both live in `Index Pharaoh Egypt.md`, so a single
    // transform of that document emits two map hosts.
    const egypt = LEAFLET_FIXTURES.find((fixture) => fixture.name === 'Egypt')!;
    const kl = LEAFLET_FIXTURES.find((fixture) => fixture.name === 'Kuala Lumpur')!;
    const tree = fenceTree(
      { lang: LEAFLET_FENCE, value: egypt.block },
      { lang: LEAFLET_FENCE, value: kl.block },
    );

    remarkStoryMap()(tree, { path: '/vault/' + egypt.source });

    const hosts = (tree.children as Html[]).map(payload);
    expect(hosts.map((config) => config.id)).toEqual(['egypt-2401', 'kl-2401']);
    expect(hosts.map((config) => config.map.center)).toEqual([
      [27.5, 29.5],
      [3.15, 101.67],
    ]);
    expect(hosts.map((config) => config.map.zoom)).toEqual([6, 13]);
  });

  it('accepts unit and scale as compatibility metadata instead of failing', () => {
    for (const fixture of LEAFLET_FIXTURES) {
      const config = payload(transform(fixture.block));
      expect(config.diagnostics?.some((d) => d.level === 'error')).toBe(false);
      expect(diagnosticKeys(config)).toEqual(expect.arrayContaining(['unit', 'scale', 'darkMode']));
    }
  });

  it('uses the built-in OpenStreetMap tile source with visible attribution', () => {
    const config = payload(transform(LEAFLET_FIXTURES[0]!.block));

    expect(config.map.tiles.light.url).toBe(DEFAULT_TILE_URL);
    expect(config.map.tiles.light.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
    expect(config.map.tiles.light.attribution).toBe(DEFAULT_TILE_ATTRIBUTION);
    // darkMode is accepted metadata, not a silent tile-provider switch.
    expect(config.map.tiles.dark).toBeUndefined();
    expect(config.map.theme).toBe('light');
  });

  it('serializes no absolute local filesystem path into the HTML', () => {
    const vaultRoot = tempVault();
    note(vaultRoot, 'backpacker/2509 Chile/Chile/Santiago', {
      title: 'Santiago',
      location: [-33.4489, -70.6693],
    });
    const fixture = LEAFLET_FIXTURES[0]!;
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: fixture.block });

    remarkStoryMap({ vaultRoot })(tree, { path: path.join(vaultRoot, fixture.source) });

    const node = tree.children[0] as Html;
    expect(node.value).not.toContain(vaultRoot);
    expect(decodeURIComponent(node.value)).not.toContain(vaultRoot);
  });
});

function transform(block: string): Html {
  const tree = fenceTree({ lang: LEAFLET_FENCE, value: block });
  remarkStoryMap()(tree);
  return tree.children[0] as Html;
}

describe('remarkStoryMap leaflet markerFolder resolution', () => {
  function vaultWithTrip(): string {
    const vaultRoot = tempVault();
    note(vaultRoot, 'backpacker/2509 Chile/Chile/Santiago', {
      title: 'Santiago',
      location: [-33.4489, -70.6693],
      mapmarker: 'restaurant',
    });
    // A nested note proves the scan is recursive, not one level deep.
    note(vaultRoot, 'backpacker/2509 Chile/Chile/Regions/Valparaiso', {
      title: 'Valparaiso',
      location: [-33.0472, -71.6127],
      description: 'A port city.',
    });
    // No valid `location`: skipped, never a build failure.
    note(vaultRoot, 'backpacker/2509 Chile/Chile/Unlocated', { title: 'Unlocated' });
    note(vaultRoot, 'backpacker/2509 Chile/Chile/Broken', { title: 'Broken', location: 'not a coordinate' });
    // Outside the folder.
    note(vaultRoot, 'backpacker/2509 Chile/Elsewhere/Lima', {
      title: 'Lima',
      location: [-12.0464, -77.0428],
    });
    // Excluded tooling directories must not contribute markers even when they sit
    // inside the marker folder.
    for (const excluded of ['node_modules/pkg', 'build/out', 'dist/out', 'coverage/out', '.hidden/out']) {
      note(vaultRoot, `backpacker/2509 Chile/Chile/${excluded}`, {
        title: `Excluded ${excluded}`,
        location: [0, 0],
      });
    }
    return vaultRoot;
  }

  it('resolves a markerFolder recursively and skips notes without a location', () => {
    const vaultRoot = vaultWithTrip();
    const tree = fenceTree({
      lang: LEAFLET_FENCE,
      value: LEAFLET_FIXTURES[0]!.block,
    });

    remarkStoryMap({ vaultRoot })(tree);

    const config = payload(tree.children[0] as Html);
    // Ordered by Vault-relative path, not by filesystem order, so the serialized
    // marker list is deterministic across machines and hosts.
    expect(config.markers.map((marker) => marker.title)).toEqual(['Valparaiso', 'Santiago']);
    expect(config.markers[1]?.location).toEqual({ lat: -33.4489, lng: -70.6693 });
    expect(config.markers[1]?.type).toBe('restaurant');
    expect(config.markers[0]?.description).toBe('A port city.');
    // A note without coordinates is skipped; it is not an error diagnostic.
    expect(config.markers.some((marker) => marker.title === 'Unlocated')).toBe(false);
    expect(config.markers.some((marker) => marker.title === 'Broken')).toBe(false);
    expect(diagnosticKeys(config)).not.toContain('markerFolder');
  });

  it('excludes tooling and output directories from a marker folder', () => {
    const vaultRoot = vaultWithTrip();
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: LEAFLET_FIXTURES[0]!.block });

    remarkStoryMap({ vaultRoot })(tree);

    const titles = payload(tree.children[0] as Html).markers.map((marker) => marker.title);
    expect(titles.filter((title) => title?.startsWith('Excluded'))).toEqual([]);
  });

  it('orders markers by Vault-relative path regardless of directory order', () => {
    const vaultRoot = tempVault();
    for (const name of ['Zebra', 'Apple', 'Mango']) {
      note(vaultRoot, `Places/${name}`, { title: name, location: [1, 2] });
    }
    const tree = fenceTree({
      lang: LEAFLET_FENCE,
      value: ['lat: 0', 'long: 0', 'markerFolder: Places'].join('\n'),
    });

    remarkStoryMap({ vaultRoot })(tree);

    expect(payload(tree.children[0] as Html).markers.map((marker) => marker.title)).toEqual([
      'Apple',
      'Mango',
      'Zebra',
    ]);
  });

  it('renders an empty map rather than failing when no vaultRoot is configured', () => {
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: LEAFLET_FIXTURES[0]!.block });

    expect(() => remarkStoryMap()(tree)).not.toThrow();

    const config = payload(tree.children[0] as Html);
    expect(config.markers).toEqual([]);
    expect(config.map.center).toEqual([-33, -70]);
  });

  it('resolves every historical repeated markerFolder through the same scan', () => {
    const vaultRoot = tempVault();
    note(vaultRoot, 'Chile/Santiago', { title: 'Santiago', location: [-33.4489, -70.6693] });
    note(vaultRoot, 'Peru/Lima', { title: 'Lima', location: [-12.0464, -77.0428] });
    const tree = fenceTree({
      lang: LEAFLET_FENCE,
      value: ['id: two-folders', 'lat: 0', 'long: 0', 'markerFolder: Chile', 'markerFolder: Peru'].join('\n'),
    });

    remarkStoryMap({ vaultRoot })(tree);

    const config = payload(tree.children[0] as Html);
    expect(config.markers.map((marker) => marker.title)).toEqual(['Santiago', 'Lima']);
  });
});

describe('remarkStoryMap leaflet marker routes', () => {
  const block = ['id: routed', 'lat: 0', 'long: 0', 'markerFolder: Places'].join('\n');

  it('takes a published href from the host route resolver', () => {
    const vaultRoot = tempVault();
    note(vaultRoot, 'Places/Santiago', { title: 'Santiago', location: [-33.4489, -70.6693] });
    const seen: string[] = [];
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: block });

    remarkStoryMap({
      vaultRoot,
      resolveNoteHref: (relativePath) => {
        seen.push(relativePath);
        return `/docs/${relativePath.toLowerCase()}/`;
      },
    })(tree);

    const config = payload(tree.children[0] as Html);
    // The host owns the route; the package neither derives nor invents one.
    expect(seen).toEqual(['Places/Santiago']);
    expect(config.markers[0]?.notePath).toBe('/docs/places/santiago/');
  });

  it('leaves a marker unlinked when the host cannot resolve its route', () => {
    const vaultRoot = tempVault();
    note(vaultRoot, 'Places/Santiago', { title: 'Santiago', location: [-33.4489, -70.6693] });
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: block });

    remarkStoryMap({ vaultRoot, resolveNoteHref: () => undefined })(tree);

    const config = payload(tree.children[0] as Html);
    expect(config.markers[0]?.title).toBe('Santiago');
    expect(config.markers[0]?.notePath).toBeUndefined();
  });

  it('leaves every marker unlinked without a resolver at all', () => {
    const vaultRoot = tempVault();
    note(vaultRoot, 'Places/Santiago', { title: 'Santiago', location: [-33.4489, -70.6693] });
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: block });

    remarkStoryMap({ vaultRoot })(tree);

    expect(payload(tree.children[0] as Html).markers[0]?.notePath).toBeUndefined();
  });

  it('gives every marker in one host a distinct id', () => {
    const vaultRoot = tempVault();
    // Two notes resolving to the same published route: the ids must still not
    // collide inside one marker registry.
    note(vaultRoot, 'Places/Santiago', { title: 'Santiago', location: [-33.4489, -70.6693] });
    note(vaultRoot, 'Places/Santiago Draft', { title: 'Santiago', location: [-33.4489, -70.6693] });
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: block });

    remarkStoryMap({
      vaultRoot,
      resolveNoteHref: (relativePath) => (relativePath === 'Places/Santiago' ? '/docs/santiago/' : undefined),
    })(tree);

    const config = payload(tree.children[0] as Html);
    const ids = config.markers.map((marker) => marker.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('remarkStoryMap leaflet diagnostics', () => {
  it('serializes a recognized-but-unsupported key as a diagnostic naming it', () => {
    const tree = fenceTree({
      lang: LEAFLET_FENCE,
      value: ['id: deferred', 'lat: 0', 'long: 0', 'noUI: true', 'gpx: track.gpx'].join('\n'),
    });

    remarkStoryMap()(tree);

    const config = payload(tree.children[0] as Html);
    expect(diagnosticKeys(config)).toEqual(expect.arrayContaining(['noUI', 'gpx']));
    const codes = (config.diagnostics ?? []).map((diagnostic) => diagnostic.code);
    expect(codes).toContain(LEAFLET_DIAGNOSTIC_CODES.pendingP1);
    expect(codes).toContain(LEAFLET_DIAGNOSTIC_CODES.pendingP2);
    expect(config.diagnostics?.every((diagnostic) => diagnostic.level === 'warning')).toBe(true);
  });

  it('reports an unknown key rather than dropping it silently', () => {
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: ['lat: 0', 'long: 0', 'nonsense: 1'].join('\n') });

    remarkStoryMap()(tree);

    const config = payload(tree.children[0] as Html);
    expect(diagnosticKeys(config)).toContain('nonsense');
    expect((config.diagnostics ?? []).map((d) => d.code)).toContain(LEAFLET_DIAGNOSTIC_CODES.unknownKey);
  });

  it('omits the diagnostics field entirely for a block with nothing to report', () => {
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: ['lat: 1', 'long: 2'].join('\n') });

    remarkStoryMap()(tree);

    expect(payload(tree.children[0] as Html).diagnostics).toBeUndefined();
  });

  it('fails the build for a block the dialect cannot read at all', () => {
    // A malformed `leaflet` block is an authoring error, not a silently empty map,
    // and it is the only case where the transform throws.
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: 'lat: [1, 2' });

    expect(() => remarkStoryMap()(tree)).toThrow();
  });
});

describe('remarkStoryMap leaflet host options', () => {
  it('applies site-level leaflet compatibility defaults, not StoryMap settings', () => {
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: ['lat: 1', 'long: 2'].join('\n') });

    remarkStoryMap({
      leafletDefaults: {
        height: '700px',
        zoom: 9,
        minZoom: 3,
        tileUrl: 'https://tiles.test/{z}/{x}/{y}.png',
        attribution: 'Test',
        theme: 'atlas',
      },
    })(tree);

    const config = payload(tree.children[0] as Html);
    expect(config.height).toBe('700px');
    expect(config.map.zoom).toBe(9);
    expect(config.map.minZoom).toBe(3);
    expect(config.map.tiles.light).toEqual({
      url: 'https://tiles.test/{z}/{x}/{y}.png',
      attribution: 'Test',
    });
    expect(config.map.theme).toBe('atlas');
  });

  it('lets an authored key win over a compatibility default', () => {
    const tree = fenceTree({
      lang: LEAFLET_FENCE,
      value: ['lat: 1', 'long: 2', 'defaultZoom: 3', 'height: 250px'].join('\n'),
    });

    remarkStoryMap({ leafletDefaults: { zoom: 9, height: '700px' } })(tree);

    const config = payload(tree.children[0] as Html);
    expect(config.map.zoom).toBe(3);
    expect(config.height).toBe('250px');
  });

  it('carries the host marker registry and tooltip default into markers', () => {
    const vaultRoot = tempVault();
    note(vaultRoot, 'Places/Tagged', { title: 'Tagged', location: [1, 2], tags: ['food'] });
    note(vaultRoot, 'Places/Named', { title: 'Named', location: [3, 4], mapmarker: 'shop' });
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: ['lat: 0', 'long: 0', 'markerFolder: Places'].join('\n') });

    remarkStoryMap({
      vaultRoot,
      leafletPresentation: {
        markerTypes: [
          { id: 'eatery', tags: ['food'], color: '#ff0000' },
          { id: 'shop', color: '#00ff00' },
        ],
        defaultTooltip: 'always',
      },
    })(tree);

    const config = payload(tree.children[0] as Html);
    const byTitle = new Map(config.markers.map((marker) => [marker.title, marker]));
    expect(byTitle.get('Tagged')?.type).toBe('eatery');
    expect(byTitle.get('Named')?.type).toBe('shop');
    expect(config.markers.every((marker) => marker.tooltip === 'always')).toBe(true);
  });
});

describe('remarkStoryMap host element shape', () => {
  it('marks a story host with the story discriminator and no document flag', () => {
    const tree = fenceTree({ lang: STORY_MAP_FENCE, value: 'title: Demo\nslides:\n  - title: One\n' });

    remarkStoryMap()(tree, { path: '/vault/Doc.md', data: { frontMatter: {} } });

    const element = host(tree.children[0] as Html);
    expect(element.kind).toBe('story');
    expect(element.isDocument).toBe(false);
    expect(element.instance).toBe('sm-1');
    expect(element.value).toContain('class="story-map-host"');
  });

  it('keeps data-story-map-document for a story-map: true document', () => {
    const tree = fenceTree({ lang: STORY_MAP_FENCE, value: 'title: Demo\nslides:\n  - title: One\n' });

    remarkStoryMap()(tree, { path: '/vault/Story.md', data: { frontMatter: { 'story-map': true } } });

    const element = host(tree.children[0] as Html);
    expect(element.kind).toBe('story');
    expect(element.isDocument).toBe(true);
  });

  it('never marks a map host as a story document', () => {
    const tree = fenceTree({ lang: LEAFLET_FENCE, value: LEAFLET_FIXTURES[0]!.block });

    // Even inside a `story-map: true` document the `leaflet` block stays a map.
    remarkStoryMap()(tree, { path: '/vault/Story.md', data: { frontMatter: { 'story-map': true } } });

    expect(host(tree.children[0] as Html).isDocument).toBe(false);
  });

  it('numbers hosts independently of the authored id', () => {
    const tree = fenceTree(
      { lang: LEAFLET_FENCE, value: LEAFLET_FIXTURES[0]!.block },
      { lang: STORY_MAP_FENCE, value: 'title: Demo\nslides:\n  - title: One\n' },
      { lang: LEAFLET_FENCE, value: LEAFLET_FIXTURES[3]!.block },
    );

    remarkStoryMap()(tree);

    const elements = (tree.children as Html[]).map(host);
    expect(elements.map((element) => element.kind)).toEqual(['map', 'story', 'map']);
    expect(elements.map((element) => element.instance)).toEqual(['sm-1', 'sm-2', 'sm-3']);
  });

  it('leaves unrelated fenced blocks untouched', () => {
    const tree: Root = {
      type: 'root',
      children: [
        { type: 'code', lang: 'yaml', value: 'title: Demo' },
        { type: 'code', lang: 'storymap', value: 'title: Demo' },
      ],
    };

    remarkStoryMap()(tree);

    expect(tree.children).toEqual([
      { type: 'code', lang: 'yaml', value: 'title: Demo' },
      { type: 'code', lang: 'storymap', value: 'title: Demo' },
    ] satisfies Code[]);
  });
});

describe('VaultIndex.resolveLeafletSource', () => {
  it('builds a GeoMapConfig without touching the story slide model', () => {
    const vaultRoot = tempVault();
    note(vaultRoot, 'Places/Santiago', { title: 'Santiago', location: [-33.4489, -70.6693] });
    const vault = new VaultIndex({ vaultRoot });
    const source = parseLeafletSourceYaml(LEAFLET_FIXTURES[0]!.block);

    const config = vault.resolveLeafletSource(source);

    expect(config.schema).toBe('geomap/v1');
    expect(config.height).toBe('600px');
    expect(config.map.center).toEqual([-33, -70]);
    expect(config.markers).toHaveLength(0); // its folder is not in this vault
    expect('slides' in config).toBe(false);
  });

  it('is a pure function of the parsed source and the vault', () => {
    const vaultRoot = tempVault();
    note(vaultRoot, 'Places/Santiago', { title: 'Santiago', location: [-33.4489, -70.6693] });
    const vault = new VaultIndex({ vaultRoot });
    const source = parseLeafletSourceYaml(['lat: 0', 'long: 0', 'markerFolder: Places'].join('\n'));

    const first = vault.resolveLeafletSource(source);
    const second = vault.resolveLeafletSource(source);

    expect(first).toEqual(second);
  });
});
