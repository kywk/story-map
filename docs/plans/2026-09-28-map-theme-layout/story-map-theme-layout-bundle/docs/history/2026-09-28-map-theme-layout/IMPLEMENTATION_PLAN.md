# Implementation Plan — Map Themes and Layout Modes

Date: 2026-09-28

## Objective

Add five coherent built-in StoryMap themes and two initial story/map layout modes without
creating a generic theming or layout plugin system.

The implementation must preserve existing Markdown source behavior and package boundaries.

## Phase 0 — Contract lock

Before coding, accept these names as stable for the milestone:

```yaml
map:
  theme: light | dark | vintage | cyber | atlas

layout:
  mode: card | full
```

Card options:

```yaml
layout:
  card:
    align: left | center | right
    widthRatio: 0.20..0.80   # optional
    heightRatio: 0.20..0.95  # optional
```

Full options:

```yaml
layout:
  full:
    side: left | right
    contentRatio: 0.30..0.70
```

Do not add more user-facing knobs during implementation unless required for correctness.

## Phase 1 — Core contract

Owner: `story-map-core`

### Files

- `packages/story-map-core/src/types.ts`
- `packages/story-map-core/src/schema.ts`
- `packages/story-map-core/src/parser.ts`
- `packages/story-map-core/src/parser.test.ts`
- `packages/story-map-core/src/index.ts` if exports require updates

### Work

1. Add `StoryMapTheme`.
2. Add layout types and constants.
3. Add `theme` to `StoryMapOptions`.
4. Add canonical `layout` to source/render configs.
5. Add schema defaults.
6. Extend `applySourceDefaults` only for `map.theme`.
7. Keep `layout` document-only.
8. Ensure `toStoryMapConfig` copies normalized layout.
9. Add focused parser/default tests.

### Core tests

- omitted theme -> `light`
- five theme values accepted
- invalid theme rejected
- Obsidian/source default theme applies when document omits it
- document theme wins over supplied default
- omitted layout -> `card`
- card default align -> `left`
- card ratios accept valid values and reject out-of-range values
- full default side -> `left`
- full default content ratio -> `0.5`
- invalid mode rejected
- inactive mode options survive normalization but do not affect parsing semantics

## Phase 2 — Renderer boundary refactor

Owner: `react-story-map`

Do this before visual theme work.

### Suggested files

```text
packages/react-story-map/src/
  StoryMap.tsx
  MapCanvas.tsx
  StoryContent.tsx
  themes.ts
  layouts/
    index.ts
    CardLayout.tsx
    FullLayout.tsx
  styles.css
  StoryMap.test.tsx
```

Exact file split may vary, but responsibilities must remain distinct.

### Structural goal

```text
StoryMap
├── MapCanvas
└── StoryPresentation
    └── active layout renderer
        └── StoryContent
```

The map should remain mounted as a stable full-bleed layer. Layout modes manipulate the
story presentation layer over the same map.

### Refactor safeguards

- no change to note link semantics;
- no change to media/Markdown semantics;
- no new platform imports;
- preserve SSR-safe dynamic Leaflet import;
- preserve `ResizeObserver` invalidation;
- preserve cleanup on unmount;
- preserve keyboard Previous/Next behavior.

## Phase 3 — Built-in theme presets

Owner: `react-story-map`

### Theme preset shape

Keep the preset private to the renderer. It should cover:

- tile filter;
- marker;
- active marker;
- path;
- Leaflet controls/attribution;
- story surface;
- foreground/muted/border/accent;
- button/control surface;
- shadow;
- full-mode gradient characteristics.

Do not export a `registerTheme()` API.

### Rendering

Add stable root attributes, e.g.:

```html
<section
  class="story-map"
  data-map-theme="vintage"
  data-layout="full"
>
```

Tile layer receives a specific class so filters affect tiles only:

```ts
L.tileLayer(url, {
  attribution,
  className: 'story-map__tiles',
});
```

Never apply a filter to the entire map container because it would affect markers, paths,
controls, or story content.

## Phase 4 — Card mode

Owner: `react-story-map`

### Default regression target

With:

```yaml
layout:
  mode: card
```

and no advanced ratios, preserve the current visible behavior:

- left/bottom floating card;
- current width cap;
- current content-driven height/max-height;
- current mobile inset behavior.

### Advanced settings

- `align`
- `widthRatio`
- `heightRatio`

Implementation may use CSS custom properties derived from validated numeric values.

Example:

```css
--story-map-card-width: 34%;
--story-map-card-height: 72%;
```

Ratios are container-relative. Clamp them responsively rather than allowing overflow.

## Phase 5 — Full mode

Owner: `react-story-map`

### Behavior

- map remains full-bleed;
- story surface covers left/right region;
- surface edge fades progressively to transparent;
- selected theme owns the fade colors/tone;
- `contentRatio` controls article share;
- story content remains scrollable when longer than the available height;
- navigation remains part of the story presentation.

Do not use a background screenshot or duplicate map.

### Responsive

At narrow widths:

- switch to vertical story/map relationship;
- use a vertical gradient;
- ignore horizontal side for placement while preserving source config;
- retain map context;
- avoid horizontal scrolling.

## Phase 6 — Obsidian integration

Owner: `obsidian-story-map`

### Files

- `src/settings-data.ts`
- `src/settings-data.test.ts`
- `src/settings-tab.ts`
- possibly view tests only if needed

### Work

Add `mapTheme?: StoryMapTheme` to plugin settings.

Expose:

```text
Default map theme:
Light / Dark / Vintage / Cyber / Atlas
```

Precedence:

```text
document map.theme
> plugin default map theme
> built-in light
```

Do **not** add layout defaults to Obsidian settings.

Changing the default theme should refresh open StoryMap views through the existing refresh
mechanism.

## Phase 7 — Remark/Docusaurus verification

Owner: `remark-story-map`

No new rendering logic should be necessary.

Verify:

- canonical `map.theme` survives serialization;
- canonical `layout` survives serialization;
- multiple maps on a page remain independent;
- SPA mount/unmount remains clean;
- SSR does not initialize Leaflet.

Update Docusaurus example theme bridge:

- stop automatically overriding StoryMap color tokens from Infima;
- retain only host integration that does not fight selected StoryMap themes;
- document explicit CSS token overrides as advanced behavior.

## Phase 8 — Examples and project site

Owner: site/example agent

### Basic Markdown example

Add a compact theme/layout example without turning the basic example into a catalog.

### Site

Add a live theme/layout playground or gallery using the actual shared renderer.

Recommended controls:

```text
Theme: light / dark / vintage / cyber / atlas
Layout: card / full
```

Optional secondary controls may demonstrate:

- card align;
- full side.

Do not build a separate demo renderer.

## Phase 9 — Documentation

Integrator updates:

- `SPEC.md`
- `AGENTS.md`
- `docs/architecture.md`
- root `README.md`
- package READMEs as needed
- `examples/basic.md`

The history folder for this milestone remains archival planning context.

## Phase 10 — Validation

Run:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Manual smoke tests:

1. standalone light/card regression;
2. each of five themes in card mode;
3. card left/center/right;
4. explicit card ratio combinations;
5. full-left at several ratios;
6. full-right at several ratios;
7. all five themes in full mode;
8. narrow/mobile card;
9. narrow/mobile full vertical fade;
10. Obsidian default theme and document override;
11. same document in Obsidian and Remark/Docusaurus;
12. multiple StoryMaps on one page;
13. pane/container resize;
14. layout/theme changes do not leak Leaflet instances;
15. host CSS override still works when intentionally applied.

## Commit sequencing

Recommended integration order:

1. `feat(core): add theme and layout contract`
2. `refactor(react): separate map canvas and story presentation`
3. `feat(react): add built-in StoryMap themes`
4. `feat(react): add card layout options`
5. `feat(react): add full editorial layout`
6. `feat(obsidian): add default map theme`
7. `test(remark): cover theme and layout serialization`
8. `feat(site): showcase theme and layout modes`
9. `docs: document themes and layout modes`

Keep the renderer refactor commit behavior-preserving where possible; it makes later review
substantially easier.
