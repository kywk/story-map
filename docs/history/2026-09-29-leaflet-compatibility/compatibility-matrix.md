# Obsidian Leaflet Compatibility Matrix

Status legend:

- **P0**: required to replace the current custom Docusaurus Leaflet plugin for active content.
- **P1**: common static-map compatibility; implement immediately after P0.
- **P2**: file/layer compatibility.
- **P3**: specialized/image/editing compatibility.
- **Reject/Host**: intentionally not cloned as portable core behavior.

## Fenced-block parameters

| Leaflet key | Target | Notes |
|---|---:|---|
| `id` | P0 | map identity |
| `height` | P0 | generic host height |
| `width` | P1 | generic size |
| `lat` | P0 | center latitude |
| `long` | P0 | center longitude |
| `defaultZoom` | P0 | normalize to map zoom |
| `minZoom` | P0 | map min zoom |
| `maxZoom` | P0 | map max zoom |
| `zoomDelta` | P1 | Leaflet zoom control |
| `darkMode` | P0 parse / P1 semantics | compatibility flag; provider/theme remain separate |
| `markerFolder` | P0 | resolve Markdown notes with location |
| `markerFile` | P1 | explicit note marker source |
| `marker` | P1 | inline static markers |
| `markerTag` | P1 | use platform note index; do not require Dataview |
| `filterTag` | P1 | platform note filtering |
| `linksTo` | P1 | platform link index |
| `linksFrom` | P1 | platform link index |
| `tileServer` | P1 | support repeated/array values |
| `tileSubdomains` | P1 | tile source option |
| `tileOverlay` | P2 | overlay tile layer |
| `osmLayer` | P1 | base layer control |
| `showAllMarkers` | P1 | layer/filter behavior |
| `zoomFeatures` | P2 | fit bounds to loaded features |
| `unit` | P0 accept / P3 measurement | keep metadata; no silent error |
| `scale` | P0 accept / P3 image/measurement | keep metadata |
| `distanceMultiplier` | P3 | measurement |
| `noUI` | P1 | controls |
| `noScrollZoom` | P1 | interaction |
| `recenter` | P1 | controls |
| `lock` | P1/P3 | static lock now; editing lock later |
| `image` | P3 | image map / CRS.Simple |
| `layers` | P3 | image layers |
| `bounds` | P3 | image map |
| `coordinates` | P3 | image/coordinate source semantics |
| `preserveAspect` | P3 | image map |
| `imageOverlay` | P2/P3 | raster overlay |
| `overlay` | P2 | shape/measurement overlay |
| `overlayTag` | P2 | note-derived overlays |
| `overlayColor` | P2 | overlay style |
| `geojson` | P2 | file layer |
| `geojsonFolder` | P2 | file discovery |
| `geojsonColor` | P2 | style |
| `gpx` | P2 | track layer |
| `gpxFolder` | P2 | file discovery |
| `gpxColor` | P2 | style |
| `gpxMarkers` | P2 | start/end/waypoint markers |
| `draw` | P3 | editing |
| `drawColor` | P3 | editing style |
| `commandMarker` | Host/Reject | Obsidian command integration, not generic map data |
| `verbose` | P0/P1 | map to diagnostics/logging |
| `isMapView` | Reject | historical plugin host state |
| `isInitiativeView` | Reject | unrelated plugin integration |

## Note frontmatter

| Field | Target | Notes |
|---|---:|---|
| `location` | P0 | already shared |
| `mapmarker` | P0 | marker type |
| `mapzoom` | P1 | marker min/max visibility |
| `mapmarkers` | P1/P2 | multiple note markers |
| `mapoverlay` | P2 | note overlays |
| `title` | P0 | popup/link label |
| `description` / `summary` | P0/P1 | marker tooltip/popup content |
| tags | P1 | marker-type fallback / filtering |

## Historical plugin settings

See `settings-integration.md` for adopt/adapt/defer/reject decisions.

## Phase 1 production fixture coverage

The active `kywk.github.io` Leaflet maps found during analysis use:

- `id`
- `height`
- `lat`
- `long`
- `minZoom`
- `maxZoom`
- `defaultZoom`
- `unit`
- `scale`
- `darkMode`
- `markerFolder`

No active production fixture found using:

- `markerFile`
- `markerTag`
- `geojson`
- `gpx`
- `tileServer`
- `image`

Therefore Phase 1 can retire the current custom Docusaurus Leaflet runtime without waiting for P2/P3.
