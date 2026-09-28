# Introduction website redesign verification

Scope: `site/`, the Pages quality/deployment workflow, and matching design documentation.
The Obsidian, core, React renderer, and Remark package implementations were not modified.

## Automated checks

| Command / check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Exit 0; lockfile unchanged. Initial sandbox network failure recovered with approved network access. |
| `pnpm typecheck` | Exit 0, all workspaces. |
| `pnpm test` | Exit 0: 6 release tests + 77 core + 14 React + 58 Obsidian + 30 Remark = 185 tests. |
| `pnpm build` | Exit 0, all workspaces including site. |
| `pnpm --filter @story-map/site typecheck` | Exit 0 after final copy and SVG refinements. |
| `pnpm --filter @story-map/site build` | Exit 0 after final refinements. |
| actionlint 1.7.12, all three workflows | Exit 0, independently checked by CI agent. |
| Copyable story source parsed with core `extractFencedBlock` / `parseStoryMapSourceYaml` | Pass; card layout, expected noteFolder. |
| Production HTML's three local entry assets | Present under `/story-map/`; CSS, JS and favicon resolve to output files. |
| `git -c core.fsmonitor=false diff --check` | Exit 0. |

Vite retains a non-failing large-chunk warning (site entry approximately 676 kB,
205 kB gzip); this change does not alter shared renderer packaging.

## Browser evidence

Chrome at 1440px and 390px, English and `zh-Hant`: both languages rendered, language
switch updated the URL and document language, and document scroll width matched viewport.
The configuration table scrolls within its own region on phones and has a swipe hint.

Verified six `data-map-theme` values through the theme selector; card alignment and
width/height CSS variables; full layout selection, right-side and 65% controls;
story selection; Next navigation from Santiago to Valparaiso; FAQ expansion; copy button
success feedback. Clipboard read-back was not confirmed by the browser connector.

Local full-page screenshots are in `.impeccable/review/` (gitignored):
`desktop-en.png`, `desktop-zh.png`, `mobile-en.png`, `mobile-zh.png`.
`preview-zh.png` is the desktop viewport preview. Maps and images use external services;
Google Fonts remains externally hosted. Map navigation labels remain English in the
shared renderer, disclosed beside the playground.

Independent finish review disposition: **ship**, scoped to the supplied screenshots,
source, and direction contract. The Impeccable launcher/detector could not run because
its engine was absent and its cache directory was not writable; review used the skill's
references and an independent agent. No raster comp was used (user selected code-first).

## CI/CD and limits

Pages workflow validates frozen installation, types, tests, and the entire build on
main pushes, PRs targeting main, and dispatch. Only a successful main build can upload
and deploy. PR builds receive read-only repository permission; deployment owns
Pages/OIDC write permissions. Existing release workflows were left unchanged.

Existing remote runs verified successful before changes:
[Pages](https://github.com/kywk/story-map/actions/runs/36357921042),
[npm](https://github.com/kywk/story-map/actions/runs/36357922293),
[Obsidian](https://github.com/kywk/story-map/actions/runs/36357754185).

**NOT_RUN:** new remote Actions run and Pages deployment (not committed or pushed),
Obsidian desktop lifecycle smoke tests, Docusaurus host runtime/SPA smoke tests, and the
complete cross-host manual matrix. Website verification does not claim those product
acceptance gates. The live browser ran the development server; production asset paths
were checked statically after a successful production build.
