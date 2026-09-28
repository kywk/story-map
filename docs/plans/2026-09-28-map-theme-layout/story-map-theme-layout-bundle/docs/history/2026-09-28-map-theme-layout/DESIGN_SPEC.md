# Design Specification — Built-in Themes and Layout Modes

Status: approved for implementation planning  
Date: 2026-09-28

## 1. Product principle

StoryMap is a geographic presentation of Markdown content. Markdown remains the content
source and the host remains responsible for semantic article rendering. StoryMap owns:

- geographic context;
- slide sequencing and navigation;
- map rendering;
- StoryMap-owned presentation chrome;
- the spatial relationship between content and map.

The visual theme must be coherent across the map and StoryMap-owned chrome. There is no
separate "story theme".

## 2. Configuration contract

### 2.1 Theme

```yaml
map:
  theme: light
```

Supported values:

```text
light | dark | vintage | cyber | atlas
```

Default:

```text
light
```

`map.theme` is intentionally independent of `tileUrl`. A theme is a rendering preset, not a
tile provider.

### 2.2 Layout

```yaml
layout:
  mode: card
```

Supported v1 modes:

```text
card | full
```

Default:

```text
card
```

`layout` is document-owned in this release. Obsidian settings must not silently override it.

## 3. Card mode

Card mode preserves the current behavior: a StoryMap-owned content surface floats above a
full-bleed map.

### 3.1 Configuration

```yaml
layout:
  mode: card
  card:
    align: left
    widthRatio: 0.34
    heightRatio: 0.72
```

Fields:

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `align` | `left \| center \| right` | `left` | Horizontal card placement |
| `widthRatio` | number `0.20..0.80` | omitted | Card width as container fraction |
| `heightRatio` | number `0.20..0.95` | omitted | Card height as container fraction |

When `widthRatio` or `heightRatio` is omitted, the current renderer sizing behavior is
preserved. This is deliberate backward compatibility.

### 3.2 Layout behavior

Desktop:

```text
left (default)              center                     right

┌──────────────────┐        ┌──────────────────┐       ┌──────────────────┐
│ ┌──────┐         │        │     ┌──────┐     │       │         ┌──────┐ │
│ │story │   map   │        │ map │story │ map │       │   map   │story │ │
│ └──────┘         │        │     └──────┘     │       │         └──────┘ │
└──────────────────┘        └──────────────────┘       └──────────────────┘
```

Mobile:

- alignment collapses to the existing safe inset layout;
- width is clamped to the available viewport;
- explicit ratios are treated as author intent but may be clamped to prevent unusable
  content or map areas;
- no horizontal overflow is allowed.

## 4. Full mode

Full mode is an editorial layout. The map stays full-bleed. A large story surface covers a
configurable portion of the viewport and fades progressively into the map.

### 4.1 Configuration

```yaml
layout:
  mode: full
  full:
    side: left
    contentRatio: 0.50
```

Fields:

| Field | Type | Default | Meaning |
| --- | --- | --- | --- |
| `side` | `left \| right` | `left` | Side occupied by story content |
| `contentRatio` | number `0.30..0.70` | `0.50` | Main story region as container fraction |

The fade/overlap width is theme-defined in v1 and is not a public configuration value.
This keeps each built-in theme visually coherent.

### 4.2 Layout behavior

Left:

```text
┌────────────────────────────────────────────┐
│  STORY STORY STORY ▓▓▓▒▒░       MAP       │
│  STORY STORY STORY ▓▓▒░          MAP       │
│  STORY STORY STORY ▓▒░            MAP      │
└────────────────────────────────────────────┘
```

Right:

```text
┌────────────────────────────────────────────┐
│       MAP        ░▒▒▓▓▓ STORY STORY STORY  │
│       MAP          ░▒▓▓ STORY STORY STORY  │
│       MAP           ░▒▓ STORY STORY STORY  │
└────────────────────────────────────────────┘
```

The map remains under the full container. The story surface and gradient sit above it. This
keeps the Leaflet DOM stable and avoids remounting the map merely because presentation mode
changes.

Mobile fallback:

```text
┌────────────────────┐
│        MAP         │
│                    │
│      ░▒▓▓▓▓        │
│   STORY CONTENT    │
│   STORY CONTENT    │
└────────────────────┘
```

`side` becomes non-semantic on narrow screens. The renderer changes the gradient to a
vertical transition and prioritizes readable story content without losing map context.

## 5. Core types

Recommended public model:

```ts
export type StoryMapTheme =
  | 'light'
  | 'dark'
  | 'vintage'
  | 'cyber'
  | 'atlas';

export type StoryMapLayoutMode = 'card' | 'full';

export interface StoryMapCardLayout {
  align: 'left' | 'center' | 'right';
  widthRatio?: number;
  heightRatio?: number;
}

export interface StoryMapFullLayout {
  side: 'left' | 'right';
  contentRatio: number;
}

export interface StoryMapLayoutOptions {
  mode: StoryMapLayoutMode;
  card: StoryMapCardLayout;
  full: StoryMapFullLayout;
}

export interface StoryMapOptions {
  center?: LatLngTuple;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  theme: StoryMapTheme;
  tileUrl: string;
  attribution: string;
  showPath: boolean;
}

export interface StoryMapConfig {
  schema: 'storymap/v1';
  id?: string;
  title?: string;
  height: string;
  map: StoryMapOptions;
  layout: StoryMapLayoutOptions;
  slides: StorySlide[];
}
```

The canonical config may contain normalized defaults for both mode option groups even when
one group is inactive. This keeps parsing simple and makes switching modes deterministic.
The renderer must ignore inactive mode options.

Recommended constants:

