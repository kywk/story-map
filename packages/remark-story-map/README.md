# @story-map/remark-story-map

Build-time Remark adapter and browser client for publishing StoryMap fenced
blocks (` ```story-map `) in a Docusaurus site.

At build time the plugin parses each fenced block with `story-map-core`,
optionally resolves notes from a Vault, and replaces the block with a
`.story-map-host[data-story-map-config]` placeholder. No Leaflet map is created
during the Node/SSR build. In the browser, the client entry mounts the shared
`@story-map/react-story-map` renderer into every host, including after
Docusaurus SPA navigation.

- Build entry: `@story-map/remark-story-map` (Node APIs allowed).
- Browser entry: `@story-map/remark-story-map/client` (no Node APIs).
- Route/slug policy stays with the host; this package never implements
  Docusaurus slug rules.

## Installation

```bash
pnpm add @story-map/remark-story-map react@^19 react-dom@^19
```

The renderer is pulled in transitively, but the host site is responsible for
providing `react` / `react-dom` (declared as peer dependencies).
Both peers must be React 19. A Docusaurus installation using React 18 does not satisfy
these peer requirements; verify the site's versions before integrating. Build-time
usage is ESM and the release workflow verifies Node 24 imports. A full Docusaurus site
build and browser smoke test remain host integration checks.

## Docusaurus setup

Register the transformer in the docs and/or blog options. The same plugin
instance can be used for both:

```js
import remarkStoryMap from '@story-map/remark-story-map';

const storyMapOptions = {
  vaultRoot: '/absolute/path/to/vault',
  assetBase: '/vault-assets',
  resolveNoteHref: (vaultRelativePath) => {
    // See "Resolving published note routes" below.
    return undefined;
  },
};

export default {
  presets: [
    [
      'classic',
      {
        docs: {
          remarkPlugins: [[remarkStoryMap, storyMapOptions]],
        },
        blog: {
          remarkPlugins: [[remarkStoryMap, storyMapOptions]],
        },
      },
    ],
  ],
  plugins: ['./plugins/story-map-client'],
};
```

Blog support uses the same adapter; only add it when a real blog StoryMap use
case exists.

## Options

| Option | Type | Purpose |
| --- | --- | --- |
| `vaultRoot` | `string` | Vault/repo root to index. Required for explicit `slide.note` WikiLinks and recursive `noteFolder` discovery. |
| `assetBase` | `string` | URL prefix that rewrites resolved Vault-relative media paths (for example `/vault-assets`). It only rewrites URLs; it does not copy files. |
| `resolveNoteHref` | `(vaultRelativePath: string) => string \| undefined` | Host callback that maps a Vault-relative note path (without `.md`) to its final published href. Used by `noteDisplay: link`. |

`vaultRelativePath` is the note's Vault-relative path without the extension,
using forward slashes, for example `Trips/Santiago`.

When `vaultRoot` is omitted, fenced blocks are parsed and serialized, but no
note or `noteFolder` resolution happens.

## Resolving published note routes

`resolveNoteHref` lets the host decide published URLs. The `kywk.github.io`
site already owns this decision through `scripts/content-links.js`, which
exports `createContentLinkIndex({ root, docsConfig, blogConfig })`. Its index
exposes `resolve(name)`, returning an array of entries with a `.route`
property. Wire the callback to that existing index instead of reimplementing
slug logic:

```js
import { createContentLinkIndex } from './scripts/content-links.js';

const contentLinkIndex = createContentLinkIndex({
  root: vaultRoot,
  docsConfig,
  blogConfig,
});

const storyMapOptions = {
  vaultRoot,
  assetBase: '/vault-assets',
  resolveNoteHref: (vaultRelativePath) => {
    const matches = contentLinkIndex.resolve(vaultRelativePath);
    return matches.length === 1 ? matches[0].route : undefined;
  },
};
```

Rules enforced by the package:

- `resolveNoteHref` is only consulted for `noteDisplay: link`.
- A returned string becomes `StorySlide.notePath`, which the renderer turns
  into a normal browser link.
- `undefined` (or an ambiguous multiple-match result) leaves the slide title
  unlinked; the build does not invent a route.
- No absolute local filesystem path is ever serialized into the HTML.

Do not copy `deriveSlug()` or any Docusaurus URL normalization into the
package or the site's StoryMap config; keep the existing
`scripts/content-links.js` / `remark-slug-normalizer` pipeline as the single
URL authority.

## Note resolution

With `vaultRoot` configured, notes are indexed recursively. The scanner skips
dot-directories, `node_modules`, `build`, `dist`, and `coverage`.

### Explicit slides

A slide with `note: "[[Trips/Santiago]]"` inherits note frontmatter
(`title`, `description`/`summary`, `location`, `cover`/`image`/`media`,
`mapmarker`). Explicit slide properties override note-derived values, and
explicit slides keep their author order exactly: they are never appended to or
reordered by folder discovery. A WikiLink matching multiple notes without an
explicit path is a build-time error; use a Vault-relative path.

### `noteFolder`

`noteFolder` names one Vault-relative folder (subfolders are included
recursively). Order is controlled only by:

- `order: asc | desc` (default `asc`);
- `dateField` (default `date-created`).

Only notes whose frontmatter contains `story-map-note: true` are discovered;
other Markdown files in the folder are ignored. Notes without a parseable date
sort last.

`includeTags` keeps only notes whose frontmatter tags contain any listed tag,
and `excludeTags` drops notes whose frontmatter tags contain any listed tag.
Both are optional, compare case-insensitively, and read the frontmatter `tags` or
`tag` key only (matching Obsidian).

```yaml
noteFolder: Trips/Santiago
order: desc
dateField: date-created
includeTags: [travel, chile]
excludeTags: [draft]
```

## `noteDisplay`

Note presentation is controlled by `noteDisplay`, which accepts:

- `basic` — frontmatter-derived content only.
- `link` — frontmatter basics plus a host-resolved `notePath` when
  `resolveNoteHref` returns a string. This is the default.
- `full` — frontmatter basics plus the frontmatter-stripped note Markdown body
  as slide text.

`link` is platform-specific only at navigation time: Docusaurus resolves the
published route and the renderer emits a normal browser link.

## Media resolution

Relative media is resolved against the correct source document:

- note-derived media resolves relative to the note file;
- media authored explicitly on a slide resolves relative to the StoryMap source
  Markdown document.

Absolute `http:`/`https:`/`data:`/`blob:` URLs are left unchanged. When
`assetBase` is set, resolved Vault-relative paths are rewritten to
`<assetBase>/<path>` for the browser.

`assetBase` only rewrites URLs. Copying Vault attachments into the Docusaurus
static directory remains part of the site's own publishing pipeline; the
package never copies files.

## Registering the browser client

Docusaurus client modules are registered by a small local plugin. See
`examples/docusaurus/story-map-client-plugin.cjs`:

```js
module.exports = function storyMapClientPlugin() {
  return {
    name: 'story-map-client',
    getClientModules() {
      return [require.resolve('@story-map/remark-story-map/client')];
    },
  };
};
```

Add `./plugins/story-map-client` (or the equivalent path) to the site's
`plugins` list. The client entry only initializes maps in the browser,
mounts every host on the page, skips duplicate mounts, unmounts roots whose
host nodes were removed during SPA navigation, and keeps Node APIs out of the
browser bundle.

## Docusaurus theme bridge

The generic renderer owns the StoryMap semantic CSS variables. The Docusaurus
site maps Infima variables onto them via a host stylesheet, not inside the
renderer. Copy `examples/docusaurus/story-map-theme.css` into the site and
load it through the Docusaurus stylesheet chain:

```css
.story-map-host {
  --story-map-bg: var(--ifm-background-surface-color);
  --story-map-fg: var(--ifm-font-color-base);
  --story-map-muted: var(--ifm-color-emphasis-700);
  --story-map-border: var(--ifm-color-emphasis-300);
  --story-map-accent: var(--ifm-color-primary);
}
```

This keeps panel, text, border, buttons, and links readable in light and dark
themes. Dynamic light/dark tile provider switching is deferred; the goal is
readable, theme-compatible StoryMap chrome/panel content.

## Full-page view

A full-viewport map (Obsidian's "Open as Story Map") with a Markdown toggle is
**not** a package option. It manipulates Docusaurus theme DOM, collapses the
docs sidebar, listens to the route lifecycle, and needs host CSS, so it stays in
the host site. The transform already stamps document hosts with
`data-story-map-document="true"`; a small host client module reads that. See
[`../../docs/docusaurus-full-page.md`](../../docs/docusaurus-full-page.md) and
`examples/docusaurus/story-map-view.js`.

## How the pipeline fits together

```text
story-map fenced block
  -> remark-story-map (build-time, Node)
  -> VaultIndex (explicit notes / noteFolder)
  -> host resolveNoteHref(vaultRelativePath)
  -> existing contentLinkIndex / published route
  -> serialized StoryMapConfig in .story-map-host
  -> browser StoryMap client
  -> shared @story-map/react-story-map renderer (Leaflet imported client-side)
```
