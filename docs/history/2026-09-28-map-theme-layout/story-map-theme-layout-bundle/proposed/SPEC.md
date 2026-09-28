# StoryMap Specification

This is the product and architecture contract. `docs/architecture.md` describes how the
current code implements it.

## 1. Goal and scope

StoryMap is a small, reusable geographic presentation stack centered on one standard
`StoryMapConfig` model.

It supports:

1. standalone React usage;
2. an Obsidian file-backed full-leaf StoryMap view;
3. Docusaurus/Remark publishing from the same Obsidian-oriented Markdown source;
4. Leaflet map navigation synchronized with paged story slides;
5. note discovery from one configured Vault folder and its subfolders;
6. coherent built-in visual themes for the map and StoryMap-owned chrome;
7. multiple story/map layout modes without changing the underlying Markdown content model.

Markdown remains the content source of truth. StoryMap is an alternate geographic
presentation of Markdown notes, not a CMS, replacement article renderer, or independent
article-theme system.

The Obsidian view remains the behavioral reference for note discovery, ordering,
inheritance, and `noteDisplay` semantics. Docusaurus/Remark implements equivalent content
resolution while route/slug policy stays host-owned.

Stay intentionally small. Do not add a visual editor, scroll-driven storytelling,
MapLibre, 3D maps, GPX, GeoJSON editing, generic query/group/filter syntax, or a public
theme/layout plugin framework unless separately approved.

## 2. Source document model

### 2.1 StoryMap document

A normal Markdown file with `story-map: true` frontmatter and one `story-map` fenced block:

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

map:
  theme: vintage
  center: [-33.4489, -70.6693]
  zoom: 5
  showPath: true

layout:
  mode: full
  full:
    side: left
    contentRatio: 0.52
```
````

The Obsidian full-leaf view reads configuration from this fence. Remark transforms the
same fence at build time into a browser-safe serialized `StoryMapConfig`; the browser uses
the shared React renderer.

Multiple StoryMap configuration blocks in one Obsidian StoryMap document are out of scope.
Remark may mount multiple independent StoryMaps when multiple blocks occur on an ordinary
Docusaurus page.

### 2.2 StoryMap note

A folder-discovered note is a normal Markdown file with reusable frontmatter:

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

StoryMap reuses Leaflet-compatible geographic metadata instead of introducing a second
coordinate schema. `story-map-note: true` is required only for automatic `noteFolder`
discovery; an explicit `slide.note` reference does not require it.

## 3. Naming conventions

StoryMap configuration keys are camelCase. Frontmatter role flags stay kebab-case
(`story-map`, `story-map-note`).

Important public keys include:

- `noteFolder`
- `dateField`
- `noteDisplay`
- `map.theme`
- `map.showPath`
- `map.tileUrl`
- `layout.mode`
- `layout.card.widthRatio`
- `layout.full.contentRatio`

Configured frontmatter field names such as the default `date-created` are values, not
StoryMap keys.

## 4. Product model: content, theme, and layout

StoryMap has three distinct concerns:

```text
Markdown content
    +
StoryMap theme
    +
StoryMap layout mode
```

### 4.1 Markdown content

Markdown owns story/article content and semantic structure. StoryMap does not invent a
second story document format.

### 4.2 StoryMap theme

There is one built-in theme selector:

```yaml
map:
  theme: light
```

The selected theme defines a coherent visual language for:

- base-map treatment;
- markers and active marker;
- path;
- Leaflet controls and attribution;
- StoryMap-owned story surface;
- StoryMap foreground/muted/border/accent tokens;
- controls/navigation chrome;
- full-layout gradient/fade treatment.

The selected theme does **not** own host typography semantics such as heading hierarchy,
blockquote/code/table design, WikiLink parsing, or page-level article styling.

There is no independent "story theme".

### 4.3 Layout mode

Layout controls how the StoryMap-owned story presentation and map share the StoryMap
viewport. Layout does not change note resolution, slide order, or navigation semantics.

Initial modes:

- `card` — floating story card over a full-bleed map;
- `full` — editorial full-bleed map with a large story surface fading into the map.

Layout is authored in the document and is not overridden by platform settings in v1.

## 5. Architecture

```text
Vault / Markdown / API
        |
        v
