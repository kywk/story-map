# @story-map/react-story-map

React renderer for StoryMap slides, with a Leaflet map, Markdown text, media, and
previous/next navigation. Requires React and React DOM 19.

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
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
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
| `onNoteClick` | `(notePath: string, event: MouseEvent) => void` | Host navigation handler for a linked slide title. |
| `onNoteHover` | `(notePath: string, targetEl: HTMLElement, event: MouseEvent) => void` | Host preview handler for a linked slide title. |
| `noteLinkClassName` | `string` | Additional class on linked slide titles. |

Without note callbacks, a slide's `notePath` becomes a normal anchor `href`.
Providing either note callback prevents default click navigation; provide
`onNoteClick` as well if your host needs clicks to navigate. A title without
`notePath` renders as plain text. Slide text supports Markdown and GitHub-flavored
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
`story.layout.mode` selects `card` or `full`. Card supports
`align: left | center | right` and optional `widthRatio` (`0.20..0.80`) and
`heightRatio` (`0.20..0.95`). Full supports `side: left | right` and `contentRatio`
(`0.30..0.70`); on narrow screens its fade becomes vertical.

Card renders Previous/Next buttons inside the panel. Full floats circular arrows at the
left and right edges with a slide counter at the bottom center, so the whole note body
stays scrollable without hunting for the controls. Both layouts keep the active marker
clear of the overlay: a centered card (and any narrow viewport) parks it at the top
quarter, and full centers it in the map area beside the article.

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

## License

MIT.
