# Multi-Agent Task Plan

The PM/integrator owns cross-package public contracts and final integration.

## Agent A — Core model and parser

**Ownership:** `packages/story-map-core/**`

### Deliver

- GeoMap types
- TileSource types
- GeoMarker types
- diagnostics
- Leaflet parser
- repeated-key compatibility
- P0 normalization
- `mapzoom` helper if scheduled in the same iteration
- tests

### Constraints

- no DOM
- no React
- no Leaflet import
- no Node filesystem
- preserve existing StoryMap parser behavior
- do not redesign public types without PM approval

### Prompt

Implement the framework-agnostic GeoMap model and dedicated Obsidian Leaflet compatibility parser described in the 2026-09-29 handoff. Preserve `storymap/v1`. Handle legacy repeated keys explicitly. Add diagnostics for recognized unsupported keys. Use the exact current OSM tile URL as the built-in default. Cover the current production fixtures with parser tests.

---

## Agent B — React GeoMap renderer

**Ownership:** `packages/react-story-map/**`

### Deliver

- `<GeoMap />`
- shared Leaflet lifecycle
- generic tile rendering
- generic markers
- cleanup/resize
- StoryMap composition/refactor
- renderer tests

### Constraints

- SSR import-safe
- no Obsidian/Docusaurus APIs
- no React Leaflet
- do not remount map merely because Story layout changes
- retain existing StoryMap theme/layout behavior

### Prompt

Refactor the existing direct Leaflet lifecycle into a reusable platform-neutral GeoMap renderer. StoryMap must compose the shared map foundation rather than duplicating Leaflet lifecycle code. Maintain existing StoryMap behavior and tests. Add generic markers and tile-source support required by Phase 1, but do not implement deferred GPX/GeoJSON/drawing features.

---

## Agent C — Obsidian adapter and settings

**Ownership:** `packages/obsidian-story-map/**`

### Deliver

- `leaflet` Markdown code-block processor
- markerFolder resolver
- note-link/preview callbacks
- settings V2 migration
- new settings sections
- P1 settings importer if assigned
- focused tests

### Constraints

- no runtime dependency on Obsidian Leaflet
- native StoryMap full-leaf view must remain stable
- Leaflet compatibility default center must not leak into native StoryMap semantics
- AI agent local-storage behavior remains separate

### Prompt

Add ordinary Markdown `leaflet` fence support to Geo Story Map using the new core parser and GeoMap renderer. Reuse Obsidian metadata/Vault APIs for marker-folder resolution and note preview/open behavior. Implement the approved settings migration and UI without recreating Leaflet's mutable map state store. Preserve all current full-leaf StoryMap behavior.

---

## Agent D — Remark/Docusaurus adapter

**Ownership:** `packages/remark-story-map/**`

### Deliver

- dual `story-map` / `leaflet` transform
- map/story host discriminator
- markerFolder build-time resolution
- unified client mount
- SPA cleanup tests
- SSR/build safety tests

### Constraints

- do not own slug policy
- use `resolveNoteHref`
- Node APIs build-time only
- one runtime; no CDN Leaflet bootstrap
- no route guessing

### Prompt

Extend remark-story-map to transform both StoryMap and legacy Leaflet fences. Reuse VaultIndex and host route resolution. Emit platform-neutral serialized render data and have the existing browser client mount StoryMap or GeoMap based on an explicit discriminator. Preserve multiple-host SPA lifecycle and SSR safety.

---

## Agent E — Compatibility QA and integration

**Ownership:** tests/docs/fixtures; cross-package changes only with PM coordination.

### Deliver

- production fixture tests
- compatibility diagnostics assertions
- regression checklist
- current `story-map` regression coverage
- Docusaurus migration validation plan
- compatibility matrix updates based on actual implementation

### Prompt

Treat `examples/current-vault-leaflet-blocks.md` as Phase 1 acceptance fixtures. Verify source compatibility, rendering lifecycle, marker-folder resolution, route handling, OSM defaults, and StoryMap regressions. Do not mark P1/P2/P3 fields supported unless tested end to end. Update the compatibility matrix to actual state.

---

# Integrator merge order

1. root contract docs
2. Agent A
3. Agent B
4. Agents C/D
5. Agent E
6. integration fixes
7. `pnpm typecheck && pnpm test && pnpm build`
8. manual smoke tests
9. secondary `kywk.github.io` migration
