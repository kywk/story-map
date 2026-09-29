# Geo Story Map community release

Geo Story Map is published in the
[Obsidian community directory](https://community.obsidian.md/plugins/geo-story-map).
Install it through **Settings → Community plugins → Browse → Geo Story Map**, then enable it.
The [public 0.3.0 release](https://github.com/kywk/story-map/releases/tag/0.3.0) is the
latest published plugin release. See the [0.4.0 release notes](releases/0.4.0.md) for the
current plugin version and its validation evidence.

Plugin: **Geo Story Map**, ID `geo-story-map`, current version `0.4.0`. Desktop only; minimum
Obsidian `1.8.7`. The device-local agent settings and locale detection use
`App.loadLocalStorage`, `App.saveLocalStorage` and `getLanguage`, all introduced in 1.8.7.
The earlier 1.8.0 compatibility checks covered opening, Markdown switching, split-pane
resize and disable cleanup; repeat those smoke tests on the declared minimum version
for future releases. `0.2.0` declared
`1.8.0` incorrectly and was rejected by the review scanner; do not submit it.

## Prepare the release

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
node scripts/check-obsidian-release.mjs
```

Canonical metadata is in root `manifest.json` and `versions.json`. The plugin build
copies them into `packages/obsidian-story-map/dist/`. It also bundles JavaScript/CSS
and generates `THIRD_PARTY_NOTICES.txt` from the actual bundled dependency licenses.
The scoped view-state wrapper becomes inert on disable and preserves later wrappers.

For version 0.4.0, the GitHub tag is exactly **`0.4.0`**, without `v` or
`npm-v`. Attach only `main.js`, `manifest.json` and `styles.css`.
Do not attach a repository ZIP as a replacement for these files. Obsidian downloads
these three automatically. Full dependency notices are appended to `main.js`; the
separate local notice file is not attached to community releases.
Root `versions.json` supports fallback downloads; a release attachment cannot replace it.

## Maintain the community listing

Manage the published [Geo Story Map listing](https://community.obsidian.md/plugins/geo-story-map)
through the owning account at [community.obsidian.md](https://community.obsidian.md).
Keep the listing consistent with the current manifest, supported Obsidian version, and
released behavior. Follow-up plugin versions still require the build and release checks below.

Suggested short description (also in the manifest):

> Turn Markdown notes into geographic stories with an interactive map and slides.

Suggested long description:

> Build geographic stories from ordinary Markdown notes. Display slides beside a
> synchronized Leaflet map, discover notes recursively from one vault folder, keep or drop
> them by frontmatter tag, or supply explicit slides in your chosen order. Choose
> metadata-only, linked-title or full-body note display. Switch between the map and
> Markdown without changing your source files.
> An optional coordinate lookup uses a local CLI agent you configure; the place name is
> sent to that CLI's provider. Desktop Obsidian 1.8.7 or newer is required. Map tiles and
> configured remote media need a network connection; no plugin account or payment is
> required.

Screenshots can be added to the listing after capturing the actual plugin; they are
not a substitute for a working release. No screenshots or unperformed tests are claimed.

## Follow-up releases

Update root manifest and plugin package versions together, build and check, then publish
the matching plain-version GitHub tag with fresh assets. Add each release and its minimum
compatibility to `versions.json`. Do not reuse or replace an already published version.

If you previously installed this project's development build in a `story-map` plugin
folder, disable that copy before enabling `geo-story-map`. Do not overwrite the unrelated
community plugin named Story Map.

Official guide: [Submit your plugin](https://docs.obsidian.md/plugins/releasing/submit-plugin).

The `.github/workflows/release-obsidian.yml` workflow builds and attests the three assets
on plain-version tag pushes. Manual dispatch with an existing tag compares public assets
before adding attestations; mismatches fail without replacing files. Verify provenance
with `gh attestation verify main.js --repo kywk/story-map` (also for `styles.css`).
