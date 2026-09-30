# @story-map/story-map-core

Framework-independent StoryMap types, YAML parsing, validation, defaults, and pure
note-metadata helpers. No rendering, no file reads, no DOM.

```sh
npm install @story-map/story-map-core
```

ESM and TypeScript declarations only; use `import` from an ESM application.

## Parse a story

```js
import { parseStoryMapYaml } from '@story-map/story-map-core';

const config = parseStoryMapYaml(`
title: Taipei walk
map:
  center: [25.033, 121.5654]
  zoom: 13
  theme: atlas
slides:
  - title: Taipei 101
    text: Start here.
    location: [25.033, 121.5654]
`);
```

`parseStoryMapYaml` / `parseStoryMapObject` return a renderable `StoryMapConfig` and
require at least one slide; invalid input throws, so catch at your input boundary.

`parseStoryMapSourceYaml` / `parseStoryMapSourceObject` return a
`StoryMapSourceConfig`, which may carry `noteFolder` and omit `slides`. A host resolves
notes, routes and media, then calls `toStoryMapConfig(source, resolvedSlides)`. That
call copies fields; it does not re-validate the slides you supply.

Defaults resolve in the order: source value, supplied `StoryMapSourceDefaults`, built-in
default. `layout` is always document-owned and cannot be defaulted.

## Parse a legacy `leaflet` block

`leaflet` is a second, independent input dialect with its own parser. It never enters
the `storymap/v1` schema, keeps its historical key spelling, and a repeated
`markerFolder` survives as a list.

```js
import { parseLeafletSourceYaml, toGeoMapConfig } from '@story-map/story-map-core';

const source = parseLeafletSourceYaml(`
id: chile-2509
lat: -33.0000
long: -70.0000
defaultZoom: 5
markerFolder: Travel/Chile
markerFolder: Travel/Coast
`);

console.log(source.markerFolder); // ['Travel/Chile', 'Travel/Coast']
console.log(source.map.center);    // [-33, -70]

// The host resolves folders into markers; core never lists files.
const config = toGeoMapConfig(source, [
  { location: { lat: -33.4489, lng: -70.6693 }, title: 'Santiago' },
]);
```

Values resolve as authored key → `LeafletSourceDefaults` → built-in compatibility
default. A StoryMap default is never assumed to exist for a `leaflet` block, and a
Leaflet-compatibility default is never applied to a `storymap/v1` block. Malformed input
throws `LeafletParseError`, which extends `StoryMapParseError`, so one `catch` covers
both dialects.

**A recognized key that is not implemented yet is reported, never dropped.**
`LEAFLET_DIAGNOSTIC_CODES` lists the stable codes; an unrecognized key gets its own so a
typo is never confused with a scheduled feature. Per-key support is recorded in
[`docs/leaflet-compatibility.md`](../../docs/leaflet-compatibility.md).

## Exports

- Types: `StoryMapConfig`, `StoryMapSourceConfig`, `StoryMapSourceDefaults`, `StorySlide`,
  `StoryLocation`, `StoryMedia`, `StoryMapTheme`, `StoryMapLayoutOptions`, and the
  `geomap/v1` model — `GeoMapConfig`, `GeoMapOptions`, `GeoMapDiagnostic`, `GeoMarker`,
  `MarkerTypeDefinition`, `TileSource`, `TileSources`.
- Zod schemas for both dialects.
- Source utilities: `extractFencedBlock(markdown, 'story-map')`, `applySourceDefaults`,
  `normalizeStoryMapInput`.
- Note helpers: `slideFromNoteFrontmatter`, `markerFromNoteFrontmatter`, `coerceMapZoom`,
  `resolveMarkerType`, `extractNoteFrontmatter`.
- Tile helpers: `DEFAULT_TILE_URL`, `DEFAULT_TILE_ATTRIBUTION`, `toTileSources`,
  `tileSourcesFromStoryMap`.

## Documentation

- [Source syntax](../../docs/guides/syntax.md) — every key in both dialects, and the note
  frontmatter both read.
- [Release notes](../../docs/releases/0.5.0.md)

Rendering lives in [`@story-map/react-story-map`](../react-story-map/README.md);
Markdown integration in [`@story-map/remark-story-map`](../remark-story-map/README.md).

MIT.
