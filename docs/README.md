# Documentation

Start here when you need to understand or change StoryMap.

| Document | Purpose |
| --- | --- |
| [`../README.md`](../README.md) | What the project is, packages, quick start, source syntax. |
| [`../SPEC.md`](../SPEC.md) | Product and architecture contract (source of truth). |
| [`../AGENTS.md`](../AGENTS.md) | Working agreement, boundaries, definition of done. |
| [`architecture.md`](architecture.md) | Concrete implementation map: packages, data flow, files, APIs, commands. |
| [`history/2026-09-28-map-theme-layout/README.md`](history/2026-09-28-map-theme-layout/README.md) | Archived design bundle for the implemented map themes and layouts. |
| [`docusaurus-full-page.md`](docusaurus-full-page.md) | Host-owned full-page StoryMap view example for Docusaurus (not a package option). |
| [`obsidian-submission.md`](obsidian-submission.md) | Geo Story Map GitHub release assets and community submission steps. |
| [`../RELEASING.md`](../RELEASING.md) | npm publishing, Trusted Publisher setup and deferred Obsidian submission. |
| [`history/`](history/) | Archived plans and background. Superseded, not authoritative. |

Recommended reading order for a new agent: `README.md` -> `architecture.md` -> `SPEC.md` -> `AGENTS.md`.

## Documentation rules

- `SPEC.md` and `architecture.md` must describe the current code, not a planned future.
- Move completed or superseded plans to `docs/history/<YYYY-MM-DD>-<slug>/` instead of editing them.
- Delete development-process notes (handoffs, scratch status, conversation logs) once their work is merged.
- Keep the top-level docs short; put implementation detail in `docs/architecture.md`.
- The repeatable workflow is captured in the `docs-maintenance` skill at
  `.agents/skills/docs-maintenance/SKILL.md`.