```ts
DEFAULT_MAP_THEME = 'light';
DEFAULT_LAYOUT_MODE = 'card';
DEFAULT_CARD_ALIGN = 'left';
DEFAULT_FULL_SIDE = 'left';
DEFAULT_FULL_CONTENT_RATIO = 0.5;
```

## 6. Theme ownership

A built-in theme is a renderer preset with two coordinated token groups.

### 6.1 Cartographic tokens

Examples:

- tile filter
- marker border/fill
- active marker
- path
- Leaflet controls
- attribution chrome

### 6.2 StoryMap chrome tokens

Examples:

- story surface
- foreground
- muted foreground
- border
- accent
- button/control surface
- shadow
- gradient/fade characteristics

The theme does not own:

- host font family;
- Markdown heading hierarchy;
- blockquote/code/table semantics;
- WikiLink resolution;
- article body parsing.

The story surface can inherit typography while still receiving a theme-coherent color and
surface treatment.

## 7. Built-in theme direction

### `light`

- neutral/light cartography
- white or warm-white story surface
- restrained blue accent
- minimal shadow
- clear neutral controls

### `dark`

- darkened, restrained cartography
- dark story surface
- high-contrast foreground
- cyan/blue accent
- no excessive neon styling

### `vintage`

- warm/sepia, low-saturation map treatment
- paper/ivory story surface
- brick/burgundy accents
- soft low-contrast borders
- subtle aged feel; no heavy paper texture assets

### `cyber`

- cool, dark high-contrast map treatment
- dark translucent story surface
- cyan/magenta accents
- very subtle marker/path glow
- HUD-inspired, not gaming-RGB

### `atlas`

- classic printed-map tone
- parchment-neutral story surface
- navy/burgundy accents
- sober cartographic feel
- distinct from `vintage`: atlas is formal cartography, vintage is travel-memory character

## 8. CSS variable compatibility

Keep the existing semantic variables such as:

```css
--story-map-bg
--story-map-fg
--story-map-muted
--story-map-border
--story-map-accent
```

Built-in themes supply private/default theme tokens. Existing public semantic variables
remain an advanced override layer.

Recommended precedence:

```text
explicit host --story-map-* override
    >
built-in theme token
    >
hard-coded safe fallback
```

Because an explicit host override can break map/chrome coherence, built-in host examples
must not automatically override these colors. In particular, the current Docusaurus/Infima
bridge should stop mapping Infima colors over every StoryMap by default.

## 9. Renderer structure

Recommended target:

```text
StoryMap
├── MapCanvas
│   └── Leaflet lifecycle
└── StoryPresentation
    ├── CardLayout
    └── FullLayout
        └── StoryContent
            ├── title / note link
            ├── media
            ├── Markdown
            └── navigation
```

Important implementation constraint:

- `MapCanvas` should remain a stable sibling of `StoryPresentation`.
- Layout modes should not move Leaflet between unrelated DOM trees.
- Future layout modes extend the presentation boundary, not the map engine.

An internal registry is appropriate:

```ts
const layoutRenderers = {
  card: CardLayout,
  full: FullLayout,
} satisfies Record<StoryMapLayoutMode, LayoutRenderer>;
```

Do not expose `registerLayout()` or a generic public plugin framework in v1.

## 10. Adapter responsibilities

### Core

Owns:

- theme/layout types;
- Zod validation;
- defaults;
- default precedence;
- canonical config conversion.

### React renderer

Owns:

- theme preset values;
- map and story chrome styling;
- card/full presentation;
- responsive layout behavior;
- Leaflet map lifecycle.

### Obsidian

Owns:

- default `map.theme` setting;
- normal source parsing;
- no layout-specific rendering.

Layout is document-only.

### Remark/Docusaurus

Owns:

- serialization of canonical config;
- no layout-specific rendering logic;
- no theme color logic.

The browser uses the shared renderer.

## 11. Default precedence

Recommended:

```text
map.theme:
document -> Obsidian plugin default -> built-in light

layout.*:
document -> built-in defaults
```

Remark uses document values plus built-in defaults.

## 12. Example configurations

### Existing/current card behavior

```yaml
map:
  theme: light
  center: [25.033, 121.5654]
  zoom: 10

layout:
  mode: card
```

### Centered wide card

```yaml
layout:
  mode: card
  card:
    align: center
    widthRatio: 0.55
    heightRatio: 0.72
```

### Vintage editorial view

```yaml
map:
  theme: vintage
  center: [-33.4489, -70.6693]
  zoom: 5

layout:
  mode: full
  full:
    side: left
    contentRatio: 0.52
```

### Right-side atlas story

```yaml
map:
  theme: atlas

layout:
  mode: full
  full:
    side: right
    contentRatio: 0.45
```

## 13. Acceptance criteria

- all five themes render coherently across map and StoryMap-owned story surface;
- `map.theme` defaults to `light`;
- invalid theme values fail validation clearly;
- `card` remains the default layout and visually preserves current behavior when advanced
  sizing values are omitted;
- card alignment supports left, center, and right;
- card width/height ratios are validated and responsive;
- `full` supports left and right story surfaces;
- `full.contentRatio` controls the article/map balance;
- full mode has a theme-coherent progressive transparent transition;
- mobile layouts remain usable and do not horizontally overflow;
- switching layout does not introduce duplicate Leaflet maps or leaked map instances;
- Remark serializes theme/layout without renderer-specific branching;
- Obsidian renders the same document layout as standalone/Remark;
- selected layout is not overridden by host/plugin settings;
- existing semantic CSS variables still work as explicit overrides;
- `pnpm typecheck`, `pnpm test`, and `pnpm build` pass.
