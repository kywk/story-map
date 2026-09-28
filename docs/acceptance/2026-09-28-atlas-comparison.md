# Atlas comparison and community installation update

## Scope

Recommend the official Geo Story Map community directory in the documentation and
English/Traditional Chinese website. Feature descriptions continue to describe the
current branch. No plugin release, deployment, or renderer change is included.

## Screenshot comparison

The current renderer and the installed Obsidian plugin have identical values for all
10 Atlas CSS tokens, verified by an assertion after normalizing CSS whitespace and
decimal notation. Key values are surface `#ede9dc`, ink `#253b4c`, highlight `#8e3f47`,
and tile filter `sepia(.3) saturate(.9) contrast(.94) brightness(1.03)`.

| Setting | Website screenshot | Obsidian screenshot |
| --- | --- | --- |
| Layout | Card, left aligned | Full, right side, content ratio 0.5 |
| Location | Santiago | Tokyo |
| Effective zoom | 12 (slide location) | 3 (map default; note has no mapzoom) |
| Path | Shown | Hidden |
| Typography | Website serif font | Host system sans font |

The full layout applies a large paper-colored gradient behind its content. The card
layout confines that background to a smaller panel. City-scale tiles also show many
more colored roads than continental-scale tiles. These differences explain the large
visual mismatch without different Atlas token definitions. Obsidian's native theme
bridge is scoped to `auto`, not `atlas`.

Sources: `site/src/stories.ts`, `packages/react-story-map/src/styles.css`,
`packages/react-story-map/src/MapCanvas.tsx`, and the local screenshot vault's
StoryMap document, Tokyo note, installed plugin stylesheet, and appearance settings.
Local vault files were inspected read-only.

## Separate host CSS conflict

The screenshot vault uses Blue Topaz. Its stylesheet includes:

```css
:not(font) > strong {
  color: var(--accent-strong) !important;
  font-family: var(--font-family-strong) !important;
}
```

The dark-host accent is `#e7e7e7`. This overrides the renderer's non-important
`color: inherit` on bold text, including the Tokyo note's bold date.

A temporary browser fixture used the current renderer CSS and the host color rule.
Computed bold-text colors were:

- Control: `rgb(37, 59, 76)` (`#253b4c`).
- With host rule: `rgb(231, 231, 231)` (`#e7e7e7`).

The fixture was removed after verification. This proves the CSS cascade conflict in
isolation; computed styles inside the running Obsidian app were not inspected.
The host conflict remains unfixed. A follow-up should scope any override to StoryMap
content and verify fixed palettes and `auto` in both layouts.

## Installation update validation

- Official community listing and its `obsidian://show-plugin?id=geo-story-map` link
  verified in the browser.
- Traditional Chinese website installation steps and community-directory CTA verified.
- `pnpm --filter @story-map/site typecheck`: exit 0.
- `pnpm --filter @story-map/site build`: exit 0; existing bundle-size warning remains.
- `git -c core.fsmonitor=false diff --check`: exit 0.
- Remote GitHub Actions and deployment: not run for this unpushed change.
