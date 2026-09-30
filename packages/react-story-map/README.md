# @story-map/react-story-map

React renderer for StoryMap slides, with a Leaflet map, Markdown text, media, and
previous/next navigation. Also exports `GeoMap`, the storyless map that StoryMap itself is
built on. Requires React and React DOM 19.

## Install

```sh
npm install @story-map/react-story-map react@^19 react-dom@^19 leaflet@^1.9.4
```

Leaflet is also a package dependency; installing it directly makes its stylesheet
available to your application's bundler. Import both stylesheets once in your app's
global CSS entry or root component:

```tsx
import 'leaflet/dist/leaflet.css';
import '@story-map/react-story-map/styles.css';
```

The renderer does not import either stylesheet automatically. Your host must bundle
them and provide a visible container height.

## Minimal example

Use this as `src/main.tsx` in a React 19 application with a CSS-aware bundler such
as Vite and an HTML `<div id="root"></div>`:

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
    {
      title: 'Taipei Main Station',
      text: 'Start your **walking tour** here.',
      location: { lat: 25.0478, lng: 121.517 },
    },
    {
      title: 'Dihua Street',
      text: 'Explore the historic street.',
      location: { lat: 25.0555, lng: 121.5097 },
      notePath: '/notes/dihua-street',
    },
  ],
};

