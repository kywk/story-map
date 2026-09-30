# Geo Story Map

Turn Markdown notes into geographic stories with an interactive map and slides.

Obsidian adapter for StoryMap. It opens a StoryMap document as a dedicated, file-backed
full-leaf view similar to Obsidian Kanban, and renders legacy ` ```leaflet ` fenced blocks
as ordinary inline maps inside normal Markdown.

Desktop only. Requires Obsidian 1.8.7 or newer.

## Install

**Settings → Community plugins → Browse**, search for **Geo Story Map**, then **Install**
and **Enable**. It is in the
[community directory](https://community.obsidian.md/plugins/geo-story-map).

Manual install: download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/kywk/story-map/releases/latest) into
`<Vault>/.obsidian/plugins/geo-story-map/`, then enable the plugin.

## Use it

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

Notes in `noteFolder` need `story-map-note: true` and a `location`:

```markdown
---
story-map-note: true
title: Santiago
location: [-33.4489, -70.6693]
date-created: 2026-01-15
---
```

A legacy ` ```leaflet ` block renders as an inline map in any ordinary note, with markers
read from a folder — existing notes need no changes.

## Documentation

- [Obsidian guide](../../docs/guides/obsidian.md) — layouts, note display, settings
  sections, AI coordinate lookup, and what each `leaflet` key does.
- [Source syntax](../../docs/guides/syntax.md) — every key in both dialects, and the note
  frontmatter both read.
- [Leaflet compatibility](../../docs/leaflet-compatibility.md) — per-key support record.
- [Community release guide](../../docs/obsidian-submission.md) — build verification and
  release assets.

## Build

```bash
pnpm --filter @story-map/obsidian-story-map build
```

Copy `dist/main.js`, `dist/manifest.json`, `dist/styles.css` and
`dist/THIRD_PARTY_NOTICES.txt` into `<Vault>/.obsidian/plugins/geo-story-map/`. The
repository-root `manifest.json` and `versions.json` are canonical; the build copies them
into `dist`.

## Network use

Tiles come from OpenStreetMap by default, which discloses the requested map area to the
provider. A custom `map.tileUrl` uses your provider instead, and remote slide media
connects to its configured host when displayed. The optional AI coordinate lookup sends
only the place name you typed to your local CLI agent's model provider.

MIT. The build emits `THIRD_PARTY_NOTICES.txt` with the full notices for the
dependencies actually bundled into `main.js`.
