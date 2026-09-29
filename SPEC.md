# StoryMap Specification

This is the product and architecture contract. `docs/architecture.md` describes how the
current code implements it.

## 1. Goal and scope

Build a small, reusable map stack centered on one standard `StoryMapConfig` model for
storytelling and one standard `GeoMapConfig` model for ordinary maps, both rendered by the
same Leaflet runtime. The product supports:

1. standalone React usage;
2. an Obsidian file-backed full-leaf StoryMap view;
3. Docusaurus/Remark publishing of the same Obsidian-oriented Markdown source;
4. Leaflet map navigation synchronized with paged story slides;
5. note discovery from one configured Vault folder and all of its subfolders;
6. a generic GeoMap that renders markers, tile sources, and zoom visibility without any
   story concept;
7. documented/static source compatibility for legacy Obsidian `leaflet` fenced blocks, in
   both Obsidian and Docusaurus/Remark, so existing content renders without edits and the
   old Obsidian Leaflet plugin plus a separate Docusaurus Leaflet runtime can be retired.

The Obsidian view is the behavioral reference for note discovery, ordering, inheritance,
and `noteDisplay` semantics. The Docusaurus/Remark path implements the equivalent behavior
and defers route/slug policy to the host site.

Scope the compatibility promise honestly: this is source compatibility for the documented
and actually-implemented key set, phased as P0/P1 static maps, P2 file layers, and P3
image/drawing/mutable state. It is not a clone of every historical plugin integration, and
a recognized key that is not implemented reports a diagnostic instead of being ignored.

Stay intentionally small. Do not add a visual editor, scroll-driven storytelling, MapLibre,
3D maps, GPX/GeoJSON editing, query languages, filtering/grouping beyond the documented
`includeTags`/`excludeTags` note filter, or a generic plugin framework.

## 2. Source document model

### 2.1 StoryMap document

A normal Markdown file with `story-map: true` frontmatter and one `story-map` fenced code
block holding the configuration:

````markdown
---
story-map: true
---

```story-map
schema: storymap/v1
title: Chile Trip
noteFolder: Travel/Chile/Places
order: asc
dateField: date-created
noteDisplay: link
includeTags: [travel, chile]
excludeTags: [draft]

map:
  theme: vintage
  center: [-33.4489, -70.6693]
  zoom: 5
  showPath: true
layout:
  mode: full
  full:
    side: left
    contentRatio: 0.5
```
````

The Obsidian full-leaf view reads configuration from this fence. For Docusaurus, the
Remark plugin transforms the same fence at build time into a browser-safe serialized
`StoryMapConfig` placeholder; the browser runtime mounts the shared renderer after static
rendering.

Multiple configuration blocks in one Obsidian StoryMap document are out of scope. The
Remark transformer may mount multiple independent StoryMap hosts when multiple blocks occur
on an ordinary Docusaurus page.

### 2.1.1 Legacy `leaflet` document

A `leaflet` fenced block is a second, independent input dialect. It renders an ordinary map
with markers resolved from notes; it has no slides, no story layout, and no panel. It never
requires a document to carry `story-map: true`, and it appears inline in ordinary Markdown.

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

The two dialects do not share a source schema. `leaflet` keeps historical key spelling
(`lat`, `long`, `defaultZoom`, `minZoom`, `markerFolder`) because existing content uses it.
A recognized key that this specification does not implement produces a diagnostic naming
that key; it is never silently dropped. Authored `id` values may repeat across maps and must
not collide at runtime — host instance identity is separate from the authored id.

### 2.2 StoryMap note

A folder-discovered note is a normal Markdown file with `story-map-note: true` and reusable
metadata:

```yaml
---
story-map-note: true
title: Santiago
location: [-33.4489, -70.6693]
mapmarker: city
date-created: 2026-01-15
description: The starting point of the Chile journey.
cover: ./assets/santiago.jpg
---
```

StoryMap reuses Leaflet-compatible geographic frontmatter instead of introducing a second
coordinate schema. `story-map-note: true` is required only for automatic `noteFolder`
discovery; an explicitly referenced `slide.note` does not need it.

## 3. Naming conventions

StoryMap configuration keys are camelCase (`noteFolder`, `dateField`, `noteDisplay`,
`showPath`, `tileUrl`, `defaultZoom`), matching familiar Obsidian Leaflet-style config.
Markdown frontmatter role flags stay kebab-case (`story-map: true`,
`story-map-note: true`). A configured date field name is a value, not a StoryMap key; its
default is `date-created`.

The `leaflet` dialect keeps its historical key spelling, which is mostly the same words
written differently (`lat`, `long`, `defaultZoom`, `minZoom`, `markerFolder`,
`mapmarker`, `unit`, `scale`). Existing notes already use it, and Phase 1 must render them
unchanged. Note frontmatter is shared between both dialects: `location`, `mapmarker`,
`mapzoom`, `title`, and `description`/`summary` mean the same thing to either renderer.

## 4. Architecture

Two dialects, two source schemas, one map runtime:

