# Story Map

A small, reusable Leaflet-based StoryMap stack. One Markdown source and one standard
`StoryMapConfig` render in three hosts:

- standalone React applications;
- an Obsidian plugin (file-backed full-leaf view);
- a Docusaurus site via a Remark build-time transform and browser client.

Built-in map themes (`auto`, `light`, `dark`, `vintage`, `cyber`, `atlas`) and document-owned
`card`/`full`/`timeline` layouts render through the same shared component in all three hosts.
`auto` follows the host theme (Obsidian native light/dark and colors; `prefers-color-scheme`
elsewhere), while `light`/`dark` are fixed palettes.
The [design bundle](docs/history/2026-09-28-map-theme-layout/README.md) records the milestone.

## Website

A bilingual project site (English / 繁體中文) lives in `site/` and renders several live
examples with theme, layout, alignment, and ratio controls on the shared renderer. It is
published to GitHub Pages from `main` by
`.github/workflows/pages.yml` at <https://kywk.github.io/story-map/>; run it locally with
`pnpm --filter @story-map/site dev`.

## Geo Story Map for Obsidian

Turn Markdown notes into geographic stories with an interactive map and slides.
Requires desktop Obsidian 1.8.7 or newer; mobile is not supported in this release.
The plugin is named **Geo Story Map** (`geo-story-map`); the source syntax remains
`story-map`. It does not require the separate Obsidian Leaflet plugin.

1. Open Settings → Community plugins → Browse, search for **Geo Story Map**, then install
   and enable it. See the [community listing](https://community.obsidian.md/plugins/geo-story-map).
2. Create a Markdown document using the Story syntax below, then close and reopen it,
   or run **Geo Story Map: Open as map** from the command palette.
3. Use **Open as Markdown** to edit the same document; the source stays unchanged.
4. Run **Geo Story Map: Find coordinates with AI** on a note to look up a place with a
   configured local CLI agent, confirm it on a map, and write `location` or copy it.

Add notes under the document's `noteFolder`, for example `Travel/Chile/Places/Santiago.md`:

```yaml
---
story-map-note: true
title: Santiago
location: [-33.4489, -70.6693]
date-created: 2026-01-15
description: The journey begins here.
---
```

See [the plugin guide](packages/obsidian-story-map/README.md) for settings, note display,
and manual installation.
Geo Story Map is free, needs no plugin account, and includes no telemetry. Maps request
OpenStreetMap tiles by default; configured tile providers and remote media connect to
their specified hosts. The plugin reads notes and attachments inside your vault.

## Packages

| Package | Role | Distribution |
| --- | --- | --- |
| `@story-map/story-map-core` | Framework-agnostic schema, parser, and helpers | npm |
| `@story-map/react-story-map` | React + Leaflet renderer | npm |
| `@story-map/remark-story-map` | Remark build-time transform + browser client | npm |
| `@story-map/obsidian-story-map` | Geo Story Map Obsidian view and Vault resolver | Obsidian Community plugins / GitHub Releases |

## Quick start

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

`pnpm typecheck` uses TypeScript project references (`tsc -b`), so it builds
`story-map-core` for dependents instead of relying on a stale `dist`.

Run the standalone example:

```bash
pnpm --filter @story-map/example-react dev   # http://127.0.0.1:5173
```

## Story syntax

A StoryMap document is a normal Markdown file with `story-map: true` frontmatter and one
fenced `story-map` configuration block:

````markdown
---
story-map: true
---

```story-map
schema: storymap/v1
title: Chile Trip
map:
  theme: vintage
  center: [-33.4489, -70.6693]
  zoom: 6
  showPath: true
layout:
  mode: full
  full:
    side: left
    contentRatio: 0.5
noteFolder: Travel/Chile/Places
order: asc
dateField: date-created
noteDisplay: link
includeTags: [travel, chile]
excludeTags: [draft]
```
````

`noteFolder` recursively discovers Markdown notes with `story-map-note: true`, ordered by
`dateField` using `order: asc | desc`. `includeTags` keeps notes with any listed
frontmatter tag and `excludeTags` drops notes with any listed tag (both optional). Explicit
`slides` keep their exact order and are never reordered or appended to by folder discovery.

`noteDisplay: basic | link | full` controls how resolved notes are shown (default `link`):
frontmatter basics, basics with a title link to the note, or the full frontmatter-stripped
note body. The `full` layout always uses the note body regardless of this setting. Obsidian
opens the note through host callbacks; Docusaurus renders the published route as a normal
browser link.

## Docusaurus

`remark-story-map` transforms each fence at build time into a host element and a browser
client mounts the shared renderer. Configure it with `vaultRoot`, `assetBase`, and a host
`resolveNoteHref` route callback. See `packages/remark-story-map/README.md` and
`examples/docusaurus/`.

A full-page map (Open as Story Map, with a Markdown toggle) is deliberately host UI rather
than a package option; to add it to a site, follow
[docs/docusaurus-full-page.md](docs/docusaurus-full-page.md).

## Design rule

`react-story-map` must never import Obsidian or Docusaurus APIs. Platform adapters resolve
notes, WikiLinks, Vault frontmatter, local assets, and routes into a `StoryMapConfig`
before render time.

## Documentation

- `SPEC.md` — product and architecture contract.
- `docs/architecture.md` — implementation map for contributors and agents.
- `AGENTS.md` — working agreement and definition of done.
- `RELEASING.md` — npm and Obsidian plugin release steps.
- `docs/history/` — archived plans.

## License

MIT; see [LICENSE](LICENSE). Bundled dependency notices accompany the plugin release.
