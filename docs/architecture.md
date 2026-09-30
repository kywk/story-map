# Architecture

Concrete map of the implemented StoryMap stack. For product intent and the durable contract
see `../SPEC.md`; this document tracks the code as it exists today.

Two platform paths are implemented: the Obsidian file-backed view (the behavioral
reference) and the Docusaurus/Remark publishing path.

Sections 1-13 describe the code as it stands. Section 14 describes the Leaflet
compatibility work on the `feat/leaflet` branch and is explicitly marked as
not-yet-implemented until the agents land; read the status line there before trusting any
file name in it. The per-key support record lives separately in
[`leaflet-compatibility.md`](leaflet-compatibility.md).

## 1. Repository layout

```text
story-map/
  package.json                 pnpm workspace root scripts
  pnpm-workspace.yaml          packages/*, examples/*, and site
  tsconfig.base.json           shared strict TS options
  tsconfig.json                no-emit workspace analysis; source paths for unbuilt checkouts
  SPEC.md AGENTS.md README.md  contract, working agreement, overview
  docs/                        this architecture doc + history/
  packages/
    story-map-core/            schema, parser, pure helpers (published)
    react-story-map/           React + Leaflet renderer (published)
    remark-story-map/          Remark transform + browser client (published)
    obsidian-story-map/        Obsidian plugin (private)
  examples/
    basic.md                   sample story-map document
    react/                     standalone Vite app
    docusaurus/                config snippets, client plugin, theme bridge
  site/                        bilingual landing page (Vite + React, published)
    index.html                 Vite entry and font/meta setup
    public/favicon.svg
    src/App.tsx                sections, language switch, live examples
    src/i18n.ts                en/zh copy and language detection
    src/stories.ts             localised example StoryMapConfigs
    src/styles.css             cartographic design tokens and layout
```

## 2. Dependency graph

```text
story-map-core  <--  react-story-map  <--  obsidian-story-map (private, bundled with esbuild)
       ^                     ^
       |                     |
       +---- remark-story-map (index.ts build-time, client.tsx browser, lazy-imports the renderer)
```

Rules enforced by convention and review:

- `story-map-core` imports nothing from the other packages and no platform APIs.
- `react-story-map` imports `story-map-core` and Leaflet (dynamically), never
  Obsidian/Docusaurus/Node.
- `obsidian-story-map` bundles its workspace dependencies through `esbuild.config.mjs`.
- `remark-story-map` may use Node `fs` in `index.ts`/`vault.ts`; `client.tsx` must not.
  `client.tsx` dynamically imports `react-story-map` so the renderer loads only when a host
  exists.

## 3. Data flow

```text
Markdown document (story-map: true)
  |  extractFencedBlock(markdown, 'story-map')
  v
parseStoryMapSourceYaml(block, defaults)   -> StoryMapSourceConfig
  |  adapter resolves noteFolder / explicit slide.note / media / notePath
  v
toStoryMapConfig(source, resolvedSlides)   -> StoryMapConfig
  |  <StoryMap story={config} />
  v
react-story-map (Leaflet) renders slides on a map
```

Adapters differ only in *how* they resolve the source:

- **Obsidian** (`view.tsx` -> `resolver.ts`): reads Vault metadata for notes, recursive
  `noteFolder` scan, local attachment URLs, note title link + page preview callbacks.
- **Remark** (`index.ts` -> `vault.ts`): at build time scans a filesystem Vault when
  `vaultRoot` is set, optionally maps note paths to published routes through a host
  `resolveNoteHref`, then serializes the normalized config into an HTML placeholder.
  `client.tsx` hydrates every placeholder in the browser.
- **Standalone React**: builds `StoryMapConfig` directly and renders `<StoryMap />`.

## 4. Package APIs

### `@story-map/story-map-core`

Exported from `src/index.ts`.

- `types.ts` — `StoryMapConfig`, `StoryMapSourceConfig`, `StorySlide`, `StoryLocation`,
  `StoryMedia`, `StoryMapOptions`, `StoryMapSourceDefaults`, `StoryMapTheme`,
  `StoryMapLayoutOptions`, `StoryMapLayoutMode`, `StoryMapCardLayout`, `StoryMapFullLayout`, `StoryOrder`,
  `StoryNoteDisplay`, and `DEFAULT_STORY_ORDER` / `DEFAULT_DATE_FIELD` /
  `DEFAULT_NOTE_DISPLAY`.
- `schema.ts` — Zod `storyMapSchema`, `storyMapSourceSchema`, `storySlideSchema` (ranges,
  enums, built-in defaults).
- `parser.ts` — `parseStoryMapYaml`, `parseStoryMapObject`, `parseStoryMapSourceYaml`,
  `parseStoryMapSourceObject`, `applySourceDefaults`, `normalizeStoryMapInput`,
  `toStoryMapConfig`, `extractFencedBlock`, `StoryMapParseError`.
