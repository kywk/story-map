# Timeline layout: implementation plan

Scope and decisions come from [conversation-summary.md](conversation-summary.md). This plan
is file-level and phase-ordered. The ownership split is summarized in §6 and expanded into
pasteable briefs in [multi-agent-task-prompt.md](multi-agent-task-prompt.md).

## 0. Locked contract

```ts
type StoryMapLayoutMode = 'card' | 'full' | 'timeline';

interface StorySlide {
  id?: string;
  note?: string;
  notePath?: string;
  title?: string;
  text?: string;
  date?: number;            // NEW — epoch ms
  location?: StoryLocation;
  media?: StoryMedia;
  mapmarker?: string;
}
```

- `layout.mode` gains `'timeline'`; **no other configuration key is added**.
- `layout.timeline` does not exist. Timeline reads `layout.full.side` and
  `layout.full.contentRatio`.
- `noteDisplay` is not forced for timeline (`effectiveNoteDisplay` unchanged).
- Timeline keeps the note's frontmatter fields even when the author sets `noteDisplay: full`.
  Both adapters strip a slide to `location` + `mapmarker` whenever the effective note display is
  `full`, which would leave every timeline row without a date, a title, and a thumbnail. The
  strip is therefore conditioned on the *layout* as well as the note display (see §3), leaving
  `card` and `full` behavior byte-identical to before. `effectiveNoteDisplay` is still unchanged.
- `date` is document data, never a plugin setting and never a defaultable key.
- Renderer emits `data-layout="timeline"` and `data-timeline-side={layout.full.side}` so CSS
  stays independent of the internal reuse of `layout.full`.

## 1. Phase A — `story-map-core` (blocks everything)

Ownership: `packages/story-map-core/**`. No other package may be edited in this phase.

### `src/types.ts`

- `StoryMapLayoutMode` becomes `'card' | 'full' | 'timeline'`.
- `StorySlide` gains `date?: number`.
- `StoryMapLayoutOptions` is unchanged (`mode`, `card`, `full`).

### `src/schema.ts`

- `storyMapLayoutSchema.mode`: add `'timeline'` to the enum. Defaults for `card` and `full`
  stay as they are, so an inactive mode's options remain normalized in the config.
- `storySlideSchema`: add `date: z.number().int().optional()` (already coerced by the parser,
  so the schema only guards the final shape).

### `src/parser.ts`

- In `normalizeSlide`, coerce `date` through the existing `toTimestamp` helper (accepts
  `Date`, `number`, and `string`, which covers js-yaml timestamps, Obsidian `Date`
  frontmatter values, and hand-written YAML).
- Throw `StoryMapParseError` with a message shaped like the existing location error
  (`slides[i].location is not a valid [lat, lng] coordinate pair.`) when `date` is present but
  unparseable.
- When `date` is absent or unparseable-but-absent, delete the key so the slide stays clean.

### `src/helpers.ts`

- No behavior change. `effectiveNoteDisplay` already returns the configured `noteDisplay` for
  any mode that is not `full`. Add a test to lock this in.
- `mergeResolvedSlide` already gives an authored `slide.date` precedence over a note-derived
  date. Add a test.
- `locationOnlySlide` already drops `date`, so `noteDisplay: full` slides carry no date.

### `src/parser.test.ts`

- `layout: { mode: timeline }` parses; `layout.card.align` and `layout.full.*` still default.
- `slides: [{ date: 2024-04-12 }]` (YAML timestamp), `date: 1712880000000`, and
  `date: 'Apr 12, 2024'` all coerce to epoch ms.
- `date: 'not a date'` throws `StoryMapParseError`; a slide without `date` is unaffected.
- `effectiveNoteDisplay('timeline', 'basic' | 'link' | 'full')` returns the input unchanged.
- `mergeResolvedSlide({ date: 1 }, { date: 2 })` keeps `1`.

Exit criteria: `pnpm --filter @story-map/story-map-core test` and `typecheck` pass; the three
public types are additive only (no renamed or removed public symbol).

## 2. Phase B — `react-story-map` (needs Phase A types)

