# @story-map/remark-story-map

Build-time Remark adapter and browser client for publishing maps from a Docusaurus
site. It handles two fenced-block dialects:

- ` ```story-map ` — a story: slides, layout modes, and a panel.
- ` ```leaflet ` — a legacy storyless map: markers resolved from notes, no slides.

At build time the plugin parses each block with the matching `story-map-core`
parser, optionally resolves notes from a Vault, and replaces the block with a
`.story-map-host[data-story-map-config]` placeholder carrying an explicit
`data-story-map-kind` discriminator. No Leaflet map is created during the
Node/SSR build. In the browser, the single client entry mounts the shared
`@story-map/react-story-map` renderer into every host, including after Docusaurus
SPA navigation.

- Build entry: `@story-map/remark-story-map` (Node APIs allowed).
- Browser entry: `@story-map/remark-story-map/client` (no Node APIs).
- Route/slug policy stays with the host; this package never implements
  Docusaurus slug rules.

## The two dialects

They are separate input languages with separate parsers. A `leaflet` block never
enters the `storymap/v1` schema, and a non-story map is never represented as fake
Story slides.

| | `story-map` | `leaflet` |
| --- | --- | --- |
| Parsed by | `parseStoryMapSourceYaml` | `parseLeafletSourceYaml` |
| Host kind | `data-story-map-kind="story"` | `data-story-map-kind="map"` |
| Serialized payload | `StoryMapConfig` | `GeoMapConfig` |
| Rendered by | `<StoryMap />` | `<GeoMap />` |
| Note selection | `noteFolder` (order + dateField) | every `markerFolder`, recursively |
| Key spelling | camelCase | historical (`lat`, `long`, `defaultZoom`) |

Both emit the same host element and share one client, so a page holding a story
and a map loads the renderer — and therefore Leaflet — exactly once.

## Emitted host element

```html
<!-- story-map fence -->
<div class="story-map-host" data-story-map-kind="story" data-story-map-document="true"
     data-story-map-instance="sm-1" data-story-map-config="<url-encoded JSON>"></div>

<!-- leaflet fence -->
<div class="story-map-host" data-story-map-kind="map"
     data-story-map-instance="sm-2" data-story-map-config="<url-encoded JSON>"></div>
```

`data-story-map-document="true"` is added only to a `story-map` host from a
document with `story-map: true` frontmatter; a `leaflet` block never gets it.

`data-story-map-instance` is host instance identity, numbered per transformed
file. It is deliberately **not** derived from the authored map `id`: existing
content reuses ids across maps (the Xinjiang block reuses the Chile block's
`chile-2509`), and two blocks on one page must not collide. The authored `id` is
preserved verbatim inside the serialized payload in both cases.

## `leaflet` fenced blocks

Phase 1 (P0) source compatibility. The blocks render unchanged:

````markdown
```leaflet
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
```
````

- `markerFolder` resolves as a Vault-relative folder including subfolders,
  recursively, through the same `VaultIndex` and the same scan exclusions
  (`node_modules`, `build`, `dist`, `coverage`, dot-directories) as `noteFolder`.
  Historical repeated `markerFolder:` lines are all resolved, in authored order.
- A discovered note becomes a marker when it has a valid `location`. A note
  without one is skipped, never a build failure.
- A note's `mapmarker` names a marker type; an unregistered value still renders
  through the default visual with the authored name preserved.
- `mapzoom` becomes marker min/max zoom visibility.
- `unit`, `scale`, and `darkMode` are accepted as compatibility metadata and do
  not raise a parse error.

Markers are ordered by Vault-relative path within each folder, so the serialized
list is deterministic and matches the Obsidian adapter's order.

### Diagnostics

A recognized key that is not implemented produces a `GeoMapDiagnostic` naming that
key, serialized inside the host payload and rendered by the browser client as a
short list under the map (`.story-map-host__diagnostics`). Nothing authored is
silently dropped. The same applies to an unrecognized key, which is reported as
an unknown key rather than ignored.

