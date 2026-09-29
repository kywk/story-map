# Implementation Plan — Leaflet Compatibility

## Phase 0 — Contract and baseline

### Tasks

1. Create implementation branch.
2. Run:
   - `pnpm install`
   - `pnpm typecheck`
   - `pnpm test`
   - `pnpm build`
3. Record failures before changes.
4. Update `SPEC.md`, `AGENTS.md`, and `docs/architecture.md` according to `patches/root-doc-patches.md`.
5. Add compatibility fixtures to tests.

### Exit

Implementation agents no longer conflict with obsolete root non-goals.

---

## Phase 1 — Generic GeoMap foundation and current-vault compatibility

### 1A. `story-map-core`

Implement:

- `GeoMapConfig`
- `GeoMapOptions`
- `TileSource`
- `GeoMarker`
- diagnostics types
- dedicated Leaflet compatibility parser
- legacy repeated-key handling
- P0 normalization
- tests for production fixtures
- exact OSM default URL

Do not add filesystem logic.

### 1B. `react-story-map`

Extract/refactor existing Leaflet lifecycle into reusable `<GeoMap />`.

Requirements:

- one Leaflet instance per host;
- dynamic browser-only Leaflet import;
- tile lifecycle;
- map center/zoom;
- generic markers;
- resize observer;
- cleanup;
- StoryMap continues to work and composes the shared map foundation.

No host APIs.

### 1C. `obsidian-story-map`

Add:

```ts
registerMarkdownCodeBlockProcessor('leaflet', ...)
```

Resolve:

- `markerFolder`
- note `location`
- note `mapmarker`
- linked note paths

Mount `<GeoMap />` inside ordinary Markdown rendering.

Do not alter normal Markdown view behavior outside Leaflet code blocks.

### 1D. `remark-story-map`

Recognize:

- `story-map`
- `leaflet`

Emit a renderer discriminator:

```text
story | map
```

Reuse `VaultIndex` for marker-folder resolution.

Browser client mounts either `<StoryMap />` or `<GeoMap />`.

Maintain SPA cleanup and SSR safety.

### 1E. Phase 1 integration tests

Use the four fixtures in `examples/current-vault-leaflet-blocks.md`.

Acceptance:

- no source edits required;
- marker folders resolve;
- title/link/location/mapmarker metadata appears correctly;
- current StoryMap tests remain green.

---

## Phase 2 — Settings convergence

### Tasks

1. Introduce versioned settings migration.
2. Reorganize settings UI:
   - Story
   - Map
   - Markers & interaction
   - Leaflet compatibility
   - Local agents
3. Implement light/dark tile source settings.
4. Implement marker registry.
5. Implement marker fallback.
6. Implement marker tooltip default.
7. Implement Shift-click coordinate copy.
8. Implement Obsidian note-preview bridge for GeoMap markers.
9. Implement optional old-Leaflet settings import.

### Exit

A user can move global behavior from Obsidian Leaflet to Geo Story Map without hand-recreating common settings.

---

## Phase 3 — P1 static compatibility

Implement and test:

- `markerFile`
- inline `marker`
- `markerTag`
- `filterTag`
- `linksTo`
- `linksFrom`
- `mapzoom`
- `tileServer`
- `tileSubdomains`
- `osmLayer`
- `zoomDelta`
- `noUI`
- `noScrollZoom`
- static lock behavior
- explicit compatibility diagnostics

Avoid Dataview dependency. Use Obsidian metadata/link indexes and Remark Vault indexes.

---

## Phase 4 — Layer compatibility

Implement independently where practical:

- GeoJSON
- GeoJSON folders
- GPX
- GPX folders
- GPX markers
- tile overlays
- image overlays
- feature fitting
- overlay tooltip behavior

Do not let these features contaminate core StoryMap slide semantics.

---

## Phase 5 — Specialized/image/editing compatibility

Evaluate before coding:

- image maps / CRS.Simple
- bounds/scale/coordinate transforms
- draw controls
- mutable marker persistence
- persistent shapes

Keep command markers and Initiative Tracker integrations outside portable GeoMap unless a separate host-specific requirement is approved.

---

## `kywk.github.io` migration

After Phase 1 package behavior is stable:

1. update `@story-map/remark-story-map`;
2. ensure the StoryMap browser client renders map hosts;
3. remove `remarkLeaflet` from `docusaurus.config.ts`;
4. remove `plugins/remark-obsidian-leaflet`;
5. remove `/static/js/leaflet-init.js`;
6. remove superseded Leaflet custom CSS;
7. build the site;
8. smoke-test Chile, Egypt, Kuala Lumpur, Xinjiang;
9. verify Docusaurus SPA navigation and light/dark behavior;
10. keep route generation owned by `contentLinkIndex`.

Do not remove the old runtime before all four fixture pages pass.
