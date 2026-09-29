# Acceptance Checklist

## Repository gates

- [ ] `pnpm typecheck`
- [ ] `pnpm test`
- [ ] `pnpm build`

## StoryMap regression

- [ ] existing `story-map` parser tests pass
- [ ] noteFolder ordering/filtering unchanged
- [ ] noteDisplay behavior unchanged
- [ ] card/full layouts unchanged
- [ ] theme presets unchanged
- [ ] Obsidian full-leaf view switching unchanged
- [ ] Docusaurus SPA mount/unmount unchanged

## GeoMap lifecycle

- [ ] Leaflet dynamic import only in browser effect
- [ ] one map per host
- [ ] clean unmount
- [ ] ResizeObserver invalidates map size
- [ ] tile changes do not leak old layers
- [ ] marker changes do not require recreating the map unnecessarily

## P0 Leaflet source compatibility

- [ ] `id`
- [ ] `height`
- [ ] `lat`
- [ ] `long`
- [ ] `minZoom`
- [ ] `maxZoom`
- [ ] `defaultZoom`
- [ ] `unit` accepted
- [ ] `scale` accepted
- [ ] `darkMode` accepted
- [ ] `markerFolder`
- [ ] note `location`
- [ ] note `mapmarker`
- [ ] unknown marker type fallback
- [ ] warnings for recognized deferred fields

## Obsidian

- [ ] ordinary Markdown note renders `leaflet` block
- [ ] unrelated code blocks unchanged
- [ ] marker links open notes correctly
- [ ] note preview works when enabled
- [ ] plugin disable/unload cleans React/Leaflet
- [ ] settings migration preserves existing StoryMap defaults

## Remark / Docusaurus

- [ ] `story-map` and `leaflet` code nodes both transform
- [ ] host discriminator is explicit
- [ ] Vault markerFolder resolution works
- [ ] `resolveNoteHref` owns final routes
- [ ] no local absolute path leaks into HTML
- [ ] no Node API in client bundle
- [ ] SSR/build never initializes Leaflet
- [ ] multiple map/story hosts work on one page
- [ ] SPA add/remove does not double-mount

## Tile policy

- [ ] default URL is `https://tile.openstreetmap.org/{z}/{x}/{y}.png`
- [ ] attribution visible
- [ ] provider configurable
- [ ] CARTO is not keyless default
- [ ] no secret key semantics in Markdown

## Production fixtures

- [ ] Chile
- [ ] Egypt
- [ ] Kuala Lumpur
- [ ] Xinjiang

## Secondary repository cleanup

Only after all above:

- [ ] remove legacy remark Leaflet plugin
- [ ] remove `leaflet-init.js`
- [ ] remove Docusaurus remarkLeaflet registration
- [ ] remove superseded CSS
- [ ] rebuild/smoke test site
