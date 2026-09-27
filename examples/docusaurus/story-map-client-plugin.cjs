// Site-owned Docusaurus plugin that registers StoryMap client modules.
//
// - `@story-map/remark-story-map/client` (required): mounts the shared renderer
//   into every `.story-map-host` placeholder after SSR and on SPA navigation.
// - `./story-map-view.js` (optional): the host full-page view + toggle. Copy
//   `story-map-view.js` next to this file (or adjust the path) and load
//   `story-map-full-page.css`. See docs/docusaurus-full-page.md.
//
// Add this plugin to the site's `plugins` list.
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