```text
story-map source --> StoryMapConfig --\
                                          --> react-story-map: <StoryMap> and <GeoMap>
leaflet source   --> GeoMapConfig -----/          ^
                                                    |
                                    StoryMap composes the shared GeoMap
```

Concretely:

```text
Vault / Markdown / API
        |
        v
platform adapter / resolver
        |
        +--> @story-map/story-map-core (storymap/v1 schema, parser, helpers)
        |              |
        |              v
        |        StoryMapConfig
        |
        +--> @story-map/story-map-core (leaflet dialect parser, diagnostics)
                       |
                       v
                 GeoMapConfig
                       |
                       v
        @story-map/react-story-map  (shared Leaflet lifecycle)
                       ^
            StoryMap composes here
```

Platform adapters:

```text
Obsidian Vault ----> obsidian-story-map --\
                                          ---> StoryMapConfig ---> <StoryMap>
Docusaurus build --> remark-story-map ----/  \                          |
Standalone app -------------------------/    \--> GeoMapConfig ------> <GeoMap>
```

The Obsidian adapter renders `react-story-map` as a dedicated file-backed workspace view for
StoryMap, and registers an inline `leaflet` code-block processor for ordinary Markdown.
Remark resolves both sources at build time, serializes only platform-neutral render data,
and mounts the same renderer in the browser. Route resolution, filesystem access,
Docusaurus URL policy, and theme bridging remain outside `react-story-map`.

## 5. Package responsibilities

### `story-map-core`

Owns types (`StoryMapConfig`, `StorySlide`, `StoryLocation`, `StoryMedia`), YAML
parsing/validation, source normalization and defaults (`noteFolder`, `order`, `dateField`,
`noteDisplay`, `map.theme`, document-owned `layout`), Leaflet-compatible key normalization, WikiLink reference parsing,
frontmatter stripping, location/media coercion, and deterministic note date sorting. Must
not import React, Leaflet, Obsidian, Docusaurus, or Node `fs`. Folder scanning, file
metadata, route resolution, and real asset resolution belong to adapters.

It additionally owns the GeoMap model and the `leaflet` dialect: `GeoMapConfig`,
`GeoMapOptions`, `TileSource` / `TileSources`, `GeoMarker`, `MarkerTypeDefinition`,
`GeoMapDiagnostic`, the dedicated `leaflet` parser (including historical repeated-key
handling for repeatable keys), marker-type resolution helpers, and pure `mapzoom`
coercion. The `leaflet` dialect is never validated by the `storymap/v1` Zod schema. The
built-in tile source lives here as `DEFAULT_TILE_URL` / `DEFAULT_TILE_ATTRIBUTION`.

### `react-story-map`

Owns the `<StoryMap />` component, Leaflet instance lifecycle, paged navigation, `flyTo`
synchronization, markers and optional path, image/video/iframe media, Markdown text
rendering, resize handling (`invalidateSize()`), minimal responsive CSS, generic
note-title link rendering from a resolved `notePath`, six map/chrome theme
presets (`auto` plus five fixed palettes), card/full/timeline presentation modes, and the
semantic `--story-map-*` CSS
variables. Must remain SSR-import-safe: Leaflet is dynamically imported inside client
effects. Must not know what a Vault, WikiLink, frontmatter file, note folder, Obsidian
workspace, or Docusaurus route is.

It also owns the exported `<GeoMap />` primitive: one Leaflet instance per host, the shared
tile-source lifecycle, generic markers with zoom visibility, generic tooltips, and
coordinate interaction callbacks. `StoryMap` composes `GeoMap` rather than owning a
separate Leaflet lifecycle, so a page never runs two map runtimes.

Slide-title link behavior: if `slide.notePath` exists with host callbacks, callbacks may
override navigation (Obsidian). If `slide.notePath` exists without callbacks, the renderer
renders a normal browser link (Docusaurus). Otherwise it renders a non-link title.

### `obsidian-story-map`

Owns the file-backed `TextFileView`, `story-map: true` detection, `story-map` fence
extraction, Markdown <-> StoryMap view switching, default-open of detected documents,
recursive `noteFolder` discovery filtered by `story-map-note: true` and optional
`includeTags`/`excludeTags`, `dateField` + `order` sorting, explicit `slide.note`
resolution, `noteDisplay` handling, metadata and local media resolution, a settings tab of
defaults, and React mount/unmount lifecycle. It is the behavioral reference for note
resolution and `noteDisplay`, except where browser navigation necessarily differs. It must not depend on the community Obsidian Leaflet
plugin at runtime.

It additionally owns the legacy `leaflet` path: a
`registerMarkdownCodeBlockProcessor('leaflet', ...)` handler that renders `<GeoMap />`
inside ordinary Markdown, recursive Vault-relative `markerFolder` resolution, note
`location` / `mapmarker` / `mapzoom` extraction, note hover-preview and open-note
callbacks, Shift-click coordinate copy, a versioned settings structure with migration from
the current flat settings, and an optional importer for Obsidian Leaflet's saved settings.
It does not depend on that plugin at runtime and does not recreate its mutable-marker store,
config directory, or map-view persistence.

