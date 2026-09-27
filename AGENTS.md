# AGENTS.md

## Mission

Deliver the StoryMap MVP described in `SPEC.md` with the least architectural surface
necessary. Three hosts share one `StoryMapConfig`: standalone React, the Obsidian
file-backed view (behavioral reference), and the Docusaurus/Remark publishing path. All
three are implemented; keep them stable and do not expand scope.

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
- StoryMap configuration keys use camelCase.
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
- Note presentation is controlled by `noteDisplay: basic | link | full`, default `link`:
  `basic` uses frontmatter metadata only; `link` resolves a slide-title link; `full` uses
  the frontmatter-stripped note body as slide text.
- `link` is platform-specific only at navigation time: Obsidian supplies callbacks (Page
  preview on hover, open in new tab on click); Docusaurus resolves the final published
  route and the renderer emits a normal browser link. `react-story-map` must not import
  Obsidian or Docusaurus APIs.
- Defaultable `story-map` keys (Obsidian plugin settings): `order`, `dateField`,
  `noteDisplay`, and `map.zoom`, `map.minZoom`, `map.maxZoom`, `map.tileUrl`,
  `map.attribution`, `map.showPath`. Keys that vary per document — `schema`, `id`, `title`,
  `noteFolder`, `includeTags`, `excludeTags`, `map.center`, `slides`, `height` — must stay
  document-only and must not be added to plugin settings or defaults. Resolution order for
  defaultable keys is always:
  1. the key present in the document's `story-map` block;
  2. otherwise the plugin setting;
  3. otherwise the built-in code default.
  (`height` is forced to `100%` in the Obsidian full-leaf host; Remark uses document values
  plus built-in defaults and does not mirror the Obsidian settings UI.)
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
- Theme adaptation belongs in a host CSS bridge mapping Infima variables onto the
  renderer's `--story-map-*` variables; do not hard-code Docusaurus variables in
  `react-story-map` except as optional fallbacks.

## Non-goals

Do not introduce unless explicitly requested:

- Nx, Turborepo, Bazel, changesets, semantic-release;
- Redux/Zustand, React Leaflet, MapLibre;
- visual editors, scroll-driven storytelling, a generic plugin framework;
- premature abstraction for multiple map engines;
- multiple `noteFolder` sources;
- generic `sortBy`, grouping, or query syntax, or filtering beyond
  `includeTags`/`excludeTags`;
- a generic route/slug framework;
- automatic full Markdown-open interception through `WorkspaceLeaf` monkey patches (a
  scoped `setViewState` wrapper may still open detected `story-map: true` documents in the
  StoryMap view by default);
- marker popup/icon parity or `mapzoom` visibility semantics;
- WikiLink/embed expansion inside `noteDisplay: full` Markdown.

A future map adapter can be added later. The MVP renderer directly owns the Leaflet
lifecycle inside `react-story-map`.

## Package boundaries

- `packages/story-map-core` — framework agnostic; no DOM, React, Leaflet, Obsidian,
  Docusaurus, or Node filesystem dependencies; schema, parsing, defaults, pure helpers; no
  folder scanning or file reads.
- `packages/react-story-map` — owns UI and Leaflet rendering, semantic CSS variables, and
  generic note-link rendering from a resolved `notePath`; SSR-import-safe (Leaflet is
  dynamically imported inside client effects only); no Obsidian/Docusaurus/Node APIs; no
  knowledge of `noteFolder`, Vault scanning, or slug rules.
- `packages/obsidian-story-map` — Obsidian APIs allowed; file-backed `TextFileView`; parses
  the fence; resolves Vault content and `noteFolder`; passes a standard `StoryMapConfig` to
  the renderer; supports Markdown <-> StoryMap switching; opens detected documents in the
  StoryMap view by default via a scoped `setViewState` wrapper; must not intercept unrelated
  Markdown opens.
- `packages/remark-story-map` — build-time entry (`index.ts`, `vault.ts`) may use Node
  `fs`; browser entry (`client.tsx`) must not and lazy-loads the renderer; never initializes
  Leaflet during build; resolves notes, ordering, `noteDisplay`, routes, and media into
  `StoryMapConfig`; does not own slug policy.

See `docs/architecture.md` for the file-level map and public APIs.

## Collaboration rules

- each agent owns one package directory;
- avoid editing root config unless assigned as integrator;
- do not rename shared public types without coordinating consumers;
- prefer small commits grouped by package responsibility;
- add focused tests for parser/normalization/order/display logic before expanding behavior;
- integration fixes belong to the integrator after package work is complete;
- do not expand sorting beyond `order` + `dateField`.

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
3. recursive `noteFolder` discovery and `dateField` ordering in both directions;
4. explicit slide ordering unaffected by folder settings;
5. split-pane resize/Leaflet invalidation;
6. Remark transform output, including `noteDisplay` basic/link/full;
7. source-relative and note-relative media;
8. multiple StoryMaps on one page and clean SPA host removal;
9. Docusaurus SSR/build never initializes Leaflet;
10. Docusaurus light/dark theme bridge renders readable UI.

Do not mark deferred features as implemented unless they are tested end to end.