- `helpers.ts` — `parseWikiLinkRef`, `stripFrontmatter`, `coerceLocation`, `coerceMedia`,
  `mergeResolvedSlide`, `validCoordinates`, `slideFromNoteFrontmatter`, `toTimestamp`,
  `compareNoteDates`, `sortNoteDates`, `normalizeVaultFolder`, `isPathInFolder`,
  `normalizeTag`, `extractFrontmatterTags`, `matchesTagFilter`.

Key invariants:

- `normalizeStoryMapInput` folds Leaflet-style root keys (`lat`/`long`/`lng`,
  `defaultZoom`, `tileServer`), `location: [lat, lng]` and comma-string locations, and
  string media into the canonical shape before validation. It also coerces `slides[].date`
  through `toTimestamp` (accepting `Date`, finite `number`, and `string`) into epoch
  milliseconds, deletes the key when absent, and throws `StoryMapParseError` when a
  present value is unparseable. A root-level `opacity` or `map.opacity` is normalized into
  `panelOpacity` and then deleted, so an explicit `panelOpacity` always wins.
- `effectiveNoteDisplay` forces `full` only for the `full` layout mode; `card` and
  `timeline` return the configured value.
- `locationOnlySlide` keeps only `location` and `mapmarker`; the adapters apply it for
  `noteDisplay: full` outside a timeline so a timeline row keeps its date, title, and
  cover.
- `applySourceDefaults` only fills keys the document omitted; document values always win.
- `mergeResolvedSlide` makes explicit slide values win over note frontmatter, except that
  `location` and `media` fall back to the resolved note value when the slide omits them.
- `sortNoteDates` keeps notes with missing/unparseable dates last, then breaks ties by
  Vault-relative path ascending in both directions.

### `@story-map/react-story-map`

`src/index.ts` exports `StoryMap` and `StoryMapProps` plus the core public types (re-export).

```tsx
<StoryMap
  story={config}
  initialSlide={0}
  onSlideChange={(index, slide) => {}}
  onNoteClick={(notePath, event) => {}}
  onNoteHover={(notePath, targetEl, event) => {}}
  noteLinkClassName="internal-link"
/>
```

- Leaflet is loaded with `await import('leaflet')` inside the mount effect, so the package
  is SSR-import-safe.
- `MapCanvas.tsx` owns one stable Leaflet map. Config updates refresh layers; slide changes
  call `flyTo` and restyle markers without recreating the map. `flyTo` targets a
  layout-aware focus point (`markerOffset.ts`: centered cards and narrow viewports park
  the marker at the top quarter; `full` and `timeline` center it in the remaining map width
  beside the story surface) so the overlay never covers the active marker. `StoryMap.tsx`
  owns content, navigation and the card/full/timeline presentation overlay. `card` keeps
  text-button navigation inside the panel; `full` floats circular prev/next arrows and a
  counter pill at the container edges, layered above the presentation overlay
  (`z-index` 600 vs 500) so they stay visible and clickable over the article half, and the
  whole Markdown body stays scrollable.
- `timeline` renders `Timeline.tsx` (`StoryTimeline`) instead of the panel and `StoryNav`:
  every slide becomes a row with a `<time>` date chip (omitted when `slide.date` is absent),
  an image-only thumbnail, a title, a two-line clamped Markdown description, and a note chip.
  The list is the navigation — a row click calls the same `goTo` as the arrow keys — and the
  active row scrolls into view with `scrollIntoView({ block: 'nearest' })`. Dates are
  formatted by `formatTimelineDate` with a fixed `en-US` + `timeZone: 'UTC'`
  `Intl.DateTimeFormat` (`Apr 12, 2024`); there is no locale or formatting knob, so SSR
  markup and hydration agree and a UTC-midnight date cannot shift a day.
- `ResizeObserver` calls `invalidateSize()` on the map container.
- Note-link behavior is one shared `NoteLink` in `StoryMap.tsx`, used by both the panel
  heading (`SlideTitle`) and the timeline note chip:
  - `notePath` absent -> plain heading or no chip;
  - `notePath` present with `onNoteClick`/`onNoteHover` -> callback-driven link (Obsidian);
  - `notePath` present without callbacks -> normal `<a href>` (Docusaurus).