platform adapter / resolver
        |
        v
@story-map/story-map-core
(schema, parser, defaults, pure helpers)
        |
        v
standard StoryMapConfig
        |
        v
@story-map/react-story-map
(Leaflet + theme + layout + story presentation)
```

Platform adapters:

```text
Obsidian Vault ----> obsidian-story-map --\
                                          ---> StoryMapConfig ---> react-story-map
Docusaurus build --> remark-story-map ----/
Standalone app ---------------------------/
```

Platform-specific concerns remain outside the shared renderer:

- Vault/filesystem access;
- route/slug policy;
- note discovery;
- local asset resolution;
- Obsidian navigation callbacks.

Theme presets and layout rendering belong to `react-story-map` because they are
platform-neutral presentation behavior.

## 6. Package responsibilities

### `story-map-core`

Owns:

- public types;
- Zod schemas;
- YAML parsing/validation;
- source normalization;
- built-in defaults;
- source-default precedence;
- note metadata helpers;
- deterministic sorting.

It may define theme/layout enums and numeric validation but must not define colors, CSS,
Leaflet style objects, responsive presentation behavior, or platform APIs.

### `react-story-map`

Owns:

- `<StoryMap />`;
- Leaflet lifecycle;
- map canvas;
- markers/path;
- active slide synchronization;
- media and Markdown rendering;
- paged navigation;
- built-in theme presets;
- StoryMap-owned theme tokens;
- card/full layout rendering;
- responsive layout behavior;
- resize handling;
- generic `notePath` link behavior.

It must remain SSR-import-safe and must not import Obsidian, Docusaurus, or Node APIs.

The map canvas should remain structurally stable while layout mode changes. Layout modes
operate through a presentation boundary rather than moving Leaflet between unrelated DOM
trees.

### `obsidian-story-map`

Owns:

- file-backed `TextFileView`;
- `story-map: true` detection;
- StoryMap/Markdown switching;
- noteFolder discovery;
- explicit note resolution;
- `noteDisplay`;
- Vault/local media resolution;
- plugin default settings;
- React lifecycle.

Obsidian may expose a default `map.theme`. It must not expose layout defaults in v1.

### `remark-story-map`

Owns:

- build-time fenced-block transform;
- optional filesystem Vault indexing;
- note resolution;
- source-relative media;
- host route resolver;
- canonical config serialization;
- browser mount/unmount behavior.

It must not duplicate theme or layout rendering logic.

## 7. Story source configuration v1

```ts
type StoryMapTheme =
  | 'light'
  | 'dark'
  | 'vintage'
  | 'cyber'
  | 'atlas';

type StoryMapLayoutMode = 'card' | 'full';

interface StoryMapSourceConfig {
  schema: 'storymap/v1';
  id?: string;
  title?: string;
  height: string;

  noteFolder?: string;
  order: 'asc' | 'desc';
  dateField: string;
  noteDisplay: 'basic' | 'link' | 'full';

  map: {
    center?: [number, number];
    zoom: number;
    minZoom?: number;
    maxZoom?: number;
    theme: StoryMapTheme;
    tileUrl: string;
    attribution: string;
    showPath: boolean;
  };

  layout: {
    mode: StoryMapLayoutMode;
    card: {
      align: 'left' | 'center' | 'right';
      widthRatio?: number;
      heightRatio?: number;
    };
    full: {
      side: 'left' | 'right';
      contentRatio: number;
    };
  };

  slides?: StorySlide[];
}
```

`noteFolder` is a Vault-relative folder and includes nested subfolders. Only one
`noteFolder` is supported.

## 8. Theme contract

### 8.1 Built-in themes

The renderer provides:

- `light` — clean modern light presentation;
- `dark` — dark restrained navigation presentation;
- `vintage` — warm, aged travel-map presentation;
- `cyber` — cool modern sci-fi/HUD-inspired presentation;
- `atlas` — classic formal printed-cartography presentation.

Default:

```text
light
```

### 8.2 Theme and tile provider independence

A theme does not select or require a tile provider.

These remain independent:

```yaml
map:
  theme: cyber
  tileUrl: https://example.test/{z}/{x}/{y}.png
  attribution: Example Maps
