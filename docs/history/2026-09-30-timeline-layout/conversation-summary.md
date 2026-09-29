# Conversation summary: timeline layout

Analysis performed against this checkout before implementation. Every file reference below
was read during the analysis; line numbers match the current tree.

## 1. Request

Add a `timeline` presentation to StoryMap alongside the existing `card` and `full` layouts,
following a supplied reference image: a full-bleed map on the left, a scrollable column on
the right, a vertical spine with a node per entry, and per-entry date, cover thumbnail, title,
description, and note link. The reference image also shows a `Timeline | Map | Gallery` tab
strip; the request was for a third layout mode, not that switcher.

## 2. Current state

### Layout is a three-value enum threaded through four layers

| Layer | Location | Detail |
| --- | --- | --- |
| Types | `packages/story-map-core/src/types.ts:45` | `StoryMapLayoutMode = 'card' \| 'full'`; `StoryMapLayoutOptions` always carries both the `card` and `full` option blocks |
| Schema | `packages/story-map-core/src/schema.ts:53-60` | `mode: z.enum(['card', 'full']).default(DEFAULT_LAYOUT_MODE)` |
| Renderer | `packages/react-story-map/src/StoryMap.tsx:75-77` | emits `data-layout`, `data-card-align`, `data-full-side` |
| CSS | `packages/react-story-map/src/styles.css:263-381` | the only consumer of those attributes |
| Marker focus | `packages/react-story-map/src/markerOffset.ts:26-42` | `getMarkerFocus` branches on `layout.mode`; `NARROW_VIEWPORT_PX = 640` |

`layout` is document-only, so a new mode needs no Obsidian plugin setting
(`docs/architecture.md` §6 and `AGENTS.md`). `effectiveNoteDisplay`
(`packages/story-map-core/src/helpers.ts:106-111`) special-cases only `full`, so any new mode
automatically honours the document's configured `noteDisplay`.

### `data-layout` is renderer-private

A grep for `data-layout|data-full-side|data-card-align` across the repository returns matches
only in `react-story-map/src/styles.css`, `react-story-map/src/StoryMap.tsx`, and
`react-story-map/src/StoryMap.test.tsx`. `packages/obsidian-story-map/src/obsidian.css` is a
theme-variable bridge with no layout selectors, and a grep for
`story-map__|layout|panel` across `examples/docusaurus/` returns zero hits. Adding a mode
therefore requires no host-side CSS or wiring in any of the three hosts.

### The blocking data gap: slides carry no date

The reference image's defining element is a date on every entry, and no such field exists.
`StorySlide` (`types.ts:18-27`) has `id`, `note`, `notePath`, `title`, `text`, `location`,
`media`, and `mapmarker` only. `dateField` (default `date-created`) is read purely for sorting
and then thrown away:

- `packages/obsidian-story-map/src/resolver.ts:68-80` builds
  `{ path, date: toTimestamp(frontmatter[dateField]), file, frontmatter }`, sorts it with
  `sortNoteDates`, and passes only `file` and `frontmatter` to `resolveDiscoveredNote`.
- `packages/remark-story-map/src/vault.ts:85-96` does the same and passes only `note`.

So the value needed for a timeline is already computed and discarded in both adapters. The
explicit-slide path (`resolveSlide` in both adapters) does not receive `dateField` at all,
because explicit slides keep author order and were never date-sorted.

### The Remark/Docusaurus path needs almost nothing

- `packages/remark-story-map/src/index.ts:31-38` serializes whatever
  `toStoryMapConfig(...)` returns into `data-story-map-config` via `JSON.stringify`, so a new
  enum value and a new slide field flow through untouched.
- `packages/remark-story-map/src/client.tsx:28-33` does
  `JSON.parse(decodeURIComponent(raw)) as StoryMapConfig` with **no schema re-validation**, then
  lazily imports the renderer and mounts it. Duplicate-mount and SPA-removal handling is
  independent of layout.

This has a useful consequence: because the plan adds no required configuration key, there is
no crash path between already-published pages and a newer renderer. A page serialized by an
old build simply keeps `mode: 'card' | 'full'`. Had the plan introduced a required
`layout.timeline` block, the unvalidated client would have thrown on old pages.

### Obsidian-specific requirement discovered

`packages/obsidian-story-map/src/view.tsx:118-123` mounts the renderer with
`story={{ ...story, height: '100%' }}`, `noteLinkClassName="internal-link"`,
`onNoteClick` (open in new tab) and `onNoteHover` (Page preview). The anchor-building logic
currently lives inline in `SlideTitle` (`StoryMap.tsx:142-188`). A timeline entry that renders
its own note link must reuse that same logic, otherwise Obsidian users lose Page preview and
new-tab open on timeline rows. The renderer must extract one shared note-link helper and use
it from both the panel title and the timeline chip.

### `MapCanvas` needs no edit

`MapCanvas.tsx:115-136` already depends on `story.layout.mode` and passes `story.layout`
wholesale into `getMarkerFocus`. Timeline reuses `layout.full.side` and
`layout.full.contentRatio`, so the existing dependency list is sufficient; the only change is
inside `markerOffset.ts`.

## 3. Proposed design

### Visual and behavioral contract

- The map stays full-bleed and keeps one stable Leaflet instance; the timeline column is an
  overlay, exactly like `full`.
- Every slide renders as a row (not only the active one): date chip, cover thumbnail, title,
  description clamped to two lines, and a note-link chip.
- Clicking a row selects that slide, which reuses the existing `activeIndex` effect so the map
  `flyTo`s. Left/Right keyboard navigation on the section is unchanged.
- The active row is marked (`data-active`, `aria-current`), its spine node is filled, and it
  gains an accent left border.