- The renderer owns semantic `--story-map-*` CSS variables with private fallbacks; hosts
  override them on an ancestor (for example `.story-map-host`). `react-story-map` never
  imports Infima or Docusaurus APIs. `styles.css` supplies fixed `light`/`dark` palettes,
  an `auto` theme that falls back to `prefers-color-scheme`, and coordinated
  `vintage`/`cyber`/`atlas` presets for tile filters, vector layers, controls, and story
  surfaces. Card alignment/ratios and full side/content ratio affect only the presentation
  overlay; mobile full mode uses a vertical fade. Timeline CSS is scoped under
  `[data-layout='timeline']` and reuses the same semantic variables, so every built-in theme
  applies with no new palette; the ≤640px fallback is the same vertical transition as `full`.
  The section emits `data-layout` plus `data-timeline-side={layout.full.side}`, keeping the
  CSS independent of timeline's internal reuse of `layout.full`.

### `@story-map/obsidian-story-map`

- `main.tsx` — `StoryMapPlugin`: registers the view and hover-link source, adds
  `Open as map` / `Open as Markdown` commands and file/pane menu entries, patches
  `WorkspaceLeaf.setViewState` (scoped: only detected `story-map: true` files with no
  per-file Markdown opt-out), owns settings and view refresh.
- `view.tsx` — `StoryMapView extends TextFileView`: extracts the fence, parses with
  `getSourceDefaults()`, resolves slides, mounts `StoryMap` with `height: '100%'`, and
  renders an in-view error on invalid config. Uses a `renderToken` to ignore stale async
  renders.
- `resolver.ts` — `resolveObsidianStory(app, source, sourcePath)`: explicit slides vs.
  recursive `noteFolder` discovery, frontmatter inheritance, local media → resource URL,
  `noteDisplay` handling. The `dateField` value read for ordering is also threaded onto
  `slide.date` for both discovered and explicitly referenced notes, and the `full`-display
  frontmatter strip is skipped when `source.layout.mode` is `timeline`.
- `detect.ts` — `isStoryMapFile` reads `story-map: true` frontmatter.
- `agents.ts` — framework-local CLI agent layer: `DEFAULT_AGENT_CONFIGS`
  (Codex/Claude/OpenCode/pi), quote-aware `parseArguments`, PATH detection, per-kind
  `parseAgentOutput`, and `runAgent` (no shell, temp cwd, timeout and output caps).
- `coordinates.ts` — coordinate prompt, JSON candidate parsing/validation/dedupe, and
  `location: [lat, lng]` formatting.
- `local-agents.ts` — `LocalAgentController`: device-local agent settings through
  `app.saveLocalStorage`, detect/test, and `lookupCoordinates`.
- `coordinate-lookup.ts` — `Find coordinates with AI` command flow, the query modal, and the
  candidate picker with an interactive Leaflet mini-map and frontmatter/clipboard actions.
- `i18n.ts` — English keys with a zh-TW bundle, auto-selected from `getLanguage()`.
- `settings-data.ts` / `settings-tab.ts` — plugin defaults and their UI, with searchable
  setting definitions on Obsidian 1.13+ and imperative rendering on 1.8–1.12.
  Reset redraws the fixed rows using legacy-compatible APIs; it does not call 1.13's
  `SettingsTab.update()`. The settings tab also edits the device-local local-agent draft.
- `constants.ts` — view type, fence language, hover-link identifiers.
- `esbuild.config.mjs` — bundles `src/main.tsx` to `dist/main.js` (CJS) and copies
  CSS/manifest/versions. `obsidian`, `electron` and Node built-ins stay external: the
  desktop-only local-agent layer requires them at runtime.
- `obsidian.css` imports the renderer stylesheet and adds the Obsidian-native theme bridge:
  the `auto` preset (the plugin default) inherits Obsidian CSS variables, the
  `theme-dark`/`theme-light` tile filter, and the theme background for the Leaflet
  container, while `light`/`dark`/`vintage`/`cyber`/`atlas`
  and explicit `--story-map-*` overrides keep their own colors.

### `@story-map/remark-story-map`

- `index.ts` — default export `remarkStoryMap(options)`: replaces each `story-map` code
  node with `<div class="story-map-host" data-story-map-config="...">`. It reads the
  Remark `VFile` path for source-relative media and marks hosts from a `story-map: true`
  document with `data-story-map-document="true"`. With `vaultRoot`, uses `VaultIndex`;
  otherwise only explicit slides are kept.
- `vault.ts` — `VaultIndex`: scans the Vault (skipping dot-directories and
  `node_modules`/`build`/`dist`/`coverage`), indexes notes by relative path and basename,
  resolves explicit WikiLinks (ambiguous basenames throw) and folder discovery, applies
  `noteDisplay`, maps notes to published routes through `resolveNoteHref`, and rewrites
  local media against `assetBase`. It threads the same `dateField` value used for ordering
  onto `slide.date` and applies the same timeline carve-out on the `full`-display strip as
  the Obsidian adapter. `resolveStory` re-resolves `note:` references on an already
  normalized config and takes an optional `dateField` (default `date-created`, since
  `StoryMapConfig` does not carry it).
