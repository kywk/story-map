# Documentation

Start here when you need to understand or change StoryMap.

| Document | Purpose |
| --- | --- |
| [`../README.md`](../README.md) | What the project is, packages, quick start, source syntax. |
| [`../SPEC.md`](../SPEC.md) | Product and architecture contract (source of truth). |
| [`../AGENTS.md`](../AGENTS.md) | Working agreement, boundaries, definition of done. |
| [`architecture.md`](architecture.md) | Concrete implementation map: packages, data flow, files, APIs, commands. |
| [`../DESIGN.md`](../DESIGN.md) | Introduction website visual tokens and responsive conventions. |
| [`acceptance/2026-09-28-site-redesign.md`](acceptance/2026-09-28-site-redesign.md) | Bilingual website verification, CI evidence, and unrun gates. |
| [`acceptance/2026-09-28-atlas-comparison.md`](acceptance/2026-09-28-atlas-comparison.md) | Atlas screenshot diagnosis and community installation update verification. |
| [`history/2026-09-28-map-theme-layout/README.md`](history/2026-09-28-map-theme-layout/README.md) | Archived design bundle for the implemented map themes and layouts. |
| [`history/2026-09-30-timeline-layout/README.md`](history/2026-09-30-timeline-layout/README.md) | Archived design bundle for the `timeline` layout and `StorySlide.date`. |
| [`docusaurus-full-page.md`](docusaurus-full-page.md) | Host-owned full-page StoryMap view example for Docusaurus (not a package option). |
| [`obsidian-submission.md`](obsidian-submission.md) | Geo Story Map community listing, release assets and follow-up release checks. |
| [`../RELEASING.md`](../RELEASING.md) | npm publishing, Trusted Publisher setup and Obsidian community releases. |
| [`releases/0.3.0.md`](releases/0.3.0.md) | 0.3.0 release notes, upgrade guidance and validation evidence. |
| [`releases/0.4.0.md`](releases/0.4.0.md) | 0.4.0 release notes: timeline layout, `initialSlide`, `panelOpacity`, and the required-field upgrade. |
| [`history/`](history/) | Archived plans and background. Superseded, not authoritative. |

Recommended reading order for a new agent: `README.md` -> `architecture.md` -> `SPEC.md` -> `AGENTS.md`.

## Documentation rules

- `SPEC.md` and `architecture.md` must describe the current code, not a planned future.
- Move completed or superseded plans to `docs/history/<YYYY-MM-DD>-<slug>/` instead of editing them.
- Delete development-process notes (handoffs, scratch status, conversation logs) once their work is merged.
- Keep the top-level docs short; put implementation detail in `docs/architecture.md`.
- The repeatable workflow is captured in the `docs-maintenance` skill at
  `.agents/skills/docs-maintenance/SKILL.md`.