Phases not yet implemented (P1 marker files and inline markers, P2 GeoJSON/GPX
layers, P3 image maps, measurement, and drawing) are carried as parsed metadata
and reported as pending. See the compatibility matrix in `docs/architecture.md`
for the authoritative state.

### `leaflet` host options

These apply to `leaflet` blocks only. They are Leaflet *compatibility* settings,
never StoryMap settings, and a `story-map` block never reads them.

| Option | Type | Purpose |
| --- | --- | --- |
| `leafletDefaults` | `LeafletSourceDefaults` | Site-level compatibility defaults (height, center, zoom, tile URL/attribution, theme), resolved after an authored key and before the built-in compatibility default. |
| `leafletPresentation` | `{ markerTypes?, defaultMarkerType?, defaultTooltip? }` | Marker type registry, default marker type, and tooltip mode. |

```js
const storyMapOptions = {
  vaultRoot,
  resolveNoteHref,
  leafletPresentation: {
    markerTypes: [{ id: 'restaurant', icon: { kind: 'symbol', value: '🍴' } }],
    defaultTooltip: 'hover',
  },
};
```

## Installation

```bash
pnpm add @story-map/remark-story-map react@^19 react-dom@^19
```

The renderer is pulled in transitively, but the host site is responsible for
providing `react` / `react-dom` (declared as peer dependencies).
Both peers must be React 19. A Docusaurus installation using React 18 does not satisfy
these peer requirements; verify the site's versions before integrating. Build-time
usage is ESM and the release workflow verifies Node 24 imports. A full Docusaurus site
build and browser smoke test remain host integration checks.

## Docusaurus setup

Register the transformer in the docs and/or blog options. The same plugin
instance can be used for both:

```js
import remarkStoryMap from '@story-map/remark-story-map';

const storyMapOptions = {
  vaultRoot: '/absolute/path/to/vault',
  assetBase: '/vault-assets',
  resolveNoteHref: (vaultRelativePath) => {
    // See "Resolving published note routes" below.
    return undefined;
  },
};

export default {
  presets: [
    [
      'classic',
      {
        docs: {
          remarkPlugins: [[remarkStoryMap, storyMapOptions]],
        },
        blog: {
          remarkPlugins: [[remarkStoryMap, storyMapOptions]],
        },
      },
    ],
  ],
  plugins: ['./plugins/story-map-client'],
};
```

Blog support uses the same adapter; only add it when a real blog StoryMap use
case exists.

## Options

| Option | Type | Purpose |
| --- | --- | --- |
| `vaultRoot` | `string` | Vault/repo root to index. Required for explicit `slide.note` WikiLinks, recursive `noteFolder` discovery, and `leaflet` `markerFolder` resolution. |
| `assetBase` | `string` | URL prefix that rewrites resolved Vault-relative media paths (for example `/vault-assets`). It only rewrites URLs; it does not copy files. |
| `resolveNoteHref` | `(vaultRelativePath: string) => string \| undefined` | Host callback that maps a Vault-relative note path (without `.md`) to its final published href. Used by `noteDisplay: link` and by `leaflet` marker links. |
| `leafletDefaults` | `LeafletSourceDefaults` | `leaflet`-only compatibility defaults. See "leaflet host options". |
| `leafletPresentation` | `LeafletHostPresentation` | `leaflet`-only marker registry and tooltip default. See "leaflet host options". |

`vaultRelativePath` is the note's Vault-relative path without the extension,
using forward slashes, for example `Trips/Santiago`.

When `vaultRoot` is omitted, fenced blocks are parsed and serialized, but no
note or `noteFolder` resolution happens.

The normalized `map.theme` (`auto`, `light`, `dark`, `vintage`, `cyber`, `atlas`) and
document-owned `layout` (`card`, `full`, or `timeline`) pass through to the shared renderer
unchanged. Remark adds no theme palette or layout behavior of its own. `auto` falls back
to `prefers-color-scheme` in the published site unless the host sets `--story-map-*`.

## Resolving published note routes

`resolveNoteHref` lets the host decide published URLs. The `kywk.github.io`
site already owns this decision through `scripts/content-links.js`, which
exports `createContentLinkIndex({ root, docsConfig, blogConfig })`. Its index
exposes `resolve(name)`, returning an array of entries with a `.route`
property. Wire the callback to that existing index instead of reimplementing
slug logic:

```js
import { createContentLinkIndex } from './scripts/content-links.js';

const contentLinkIndex = createContentLinkIndex({
  root: vaultRoot,
  docsConfig,
  blogConfig,
});

const storyMapOptions = {
  vaultRoot,
  assetBase: '/vault-assets',
  resolveNoteHref: (vaultRelativePath) => {
    const matches = contentLinkIndex.resolve(vaultRelativePath);
    return matches.length === 1 ? matches[0].route : undefined;
  },
};
```

Rules enforced by the package:

- `resolveNoteHref` is only consulted for `noteDisplay: link` and for `leaflet`
  marker links.
- A returned string becomes `StorySlide.notePath` (or `GeoMarker.notePath`),
  which the renderer turns into a normal browser link.
- `undefined` (or an ambiguous multiple-match result) leaves the slide title or
  marker unlinked; the build does not invent a route.
- No absolute local filesystem path is ever serialized into the HTML.
- The callback receives the Vault-relative path **without** the `.md` extension
  and with forward slashes, for example `Trips/Santiago`.

Do not copy `deriveSlug()` or any Docusaurus URL normalization into the
package or the site's StoryMap config; keep the existing
`scripts/content-links.js` / `remark-slug-normalizer` pipeline as the single
URL authority.

## Note resolution

With `vaultRoot` configured, notes are indexed recursively. The scanner skips
dot-directories, `node_modules`, `build`, `dist`, and `coverage`.

### Explicit slides

A slide with `note: "[[Trips/Santiago]]"` inherits note frontmatter
(`title`, `description`/`summary`, `location`, `cover`/`image`/`media`,
`mapmarker`). Explicit slide properties override note-derived values, and
explicit slides keep their author order exactly: they are never appended to or
reordered by folder discovery. A WikiLink matching multiple notes without an
explicit path is a build-time error; use a Vault-relative path.

### `noteFolder`

`noteFolder` names one Vault-relative folder (subfolders are included
recursively). Order is controlled only by:

- `order: asc | desc` (default `asc`);
- `dateField` (default `date-created`).

Only notes whose frontmatter contains `story-map-note: true` are discovered;
other Markdown files in the folder are ignored. Notes without a parseable date
sort last.

`includeTags` keeps only notes whose frontmatter tags contain any listed tag,
and `excludeTags` drops notes whose frontmatter tags contain any listed tag.
Both are optional, compare case-insensitively, and read the frontmatter `tags` or
`tag` key only (matching Obsidian).

```yaml
noteFolder: Trips/Santiago
order: desc
dateField: date-created
includeTags: [travel, chile]
excludeTags: [draft]
```

## Slide dates

Every resolved slide carries an optional `date` (epoch milliseconds) read from
the same `dateField` frontmatter value that drives ordering, so Obsidian and
Remark render identical timelines. An explicit slide may author its own date,
which always wins over the referenced note's value:

```yaml
layout:
  mode: timeline
slides:
  - title: Leaving home
    date: 2024-04-12
  - note: "[[Trips/Santiago]]"
```

`date` is document data, not a plugin setting or a defaultable key. A note
whose `dateField` value is missing or unparseable is still discovered and simply
has no `date`.

`noteDisplay: full` normally strips a slide down to `location` and `mapmarker`
because the note body carries the content. `layout.mode: timeline` is the one
exception: a timeline row needs its date, title, and cover, so a timeline keeps
the frontmatter fields alongside the body text. `card` and `full` are unchanged.

## `noteDisplay`

Note presentation is controlled by `noteDisplay`, which accepts:

- `basic` — frontmatter-derived content only.
- `link` — frontmatter basics plus a host-resolved `notePath` when
  `resolveNoteHref` returns a string. This is the default.
- `full` — the frontmatter-stripped note Markdown body as slide text. The
  frontmatter-derived title, media, and date are dropped because the body
  carries them, and only `location` and `mapmarker` survive from the note.