- `client.tsx` — `mountStoryMaps` / `startStoryMapClient`: parses the encoded config,
  dynamically imports the renderer, mounts `<StoryMap />`, skips duplicate mounts, and
  unmounts roots whose host nodes left the DOM (Docusaurus SPA navigation). Safe to import
  in SSR because it guards on `typeof document`.

Options:

```ts
interface RemarkStoryMapOptions {
  vaultRoot?: string;
  assetBase?: string;
  resolveNoteHref?: (vaultRelativePath: string) => string | undefined;
}
```

## 5. Source document conventions

- Document frontmatter: `story-map: true`.
- Discoverable note frontmatter: `story-map-note: true`.
- Fence language: `story-map`.
- Config keys are camelCase; frontmatter role flags stay kebab-case.
- `noteFolder` is one Vault-relative folder, recursive.
- `order: asc | desc` and `dateField` are the only folder-ordering controls.
- `includeTags`/`excludeTags` optionally narrow folder discovery. Both are any-of,
  case-insensitive, frontmatter-only (`tags`/`tag`, string or list); leading `#` is
  stripped; nested tags match exactly. They are document-only and do not affect explicit
  slides.
- Explicit `slides` keep their exact order; `noteFolder` is ignored when they exist.
- `slides[].date` is epoch-millisecond slide data: the core parser normalizes it, both
  adapters fill it from the configured `dateField`, and an authored value wins. It is
  document data, not a setting.

## 6. Default resolution

For the Obsidian adapter, each defaultable key resolves: document block -> plugin setting
-> built-in code default. Remark uses document values plus built-in defaults; it does not
duplicate the Obsidian settings UI.

| Key | Built-in default | Defaultable in plugin settings |
| --- | --- | --- |
| `schema` | `storymap/v1` | no (document only) |
| `id`, `title` | — | no (document only) |
| `height` | `520px` | no (`100%` forced in Obsidian) |
| `noteFolder` | — | no (document only) |
| `includeTags`, `excludeTags` | — | no (document only) |
| `order` | `asc` | yes |
| `dateField` | `date-created` | yes |
| `noteDisplay` | `link` | yes |
| `initialSlide` | `first` | yes |
| `panelOpacity` | `0.85` | yes |
| `map.center` | — | no (document only) |
| `map.theme` | `light` (Obsidian plugin default `auto`) | yes |
| `map.zoom` | `6` | yes |
| `map.minZoom`, `map.maxZoom` | — | yes |
| `map.tileUrl` | `https://tile.openstreetmap.org/{z}/{x}/{y}.png` (`DEFAULT_TILE_URL`) | yes |
| `map.attribution` | `© OpenStreetMap contributors` | yes |
| `map.showPath` | `true` | yes |
| `layout.mode` | `card` (values: `card`, `full`, `timeline`) | no (document only) |
| `layout.card.align` | `left` | no (document only) |
| `layout.card.widthRatio`, `heightRatio` | — (`0.20..0.80`, `0.20..0.95`) | no (document only) |
| `layout.full.side`, `contentRatio` | `left`, `0.50` (`0.30..0.70`) | no (document only) |
| `slides` | — | no (document only) |

When adding a defaultable key: add it to `story-map-core` schema + `applySourceDefaults`,
to `settings-data.ts` and `settings-tab.ts`, and cover precedence in `parser.test.ts`. Do
not re-implement defaulting in the view.

## 7. Note display modes

`noteDisplay` controls how a resolved note appears in the slide panel:

- `basic` — frontmatter basics only.
- `link` — basics plus a resolved `slide.notePath`:
  - Obsidian passes an opaque Vault path plus callbacks (Page preview on hover, open in new
    tab on click);
  - Remark passes the published href from `resolveNoteHref`, or omits `notePath` when the
    host cannot resolve it (leaving the title unlinked).
- `full` — the frontmatter-stripped note body as slide text, keeping the resolved
  `slide.notePath` so the title stays linked. Frontmatter-derived title and media are dropped
  (the body carries them); fields the story document set explicitly are kept. The `full`
  layout always resolves notes this way (`effectiveNoteDisplay` in `story-map-core`),
  regardless of the configured `noteDisplay`. Slide prose keeps theme colors even when a
  host app paints bare `strong`/`em` globally.

Two layout-sensitive details sit on top of that: `effectiveNoteDisplay` forces `full` only
for the `full` layout, so `card` and `timeline` use the configured value; and both adapters
apply the `locationOnlySlide` strip on `noteDisplay === 'full' && layoutMode !== 'timeline'`.
Without the layout check a timeline row would lose its date, title, and thumbnail, because a
row is built from the same slide. `card` and `full` output is unchanged by either rule.

