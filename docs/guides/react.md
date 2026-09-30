# React

`@story-map/react-story-map` renders a story as paged slides over a Leaflet map, and
exports `<GeoMap />` for the storyless case. Requires React and React DOM **19**.

[繁體中文](react.zh-TW.md) · [Source syntax](syntax.md)

## Install

```bash
npm install @story-map/react-story-map react@^19 react-dom@^19 leaflet@^1.9.4
```

Import both stylesheets once, in your app's global CSS entry or root component:

```tsx
import 'leaflet/dist/leaflet.css';
import '@story-map/react-story-map/styles.css';
```

The renderer does not import them for you. Your host must bundle them and give the
container a visible height.

## A story

```tsx
import { createRoot } from 'react-dom/client';
import { StoryMap, type StoryMapConfig } from '@story-map/react-story-map';
import 'leaflet/dist/leaflet.css';
import '@story-map/react-story-map/styles.css';

const story: StoryMapConfig = {
  schema: 'storymap/v1',
  title: 'A walk through Taipei',
  height: '520px',
  panelOpacity: 0.85,
  map: {
    theme: 'light',
    zoom: 14,
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    showPath: true,
  },
  layout: { mode: 'card', card: { align: 'left' }, full: { side: 'left', contentRatio: 0.5 } },
  slides: [
    { title: 'Taipei Main Station', text: 'Start your **walking tour** here.', location: { lat: 25.0478, lng: 121.517 } },
    { title: 'Dihua Street', text: 'Explore the historic street.', location: { lat: 25.0555, lng: 121.5097 }, notePath: '/notes/dihua-street' },
  ],
};

createRoot(document.getElementById('root')!).render(<StoryMap story={story} />);
```

Keep the `story` object stable between unrelated renders. The Leaflet instance stays
mounted when theme, layout or slides change.

This renderer takes **resolved** config. Use
[`@story-map/story-map-core`](../../packages/story-map-core/README.md) to parse YAML and
apply defaults; your host resolves notes, folder discovery, routes and media URLs first.

### Props

| Prop | Type / default | Purpose |
| --- | --- | --- |
| `story` | `StoryMapConfig`, required | Resolved story with map options and ordered slides. |
| `initialSlide` | `number`, `0` | Zero-based initial index, clamped to the available slides. |
| `className` | `string` | Extra class on the outer section. |
| `onSlideChange` | `(index, slide) => void` | Fires for the active slide, including the first render. |
| `onNoteClick` | `(notePath, event) => void` | Host navigation for a linked title or timeline note chip. |
| `onNoteHover` | `(notePath, targetEl, event) => void` | Host preview for the same. |
| `noteLinkClassName` | `string` | Extra class on linked titles and note chips. |

Without note callbacks, `notePath` becomes a plain anchor `href`. Providing either
callback prevents default click navigation, so supply `onNoteClick` too if your host
needs clicks to navigate. Slide text supports Markdown; WikiLinks and embeds must be
resolved by the host.

## A plain map

`<GeoMap />` is the storyless map, and it is the runtime `StoryMap` is itself built on.
Use it when you have markers and a viewport but no narrative.

```tsx
import { GeoMap, type GeoMapConfig } from '@story-map/react-story-map';

const map: GeoMapConfig = {
  schema: 'geomap/v1',
  height: '500px',
  map: {
    theme: 'light',
    zoom: 11,
    minZoom: 4,
    maxZoom: 17,
    tiles: { light: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' } },
  },
  markers: [
    { location: { lat: 25.033, lng: 121.5654 }, title: 'Din Tai Fung', type: 'restaurant' },
    { location: { lat: 25.0555, lng: 121.5097 }, title: 'Dihua Street', notePath: '/notes/dihua' },
  ],
};

<GeoMap map={map} />;
```

| Prop | Type / default | Purpose |
| --- | --- | --- |
| `map` | `GeoMapConfig`, required | Resolved map options and markers. |
| `markerTypes` | `readonly MarkerTypeDefinition[]` | Registry mapping a marker's `type` to an icon, color, tags and zoom bounds. |
| `defaultTooltip` | `'always' \| 'hover' \| 'never'`, `hover` | Tooltip mode for markers that do not set their own. |
| `className` | `string` | Extra class on the themed root. |
| `label` | `string` | Accessible name for the map region. |
| `onNoteClick` / `onNoteHover` | functions | Host navigation / preview for a linked marker. |
| `noteLinkClassName` | `string` | Extra class on linked markers. |
| `onReady` | `(runtime: GeoMapRuntime \| null) => void` | The live map once Leaflet exists, `null` on teardown. |

A marker whose `type` is absent from the registry still renders, using the default
visual — the fallback is a dashed ring, not a missing pin. A marker's `minZoom` /
`maxZoom` makes it appear and disappear with the zoom level.

`map.controls` (`noUI`, `noScrollZoom`, `recenter`, `locked`) and `map.zoomDelta` are
**deliberately inert** right now, so a pending diagnostic stays honest rather than
silently pretending to work. See
[the compatibility matrix](../leaflet-compatibility.md).

## Themes, layouts, and overrides

`map.theme` is `auto`, `light`, `dark`, `vintage`, `cyber` or `atlas`. The preset
coordinates tiles, markers, path and content surface **without** changing the tile
provider. `light` and `dark` are fixed; `auto` follows the host (Obsidian maps it onto
its native theme, other hosts use `prefers-color-scheme`).

`layout.mode` is `card`, `full` or `timeline`. Card supports `align` plus optional
`widthRatio` and `heightRatio`; full supports `side` and `contentRatio`, and timeline
reuses those same `full` options. On narrow screens both full and timeline become a map
band above a full-width list. Card and full keep Previous/Next controls; timeline has
none, because its list is the navigation.

For deliberate color overrides, set the semantic variables on the component or an
ancestor:

```css
.my-story-theme {
  --story-map-bg: #18212f;
  --story-map-fg: #f3f4f6;
  --story-map-muted: #cbd5e1;
  --story-map-border: #475569;
  --story-map-accent: #93c5fd;
}
```

```tsx
<StoryMap story={story} className="my-story-theme" />
```

These override the preset's panel, text, links, borders and navigation colors. The theme
applies a filter only to the tile layer, so overriding colors never distorts the map
imagery.

`<GeoMap />` renders the same themed root, so all six themes and these variables apply
to a plain map with no extra CSS.

## Server rendering

The JavaScript entry is safe to import during SSR: Leaflet loads dynamically in a client
effect, so the server renders the panel and the browser hydrates it. The map is cleaned
up on unmount, and a `ResizeObserver` refreshes sizing after layout changes where the
browser provides one.