Ownership: `packages/react-story-map/**`.

### `src/Timeline.tsx` (new)

- `StoryTimeline`: renders the full slide list, the story title as a sticky column header,
  and the scroll container. Props: the resolved `StoryMapConfig`, `activeIndex`, the
  `onGo` callback, plus the existing `onNoteClick` / `onNoteHover` / `noteLinkClassName`.
- `formatTimelineDate(value: number): string` using
  `Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })`.
  Export it so it can be unit-tested directly.
- Row markup: `<ol>` / `<li data-active>`, `<time dateTime={iso}>` above the content,
  `<figure>` thumbnail for `image` media only, `<h3>` wrapping a `<button>` whose `::after`
  stretches the row, a `ReactMarkdown` description in a two-line clamp, and a separate note
  chip.
- Auto-scroll: keep a `ref` array of row elements and, on `activeIndex` change, call
  `scrollIntoView({ block: 'nearest' })` on the active row. Guard for a missing element; do not
  measure or animate.
- Note chip: same anchor semantics as the panel title, rendered through the shared helper
  extracted in `StoryMap.tsx`, so Obsidian Page preview and new-tab open keep working.
- Render nothing for a missing `date` (chip omitted) and nothing for `video` / `iframe` media.

### `src/StoryMap.tsx`

- Extract the anchor construction from `SlideTitle` into a shared helper (for example
  `NoteLink`, or a `noteLinkProps(slide)` function) and use it in both the panel heading and
  the timeline note chip. This is the mechanism that keeps Obsidian callbacks working.
- Branch on `isTimeline` next to the existing `isFull` branch: render `StoryTimeline` instead
  of `.story-map__presentation` + `StoryNav`.
- Emit `data-timeline-side={layout.full.side}` on the section.
- Keep the empty state (`story-map__empty`), the keyboard handler, `onSlideChange`, and the
  `MapCanvas` element exactly as they are. The map must stay the first child and stay mounted.
- No new public export: `src/index.ts` needs no change because `StoryMapLayoutMode` is
  re-exported from core.

### `src/markerOffset.ts`

- Treat `timeline` like `full` in `getMarkerFocus`: side-aware horizontal centering using
  `layout.full.contentRatio`, and the top band (`fy: 0.12`) on narrow viewports. Because the
  timeline reuses the same options, this is a one-line condition change.

### `src/MapCanvas.tsx`

- No change. The active-slide effect already depends on `story.layout.mode` and passes
  `story.layout` to `getMarkerFocus`.

### `src/styles.css`

- Add `.story-map__timeline*` rules under `[data-layout='timeline']`: column surface and
  gradient using the existing `--story-map-panel-bg`, spine line, per-row node (hollow by
  default, filled for `[data-active]`), date chip, fixed-size rounded thumbnail, title, and a
  `-webkit-line-clamp: 2` description.
- Reuse the semantic `--story-map-*` variables so all six built-in themes and the Obsidian
  `auto` bridge apply with no new palette.
- Add the ≤640px vertical fallback: map band on top, full-width list below, matching `full`.
- Note link chip must sit above the stretched row button (`position: relative; z-index`).

### `src/StoryMap.test.tsx` (SSR via `renderToStaticMarkup`)

- `mode: 'timeline'` emits `data-layout="timeline"` and `data-timeline-side="right"` for
  `full.side: 'right'`.
- Every slide is present in the markup, not only the active one.
- `Apr 12, 2024` appears for `date: 1712880000000`; a slide without a date has no `<time>`.
- The active row carries the active marker and `aria-current`; with `initialSlide: 2` the third
  row is the active one.
- `story-map__nav` is absent (no previous/next) and `story-map__map` still precedes the
  presentation layer.
- A slide with `notePath` renders a note chip through the shared helper, and
  `onNoteClick` / `onNoteHover` produce the same anchor shape as the panel title.

### `src/markerOffset.test.ts`

- Wide viewport: `{ fx: 0.75, fy: 0.5 }` for `side: 'left'`, `{ fx: 0.25, fy: 0.5 }` for
  `side: 'right'`; ratio math matches the `full` cases.
