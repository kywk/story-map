# Current Production Leaflet Fixtures

These blocks were found in the current `kywk/kywk.github.io` content and define the minimum Phase 1 source-compatibility bar.

## Chile

Source:
`backpacker/2509 Chile/Index de Chile.md`

```leaflet
id: chile-2509
height: 600px
lat: -33.0000
long: -70.0000
minZoom: 4
maxZoom: 17
defaultZoom: 5
unit: meters
scale: 1
darkMode: true
markerFolder: backpacker/2509 Chile/Chile
```

## Egypt

Source:
`backpacker/2401 Egypt/Index Pharaoh Egypt.md`

```leaflet
id: egypt-2401
height: 500px
lat: 27.50000
long: 29.50000
minZoom: 5
maxZoom: 15
defaultZoom: 6
unit: meters
scale: 1
darkMode: true
markerFolder: backpacker/2401 Egypt/Egypt
```

## Kuala Lumpur

Source:
`backpacker/2401 Egypt/Index Pharaoh Egypt.md`

```leaflet
id: kl-2401
height: 500px
lat: 3.15000
long: 101.67000
minZoom: 11
maxZoom: 17
defaultZoom: 13
unit: meters
scale: 1
darkMode: true
markerFolder: backpacker/2401 Egypt/Kuala Lumpur
```

## Xinjiang

Source:
`backpacker/2601 Xinjiang/Index Xinjiang.md`

```leaflet
id: chile-2509
height: 600px
lat: 42.0000
long: 82.0000
minZoom: 4
maxZoom: 17
defaultZoom: 5
unit: meters
scale: 1
darkMode: true
markerFolder: backpacker/2601 Xinjiang/Xinjiang
```

Note: the Xinjiang block currently reuses the ID `chile-2509`. Compatibility work should not silently rename authored IDs. If duplicate IDs become a runtime collision on the same page, generate host-instance identity separately from authored map ID.

## Marker note requirements

The current travel marker folders use Markdown frontmatter such as:

```yaml
---
title: Example Place
location: [25.033, 121.5654]
mapmarker: restaurant
---
```

Observed marker type values include:

- `default`
- `restaurant`
- `food`
- `shop`

Other repository content also uses `marathon`.

Unknown marker types must fall back visually without losing the authored type.