```

Theme implementation may use tile-layer-only visual filters, but it must never apply a
filter to the whole StoryMap DOM tree.

### 8.3 Semantic CSS variables

Existing host-overridable semantic variables remain supported, including:

```css
--story-map-bg
--story-map-fg
--story-map-muted
--story-map-border
--story-map-accent
```

Precedence:

```text
explicit host semantic override
> built-in theme token
> hard-coded safe fallback
```

Because host overrides may intentionally break theme coherence, built-in examples must not
automatically map host light/dark colors over StoryMap themes. In particular, Docusaurus
must not automatically override a selected StoryMap theme with Infima surface colors.

## 9. Layout contract

### 9.1 Default layout

Default:

```yaml
layout:
  mode: card
```

This preserves existing documents.

### 9.2 Card mode

```yaml
layout:
  mode: card
  card:
    align: left
    widthRatio: 0.34
    heightRatio: 0.72
```

Rules:

- `align`: `left | center | right`, default `left`;
- `widthRatio`: optional, valid `0.20..0.80`;
- `heightRatio`: optional, valid `0.20..0.95`.

When ratios are omitted, the current card width and content-driven height/max-height
behavior remain the regression target.

On narrow viewports the renderer may clamp ratios and alignment to preserve usability and
prevent horizontal overflow.

### 9.3 Full mode

```yaml
layout:
  mode: full
  full:
    side: left
    contentRatio: 0.50
```

Rules:

- `side`: `left | right`, default `left`;
- `contentRatio`: valid `0.30..0.70`, default `0.50`.

The map remains full-bleed. The story presentation layer covers the selected side and
transitions progressively to transparent toward the map. The fade/overlap width is
theme-owned and not configurable in v1.

On narrow viewports the renderer converts the transition to a vertical composition while
retaining map context and readable story content.

### 9.4 Future layout extensibility

The renderer must implement an internal layout dispatch boundary, conceptually:

```ts
const layoutRenderers = {
  card: CardLayout,
  full: FullLayout,
} satisfies Record<StoryMapLayoutMode, LayoutRenderer>;
```

Future modes add a renderer behind this boundary. Do not expose a public
`registerLayout()` plugin API in v1.

## 10. Explicit and folder-generated slides

### 10.1 Explicit slides

When `slides` is present and non-empty:

- sequence exactly matches source order;
- `noteFolder` does not append discovered slides;
- `order`/`dateField` do not reorder explicit slides;
- explicit `slide.note` resolves normally;
- explicit slide properties override note-derived values.

### 10.2 Folder-generated slides

When `slides` is absent/empty and `noteFolder` is set:

1. recursively scan the folder;
2. consider Markdown files only;
3. include only `story-map-note: true`;
4. read the configured `dateField`;
5. sort valid dates using `order`;
6. produce one slide per note.

Invalid/missing dates remain after valid dates. Ties use Vault-relative path ascending in
both order directions.

## 11. Note display

`noteDisplay` controls how a resolved note contributes to StoryMap story content:

- `basic` — frontmatter basics only;
- `link` — basics plus resolved `notePath`;
- `full` — basics plus frontmatter-stripped note body.

Obsidian may use callbacks for Page Preview/open behavior. Docusaurus uses a resolved
published route as a normal link. Rendering remains platform-neutral.

`noteDisplay: full` is unrelated to `layout.mode: full`.

## 12. Default precedence

Obsidian source values resolve:

```text
document block -> plugin setting -> built-in default
```

Plugin-defaultable keys:

- `order`
- `dateField`
- `noteDisplay`
- `map.zoom`
- `map.minZoom`
- `map.maxZoom`
- `map.theme`
- `map.tileUrl`
- `map.attribution`
- `map.showPath`

Document-only keys:

- `schema`
- `id`
- `title`
- `noteFolder`
- `height`
- `map.center`
- `layout.*`
- `slides`

`height` remains forced to `100%` in the Obsidian full-leaf host.

Remark uses document values plus built-in defaults and does not duplicate Obsidian
settings.

## 13. Canonical render model

```ts
interface StoryMapConfig {
  schema: 'storymap/v1';
  id?: string;
  title?: string;
  height: string;
  map: StoryMapOptions;
  layout: StoryMapLayoutOptions;
  slides: StorySlide[];
}

