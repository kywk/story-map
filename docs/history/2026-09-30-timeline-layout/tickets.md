# Timeline layout: tickets

Derived from [implementation-plan.md](implementation-plan.md). Edges are text. Tracks own one
package directory each, per `AGENTS.md`.

## Graph

```
A ──► B ──┬──► D1 ──┐
         │         ├──► E
A ──► C1 ┼──► D2 ──┤
A ──► C2 ┘         │
                   │
(all of A B C1 C2 D1 D2) ──► E
```

- A blocks B, C1, C2.
- B, C1, C2 are mutually independent and run in parallel.
- D1 needs A + B (it renders the timeline).
- D2 needs A, B, C1, C2 behavior.
- E needs everything.

## A — core: `timeline` mode and `StorySlide.date`

Owner: `packages/story-map-core/**`. May edit `src/{types,schema,parser,helpers}.ts` and
`src/parser.test.ts`. Must not edit other packages, rename or remove a public type, or touch
`applySourceDefaults`.

Acceptance: `pnpm --filter @story-map/story-map-core test` passes with new cases for timeline
mode parsing, unchanged `card`/`full` defaults, `date` coercion from `Date`/number/string, the
unparseable-date `StoryMapParseError`, `effectiveNoteDisplay('timeline', x) === x` for all three
`noteDisplay` values, `mergeResolvedSlide` giving an authored `date` precedence, and
`locationOnlySlide` dropping `date`.

## B — renderer: the timeline surface

Owner: `packages/react-story-map/**`. May edit `src/{Timeline.tsx,StoryMap.tsx,markerOffset.ts,styles.css,README.md}`
and `src/{StoryMap,markerOffset}.test.ts`. Must **not** edit `src/MapCanvas.tsx` or
`src/index.ts`; must add no public export and no new `--story-map-*` palette.

Acceptance: SSR tests pass asserting `data-layout="timeline"`, `data-timeline-side`, all slides
present, `Apr 12, 2024` for `date: 1712880000000`, no `<time>` for a dateless slide,
`aria-current` on the active row under `initialSlide`, absence of `story-map__nav`,
`story-map__map` still first, and a note chip with the same anchor shape as the panel title;
`markerOffset.test.ts` covers wide `{fx:0.75|0.25, fy:0.5}` and narrow `{fx:0.5, fy:0.12}`.

## C1 — Obsidian adapter: `date` threading

Owner: `packages/obsidian-story-map/**`. May edit `src/resolver.ts`, `src/resolver.test.ts`,
`README.md`. Must not edit `view.tsx`, `obsidian.css`, `settings-data.ts`, `settings-tab.ts`,
`i18n.ts`, or add a setting.

Acceptance: folder discovery emits `date` matching `toTimestamp(frontmatter[dateField])`;
changing `dateField` moves both ordering and `date`; an authored `date` wins; an unparseable
note date is discovered with no `date`; timeline + `noteDisplay: 'full'` keeps title, cover,
`date`, and `notePath`; card + `noteDisplay: 'full'` still strips to `location`.

## C2 — Remark adapter: `date` threading

Owner: `packages/remark-story-map/**`. May edit `src/vault.ts`, `src/index.test.ts`,
`README.md`. Must not edit `src/index.ts`, `src/client.tsx`, or anything in
`examples/docusaurus`.

Acceptance: the full C1 parity set passes through `VaultIndex`, plus a fence test proving a
timeline config with slide dates survives `data-story-map-config` serialization intact.

## D1 — landing site

Owner: `site/**`. May edit `src/{App.tsx,stories.ts,i18n.ts}`. Must not change renderer or core
code to make the site work.

Acceptance: the layout `<select>` offers `timeline`; the non-card branch still exposes `side`
and `contentRatio` with no new control; example spots carry a `date` mapped to
`Date.parse(spot.date)`; `pnpm build` passes and the site renders timeline at desktop and narrow
widths.

## D2 — documentation

Owner: `SPEC.md`, `AGENTS.md`, `docs/architecture.md`, and package READMEs C1/C2 did not already
update. Must not document unimplemented behavior, and must not add timeline to any plugin
settings reference.

Acceptance: `SPEC.md` states the `layout` block, the layout prose, the `StorySlide` interface
with `date`, and that only `full` forces `noteDisplay: full` while timeline honours the
configured value; `AGENTS.md` says the renderer owns all three modes and the smoke list includes
the timeline item; `docs/architecture.md` covers the defaults table, the tests table, and §11.

## E — integration gate

Owner: root, cross-package fixes only. No feature expansion.

Acceptance: `pnpm install && pnpm typecheck && pnpm test && pnpm build` green; the two adapters
produce identical `date` for identical Vault fixtures; a pre-change `data-story-map-config`
payload still renders; `examples/docusaurus` is unchanged; the full §5 smoke matrix including
item 12 is completed.
