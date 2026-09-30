# Docusaurus

`@story-map/remark-story-map` turns a fenced block into a host element at build time and
mounts the shared renderer in the browser. One plugin handles both dialects, and one
client entry mounts either renderer — so a page holding a story and a legacy map loads
Leaflet exactly once.

[繁體中文](docusaurus.zh-TW.md) · [Source syntax](syntax.md)

## Install

```bash
npm install @story-map/remark-story-map react react-dom
```

React and React DOM are peer dependencies; both must be React 19. A Docusaurus 2/3 site
on React 18 does not satisfy them.

## Register the plugin

Build-time entry and browser entry are separate. The build entry may use Node `fs`; the
browser entry must not.

```ts
// docusaurus.config.ts
import remarkStoryMap from '@story-map/remark-story-map';
import { createContentLinkIndex } from './scripts/content-links.js';

const contentLinkIndex = createContentLinkIndex({ root: __dirname, docsConfig, blogConfig });

const storyMapOptions = {
  vaultRoot: __dirname,
  resolveNoteHref: (vaultRelativePath: string) => {
    const matches = contentLinkIndex.resolve(vaultRelativePath);
    return matches.length === 1 ? matches[0].route : undefined;
  },
  leafletDefaults: { theme: 'auto' },
};

export default {
  presets: [['classic', { docs: { remarkPlugins: [[remarkStoryMap, storyMapOptions]] } }]],
  plugins: ['./plugins/story-map-client'],
};
```

> **If your bundler breaks the package's named `zod` exports**, load it through Node's
> native `require(esm)` instead of the usual import, so the package graph stays on the
> native loader:
>
> ```js
> // plugins/remark-story-map-loader.cjs
> const { createRequire } = require('node:module');
> const nativeRequire = createRequire(__filename);
> const mod = nativeRequire('@story-map/remark-story-map');
> module.exports = mod.default ?? mod;
> ```

The client plugin is a few lines:

```js
// plugins/story-map-client/index.js
module.exports = function storyMapClientPlugin() {
  return {
    name: 'story-map-client',
    getClientModules() {
      return [require.resolve('@story-map/remark-story-map/client')];
    },
  };
};
```

No Leaflet is created during `docusaurus build`. It is imported inside the browser
client's effects only.

## Options

| Option | Purpose |
| --- | --- |
| `vaultRoot` | Repo/vault root to index. Required for `noteFolder` discovery, explicit `note:` WikiLinks, and `leaflet` `markerFolder`. Omit it and blocks are parsed but nothing is resolved. |
| `assetBase` | URL prefix that rewrites resolved Vault-relative media paths, e.g. `/vault-assets`. It only rewrites URLs; copying files stays yours. |
| `resolveNoteHref` | Maps a Vault-relative note path (no `.md`, forward slashes) to a published href. |
| `leafletDefaults` | `leaflet`-only compatibility defaults. Never applied to a `story-map` block. |
| `leafletPresentation` | `leaflet`-only marker type registry, default type, and tooltip mode. |

### Routes are yours

The package never implements Docusaurus slug or permalink policy. `resolveNoteHref` is
the only seam, and it is consulted for `noteDisplay: link` and for `leaflet` marker
links. Returning `undefined` — including for an ambiguous multi-match — leaves the link
unlinked rather than guessing a route.

If you are migrating off a plugin that built marker URLs from a `routeBase` and
lower-cased filenames, do not port that algorithm. Point `resolveNoteHref` at whatever
index already owns your routes.

## What the transform emits

```html
<!-- story-map fence -->
<div class="story-map-host" data-story-map-kind="story" data-story-map-document="true"
     data-story-map-instance="sm-1" data-story-map-config="<url-encoded JSON>"></div>

<!-- leaflet fence -->
<div class="story-map-host" data-story-map-kind="map"
     data-story-map-instance="sm-2" data-story-map-config="<url-encoded JSON>"></div>
```

`data-story-map-kind` is the explicit discriminator the client reads to pick `<StoryMap />`
or `<GeoMap />`. A host without it is treated as a story, so pages published before the
discriminator existed keep working.

`data-story-map-instance` is a per-file counter and is deliberately **not** derived from
the authored `id`. Existing content reuses ids across maps, and two blocks on one page
must not collide; the authored `id` is preserved verbatim in the payload either way.

## Notes and media

With `vaultRoot` set, notes are indexed recursively, skipping dot-directories,
`node_modules`, `build`, `dist` and `coverage`.

- Explicit `slides` keep their author order exactly.
- `noteFolder` requires `story-map-note: true` and is ordered by `order` +
  `dateField` only. `includeTags` / `excludeTags` filter on frontmatter tags.
- Relative media resolves against the **note** for note-derived media, and against the
  **source document** for media authored directly on a slide.

## Theme bridge

The built-in themes style the map and the StoryMap chrome together. Load
`examples/docusaurus/story-map-theme.css` if you want the optional Infima color bridge.

If you set `map.theme: auto`, bridge it yourself: the renderer's own `auto` preset
follows `prefers-color-scheme`, which is the **operating system**, not Docusaurus's
localStorage-backed toggle. Declare **both** directions. A dark-only bridge is outranked
by the renderer's own dark media query, so a dark-OS reader who switches your site to
light still gets a dark map.

## Full-page view

A full-viewport map with a Markdown toggle is deliberately **not** a package option — it
manipulates theme DOM, collapses the docs sidebar and watches the route lifecycle, so it
belongs to the site. See [`docs/docusaurus-full-page.md`](../docusaurus-full-page.md).

## Migrating off a separate Leaflet plugin

Once your ` ```leaflet ` blocks render through this package, you can delete a
site-local `leaflet` remark plugin and its own CDN bootstrap script. Leaflet then comes
from this bundle alone, and only on pages that actually have a story or map host. A
working removal is recorded in
[the migration verification](../acceptance/2026-09-30-docusaurus-leaflet-migration.md).