interface StorySlide {
  id?: string;
  note?: string;
  notePath?: string;
  title?: string;
  text?: string;
  location?: { lat: number; lng: number; zoom?: number };
  media?: {
    type: 'image' | 'video' | 'iframe';
    src: string;
    alt?: string;
    caption?: string;
  };
  mapmarker?: string;
}
```

Accepted convenience forms remain:

- `location: [lat, lng]`;
- comma-separated locations;
- string image media;
- root Leaflet-like `lat`, `long`/`lng`, `defaultZoom`, and `tileServer`.

## 14. Note metadata and resolution precedence

Recognized note metadata includes:

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

Resolution precedence remains:

```text
explicit slide value
> resolved note/frontmatter value
> story/map default
```

## 15. Obsidian behavior

Required behavior remains:

- full workspace-leaf StoryMap;
- same file switches between StoryMap and Markdown without source changes;
- detected `story-map: true` files default-open as StoryMap unless explicitly opted out;
- note title behavior for `noteDisplay: link`;
- settings refresh open views;
- invalid configuration renders an in-view error;
- React/Leaflet cleanup is correct;
- pane resize invalidates Leaflet size.

Theme setting requirement:

```text
Default map theme:
Light / Dark / Vintage / Cyber / Atlas
```

Layout remains document-owned.

## 16. Docusaurus / Remark behavior

For each StoryMap fence:

1. parse with core;
2. optionally resolve Vault notes;
3. apply ordering/inheritance/display rules;
4. resolve media;
5. serialize canonical `StoryMapConfig`;
6. emit the host placeholder;
7. browser client mounts the shared renderer.

No Leaflet initialization occurs during SSR/build.

Docusaurus route rules remain host-owned through `resolveNoteHref`.

A host may explicitly override semantic StoryMap CSS variables, but built-in examples must
not automatically overwrite theme colors with Infima colors.

A full-page site shell (Open as Story Map / Markdown toggle) remains host UI and is separate
from `layout.mode: full`. The former changes surrounding Docusaurus page chrome; the latter
changes the internal StoryMap story/map composition.

## 17. React API

```tsx
<StoryMap
  story={story}
  initialSlide={0}
  onSlideChange={(index, slide) => {}}
/>
```

Behavior remains:

- Previous/Next;
- Left/Right keyboard navigation;
- counter;
- active-slide `flyTo`;
- marker/path rendering;
- normal `href` fallback for resolved `notePath`;
- responsive resize handling.

Layout mode does not alter navigation semantics in this milestone.

## 18. Acceptance criteria

Complete when all existing acceptance criteria still pass and:

- five built-in themes are accepted and invalid themes fail clearly;
- `light` is the default;
- selected theme styles both map and StoryMap-owned story chrome coherently;
- themes do not imply a tile provider;
- card is the default layout;
- card without ratio overrides preserves current behavior;
- card supports left/center/right;
- card width/height ratios validate and render responsively;
- full supports left/right;
- full `contentRatio` controls story/map balance;
- full uses a theme-coherent progressive fade;
- narrow full mode uses a usable vertical transition;
- layout changes do not duplicate or leak Leaflet instances;
- Obsidian default theme obeys document > setting > built-in precedence;
- Obsidian does not override layout;
- Remark serializes theme/layout without renderer-specific branching;
- Docusaurus automatic Infima overrides no longer defeat a selected StoryMap theme;
- explicit `--story-map-*` overrides still work;
- `pnpm typecheck`, `pnpm test`, and `pnpm build` succeed.

## 19. Deferred work

- visual authoring/editor UI;
- user-defined theme JSON;
- theme marketplace/plugin registry;
- per-slide theme/layout;
- additional layout modes beyond card/full;
- scroll-driven/scrollytelling mode;
- multiple note folders;
- generic sorting/grouping/filtering/query syntax;
- MapLibre adapter;
- `CRS.Simple`/gigapixel;
- GeoJSON/GPX;
- advanced marker icon/mapzoom visibility compatibility;
- marker-click-to-slide navigation;
- WikiLink/embed expansion in full note bodies;
- automatic Vault asset copying;
- dynamic host-light/dark automatic theme switching;
- tile-provider registry;
- generic Docusaurus route framework.
