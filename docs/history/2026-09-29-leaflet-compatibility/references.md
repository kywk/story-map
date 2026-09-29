# References

Verified during planning on 2026-09-29.

## Primary repositories

- StoryMap:
  https://github.com/kywk/story-map
- Target Docusaurus site:
  https://github.com/kywk/kywk.github.io
- Historical Obsidian Leaflet:
  https://github.com/javalent/obsidian-leaflet

## Relevant historical Leaflet sources

- Settings UI:
  https://github.com/javalent/obsidian-leaflet/blob/main/src/settings/settings.ts
- Defaults/provider data:
  https://github.com/javalent/obsidian-leaflet/blob/main/src/utils/constants.ts
- Saved settings/types:
  https://github.com/javalent/obsidian-leaflet/blob/main/types/saved.d.ts
- Fenced-block parameter interface:
  https://github.com/javalent/obsidian-leaflet/blob/main/types/main.d.ts

## External provider policy

- CARTO Basemaps API key:
  https://www.carto.com/basemaps/apikey/
- OpenStreetMap Tile Usage Policy:
  https://operations.osmfoundation.org/policies/tiles/

## Current custom Docusaurus implementation

- `plugins/remark-obsidian-leaflet/src/index.js`
- `static/js/leaflet-init.js`
- `docusaurus.config.ts`
- StoryMap integration via `@story-map/remark-story-map`
