# @story-map/react-story-map

React renderer for StoryMap slides over a Leaflet map, plus `GeoMap` — the storyless map
that `StoryMap` is itself built on. Requires React and React DOM 19.

```sh
npm install @story-map/react-story-map react@^19 react-dom@^19 leaflet@^1.9.4
```

```tsx
import { StoryMap, type StoryMapConfig } from '@story-map/react-story-map';
import 'leaflet/dist/leaflet.css';
import '@story-map/react-story-map/styles.css';

createRoot(root).render(<StoryMap story={story} />);
```

The renderer does not import either stylesheet for you, and the container needs a visible
height. It accepts **resolved** config: parsing, defaults and note resolution happen in
[`@story-map/story-map-core`](../story-map-core/README.md) or your host.

A plain map, with no narrative:

```tsx
import { GeoMap, type GeoMapConfig } from '@story-map/react-story-map';

<GeoMap map={map} markerTypes={[{ id: 'restaurant', icon: { kind: 'symbol', value: '🍴' } }]} />;
```

## Documentation

- [React guide](../../docs/guides/react.md) — props, themes, layouts, SSR, CSS variables.
- [Source syntax](../../docs/guides/syntax.md) — the config keys these components accept.
- [Leaflet compatibility](../../docs/leaflet-compatibility.md) — which legacy keys are
  honored, and what `GeoMap` deliberately leaves inert.

MIT.