## 8. Docusaurus publishing pipeline

````text
story-map fence
  -> remark-story-map (build-time, Node)
  -> VaultIndex (explicit notes / noteFolder)
  -> host resolveNoteHref(vaultRelativePath)
  -> existing site content-link index / published route
  -> serialized StoryMapConfig in .story-map-host
  -> browser StoryMap client
  -> shared react-story-map renderer (Leaflet imported client-side)
````

- Build-time code never initializes Leaflet.
- Route/slug policy is host-owned. This repo never implements Docusaurus slug rules; the
  target `kywk.github.io` site keeps `scripts/content-links.js` /
  `remark-slug-normalizer` as its URL authority.
- No absolute local filesystem path is serialized into the HTML.
- `assetBase` only rewrites media URLs; copying Vault attachments into the site's static
  output stays site-owned.
- Relative media uses source context: note-derived media resolves relative to the note;
  explicit slide media resolves relative to the StoryMap source Markdown document.
- The browser client is registered as a Docusaurus client module (see
  `examples/docusaurus/story-map-client-plugin.cjs`) and handles SPA insertion/removal
  without duplicate mounts or leaked React roots.
- The host CSS bridge (`examples/docusaurus/story-map-theme.css`) maps Infima variables
  onto renderer semantic variables only when `.story-map-use-infima-colors` is applied.
  Built-in themes remain coherent by default.
- A full-page view (Open as Story Map, with a Markdown toggle) is host UI, not a package
  option: it targets Docusaurus theme DOM/sidebar, the route lifecycle, and host CSS. The
  transform only stamps `data-story-map-document="true"`; see
  [`docusaurus-full-page.md`](docusaurus-full-page.md) and
  `examples/docusaurus/story-map-view.js`.

## 9. Commands

```bash
corepack enable
pnpm install
pnpm typecheck        # root source analysis, then tsc -b through project references
pnpm test             # vitest run in core, react, obsidian, remark
pnpm build            # tsc -b for libraries, esbuild for the plugin, vite for the example
pnpm dev:obsidian     # build core + react, then obsidian dev (single build, not watch)
pnpm --filter @story-map/example-react dev
pnpm --filter @story-map/obsidian-story-map build
pnpm --filter @story-map/site dev        # landing page at http://127.0.0.1:5174
pnpm --filter @story-map/site build      # static output in site/dist
```

The landing page is a private workspace package (`@story-map/site`). It imports
`story-map-core` and `react-story-map` through the workspace and renders the shared
component for several live examples, so the normal `pnpm build` builds it too. Language is
selected from `?lang=en|zh` (falling back to `navigator.language`) and reflected into the
URL. `site/src/i18n.ts` owns both language dictionaries, feature copy, the settings
reference, and FAQ; `App.tsx` composes the live demos, native playground controls, and
copyable Markdown examples. The website prioritizes Obsidian authors and links to complete
React and Remark integration guides. Its visual system is recorded in `../DESIGN.md`;
renderer themes remain separate from website styling.

`.github/workflows/pages.yml` runs frozen installation, type checking, tests, and the full
workspace build on main pushes, PRs targeting main, and manual dispatch. Only a successful
main build uploads `site/dist` and deploys through GitHub Actions Pages (`SITE_BASE` uses
the repository name); no `gh-pages` branch is used. PR validation has read-only repository
permissions; Pages and OIDC write permissions belong to the deploy job.

Plugin artifacts land in `packages/obsidian-story-map/dist/` as `main.js`, `manifest.json`,
`styles.css`, `versions.json`, and `THIRD_PARTY_NOTICES.txt`; install the JavaScript,
manifest, CSS and notices in `<Vault>/.obsidian/plugins/geo-story-map/`.
Repository-root `manifest.json` and `versions.json` are canonical plugin metadata;
`esbuild.config.mjs` copies them into the plugin output. The plugin is desktop-only.
The plugin is named Geo Story Map, with ID `geo-story-map`, host view type
`geo-story-map-view` and hover source `geo-story-map`. Markdown syntax and npm names
remain unchanged. The build gathers full licenses from actual bundled dependency inputs,
writes a notice file and appends the same notices as comments to `main.js` for automatic
Obsidian installs. `scripts/check-obsidian-release.mjs` validates metadata and a bundled
CommonJS import with only Obsidian external.
The Obsidian-only `react-script-policy.mjs` disables React DOM's unused script
preinit/resource and script-rendering paths with an explicit error. It validates the
upstream source shape and rejects script creation in the final bundle; npm hosts retain
standard React behavior. DOM tests cover normal rendering and blocked script operations.
Cleanup restores the scoped view wrapper only if it is still installed; later wrappers
remain intact and any retained Geo Story Map wrapper forwards unchanged after disable.
Disabling the plugin preserves workspace leaves and lets Obsidian own view teardown;
the view unmounts React during its unload. Static host dimensions are owned by CSS.
Release steps are in `../RELEASING.md`.

