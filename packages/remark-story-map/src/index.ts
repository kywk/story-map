import type { Code, Html, Root } from 'mdast';
import { visit } from 'unist-util-visit';
import {
  parseLeafletSourceYaml,
  parseStoryMapSourceYaml,
  toGeoMapConfig,
  toStoryMapConfig,
  type GeoMapConfig,
  type LeafletSourceDefaults,
  type StoryMapConfig,
} from '@story-map/story-map-core';
import { VaultIndex, type LeafletHostPresentation } from './vault.js';

/** The storytelling dialect. Parsed by the `storymap/v1` schema. */
export const STORY_MAP_FENCE = 'story-map';
/** The legacy map dialect. Parsed by its own parser, never by `storymap/v1`. */
export const LEAFLET_FENCE = 'leaflet';

/**
 * What a host element mounts. One client lifecycle reads this and picks
 * `<StoryMap />` or `<GeoMap />`, so a page never boots two map runtimes.
 */
export const HOST_KINDS = {
  story: 'story',
  map: 'map',
} as const;

export type HostKind = (typeof HOST_KINDS)[keyof typeof HOST_KINDS];

export interface RemarkStoryMapOptions {
  vaultRoot?: string;
  assetBase?: string;
  resolveNoteHref?: (vaultRelativePath: string) => string | undefined;
  /**
   * Site-level `leaflet` compatibility defaults, applied only to `leaflet`
   * blocks and resolved before the built-in compatibility defaults. They are
   * deliberately not StoryMap settings: a `storymap/v1` block never reads them,
   * and a `leaflet` block never assumes a StoryMap setting exists.
   */
  leafletDefaults?: LeafletSourceDefaults;
  /**
   * `leaflet`-host presentation that the dialect has no source key for: the
   * marker type registry, the default marker type, and the tooltip default.
   * Ignored for `story-map` blocks.
   */
  leafletPresentation?: LeafletHostPresentation;
}

export default function remarkStoryMap(options: RemarkStoryMapOptions = {}) {
  const vault = options.vaultRoot
    ? new VaultIndex({
        vaultRoot: options.vaultRoot,
        ...(options.assetBase ? { assetBase: options.assetBase } : {}),
        ...(options.resolveNoteHref ? { resolveNoteHref: options.resolveNoteHref } : {}),
      })
    : undefined;

  return (tree: Root, file?: RemarkVFile) => {
    const sourcePath = typeof file?.path === 'string' ? file.path : undefined;
    const isDocument = file?.data?.frontMatter?.['story-map'] === true;
    const documentAttribute = isDocument ? ' data-story-map-document="true"' : '';

    // Host instance identity is per transformed file and never derived from an
    // authored map id: two blocks may legitimately share one id (the Xinjiang
    // fixture reuses `chile-2509`), and nothing about them may be renamed,
    // deduplicated, or rejected because of it.
    let instance = 0;
    const nextInstance = () => `sm-${(instance += 1)}`;

    visit(tree, 'code', (node: Code, index, parent) => {
      if (index === undefined || !parent) return;
      if (node.lang === STORY_MAP_FENCE) {
        const story = resolveStoryHost(node.value, vault, sourcePath);
        parent.children[index] = hostElement(HOST_KINDS.story, story, nextInstance(), documentAttribute);
        return;
      }
      if (node.lang === LEAFLET_FENCE) {
        const map = resolveMapHost(node.value, vault, options);
        parent.children[index] = hostElement(HOST_KINDS.map, map, nextInstance(), '');
      }
    });
  };
}

function resolveStoryHost(
  source: string,
  vault: VaultIndex | undefined,
  sourcePath: string | undefined,
): StoryMapConfig {
  const parsed = parseStoryMapSourceYaml(source);
  return vault ? vault.resolveSource(parsed, sourcePath) : toStoryMapConfig(parsed, parsed.slides ?? []);
}

/**
 * The `leaflet` half of the transform. `markerFolder` resolution needs the Vault,
 * so a block parsed without one still renders - as a map with no markers - rather
 * than failing the whole page build.
 */
function resolveMapHost(
  source: string,
  vault: VaultIndex | undefined,
  options: RemarkStoryMapOptions,
): GeoMapConfig {
  const parsed = parseLeafletSourceYaml(source, options.leafletDefaults);
  if (!vault) return toGeoMapConfig(parsed, []);
  return vault.resolveLeafletSource(parsed, options.leafletPresentation ?? {});
}

function hostElement(
  kind: HostKind,
  config: StoryMapConfig | GeoMapConfig,
  instance: string,
  documentAttribute: string,
): Html {
  const encoded = encodeURIComponent(JSON.stringify(config));
  return {
    type: 'html',
    value:
      `<div class="story-map-host" data-story-map-kind="${kind}"` +
      `${documentAttribute} data-story-map-instance="${instance}"` +
      ` data-story-map-config="${escapeAttribute(encoded)}"></div>`,
  };
}

interface RemarkVFile {
  path?: string;
  data?: {
    frontMatter?: Record<string, unknown>;
  };
}

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
}

export { VaultIndex } from './vault.js';
export type { LeafletHostPresentation, VaultResolveOptions } from './vault.js';
