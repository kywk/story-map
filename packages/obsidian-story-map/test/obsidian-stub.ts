/**
 * The `obsidian` package publishes type definitions and no runtime entry, so a
 * bundler cannot resolve a bare `obsidian` import. Every test that touches a
 * module importing it replaces the module with `vi.mock('obsidian', ...)`; this
 * alias only gives the resolver something to point at so the import can be
 * transformed. Nothing ever executes it: reaching a real export here means a
 * test forgot its mock.
 */
export {};