The npm workflow `.github/workflows/release-npm.yml` responds to `npm-v*` tags, validates
stable lockstep versions, runs checks and `scripts/release-npm.mjs`, then publishes only
the three library tarballs through npm OIDC. The script packs with pnpm, verifies packed
exports/metadata and installs an isolated consumer for SSR, Remark and declaration checks.
Publication reuses the verified tarballs; matching existing registry integrities allow a
partial release retry. Account-side Trusted Publishers must be configured separately.

## 10. Tests

| Location | Covers |
| --- | --- |
| `scripts/release-npm.test.mjs` | tag mismatch, dependency publication order, partial retry, integrity conflicts and registry errors with a fake npm executable |
| `packages/story-map-core/src/parser.test.ts` | parsing, normalization, defaults, ordering, fence extraction, slide `date` coercion, `effectiveNoteDisplay`, helpers |
| `packages/react-story-map/src/StoryMap.test.tsx` | slide-title rendering, SSR theme/layout markup, map/presentation order, timeline rows/date chips/active row/nav-free markup, shared note-link shape |
| `packages/react-story-map/src/markerOffset.test.ts` | active-marker focus per layout mode, including the timeline reuse of the `full` options |
| `packages/obsidian-story-map/src/resolver.test.ts` | explicit slides, folder discovery, tag filtering, note display, media resolution, slide `date` from `dateField`, the timeline note-display carve-out |
| `packages/obsidian-story-map/src/settings-data.test.ts` | settings → source defaults mapping |
| `packages/obsidian-story-map/src/agents.test.ts` | argument parsing, per-agent output parsing, executable detection |
| `packages/obsidian-story-map/src/coordinates.test.ts` | coordinate prompt, candidate parsing/validation/dedupe, YAML line formatting |
| `packages/obsidian-story-map/src/i18n.test.ts` | locale resolution, translation and message mapping |
| `packages/obsidian-story-map/src/main.test.ts` | scoped routing, explicit Markdown mode and wrapper ownership on disable |
| `packages/obsidian-story-map/src/settings-tab.test.ts` | definitions, legacy rendering, local-agent draft persistence |
| `packages/remark-story-map/src/index.test.ts` | fence transform, document flag, `VaultIndex`, folder discovery, tag filtering, `noteDisplay`, source-relative media, scan exclusions, host route resolver, timeline slide dates and their serialization |
| `packages/remark-story-map/src/parity.test.ts` | cross-host parity: one fixture resolved through both the Obsidian and Remark adapters, asserting identical selection, order, and slide dates, plus the shared `noteDisplay` carve-out |

The examples and the landing site have no automated tests; verify them manually.

## 11. Where to change what

| Change | Touch |
| --- | --- |
| Schema/defaults/normalization | `story-map-core` (`schema.ts`, `parser.ts`, `types.ts`) + `parser.test.ts` |
| Rendering, navigation, markers, media, note links | `react-story-map/src/MapCanvas.tsx`, `StoryMap.tsx`, `styles.css`, `StoryMap.test.tsx` |
| Layout modes and the timeline row list | `react-story-map/src/Timeline.tsx`, `StoryMap.tsx`, `markerOffset.ts`, `styles.css` |
| Slide `date` semantics (fill, coercion, precedence) | core `types.ts`/`parser.ts`/`helpers.ts` + both adapters (`resolver.ts`, `vault.ts`) |
| Obsidian view, commands, settings, detection | `obsidian-story-map/src/*` |
| Local AI agent config and coordinate lookup | `obsidian-story-map/src/agents.ts`, `coordinates.ts`, `local-agents.ts`, `coordinate-lookup.ts` |
| Obsidian note/media resolution | `obsidian-story-map/src/resolver.ts` |
| Tag filtering (`includeTags`/`excludeTags`) | core `helpers.ts` + both adapters (`resolver.ts`, `vault.ts`) |
| Remark/Docusaurus pipeline | `remark-story-map/src/index.ts`, `vault.ts`, `client.tsx` |
| Docusaurus host config / theme bridge | `examples/docusaurus/*` (site-owned) |
| Docusaurus full-page map view | `examples/docusaurus/story-map-view.js` + `story-map-full-page.css`; see `docs/docusaurus-full-page.md` |
| Landing page content or design | `site/src/*`; examples in `site/src/stories.ts` |
| A new defaultable setting | core schema + defaults, `settings-data.ts`, `settings-tab.ts`, parser tests |

## 12. History

Archived milestones live under `history/`:

