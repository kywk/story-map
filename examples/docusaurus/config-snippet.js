// Site-owned glue. Merge these pieces into your existing docusaurus.config.js/mjs.
// Nothing here is exported by @story-map/remark-story-map; the host site owns
// route resolution, asset publishing, and the client plugin registration.
//
// One remark plugin now handles BOTH `story-map` and legacy `leaflet` fences, and
// the single StoryMap client module mounts either renderer. A site that also
// carries a separate `remark-obsidian-leaflet` plugin plus its own CDN Leaflet
// bootstrap script can therefore remove both once its existing `leaflet` blocks
// render: drop the `remarkLeaflet` entry from `remarkPlugins`, and drop the
// `<script>` for its init file. Leaflet is then loaded from this bundle only, and
// only when a story or map host is on the page. Do this after the map pages have
// been smoke-tested; see docs/leaflet-compatibility.md for which keys are honored.
import remarkStoryMap from '@story-map/remark-story-map';

// The published-route authority for kywk.github.io already lives in
// scripts/content-links.js (`createContentLinkIndex({ root, docsConfig, blogConfig })`).
// Reuse it rather than reimplementing Docusaurus slug rules. Adjust the import
// path to wherever that script lives in the target site.
//
//   import { createContentLinkIndex } from './scripts/content-links.js';
//   const contentLinkIndex = createContentLinkIndex({ root: '/path/to/vault', docsConfig, blogConfig });

/**
 * Example route resolver callback.
 *
 * `vaultRelativePath` is the note's Vault-relative path WITHOUT the `.md`
 * extension, e.g. `Trips/Santiago`. Return the final published href, or
 * `undefined` when there is no single unambiguous route.
 *
 * @param {(name: string) => Array<{ route: string }>} resolve
 *   The site's existing published-content index resolver.
 */
export function createResolveNoteHref(resolve) {
  return function resolveNoteHref(vaultRelativePath) {
    const matches = resolve(vaultRelativePath);
    return matches.length === 1 ? matches[0].route : undefined;
  };
}

// Shared StoryMap options for docs and blog. No dependencies beyond the plugin.
export function createStoryMapOptions({ vaultRoot, resolveNoteHref }) {
  return {
    vaultRoot,
    // `assetBase` only rewrites resolved Vault-relative media URLs.
    // Copying Vault attachments into static/ remains site-owned.
    assetBase: '/vault-assets',
    resolveNoteHref,
  };
}

// Example wiring once `contentLinkIndex` exists:
//
//   const storyMapOptions = createStoryMapOptions({
//     vaultRoot: '/path/to/vault',
//     resolveNoteHref: createResolveNoteHref(contentLinkIndex.resolve),
//   });

export const storyMapDocsOptions = {
  remarkPlugins: [[remarkStoryMap, createStoryMapOptions({ vaultRoot: '/path/to/vault' })]],
};

export const storyMapBlogOptions = {
  remarkPlugins: [[remarkStoryMap, createStoryMapOptions({ vaultRoot: '/path/to/vault' })]],
};

export const storyMapPlugins = [
  './plugins/story-map-client',
];
