// Module-boundary guards for the two entries.
//
// The package splits into a Node build-time entry (`index.ts`, `vault.ts`) and a
// browser entry (`client.tsx`). The split is a hard rule from the package
// contract, and nothing at runtime enforces it: a stray `node:fs` import in the
// client would still work in a test and break a browser bundle. These checks read
// the sources so the boundary is pinned rather than assumed.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

function source(file: string): string {
  return readFileSync(new URL(file, import.meta.url), 'utf8');
}

describe('client entry has no Node API', () => {
  it('imports no Node built-in', () => {
    const client = source('./client.tsx');

    expect(client).not.toMatch(/from ['"]node:/);
    expect(client).not.toMatch(/\brequire\(/);
    // Bare specifiers would resolve to a browser polyfill or fail; Node built-ins
    // always carry the `node:` prefix or a bare core name.
    expect(client).not.toMatch(/from ['"](fs|path|os|url|child_process|crypto)['"]/);
  });

  it('loads Leaflet only through the renderer, never directly', () => {
    const client = source('./client.tsx');

    // The CSS import is fine - bundlers handle it - but no JS Leaflet import may
    // appear, or a page without a host would still pull the library in.
    expect(client).not.toMatch(/import ['"]leaflet['"]/);
    expect(client).toMatch(/import ['"]leaflet\/dist\/leaflet\.css['"]/);
  });

  it('reaches the renderer only through a dynamic import', () => {
    const client = source('./client.tsx');

    // A static renderer import would defeat the "loads only when a host exists"
    // promise, and would drag Leaflet into the SSR graph.
    expect(client).not.toMatch(/^import .*from ['"]@story-map\/react-story-map['"]/m);
    expect(client).toMatch(/import\(['"]@story-map\/react-story-map['"]\)/);
  });
});

describe('build-time entry has no browser API', () => {
  it('never touches the DOM or Leaflet', () => {
    const build = source('./index.ts');

    expect(build).not.toMatch(/\bdocument\./);
    expect(build).not.toMatch(/\bwindow\./);
    expect(build).not.toMatch(/from ['"]leaflet/);
    expect(build).not.toMatch(/react/);
  });

  it('reads the filesystem only through the vault module', () => {
    const vault = source('./vault.ts');

    // `fs` lives in exactly one module so the Node/browser split stays legible.
    expect(vault).toMatch(/from ['"]node:fs['"]/);
    expect(source('./index.ts')).not.toMatch(/from ['"]node:/);
  });
});