The plugin targets desktop only. The declared minimum Obsidian version is 1.8.7, required
by the `App.loadLocalStorage`/`App.saveLocalStorage` and `getLanguage` APIs used for
device-local agent settings and locale detection. Its community identity is
`Geo Story Map` / `geo-story-map`; the source syntax and npm package names remain
unchanged.

### `remark-story-map`

Owns the build-time fenced-block transform, optional `vaultRoot` Vault indexing (skipping
dot-directories and `node_modules`/`build`/`dist`/`coverage`), recursive `noteFolder`
resolution with the same `dateField`/`order` and `includeTags`/`excludeTags` semantics as
Obsidian, `noteDisplay` semantics, explicit `slide.note` resolution, source-aware relative
media, a host-provided published-route resolver for `noteDisplay: link`, serialization of
only normalized
`StoryMapConfig` into a browser-safe host element, and a client entry that mounts
placeholders with `<StoryMap />` and unmounts roots removed during SPA navigation.
Build-time code never initializes Leaflet; the browser entry never uses Node APIs.

The package must not own Docusaurus slug policy. In the target `kywk.github.io`
integration, `scripts/content-links.js` / `remark-slug-normalizer` remains the URL
authority.

It additionally transforms `leaflet` code nodes into map hosts, reusing `VaultIndex` for
`markerFolder` resolution and the same host route hook for published note links. Each host
carries an explicit `story` / `map` discriminator, and the single browser client mounts
`<StoryMap />` or `<GeoMap />` accordingly, so a page boots exactly one Leaflet runtime.

## 6. Story source configuration v1

```ts
interface StoryMapSourceConfig {
  schema: 'storymap/v1';
  id?: string;
  title?: string;
  height: string;                // default: '520px'

  noteFolder?: string;
  order: 'asc' | 'desc';         // default: 'asc'
  dateField: string;             // default: 'date-created'
  noteDisplay: 'basic' | 'link' | 'full';  // default: 'link'
  initialSlide: 'first' | 'last' | number; // default: 'first'
  includeTags?: string[];        // keep notes with any listed tag
  excludeTags?: string[];        // drop notes with any listed tag
  panelOpacity: number;          // default: 0.85 (range 0.0..1.0), translucent card/article wash

  map: {
    center?: [number, number];
    theme: 'auto' | 'light' | 'dark' | 'vintage' | 'cyber' | 'atlas'; // built-in default: 'light'; Obsidian plugin default: 'auto'
    zoom: number;
    minZoom?: number;
    maxZoom?: number;
    tileUrl: string;
    attribution: string;
    showPath: boolean;
  };

  layout: {
    mode: 'card' | 'full' | 'timeline'; // default: 'card'; timeline reuses the `full` options
    card: { align: 'left' | 'center' | 'right'; widthRatio?: number; heightRatio?: number };
    full: { side: 'left' | 'right'; contentRatio: number };
  };

  slides?: StorySlide[];
}
```

`noteFolder` is a Vault-relative folder and includes all nested subfolders. Only one
`noteFolder` is supported.

### 6.1 Explicit slides

When `slides` is present and non-empty:

- the slide sequence is exactly the configured sequence;
- `noteFolder` does not append discovered slides;
- `order` and `dateField` do not reorder explicit slides;
- explicit `slide.note` references resolve normally;
- explicit slide properties override note-derived properties.

### 6.2 Folder-generated slides

When `slides` is absent or empty and `noteFolder` is set:

1. recursively scan the folder and subfolders;
2. consider Markdown files only;
3. include only files with `story-map-note: true`;
4. when `includeTags` is non-empty, include only files whose frontmatter tags contain at
   least one listed tag;
5. when `excludeTags` is non-empty, drop files whose frontmatter tags contain any listed
   tag;
6. read the frontmatter field named by `dateField`, using that value both to order the
   notes and to fill each slide's `date`;
7. sort valid dates by `order`;
8. produce one slide per included note.

For determinism, notes with a missing or unparseable date are retained after valid dates.
Ties break by Vault-relative path ascending regardless of `order`. These are stability
rules, not configurable sort features.

#### 6.2.1 Tag filtering

`includeTags` and `excludeTags` are optional document-only string lists. Matching is
any-of: `includeTags` keeps a note when it has at least one listed tag, and `excludeTags`
drops a note when it has any listed tag; the two may be combined. Tags come from the note
frontmatter `tags` or `tag` key, accept a string or a list, strip a leading `#`, and compare
case-insensitively. Nested tags (`a/b`) match only their exact value; there is no parent or
wildcard matching.

Filtering applies only to folder-generated slides. When explicit `slides` are present,
`noteFolder` is ignored and therefore `includeTags`/`excludeTags` have no effect. The keys
are not plugin settings defaults and are not serialized into `StoryMapConfig`. Obsidian and
Remark use the same frontmatter-only rule so both hosts select the same notes; inline
`#tag` body syntax is not considered.

### 6.3 Note display

- `basic` — frontmatter-derived basics only (`title`, `location`, `description`/`summary`,
  `cover`);
