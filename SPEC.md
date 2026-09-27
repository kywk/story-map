# StoryMap Specification

This is the product and architecture contract. `docs/architecture.md` describes how the
current code implements it.

## 1. Goal and scope

Build a small, reusable StoryMap stack centered on one standard `StoryMapConfig` model.
The product supports:

1. standalone React usage;
2. an Obsidian file-backed full-leaf StoryMap view;
3. Docusaurus/Remark publishing of the same Obsidian-oriented Markdown source;
4. Leaflet map navigation synchronized with paged story slides;
5. note discovery from one configured Vault folder and all of its subfolders.

The Obsidian view is the behavioral reference for note discovery, ordering, inheritance,
and `noteDisplay` semantics. The Docusaurus/Remark path implements the equivalent behavior
and defers route/slug policy to the host site.

Stay intentionally small. Do not add a visual editor, scroll-driven storytelling, MapLibre,
3D maps, GPX, GeoJSON editing, query languages, filtering/grouping beyond the documented
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
  center: [-33.4489, -70.6693]
  zoom: 5
  showPath: true
```
````

The Obsidian full-leaf view reads configuration from this fence. For Docusaurus, the
Remark plugin transforms the same fence at build time into a browser-safe serialized
`StoryMapConfig` placeholder; the browser runtime mounts the shared renderer after static
rendering.

Multiple configuration blocks in one Obsidian StoryMap document are out of scope. The
Remark transformer may mount multiple independent StoryMap hosts when multiple blocks occur
on an ordinary Docusaurus page.

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

## 4. Architecture

```text
Vault / Markdown / API
        |
        v
platform adapter / resolver
        |
        v
@story-map/story-map-core          (schema, parser, helpers)
        |
        v
standard StoryMapConfig
        |
        v
@story-map/react-story-map         (React + Leaflet UI)
```

Platform adapters:

```text
Obsidian Vault ----> obsidian-story-map --\
                                          ---> StoryMapConfig ---> react-story-map
Docusaurus build --> remark-story-map ----/
Standalone app ---------------------------/
```

The Obsidian adapter renders `react-story-map` as a dedicated file-backed workspace view.
Remark resolves the same source at build time, serializes only platform-neutral render
data, and mounts the same renderer in the browser. Route resolution, filesystem access,
Docusaurus URL policy, and theme bridging remain outside `react-story-map`.

## 5. Package responsibilities

### `story-map-core`

Owns types (`StoryMapConfig`, `StorySlide`, `StoryLocation`, `StoryMedia`), YAML
parsing/validation, source normalization and defaults (`noteFolder`, `order`, `dateField`,
`noteDisplay`), Leaflet-compatible key normalization, WikiLink reference parsing,
frontmatter stripping, location/media coercion, and deterministic note date sorting. Must
not import React, Leaflet, Obsidian, Docusaurus, or Node `fs`. Folder scanning, file
metadata, route resolution, and real asset resolution belong to adapters.

### `react-story-map`

Owns the `<StoryMap />` component, Leaflet instance lifecycle, paged navigation, `flyTo`
synchronization, markers and optional path, image/video/iframe media, Markdown text
rendering, resize handling (`invalidateSize()`), minimal responsive CSS, generic
note-title link rendering from a resolved `notePath`, and the semantic `--story-map-*` CSS
variables. Must remain SSR-import-safe: Leaflet is dynamically imported inside client
effects. Must not know what a Vault, WikiLink, frontmatter file, note folder, Obsidian
workspace, or Docusaurus route is.

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

The first plugin release targets desktop only. The declared minimum Obsidian version is
1.8.0; compatibility on that version must be verified before community submission.
Its community identity is `Geo Story Map` / `geo-story-map`; the source syntax and npm
package names remain unchanged.

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
  includeTags?: string[];        // keep notes with any listed tag
  excludeTags?: string[];        // drop notes with any listed tag

  map: {
    center?: [number, number];
    zoom: number;
    minZoom?: number;
    maxZoom?: number;
    tileUrl: string;
    attribution: string;
    showPath: boolean;
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
6. read the frontmatter field named by `dateField`;
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
- `full` — the same basics, with the frontmatter-stripped note body as slide text.

Rendering stays platform-neutral. Obsidian/Docusaurus-specific WikiLink or embed expansion
inside the body is not required.

### 6.4 Default precedence

Obsidian resolves source values in order: document block -> plugin settings -> built-in
defaults. Plugin settings expose defaults for `order`, `dateField`, `noteDisplay`, and the
`map` keys `zoom`, `minZoom`, `maxZoom`, `tileUrl`, `attribution`, `showPath`. Per-story
values — `schema`, `id`, `title`, `noteFolder`, `includeTags`, `excludeTags`, `map.center`,
`slides`, `height` — are document-only (`height` is forced to `100%` in the Obsidian
full-leaf host and remains
meaningful in standalone/Docusaurus hosts). Remark uses document values plus built-in
defaults; it does not duplicate the Obsidian settings UI. See `docs/architecture.md` for
the full defaults table.

## 7. Canonical render model

```ts
interface StoryMapConfig {
  schema: 'storymap/v1';
  id?: string;
  title?: string;
  height: string;
  map: {
    center?: [number, number];
    zoom: number;
    minZoom?: number;
    maxZoom?: number;
    tileUrl: string;
    attribution: string;
    showPath: boolean;
  };
  slides: StorySlide[];
}

