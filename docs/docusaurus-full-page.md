# Docusaurus full-page StoryMap (host-owned)

This document shows how to make a `story-map: true` document open as a
full-viewport map on a Docusaurus site, mirroring Obsidian's **Open as Story
Map**, with a toggle back to Markdown.

**This is a host feature, not a `@story-map/remark-story-map` feature.** The
package stops at emitting the `.story-map-host` placeholder and mounting the
renderer. The full-page view lives in the host because it manipulates
Docusaurus theme DOM, the docs sidebar, the route lifecycle, `sessionStorage`,
and host CSS — all of which the package boundaries keep out of the generic
adapter (see `../SPEC.md` §11 and `../AGENTS.md`).

## Why it is not in the package

| Concern the full-page view needs | Why it stays host-side |
| --- | --- |
| Body/theme classes (`.theme-doc-toc-desktop`, `.theme-doc-sidebar-container`, `.pagination-nav`) | Docusaurus theme internals; unstable across versions. |
| Sidebar collapse (`collapseSidebarButton`, `docSidebarContainerHidden`) | Docusaurus docs layout, not a StoryMap concept. |
| CSS variables (`--ifm-navbar-height`, `--doc-sidebar-hidden-width`) | Infima-only; the package must not hard-code Docusaurus variables. |
| `onRouteDidUpdate` + `sessionStorage` | Docusaurus client lifecycle and per-site UX preference. |

A generic "enable full page" flag cannot implement any of this without coupling
the package to Docusaurus theme internals, which `docs/architecture.md` and the
package README explicitly forbid. Compare the Obsidian host, which forces the
renderer to `height: 100%` in its own view — full-page presentation is a host
concern there too.

## What the example does

For a document whose fence source has `story-map: true`, `remark-story-map`
stamps the emitted host with `data-story-map-document="true"`. The host client
module:

- defaults that page to a full-viewport map and collapses the docs sidebar;
- keeps the navbar and the collapsed/expanded sidebar usable;
- shows a floating toggle to switch back to Markdown and remembers the choice
  per path in `sessionStorage`;
- leaves ordinary pages (which merely mention a StoryMap) untouched;
- re-syncs after SPA navigation.

## Wiring

Files to copy from `examples/docusaurus/` into your site:

| Example file | Site destination |
| --- | --- |
| `story-map-view.js` | next to your client plugin, e.g. `plugins/story-map-client/story-map-view.js` |
| `story-map-full-page.css` | your theme CSS folder, e.g. `src/css/story-map-full-page.css` |
| `story-map-client-plugin.cjs` | your plugin, e.g. `plugins/story-map-client/index.js` |

1. Register both client modules in the site plugin:

   ```js
   module.exports = function storyMapClientPlugin() {
     return {
       name: 'story-map-client',
       getClientModules() {
         return [
           require.resolve('@story-map/remark-story-map/client'),
           require.resolve('./story-map-view.js'),
         ];
       },
     };
   };
   ```

2. Add the plugin and the stylesheet to `docusaurus.config.js|ts`:

   ```js
   export default {
     plugins: ['./plugins/story-map-client'],
     presets: [
       ['classic', {
         theme: {
           customCss: [
             './src/css/custom.css',
             './src/css/story-map-theme.css',
             './src/css/story-map-full-page.css',
           ],
         },
       }],
     ],
   };
   ```

3. Keep the theme bridge (`story-map-theme.css`) alongside it so the map panel
   stays readable in light and dark themes.

No `remark-story-map` option is involved: the transform already emits
`data-story-map-document="true"` from the document frontmatter, and the host
decides how to present it.

## Caveats

- The selectors above target Docusaurus theme class names; review them after a
  Docusaurus major upgrade.
- Toggle labels are plain strings in `story-map-view.js`; localise them for your
  site.
- The view keeps the Docusaurus navbar. If you want a true chromeless map, hide
  the navbar in your own CSS instead of expecting the package to do it.
