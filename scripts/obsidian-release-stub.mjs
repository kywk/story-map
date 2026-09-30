// Every Obsidian value the plugin bundle imports at runtime.
//
// `check-obsidian-release.mjs` builds its stub `obsidian` module from this list,
// and `obsidian-release-stub.test.mjs` asserts the list still covers the plugin's
// actual imports. Keeping one list means a newly imported Obsidian symbol is
// caught by `pnpm test` instead of failing the release check with an opaque
// "Class extends value undefined" from deep inside the bundle.
//
// Classes are stubbed with `class {}` because the bundle extends them at module
// scope; the two functions are stubbed because i18n calls one of them while the
// module initializes.
export const OBSIDIAN_STUB_CLASSES = [
  'Plugin',
  'PluginSettingTab',
  'TextFileView',
  'MarkdownRenderChild',
  'TFile',
  'WorkspaceLeaf',
  'Setting',
  'Modal',
  'Notice',
];

export const OBSIDIAN_STUB_FUNCTIONS = {
  getLanguage: () => 'en',
  normalizePath: (value) => String(value).replace(/\\/g, '/'),
};

/** The stub module the bundled plugin is evaluated against. */
export function createObsidianStub() {
  const stub = Object.fromEntries(OBSIDIAN_STUB_CLASSES.map((name) => [name, class {}]));
  return Object.assign(stub, OBSIDIAN_STUB_FUNCTIONS);
}
