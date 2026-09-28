# Handoff Prompt — Map Themes and Layout Modes

You are the PM/integration agent for `kywk/story-map`.

Read, in order:

1. `SPEC.md`
2. `AGENTS.md`
3. `docs/architecture.md`
4. `docs/history/2026-09-28-map-theme-layout/CONVERSATION_SUMMARY.md`
5. `docs/history/2026-09-28-map-theme-layout/DESIGN_SPEC.md`
6. `docs/history/2026-09-28-map-theme-layout/IMPLEMENTATION_PLAN.md`
7. `docs/history/2026-09-28-map-theme-layout/MULTI_AGENT_TASKS.md`

## Goal

Implement one coherent StoryMap visual theme system plus two story/map interaction layouts.

### Built-in themes

```text
light
dark
vintage
cyber
atlas
```

The selected theme must style both cartographic elements and StoryMap-owned story chrome.
Do not create an independent story theme. Markdown typography/semantics remain host-owned.

### Layout modes

```text
card
full
```

`card` is the current floating-card model and remains the default. It adds:

- left/center/right alignment;
- optional width ratio;
- optional height ratio.

`full` is a full-bleed editorial layout:

- story on left/right;
- configurable content ratio;
- theme-coherent progressive transparent fade into the map.

## Public config target

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

Card example:

```yaml
layout:
  mode: card
  card:
    align: center
    widthRatio: 0.55
    heightRatio: 0.72
```

## Architecture constraints

- `story-map-core` owns contract/defaults only.
- `react-story-map` owns themes/layout rendering and Leaflet.
- Obsidian adds only the default map theme setting; layout stays document-owned.
- Remark serializes the same canonical config; no renderer duplication.
- Keep MapCanvas structurally stable while presentation mode changes.
- Use an internal layout renderer registry/dispatch boundary for future modes.
- Do not expose a generic public plugin framework.
- Do not add scroll-driven storytelling.
- Do not tie themes to a tile provider.
- Existing `--story-map-*` variables remain explicit advanced host overrides.
- Stop automatic Docusaurus/Infima color overrides from defeating selected themes.

## Work order

1. Core contract + tests.
2. Behavior-preserving renderer boundary refactor.
3. Theme presets.
4. Card options.
5. Full layout.
6. Obsidian setting.
7. Remark/Docusaurus verification.
8. Site/examples.
9. Docs.
10. Full validation.

Use separate agents according to `MULTI_AGENT_TASKS.md`. Keep package ownership clean and
integrate public type changes centrally.

Do not expand scope. If implementation pressure suggests a new public option, first decide
whether it is required to implement the approved two layouts. If not, defer it.

Before completion run:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Then execute the manual matrix from `IMPLEMENTATION_PLAN.md` and report any deferred items
explicitly.
