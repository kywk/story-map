# AGENTS.md

## Mission

Deliver the StoryMap product described in `SPEC.md`: one Leaflet runtime that serves both
storytelling and ordinary maps. Three hosts share one `StoryMapConfig` — standalone React,
the Obsidian file-backed view (behavioral reference), and the Docusaurus/Remark publishing
path — and a generic `GeoMapConfig` layer sits underneath them all so a legacy `leaflet`
fenced block renders through the same renderer.

The current task intentionally expands beyond the original MVP. Two things are new
authority here and override older non-goals:

1. a generic `GeoMap` layer, with `StoryMap` composing it rather than duplicating Leaflet
   lifecycle code;
2. `leaflet` fenced-block compatibility in both Obsidian and Docusaurus/Remark, phased as
   P0/P1 static maps, P2 file layers, and P3 image/drawing/mutable state.

Everything else from the MVP is stable. Do not expand scope beyond this.

## Source of truth

1. `SPEC.md` — product and architecture contract.
2. `docs/architecture.md` — how the current code is structured; read this to work without
   re-reading every source file.
3. Existing package APIs and tests in this repository.

If a task conflicts with `SPEC.md`, update the implementation to match the spec rather than
inventing a new architecture. Update the docs when behavior changes (see "Documentation
hygiene").

## Current source conventions

- StoryMap document frontmatter: `story-map: true`.
- StoryMap note discovery frontmatter: `story-map-note: true`.
- StoryMap fenced language: `story-map`.
- Legacy Obsidian Leaflet fenced language: `leaflet`. It is a second, separate input
  dialect with its own parser. Never route it through the `story-map` Zod schema, and never
  represent a non-story map as fake Story slides.
- `story-map` config keys are camelCase. `leaflet` keys keep their historical spelling
  (`lat`, `long`, `defaultZoom`, `minZoom`, `markerFolder`, `mapmarker`) because existing
  content already uses them and Phase 1 must render it without source edits.
- `noteFolder` supports one Vault-relative folder and includes subfolders recursively.
- Folder-generated slide order is controlled only by `order: asc | desc` (default `asc`)
  and `dateField` (default `date-created`).
- Folder-generated slide selection is optionally filtered by `includeTags` (keep notes with
  any listed tag) and `excludeTags` (drop notes with any listed tag). Matching is any-of,
  case-insensitive, tag-prefix and whitespace tolerant, and uses note frontmatter tags only
  (`tags`/`tag`, string or list) so Obsidian and Remark select the same notes. Nested tags
  match exactly; no wildcard or parent matching. Inline `#tag` body syntax is ignored.
- Explicit `slides` preserve exact author order and are never implicitly appended to or
  reordered by folder discovery. When `slides` is non-empty, `noteFolder` is ignored.
- Reuse Leaflet-compatible note metadata such as `location`, `mapmarker`, and `mapzoom`.
  `mapzoom: [min, max]` is now a scheduled real capability, not deferred collection: it
  normalizes into marker min/max zoom visibility. It is metadata that only matters for a
  `leaflet` host; a StoryMap slide's own `location.zoom` still drives `flyTo`.
- Note presentation is controlled by `noteDisplay: basic | link | full`, default `link`:
  `basic` uses frontmatter metadata only; `link` resolves a slide-title link; `full` uses
  the frontmatter-stripped note body as slide text and drops frontmatter title/media/date.
  Only the `full` LAYOUT forces full note display regardless of the configured
  `noteDisplay`; that override lives in `story-map-core` and both adapters must use it.
  `timeline` honors the configured `noteDisplay`, so both adapters keep the frontmatter
  basics next to the body when the display is `full` and the layout is `timeline`
  (`noteDisplay === 'full' && layoutMode !== 'timeline'`).
- `StorySlide.date` is epoch-millisecond slide data, normalized by the core parser and filled
  by both adapters from the existing `dateField` frontmatter value; an authored slide `date`
  wins through `mergeResolvedSlide`. It is document data, never a plugin setting or a
  defaultable key, and the timeline layout is its only consumer.
- `link` is platform-specific only at navigation time: Obsidian supplies callbacks (Page
  preview on hover, open in new tab on click); Docusaurus resolves the final published
  route and the renderer emits a normal browser link. `react-story-map` must not import
  Obsidian or Docusaurus APIs.
- Defaultable `story-map` keys (Obsidian plugin settings): `order`, `dateField`,
  `noteDisplay`, `initialSlide`, `panelOpacity`, and `map.theme`, `map.zoom`, `map.minZoom`, `map.maxZoom`, `map.tileUrl`,
  `map.attribution`, `map.showPath`. Keys that vary per document — `schema`, `id`, `title`,
  `noteFolder`, `includeTags`, `excludeTags`, `map.center`, `layout`, `slides`, `height` — must stay
  document-only and must not be added to plugin settings or defaults. Resolution order for
  defaultable keys is always:
  1. the key present in the document's `story-map` block;
  2. otherwise the plugin setting;
  3. otherwise the built-in code default.
  (`height` is forced to `100%` in the Obsidian full-leaf host; Remark uses document values
  plus built-in defaults and does not mirror the Obsidian settings UI.)
- Defaultable keys are per-dialect and must not leak across them. The list above is the
  `story-map` dialect only. A `leaflet` block resolves: fenced-block key -> Leaflet
  compatibility plugin setting -> built-in compatibility default. In particular a
  Leaflet-only `defaultCenter`, marker registry, tooltip default, or unit system must never
  be applied to a native StoryMap, and a StoryMap setting must never be assumed to exist for
  a `leaflet` block.
- Obsidian settings migrate to a versioned structure (`version: 2`) with `story`, `map`,
  `markers`, `interaction`, and `leafletCompatibility` sections. Device-local AI agent
  settings stay separate and keep using `app.saveLocalStorage`. Do not recreate the old
  plugin's mutable-marker store, custom config directory, or map-view persistence.
- When adding or changing a defaultable key, add it to the `story-map-core` schema and
  `applySourceDefaults`, to `packages/obsidian-story-map/src/settings-data.ts`, expose it in
  `settings-tab.ts`, and cover the precedence in `story-map-core` parser tests. Do not
  re-implement defaulting in the view; use `parseStoryMapSourceYaml(source, defaults)`.
- Local AI agent settings (executables, arguments, default agent, detection) are device-local
  (`app.saveLocalStorage`) and are never `story-map` keys, plugin defaults, or vault data.
  The AI coordinate lookup writes `location: [lat, lng]` and the optional `mapmarker` to the
  active note only after the user confirms a candidate on the map; it is desktop-only and
  stays inside `obsidian-story-map`.

## Docusaurus / Remark rules

- Docusaurus route/slug rules are host-owned. Use the `resolveNoteHref` hook; do not add
  StoryMap-specific slug normalization. In the target `kywk.github.io` site,
  `scripts/content-links.js` / `remark-slug-normalizer` is the route authority.
- `vaultRoot` scanning must skip dot-directories, `node_modules`, `build`, `dist`, and
  `coverage`.
- Relative media uses source context: note-derived media resolves relative to the note;
  explicit slide media resolves relative to the StoryMap source document.
- The browser client must handle Docusaurus SPA insertion/removal without duplicate mounts
  or leaked React roots.
- Built-in `map.theme` values are `auto`, `light`, `dark`, `vintage`, `cyber`, and
  `atlas`. `light`/`dark` are fixed, host-independent palettes; `auto` follows the host
  (the Obsidian host bridges it to native CSS variables and the `theme-dark`/`theme-light`
  tile filter, other hosts use `prefers-color-scheme`); `vintage`/`cyber`/`atlas` keep
  authored palettes. The renderer styles map and StoryMap chrome together; inherited
  `--story-map-*` variables are explicit host overrides. The Docusaurus Infima bridge is
  opt-in, and the Obsidian plugin defaults `map.theme` to `auto`.
- `layout` is document-only: `card` (default), `full`, or `timeline`. The renderer owns all
  three modes; Obsidian and Remark pass the canonical config through. `timeline` reuses
  `layout.full.side` and `layout.full.contentRatio`; there is no `layout.timeline` block.
- Map theme and tile provider are orthogonal. A theme is presentation (markers, path,
  controls, story chrome); a tile source is map data. Never encode provider selection into a
  theme name, and never let a theme silently replace a configured `tileUrl`.
- The built-in tile source is `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible
  attribution, exported as `DEFAULT_TILE_URL` / `DEFAULT_TILE_ATTRIBUTION`. CARTO Basemaps
  is never the default because it now requires an API key. Markdown and generated HTML are
  public source: never model a provider API key as a secret inside a fenced block, and
  never serialize one as if it were private. A browser-delivered key is a public
  client credential that must be provider-restricted and configured on the host.

## Leaflet compatibility rules

- A `leaflet` block and a `story-map` block are two dialects with two parsers. Only the
  `leaflet` parser may accept historical repeated keys for repeatable keys (for example two
  `markerFolder:` lines) where a plain YAML load would drop the duplicate.
- Never silently ignore authored configuration. A recognized key that is not implemented
  must produce a `GeoMapDiagnostic` naming the key, and the compatibility matrix must be
  updated to the real state. Unsupported is not the same as unimplemented-and-unreported.
- Phase 1 (P0) covers the four current `kywk.github.io` fixtures — Chile, Egypt, Kuala
  Lumpur, Xinjiang — which use only `id`, `height`, `lat`, `long`, `minZoom`, `maxZoom`,
  `defaultZoom`, `unit`, `scale`, `darkMode`, and `markerFolder`. `unit`/`scale` are
  accepted as compatibility metadata for measurement tooling that does not exist yet; they
  must not raise a parse error.
- P1 is common static-map behavior: `markerFile`, inline `marker`, `markerTag`,
  `filterTag`, `linksTo`, `linksFrom`, `mapzoom` visibility, `tileServer`,
  `tileSubdomains`, `osmLayer`, `zoomDelta`, `noUI`, `noScrollZoom`, and static `lock`.
  P2 is file layers (GeoJSON, GPX, tile/image overlays). P3 is image maps, drawing, and
  mutable marker state. Do not let P2/P3 work block P0, and do not silently expand into them.
- Duplicate authored `id` values are allowed and must not collide at runtime. Host instance
  identity is separate from the authored map id; do not rename what the user wrote.
- Font Awesome is not a cross-platform contract. Marker types carry a portable symbol or
  image, and an unknown or unimportable type falls back visually while preserving the
  authored name.

## Non-goals

Do not introduce unless explicitly requested:

- Nx, Turborepo, Bazel, changesets, semantic-release;
- Redux/Zustand, React Leaflet, MapLibre;
- visual editors, scroll-driven storytelling, a generic plugin framework;
- premature abstraction for multiple map engines;
- a fifth package just for compatibility — extend the existing four;
- multiple `noteFolder` sources;
- a generic public theme or layout registration API;
- generic `sortBy`, grouping, or query syntax, or filtering beyond
  `includeTags`/`excludeTags`;
- a generic route/slug framework;
- automatic full Markdown-open interception through `WorkspaceLeaf` monkey patches (a
  scoped `setViewState` wrapper may still open detected `story-map: true` documents in the
  StoryMap view by default);
- cloning the old plugin's mutable-marker CSV store, custom config directory, map-view
  persistence, or Font Awesome layer composition;
- command-marker and Initiative Tracker integrations inside the portable GeoMap layer;
- WikiLink/embed expansion inside `noteDisplay: full` Markdown.

A future map adapter can be added later. The renderer still directly owns the Leaflet
lifecycle inside `react-story-map`; the refactor moves that lifecycle into a shared
`GeoMap`, not into another abstraction.

## Package boundaries

- `packages/story-map-core` — framework agnostic; no DOM, React, Leaflet, Obsidian,
  Docusaurus, or Node filesystem dependencies; schema, parsing, defaults, pure helpers; no
  folder scanning or file reads. Also owns the `GeoMapConfig` / `GeoMapOptions` /
  `TileSource` / `GeoMarker` / diagnostic types, the dedicated `leaflet` dialect parser
  (including historical repeated keys), marker-type resolution, and pure `mapzoom`
  coercion.
- `packages/react-story-map` — owns UI and Leaflet rendering, semantic CSS variables, and
  generic note-link rendering from a resolved `notePath`; SSR-import-safe (Leaflet is
  dynamically imported inside client effects only); no Obsidian/Docusaurus/Node APIs; no
  knowledge of `noteFolder`, Vault scanning, or slug rules. Also owns the exported
  `<GeoMap />` primitive plus the shared Leaflet lifecycle, tile sources, generic markers,
  and zoom visibility; `StoryMap` composes it instead of owning Leaflet directly.
- `packages/obsidian-story-map` — Obsidian APIs allowed; file-backed `TextFileView`; parses
  the fence; resolves Vault content and `noteFolder`; passes a standard `StoryMapConfig` to
  the renderer; supports Markdown <-> StoryMap switching; opens detected documents in the
  StoryMap view by default via a scoped `setViewState` wrapper; must not intercept unrelated
  Markdown opens. Also owns `registerMarkdownCodeBlockProcessor('leaflet', ...)`, recursive
  `markerFolder` resolution, the versioned settings migration, and the optional
  Obsidian Leaflet settings importer. No runtime dependency on the community Leaflet plugin.
- `packages/remark-story-map` — build-time entry (`index.ts`, `vault.ts`) may use Node
  `fs`; browser entry (`client.tsx`) must not and lazy-loads the renderer; never initializes
  Leaflet during build; resolves notes, ordering, `noteDisplay`, routes, and media into
  `StoryMapConfig`; does not own slug policy. Also transforms `leaflet` code nodes into map
  hosts and mounts `StoryMap` or `GeoMap` from one explicit discriminator in one client
  lifecycle, so a page never boots two Leaflet runtimes.

See `docs/architecture.md` for the file-level map and public APIs.

## Collaboration rules

- each agent owns one package directory;
- avoid editing root config unless assigned as integrator;
- the PM/integrator owns the shared public `GeoMapConfig` / `GeoMapOptions` / `TileSource` /
  `GeoMarker` / diagnostic contracts. Multiple agents must not independently redesign public
  types; the core agent implements them once, and other agents consume them;
- do not rename shared public types without coordinating consumers;
- keep `storymap/v1` source-compatible. Do not break the published 0.3.x/0.4.x APIs casually;
  if a canonical public StoryMap schema must change, raise it as a separate versioned
  schema and semver decision;
- prefer small commits grouped by package responsibility;
- add focused tests for parser/normalization/order/display logic before expanding behavior;
- integration fixes belong to the integrator after package work is complete;
- do not expand sorting beyond `order` + `dateField`;
- do not mark a deferred Leaflet feature implemented unless it is tested end to end.

## Documentation hygiene

- Keep `README.md`, `SPEC.md`, and `AGENTS.md` short and current; implementation detail goes
  in `docs/architecture.md`.
- Archive completed plans under `docs/history/<YYYY-MM-DD>-<slug>/`; delete
  development-process notes once their work is merged.
- When behavior changes, update the matching doc in the same change.
- The repeatable workflow lives in the `docs-maintenance` skill at
  `.agents/skills/docs-maintenance/SKILL.md`.

## Definition of done

Before claiming completion:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Then manually smoke-test:

1. standalone React rendering;
2. Obsidian full-leaf StoryMap view lifecycle and Markdown <-> StoryMap switching;
3. recursive `noteFolder` discovery and `dateField` ordering in both directions, with the
   dates visible in a timeline;
4. explicit slide ordering unaffected by folder settings, including an authored `date`;
5. split-pane resize/Leaflet invalidation;
6. Remark transform output, including `noteDisplay` basic/link/full;
7. source-relative and note-relative media;
8. multiple StoryMaps on one page and clean SPA host removal;
9. Docusaurus SSR/build never initializes Leaflet;
10. the built-in themes in card/full/timeline modes, card alignment and ratios, full
    left/right ratios, the timeline column in both `side` values, narrow-screen vertical
    fallback, and a stable Leaflet instance while switching;
11. the Docusaurus Infima override bridge remains opt-in and readable when applied;
12. timeline specifics: one row per slide with an `Apr 12, 2024`-style date chip (none for a
    dateless slide), an image-only thumbnail, a two-line clamped description, and a note chip
    that keeps Obsidian page preview and open-in-new-tab; a row click and the arrow keys both
    `flyTo` the map; the active row auto-scrolls into view and its spine node fills; there are
    no previous/next controls; and an authored unparseable `date` reports a readable
    in-view configuration error.

And, for the Leaflet compatibility work:

13. a `leaflet` fenced block renders inside an ordinary Obsidian Markdown view, with
    `markerFolder` resolved recursively and markers linked through the platform note
    resolver; unrelated code blocks are unaffected;
14. Remark transforms both `story-map` and `leaflet` nodes into hosts carrying an explicit
    `story` / `map` discriminator, and the one browser client mounts the matching renderer
    without duplicate Leaflet initialization;
15. the four current `kywk.github.io` fixtures — Chile, Egypt, Kuala Lumpur, Xinjiang —
    render without source edits, including the Xinjiang block that reuses the `chile-2509`
    id;
16. an unknown `mapmarker` value still renders a marker through the default type, and
    recognized-but-unsupported keys surface a diagnostic rather than disappearing;
17. `mapmarker` zoom visibility from `mapzoom` works once implemented in P1, and is covered
    by tests before being called done;
18. the built-in tile URL is `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible
    attribution, CARTO is not the default, and no key-like value is treated as a secret in
    Markdown or serialized output;
19. no Node API reaches the browser bundle and no Leaflet instance is created during
    SSR/build;
20. `docs/architecture.md` and the compatibility matrix describe what is actually
    implemented, with deferred keys still listed as deferred.

Do not mark deferred features as implemented unless they are tested end to end.