`layout.mode: full` forces `full` display regardless of the configured value.
`timeline` is not forced: it honours the document's `noteDisplay`, and the
`full`-display strip described above is skipped for a timeline so rows keep
their date, title, and cover.

`link` is platform-specific only at navigation time: Docusaurus resolves the
published route and the renderer emits a normal browser link.

## Media resolution

Relative media is resolved against the correct source document:

- note-derived media resolves relative to the note file;
- media authored explicitly on a slide resolves relative to the StoryMap source
  Markdown document.

Absolute `http:`/`https:`/`data:`/`blob:` URLs are left unchanged. When
`assetBase` is set, resolved Vault-relative paths are rewritten to
`<assetBase>/<path>` for the browser.

`assetBase` only rewrites URLs. Copying Vault attachments into the Docusaurus
static directory remains part of the site's own publishing pipeline; the
package never copies files.

## Registering the browser client

Docusaurus client modules are registered by a small local plugin. See
`examples/docusaurus/story-map-client-plugin.cjs`:

```js
module.exports = function storyMapClientPlugin() {
  return {
    name: 'story-map-client',
    getClientModules() {
      return [require.resolve('@story-map/remark-story-map/client')];
    },
  };
};
```

Add `./plugins/story-map-client` (or the equivalent path) to the site's
`plugins` list. The client entry only initializes maps in the browser,
mounts every host on the page, skips duplicate mounts, unmounts roots whose
host nodes were removed during SPA navigation, and keeps Node APIs out of the
browser bundle.

One client serves both dialects. It reads `data-story-map-kind` and mounts
`<StoryMap />` or `<GeoMap />` accordingly, so a site can delete a separate
Leaflet bootstrap script and its own `leaflet` remark plugin: Leaflet is loaded
from this bundle alone, and only when a story or map host is present on the
page. A host with no discriminator is treated as a story host, so pages
published before the discriminator existed keep working.

## Docusaurus theme bridge

The built-in `map.theme` preset styles both cartography and StoryMap chrome.
The Docusaurus site can load `examples/docusaurus/story-map-theme.css` without
overriding that palette. For a deliberate site-color override, add the
`story-map-use-infima-colors` class to the chosen host and load that stylesheet:

```css
.story-map-host.story-map-use-infima-colors {
  --story-map-bg: var(--ifm-background-surface-color);
  --story-map-fg: var(--ifm-font-color-base);
  --story-map-muted: var(--ifm-color-emphasis-700);
  --story-map-border: var(--ifm-color-emphasis-300);
  --story-map-accent: var(--ifm-color-primary);
}
```

This optional bridge is an advanced override of the built-in palette. It does
not change the configured map theme or tile URL.

## Full-page view

A full-viewport map (Obsidian's "Open as Story Map") with a Markdown toggle is
**not** a package option. It manipulates Docusaurus theme DOM, collapses the
docs sidebar, listens to the route lifecycle, and needs host CSS, so it stays in
the host site. The transform already stamps document hosts with
`data-story-map-document="true"`; a small host client module reads that. See
[`../../docs/docusaurus-full-page.md`](../../docs/docusaurus-full-page.md) and
`examples/docusaurus/story-map-view.js`.

## How the pipeline fits together

```text
story-map fenced block
  -> remark-story-map (build-time, Node)
  -> VaultIndex (explicit notes / noteFolder)
  -> host resolveNoteHref(vaultRelativePath)
  -> existing contentLinkIndex / published route
  -> serialized StoryMapConfig in .story-map-host[data-story-map-kind="story"]

leaflet fenced block
  -> remark-story-map (build-time, Node)
  -> leaflet dialect parser (never storymap/v1)
  -> VaultIndex (markerFolder, recursive)
  -> host resolveNoteHref(vaultRelativePath) for marker links
  -> serialized GeoMapConfig + diagnostics
     in .story-map-host[data-story-map-kind="map"]

both
  -> browser StoryMap client (one module, one Leaflet)
  -> shared @story-map/react-story-map renderer (Leaflet imported client-side)
```

Neither dialect creates a Leaflet map during the Node/SSR build.
