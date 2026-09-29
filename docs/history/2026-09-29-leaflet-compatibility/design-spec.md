# Design Specification — GeoMap and Leaflet Compatibility

## 1. Goal

Extend StoryMap so one codebase owns Leaflet rendering for both storytelling and ordinary maps, while preserving existing `story-map` behavior and supporting legacy Obsidian Leaflet source.

## 2. Architecture

### 2.1 Input dialects

Two authored dialects are first-class:

```text
```story-map
...
```
```

and:

```text
```leaflet
...
```
```

They do not share the same source schema.

### 2.2 Canonical render models

Introduce a generic map render model:

```ts
interface GeoMapConfig {
  schema: 'geomap/v1';
  id?: string;
  height: string;
  map: GeoMapOptions;
  markers: GeoMarker[];
  overlays?: GeoOverlay[];
  geojson?: GeoJsonSource[];
  gpx?: GpxSource[];
  images?: ImageLayer[];
  diagnostics?: GeoMapDiagnostic[];
}
```

The first implementation only needs fields required by the active compatibility phase. Keep future layer fields optional; do not build them until scheduled.

`StoryMapConfig` remains the Story model. Its existing public source shape should remain compatible.

`StoryMap` derives the map-facing marker/path representation from slides and renders the shared `GeoMap` foundation.

### 2.3 Shared options

A conceptual target:

```ts
interface TileSource {
  url: string;
  attribution: string;
  subdomains?: string | string[];
  minZoom?: number;
  maxZoom?: number;
}

interface TileSources {
  light: TileSource;
  dark?: TileSource;
}

interface GeoMapOptions {
  center?: [number, number];
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  zoomDelta?: number;

  theme: StoryMapTheme;

  tiles: TileSources;

  controls?: {
    noUI?: boolean;
    noScrollZoom?: boolean;
    recenter?: boolean;
    locked?: boolean;
  };
}
```

This is the target internal model, not permission to break `storymap/v1`.

### 2.4 Backward compatibility for StoryMap tile fields

Current `storymap/v1` exposes `map.tileUrl` and `map.attribution`.

Do not remove them in this work.

Preferred migration strategy:

- accept the old fields indefinitely for `storymap/v1`;
- add richer tile-source fields additively or normalize them into an internal `GeoMapOptions`;
- keep published 0.3.x consumers working;
- if a canonical public StoryMap schema must eventually change, schedule that separately as a versioned schema/semver decision.

## 3. Tile provider design

### 3.1 P0 default

Use:

`https://tile.openstreetmap.org/{z}/{x}/{y}.png`

with visible OSM attribution.

Do not use the historical `{s}.tile.openstreetmap.org` form as the built-in default.

Do not use CARTO as the built-in default.

### 3.2 Theme/provider separation

A StoryMap theme is visual presentation.

A tile provider is map data/rendered background.

They must be orthogonal:

```text
theme: vintage + OSM tiles
theme: dark    + custom tiles
theme: auto    + light/dark provider pair
```

Do not encode provider selection into theme names.

### 3.3 Credentials

Markdown and static HTML are public source/output.

Do not model provider API keys as secrets in fenced blocks.

If a host supports a keyed provider, resolve credentials through host configuration and make it explicit that browser-delivered keys are public client credentials and must be provider-restricted.

## 4. Marker model

Introduce portable marker definitions:

```ts
type MarkerTooltipDisplay = 'always' | 'hover' | 'never';

interface MarkerTypeDefinition {
  id: string;
  icon?: {
    kind: 'symbol' | 'image';
    value: string;
  };
  color?: string;
  tags?: string[];
  minZoom?: number;
  maxZoom?: number;
}

interface GeoMarker {
  id?: string;
  type?: string;
  location: {
    lat: number;
    lng: number;
  };
  title?: string;
  description?: string;
  notePath?: string;
  minZoom?: number;
  maxZoom?: number;
  tooltip?: MarkerTooltipDisplay;
}
```

Do not make Font Awesome part of the cross-platform contract.

### 4.1 Marker type precedence

For note-derived markers:

1. explicit note `mapmarker`;
2. first configured marker type whose associated tag matches;
3. configured default marker type;
4. built-in generic default.

Unknown `mapmarker` values must not crash rendering; preserve the type for diagnostics and visually fall back to the default definition.

### 4.2 `mapzoom`

Leaflet-compatible note frontmatter:

```yaml
mapzoom: [5, 18]
```

normalizes to marker visibility:

```text
minZoom = 5
maxZoom = 18
```

This is a real GeoMap capability, not parser-only compatibility.

## 5. Leaflet compatibility parser

Do not route the `leaflet` dialect through the `story-map` Zod schema.

Create a dedicated parser/normalizer.

It must support both:

- YAML-style arrays; and
- historical repeated-key Leaflet syntax for repeatable keys.

Example legacy syntax:

```yaml
markerFolder: A
markerFolder: B
```

must normalize as two folders rather than being lost to a normal YAML duplicate-key parse.

Return diagnostics:

```ts
interface GeoMapDiagnostic {
  level: 'warning' | 'error';
  code: string;
  key?: string;
  message: string;
}
```

Never silently discard a recognized but unsupported key.

## 6. Platform responsibilities

### `story-map-core`

Own:

- `GeoMapConfig` types;
- Leaflet compatibility parser;
- normalization;
- diagnostics;
- marker type resolution helpers;
- pure `mapzoom` coercion;
- no DOM/React/Leaflet/fs/Obsidian imports.

### `react-story-map`

Own:

- `<GeoMap />`;
- Leaflet instance lifecycle;
- tiles;
- generic markers;
- zoom visibility;
- generic tooltips;
- coordinate interaction callbacks;
- shared resize/invalidate behavior;
- StoryMap composition on top.

Remain SSR-import-safe.

### `obsidian-story-map`

Own:

- `registerMarkdownCodeBlockProcessor('leaflet', ...)`;
- Vault-relative `markerFolder` resolution;
- note hover preview callback;
- open-note behavior;
- plugin settings and settings migration/import;
- optional Shift-click clipboard integration;
- no dependency on Obsidian Leaflet at runtime.

### `remark-story-map`

Own:

- transform of both `story-map` and `leaflet` code nodes;
- build-time Vault resolution;
- route resolution through host hook;
- one browser client lifecycle;
- serialized discriminator such as `data-story-map-kind="story|map"`;
- no Leaflet initialization during build.

## 7. Docusaurus runtime convergence

Target:

```text
remark-story-map
    |
    +-- story-map --> StoryMap host
    |
    +-- leaflet ---> GeoMap host
                       |
                       v
              one browser client
                       |
                       v
                 one Leaflet runtime
```

After integration, `kywk.github.io` should be able to remove:

- `plugins/remark-obsidian-leaflet/`
- `static/js/leaflet-init.js`
- old Leaflet-specific runtime CSS that is superseded by StoryMap
- `remarkLeaflet` registration in `docusaurus.config.ts`

Do this only after compatibility fixtures pass.

## 8. Explicit non-goals for the first implementation

Do not block Phase 1 on:

- GPX;
- GeoJSON;
- image maps / `CRS.Simple`;
- drawing/editing;
- mutable marker persistence;
- CSV import/export;
- command markers;
- Initiative Tracker integration;
- exact Font Awesome icon parity;
- every historical UI control.

Preserve these in the compatibility matrix and diagnostics.
