# Timeline layout

Status: **implemented**. This directory is design history for a shipped milestone. The current
product contract remains [`SPEC.md`](../../../SPEC.md), the current working agreement remains
[`AGENTS.md`](../../../AGENTS.md), and the current code map remains
[`docs/architecture.md`](../../architecture.md).

Documents in this directory:

| File | Purpose |
| --- | --- |
| [conversation-summary.md](conversation-summary.md) | Analysis of the current code, the reference image, the decisions taken, and the questions asked |
| [implementation-plan.md](implementation-plan.md) | Phased, file-level implementation plan, test plan, and ownership split |
| [multi-agent-task-prompt.md](multi-agent-task-prompt.md) | Ready-to-paste agent briefs, one per package, plus the integrator brief |
| [pm-agent-prompt.md](pm-agent-prompt.md) | Standing prompt for the PM/orchestrator agent that owns this milestone |
| [tickets.md](tickets.md) | Ticket-per-track breakdown with blocking edges and one acceptance test each |

## Scope in one paragraph

Add a third document-owned `layout.mode: 'timeline'` that renders every slide as a dated,
thumbnailed row in a scrollable column beside the full-bleed map, following the reference
image: a vertical spine, a per-entry date chip, cover thumbnail, title, clamped description,
and a note link. Entry dates come from a new `StorySlide.date` (epoch ms) that both adapters
already compute for folder ordering and currently discard. Timeline reuses
`layout.full.side` and `layout.full.contentRatio`, adds no new configuration key, and is not
an Obsidian plugin default.

## Out of scope

- the `Timeline | Map | Gallery` view switcher (a multi-view feature, not a layout mode);
- a `gallery` mode;
- numbered map markers (circle markers with active emphasis stay as they are);
- date grouping headers, autoplay, and scroll-driven storytelling;
- a `followMap` toggle; the map keeps the existing `flyTo` behavior;
- `video` / `iframe` thumbnails;
- any Obsidian plugin setting for `layout`.

## Implementation order

1. `story-map-core`: `timeline` mode, `StorySlide.date`, coercion and parser tests.
2. `react-story-map`: the timeline surface, shared note-link helper, marker focus, CSS, tests.
3. Both adapters in parallel: thread `dateField` into explicit-slide resolution and emit
   `slide.date` for folder discovery, with parity tests.
4. Landing site and documentation brought in line with the implemented behavior.
5. Workspace gate (`typecheck` / `test` / `build`) plus the manual smoke matrix.