- `history/2026-09-25-init/` — initial Obsidian MVP planning.
- `history/2026-09-26-docusaurus-remark/` — Docusaurus/Remark milestone planning.
- `history/2026-09-26-npm-release/` — approved npm release preparation and deferred Obsidian gates.
- `history/2026-09-26-obsidian-community-release/` — Geo Story Map submission preparation.
- `history/2026-09-30-timeline-layout/` — the `timeline` layout mode, `StorySlide.date`, and the
  adapters' `date` threading.
- `history/2026-09-29-leaflet-compatibility/` — the approved GeoMap and legacy `leaflet`
  compatibility design, settings decisions, and phase plan.
- `history/2026-09-30-docusaurus-migration/` — the handoff for the remaining work: retiring
  the duplicate Leaflet runtime in `kywk.github.io`. Read
  [`hand-off.md`](history/2026-09-30-docusaurus-migration/hand-off.md) first when picking
  that up.

They are archival; the current contract is `SPEC.md` plus this document.

## 14. Leaflet compatibility

**Status: implemented on `feat/leaflet`; the per-key support record is
[`leaflet-compatibility.md`](leaflet-compatibility.md).** This section describes the
structure. The approved design, settings decisions, and phase plan are archival under
`history/2026-09-29-leaflet-compatibility/`.

### 14.0 Files

| File | Role |
| --- | --- |
| `story-map-core/src/leaflet.ts` | The `leaflet` dialect parser, the repeated-key pre-pass, and the diagnostic phase table. |
| `story-map-core/src/leaflet.test.ts` | Fixtures, repeated keys, diagnostics, `mapzoom`, marker-type precedence, tile normalization. |
| `react-story-map/src/GeoMap.tsx` | The shared Leaflet lifecycle and the exported `<GeoMap />`. |
| `react-story-map/src/geoMarker.ts` | Marker plan, registry visuals, and `mapzoom` visibility. |
| `react-story-map/src/geoTiles.ts` | Tile source resolution and layer identity. |
| `react-story-map/src/noteLink.ts` | The callback-vs-`href` note link shape shared by both surfaces. |
| `react-story-map/src/MapCanvas.tsx` | StoryMap's layer above `<GeoMap>`: slide projection, active styling, focus offset. |
| `obsidian-story-map/src/leaflet-block.tsx` | `registerMarkdownCodeBlockProcessor('leaflet', …)` and its inline diagnostics. |
| `obsidian-story-map/src/leaflet-resolver.ts` | `resolveObsidianGeoMap`: recursive `markerFolder` over Vault metadata. |
| `obsidian-story-map/src/note-links.ts` | The one Obsidian note-link/preview implementation, used by both surfaces. |
| `obsidian-story-map/src/leaflet-import.ts` | Optional "Import settings from Obsidian Leaflet". |
| `remark-story-map/src/vault.ts` | `resolveLeafletSource` / `resolveLeafletMarkers` beside the story path. |
| `remark-story-map/src/client.tsx` | One client; `data-story-map-kind` picks the renderer. |
| `remark-story-map/src/fixtures.ts` | The four production blocks, pinned as test data. |
| `remark-story-map/src/parity.test.ts` | Cross-host parity: the same fixtures through both adapters. |


### 14.1 Data flow

```text
story-map fence -> story-map-core storymap/v1 parser -> StoryMapConfig -\
                                                                     -> <StoryMap>
leaflet fence   -> story-map-core leaflet parser     -> GeoMapConfig ---/  -> <GeoMap>
                                                                              ^
                                                             both share one Leaflet lifecycle
```

Two dialects, two parsers, one runtime. The `leaflet` dialect never enters the
`storymap/v1` Zod schema, and a non-story map is never encoded as Story slides.

### 14.2 Parser split

`story-map-core` keeps `schema.ts` / `parser.ts` exactly as they are for `storymap/v1`, and
adds a separate `leaflet.ts` for the second dialect. That parser owns historical key
spellings, historical repeated keys, and the diagnostic list. Both live in the same
package because both are pure source-to-config transforms with no platform dependency.

Historical repeated keys are a source-text problem: `js-yaml` throws `duplicated mapping
key`, so `groupRepeatedTopLevelKeys` folds a repeated top-level key into one flow sequence
first. It is deliberately narrow - an explicit repeatable-key set, top level only, simple
scalars only - and it leaves every other line byte-identical so a later error still points
at the authored line. Block scalars, nested mappings, and duplicated singleton keys are
left alone.

### 14.3 Diagnostics

A recognized `leaflet` key that is not implemented becomes a `GeoMapDiagnostic` naming the
key, rather than being dropped. One key-to-phase table in `leaflet.ts` is the single source
for both "is this recognized" and "which phase", so the promise that a pending key is
always reported cannot go stale. The Obsidian block renders them inline under the map; the
Remark transform serializes them into the host payload and the browser client renders them
in the same React tree as the map. An unknown key gets a distinct `leaflet-unknown-key`
code, because a typo and a scheduled feature are different problems for the author.