- The row scrolls into view with `block: 'nearest'` whenever `activeIndex` changes.
- No previous/next controls: the list is the navigation. `StoryNav` is not rendered.
- Narrow viewports (≤640px) use the same vertical fallback as `full`: map band on top,
  full-width list below.

### DOM shape

```html
<ol class="story-map__timeline">
  <li class="story-map__timeline-item" data-active>
    <time class="story-map__timeline-date" datetime="2024-04-12T00:00:00.000Z">Apr 12, 2024</time>
    <figure class="story-map__timeline-media"><img …></figure>
    <h3><button type="button" class="story-map__timeline-select" aria-current="true">Leaving Home</button></h3>
    <div class="story-map__timeline-text">…Markdown, line-clamped…</div>
    <a class="story-map__timeline-note" href="…" data-href="…" aria-label="Open note: Leaving Home">…</a>
  </li>
</ol>
```

The heading contains a button whose `::after` stretches to the whole row, so each entry keeps a
real heading for assistive technology, the entire row is clickable, and the note link stays a
sibling (raised with `z-index`) instead of a nested interactive element. Spine and node are
drawn with `::before`/`::after` so they cost no extra DOM and inherit the theme variables.

### Data model

```ts
type StoryMapLayoutMode = 'card' | 'full' | 'timeline';

interface StorySlide {
  // …existing fields…
  date?: number; // epoch ms
}
```

- Folder-generated slides take `date` from the same `dateField` frontmatter value already used
  for ordering, so the two hosts cannot disagree.
- Explicit slides may author `date: 2024-04-12`; the parser coerces `Date`, `number`, and
  `string` through the existing `toTimestamp` helper.
- `mergeResolvedSlide` (`helpers.ts:83-95`) already lets an explicit slide value win over a
  note-derived value, so an authored `date` beats the note's date with no extra code.
- `locationOnlySlide` (`helpers.ts:119-124`) copies only `location` and `mapmarker`, so
  `noteDisplay: full` drops the date automatically and no dead data reaches `full` layouts.

### Date rendering

`Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone:
'UTC' })` inside the renderer, producing `Apr 12, 2024`. A fixed locale plus UTC keeps SSR
markup and browser hydration identical, and stops a date authored as UTC midnight from
rendering as the previous day for authors west of Greenwich. No formatting knob is added, which
is consistent with reusing `layout.full` instead of adding a `layout.timeline` block.

## 4. Questions asked and answered

| Question | Decision |
| --- | --- |
| Where does each entry's date come from? | New `StorySlide.date` (epoch ms). Adapters fill it from the existing `dateField`; explicit slides may author it; the renderer formats it |
| Where do timeline layout options come from? | Reuse `layout.full.side` and `layout.full.contentRatio`. No new configuration key |
| Navigation and scrolling? | The list is the navigation: no previous/next, click a row to switch, active row auto-scrolls with `block: 'nearest'` |
| Numbered map markers as in the image? | No. Keep circle markers with active emphasis (div icons would affect `card` and `full`, and marker icon parity is an explicit non-goal) |
| The `Timeline \| Map \| Gallery` tab strip? | No. Only the third `layout.mode` is in scope |

## 5. Assumptions made without further questions

Recorded so they can be vetoed during review:

1. An unparseable authored `date` throws `StoryMapParseError` (`slides[i].date is not a
   parseable date.`), matching the existing behavior for an invalid `location`. An
   unparseable *note* date is simply omitted, matching the existing "sorts last" rule.
2. Date formatting is fixed, not configurable, as decided above.
3. The note link is a small icon chip with an `aria-label`, not a path or URL, because
   `notePath` is either an opaque Vault path or a published route. With
   `noteDisplay: full` in a timeline, the clamped two-line excerpt keeps bodies readable.
4. `noteDisplay` is not forced for timeline: `effectiveNoteDisplay` is unchanged, so a timeline
   shows compact entries under `basic`/`link` and clamped bodies only if the author explicitly
   asked for `full`.
4a. **Resolved at intake (was a gap).** Both adapters strip a slide to `location` +
    `mapmarker` whenever the effective note display is `full`, keyed on `noteDisplay` rather
    than on the layout. Since timeline honours the configured `noteDisplay`, `full` in a
    timeline would have produced rows with no date, no title, and no thumbnail — contradicting
    assumption 4 above. The strip is now conditioned on the layout as well, so `card` and
    `full` are byte-identical to before and a timeline keeps title, cover, date, and body.
5. No `followMap` toggle: the map keeps following the active slide.
6. The built-in `height` default stays `520px`; timeline authors are expected to set a taller
   height, and the Obsidian host already forces `100%`.

## 6. Work already required per host

| Host | Change | No change needed |
| --- | --- | --- |
| `story-map-core` | Types, schema, parser coercion, tests | — |
| `react-story-map` | New `Timeline.tsx`, `StoryMap.tsx` branch and shared note-link helper, `markerOffset.ts`, `styles.css`, tests | `MapCanvas.tsx`, `index.ts` (no new public API) |
| `obsidian-story-map` | `resolver.ts` date threading, `resolver.test.ts`, README | `view.tsx`, `obsidian.css`, `settings-data.ts`, `settings-tab.ts`, `i18n.ts` |
| `remark-story-map` | `vault.ts` date threading, `index.test.ts`, README | `index.ts`, `client.tsx` |
| `examples/docusaurus` | — | All files; no layout selectors |
| `site/` (part of `pnpm build`) | `App.tsx`, `stories.ts`, `i18n.ts` | — |
| Docs | `SPEC.md`, `AGENTS.md`, `docs/architecture.md`, four package READMEs | `docs/docusaurus-full-page.md` |