- `link` — the same basics plus a resolved `slide.notePath`:
  - Obsidian passes an opaque Vault path plus callbacks (Page preview on hover, open in new
    tab on click);
  - Remark passes the published href from the host `resolveNoteHref`, or omits `notePath`
    when the host cannot resolve it, leaving the title unlinked (default);
- `full` — the frontmatter-stripped note body as slide text, keeping the resolved
  `slide.notePath` so the title stays linked. Frontmatter-derived title, media, and date are
  dropped (the body carries them); fields the story document set explicitly are kept. Only
  the `full` LAYOUT resolves notes this way regardless of the configured `noteDisplay`;
  `card` and `timeline` use the configured mode. A `timeline` row is built from that same
  slide, so `timeline` is also the one layout that keeps the note's title, cover, and date
  next to the body.

Rendering stays platform-neutral. Obsidian/Docusaurus-specific WikiLink or embed expansion
inside the body is not required.

Slide `date` values are epoch milliseconds. The parser coerces a `Date`, a finite `number`,
and a `string` into that shape, and rejects a present but unparseable value as a parse
error; an absent date stays absent. Folder-generated slides take the value from the same
`dateField` frontmatter field used for ordering, and an explicit slide may author its own
`date`, which wins. The timeline layout is the only consumer.

### 6.4 Default precedence

`map.theme` is a coordinated visual preset independent of `tileUrl`. Its six values are
`auto`, `light`, `dark`, `vintage`, `cyber`, and `atlas`, with `light` as the framework
built-in default and `auto` as the Obsidian plugin default. `auto` follows the host: the
Obsidian plugin maps it onto Obsidian's own light/dark theme and colors, while other hosts
fall back to the OS/browser `prefers-color-scheme` light/dark palette. `light` and `dark`
are fixed, host-independent palettes. `layout` is document-owned: `card` preserves the existing floating card by
default, while `full` places a scrollable story surface to the left or right over a
full-bleed map with a progressive fade. `timeline` keeps that full-bleed map and column but
renders every slide as one dated row, so the list itself is the navigation and there are no
previous/next controls; it has no option block of its own and reads `layout.full.side` and
`layout.full.contentRatio`. Card alignment defaults to `left`; optional
`widthRatio` accepts `0.20..0.80` and `heightRatio` accepts `0.20..0.95`. Full `side`
defaults to `left` and `contentRatio` defaults to `0.50` within `0.30..0.70`. On narrow
screens, `full` and `timeline` modes use a vertical map/story transition. Inactive mode
options remain in the normalized config and do not affect rendering.

Obsidian resolves source values in order: document block -> plugin settings -> built-in
defaults. Plugin settings expose defaults for `order`, `dateField`, `noteDisplay`, `initialSlide`, `panelOpacity`, and the
`map` keys `theme`, `zoom`, `minZoom`, `maxZoom`, `tileUrl`, `attribution`, `showPath`. Per-story
values — `schema`, `id`, `title`, `noteFolder`, `includeTags`, `excludeTags`, `map.center`,
`layout`, `slides`, `height` — are document-only (`height` is forced to `100%` in the Obsidian
full-leaf host and remains
meaningful in standalone/Docusaurus hosts). Remark uses document values plus built-in
defaults; it does not duplicate the Obsidian settings UI. See `docs/architecture.md` for
the full defaults table.

### 6.5 Tile providers and credentials

A map theme is visual presentation. A tile provider is the rendered map background. They
are orthogonal: `theme: vintage` may sit on OpenStreetMap tiles, and `theme: dark` may sit
on any provider. Provider selection is never encoded in a theme name, and a theme never
silently replaces a configured `tileUrl`.

The built-in tile source is:

```text
https://tile.openstreetmap.org/{z}/{x}/{y}.png
```

with visible attribution `© OpenStreetMap contributors`. This is the current
OpenStreetMap-recommended standard endpoint, exported as `DEFAULT_TILE_URL` /
`DEFAULT_TILE_ATTRIBUTION`. CARTO Basemaps is not the default because it now requires an
API key. Tile providers remain configurable through the existing `map.tileUrl` /
`map.attribution` keys and, for a light/dark pair, through Leaflet-compatibility settings
that resolve before any built-in default.

Markdown fences and generated HTML are public source and public output. A provider API key
is therefore never a secret in a fenced block and is never serialized as if it were
private; a key delivered to a browser is a public client credential that must be
provider-restricted and configured by the host. If an imported or authored CARTO URL lacks
a key parameter, the product warns rather than silently making it the default.

## 6A. GeoMap configuration

