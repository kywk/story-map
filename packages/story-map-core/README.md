# @story-map/story-map-core

Framework-independent StoryMap v1 types, YAML parsing, validation, defaults, and pure
note-metadata helpers. This package does not render maps, read files, or discover notes.

```sh
npm install @story-map/story-map-core
```

The package exports ES modules and TypeScript declarations. Use `import` from an ESM
application; no CommonJS build is provided.

## Parse a renderable StoryMap

Save this as `example.mjs` and run `node example.mjs` after installing the package:

```js
import { parseStoryMapYaml } from '@story-map/story-map-core';

const config = parseStoryMapYaml(`
title: Taipei walk
map:
  center: [25.033, 121.5654]
  zoom: 13
  theme: atlas
layout:
  mode: full
  full:
    side: right
    contentRatio: 0.45
slides:
  - title: Taipei 101
    text: Start here.
    location: [25.033, 121.5654]
`);

console.log(config.schema); // storymap/v1
console.log(config.slides[0].location); // { lat: 25.033, lng: 121.5654 }
```

`parseStoryMapYaml(yaml)` and `parseStoryMapObject(value)` return `StoryMapConfig` and
require at least one slide. Invalid input throws; catch errors at your host's input
boundary. YAML, schema-validation, and coordinate-normalization errors can have different
error types.

## Parse source documents

`parseStoryMapSourceYaml(yaml, defaults?)` and
`parseStoryMapSourceObject(value, defaults?)` return `StoryMapSourceConfig`, which can
contain `noteFolder` and omit `slides`. Hosts resolve notes, routes, media, and folder
contents, then call `toStoryMapConfig(source, resolvedSlides)` to prepare renderer input.
That conversion copies fields; it does not validate or resolve the supplied slides.

Defaults have the following precedence: source value, supplied `StoryMapSourceDefaults`,
then built-in default. Supplied defaults support `order`, `dateField`, `noteDisplay`, `initialSlide`,
`panelOpacity`, and map options other than `center`. `layout` is always document-owned; supplied
defaults cannot override it.

| Field | Built-in default |
| --- | --- |
| `schema` | `storymap/v1` |
| `height` | `520px` |
| `order` | `asc` |
| `dateField` | `date-created` |
| `noteDisplay` | `link` |
| `initialSlide` | `first` |
| `panelOpacity` | `0.85` |
| `map.zoom` | `6` |
| `map.theme` | `light` |
| `map.tileUrl` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` |
| `map.attribution` | `© OpenStreetMap contributors` |
| `map.showPath` | `true` |
| `layout.mode` | `card` |
| `layout.card.align` | `left` |
| `layout.full.side` | `left` |
| `layout.full.contentRatio` | `0.5` |

`map.center`, `map.minZoom`, and `map.maxZoom` are optional. `panelOpacity` accepts a number between `0.0` and `1.0` (built-in default `0.85`); a legacy root-level `opacity` or `map.opacity` is accepted and normalized into it. All source keys use camelCase.
Themes are `auto`, `light`, `dark`, `vintage`, `cyber`, and `atlas` (built-in default
`light`). Layout modes are `card` (built-in default), `full`, and `timeline`; `timeline`
reuses the `full` side and content ratio rather than adding a mode of its own. Card layouts also accept
`widthRatio` (`0.20..0.80`) and `heightRatio` (`0.20..0.95`); both are optional. Full
layouts accept `contentRatio` (`0.30..0.70`). The canonical config contains both `card`
and `full` groups, including defaults for the inactive mode.

## Slide dates

A slide may carry a `date`, normalized to epoch milliseconds. The parser accepts a YAML
timestamp (`2024-04-12`), an epoch number, a `Date`, or a string such as `'Apr 12, 2024'`
and rejects a present but unparseable value with a `StoryMapParseError`. A slide without
a `date` omits the key. Hosts fill `date` from the configured `dateField` for
folder-discovered notes; an authored `date` wins over a note-derived one. A host that
applies `locationOnlySlide` for `noteDisplay: full` drops `date` with the other frontmatter
display fields, so the timeline carve-out (see `locationOnlySlide` below) matters.

## Other exports

- Types: `StoryMapConfig`, `StoryMapSourceConfig`, `StoryMapSourceDefaults`, `StorySlide`,
  `StoryLocation`, `StoryMedia`, `StoryMapTheme`, `StoryMapLayoutOptions`, and related
  map/display/order types.
- Zod schemas: `storyMapSchema`, `storyMapSourceSchema`, `storyMapLayoutSchema`, and
  `storySlideSchema`.
- Source utilities: `extractFencedBlock(markdown, 'story-map')`, `applySourceDefaults`,
  and `normalizeStoryMapInput`.
- Pure helpers for frontmatter stripping, WikiLink references, location/media coercion,
  slide merging, note date ordering, and Vault-relative folder paths.

Rendering is provided by `@story-map/react-story-map`; build-time Markdown integration
is provided by `@story-map/remark-story-map`.

## Parse a legacy `leaflet` block

`leaflet` is a second, independent input dialect for ordinary maps. It has its own parser
and never enters the `storymap/v1` Zod schema. Historical key spellings (`lat`, `long`,
`defaultZoom`, `markerFolder`, ...) are preserved, and a repeated `markerFolder` survives
as a list:

```js
import { parseLeafletSourceYaml, toGeoMapConfig } from '@story-map/story-map-core';

