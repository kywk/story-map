# `kywk.github.io` Leaflet migration verification

Scope: the consuming Docusaurus site `kywk.github.io`, not this repository. It moved
its legacy ` ```leaflet ` blocks from a site-local plugin plus a CDN bootstrap onto
`@story-map/remark-story-map`, and deleted the duplicated runtime.

The site still resolves these packages from local tarballs, so the migration is
verified but **not deployed**. The one remaining step, which only the maintainer can
perform, is publishing `@story-map/*@0.5.0`; see [Not yet done](#not-yet-done).

## Automated checks

| Command / check | Result |
| --- | --- |
| `pnpm typecheck` (this repository) | Exit 0; 6 projects |
| `pnpm test` (this repository) | Exit 0; 559 package tests + 7 release-script tests |
| `pnpm build` (this repository) | Exit 0 |
| `pnpm release:check` | Exit 0; 0.5.0 tarballs install in an isolated consumer |
| `npm run typecheck` (the site) | Exit 0 |
| `npm run build` (the site) | Exit 0; `[SUCCESS] Generated static files` |
| `node scripts/content-validator.js` (the site) | Exit 0; 0 errors, 59 warnings, all pre-existing |

## What was verified in a browser

Run against a real production build served over HTTP in headless Chrome, not only by
unit test.

| Check | Result |
| --- | --- |
| `leaflet` blocks rendered | 32 blocks across 31 pages, every one a `data-story-map-kind="map"` host |
| Chile markers | 28, all linked to a published route |
| Egypt markers | 27 and 5, from two hosts on one page, as `sm-1` and `sm-2` |
| Xinjiang markers | 20; the authored id `chile-2509` is preserved, not renamed or deduped |
| Zao markers | 0; that `markerFolder` really is empty, so an empty map is correct |
| Old runtime removed | No `.leaflet-map-wrapper`, `.leaflet-marker-custom`, `.leaflet-custom-popup` or `data-leaflet-config` in any built map page, and no `/js/leaflet-init.js` script |
| Leaflet runtime | One per page, from the client bundle, with `leaflet/dist/leaflet.css` |
| Tile source | The built-in OpenStreetMap URL with visible attribution, requested by the browser |
| Absolute local paths | None in any map payload |
| SPA round trip | Egypt → Chile → Egypt returned exactly 2 hosts / 2 containers / 2 panes; no duplicate mount, no leaked root |
| Marker note link | Hover then click navigated to the note route |
| Narrow viewport | 390 px wide → 310 px map, no horizontal overflow |
| Theme bridge | Correct for all four OS-preference × site-toggle combinations |

## Defects found and fixed during verification

Both were invisible to the automated suite, which is the point of recording them.

1. **A marker note link rendered but could not be clicked.** `tooltipBinding` derived
   `interactive` and the permanent linked-tooltip binding from *host callbacks* rather
   than from the note link, so Docusaurus — whose link is a plain `href` and which
   supplies no callbacks — got `pointer-events: none`, plus a tooltip that Leaflet's
   `mouseout` close removed before the pointer crossed the gap to it. The previous test
   asserted the broken behavior as correct. Fixed in `react-story-map`; see
   [`leaflet-compatibility.md`](../leaflet-compatibility.md).
2. **The `auto` theme bridge was one-directional.** A dark-only bridge is outranked by
   the renderer's own `prefers-color-scheme` block, so a reader on a dark OS who
   switched the site to light still got a dark map. Found only because the first theme
   check ran in a headless browser that reports `prefers-color-scheme: dark`. Both
   directions are now declared, as the Obsidian host already did.

## Not yet done

- `npm-v0.5.0` is unpushed. `release-npm.mjs` publishes through npm OIDC trusted
  publishing, which only works in a GitHub Actions run on the tagged commit, so it
  cannot be completed from a developer machine.
- The site therefore carries three `file:` tarball paths in `package.json`, and
  `npm ci` in its CI cannot resolve them. It cannot deploy until those become
  `"@story-map/remark-story-map": "^0.5.0"`.
- **React error #418 is logged on any page holding a story or map host.** Pre-existing,
  not from this migration: it reproduces on `0.1.1` with no `leaflet` block on the page.
  The client mounts a second `createRoot` into a host element Docusaurus's own React
  tree already owns. Recoverable, and the page renders correctly. Fixing it means
  changing host ownership, which is a Docusaurus-integration change rather than a
  compatibility one.

## Earlier state

The superseded hand-off notes for this migration were removed once their work landed.
The approved design and phase plan remain archived under
[`history/2026-09-29-leaflet-compatibility/`](../history/2026-09-29-leaflet-compatibility/).
