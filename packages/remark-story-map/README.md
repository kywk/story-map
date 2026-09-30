# @story-map/remark-story-map

Build-time Remark adapter and browser client for publishing maps from a Docusaurus site.
It handles two fenced-block dialects:

- ` ```story-map ` — a story: slides, a layout, and a panel.
- ` ```leaflet ` — a legacy storyless map: markers from notes, no slides.

At build time each block is parsed with the matching `story-map-core` parser, optionally
resolved against a Vault, and replaced with a
`.story-map-host[data-story-map-config]` placeholder carrying an explicit
`data-story-map-kind` discriminator. No Leaflet map is created during the Node/SSR build.
In the browser, one client entry mounts the shared renderer into every host, including
after Docusaurus SPA navigation.

```sh
npm install @story-map/remark-story-map react@^19 react-dom@^19
```

- Build entry: `@story-map/remark-story-map` (Node APIs allowed).
- Browser entry: `@story-map/remark-story-map/client` (no Node APIs).
- React and React DOM are peer dependencies; both must be React 19.

```js
import remarkStoryMap from '@story-map/remark-story-map';

export default {
  presets: [['classic', { docs: { remarkPlugins: [[remarkStoryMap, { vaultRoot, resolveNoteHref }]] } }]],
  plugins: ['./plugins/story-map-client'],
};
```

Both dialects emit the same host element and share one client, so a page holding a story
and a map loads the renderer — and therefore Leaflet — exactly once.

`data-story-map-instance` is host instance identity, numbered per transformed file. It is
deliberately **not** derived from the authored map `id`: existing content reuses ids
across maps, and two blocks on one page must not collide.

**Published routes are the host's decision.** This package never implements Docusaurus
slug or permalink policy; it only calls your `resolveNoteHref` callback. Return
`undefined` and the link is left unlinked rather than guessed.

**Nothing authored is silently dropped.** A recognized-but-unimplemented `leaflet` key
becomes a `GeoMapDiagnostic` naming that key, and an unrecognized key is reported
separately.

## Documentation

- [Docusaurus guide](../../docs/guides/docusaurus.md) — registration, options, route
  resolution, the emitted host element, and the `auto` theme bridge.
- [Source syntax](../../docs/guides/syntax.md) — every key in both dialects.
- [Leaflet compatibility](../../docs/leaflet-compatibility.md) — the authoritative
  per-key support record.
- [`examples/docusaurus/`](../../examples/docusaurus) — a client plugin, a config snippet,
  and a theme bridge.

MIT.