- Narrow viewport: `{ fx: 0.5, fy: 0.12 }`.

### `src/README.md`

- Extend "Themes and layouts" with the timeline mode and its DOM/class names.

## 3. Phase C — both adapters in parallel (each needs Phase A; independent of each other)

### `packages/obsidian-story-map/src/resolver.ts`

- `resolveDiscoveredNote` takes the already-computed `entry.date` and sets
  `slide.date` when it is not `null`.
- `resolveExplicitSlides` and `resolveSlide` take `dateField` so an explicit `note:` reference
  can contribute the note's `dateField` value; an authored `slide.date` still wins through
  `mergeResolvedSlide`.
- `date` comes from the configured `dateField` only — never from a fallback key inside
  `slideFromNoteFrontmatter` — so the two hosts cannot select different values.
- Keep the frontmatter for a timeline: the `locationOnlySlide` branch in `resolveDiscoveredNote`
  and `resolveSlide` becomes `noteDisplay === 'full' && source.layout.mode !== 'timeline'`.
  `card` and `full` results are unchanged.
- No change to `view.tsx`, `obsidian.css`, `settings-data.ts`, `settings-tab.ts`, or
  `i18n.ts`.

### `packages/obsidian-story-map/src/resolver.test.ts`

- Folder discovery with `date-created` frontmatter produces `slide.date` matching
  `toTimestamp`.
- `dateField: 'date-visited'` moves which frontmatter key feeds both ordering and `date`.
- An explicit `date` on the slide wins over the note's date.
- A note with an unparseable `dateField` value is still discovered and simply has no `date`.
- `layout: { mode: 'timeline' }` with `noteDisplay: 'link'` keeps description, cover, and
  `notePath` (i.e. timeline does not force full display).
- `layout: { mode: 'timeline' }` with `noteDisplay: 'full'` keeps title, cover, `date`, and
  `notePath` alongside the body text.
- `layout: { mode: 'card' }` with `noteDisplay: 'full'` still strips to `location`, so the
  timeline carve-out is proven narrow.

### `packages/remark-story-map/src/vault.ts`

- The same three changes, using the same `dateField` value that drives
  `sortNoteDates`, so the two hosts select identical slides with identical dates.
- The same `noteDisplay === 'full' && source.layout.mode !== 'timeline'` condition, applied in
  `slideForNote` and `resolveSlide`. The two adapters must be character-for-character identical
  here; the integrator checks this as the parity gate.

### `packages/remark-story-map/src/index.test.ts`

- The parity of the Obsidian cases above, through `VaultIndex`, plus a fence test asserting a
  timeline config with slide dates survives the `data-story-map-config` serialization intact.

### `packages/remark-story-map/src/index.ts`, `src/client.tsx`

- No change. The transform serializes `toStoryMapConfig` output verbatim and the browser client
  does not re-validate the schema.

### Package READMEs

- `remark-story-map`: the line stating document-owned `layout` is `card` or `full`.
- `obsidian-story-map`: the `mode: full` example and the document-only key list.

## 4. Phase D — landing site and documentation

`site/` is a private workspace package, so it is part of `pnpm build` and must stay consistent.

- `site/src/App.tsx`: add `<option value="timeline">` to the layout select (around line 256).
  The existing non-card branch already offers `side` and `contentRatio`, which timeline reuses,
  so no new control is needed. `exampleStory.layout` keeps satisfying
  `typeof current.story.en` because no required key was added.
- `site/src/stories.ts`: give `Spot` an optional `date` string and map it to
  `date: Date.parse(spot.date)` in `buildStory` so the demo timeline shows dates.
- `site/src/i18n.ts`: the `layout.mode` settings-reference row (both languages), the feature
  copy that says "card or full layouts", and the lede that says "six map themes and card or
  full layouts".
- `SPEC.md`: the `layout` block in §6, the layout prose in §6.4, the canonical render model in
  §7, and a sentence in §6.3 or §6.4 stating that timeline uses the configured `noteDisplay`
  (only `full` forces full display).