```ts
interface GeoMapConfig {
  schema: 'geomap/v1';
  id?: string;                       // authored identity; may repeat across maps
  height: string;
  map: GeoMapOptions;
  markers: GeoMarker[];
  diagnostics?: GeoMapDiagnostic[];  // recognized-but-unimplemented keys
}

interface TileSource {
  url: string;
  attribution: string;
  subdomains?: string | string[];
  minZoom?: number;
  maxZoom?: number;
}

interface TileSources {
  light: TileSource;
  dark?: TileSource;
}

interface GeoMapOptions {
  center?: [number, number];
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  zoomDelta?: number;
  theme: StoryMapTheme;
  tiles: TileSources;
  controls?: { noUI?: boolean; noScrollZoom?: boolean; recenter?: boolean; locked?: boolean };
}

interface GeoMarker {
  id?: string;
  type?: string;
  location: { lat: number; lng: number };
  title?: string;
  description?: string;
  notePath?: string;
  minZoom?: number;
  maxZoom?: number;
  tooltip?: 'always' | 'hover' | 'never';
}

interface MarkerTypeDefinition {
  id: string;
  icon?: { kind: 'symbol' | 'image'; value: string };
  color?: string;
  tags?: string[];
  minZoom?: number;
  maxZoom?: number;
}

interface GeoMapDiagnostic {
  level: 'warning' | 'error';
  code: string;
  key?: string;
  message: string;
}
```

`GeoMapOptions.tiles` is the internal canonical form. `storymap/v1` keeps its published
`map.tileUrl` / `map.attribution` fields indefinitely and normalizes them into the light
tile source, so published 0.3.x/0.4.x consumers keep working. Only fields required by the
active compatibility phase are implemented; later layer fields stay out of the type until
their phase is built rather than being stubbed.

Marker type precedence for a note-derived marker is: explicit note `mapmarker`; first
configured marker type whose associated tag matches the note; configured default marker
type; built-in generic default. Marker types carry a portable symbol or image. Font
Awesome is not part of the cross-platform contract, and an unknown type falls back visually
while preserving the authored name.

## 7. Canonical render model

```ts
interface StoryMapConfig {
  schema: 'storymap/v1';
  id?: string;
  title?: string;
  height: string;
  initialSlide?: number;
  panelOpacity: number;
  map: {
    center?: [number, number];
    theme: 'auto' | 'light' | 'dark' | 'vintage' | 'cyber' | 'atlas';
    zoom: number;
    minZoom?: number;
    maxZoom?: number;
    tileUrl: string;
    attribution: string;
    showPath: boolean;
  };
  layout: {
    mode: 'card' | 'full' | 'timeline';
    card: { align: 'left' | 'center' | 'right'; widthRatio?: number; heightRatio?: number };
    full: { side: 'left' | 'right'; contentRatio: number };
  };
  slides: StorySlide[];
}

interface StorySlide {
  id?: string;
  note?: string;       // adapter input; the renderer ignores unresolved references
  notePath?: string;   // adapter-resolved opaque or published reference for link display
  title?: string;
  text?: string;
  date?: number;       // epoch ms; filled by adapters from `dateField`, or authored
  location?: { lat: number; lng: number; zoom?: number };
  media?: { type: 'image' | 'video' | 'iframe'; src: string; alt?: string; caption?: string };
  mapmarker?: string;
}
```

Accepted convenience forms: `location: [lat, lng]`; `media: ./image.jpg` as image media;
root-level Leaflet-like `lat`, `long`, `defaultZoom`, and `tileServer` normalized into map
fields. A root-level `opacity`, or `map.opacity`, normalizes into `panelOpacity`; both are
then removed, so `panelOpacity` always wins.

`map.tileUrl` / `map.attribution` remain published `storymap/v1` fields and normalize into
the light entry of `GeoMapOptions.tiles`; the renderer accepts either shape. `StoryMap`
derives its map-facing marker and path representation from `slides` and renders the shared
`GeoMap` underneath, so the same Leaflet instance serves both entry points.

## 8. Note metadata and Leaflet compatibility

Recognized note frontmatter:

```yaml
---
story-map-note: true
title: Santiago
location: [-33.4489, -70.6693]
description: A short introduction.
cover: ./santiago.jpg
mapmarker: city
mapzoom: [5, 18]
date-created: 2026-01-15
---
```

- `location` is the primary coordinate source and is shared with Obsidian Leaflet;
- `mapmarker` names a marker type. An unknown value must still render through the default
  type rather than failing; the authored name is preserved for diagnostics;
- `mapzoom: [min, max]` normalizes into marker min/max zoom visibility. It is a real
  GeoMap capability in P1, not merely collected metadata;
- `description` or `summary` may provide slide text;
- `cover`, `image`, or `media` may provide slide media;
- with `noteDisplay: full`, the frontmatter-stripped note body becomes slide text;
  otherwise the body is not used.

## 9. Note resolution precedence

When an adapter resolves an explicit or discovered note: explicit slide properties win,
then note frontmatter fills missing values, then story-level map defaults apply last. The
story definition controls presentation; note frontmatter provides reusable place/content
metadata.

## 10. Obsidian view behavior

The plugin uses a file-backed `TextFileView`. Required behavior:

- StoryMap fills the full Workspace leaf content area (height forced to `100%`);
- the same file switches between StoryMap and Markdown views without changing source;
- commands/menu include `Open as Geo Story Map` and `Open as Markdown`, including the StoryMap
  pane menu;
- opening a detected `story-map: true` document shows the StoryMap view by default;
  `Open as Markdown` opts that file out until `Open as Geo Story Map` is invoked again;
