# `kywk.github.io` Migration Plan

Secondary repository: `kywk/kywk.github.io`

Do not apply destructive cleanup until the new StoryMap package supports the Phase 1 fixtures.

## Current duplicated map stack

Legacy path:

```text
remark-obsidian-leaflet
 -> data-leaflet-config
 -> static/js/leaflet-init.js
 -> CDN Leaflet
```

StoryMap path:

```text
@story-map/remark-story-map
 -> data-story-map-config
 -> story-map-client
 -> @story-map/react-story-map
 -> Leaflet module
```

Target: only the second runtime, expanded to map hosts.

## Docusaurus config

Remove:

```ts
const remarkLeaflet = loadPlugin(
  "remark-obsidian-leaflet",
  "./plugins/remark-obsidian-leaflet/src/index.js"
);
```

and its addition to `remarkPlugins`.

Keep `remarkStoryMap` and give it the existing `vaultRoot` and `resolveNoteHref` integration.

Do not duplicate slug/permalink logic in StoryMap.

## Runtime

Remove after verification:

- `static/js/leaflet-init.js`
- its script entry from `docusaurus.config.ts`

Leaflet assets should come through the StoryMap client bundle only when a map/story host is present.

## Local plugin directory

Remove after verification:

`plugins/remark-obsidian-leaflet/`

## CSS

Audit `src/css/custom.css`.

Remove only selectors that existed solely for the old runtime and are covered by StoryMap/GeoMap styling.

Do not remove general `.leaflet-*` rules until confirming the new renderer does not rely on them or supplies replacements.

## Route behavior

Legacy plugin manually built marker URLs from `routeBase` and lower-cased filenames.

Do not preserve that algorithm.

New Leaflet compatibility must use the already-integrated `contentLinkIndex.resolve()` / `resolveNoteHref` authority.

## Smoke-test pages

1. `backpacker/2509 Chile/Index de Chile.md`
2. `backpacker/2401 Egypt/Index Pharaoh Egypt.md`
   - Egypt map
   - Kuala Lumpur map
3. `backpacker/2601 Xinjiang/Index Xinjiang.md`

Validate:

- map appears;
- center/zoom;
- all marker-folder notes with valid `location`;
- marker type fallback;
- links route correctly;
- SPA navigation away/back;
- mobile sizing;
- Docusaurus light/dark mode;
- no duplicate Leaflet initialization;
- no `leaflet-init.js` console errors.

## Dependency cleanup

After build/test success, remove legacy plugin package/dependency references if no other code uses them.
