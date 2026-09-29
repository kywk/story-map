# Multi-agent task prompt: timeline layout

Use the following prompts with a coding orchestrator / Codex-style multi-agent workflow.
Track letters match the ownership table in [implementation-plan.md](implementation-plan.md) §6
and the phases in that plan.

Before dispatching any track, hand every agent this preamble.

---

## Preamble (all agents)

You are adding a third StoryMap layout mode, `timeline`, to this repository.

Read before changing code:

1. `SPEC.md`
2. `AGENTS.md`
3. `docs/architecture.md`
4. `docs/history/2026-09-30-timeline-layout/conversation-summary.md` (why the design is what it is)
5. `docs/history/2026-09-30-timeline-layout/implementation-plan.md` (exact files and tests)

The design is already decided. Do not redesign it.

### Global constraints

- Timeline is a third value of the document-owned `layout.mode` enum: `card | full | timeline`.
- **No new configuration key.** Timeline reuses `layout.full.side` and
  `layout.full.contentRatio`. Do not introduce a `layout.timeline` block.
- `StorySlide.date?: number` (epoch ms) is the only new public data field. It is filled from
  the existing `dateField` frontmatter value and may be authored on explicit slides.
- `noteDisplay` is not forced for timeline. Do not modify `effectiveNoteDisplay` behavior.
- `layout` stays document-only. Do not add a plugin setting, a default, or an
  `applySourceDefaults` entry.
- Out of scope, do not implement: the `Timeline | Map | Gallery` view switcher, a `gallery`
  mode, numbered map markers, date grouping headers, autoplay, a `followMap` toggle,
  `video`/`iframe` thumbnails, and any Obsidian settings UI.
- `react-story-map` must keep importing no Obsidian, Docusaurus, or Node API, and must keep
  loading Leaflet only inside a browser effect.
- The Leaflet instance must stay stable across layout changes.
- Keep changes inside the package directory you own. Do not edit root config.

### Commit discipline

One commit per track, grouped by package responsibility, in the order A → B → {C1, C2} → D →
E. Do not squash unrelated work into your track.

---

## Track A — `story-map-core` owner

Ownership: `packages/story-map-core/**`

Tasks:

- add `'timeline'` to `StoryMapLayoutMode` and to the layout `mode` enum in the schema, leaving
  every `card` / `full` default untouched;
- add `date?: number` to `StorySlide` and to `storySlideSchema`;
- coerce `date` in `normalizeSlide` with the existing `toTimestamp` helper so `Date` (js-yaml
  timestamp or Obsidian frontmatter), `number`, and `string` inputs all work;
- throw a `StoryMapParseError` with a message shaped like the existing location error when
  `date` is present but unparseable; omit the key when `date` is absent;
- add parser tests for: timeline mode parsing, unchanged `card` / `full` defaults, all three
  `date` input shapes, the unparseable error, `effectiveNoteDisplay('timeline', x) === x` for
  all three `noteDisplay` values, and `mergeResolvedSlide` giving an authored `date`
  precedence;
- confirm `locationOnlySlide` drops `date` (so `noteDisplay: full` slides carry no date) and
  add a test if that is not already covered.

Do not edit other packages. Do not rename or remove any public type.

Return:

- changed files;
- test cases added and the command output proving they pass;
- the final public type signatures other agents must code against;
- any mismatch you find between the plan and the actual code.

---

## Track B — `react-story-map` owner

Ownership: `packages/react-story-map/**`
Depends on: Track A's type signatures.

Tasks:

- add `src/Timeline.tsx` exporting the timeline surface and an exported `formatTimelineDate`
  that formats with
  `Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })`
  so SSR markup and hydration agree and a UTC-midnight date never shifts a day;
- render every slide as a row, not only the active one: `<ol>` / `<li>`, a `<time>` chip
  (omitted when the slide has no date), an `image`-only thumbnail, a title, a two-line clamped
  Markdown description, and a separate note-link chip;
- keep a real `<h3>` per entry by putting a `<button>` inside the heading whose `::after`
  stretches over the whole row; keep the note link a sibling raised above that stretched
  button so the two are never nested interactive elements;
- extract the anchor logic out of `SlideTitle` into a shared helper and use it from both the
  panel heading and the timeline note chip, so `onNoteClick`, `onNoteHover`, and
  `noteLinkClassName` behave identically in both (Obsidian Page preview and new-tab open depend
  on this);
- branch on `isTimeline` in `StoryMap.tsx`: render the timeline instead of the panel, do not
  render `StoryNav`, and emit `data-timeline-side={layout.full.side}`;
- auto-scroll the active row with `scrollIntoView({ block: 'nearest' })` on `activeIndex`
  change, guarded for a missing element;
- treat `timeline` like `full` in `getMarkerFocus` (side-aware horizontal centering, top band
  on narrow viewports);
- add the `[data-layout='timeline']` CSS: column surface, spine, node, date chip, thumbnail,
  clamp, active-row emphasis, note chip above the stretched button, and the ≤640px vertical
  fallback — all through the existing semantic `--story-map-*` variables, with no new palette;
- do **not** edit `MapCanvas.tsx` or `index.ts`; the existing effect already depends on
  `layout.mode` and no public API is added;
- add SSR tests with `renderToStaticMarkup` for: `data-layout` / `data-timeline-side`, all
  slides present, formatted date present, absent date renders no `<time>`, active row marking
  and `aria-current` under `initialSlide`, absence of `story-map__nav`, `story-map__map` still
  preceding the presentation layer, and a note chip that carries the same anchor shape as the
  panel title;
- extend `markerOffset.test.ts` with the wide and narrow timeline focus cases;
- update the package README "Themes and layouts" section.

Return:

