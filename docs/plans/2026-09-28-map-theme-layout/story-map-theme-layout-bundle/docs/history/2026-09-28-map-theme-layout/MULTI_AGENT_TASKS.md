# Multi-Agent Tasks — Map Themes and Layout Modes

Date: 2026-09-28

## Coordination rules

Follow repository `AGENTS.md`.

Additional milestone rules:

- do not introduce a generic theme or layout plugin API;
- do not add layout defaults to Obsidian;
- do not change note resolution semantics;
- do not move Docusaurus route logic into shared packages;
- do not expand into scroll-driven storytelling;
- shared public type changes are owned by the Core agent first;
- React agent starts against the approved core contract;
- Integrator resolves cross-package type drift.

## Agent A — Core contract

Owner:

```text
packages/story-map-core/
```

Goal:

Implement all schema/type/default behavior for theme and layout.

Deliverables:

- `StoryMapTheme`
- `StoryMapLayoutMode`
- card/full option interfaces
- default constants
- schema changes
- parser/default changes
- `toStoryMapConfig` support
- tests

Must not:

- import React/CSS/Leaflet;
- define theme colors;
- define layout rendering behavior.

Exit criteria:

```bash
pnpm --filter @story-map/story-map-core test
pnpm --filter @story-map/story-map-core build
```

Handoff note must include the exact exported type names and canonical normalized config.

## Agent B — React renderer

Owner:

```text
packages/react-story-map/
```

Goal:

Implement renderer boundary refactor, five themes, card options, and full mode.

Dependencies:

Agent A contract.

Deliverables:

- stable MapCanvas / StoryPresentation boundary
- internal layout renderer dispatch/registry
- theme presets
- tile-only filter class
- card alignment/ratio support
- full left/right ratio + gradient
- mobile behavior
- focused tests

Must preserve:

- SSR safety
- Leaflet cleanup
- resize invalidation
- note callbacks
- normal browser links
- navigation behavior

Must not:

- expose public `registerTheme` or `registerLayout`;
- import Obsidian/Docusaurus APIs;
- own note resolution.

Exit criteria:

```bash
pnpm --filter @story-map/react-story-map test
pnpm --filter @story-map/react-story-map build
```

## Agent C — Obsidian integration

Owner:

```text
packages/obsidian-story-map/
```

Goal:

Add default map theme setting and verify full/card render through the shared renderer.

Dependencies:

Agent A.

Deliverables:

- `mapTheme` plugin setting
- dropdown with five themes
- settings -> core default mapping
- precedence tests
- refresh behavior validation

Must not:

- add layout settings;
- duplicate renderer layout CSS;
- introduce separate Obsidian theme presets.

Exit criteria:

```bash
pnpm --filter @story-map/obsidian-story-map test
pnpm --filter @story-map/obsidian-story-map build
```

## Agent D — Remark/Docusaurus integration

Owner:

```text
packages/remark-story-map/
examples/docusaurus/
```

Goal:

Verify canonical config passthrough and remove automatic host color behavior that conflicts
with selected StoryMap themes.

Deliverables:

- tests for serialized theme/layout
- Docusaurus bridge adjustment
- no SSR regression
- no SPA lifecycle regression

Must not:

- define its own layout implementation;
- define its own theme color tables;
- change site slug behavior.

Exit criteria:

```bash
pnpm --filter @story-map/remark-story-map test
pnpm --filter @story-map/remark-story-map build
```

## Agent E — Site and examples

Owner:

```text
site/
examples/
```

Goal:

Provide live visual QA for themes and layouts using the shared renderer.

Deliverables:

- basic syntax update
- real-renderer theme/layout gallery or selector
- examples for card and full modes
- visual checks at desktop and narrow widths

Must not:

- fork or imitate the renderer;
- create a second theme implementation.

Exit criteria:

```bash
pnpm --filter @story-map/site build
```

## Integrator / PM Agent

Owner:

- root docs/config only when needed
- cross-package integration fixes

Responsibilities:

1. land Agent A first;
2. confirm shared contract;
3. allow B/C/D to proceed;
4. reconcile public API names;
5. run full workspace checks;
6. manually smoke-test Obsidian, standalone, Docusaurus, and site;
7. apply final documentation patch;
8. archive this planning folder unchanged.

Final exit criteria:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Plus the manual matrix from `IMPLEMENTATION_PLAN.md`.