- `AGENTS.md`: "The renderer owns both layouts" becomes all three; the document-only key list
  stays unchanged; extend the definition-of-done item 10 and the smoke-test list with the
  timeline matrix.
- `docs/architecture.md`: the §6 defaults table row for `layout.mode`, the note-display note in
  §7, the §10 tests table (new react tests), and the §11 "where to change what" row.
- `docs/docusaurus-full-page.md`: no change; it describes host page chrome only.
- Optional: an `examples/` document that demonstrates `layout: mode: timeline`.

## 5. Verification

Automated, from the repository root:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Manual smoke matrix (the AGENTS.md list, with the timeline additions):

1. standalone React rendering (unchanged);
2. Obsidian full-leaf lifecycle and Markdown ↔ StoryMap switching (unchanged);
3. recursive `noteFolder` discovery and `dateField` ordering in both directions, now also
   showing dates in the timeline;
4. explicit slide ordering unaffected by folder settings, including an authored `date`;
5. split-pane resize and Leaflet invalidation (unchanged);
6. Remark transform output for `basic` / `link` / `full`;
7. source-relative and note-relative media (timeline thumbnails included);
8. multiple StoryMaps on one page and clean SPA host removal (unchanged);
9. Docusaurus SSR and build never initialize Leaflet (unchanged — timeline reuses `MapCanvas`);
10. all six built-in themes in `card`, `full`, **and `timeline`**, including card alignment and
    ratios, full left/right ratios, the timeline column in both `side` values, the narrow-screen
    vertical fallback, and a stable Leaflet instance while switching modes;
11. the Docusaurus Infima override bridge remains opt-in and readable;
12. **new** — timeline specifics: every row present, `Apr 12, 2024`-style dates, a row click
    flies the map to that marker, the active row auto-scrolls into view, the spine node fills
    for the active row, no previous/next controls, keyboard arrows still switch slides, no
    note-link hover preview regression in Obsidian, and an authored unparseable `date` surfaces
    a readable configuration error.

## 6. Ownership split

`AGENTS.md` says each agent owns one package directory, so the work splits cleanly. Phases A
and B are strictly sequential; Phase C's two halves and Phase D can run in parallel with each
other once A and B are in place.

| Track | Owner | Files | Depends on |
| --- | --- | --- | --- |
| A | core owner | `packages/story-map-core/src/{types,schema,parser,helpers,parser.test}.ts` | — |
| B | renderer owner | `packages/react-story-map/src/{Timeline.tsx,StoryMap.tsx,markerOffset.ts,styles.css,StoryMap.test.tsx,markerOffset.test.ts,README.md}` | A |
| C1 | Obsidian owner | `packages/obsidian-story-map/src/{resolver.ts,resolver.test.ts,README.md}` | A (types only) |
| C2 | Remark owner | `packages/remark-story-map/src/{vault.ts,index.test.ts,README.md}` | A (types only) |
| D1 | Site owner | `site/src/{App.tsx,stories.ts,i18n.ts}` | A, B |
| D2 | Docs owner | `SPEC.md`, `AGENTS.md`, `docs/architecture.md` | A, B, C1, C2 behavior |
| E | Integrator | root config, cross-package fixes, final gate | all |

C1 and C2 must agree on the exact `date` semantics (same `dateField`, same coercion, same
"authored value wins" rule) or the two hosts will render different timelines. The integrator
owns that parity check; the docs owner owns stating it in `SPEC.md`.

## 7. Definition of done

- All of §5 passes, automated and manual.
- `SPEC.md`, `AGENTS.md`, and `docs/architecture.md` describe timeline in the same change as
  the code.
- No new Obsidian plugin setting, no new defaultable key, and no change to
  `applySourceDefaults`.
- No public core type was renamed or removed; the additions are additive.
- `react-story-map` still imports no Obsidian, Docusaurus, or Node API, and still loads
  Leaflet only inside a browser effect.
- `examples/docusaurus` needed no change; if it did, that is a signal the plan leaked host
  concerns into the renderer and should be reverted.
