# Conversation Summary — Leaflet Compatibility

## Context

The user maintains `kywk/story-map` and a Docusaurus/Obsidian knowledge base in
`kywk/kywk.github.io`.

The historical Obsidian Leaflet plugin is in maintenance mode and external tile-provider behavior has changed. In particular, CARTO now requires API keys for its Basemaps service, producing the visible "API key required" watermark when old keyless URLs are used.

The user's goal is to reduce the number of plugins required in both Obsidian and Docusaurus.

## Existing state

`kywk/story-map` already provides:

- `story-map-core` parsing and normalization;
- `react-story-map` Leaflet rendering;
- `obsidian-story-map` full-leaf StoryMap view;
- `remark-story-map` build-time Docusaurus adapter and browser client;
- shared note metadata including `location`, `mapmarker`, and collection of `mapzoom`;
- `VaultIndex` / platform route resolution;
- StoryMap themes and layout modes.

However, it does not yet provide a normal, non-story GeoMap render model or a `leaflet` fenced-block processor.

`kywk.github.io/plugins/remark-obsidian-leaflet` is a small custom compatibility plugin, not a full Obsidian Leaflet implementation. It currently supports a narrow subset:

- `id`
- `height`
- `lat` / `long`
- `minZoom` / `maxZoom`
- `defaultZoom`
- `markerFolder`

and uses `location`, `title`, and `mapmarker` frontmatter.

It has a second browser Leaflet runtime in `static/js/leaflet-init.js`, duplicating StoryMap's runtime/lifecycle responsibilities.

## Approved architectural decision

StoryMap becomes the single map runtime.

Native StoryMap content and legacy Leaflet content remain distinct input dialects:

```text
story-map fence -> StoryMapConfig -> StoryMap
leaflet fence   -> GeoMapConfig   -> GeoMap
```

Both use the same React/Leaflet map foundation.

Do not fake Leaflet content as Story slides.

## Package decision

Keep the current four packages. Extend them rather than adding a new package.

## Settings decision

Absorb useful Leaflet plugin settings as portable StoryMap/GeoMap capabilities:

- configurable tile sources;
- separate light/dark tile sources;
- subdomains and attribution;
- marker type registry;
- tag-to-marker fallback;
- marker min/max zoom;
- marker tooltip behavior;
- note preview through host callback;
- Shift-click coordinate copy;
- Leaflet-only default center;
- unit-system preference;
- settings import/migration.

Do not copy legacy implementation details:

- mutable marker CSV persistence;
- arbitrary plugin config-directory storage;
- Font Awesome layer-composition internals;
- Initiative Tracker integration;
- legacy Map View persistence state.

## Implementation priority

Phase 1 first covers the user's actual production Leaflet blocks in `kywk.github.io`. They occur in Chile, Egypt, Kuala Lumpur, and Xinjiang travel index pages.

Long-tail Leaflet compatibility (GeoJSON, GPX, image maps, drawing, mutable state) follows in later phases and must not block retiring the current custom Docusaurus Leaflet plugin for existing content.