interface StorySlide {
  id?: string;
  note?: string;       // adapter input; the renderer ignores unresolved references
  notePath?: string;   // adapter-resolved opaque or published reference for link display
  title?: string;
  text?: string;
  location?: { lat: number; lng: number; zoom?: number };
  media?: { type: 'image' | 'video' | 'iframe'; src: string; alt?: string; caption?: string };
  mapmarker?: string;
}
```

Accepted convenience forms: `location: [lat, lng]`; `media: ./image.jpg` as image media;
root-level Leaflet-like `lat`, `long`, `defaultZoom`, and `tileServer` normalized into map
fields.

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
- `mapmarker` and `mapzoom` are collected for compatibility; custom marker icons and
  advanced marker visibility are not required;
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

### 10.1 AI coordinate lookup

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

No Leaflet map is created during the Node/SSR build.

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

### 11.6 Theme bridge

The generic renderer owns semantic `--story-map-*` CSS variables. A Docusaurus host
stylesheet maps Infima variables onto them:

```css
.story-map-host {
  --story-map-bg: var(--ifm-background-surface-color);
  --story-map-fg: var(--ifm-font-color-base);
  --story-map-muted: var(--ifm-color-emphasis-700);
  --story-map-border: var(--ifm-color-emphasis-300);
  --story-map-accent: var(--ifm-color-primary);
}
```

Docusaurus/Infima variables are not hard-coded inside the generic React package except as
optional fallbacks. Dynamic light/dark tile provider switching is not required; the
required result is readable, theme-compatible StoryMap chrome/panel content.

## 12. React API

```tsx
<StoryMap
  story={story}
  initialSlide={0}
  onSlideChange={(index, slide) => {}}
/>
```

Behavior: Previous/Next buttons, Left/Right keyboard navigation, slide counter, active
slide `flyTo`, a small circle marker per located slide, an optional path polyline,
responsive resize handling, a normal `href` fallback for a resolved `slide.notePath` when
platform callbacks are absent, and no scroll mode.

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
- Docusaurus light/dark themes keep StoryMap UI readable through the host CSS bridge;
- the target `kywk.github.io` integration reuses its existing route/slug resolver;
- local-platform concerns stay outside `story-map-core` and `react-story-map`.

## 14. Deferred work

- visual authoring/editor UI;
- multiple `noteFolder` sources;
- custom `sortBy`, secondary sorting, grouping, and filtering beyond the documented
  `includeTags`/`excludeTags` note filter;
- scrollama/scrollytelling mode;
- MapLibre adapter;
- `CRS.Simple`/gigapixel mode;
- GeoJSON/GPX;
- advanced marker icon compatibility and Leaflet `mapzoom` visibility semantics;
- marker popup parity with the older Docusaurus Leaflet plugin;
- marker-click-to-slide navigation;
- WikiLink/embed rendering inside `noteDisplay: full` Markdown body;
- automated copying of every Vault asset into Docusaurus static output;
- dynamic Docusaurus light/dark tile provider switching;
- a generic Docusaurus plugin or route framework;
- Markdown files outside the configured filesystem `vaultRoot`.
