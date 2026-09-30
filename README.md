# Story Map

Turn coordinate-bearing Markdown notes into paged geographic stories.

One source document and one config render in three places: a standalone React app, the
**Geo Story Map** Obsidian plugin, and a Docusaurus site.

[繁體中文](README.zh-TW.md) · [Docs](docs/README.md)

## Install

| Where | How |
| --- | --- |
| Obsidian | Settings → Community plugins → Browse → **Geo Story Map** ([listing](https://community.obsidian.md/plugins/geo-story-map)) |
| React | `npm install @story-map/react-story-map react react-dom` |
| Docusaurus | `npm install @story-map/remark-story-map react react-dom` |

## Quick start

A StoryMap document is a normal Markdown file with `story-map: true` frontmatter and one
fenced configuration block. Add notes under the `noteFolder` you name:

````markdown
---
story-map: true
---

```story-map
title: Chile Trip
map:
  theme: vintage
  center: [-33.4489, -70.6693]
  zoom: 6
noteFolder: Travel/Chile/Places
order: asc
dateField: date-created
```
````

```markdown
<!-- Travel/Chile/Places/Santiago.md -->
---
story-map-note: true
title: Santiago
location: [-33.4489, -70.6693]
date-created: 2026-01-15
---
```

`noteFolder` finds every note marked `story-map-note: true`, recursively, and orders them by
`dateField`. Layouts are `card`, `full`, and `timeline`; map themes are `auto`, `light`,
`dark`, `vintage`, `cyber`, and `atlas`.

You can also paste a legacy ` ```leaflet ` block from the old Obsidian Leaflet plugin and it
renders as a plain map, with markers read from a folder — no migration of your notes.

## Working on this repository

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @story-map/example-react dev   # http://127.0.0.1:5173
```

## Documentation

**Start here**

| Guide | What it covers |
| --- | --- |
| [Source syntax](docs/guides/syntax.md) | Every `story-map` and `leaflet` block key, and the note frontmatter both read. |
| [Geo Story Map for Obsidian](docs/guides/obsidian.md) | Install, settings, layouts, note display, AI coordinate lookup. |
| [Docusaurus](docs/guides/docusaurus.md) | Publishing stories and legacy maps on a site. |
| [React](docs/guides/react.md) | Embedding `<StoryMap />` and `<GeoMap />` directly. |

**Reference and contributor docs**

| Document | What it covers |
| --- | --- |
| [`SPEC.md`](SPEC.md) | Product and architecture contract. |
| [`docs/architecture.md`](docs/architecture.md) | Implementation map: packages, data flow, files, APIs. |
| [`docs/leaflet-compatibility.md`](docs/leaflet-compatibility.md) | Which legacy `leaflet` keys actually work, and which do not. |
| [`AGENTS.md`](AGENTS.md) | Working agreement and definition of done. |
| [`RELEASING.md`](RELEASING.md) | npm and Obsidian plugin release steps. |
| [`docs/acceptance/`](docs/acceptance/) | Verification evidence. |
| [`docs/history/`](docs/history/) | Archived plans. Superseded, not authoritative. |

## Design rule

`react-story-map` never imports Obsidian or Docusaurus APIs. Each adapter resolves notes,
frontmatter, media and routes into a config *before* render time, so the renderer has one
job and the same code runs in every host.

## License

MIT — see [LICENSE](LICENSE). Bundled dependency notices accompany the plugin release.
