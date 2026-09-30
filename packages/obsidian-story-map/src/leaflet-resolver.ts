import type { App } from 'obsidian';
import {
  isPathInFolder,
  markerFromNoteFrontmatter,
  toGeoMapConfig,
  type GeoMapConfig,
  type GeoMarker,
  type LeafletSourceConfig,
  type MarkerTypeDefinition,
  type MarkerTooltipDisplay,
} from '@story-map/story-map-core';

export interface LeafletMarkerOptions {
  /** Registry used to resolve a note's `mapmarker` into a configured type. */
  types?: readonly MarkerTypeDefinition[] | undefined;
  /** Configured default type, used before the built-in generic default. */
  defaultTypeId?: string | undefined;
  /** Tooltip mode applied to every marker the block did not override. */
  tooltip?: MarkerTooltipDisplay | undefined;
}

/**
 * Resolve one `leaflet` fenced block into the renderer's storyless map model.
 *
 * The dialect is a second, independent input language, so it never enters the
 * `storymap/v1` schema: the block body is parsed by the `leaflet` parser and this
 * function only supplies the Vault lookup core cannot perform.
 *
 * `markerFolder` is a Vault-relative folder resolved recursively through the same
 * `isPathInFolder` helper the StoryMap resolver uses, so one folder rule covers
 * both dialects. A note without a valid `location` is skipped rather than
 * fatal - a travel folder routinely holds an index note with no coordinates - and
 * an unknown `mapmarker` still produces a marker, because the renderer falls back
 * to the default visual while the authored name is preserved for diagnostics.
 */
export function resolveObsidianGeoMap(
  app: App,
  source: LeafletSourceConfig,
  options: LeafletMarkerOptions = {},
): GeoMapConfig {
  const markers = resolveMarkerFolder(app, source.markerFolder, options);
  return toGeoMapConfig(source, markers);
}

/**
 * Every Markdown note in the configured folders, in a stable Vault-path order, so
 * two hosts rendering the same block always produce the same marker list.
 */
export function resolveMarkerFolder(
  app: App,
  folders: readonly string[],
  options: LeafletMarkerOptions = {},
): GeoMarker[] {
  if (folders.length === 0) return [];

  const files = app.vault
    .getMarkdownFiles()
    .filter((file) => folders.some((folder) => isPathInFolder(file.path, folder)))
    .sort((a, b) => a.path.localeCompare(b.path));

  const markers: GeoMarker[] = [];
  for (const file of files) {
    const frontmatter = readFrontmatter(app, file);
    const marker = markerFromNoteFrontmatter(frontmatter, {
      fallbackTitle: file.basename,
      notePath: file.path,
      id: file.path,
      types: options.types,
      defaultTypeId: options.defaultTypeId,
      tooltip: options.tooltip,
    });
    if (marker) markers.push(marker);
  }
  return markers;
}

function readFrontmatter(app: App, file: { path: string }): Record<string, unknown> {
  const frontmatter = app.metadataCache.getFileCache(file as never)?.frontmatter;
  return frontmatter ?? {};
}
