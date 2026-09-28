# Conversation Summary — Map Themes and Story/Map Layout Modes

Date: 2026-09-28  
Repository: `kywk/story-map`

## Context

The project treats Markdown as the source of truth for story/article content. StoryMap does
not replace Markdown rendering, act as a CMS, or own article semantics. It provides an
alternative geographic presentation for one or more Markdown notes, connecting them by
location and order.

The initial theme discussion separated "map theme" from a possible "story theme". That was
refined after reviewing the intended product direction:

- Story content must **not** have an independent visual theme that can conflict with the map.
- One StoryMap theme should define a coherent visual language for the map and StoryMap-owned
  chrome/surfaces.
- Markdown typography and semantic rendering remain owned by the host (Obsidian,
  Docusaurus, standalone application).
- The second axis is not "story theme"; it is the **interaction/layout mode** between story
  content and map.

This distinction is the main architectural decision of this milestone.

## Approved conceptual model

```text
StoryMap
├── Content
│   └── Markdown remains source of truth
├── Theme
│   └── One coherent visual system for map + StoryMap-owned chrome
└── Layout Mode
    └── How story content and map share the viewport
```

### Theme

Initial built-in themes:

- `light` — default, clean modern cartography
- `dark` — dark navigation-oriented presentation
- `vintage` — warm, aged travel-map character
- `cyber` — modern sci-fi/HUD-inspired cartography
- `atlas` — classic printed-atlas character

The theme controls both map-specific styling and StoryMap-owned presentation surfaces so
they never appear visually unrelated. It does **not** redefine Markdown heading, blockquote,
code-block, table, or general site typography.

### Layout modes

Initial modes:

1. `card` — current StoryMap behavior
   - left / center / right alignment
   - optional card width ratio
   - optional card height ratio
   - current sizing remains the default when ratios are omitted

2. `full` — full-bleed editorial presentation
   - story content on left / right
   - configurable content ratio
   - progressive transparent gradient between story surface and map
   - map remains full-bleed beneath the presentation layer

The full mode is inspired by editorial/news story maps where article content occupies a
large portion of the viewport and fades gradually into the geographic context.

## Important implementation decisions

- `map.theme` remains the single built-in theme selector.
- Theme presets live in `react-story-map`, not `story-map-core`.
- Core owns only the theme/layout contract, validation, normalization, and defaults.
- `layout` is document-owned. It is not an Obsidian global default in v1 because it is part
  of the author's storytelling decision and should render consistently across hosts.
- `map.theme` may remain defaultable through Obsidian plugin settings.
- Map tile provider and theme remain independent; themes must not imply a third-party tile
  service, API key, quota, or provider.
- Existing `--story-map-*` semantic variables remain available as an advanced host override.
  Built-in themes provide coherent defaults; hosts that override the tokens assume
  responsibility for visual coherence.
- The existing automatic Docusaurus/Infima color bridge should be removed or reduced so it
  does not silently override a selected StoryMap theme.
- The Leaflet map element should remain structurally stable across layout modes. Layout mode
  changes the story presentation layer rather than moving the map between different DOM
  trees.
- No public layout plugin registry is required. An internal layout renderer registry/
  dispatch boundary is sufficient for future modes.

## Backward compatibility

Existing documents without either new field continue to work:

```yaml
map:
  zoom: 6
```

is normalized as:

```yaml
map:
  theme: light
  zoom: 6

layout:
  mode: card
```

For `card` mode, omitted advanced sizing values preserve today's content-driven card
behavior and responsive rules.

## Non-goals for this milestone

- independent story/article themes
- arbitrary user-defined theme JSON
- theme marketplace/plugin API
- per-slide theme or per-slide layout
- scroll-driven/scrollytelling mode
- changing Previous/Next interaction into scroll activation
- MapLibre or alternate map-engine abstraction
- tile-provider registry
- layout-specific Obsidian or Docusaurus implementations
- general Markdown typography theming