createRoot(document.getElementById('root')!).render(<StoryMap story={story} />);
```

Keep the `story` object stable between unrelated React renders for efficient updates. The
Leaflet instance remains mounted when theme, layout, or slides change. The example requests map tiles
from OpenStreetMap; supply your own `tileUrl` and attribution for another provider.

For YAML parsing and built-in defaults, use the separate
`@story-map/story-map-core` package. This renderer accepts resolved
`StoryMapConfig` data; the host resolves note contents, folder discovery, routes,
and media URLs before rendering.

## Props

| Prop | Type / default | Purpose |
| --- | --- | --- |
| `story` | `StoryMapConfig`, required | Resolved story with map options and ordered slides. |
| `initialSlide` | `number`, `0` | Zero-based initial slide index, clamped to the available slides. |
| `className` | `string` | Additional class on the outer section. |
| `onSlideChange` | `(index: number, slide: StorySlide) => void` | Called for the active slide, including initial rendering. |
| `onNoteClick` | `(notePath: string, event: MouseEvent) => void` | Host navigation handler for a linked slide title or timeline note chip. |
| `onNoteHover` | `(notePath: string, targetEl: HTMLElement, event: MouseEvent) => void` | Host preview handler for a linked slide title or timeline note chip. |
| `noteLinkClassName` | `string` | Additional class on linked slide titles and timeline note chips. |

Without note callbacks, a slide's `notePath` becomes a normal anchor `href`.
Providing either note callback prevents default click navigation; provide
`onNoteClick` as well if your host needs clicks to navigate. A title without
`notePath` renders as plain text. Both the panel heading and the timeline note chip
build their anchor through one shared helper, so a host can never see different note-link
behavior between the two surfaces. Slide text supports Markdown and GitHub-flavored
Markdown; note WikiLinks and embeds must be resolved by the host if needed.

`StoryMapProps`, `StoryMapConfig`, `StoryMapOptions`, `StoryMapTheme`,
`StoryMapLayoutOptions`, `StoryNoteDisplay`,
`StorySlide`, `StoryLocation`, and `StoryMedia` are exported as TypeScript types.

## Server rendering

The JavaScript entry is safe to import during SSR. Leaflet loads dynamically in a
client effect, so the map is initialized only in the browser. The server can render
the slide panel and the client hydrates it. Import CSS through your framework's
supported global stylesheet entry. The renderer cleans up its map on unmount and
uses `ResizeObserver`, when available, to refresh map sizing after layout changes.

## Themes and layouts

Set `story.map.theme` to `auto`, `light`, `dark`, `vintage`, `cyber`, or `atlas`. The preset
coordinates tiles, markers, path, controls, and StoryMap's content surface without
changing the tile provider. `light` and `dark` are fixed palettes; `auto` follows the host
(the Obsidian host maps it onto the native theme, other hosts use `prefers-color-scheme`).
`story.layout.mode` selects `card`, `full`, or `timeline`. Card supports
`align: left | center | right` and optional `widthRatio` (`0.20..0.80`) and
`heightRatio` (`0.20..0.95`). Full supports `side: left | right` and `contentRatio`
(`0.30..0.70`); on narrow screens its fade becomes vertical. Timeline reuses those same
`full` options — there is no `layout.timeline` block — and on narrow screens it also
becomes a vertical map band over a full-width list.

Card renders Previous/Next buttons inside the panel. Full floats circular arrows at the
left and right edges with a slide counter at the bottom center, so the whole note body
stays scrollable without hunting for the controls. All three layouts keep the active
marker clear of the overlay: a centered card (and any narrow viewport) parks it at the top
quarter, and full and timeline center it in the map area beside the story surface.

### Timeline mode

Timeline renders the map full-bleed with a scrollable story column beside it, and the list
is the navigation: there are no Previous/Next controls. Clicking a row, or pressing the
arrow keys on the StoryMap, switches slides, which makes the map `flyTo` the new marker;
the active row scrolls into view. Every slide renders as a row, not only the active one:

| Element | Class / attribute |
| --- | --- |
| Column over the map | `.story-map__timeline-column` inside `.story-map__presentation` |
| Sticky story-title header | `.story-map__timeline-header` |
| Entry list | `<ol class="story-map__timeline">` |
| Entry | `<li class="story-map__timeline-item" data-active>` when active |
| Date chip | `<time class="story-map__timeline-date" datetime="…">` |
| Cover thumbnail | `<figure class="story-map__timeline-media">` (image media only) |
| Entry title | `<h3 class="story-map__timeline-title"><button class="story-map__timeline-select" aria-current="true">` |
| Description (two-line clamp) | `.story-map__timeline-text` |
| Note link | `.story-map__timeline-note` |

`slide.date` is optional epoch milliseconds; the date chip is omitted when a slide has no
date. Dates format as `Apr 12, 2024` in a fixed `en-US`/UTC format, so server markup and
browser hydration agree and a UTC-midnight date never shifts a day. A slide's `notePath`
renders its own note chip with exactly the anchor semantics of the panel heading: a normal
`href` without host callbacks, or a callback-driven link with `data-href` when `onNoteClick`
or `onNoteHover` is provided. The chip is a sibling of the row's stretched select button and
sits above it in `z-index`, so it never nests an interactive element inside a button. Only
the existing semantic `--story-map-*` variables are used, so all six themes and the Obsidian
`auto` bridge apply without change. The section carries `data-layout="timeline"` and
`data-timeline-side={layout.full.side}`.

These semantic CSS variables are advanced, explicit host overrides:

Set these semantic CSS variables on the StoryMap or an ancestor to match your host:

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

These variables override the selected preset's panel, text, links, borders, and
navigation colors. The selected theme applies a filter only to the tile layer.

## GeoMap

`GeoMap` is the storyless map. It renders one Leaflet map with generic markers and no
story panel, navigation, or layout modes, and it is the runtime `StoryMap` itself is built
on. Use it when you have markers and a viewport but no narrative.

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
    tiles: {
      light: {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '© OpenStreetMap contributors',
      },
    },
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
| `markerTypes` | `readonly MarkerTypeDefinition[]` | Registry mapping a marker's `type` to an icon, color, tags, and zoom bounds. |
| `defaultTooltip` | `'always' \| 'hover' \| 'never'`, `hover` | Tooltip mode for markers that do not set their own. |
| `className` | `string` | Additional class on the themed root. |
| `label` | `string` | Accessible name for the map region. |
| `onNoteClick` | `(notePath: string, event: MouseEvent) => void` | Host navigation for a linked marker. |
| `onNoteHover` | `(notePath: string, targetEl: HTMLElement, event: MouseEvent) => void` | Host preview for a linked marker. |
| `noteLinkClassName` | `string` | Additional class on linked markers. |
| `onReady` | `(runtime: GeoMapRuntime \| null) => void` | Receives the live map once Leaflet exists, and `null` on teardown. |

`activeMarkerIndex`, `path`, `focusOffset`, and `rootless` also exist but are used by
`StoryMap` internally to compose this component. Prefer `StoryMap` for narrated content.

A marker whose `type` is absent from `markerTypes` still renders a marker, using the
default visual; the fallback is a dashed ring rather than a missing pin. A marker's
`minZoom` / `maxZoom` (from note `mapzoom` frontmatter, or a marker type's own bounds)
makes it appear and disappear with the zoom level. `notePath` behaves exactly like a
StoryMap slide's: a normal anchor without host callbacks, or a callback-driven link with
`data-href` when `onNoteClick` or `onNoteHover` is provided.

`GeoMap` renders the same themed `.story-map` root as `StoryMap`, so all six themes and
the `--story-map-*` variables above apply to a plain map with no extra CSS. Override them
on the `className` element or an ancestor, as for `StoryMap`.

Not implemented yet, and deliberately left inert: `map.controls` (`noUI`, `noScrollZoom`,
`recenter`, `locked`) and `map.zoomDelta`. The host parser reports these as pending, so
they are recognized rather than silently dropped; see the compatibility matrix for phases.

`GeoMapProps`, `GeoMapRuntime`, `GeoMapConfig`, `GeoMapOptions`, `TileSource`,
`TileSources`, `GeoMarker`, and `MarkerTypeDefinition` are exported as TypeScript types.

## License

MIT.
