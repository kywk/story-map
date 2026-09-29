# Target Examples

These examples describe intended behavior. They are not proof that all fields are already implemented.

## Legacy Leaflet remains valid

```leaflet
id: travel-map
height: 600px
lat: 25.033
long: 121.5654
defaultZoom: 11
markerFolder: Travel/Taipei
```

No migration to `story-map` syntax is required.

## Native StoryMap remains valid

```story-map
title: Chile Trip
noteFolder: Travel/Chile
map:
  theme: vintage
  zoom: 5
layout:
  mode: card
```

## Marker note

```yaml
---
story-map-note: true
title: Restaurant
location: [25.033, 121.5654]
mapmarker: restaurant
mapzoom: [10, 18]
tags:
  - food
---
```

The same note metadata can serve a StoryMap slide and a Leaflet-compatible marker.

## Conceptual tile settings

```yaml
map:
  theme: auto
  tiles:
    light:
      url: https://tile.openstreetmap.org/{z}/{x}/{y}.png
      attribution: © OpenStreetMap contributors
    dark:
      url: https://example.invalid/dark/{z}/{x}/{y}.png
      attribution: Example provider
```

The exact public StoryMap source syntax must remain backward compatible with `storymap/v1`; this example is a design target, not permission to break the current schema.
