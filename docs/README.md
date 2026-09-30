# Documentation

Start here when you need to understand or change StoryMap.
[繁體中文說明](README.zh-TW.md) · [專案首頁](../README.md)

## User guides

Bilingual: English first, with a `zh-TW` translation alongside each page.

| Guide | What it covers |
| --- | --- |
| [Source syntax](guides/syntax.md) · [中文](guides/syntax.zh-TW.md) | Every `story-map` and `leaflet` block key, and the note frontmatter both read. |
| [Geo Story Map for Obsidian](guides/obsidian.md) · [中文](guides/obsidian.zh-TW.md) | Install, layouts, note display, settings sections, AI coordinate lookup, legacy blocks. |
| [Docusaurus](guides/docusaurus.md) · [中文](guides/docusaurus.zh-TW.md) | Publishing stories and legacy maps, route resolution, the client, the theme bridge. |
| [React](guides/react.md) · [中文](guides/react.zh-TW.md) | `<StoryMap />` and `<GeoMap />`, props, themes, layouts, SSR, CSS variables. |

## Contributor and reference docs

English only.

| Document | Role |
| --- | --- |
| [`../README.md`](../README.md) | Entry point: what the project is, packages, quick start. |
| [`../SPEC.md`](../SPEC.md) | Product and architecture contract (source of truth). |
| [`../AGENTS.md`](../AGENTS.md) | Working agreement, boundaries, definition of done. |
| [`../RELEASING.md`](../RELEASING.md) | npm publishing, Trusted Publisher setup, Obsidian community releases. |
| [`../DESIGN.md`](../DESIGN.md) | Introduction website visual tokens and responsive conventions. |
| [`architecture.md`](architecture.md) | Implementation map: packages, data flow, files, APIs, commands. |
| [`leaflet-compatibility.md`](leaflet-compatibility.md) | Live per-key record of what the ` ```leaflet ` dialect supports, with known gaps. |
| [`docusaurus-full-page.md`](docusaurus-full-page.md) | Host-owned full-page StoryMap view example (not a package option). |
| [`obsidian-submission.md`](obsidian-submission.md) | Community listing, release assets, follow-up release checks. |
| [`releases/`](releases/) | Per-version release notes, upgrade guidance, validation evidence. |
| [`acceptance/`](acceptance/) | Verification evidence for individual changes. |
| [`history/`](history/) | Archived plans and background. Superseded, not authoritative. |

## Documentation rules

- `SPEC.md` and `architecture.md` describe the **current code**, not a planned future. If
  they disagree with the source, the source is right and the doc is a bug.
- Each fact has one home. File-level detail belongs in `architecture.md`; top-level docs
  link to it rather than restating it.
- Anything a user of the product would look for belongs in `docs/guides/`, in both
  English and `zh-TW`.
- Move completed or superseded planning docs into `history/<YYYY-MM-DD>-<slug>/` with
  `git mv`, so history is preserved.
- **Delete** development-process notes — hand-offs, scratch status, conversation logs —
  once their work is merged. Do not archive them. If the evidence is worth keeping, rewrite
  it as an `acceptance/` record.
- When behavior changes, update the matching doc in the same change.
- Ask before editing `site/`. User-facing copy lives in `site/src/i18n.ts` and
  `site/src/stories.ts`; load the `frontend-design` skill for layout or visual work and
  keep the existing cartographic tokens in `site/src/styles.css`.

Recommended reading order for a new agent: `../README.md` → `architecture.md` →
`../SPEC.md` → `../AGENTS.md`.
