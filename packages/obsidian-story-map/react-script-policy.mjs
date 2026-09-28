import { readFile } from 'node:fs/promises';

const message = 'Geo Story Map does not support creating or loading script elements.';

// React 19.3's generic resource APIs are unused by this Obsidian host. Disable actual
// script creation, including inert script rendering, rather than disguising the calls.
// Keep this transformation host-local: the published React/Remark libraries are unchanged.
export function disableReactScripts(source) {
  let calls = 0;
  let branches = 0;
  const code = source
    .replace(/\b(?:ownerDocument|hoistableRoot)\.createElement\("script"\)/g, () => {
      calls += 1;
      return 'geoStoryMapRejectScriptElement()';
    })
    .replace(/case "script":\s*[\s\S]*?\.innerHTML = "<script>[^\n]*\n[\s\S]*?break;/g, () => {
      branches += 1;
      return 'case "script": geoStoryMapRejectScriptElement(); break;';
    });
  if (calls !== 3 || branches !== 1) {
    throw new Error(`React script policy needs review: expected 3 resource calls and 1 rendering branch, found ${calls} and ${branches}.`);
  }
  return `${code}\nfunction geoStoryMapRejectScriptElement() { throw new Error(${JSON.stringify(message)}); }\n`;
}

export function reactScriptPolicy() {
  return {
    name: 'geo-story-map-disable-react-scripts',
    setup(build) {
      build.onLoad({ filter: /react-dom-client\.(?:production|development)\.js$/ }, async ({ path }) => ({
        contents: disableReactScripts(await readFile(path, 'utf8')),
        loader: 'js',
      }));
    },
  };
}

export function assertNoScriptCreation(bundle) {
  if (/\.createElement\(\s*["']script["']\s*\)/i.test(bundle) || /\.innerHTML\s*=\s*["']<script>/i.test(bundle)) {
    throw new Error('Obsidian bundle still contains script-element creation; review before release.');
  }
}
