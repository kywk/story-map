# kywk.github.io migration — state at hand-off

Date: 2026-09-30. The migration is functionally complete and verified. One step
remains that only the maintainer can perform: publishing `@story-map/*@0.5.0`.

## What is done and verified

`kywk.github.io` renders all 32 `leaflet` blocks across 31 pages through
`@story-map/remark-story-map`. The old runtime is deleted: the
`remark-obsidian-leaflet` plugin, its `static/js/leaflet-init.js` CDN bootstrap and
its script entry, and the superseded `.leaflet-*` rules in `src/css/custom.css`.
There is one Leaflet runtime per page, from the StoryMap client bundle, loaded only
when a story or map host is present.

Verified in a headless Chrome against a real production build, not only by unit
test. Marker counts match the handoff's expectations exactly: Chile 28, Egypt 27,
Kuala Lumpur 5, Xinjiang 20, Zao 0 (that `markerFolder` really is empty). Both Egypt
maps mount from a single runtime as `sm-1` / `sm-2`. An SPA round trip returns
exactly 2 hosts / 2 containers / 2 panes. No absolute local path reaches the HTML.
The built-in OpenStreetMap source and its attribution are what the browser
requests. Narrow viewport (390px) gives a 310px map with no horizontal overflow.

## Two defects found and fixed here

Both were invisible to the automated suite, in line with the previous round.

1. **A marker note link rendered but was not clickable.** `tooltipBinding` derived
   `interactive` and the permanent linked-tooltip binding from *host callbacks*
   rather than from the note link, so Docusaurus - whose link is a plain `href` and
   which supplies no callbacks - got `pointer-events: none` and a tooltip that
   closed on `mouseout` before the pointer crossed the gap to it. Fixed in
   `react-story-map`; the old test asserted the broken behavior as correct.
2. **The `auto` theme bridge was one-directional.** A dark-only bridge is outranked
   by the renderer's own `prefers-color-scheme` block, so a reader on a dark OS who
   switched the site to light still got a dark map. Found only because the first
   theme check ran in a headless browser that reports `prefers-color-scheme: dark`.
   Both directions are now declared, as the Obsidian host already did.

## The remaining step

The branch is versioned 0.5.0, and the release artifacts are built and verified:

```sh
export PATH="$HOME/.local/share/mise/installs/pnpm/12.4.1:$PATH"
pnpm release:check   # passes: pack, consumer install, import, SSR, transform, CSS exports
```

They were not published, because `release-npm.mjs` publishes with npm OIDC trusted
publishing, which only works in a GitHub Actions run on the tagged commit. This
machine has no npm credentials and an invalid `gh` token. `npm publish` fails
`ENEEDAUTH`; nothing was partially published (all three are `E404`).

To finish, from a machine that can authenticate:

```sh
git tag npm-v0.5.0 feat/leaflet && git push origin feat/leaflet --tags
# then run the publish workflow on that tag
```

Do not `npm publish` by hand: the script's integrity assert is what guarantees a
version is never overwritten with different contents, which is exactly the
collision that made 0.4.0 unusable here.

## Then point the site at the registry

`kywk.github.io/package.json` currently carries three `file:` tarball paths so the
build works locally. Replace them with `"@story-map/remark-story-map": "^0.5.0"`,
drop the two transitive entries, and re-run `npm install` to regenerate
`package-lock.json`. Until that happens `npm ci` in CI cannot resolve them, so the
site cannot deploy. The verified build is otherwise final.

## Also worth knowing

- `kywk.github.io` logs React error #418 on any page with a story or map host.
  Pre-existing, not from this migration: it reproduces on 0.1.1 with no `leaflet`
  block. The client mounts a second `createRoot` into a host element Docusaurus's
  own React tree already owns. Recoverable, page renders correctly, longstanding.
- The site's `plugins/remark-slug-normalizer/src/index.js` carries an unrelated
  uncommitted parenthesis-stripping change from earlier work. Left alone.