- tab title follows the Markdown filename; split panes and pop-out windows keep working;
- `noteDisplay: link` registers a Page preview hover source and opens the note in a new tab;
- plugin settings provide defaults; changing them refreshes open views;
- invalid frontmatter or YAML produces an in-view error rather than breaking the workspace;
- React and Leaflet instances are destroyed cleanly on unload, and pane/container resize
  invalidates the Leaflet size.

Default-open is limited to detected `story-map: true` documents and uses a scoped
`WorkspaceLeaf.setViewState` wrapper. Blanket interception of unrelated Markdown files is
out of scope.

### 10.1 Inline `leaflet` blocks

The same plugin also renders a legacy `leaflet` fenced block inside ordinary Markdown
reading view, through `registerMarkdownCodeBlockProcessor('leaflet', ...)`. This is
independent of the StoryMap workspace view:

- a `leaflet` block mounts `<GeoMap />` with the block's `height`, never the forced
  `100%`, and never opens the full-leaf view;
- `markerFolder` resolves as a Vault-relative folder including subfolders, recursively;
- a discovered note becomes a marker when it has a valid `location`; notes without one are
  skipped, not fatal;
- note `mapmarker` selects a marker type through the documented precedence, and an unknown
  type still renders;
- `mapzoom`, when implemented in P1, becomes marker min/max zoom visibility;
- marker titles link through the platform resolver: Page preview on hover and open in a new
  tab on click, matching `noteDisplay: link`. The preview behavior is gated by the
  interaction setting;
- Shift-click on a marker copies `location: [lat, lng]` when that setting is enabled;
- settings are a versioned structure migrated from the current flat settings, and an
  optional importer copies durable Obsidian Leaflet settings (tiles, subdomains,
  attribution, marker types, tooltip behavior, note preview, copy-on-click, unit system,
  default center). It never imports mutable marker state, overlays, CSV data, map-view
  state, or the old config directory;
- the plugin has no runtime dependency on the community Obsidian Leaflet plugin;
- a `leaflet` block with unreadable configuration reports an in-block error rather than
  breaking the surrounding note, and diagnostics list recognized-but-unsupported keys.

### 10.2 AI coordinate lookup

The plugin adds a command-palette action `Find coordinates with AI`, available whenever a
Markdown note is active. It prompts for a place name (Chinese and other languages are
supported), asks a configured **local CLI agent** for ranked candidate places, and shows
the candidates in a modal with an interactive Leaflet mini-map.

- The agent invocation follows the existing local-AI workflow: spawn a desktop CLI without
  a shell, write the query as data on stdin, and parse per-agent output. Built-in agents are
  Codex, Claude Code, OpenCode and pi, plus a custom CLI.
- Agent executables, arguments, detection status and the default agent are device-local
  settings stored with `app.saveLocalStorage`. They are not `story-map` keys, plugin
  defaults, or vault data.
- Selecting a candidate enables `Update/Add frontmatter` and `Copy to clipboard`.
  `Update/Add frontmatter` writes `location: [lat, lng]` and the optional `mapmarker` to the
  active note through `FileManager.processFrontMatter`; `Copy to clipboard` copies the same
  `location: [lat, lng]` line for manual pasting.
- AI candidates are advisory: coordinates are only written after the user confirms one on
  the map, because models may return inaccurate coordinates for obscure places.
- The feature is desktop-only, matching the plugin's existing `isDesktopOnly`.

## 11. Docusaurus / Remark behavior

The Docusaurus path is a build-time adapter plus a browser runtime.

### 11.1 Build-time transform

For every `story-map` fenced block:

1. parse with `story-map-core`;
2. if `vaultRoot` exists, resolve explicit notes or `noteFolder`;
3. apply the same inheritance/order rules as Obsidian;
4. apply `noteDisplay`;
5. resolve local media into browser-facing URLs when possible;
6. serialize only normalized `StoryMapConfig`;
7. emit a `.story-map-host[data-story-map-config]` placeholder, adding
   `data-story-map-document="true"` when the source document has `story-map: true`.

For every `leaflet` fenced block, the same transform:

1. parses the block with the `leaflet` dialect parser, never the `storymap/v1` schema;
2. resolves `markerFolder` through the same `VaultIndex`, recursively, when `vaultRoot`
   exists;
3. turns each eligible note into a `GeoMarker` with `location`, `title`, `mapmarker`, and a
   published `notePath` from the host route resolver;
4. serializes only the normalized `GeoMapConfig`, including any diagnostics;
5. emits a `.story-map-host[data-story-map-config][data-story-map-kind="map"]` placeholder.
   A story host carries `data-story-map-kind="story"`.

No Leaflet map is created during the Node/SSR build, for either dialect.

### 11.2 Published note routes

`remark-story-map` accepts a host route callback:

```ts
interface RemarkStoryMapOptions {
  vaultRoot?: string;
  assetBase?: string;
  resolveNoteHref?: (vaultRelativePath: string) => string | undefined;
}
```

- StoryMap may ask the host to resolve a Vault-relative note;
- StoryMap must not duplicate Docusaurus slug/permalink logic;
- unresolved or ambiguous resolution leaves the title unlinked; the build does not invent a
  route;