const source = parseLeafletSourceYaml(`
id: chile-2509
height: 600px
lat: -33.0000
long: -70.0000
minZoom: 4
maxZoom: 17
defaultZoom: 5
unit: meters
scale: 1
darkMode: true
markerFolder: backpacker/2509 Chile/Chile
markerFolder: backpacker/2509 Chile/Coast
`);

console.log(source.markerFolder); // ['backpacker/2509 Chile/Chile', 'backpacker/2509 Chile/Coast']
console.log(source.map.center); // [-33, -70]

// The host resolves `markerFolder` into markers; core never lists files.
const config = toGeoMapConfig(source, [
  { location: { lat: -33.4489, lng: -70.6693 }, type: 'city', title: 'Santiago' },
]);
console.log(config.schema); // geomap/v1
```

`parseLeafletSourceYaml(yaml, defaults?)` and `parseLeafletSourceObject(value, defaults?)`
return `LeafletSourceConfig`; `toGeoMapConfig(source, markers)` returns the renderer input
`GeoMapConfig`. Values resolve in the order authored key -> `LeafletSourceDefaults` (the
host's Leaflet-compatibility settings) -> built-in compatibility default. A StoryMap
setting is never assumed to exist for a `leaflet` block, and a Leaflet-compatibility
setting is never applied to a `storymap/v1` block.

Malformed input throws `LeafletParseError`, which extends `StoryMapParseError`, so one
host catch covers both dialects.

| Key | Result |
| --- | --- |
| `id` | `id`, passed through untouched; repeated authored ids are legal |
| `height` | `height` (built-in default `520px`); a number becomes `600px` |
| `lat` + `long` / `lng` | `map.center`; a partial or out-of-range pair throws |
| `defaultZoom` | `map.zoom` (built-in default `6`) |
| `minZoom`, `maxZoom` | `map.minZoom`, `map.maxZoom` |
| `markerFolder` | `markerFolder: string[]` from repeated keys, a YAML array, or a comma-separated string |
| `zoomDelta` | `map.zoomDelta`, plus a pending diagnostic |
| `unit`, `scale` | `pending.unit` / `pending.scale` metadata plus a warning; never a parse error |
| `darkMode` | `pending.darkMode` plus a warning; it never changes the theme or the tile source |

### Diagnostics

A recognized key that this phase does not implement is reported, never dropped, and an
unrecognized key gets its own code. `LEAFLET_DIAGNOSTIC_CODES` holds the stable values:

| Code | Meaning |
| --- | --- |
| `leaflet-pending-p1` | recognized, parsed, carried, not implemented yet (static maps) |
| `leaflet-pending-p2` | recognized file/layer key, not implemented yet |
| `leaflet-pending-p3` | recognized image/measurement/drawing key, not implemented yet |
| `leaflet-rejected-key` | historical host state, not part of the portable map model |
| `leaflet-unknown-key` | not a known `leaflet` key |
| `leaflet-compat-metadata` | accepted compatibility metadata (`unit`, `scale`) with no effect yet |
| `leaflet-compat-flag` | accepted compatibility flag (`darkMode`) with no effect yet |
| `leaflet-invalid-value` | recognized key whose value could not be coerced |

Pending P1 values are carried on `LeafletSourceConfig.pending`; recognized P2/P3 values
are carried on `deferred`. Nothing authored disappears before its phase lands.

## Notes, markers, and tiles

Both dialects read the same note frontmatter through one extraction
(`extractNoteFrontmatter`), so coordinates, title, description, `mapmarker`, and
`mapzoom` are never coerced twice:

- `slideFromNoteFrontmatter(frontmatter, fallbackTitle?)` builds a `StorySlide`
  contribution (unchanged `storymap/v1` behavior);
- `markerFromNoteFrontmatter(frontmatter, options?)` builds a `GeoMarker` and returns
  `undefined` when the note has no valid `location`, because a note without coordinates
  is skipped rather than fatal;
- `coerceMapZoom(value)` turns `mapzoom: [5, 18]` (and the tolerant `5`, `'5'`, and
  `'5-18'` forms) into `{ minZoom, maxZoom }`; an unparseable value is ignored;
- `resolveMarkerType({ authoredType, frontmatter, types, defaultTypeId })` applies the
  marker type precedence: explicit note `mapmarker`, first configured type whose tags
  match the note, configured default type, built-in generic default. An unknown type
  still resolves and keeps its authored name (`unknown: true`).

`toTileSources(light?, dark?)` builds the canonical `TileSources`, and
`tileSourcesFromStoryMap(map, dark?)` normalizes the published `storymap/v1`
`map.tileUrl` / `map.attribution` pair into `light`, so one renderer serves both dialects
while published 0.3.x/0.4.x consumers keep working. Both fall back to `DEFAULT_TILE_URL` /
`DEFAULT_TILE_ATTRIBUTION`.

Licensed under MIT.
