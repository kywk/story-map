import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const obsidianStub = fileURLToPath(new URL('./test/obsidian-stub.ts', import.meta.url));

export default defineConfig({
  resolve: {
    // Exact match only, so no future `obsidian/...` subpath is captured by it.
    alias: [{ find: /^obsidian$/, replacement: obsidianStub }],
  },
});
