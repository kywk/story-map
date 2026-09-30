# Geo Story Map

Obsidian adapter for Geo Story Map. It opens a StoryMap document as a dedicated,
file-backed full-leaf view similar to Obsidian Kanban, and renders legacy `leaflet`
fenced blocks as ordinary inline maps inside normal Markdown.

The plugin targets desktop only. The declared minimum version is Obsidian 1.8.7, required
by the device-local agent storage and language helpers; the earlier 1.8.0 desktop checks
covered opening, Markdown switching, split-pane resize and plugin disable cleanup.

## Install

Open **Settings → Community plugins → Browse**, search for **Geo Story Map**, then select
**Install** and **Enable**. The plugin is available in the
[Obsidian community directory](https://community.obsidian.md/plugins/geo-story-map).

For manual installation, download `main.js`, `manifest.json`, and `styles.css` from the
[plugin release](https://github.com/kywk/story-map/releases/latest), place them in
`<Vault>/.obsidian/plugins/geo-story-map/`, then enable **Geo Story Map**. Dependency notices
are included in `main.js`; local builds also provide a separate notice file (see [Build](#build)).

## Network use

Maps load tiles from OpenStreetMap (`https://tile.openstreetmap.org`) by default
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

## Layouts

`layout.mode` is document-only and accepts `card` (default), `full`, or `timeline`:

- `card` — a floating slide card over the map;
- `full` — a scrollable story surface beside a full-bleed map;
- `timeline` — a dated vertical list of every entry beside the map, using the same
  `layout.full.side` and `layout.full.contentRatio` options as `full`. Each row shows a date
  chip, a cover thumbnail, the title, a short description, and a note link.

Each entry's date comes from the configured `dateField` frontmatter key, so a timeline and
the default ordering always read the same value. An explicit slide may set its own
`date` (for example `date: 2024-04-12`), which wins over the note's value. Dates render as
`Apr 12, 2024` in both Obsidian and a published site, and an unparseable `date` is a
configuration error rather than a silent drop.

`noteDisplay` applies as configured for `card` and `timeline`; the `full` layout always
shows the complete note body. A timeline renders every entry, so a row click switches slides
and the active row stays visible — there are no Previous/Next buttons in that mode.

## Note display

`noteDisplay` controls how a resolved note appears:

- `basic` — frontmatter basics only (`title`, `location`, `description`/`summary`, `cover`);
- `link` — basics plus a note link: hovering shows the Obsidian page preview and clicking
  opens the note in a new tab (default);
- `full` — the note's Markdown body (frontmatter stripped) as slide text. The body carries
  the content, so frontmatter title, cover, and date are dropped — except in a `timeline`,
  which keeps them beside the body.

Note links use the same anchor everywhere: the slide title in the card/full panel and the
per-entry note chip in a timeline both trigger the page preview and the new-tab open.

## Plugin settings

**Settings → Geo Story Map** is grouped into five sections. The grouping is also the
defaulting boundary, and defaults are resolved **per dialect** so a legacy setting can
never change a story's rendering.

| Section | Applies to | Keys |
|---|---|---|
| Story | `story-map` only | `order`, `dateField`, `noteDisplay`, `initialSlide`, `panelOpacity` |
| Map | `story-map` only | `theme`, `zoom`, `minZoom`, `maxZoom`, `showPath` |
| Map | both | light/dark tile URL, attribution, and subdomains |
| Markers & interaction | inline `leaflet` blocks | default marker type, marker type registry, default tooltip, page preview, Shift-click copy |
| Leaflet compatibility | `leaflet` only | default latitude/longitude, default unit system, show compatibility warnings, **Import settings from Obsidian Leaflet** |
| Local agents | AI lookup | device-local, stored outside the settings file |

Resolution order:

- `story-map` document: block key → plugin setting → built-in default.
- `leaflet` block: fenced-block key → Leaflet compatibility setting → built-in default.

Two consequences are worth stating explicitly:

- A Leaflet-only default center, marker registry, tooltip default, or unit system is
  never applied to a native StoryMap. A story without `map.center` is not re-centered by
  a legacy block's default.
- The light/dark tile pair is the one setting both dialects read. A tile provider is map
  data rather than story data, and the historical Obsidian Leaflet "Default Tile Server"
  is adopted straight into the light source. A theme never replaces a configured tile
  URL, and the built-in provider stays OpenStreetMap standard tiles.
- The dark tile source is carried but not switched at runtime. The renderer always
  requests the light source, and light/dark presentation comes from the map theme
  (including the `auto` tile filter below). A `leaflet` block's `darkMode` key is
  accepted and reported as a compatibility flag for the same reason.

Settings are stored as `version: 2`. The previous flat layout (`mapTheme`, `mapZoom`,
`mapTileUrl`, …) is migrated on load, carrying every value into its section, and a
partial or unreadable file falls back to the built-in defaults instead of failing.

The **Import settings from Obsidian Leaflet** button (also the command of the same name)
reads the old plugin's `data.json` through the Vault adapter **only when you ask**. The
community plugin is never a runtime dependency, and the import is limited to durable map
and marker concepts: tile servers and subdomains, attribution, marker types, tooltip
behavior, note preview, copy-on-click, unit system, and the default center. Mutable
marker state, overlays and shapes, CSV data, map-view state, version flags, and the old
config directory are not imported. A Font Awesome icon becomes a portable symbol when a
small known set covers it, and otherwise the type keeps the default marker visual with a
warning. A CARTO Basemaps URL without an API key is reported and **not** applied, so it
never becomes a silently failing default.

## Theming

The `auto` map theme (the default for `story-map` documents) follows your Obsidian theme: it
inherits Obsidian's own colors (`--background-primary`, `--text-normal`, `--text-muted`,
`--background-modifier-border`, `--interactive-accent`, and the marker/path accents), so
switching light/dark or applying a custom community theme restyles the panel, controls,
markers, and the dark-mode map treatment with no per-document config. The fixed `light` and
`dark` palettes, and the expressive `vintage`, `cyber`, and `atlas` themes, render the same
way in every host; a host can still pin exact colors by setting `--story-map-*` variables.
The same bridge is written for the inline `leaflet` block, so it follows the vault too.

The same tab also manages the device-local **Local agents** used by the AI coordinate lookup
(executable, arguments, default agent, and detection status). These are stored with
Obsidian's local storage, never in the vault or in `story-map` defaults.

## Legacy `leaflet` blocks

A `leaflet` fenced block renders as an ordinary inline map inside any Markdown note. It is
a second, independent input dialect with its own parser: it never enters the `storymap/v1`
schema, and it has no slides, story layout, or panel.

````markdown
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
````

- The block renders in the normal reading view. It uses its own `height` — never the
  forced `100%` of the full-leaf StoryMap view — and never opens a workspace view.
- `markerFolder` is a Vault-relative folder resolved **recursively**. A note with a valid
  `location` becomes a marker; a note without one is skipped, not fatal.
- A note's `mapmarker` selects a marker type through the configured registry. An unknown
  value still renders through the default visual, keeping the authored name.
- `mapzoom: [min, max]` becomes the marker's zoom visibility range.
- Marker note links open the note in a new tab and show the Obsidian page preview on
  hover, exactly like `noteDisplay: link`. The preview is gated by the interaction
  setting; the link still opens when it is off.
- Shift-clicking a marker copies its `location: [lat, lng]` line when
  **Copy location on Shift-click** is enabled.
- A block this plugin cannot read reports the error inside the block and leaves the rest
  of the note intact.
- Recognized-but-not-yet-implemented keys are listed under the map, so nothing
  authored is silently ignored. `unit` and `scale` are accepted as compatibility
  metadata for future measurement and image-map work; they are not an error.
- An authored `id` may repeat across blocks and is never rewritten. Host instance
  identity is separate from the authored id.
- Only the `leaflet` language is registered, so every other code block keeps Obsidian's
  own renderer.

A `leaflet` block uses the built-in `light` map theme, because the `auto` preset is an
Obsidian *story* chrome bridge and the `Map` section's theme, zoom, and path defaults are
`story-map` only. Tiles follow the shared light/dark tile pair.

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
- A `leaflet` block in ordinary Markdown renders as an inline map; a block that cannot be
  read reports inside itself and leaves the surrounding note intact.
- Changing a setting re-renders open StoryMap views and open inline `leaflet` blocks.
- React roots and Leaflet instances are released when a block is re-rendered, when
  Obsidian discards it, when the view is switched, and when the plugin unloads.

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