- no absolute local filesystem path is serialized into the HTML.

For `kywk.github.io`, the existing content-link index / `deriveSlug()` pipeline is the
source of truth.

### 11.3 Source-relative media

Relative media is resolved against source context:

- the referenced note when media came from note frontmatter;
- the current StoryMap source document when media was explicitly authored on the slide.

`assetBase` rewrites the resolved Vault-relative asset path to a browser URL. Automatic
copying of Vault assets remains outside the package.

### 11.4 Filesystem scanning

`vaultRoot` may point at a repository that also contains Docusaurus tooling. Recursive
indexing skips dot-directories and `node_modules`, `build`, `dist`, and `coverage`. No
generic glob/ignore subsystem is introduced.

### 11.5 Browser runtime and SPA lifecycle

The browser entry mounts every host on the page, does not double-mount, works after
Docusaurus SPA navigation, unmounts React roots whose host nodes are removed, and keeps
Node APIs out of the browser bundle. It dynamically loads the renderer and client-heavy
dependencies only when a host exists; Leaflet remains dynamically imported by
`react-story-map`.

One client serves both dialects. It reads `data-story-map-kind` to decide between
`<StoryMap story={...} />` and `<GeoMap map={...} />`, and the Leaflet module is loaded at
most once for the page. A site may therefore delete its separate Leaflet bootstrap script
and its own remark Leaflet plugin once its existing blocks pass the Phase 1 fixtures,
without losing map behavior.

### 11.6 Theme bridge

The generic renderer owns six map/chrome themes and semantic `--story-map-*` CSS override
variables. `light` and `dark` are fixed, host-independent palettes; the `vintage`, `cyber`,
and `atlas` presets are coordinated author-look presets. `auto` is host-adaptive: the
renderer falls back to a `prefers-color-scheme` light/dark palette, and the Obsidian host
bridges it onto Obsidian's own theme variables. The Docusaurus host stylesheet offers an
opt-in Infima bridge for a host that deliberately wants to override the selected preset:

```css
.story-map-host.story-map-use-infima-colors {
  --story-map-bg: var(--ifm-background-surface-color);
  --story-map-fg: var(--ifm-font-color-base);
  --story-map-muted: var(--ifm-color-emphasis-700);
  --story-map-border: var(--ifm-color-emphasis-300);
  --story-map-accent: var(--ifm-color-primary);
}
```

Docusaurus/Infima variables are not hard-coded inside the generic React package. Dynamic
light/dark tile provider switching is not required; the selected built-in preset styles
the map tiles, markers, path, controls, and StoryMap-owned story surface together.

The Obsidian host bridges `auto` onto Obsidian's own theme variables (`--background-primary`,
`--text-normal`, `--text-muted`, `--background-modifier-border`, `--interactive-accent`, and
the marker/path accents) and follows Obsidian's `theme-dark`/`theme-light` class for the
tile filter. Switching Obsidian light/dark or a custom community theme therefore restyles an
`auto` StoryMap without per-document config, and it is the plugin's default `map.theme`. The
fixed/author-look presets keep their palettes, and an explicit host `--story-map-*` override
still takes precedence.

## 12. React API

```tsx
<StoryMap
  story={story}
  initialSlide={0}
  onSlideChange={(index, slide) => {}}
/>

<GeoMap map={geoMap} />
```

Behavior: Previous/Next buttons, Left/Right keyboard navigation, slide counter, active
slide `flyTo` that keeps the marker clear of the card/full/timeline overlay, a small circle
marker per located slide, an optional path polyline, responsive resize handling, a normal
`href` fallback for a resolved `slide.notePath` when platform callbacks are absent, and no
scroll mode. In `full` mode navigation floats over the container edges and the complete note
body scrolls beneath it. In `timeline` mode the row list replaces Previous/Next: a row click,
the arrow keys, or `initialSlide` select a slide, and the active row scrolls into view.

`<GeoMap />` is the storyless entry point: `height`, tile sources, center/zoom, and generic
markers with optional zoom visibility and tooltips. It has no slides, no panel, and no
layout modes. It accepts the same platform-neutral note-link callbacks as `StoryMap` and
falls back to a normal `href` when they are absent. Diagnostics passed on the config are the
caller's to surface; the renderer stays free of host error UI.

## 13. Acceptance criteria

Complete when all are true:

- `pnpm typecheck`, `pnpm test`, and `pnpm build` succeed;
- core parser tests cover `noteFolder`, `order`, `dateField`, and camelCase source config;
- a React app renders a two-slide StoryMap without platform-specific APIs;
- a `story-map: true` Markdown file opens as a full-leaf Obsidian StoryMap view and can
  switch back to Markdown without changing source content;
- Obsidian `noteFolder` recursively finds eligible `story-map-note: true` notes and sorts
  by `dateField` using `order: asc | desc` (default `date-created` ascending);
- `includeTags`/`excludeTags` filter folder-discovered notes identically in Obsidian and
  Remark, while explicit `slides` are unaffected;
