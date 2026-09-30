# Source syntax

Every StoryMap document is a normal Markdown file. This page lists every key the two
fenced-block dialects accept, and the note frontmatter both of them read.

[繁體中文](syntax.zh-TW.md)

## The document

````markdown
---
story-map: true
---

```story-map
title: Chile Trip
noteFolder: Travel/Chile/Places
```
````

`story-map: true` in frontmatter is what makes a document openable as a map view. It is
not required for a `leaflet` block, which renders inline in ordinary Markdown.

## A note

A note is any Markdown file. The keys below are shared by both dialects, so a single
note can feed a story slide and a legacy map marker at once.

```markdown
---
story-map-note: true
title: Santiago
location: [-33.4489, -70.6693]
date-created: 2026-01-15
description: The journey begins here.
cover: cover.png
mapmarker: restaurant
mapzoom: [5, 12]
tags: [travel, chile]
---
```

| Key | Used by | Meaning |
| --- | --- | --- |
| `story-map-note: true` | story | Marks the note for `noteFolder` discovery. Without it the note is ignored. |
| `title` | both | Marker/label title, and the slide heading. |
| `location` | both | `[latitude, longitude]`. Required for a marker; a note without one is skipped, never an error. |
| `description` / `summary` | both | Marker tooltip body and slide text. |
| `cover` / `image` / `media` | story | Slide media. Resolved relative to the note file. |
| `date-created` (or your `dateField`) | story | Drives ordering, and fills a timeline row's date chip. |
| `mapmarker` | both | Marker type name. An unregistered value still renders, keeping the authored name. |
| `mapzoom` | both | `[min, max]` zoom range for marker visibility. A single value is a lower bound. |
| `tags` / `tag` | both | Used by `includeTags` / `excludeTags`, and as a marker-type fallback. String or list; matched case-insensitively, whitespace- and tag-prefix-tolerant. |

## The `story-map` block

CamelCase keys. This is a story: slides, a layout, and a panel.

| Key | Default | Meaning |
| --- | --- | --- |
| `schema` | `storymap/v1` | Source schema identifier. |
| `title` | — | Story title. |
| `height` | `520px` | Height of the map container. |
| `noteFolder` | — | One Vault-relative folder, scanned recursively. Ignored when `slides` is non-empty. |
| `order` | `asc` | `asc` or `desc` by `dateField`. |
| `dateField` | `date-created` | Frontmatter key holding each note's date. |
| `noteDisplay` | `link` | `basic`, `link`, or `full`. |
| `initialSlide` | `first` | `first`, `last`, or a zero-based index. |
| `panelOpacity` | `0.85` | `0.0`–`1.0` translucency of the card/article background. |
| `includeTags` | — | Keep only notes with any listed tag. |
| `excludeTags` | — | Drop notes with any listed tag. |
| `slides` | — | Explicit entries. Their order is exact and is never reordered or appended to by `noteFolder`. |
| `map.theme` | `light` | `auto`, `light`, `dark`, `vintage`, `cyber`, `atlas`. |
| `map.center` | — | `[latitude, longitude]`. |
| `map.zoom` | `6` | Initial zoom. |
| `map.minZoom` / `map.maxZoom` | — | Zoom bounds. |
| `map.tileUrl` | OpenStreetMap | Tile template. A theme never replaces it. |
| `map.attribution` | `© OpenStreetMap contributors` | Shown on the map. |
| `map.showPath` | `true` | Draw a line connecting the slides in order. |
| `layout.mode` | `card` | `card`, `full`, or `timeline`. Document-only. |
| `layout.card.align` | `left` | `left`, `center`, `right`. |
| `layout.card.widthRatio` / `heightRatio` | — | `0.20..0.80` and `0.20..0.95`. |
| `layout.full.side` | `left` | `left` or `right`. Also used by `timeline`. |
| `layout.full.contentRatio` | `0.5` | `0.30..0.70`. Also used by `timeline`. |

### Layouts

- `card` — a floating slide card over the map.
- `full` — a scrollable story surface beside a full-bleed map.
- `timeline` — a dated row per entry beside the map, reusing `layout.full.side` and
  `layout.full.contentRatio`. The list *is* the navigation, so there are no
  previous/next buttons.

### Note display

- `basic` — frontmatter basics only.
- `link` — basics plus a note link. In Obsidian, hovering shows the page preview and
  clicking opens the note in a new tab; on a site it is a normal browser link.
- `full` — the note's body, frontmatter stripped, as slide text.

`full` layout always uses the note body regardless of `noteDisplay`. A `timeline` honors
the setting but keeps each row's date, title and cover beside the body, so a row is
never empty.

### An explicit slide

```yaml
slides:
  - title: Leaving home
    date: 2024-04-12
    text: The flight leaves at dawn.
    location: [25.0330, 121.5654]
  - note: "[[Travel/Chile/Places/Santiago]]"
```

A slide may reference a note with a WikiLink, and inherits that note's frontmatter.
Explicit slide properties win over note-derived values, and an authored `date` always
wins over the note's.

## The `leaflet` block

The historical Obsidian Leaflet dialect, for maps that are not stories. It has its own
parser and **never** enters the `storymap/v1` schema. Key spelling is historical, so
existing notes render unchanged.

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

| Key | Default | Meaning |
| --- | --- | --- |
| `id` | — | Authored identity, passed through untouched. May repeat across blocks. |
| `height` | `520px` | Height of this block. Never forced to `100%`. |
| `lat` + `long` / `lng` | — | Center. A partial or out-of-range pair is an error. |
| `defaultZoom` | `6` | Initial zoom. |
| `minZoom` / `maxZoom` | — | Zoom bounds. |
| `markerFolder` | — | Vault-relative folder, scanned recursively. Repeatable, and also accepts a YAML list or a comma-separated string. |
| `unit`, `scale` | — | Accepted as compatibility metadata. No effect yet; not an error. |
| `darkMode` | — | Accepted as a compatibility flag. Does not change the theme or the tile source. |

Notes in a `markerFolder` become markers when they have a valid `location`. A note
without one is skipped. A `mapmarker` value that is not registered still renders a
marker through the default visual, keeping the authored name.

**Nothing is silently ignored.** A key this project recognizes but does not implement
yet is listed as a diagnostic under the map; an unrecognized key is reported separately,
so a typo is never confused with a scheduled feature. See
[the per-key support record](../leaflet-compatibility.md) for the exact state of every
key.

## Theme and tiles

`auto` follows the host: Obsidian maps it onto its own theme colors, and other hosts fall
back to `prefers-color-scheme`. `light` and `dark` are fixed, host-independent palettes,
and `vintage`, `cyber` and `atlas` are authored looks. A host can still pin exact colors
by setting `--story-map-*` CSS variables.

The built-in tile source is `https://tile.openstreetmap.org/{z}/{x}/{y}.png` with visible
attribution. A theme is presentation and never replaces a configured `tileUrl`; tile
provider selection and theming are independent.
