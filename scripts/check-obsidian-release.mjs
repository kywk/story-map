import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { builtinModules, createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';
import { assertNoScriptCreation } from '../packages/obsidian-story-map/react-script-policy.mjs';

const nodeRequire = createRequire(import.meta.url);

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(join(root, 'manifest.json')));
const plugin = JSON.parse(readFileSync(join(root, 'packages/obsidian-story-map/package.json')));
const dist = join(root, 'packages/obsidian-story-map/dist');
assertNoScriptCreation(readFileSync(join(dist, 'main.js'), 'utf8'));
assert.equal(manifest.id, 'geo-story-map');
assert.equal(manifest.name, 'Geo Story Map');
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.version, plugin.version);
assert.equal(manifest.isDesktopOnly, true);
assert.equal(manifest.minAppVersion, '1.8.7');
assert(manifest.description.length <= 250 && manifest.description.endsWith('.'));
assert.deepEqual(JSON.parse(readFileSync(join(dist, 'manifest.json'))), manifest);
assert.deepEqual(JSON.parse(readFileSync(join(dist, 'versions.json'))),
  JSON.parse(readFileSync(join(root, 'versions.json'))));
const notices = readFileSync(join(dist, 'THIRD_PARTY_NOTICES.txt'), 'utf8');
for (const name of ['react@', 'react-dom@', 'leaflet@', 'zod@', 'js-yaml@']) assert(notices.includes(name), `Missing license: ${name}`);
assert(readFileSync(join(dist, 'styles.css'), 'utf8').includes('.story-map'));

const exports = {};
const module = { exports };
const obsidian = Object.fromEntries(['Plugin', 'PluginSettingTab', 'TextFileView',
  'TFile', 'WorkspaceLeaf', 'Setting', 'Modal'].map(name => [name, class {}]));
const host = {
  module, exports, console, setTimeout, clearTimeout, queueMicrotask,
  require(name) {
    if (name === 'obsidian') return obsidian;
    const bare = name.startsWith('node:') ? name.slice(5) : name;
    if (builtinModules.includes(bare)) return nodeRequire(name);
    throw new Error(`Unexpected runtime dependency: ${name}`);
  },
  // The browser Markdown decoder eagerly creates an inert element. Map initialization
  // must remain deferred; any other import-time DOM access fails this check.
  document: {
    createElement(name) {
      assert.equal(name, 'i', `Unexpected import-time DOM initialization: ${name}`);
      return { innerHTML: '', textContent: '' };
    },
  },
};
try {
  runInNewContext(readFileSync(join(dist, 'main.js'), 'utf8'), host, { timeout: 10000 });
} catch (error) {
  throw new Error(`Plugin bundle import failed: ${error.message}`);
}
assert.equal(typeof module.exports.default, 'function');
console.log(`Obsidian ${manifest.version} manifest, notices and bundled CommonJS entry verified.`);