- changed files;
- test output;
- confirmation that `MapCanvas.tsx` and `index.ts` are untouched;
- any place where the DOM structure had to deviate from the plan, and why.

---

## Track C1 — Obsidian adapter owner

Ownership: `packages/obsidian-story-map/**`

Tasks:

- pass the already-computed `entry.date` into `resolveDiscoveredNote` and set `slide.date` when
  it is not `null`;
- take `date` from the configured `dateField` only — do not add a date fallback key to
  `slideFromNoteFrontmatter`, because the two hosts must not be able to disagree;
- thread `dateField` into `resolveExplicitSlides` / `resolveSlide` so an explicit `note:`
  reference can contribute the note's `dateField` value, while an authored `slide.date` still
  wins through `mergeResolvedSlide`;
- keep the frontmatter for a timeline: change the `locationOnlySlide` branch in
  `resolveDiscoveredNote` and `resolveSlide` to
  `noteDisplay === 'full' && source.layout.mode !== 'timeline'`. Without this, a timeline with
  `noteDisplay: full` yields rows with no date, no title, and no thumbnail. `card` and `full`
  results must be byte-identical to before;
- add tests: folder discovery emits `date` matching `toTimestamp`; changing `dateField` changes
  which key feeds both ordering and `date`; an authored `date` wins; an unparseable note date
  is discovered but has no `date`; `layout: { mode: 'timeline' }` with `noteDisplay: 'link'`
  keeps description, cover, and `notePath`; `layout: { mode: 'timeline' }` with
  `noteDisplay: 'full'` keeps title, cover, `date`, and `notePath`; and
  `layout: { mode: 'card' }` with `noteDisplay: 'full'` still strips to `location`, proving the
  carve-out is narrow;
- update the package README example and the document-only key list if the wording needs it.

Do not change `view.tsx`, `obsidian.css`, `settings-data.ts`, `settings-tab.ts`, or
`i18n.ts`. Do not add a setting.

Return:

- changed files;
- test output;
- the exact `date` semantics you implemented, so the Remark owner can match them.

---

## Track C2 — Remark / Docusaurus owner

Ownership: `packages/remark-story-map/**`

Tasks:

- mirror Track C1 in `src/vault.ts`: the same `dateField` value that drives `sortNoteDates`
  must also fill `slide.date`, the same coercion, the same "authored value wins" rule, and the
  same `noteDisplay === 'full' && source.layout.mode !== 'timeline'` condition in `slideForNote`
  and `resolveSlide`. The two adapters must read identically here — the integrator diffs this
  condition as the parity gate;
- add the parity tests from Track C1 through `VaultIndex`, plus a fence test proving a
  timeline config with slide dates survives `data-story-map-config` serialization intact;
- update the README line that states document-owned `layout` is `card` or `full`.

Do not change `src/index.ts` or `src/client.tsx` (the transform serializes the config verbatim
and the browser client does not re-validate the schema). Do not change anything in
`examples/docusaurus`; if you believe a host file must change, stop and report instead.

Return:

- changed files;
- test output;
- explicit confirmation that the Obsidian and Remark `date` semantics are identical.

---

## Track D1 — Landing site owner

Ownership: `site/**`

Tasks:

- add `timeline` to the layout `<select>`; the existing non-card branch already exposes `side`
  and `contentRatio`, which timeline reuses, so no new control;
- give the example spots an optional `date` and map it to `date: Date.parse(spot.date)` so the
  timeline demo shows real dates;
- update the English and Chinese copy: the `layout.mode` settings-reference row, the feature
  line that says "card or full layouts", and the demo lede;
- verify the site still builds and renders the timeline at desktop and narrow widths.

Do not change renderer or core code to make the site work.

---

## Track D2 — Documentation owner

Ownership: `SPEC.md`, `AGENTS.md`, `docs/architecture.md`, package READMEs that C1/C2 did not
already update.

Tasks:

- `SPEC.md`: the `layout` block in §6, the layout prose in §6.4, the canonical render model in
  §7, the `StorySlide` interface with `date`, and an explicit sentence that only the `full`
  layout forces `noteDisplay: full` while timeline honours the configured value;
- `AGENTS.md`: "The renderer owns both layouts" becomes all three modes; the document-only key
  list is unchanged; extend the definition-of-done item 10 and the manual smoke list with the
  timeline matrix;
- `docs/architecture.md`: the §6 defaults table row for `layout.mode`, a note in the note
  display section, the §10 tests table, and the §11 "where to change what" row;
- do not add timeline to the plugin settings reference anywhere; it is document-only.

Do not document behavior that is not implemented yet — write this after Tracks A–C land.

---

## Track E — Integrator

Start only after A, B, C1, C2, D1, D2 finish.

Ownership: root config, cross-package integration fixes, final documentation consistency. No
feature expansion.

Tasks:

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

Then:

1. verify the two adapters produce identical `date` values for the same Vault fixtures — this
   is the main parity risk in the milestone;
2. verify an already-published page serialized with `mode: 'card'` still renders after the
   renderer change, and that no new required key can make an old payload throw;
3. run the manual smoke matrix from
   [implementation-plan.md](implementation-plan.md) §5, including the timeline-specific item 12;
4. confirm `examples/docusaurus` is unchanged — if it needed an edit, the plan leaked host
   concerns into the renderer;
5. fix only real integration defects; keep changes local and preserve package boundaries.

## Final report format

Provide:

- features confirmed working, mapped to the acceptance items in
  [implementation-plan.md](implementation-plan.md) §5;
- commands run and their results;
- the cross-host `date` parity evidence;
- remaining defects or blockers;
- deferred items explicitly left out of scope;
- no speculative future architecture unless needed to explain a blocker.

---
