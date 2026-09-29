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
| `map.tileUrl` | `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png` |
| `map.attribution` | `© OpenStreetMap contributors` |
| `map.showPath` | `true` |
| `layout.mode` | `card` |
| `layout.card.align` | `left` |
| `layout.full.side` | `left` |
| `layout.full.contentRatio` | `0.5` |

`map.center`, `map.minZoom`, and `map.maxZoom` are optional. `panelOpacity` accepts a number between `0.0` and `1.0` (built-in default `0.85`). All source keys use camelCase.
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
folder-discovered notes; an authored `date` wins over a note-derived one, and
`noteDisplay: full` slides drop it along with the other frontmatter display fields.

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

Licensed under MIT.
