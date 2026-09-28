# Next implementation: map themes and layouts

Status: implemented in this checkout; this bundle is retained as design history. The current product
contract remains [`SPEC.md`](../../../SPEC.md), and the current code map remains
[`docs/architecture.md`](../../architecture.md).

The supplied ZIP is extracted unchanged in [`story-map-theme-layout-bundle/`](story-map-theme-layout-bundle/).
Its README, proposed `SPEC.md`, patches, and handoff prompt are reference material for a
implementation, not a patch applied verbatim to this checkout. The bundle was
prepared against commit `ff5cc5674b955358c7948d26b0e801cec5f1e637`; review and adapt
its patches against the current code before use.

## Implemented scope

- Add five coordinated built-in themes through `map.theme`: `light`, `dark`, `vintage`,
  `cyber`, and `atlas`. The theme covers map styling and StoryMap-owned chrome.
- Add document-owned `layout.mode`: `card` (default) and `full`. Card keeps the current
  floating presentation by default and gains alignment and optional size ratios. Full
  keeps the map beneath an editorial story surface with a responsive fade.
- Make only `map.theme` eligible for an Obsidian plugin default. Preserve document-first
  precedence and keep `layout` out of plugin settings.
- Keep the shared renderer responsible for visual behavior; adapters only parse, resolve,
  and pass the canonical configuration.

## Implementation order

1. Extend core types, schema, defaults, and parser tests.
2. Separate the renderer's map lifecycle from story presentation, preserving existing
   behavior, then add themes and both layouts.
3. Add the Obsidian theme setting and verify Remark/Docusaurus serialization, SPA and SSR
   behavior, and the Docusaurus CSS bridge.
4. Update examples and the site, then bring `SPEC.md`, `AGENTS.md`, `docs/architecture.md`,
   and user documentation into line with the implemented behavior.
5. Run the workspace checks and the manual visual/host matrix in the plan.

The detailed [design specification](story-map-theme-layout-bundle/docs/history/2026-09-28-map-theme-layout/DESIGN_SPEC.md)
and [implementation plan](story-map-theme-layout-bundle/docs/history/2026-09-28-map-theme-layout/IMPLEMENTATION_PLAN.md)
are the working references for this milestone. Their embedded `docs/history/` path is
part of the original bundle and does not mean this upcoming work is complete.
