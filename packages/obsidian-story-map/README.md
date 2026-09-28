# Geo Story Map

Obsidian adapter that opens a StoryMap document as a dedicated, file-backed full-leaf
view similar to Obsidian Kanban.

The plugin targets desktop only. The declared minimum version is Obsidian 1.8.7, required
by the device-local agent storage and language helpers; the earlier 1.8.0 desktop checks
covered opening, Markdown switching, split-pane resize and plugin disable cleanup.

## Install

Open **Settings → Community plugins → Browse**, search for **Geo Story Map**, then select
**Install** and **Enable**. The plugin is available in the
[Obsidian community directory](https://community.obsidian.md/plugins/geo-story-map).

For manual installation, download `main.js`, `manifest.json`, and `styles.css` from the
[plugin release](https://github.com/kywk/story-map/releases/tag/0.2.1), place them in
`<Vault>/.obsidian/plugins/geo-story-map/`, then enable **Geo Story Map**. Dependency notices
are included in `main.js`; local builds also provide a separate notice file (see [Build](#build)).

## Network use

Maps load tiles from OpenStreetMap (`https://{s}.tile.openstreetmap.org`) by default
to display geographic context. Tile requests disclose the requested map area and normal
connection information to the tile provider. A custom `map.tileUrl` uses the configured
provider instead. Remote slide images, videos, iframes and Markdown images connect to
their configured hosts when displayed; linked notes open through Obsidian.
Map tiles need a network connection unless supplied by a locally accessible provider.

The optional **Find coordinates with AI** command runs a local CLI agent. The place name you
enter is sent to that CLI's configured model provider; nothing else from the vault is sent.
See [AI coordinate lookup](#ai-coordinate-lookup).

A StoryMap document is a normal Markdown file with:

```yaml
---
story-map: true
---
```

and one fenced `story-map` configuration block:

````markdown
```story-map
title: Chile Trip
noteFolder: Travel/Chile/Places
order: asc
dateField: date-created
noteDisplay: link
includeTags: [travel, chile]
excludeTags: [draft]
map:
  theme: vintage
  center: [-33.4489, -70.6693]
  zoom: 5
  showPath: true
layout:
  mode: full
  full:
    side: left
    contentRatio: 0.5
```
````

## Note display

`noteDisplay` controls how a resolved note appears in the slide panel:

- `basic` — frontmatter basics only (`title`, `location`, `description`/`summary`, `cover`);
- `link` — basics plus a title link: hovering shows the Obsidian page preview and clicking opens
  the note in a new tab (default);
- `full` — basics plus the note's Markdown body (frontmatter stripped) as slide text.

## Plugin settings

**Settings → Geo Story Map** provides defaults for keys a document's `story-map` block omits:
`order`, `dateField`, `noteDisplay`, and the `map` keys `theme`, `zoom`, `minZoom`, `maxZoom`,
`tileUrl`, `attribution`, and `showPath`.

Resolution order per key: document block → plugin setting → built-in default. Changing a
setting re-renders open StoryMap views immediately. Per-story values — `schema`, `id`, `title`,
`noteFolder`, `includeTags`, `excludeTags`, `map.center`, `layout`, `slides`, and `height` — stay in the
document and have no setting; the full-leaf Obsidian view always fills the pane.

## Theming

The `auto` map theme (the default) follows your Obsidian theme: it inherits Obsidian's own
colors (`--background-primary`, `--text-normal`, `--text-muted`,
`--background-modifier-border`, `--interactive-accent`, and the marker/path accents), so
switching light/dark or applying a custom community theme restyles the panel, controls,
markers, and the dark-mode map treatment with no per-document config. The fixed `light` and
`dark` palettes, and the expressive `vintage`, `cyber`, and `atlas` themes, render the same
way in every host; a host can still pin exact colors by setting `--story-map-*` variables.

The same tab also manages the device-local **Local agents** used by the AI coordinate lookup
(executable, arguments, default agent, and detection status). These are stored with
Obsidian's local storage, never in the vault or in `story-map` defaults.

## AI coordinate lookup

Run **Find coordinates with AI** from the command palette while any Markdown note is active:

1. enter a place name — Chinese and other languages are supported;
2. the default local CLI agent returns ranked candidate places;
3. pick one in the modal list or on the interactive OpenStreetMap mini-map;
4. choose **Update/Add frontmatter** to write `location: [lat, lng]` (and the optional
   `mapmarker`) to the active note, or **Copy to clipboard** to copy the same
   `location: [lat, lng]` line and paste it yourself.

Built-in agents are Codex, Claude Code, OpenCode and pi; a custom CLI can be added. Detection,
testing and defaults live under **Settings → Geo Story Map → Local agents**. This feature is
desktop-only, and the AI coordinates are advisory — confirm the candidate on the map before
writing, especially for obscure places.

## Behavior

- A detected document opens in the full-leaf StoryMap view by default.
- `Open as Markdown` (command, file menu, and the StoryMap view's pane menu) switches the same
  file back to the normal Markdown view without changing its source; `Open as Geo Story Map`
  returns it to the StoryMap view.
- `noteFolder` recursively discovers Markdown notes with `story-map-note: true`; explicit
  `slides` keep their exact configured order and are never appended to.
- `includeTags`/`excludeTags` narrow folder discovery by frontmatter tags (any-of,
  case-insensitive); they do not affect explicit slides.
- Notes may reuse Leaflet-compatible `location`, `mapmarker`, `mapzoom`, `title`,
  `description`/`summary`, and `cover`/`image`/`media` frontmatter.
- In `noteDisplay: link`, the slide title opens the note in a new tab and shows the Obsidian page
  preview on hover (via a registered `hover-link` source).
- Invalid YAML or a missing block renders an in-view error instead of breaking the workspace.

The adapter reads the StoryMap configuration from the document's `story-map` fenced block;
multiple configuration blocks per document are out of scope for v1.

## Build

```bash
pnpm --filter @story-map/obsidian-story-map build
```

Copy `dist/main.js`, `dist/manifest.json`, `dist/styles.css`, and
`dist/THIRD_PARTY_NOTICES.txt` into:

```text
<Vault>/.obsidian/plugins/geo-story-map/
```

The repository-root `manifest.json` and `versions.json` are canonical; the build copies
them into `dist`. See [release instructions](../../docs/obsidian-submission.md) for release assets and verification.

## License

MIT. The build emits `THIRD_PARTY_NOTICES.txt` containing the full notices for the
dependencies actually bundled into `main.js`; keep it with manual distributions.