Host UI is a *tree*, not a DOM append. React takes ownership of a `createRoot` container
and clears its children on the first commit, so anything appended around `root.render()`
disappears. `MapHost` in the Remark client and the inline block in Obsidian both compose
their list together with the map.

### 14.4 Renderer

`react-story-map` holds the Leaflet lifecycle in `<GeoMap />`: one map instance per host,
the tile-source layer, generic markers, `mapzoom` zoom visibility, tooltips, note-link
callbacks, and the shared `ResizeObserver` / `invalidateSize()`. `MapCanvas.tsx` stays as
the StoryMap-specific layer above it: slide-to-marker projection, active-slide styling,
the path polyline, and the layout-aware focus offset. Config and marker changes refresh
layers in place and never recreate the map.

A standalone `<GeoMap>` renders the same themed `.story-map` root as `StoryMap`, so all six
presets and the `--story-map-*` variables style a plain map with no duplicated CSS.
`StoryMap` composes it with `rootless`, which keeps its DOM byte-identical - the existing
StoryMap test files are unmodified.

`map.controls` (`noUI`, `noScrollZoom`, `recenter`, `locked`) and `map.zoomDelta` are
deliberately inert. Core reports them as `leaflet-pending-p1`, and implementing them would
make that diagnostic a lie.

### 14.5 Obsidian inline fence

`obsidian-story-map` adds `registerMarkdownCodeBlockProcessor('leaflet', ...)`
(`leaflet-block.tsx`), which mounts `<GeoMap />` in ordinary reading view, plus
`leaflet-resolver.ts` for recursive `markerFolder` resolution over Vault metadata. It is
independent of the full-leaf `TextFileView`, uses the block's own `height`, and leaves
unrelated code blocks alone. `note-links.ts` is the single implementation of Page preview
on hover and open-in-new-tab on click, shared with the StoryMap view, so the two surfaces
cannot drift.

Settings moved to a versioned `version: 2` structure - `story`, `map`, `markers`,
`interaction`, `leafletCompatibility` - migrated from the previous flat shape without
losing existing defaults. Default resolution is structurally separated: `toSourceDefaults`
can only read `story` and `map`, so a Leaflet-only `defaultCenter`, marker registry,
tooltip default, or unit system is unreachable from a story map. A `leaflet` block has no
theme key of its own, so `leafletCompatibility.theme` is what lets an inline map follow
Obsidian's light/dark; it defaults to `auto` for the same reason the story-map default
does. Device-local AI agent settings still use `app.saveLocalStorage` and stay out of the
persisted object.

`map.tiles` is the one section both dialects read. Two independent tile settings would
contradict the approved settings structure, which adopts the historical Default Tile Server
into a single `map` section.

### 14.6 Remark discriminator

`remark-story-map` transforms `leaflet` nodes as well as `story-map` nodes, reusing
`VaultIndex` for `markerFolder` and the host `resolveNoteHref` for published note links.
Every host carries `data-story-map-kind="story" | "map"`, and the single browser client
mounts the matching renderer. One client, one renderer module import, one Leaflet CSS
import; existing SPA mount/unmount behavior is unchanged.

Host instance identity is a per-transformed-file counter (`data-story-map-instance`),
never derived from the authored id: the Xinjiang fixture reuses `chile-2509` from the Chile
block, and nothing may rename, deduplicate, or reject a repeated authored id.

### 14.7 Host boundaries

Unchanged by this work: Docusaurus slug policy stays host-owned through
`resolveNoteHref`; `react-story-map` imports no Obsidian, Docusaurus, or Node API and stays
SSR-import-safe; the Remark browser entry stays free of Node APIs; no Leaflet instance is
created during build. A `leaflet` block with no `vaultRoot` renders an empty map rather
than failing the page build.

### 14.8 Credential policy

Markdown fences and generated HTML are public source and public output, so a tile-provider
API key is never a secret in a fenced block and is never serialized as if it were private.
A browser-delivered key is a public client credential that must be provider-restricted and
configured by the host. Section 6 records the built-in
`https://tile.openstreetmap.org/{z}/{x}/{y}.png` source; CARTO Basemaps is never a default
because it now requires a key, and the importer warns about a keyless CARTO URL instead of
adopting it.

Obsidian release automation lives in `.github/workflows/release-obsidian.yml`: it validates
plain tags, builds/tests, attests the three release assets and publishes new releases.
Manual dispatch attests an existing release only after comparing all three files. Full
license notices remain embedded in `main.js`; the generated text file stays local.
