// The Obsidian release check evaluates the real plugin bundle against a stub
// `obsidian` module. A value the bundle imports but the stub omits only fails at
// evaluation time, and if the value is a class extended at module scope it throws
// as "Class extends value undefined" - a long way from the missing stub entry.
//
// This test reads the plugin's own imports and asserts the stub covers them, so a
// newly imported Obsidian symbol fails a normal `pnpm test` instead of the release
// workflow.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { OBSIDIAN_STUB_CLASSES, OBSIDIAN_STUB_FUNCTIONS } from './obsidian-release-stub.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'packages/obsidian-story-map/src');

/** Value (non-type) names imported from `obsidian`, across every source file. */
function obsidianValueImports() {
  const names = new Set();
  for (const file of readdirSync(srcDir)) {
    if (!/\.tsx?$/.test(file) || file.includes('.test.')) continue;
    const source = readFileSync(join(srcDir, file), 'utf8');
    for (const match of source.matchAll(/import\s+(type\s+)?\{([^}]*)\}\s*from\s*'obsidian'/g)) {
      if (match[1]) continue; // `import type { ... }` needs no runtime value
      for (const part of match[2].split(',')) {
        const entry = part.trim();
        // A `type`-prefixed member of a mixed import is erased at compile time,
        // exactly like a whole `import type { ... }` declaration.
        if (!entry || entry.startsWith('type ')) continue;
        const name = entry.split(/\s+as\s+/)[0].trim();
        if (name) names.add(name);
      }
    }
  }
  return names;
}

/** The names the release check's stub module actually provides. */
function stubbedNames() {
  return new Set([...OBSIDIAN_STUB_CLASSES, ...Object.keys(OBSIDIAN_STUB_FUNCTIONS)]);
}

test('the release check stubs every Obsidian value the plugin imports', () => {
  const imported = obsidianValueImports();
  assert.ok(imported.size > 0, 'expected the plugin to import something from obsidian');

  const stubbed = stubbedNames();
  const missing = [...imported].filter((name) => !stubbed.has(name)).sort();

  assert.deepEqual(
    missing,
    [],
    'scripts/check-obsidian-release.mjs does not stub these Obsidian values, so the bundled ' +
      `plugin would throw on import: ${missing.join(', ')}`,
  );
});