- explicit `slides` are never reordered or appended to by `noteFolder`;
- a note may reuse Leaflet-compatible `location`, `mapmarker`, and `mapzoom`;
- the Obsidian plugin can look up coordinates with a configured local CLI agent, confirm a
  candidate on a map, and write the confirmed `location` to the active note;
- an explicit Obsidian slide can use `note: "[[Some Note]]"` and inherit
  `location/title/description/cover`;
- resizing an Obsidian pane keeps the map correctly sized, and closing/reopening or
  switching views does not leak React roots or Leaflet maps;
- Remark transforms the same `story-map` fence used by Obsidian;
- Remark `noteDisplay: basic` produces frontmatter-derived content only;
- Remark `noteDisplay: link` resolves a published route through `resolveNoteHref` and the
  renderer emits a normal browser link;
- Remark `noteDisplay: full` uses the frontmatter-stripped note body;
- note-relative and source-document-relative media resolve from the correct source context;
- ambiguous WikiLink basename resolution fails clearly rather than choosing silently;
- filesystem indexing skips `node_modules`, build output, and equivalent tool directories;
- generated HTML does not expose unnecessary absolute Vault paths;
- Docusaurus mounts multiple StoryMaps on one page;
- SPA navigation adds and removes StoryMap hosts without duplicate mounts or leaked React
  roots;
- Leaflet is never initialized during Node/SSR build;
- all built-in themes style map and StoryMap-owned chrome coherently;
- card alignment and optional ratios, full left/right placement and content ratio, and
  narrow-screen vertical fallback render without remounting Leaflet;
- the `timeline` layout renders every slide as a dated row whose click selects the slide, keeps
  the active marker clear of the column, and reuses `layout.full` options with no new key;
- Obsidian and Remark give a timeline the same slide dates, and a timeline honours the
  configured `noteDisplay` while `card` and `full` keep their existing behavior;
- a host can intentionally override semantic `--story-map-*` colors;
- the target `kywk.github.io` integration reuses its existing route/slug resolver;
- local-platform concerns stay outside `story-map-core` and `react-story-map`.

For the GeoMap and Leaflet compatibility work:

- the built-in tile URL is `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible
  attribution, CARTO is not the default, and tile providers stay configurable;
- `storymap/v1` and the published package APIs keep working unchanged;
- a `leaflet` fenced block renders in an ordinary Obsidian Markdown view, with
  `markerFolder` resolved recursively, and unrelated code blocks are unaffected;
- an inline `leaflet` block in Obsidian and a `leaflet` node in Docusaurus produce the same
  map: same center, zoom, tile source, markers, and titles;
- the four current `kywk.github.io` fixtures — Chile, Egypt, Kuala Lumpur, Xinjiang —
  render without source edits, including the repeated `chile-2509` id;
- an unknown `mapmarker` renders through the default marker type, and a
  recognized-but-unsupported key produces a diagnostic naming that key;
- `unit` and `scale` are accepted as compatibility metadata without a parse error;
- the browser client mounts `<StoryMap />` or `<GeoMap />` from the explicit discriminator,
  and one page initializes Leaflet only once;
- no Node API enters the browser bundle, and no Leaflet instance is created during SSR/build;
- Obsidian settings migrate to the versioned structure without losing current defaults;
- the compatibility matrix and `docs/architecture.md` describe implemented behavior only.

## 14. Deferred work

StoryMap:

- visual authoring/editor UI;
- multiple `noteFolder` sources;
- custom `sortBy`, secondary sorting, grouping, and filtering beyond the documented
  `includeTags`/`excludeTags` note filter;
- scrollama/scrollytelling mode;
- MapLibre adapter;
- `CRS.Simple`/gigapixel mode;
- marker-click-to-slide navigation;
- WikiLink/embed rendering inside `noteDisplay: full` Markdown body;
- automated copying of every Vault asset into Docusaurus static output;
- dynamic Docusaurus light/dark tile provider switching;
- a generic Docusaurus plugin or route framework;
- Markdown files outside the configured filesystem `vaultRoot`.

Leaflet compatibility, by phase. Every key below is still recorded in the compatibility
matrix and, where the parser recognizes it, produces a diagnostic naming it:

- **P1 static maps** — `markerFile`, inline `marker`, `markerTag`, `filterTag`, `linksTo`,
  `linksFrom`, `tileServer`, `tileSubdomains`, `osmLayer`, `zoomDelta`, `noUI`,
  `noScrollZoom`, static `lock`, `width`, and Leaflet `mapzoom` marker visibility;
- **P2 file layers** — GeoJSON and GeoJSON folders, GPX and GPX folders, GPX markers, tile
  overlays, image overlays, `showAllMarkers`, `zoomFeatures`, and overlay shapes;
- **P3 specialized** — image maps / `CRS.Simple` with `bounds`, `coordinates`,
  `preserveAspect`, and `scale` transforms; measurement and `distanceMultiplier`; draw
  mode; mutable marker persistence; CSV import/export;
- **not portable** — the old plugin's custom config directory, map-view persistence, Font
  Awesome layer composition, command markers, and Initiative Tracker integration, which stay
  host concerns or are dropped.
