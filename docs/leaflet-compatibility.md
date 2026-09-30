# Leaflet Compatibility

Live record of what this repository actually supports for legacy Obsidian Leaflet
(` ```leaflet `) fenced blocks. This file describes **implemented** behavior, not plans.

The approved design, settings decisions, and phase plan are archived under
[`history/2026-09-29-leaflet-compatibility/`](history/2026-09-29-leaflet-compatibility/).
That copy is the historical proposal and is not updated; this file is the source of truth.

Two rules govern the table below:

- **Recognized but unimplemented is not the same as ignored.** Every key the `leaflet`
  parser knows about but cannot yet honor produces a `GeoMapDiagnostic` naming that key.
  A key can only be marked *ignored* if the parser genuinely does not recognize it, which
  also produces a diagnostic (`leaflet-unknown-key`).
- **Nothing is marked supported without a test.** A row moves to *Supported* only when an
  automated test exercises it end to end in the relevant host.

## Status legend

| Status | Meaning |
| --- | --- |
| **Supported** | Parsed, rendered, and covered by tests. |
| **Parsed only** | Read and carried, but the behavior is not wired up. Reports a pending diagnostic. |
| **Metadata** | Accepted and stored, with no effect yet. Reports a compatibility diagnostic. |
| **Deferred** | Not implemented. Reports a phase diagnostic. |
| **Rejected** | Deliberately not cloned as portable map behavior. Reports a rejection diagnostic. |

Diagnostic codes come from `LEAFLET_DIAGNOSTIC_CODES` in `story-map-core`: `pendingP1`,
`pendingP2`, `pendingP3`, `rejected`, `unknownKey`, `compatMetadata`, `compatFlag`,
`invalidValue`, each prefixed `leaflet-`.

## Phases

| Phase | Scope | Rationale |
| --- | --- | --- |
| **P0** | Keys used by the current `kywk.github.io` content | Must be enough to retire the separate Docusaurus Leaflet runtime. |
| **P1** | Common static-map behavior | Most remaining blocks in ordinary note-taking use. |
| **P2** | File and overlay layers (GeoJSON, GPX, tile/image overlays) | Needs a layer model. |
| **P3** | Image maps, measurement, drawing, mutable state | Specialized; evaluation before coding. |

## Block keys

| Key | Phase | Status | Notes |
| --- | --- | --- | --- |
| `id` | P0 | Supported | Authored identity, passed through. May repeat across maps on one page; host instance identity is separate, so two maps sharing an id do not collide. |
| `height` | P0 | Supported | Sizes the host container. Never forced to `100%` outside the Obsidian full-leaf StoryMap view. |
| `lat` | P0 | Supported | Center latitude, with `long` / `lng`. Out-of-range values fail the block with a readable error. |
| `long` / `lng` | P0 | Supported | Center longitude. |
| `defaultZoom` | P0 | Supported | Normalizes to the map zoom. |
| `minZoom` | P0 | Supported | Map and tile-layer zoom bounds. |
| `maxZoom` | P0 | Supported | Map and tile-layer zoom bounds. |
| `markerFolder` | P0 | Supported | Vault-relative folder, resolved recursively. Accepts the historical repeated-key form, a YAML list, and a comma-separated string. A folder name containing spaces stays one folder. |
| `unit` | P0 | Metadata | Measurement-only. Accepted without a parse error; no measurement tooling exists yet. |
| `scale` | P0 | Metadata | Measurement/image. Accepted without a parse error; no effect yet. |
| `darkMode` | P0 | Metadata | Compatibility flag. Parse only: tile provider and theme are orthogonal, so it never changes `tiles` or `theme` by itself. A configured dark tile source is also not switched to yet - `resolveTileSource` always requests `light`. |
| `width` | P1 | Deferred | Generic size. |
| `markerFile` | P1 | Parsed only | Explicit note marker source, carried as a list. |
| `marker` | P1 | Parsed only | Inline static markers, carried raw. |
| `markerTag` | P1 | Parsed only | Platform note index; no Dataview dependency. |
| `filterTag` | P1 | Parsed only | Platform note filtering. |
| `linksTo` | P1 | Parsed only | Platform link index. |
| `linksFrom` | P1 | Parsed only | Platform link index. |
| `tileServer` | P1 | Parsed only | Tile source. The built-in source stays OpenStreetMap. |
| `tileSubdomains` | P1 | Parsed only | Tile source option. |
| `osmLayer` | P1 | Parsed only | Base layer control. |
| `zoomDelta` | P1 | Parsed only | Canonical `GeoMapOptions` field, but the renderer deliberately leaves it inert so the pending diagnostic stays honest. |
| `noUI` | P1 | Parsed only | Controls. |
| `noScrollZoom` | P1 | Parsed only | Interaction. |
| `recenter` | P1 | Parsed only | Controls. |
| `lock` | P1 | Parsed only | Static lock only; editing lock is P3. |
| `verbose` | P1 | Parsed only | Diagnostics/logging. |
| `geojson`, `geojsonFolder`, `geojsonColor` | P2 | Deferred | File layer. |
| `gpx`, `gpxFolder`, `gpxColor`, `gpxMarkers` | P2 | Deferred | Track layer. |
| `tileOverlay` | P2 | Deferred | Overlay tile layer. |
| `imageOverlay` | P2 | Deferred | Raster overlay. |
| `overlay`, `overlayTag`, `overlayColor` | P2 | Deferred | Shape overlays. |
| `showAllMarkers` | P2 | Deferred | Layer/filter behavior. |
| `zoomFeatures` | P2 | Deferred | Fit bounds to loaded features. |
| `image`, `layers`, `bounds`, `coordinates`, `preserveAspect` | P3 | Deferred | Image map / `CRS.Simple`. |
| `draw`, `drawColor` | P3 | Deferred | Editing. |
| `distanceMultiplier` | P3 | Deferred | Measurement. |
| `commandMarker` | — | Rejected | Obsidian command integration is a host concern, not portable map data. |
| `isMapView` | — | Rejected | Historical plugin host state. |
| `isInitiativeView` | — | Rejected | Unrelated plugin integration. |
| anything else | — | Reported | `leaflet-unknown-key`, so a typo or a renamed key is visible. |

Historical repeated keys (`markerFolder:` written twice in one block) are grouped before
YAML parsing, because a plain YAML load rejects them as duplicate keys. The grouping is
limited to an explicit set of repeatable keys at the top level, and leaves every other line
byte-identical so later error line numbers still match the authored block.

## Note frontmatter

| Field | Status | Notes |
| --- | --- | --- |
| `location` | Supported | Primary coordinate source, shared with `storymap/v1`. A note without it is skipped, not fatal. |
| `mapmarker` | Supported | Marker type. Resolution order: explicit `mapmarker`, first registry type whose tags match the note, configured default type, built-in generic default. |
| unknown `mapmarker` | Supported | Still renders a marker through the default visual; the authored name is preserved. |
| `mapzoom` | Supported | `[min, max]` normalizes to marker min/max zoom visibility and is rendered. A single value is a lower bound. |
| `title` | Supported | Marker label and link text. |
| `description` / `summary` | Supported | Marker tooltip body. |
| tags | Supported | Marker-type tag fallback, using the same frontmatter-only tag rules as `includeTags` / `excludeTags`. |
| `mapmarkers` | Deferred (P2) | Multiple markers per note. |
| `mapoverlay` | Deferred (P2) | Note-derived overlays. |

## Host behavior

| Capability | Obsidian | Docusaurus / Remark |
| --- | --- | --- |
| `leaflet` block renders | Yes, in ordinary Markdown reading view | Yes, as a map host element |
| Discriminator | n/a (code-block processor) | `data-story-map-kind="map"`, vs `"story"` for `story-map` |
| `markerFolder` resolution | Recursive Vault scan | Recursive `VaultIndex` scan, same exclusions |
| Marker order | Vault-relative path, `localeCompare` | Vault-relative path, `localeCompare` - asserted identical by a cross-host parity test |
| Published note links | Vault path + Page preview + open in new tab | Host `resolveNoteHref`; unresolvable leaves the marker unlinked |
| Theme | `leafletCompatibility.theme`, default `auto`, so an inline map follows Obsidian light/dark | `leafletDefaults.theme`; the built-in `light` when a host sets nothing |
| Diagnostics | Rendered under the map in the block | Serialized into the host payload, rendered in the same React tree as the map |
| Leaflet runtime | One per mounted map | One per page, shared by story and map hosts |
| SSR / build safety | n/a | No Node API in the browser entry; no Leaflet during build |

Both hosts resolve the same fixtures to the same map options and the same markers, in the
same order. `remark-story-map/src/parity.test.ts` runs the four production blocks through
both adapters and asserts that, so the two hosts cannot silently drift.

## Tile policy

- Built-in source: `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible
  attribution `© OpenStreetMap contributors`, exported as `DEFAULT_TILE_URL` /
  `DEFAULT_TILE_ATTRIBUTION`. The historical `{s}.tile.openstreetmap.org` form is no
  longer the default.
- CARTO Basemaps is never the default: it now requires an API key. An imported CARTO URL
  without a key parameter warns instead of silently becoming the provider.
- Theme and tile provider are orthogonal. A theme never replaces a configured `tileUrl`.
- Markdown and generated HTML are public source and public output. A provider API key is
  never a secret in a fenced block and is never serialized as if it were private. A
  browser-delivered key is a public client credential that must be provider-restricted and
  configured by the host.

## Production fixtures

`docs/history/2026-09-29-leaflet-compatibility/examples/current-vault-leaflet-blocks.md`
records the four live `kywk.github.io` blocks: Chile, Egypt, Kuala Lumpur, Xinjiang. They
use only `id`, `height`, `lat`, `long`, `minZoom`, `maxZoom`, `defaultZoom`, `unit`,
`scale`, `darkMode`, and `markerFolder`.

A broader survey of a real 33-block vault on 2026-09-30 found the same key set and
nothing outside P0:

| Key | Blocks using it |
| --- | ---: |
| `lat`, `long`, `id`, `defaultZoom` | 33 |
| `minZoom`, `maxZoom`, `scale`, `darkMode`, `unit`, `height` | 32 |
| `markerFolder` | 6 |

No P1, P2, or P3 key appeared in any of the 33. That is the practical evidence that the
P0 surface is enough to retire the historical plugin for existing content, and it also
means the four pinned fixtures understate the corpus while describing it accurately.

One of them, Xinjiang, reuses the authored id `chile-2509` from the Chile block. That
duplicate is authored content, so it is passed through unchanged; host instance identity
is derived separately so the two maps cannot collide.

These fixtures are the Phase 1 acceptance bar. `kywk.github.io` may delete
`plugins/remark-obsidian-leaflet/` and `static/js/leaflet-init.js` only after all four
pass.

## Settings

Settings adopted from the old plugin are documented in the archived
`settings-integration.md`. The live settings structure is `version: 2`, with `story`,
`map`, `markers`, `interaction`, and `leafletCompatibility` sections, migrated from the
previous flat shape without losing existing defaults. Default resolution is structurally
separated per dialect: `toSourceDefaults` can only read `story` and `map`, so a
Leaflet-only default center, marker registry, tooltip default, unit system, or theme is
unreachable from a native story map, and a story map's zoom/theme/path keys are not applied
to a `leaflet` block.

`map.tiles` is the one section both dialects read. Two independent tile settings would
contradict the approved settings structure, which adopts the historical Default Tile
Server into a single `map` section.

The importer reads the historical plugin's data from `plugins/obsidian-leaflet-plugin/`
first, then `plugins/obsidian-leaflet/` for vaults that hold it under the un-suffixed
name. The first is the community plugin's published id; reading only the second reports
"nothing to import" on a real vault while a test written against the same wrong path
still passes.

Known gaps, in the interest of not overstating support:

- A configured **dark** tile source is stored but never requested; the renderer always
  uses the light source and lets the theme's tile filter darken it. `darkMode` is parsed
  and reported, not acted on.
- **Shift-click coordinate copy** resolves the nearest marker by map projection within a
  16 px radius rather than binding a handler per marker layer, because Leaflet does not
  expose the originating layer on a propagated click and `onReady` fires once. A click on a
  marker note link is ignored, so copying does not fight navigation.
- `unitSystem` is stored for future measurement tooling. Nothing measures.

Deliberately **not** adopted: the mutable-marker CSV store, the custom config directory,
map-view persistence, Font Awesome layer composition, and command-marker / Initiative
Tracker integrations.
