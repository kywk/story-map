# Geo Story Map for Obsidian

An Obsidian plugin that opens a Markdown document as a full-screen map with paged
slides, and renders legacy `leaflet` blocks as ordinary inline maps.

[繁體中文](obsidian.zh-TW.md) · [Source syntax](syntax.md)

Desktop only. Requires Obsidian **1.8.7** or newer.

## Install

**Settings → Community plugins → Browse**, search for **Geo Story Map**, then **Install**
and **Enable**. It is in the
[community directory](https://community.obsidian.md/plugins/geo-story-map).

Manual install: download `main.js`, `manifest.json` and `styles.css` from the
[latest release](https://github.com/kywk/story-map/releases/latest) into
`<Vault>/.obsidian/plugins/geo-story-map/`, then enable the plugin.

## Use it

1. Create a Markdown document with `story-map: true` frontmatter and a
   [`story-map` block](syntax.md#the-story-map-block).
2. Add notes under the block's `noteFolder`, each marked `story-map-note: true` with a
   `location`.
3. Close and reopen the document, or run **Geo Story Map: Open as map** from the command
   palette.

**Open as Markdown** switches the same file back to editing without changing its source.

A working sample lives at
[`examples/obsidian/panel-opacity-demo.md`](../../examples/obsidian/panel-opacity-demo.md).

## Layouts

`layout.mode` is document-only: `card` (default), `full`, or `timeline`.

| Mode | Looks like |
| --- | --- |
| `card` | A floating slide card over the map. |
| `full` | A scrollable story surface beside a full-bleed map. |
| `timeline` | A dated row per entry beside the map, using `layout.full.side` and `layout.full.contentRatio`. |

A timeline row shows a date chip, a cover thumbnail, the title, a short description, and
a note chip. The list is the navigation, so there are no previous/next buttons; clicking
a row selects it and the active row scrolls into view.

Each entry's date comes from the `dateField` you configured, so the timeline and the
default ordering always read the same value. An explicit slide may set its own `date`,
which wins. Dates render as `Apr 12, 2024`.

## Note display

`noteDisplay` accepts `basic`, `link` (default), or `full`. See
[the syntax reference](syntax.md#note-display) for what each shows. In `link`, hovering
a title shows the Obsidian page preview and clicking opens the note in a new tab; the
marker tooltips in a `leaflet` block behave the same way.

## Settings

**Settings → Geo Story Map** is grouped into five sections. The grouping *is* the
defaulting boundary, and defaults resolve **per dialect**, so a legacy setting can never
change a story's rendering.

| Section | Keys | Applies to |
| --- | --- | --- |
| Story | `order`, `dateField`, `noteDisplay`, `initialSlide`, `panelOpacity` | `story-map` only |
| Map | `theme`, `zoom`, `minZoom`, `maxZoom`, `showPath` | `story-map` only |
| Map | light/dark tile URL, attribution, subdomains | both dialects |
| Markers & interaction | default marker type, marker type registry, tooltip mode, page preview, Shift-click copy | `leaflet` blocks |
| Leaflet compatibility | default center, default unit system, compatibility warnings, **Import settings from Obsidian Leaflet** | `leaflet` only |
| Local agents | executable, arguments, default agent, detection | AI lookup; device-local, outside the settings file |

Per-story values — `title`, `noteFolder`, map center, `layout`, `slides` — stay in the
document and are never defaulted here.

Resolution order is block key → plugin setting → built-in default, independently for
each dialect. Two consequences:

- A Leaflet-only default center, marker registry, tooltip default or unit system is never
  applied to a native StoryMap.
- The light/dark tile pair is the one setting both dialects read. A theme never replaces
  a configured tile URL.

Settings are stored as `version: 2`. The older flat layout is migrated on load, and an
unreadable file falls back to built-in defaults instead of failing.

### Importing from Obsidian Leaflet

**Import settings from Obsidian Leaflet** (also a command) reads the old plugin's
`data.json` **only when you ask**. That plugin is never a runtime dependency, and the
import covers durable map and marker concepts only: tile servers and subdomains,
attribution, marker types, tooltip behavior, page preview, copy-on-click, unit system, and
the default center. Mutable marker state, overlays, CSV data, map-view state and the old
config directory are not imported.

A Font Awesome icon becomes a portable symbol when a known name covers it, and otherwise
keeps the default marker visual with a warning. A CARTO Basemap URL with no API key is
reported and **not** applied, so it never becomes a silently broken default.

## Legacy `leaflet` blocks

A ` ```leaflet ` block renders as an inline map inside any normal note. It is a second
dialect with its own parser: no slides, no story layout, no panel. See
[the syntax reference](syntax.md#the-leaflet-block) for its keys.

- It uses its own `height`, never the full-view `100%`.
- `markerFolder` is resolved recursively. A note without a valid `location` is skipped.
- Shift-clicking a marker copies its `location: [lat, lng]` line when **Copy location on
  Shift-click** is enabled.
- An unreadable block reports the error inside the block and leaves the rest of the note
  intact.
- Only the `leaflet` language is registered, so every other code block keeps Obsidian's
  own renderer.

Which keys are honored is recorded per key in
[the compatibility matrix](../../docs/leaflet-compatibility.md) — including the ones that
are parsed but not yet implemented.

## AI coordinate lookup

**Find coordinates with AI** works on any active Markdown note:

1. Enter a place name (Chinese and other languages work).
2. The default local CLI agent returns ranked candidates.
3. Pick one in the list or on the interactive mini-map.
4. Choose **Update/Add frontmatter** to write `location: [lat, lng]` (plus the optional
   `mapmarker`), or **Copy to clipboard**.

Built-in agents are Codex, Claude Code, OpenCode and pi; a custom CLI can be added.
Executables, arguments, default agent and detection live under
**Settings → Geo Story Map → Local agents** and are stored in Obsidian's local storage —
never in your vault. The coordinates are advisory; confirm the candidate on the map
before writing, especially for obscure places.

## Network use

Tiles come from OpenStreetMap by default, which discloses the requested map area to the
provider. A custom `map.tileUrl` uses your provider instead. Remote slide media connects
to its configured host when displayed. The AI lookup sends only the place name you typed
to your CLI agent's model provider.

## Build from source

```bash
pnpm --filter @story-map/obsidian-story-map build
```

Copy `dist/main.js`, `dist/manifest.json`, `dist/styles.css` and
`dist/THIRD_PARTY_NOTICES.txt` into `<Vault>/.obsidian/plugins/geo-story-map/`. The
repository-root `manifest.json` and `versions.json` are canonical; the build copies them
into `dist`. See [the release guide](../../docs/obsidian-submission.md).
