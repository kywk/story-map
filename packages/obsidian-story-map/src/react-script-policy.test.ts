import { JSDOM } from 'jsdom';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { build } from 'esbuild';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { assertNoScriptCreation, disableReactScripts, reactScriptPolicy } from '../react-script-policy.mjs';

type Runtime = Pick<typeof import('react-dom/client'), 'createRoot'>
  & Pick<typeof import('react-dom'), 'flushSync' | 'preinit' | 'preinitModule'>
  & { React: typeof import('react'); Button: () => import('react').ReactElement };
let runtime: Runtime;
beforeAll(async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://example.test' });
  vi.stubGlobal('window', dom.window);
  vi.stubGlobal('document', dom.window.document);
  vi.stubGlobal('navigator', dom.window.navigator);
  const result = await build({
    stdin: {
      contents: `
        import * as React from 'react';
        export { React };
        export { createRoot } from 'react-dom/client';
        export { flushSync, preinit, preinitModule } from 'react-dom';
        export function Button() {
          const [count, setCount] = React.useState(0);
          return React.createElement('button', { onClick: () => setCount(count + 1) }, String(count));
        }
      `,
      resolveDir: process.cwd(),
    },
    bundle: true, write: false, format: 'cjs', platform: 'browser',
    define: { 'process.env.NODE_ENV': '"production"' },
    plugins: [reactScriptPolicy()],
  });
  const source = result.outputFiles![0]!.text;
  assertNoScriptCreation(source);
  const module = { exports: {} };
  new Function('module', 'exports', source)(module, module.exports);
  runtime = module.exports as Runtime;
});
afterAll(() => { window.close(); vi.unstubAllGlobals(); });

describe('Obsidian React script policy', () => {
  it('preserves normal rendering, events, state updates and unmount', () => {
    const host = document.createElement('div');
    document.body.append(host);
    const root = runtime.createRoot(host);
    runtime.flushSync(() => root.render(runtime.React.createElement(runtime.Button)));
    expect(host.textContent).toBe('0');
    runtime.flushSync(() => host.querySelector('button')!.click());
    expect(host.textContent).toBe('1');
    runtime.flushSync(() => root.unmount());
    expect(host.childNodes.length).toBe(0);
    host.remove();
  });

  it('rejects script and module preinitialization without inserting elements', () => {
    expect(() => runtime.preinit('https://example.test/blocked.js', { as: 'script' }))
      .toThrow('does not support creating or loading script elements');
    expect(() => runtime.preinitModule('https://example.test/blocked-module.js'))
      .toThrow('does not support creating or loading script elements');
    expect(document.querySelector('script')).toBeNull();
  });

  const scriptCases: import('react').ScriptHTMLAttributes<HTMLScriptElement>[] = [
    { children: 'window.unexpected = true' },
    { async: true, src: 'https://example.test/blocked-render.js' },
  ];
  for (const props of scriptCases) {
    it(`rejects ${props.src ? 'async' : 'inline'} script rendering`, () => {
      const host = document.createElement('div');
      document.body.append(host);
      const errors: Error[] = [];
      const root = runtime.createRoot(host, { onUncaughtError: (error: unknown) => {
        if (error instanceof Error) errors.push(error);
      } });
      try {
        runtime.flushSync(() => root.render(runtime.React.createElement('script', props)));
      } catch (error) {
        errors.push(error as Error);
      }
      expect(errors.some(error => error.message.includes('does not support creating or loading script elements'))).toBe(true);
      expect(document.querySelector('script')).toBeNull();
      root.unmount();
      host.remove();
    });
  }

  it('requires review when React changes its script creation paths', () => {
    expect(() => disableReactScripts('module.exports = {};')).toThrow('needs review');
    const require = createRequire(import.meta.url);
    const directory = dirname(require.resolve('react-dom/package.json'));
    for (const mode of ['production', 'development']) {
      expect(() => disableReactScripts(readFileSync(join(directory, `cjs/react-dom-client.${mode}.js`), 'utf8'))).not.toThrow();
    }
  });
});
