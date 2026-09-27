# Architecture

Concrete map of the implemented StoryMap stack. For product intent and the durable contract
see `../SPEC.md`; this document tracks the code as it exists today.

Two platform paths are implemented: the Obsidian file-backed view (the behavioral
reference) and the Docusaurus/Remark publishing path.

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
  `StoryMedia`, `StoryMapOptions`, `StoryMapSourceDefaults`, `StoryOrder`,
  `StoryNoteDisplay`, and `DEFAULT_STORY_ORDER` / `DEFAULT_DATE_FIELD` /
  `DEFAULT_NOTE_DISPLAY`.
- `schema.ts` — Zod `storyMapSchema`, `storyMapSourceSchema`, `storySlideSchema` (ranges,
  enums, built-in defaults).
- `parser.ts` — `parseStoryMapYaml`, `parseStoryMapObject`, `parseStoryMapSourceYaml`,
  `parseStoryMapSourceObject`, `applySourceDefaults`, `normalizeStoryMapInput`,
  `toStoryMapConfig`, `extractFencedBlock`, `StoryMapParseError`.
- `helpers.ts` — `parseWikiLinkRef`, `stripFrontmatter`, `coerceLocation`, `coerceMedia`,
  `mergeResolvedSlide`, `validCoordinates`, `slideFromNoteFrontmatter`, `toTimestamp`,
  `compareNoteDates`, `sortNoteDates`, `normalizeVaultFolder`, `isPathInFolder`.

Key invariants:

- `normalizeStoryMapInput` folds Leaflet-style root keys (`lat`/`long`/`lng`,
  `defaultZoom`, `tileServer`), `location: [lat, lng]` and comma-string locations, and
  string media into the canonical shape before validation.
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
- The map is rebuilt only when `story` changes; changing slides calls `flyTo` and restyles
  markers without recreating the map.
- `ResizeObserver` calls `invalidateSize()` on the map container.
- Slide-title link behavior (`SlideTitle`):
  - `notePath` absent -> plain heading;
  - `notePath` present with `onNoteClick`/`onNoteHover` -> callback-driven link (Obsidian);
  - `notePath` present without callbacks -> normal `<a href>` (Docusaurus).
- The renderer owns semantic `--story-map-*` CSS variables with private fallbacks; hosts
  override them on an ancestor (for example `.story-map-host`). `react-story-map` never
  imports Infima or Docusaurus APIs.

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
  `noteDisplay` handling.
- `detect.ts` — `isStoryMapFile` reads `story-map: true` frontmatter.
- `settings-data.ts` / `settings-tab.ts` — plugin defaults and their UI, with searchable
  setting definitions on Obsidian 1.13+ and imperative rendering on 1.8–1.12.
  Reset redraws the fixed rows using legacy-compatible APIs; it does not call 1.13's
  `SettingsTab.update()`.
- `constants.ts` — view type, fence language, hover-link identifiers.
- `esbuild.config.mjs` — bundles `src/main.tsx` to `dist/main.js` (CJS, `obsidian`
  external) and copies CSS/manifest/versions.

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
  local media against `assetBase`.
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
- Explicit `slides` keep their exact order; `noteFolder` is ignored when they exist.

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
| `order` | `asc` | yes |
| `dateField` | `date-created` | yes |
| `noteDisplay` | `link` | yes |
| `map.center` | — | no (document only) |
| `map.zoom` | `6` | yes |
| `map.minZoom`, `map.maxZoom` | — | yes |
| `map.tileUrl` | OpenStreetMap standard | yes |
| `map.attribution` | `© OpenStreetMap contributors` | yes |
| `map.showPath` | `true` | yes |
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
- `full` — basics plus the frontmatter-stripped note body as slide text.

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
- Theme adaptation lives in a host CSS bridge (`examples/docusaurus/story-map-theme.css`)
  that maps Infima variables onto the renderer's `--story-map-*` variables.
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
URL. `.github/workflows/pages.yml` builds `@story-map/site` with its dependencies and
publishes `site/dist` through GitHub Actions Pages (`SITE_BASE` defaults to the repository
name); no `gh-pages` branch is used.

Plugin artifacts land in `packages/obsidian-story-map/dist/` as `main.js`, `manifest.json`,
`styles.css`, `versions.json`, and `THIRD_PARTY_NOTICES.txt`; install the JavaScript,
manifest, CSS and notices in `<Vault>/.obsidian/plugins/geo-story-map/`.
Repository-root `manifest.json` and `versions.json` are canonical plugin metadata;
`esbuild.config.mjs` copies them into the plugin output. The first release is desktop-only.
The plugin is named Geo Story Map, with ID `geo-story-map`, host view type
`geo-story-map-view` and hover source `geo-story-map`. Markdown syntax and npm names
remain unchanged. The build gathers full licenses from actual bundled dependency inputs,
writes a notice file and appends the same notices as comments to `main.js` for automatic
Obsidian installs. `scripts/check-obsidian-release.mjs` validates metadata and a bundled
CommonJS import with only Obsidian external.
The Obsidian-only `build/react-script-policy.mjs` disables React DOM's unused script
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
| `packages/story-map-core/src/parser.test.ts` | parsing, normalization, defaults, ordering, fence extraction, helpers |
| `packages/react-story-map/src/StoryMap.test.tsx` | slide-title rendering: plain heading, browser-link fallback, callback anchor |
| `packages/obsidian-story-map/src/resolver.test.ts` | explicit slides, folder discovery, note display, media resolution |
| `packages/obsidian-story-map/src/settings-data.test.ts` | settings → source defaults mapping |
| `packages/obsidian-story-map/src/main.test.ts` | scoped routing, explicit Markdown mode and wrapper ownership on disable |
| `packages/remark-story-map/src/index.test.ts` | fence transform, document flag, `VaultIndex`, folder discovery, `noteDisplay`, source-relative media, scan exclusions, host route resolver |

The examples and the landing site have no automated tests; verify them manually.

## 11. Where to change what

| Change | Touch |
| --- | --- |
| Schema/defaults/normalization | `story-map-core` (`schema.ts`, `parser.ts`, `types.ts`) + `parser.test.ts` |
| Rendering, navigation, markers, media, note links | `react-story-map/src/StoryMap.tsx`, `styles.css`, `StoryMap.test.tsx` |
| Obsidian view, commands, settings, detection | `obsidian-story-map/src/*` |
| Obsidian note/media resolution | `obsidian-story-map/src/resolver.ts` |
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

They are archival; the current contract is `SPEC.md` plus this document.

Obsidian release automation lives in `.github/workflows/release-obsidian.yml`: it validates
plain tags, builds/tests, attests the three release assets and publishes new releases.
Manual dispatch attests an existing release only after comparing all three files. Full
license notices remain embedded in `main.js`; the generated text file stays local.
