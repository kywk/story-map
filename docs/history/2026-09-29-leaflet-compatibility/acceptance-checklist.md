# Acceptance Checklist

Status recorded on `feat/leaflet`, 2026-09-30. The live per-key support record is
[`../../../leaflet-compatibility.md`](../../../leaflet-compatibility.md); this file is the
milestone checklist and stays as the original plan.

## Repository gates

- [x] `pnpm typecheck`
- [x] `pnpm test` (546 tests: core 160, react 80, remark 124, obsidian 182)
- [x] `pnpm build`
- [x] Obsidian release check (`node scripts/check-obsidian-release.mjs`)

## StoryMap regression

- [x] existing `story-map` parser tests pass
- [x] noteFolder ordering/filtering unchanged
- [x] noteDisplay behavior unchanged
- [x] card/full layouts unchanged
- [x] theme presets unchanged
- [x] Obsidian full-leaf view switching unchanged
- [x] Docusaurus SPA mount/unmount unchanged

## GeoMap lifecycle

- [x] Leaflet dynamic import only in browser effect
- [x] one map per host
- [x] clean unmount
- [x] ResizeObserver invalidates map size
- [x] tile changes do not leak old layers
- [x] marker changes do not require recreating the map unnecessarily

## P0 Leaflet source compatibility

- [x] `id`
- [x] `height`
- [x] `lat`
- [x] `long`
- [x] `minZoom`
- [x] `maxZoom`
- [x] `defaultZoom`
- [x] `unit` accepted
- [x] `scale` accepted
- [x] `darkMode` accepted
- [x] `markerFolder`
- [x] note `location`
- [x] note `mapmarker`
- [x] unknown marker type fallback
- [x] warnings for recognized deferred fields

## Obsidian

- [x] ordinary Markdown note renders `leaflet` block
- [x] unrelated code blocks unchanged
- [x] marker links open notes correctly
- [x] note preview works when enabled
- [x] plugin disable/unload cleans React/Leaflet
- [x] settings migration preserves existing StoryMap defaults

## Remark / Docusaurus

- [x] `story-map` and `leaflet` code nodes both transform
- [x] host discriminator is explicit
- [x] Vault markerFolder resolution works
- [x] `resolveNoteHref` owns final routes
- [x] no local absolute path leaks into HTML
- [x] no Node API in client bundle
- [x] SSR/build never initializes Leaflet
- [x] multiple map/story hosts work on one page
- [x] SPA add/remove does not double-mount

## Tile policy

- [x] default URL is `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- [x] attribution visible
- [x] provider configurable
- [x] CARTO is not keyless default
- [x] no secret key semantics in Markdown

## Production fixtures

- [x] Chile
- [x] Egypt
- [x] Kuala Lumpur
- [x] Xinjiang

## Secondary repository cleanup

Only after all above:

- [ ] remove legacy remark Leaflet plugin
- [ ] remove `leaflet-init.js`
- [ ] remove Docusaurus remarkLeaflet registration
- [ ] remove superseded CSS
- [ ] rebuild/smoke test site

## How this was verified

Automated coverage backs the ticked boxes: 546 tests across the four packages, plus the
Obsidian release check. The four production fixtures are pinned as test data and run
through *both* adapters in `remark-story-map/src/parity.test.ts`, asserting identical map
options, markers, and order. No absolute path leak and no Node API in the browser bundle
are asserted directly against the transform output and the built client.

The Obsidian side was additionally opened in a real vault on 2026-09-30: the plugin was
installed into a sandbox vault, 33 live `leaflet` blocks were surveyed (all P0 keys, none
outside it), and the historical Leaflet plugin was uninstalled after its settings were
backed up for the import path. That run surfaced two defects a scripted check had missed -
the release check's Obsidian stub lacked `MarkdownRenderChild`, and the importer read the
wrong plugin directory - both fixed with regression tests.

Not verified by anyone yet: the Docusaurus site. The Remark dual-dialect transform, the
discriminator, and the one-runtime client are covered by tests, but no `kywk.github.io`
build has been run against them, so the secondary-repository items above stay open.
