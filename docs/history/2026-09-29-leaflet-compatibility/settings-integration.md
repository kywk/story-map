# Leaflet Settings Integration

## 1. Principle

Absorb settings that represent durable map/user concepts. Reject settings that only exist because of the historical plugin's internal persistence or icon implementation.

## 2. Decision matrix

| Historical Leaflet setting | Decision | StoryMap target |
|---|---|---|
| Default Latitude | Adapt | `leafletCompatibility.defaultCenter` only |
| Default Longitude | Adapt | `leafletCompatibility.defaultCenter` only |
| Default Units | Adopt | `leafletCompatibility.unitSystem` |
| Default Tile Server | Adopt | light `TileSource.url` |
| Default Tile Server (Dark Mode) | Adopt | optional dark `TileSource.url` |
| Tile Server Subdomains | Adopt | `TileSource.subdomains` |
| Tile Server Attribution | Adopt | `TileSource.attribution` |
| Default Map Marker | Adopt concept | portable marker registry |
| Additional Map Markers | Adopt concept | portable marker registry |
| Marker Icon Name | Adapt | portable symbol/image; no FA contract |
| Upload Image | Adapt | image marker definition |
| Marker Color | Adopt | marker definition |
| Associated Tags | Adopt | tag-to-type fallback |
| Marker Min Zoom | Adopt | marker visibility |
| Marker Max Zoom | Adopt | marker visibility |
| Layer Base Marker | Reject | historical Font Awesome composition detail |
| Default Marker Tooltip Behavior | Adopt | `always/hover/never` |
| Display Note Preview | Adapt | Obsidian host callback/default |
| Display Overlay Tooltips | Defer | implement with overlay phase |
| Copy Coordinates on Shift-Click | Adopt | generic interaction + clipboard host behavior |
| Enable Draw Mode by Default | Defer | draw phase |
| Import/Export Marker CSV | Reject for core | legacy mutable-state storage |
| Default Config Directory | Reject | do not recreate plugin data store |
| Map View parameters/state | Reject | StoryMap has separate view architecture |

## 3. Settings structure

The current flat `StoryMapPluginSettings` will become unwieldy once map compatibility is added.

Use a versioned in-memory/persisted structure, with migration from current flat settings:

```ts
interface StoryMapPluginSettingsV2 {
  version: 2;

  story: {
    order?: StoryOrder;
    dateField?: string;
    noteDisplay?: StoryNoteDisplay;
  };

  map: {
    theme?: StoryMapTheme;
    zoom?: number;
    minZoom?: number;
    maxZoom?: number;

    tiles?: {
      light?: Partial<TileSource>;
      dark?: Partial<TileSource>;
    };

    showPath?: boolean;
  };

  markers: {
    defaultType: string;
    types: MarkerTypeDefinition[];
    tooltip: MarkerTooltipDisplay;
  };

  interaction: {
    notePreview: boolean;
    copyCoordinatesOnShiftClick: boolean;
  };

  leafletCompatibility: {
    defaultCenter?: [number, number];
    unitSystem?: 'metric' | 'imperial';
    diagnostics: boolean;
  };
}
```

Local AI-agent configuration remains device-local and separate as it is today.

## 4. Settings precedence

### Native `story-map`

Keep:

1. document key;
2. StoryMap plugin default;
3. built-in default.

A Leaflet-only default center must never unexpectedly center a native StoryMap.

### Legacy `leaflet`

Use:

1. fenced-block key;
2. Leaflet compatibility plugin setting;
3. built-in compatibility default.

## 5. UI sections

Recommended settings tab:

### Story

- Default order
- Default date field
- Default note display

### Map

- Default map theme
- Default zoom
- Default minimum zoom
- Default maximum zoom
- Light tile URL
- Light tile attribution
- Light tile subdomains
- Use separate dark tiles
- Dark tile URL
- Dark tile attribution
- Dark tile subdomains
- Default show path

### Markers & interaction

- Default marker type
- Marker type editor
- Default marker tooltip
- Preview linked note on hover
- Copy location on Shift-click

### Leaflet compatibility

- Default latitude
- Default longitude
- Default unit system
- Show compatibility warnings
- Import settings from Obsidian Leaflet

### Local agents

Keep the existing device-local section.

## 6. Obsidian Leaflet settings importer

Optional but recommended P1 command/button:

`Import settings from Obsidian Leaflet`

Read the old plugin's data only if present.

Import candidates:

- `defaultTile`
- `defaultTileDark`
- `defaultTileSubdomains`
- `defaultAttribution`
- `defaultMarker`
- `markerIcons`
- `displayMarkerTooltips`
- `notePreview`
- `copyOnClick`
- `defaultUnitType`
- `lat`
- `long`

Do not automatically import:

- `mapMarkers`
- overlays/shapes
- CSV state
- map-view state
- version flags
- `configDirectory`

### CARTO detection

If an imported tile URL uses `basemaps.cartocdn.com` without a key parameter, warn and do not make it the silent default.

Suggested message:

> This CARTO Basemaps URL does not contain an API key. CARTO now requires keys for Basemaps. Configure a CARTO key or switch to another tile provider.

## 7. Marker-type import

Historical marker types may depend on Font Awesome icon names and layered masks.

Do not add Font Awesome as a compatibility dependency merely to preserve that internal representation.

Importer strategy:

1. preserve type name;
2. preserve color;
3. preserve tag associations;
4. preserve min/max zoom;
5. translate a small known icon set to portable symbols if a deterministic mapping exists;
6. otherwise fall back to the default visual and emit a warning.

The user's currently observed `mapmarker` values include at least:

- `default`
- `restaurant`
- `food`
- `shop`
- `marathon`

Unknown types must remain renderable through fallback.
