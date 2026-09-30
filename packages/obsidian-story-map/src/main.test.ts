import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => {
  class Plugin {
    cleanups: Array<() => void> = [];
    codeBlockProcessors: Array<[string, unknown]> = [];
    commands: Array<{ id: string; name: string }> = [];
    viewTypes: string[] = [];
    settingTabs: unknown[] = [];
    events: Array<() => void> = [];
    data: unknown = null;
    async loadData() { return this.data; }
    async saveData(value: unknown) { this.data = value; }
    register(cleanup: () => void) { this.cleanups.push(cleanup); }
    registerView(type: string) { this.viewTypes.push(type); return class {}; }
    registerHoverLinkSource() {}
    addSettingTab(tab: unknown) { this.settingTabs.push(tab); }
    addCommand(command: { id: string; name: string }) { this.commands.push(command); }
    registerEvent(_ref: unknown) { this.events.push(() => {}); }
    registerMarkdownCodeBlockProcessor(language: string, handler: unknown) {
      this.codeBlockProcessors.push([language, handler]);
    }
  }
  class TFile { constructor(public path = '') {} }
  class WorkspaceLeaf {
    async setViewState(_state: unknown, _eState?: unknown): Promise<void> {}
  }
  class MarkdownRenderChild {
    constructor(public containerEl: unknown) {}
  }
  class Notice { constructor(_message?: unknown, _timeout?: number) {} }
  const getLanguage = () => 'en';
  return { Plugin, TFile, WorkspaceLeaf, MarkdownRenderChild, Notice, getLanguage };
});
vi.mock('./view.js', () => ({ StoryMapView: class {} }));
vi.mock('./settings-tab.js', () => ({ StoryMapSettingTab: class {} }));
vi.mock('./coordinate-lookup.js', () => ({ startCoordinateLookup: vi.fn() }));

import { TFile, WorkspaceLeaf, type ViewState } from 'obsidian';
import StoryMapPlugin from './main.js';
import { VIEW_TYPE_STORY_MAP } from './constants.js';

const original = WorkspaceLeaf.prototype.setViewState;
afterEach(() => { WorkspaceLeaf.prototype.setViewState = original; });

function setup() {
  const forwarding = vi.fn(async (_state: ViewState, _eState?: unknown) => {});
  WorkspaceLeaf.prototype.setViewState = forwarding;
  const plugin = Object.create(StoryMapPlugin.prototype) as StoryMapPlugin;
  const internals = plugin as unknown as {
    loaded: boolean;
    markdownMode: Set<string>;
    persistTimer: number | null;
    cleanups: Array<() => void>;
    patchLeafViewState(): void;
  };
  Object.assign(internals, { loaded: true, markdownMode: new Set(), persistTimer: null, cleanups: [] });
  const story = new TFile();
  story.path = 'story.md';
  Object.assign(plugin, {
    app: {
      vault: { getAbstractFileByPath: (path: string) => path === story.path ? story : null },
      metadataCache: { getFileCache: () => ({ frontmatter: { 'story-map': true } }) },
      workspace: { detachLeavesOfType: vi.fn() },
    },
  });
  internals.patchLeafViewState();
  const leaf = Object.create(WorkspaceLeaf.prototype) as WorkspaceLeaf;
  const unload = () => {
    plugin.onunload();
    internals.cleanups.forEach((cleanup) => cleanup());
  };
  return { plugin, internals, forwarding, leaf, story, unload };
}

describe('scoped Story Map view routing', () => {
  it('passes ordinary Markdown and non-Markdown views through unchanged', async () => {
    const { leaf, forwarding } = setup();
    for (const state of [
      { type: 'markdown', state: { file: 'ordinary.md' } },
      { type: 'canvas', state: { file: 'story.md' } },
    ]) {
      const eState = { focus: true };
      await leaf.setViewState(state, eState);
      expect(forwarding).toHaveBeenLastCalledWith(state, eState);
    }
  });

  it('routes detected stories while preserving state and the leaf receiver', async () => {
    const { leaf, forwarding } = setup();
    const state = { type: 'markdown', state: { file: 'story.md' }, active: true };
    await leaf.setViewState(state);
    expect(forwarding).toHaveBeenCalledWith({ ...state, type: VIEW_TYPE_STORY_MAP }, undefined);
    expect(forwarding.mock.contexts[0]).toBe(leaf);
    expect(state.type).toBe('markdown');
  });

  it('honors the explicit Open as Markdown override', () => {
    const { plugin, leaf, story, forwarding } = setup();
    plugin.openAsMarkdown(story, leaf);
    expect(forwarding).toHaveBeenCalledWith({ type: 'markdown', state: { file: 'story.md' }, active: true }, undefined);
  });

  it('preserves workspace leaves on unload', () => {
    const { plugin, unload } = setup();
    unload();
    expect(plugin.app.workspace.detachLeavesOfType).not.toHaveBeenCalled();
  });

  it('restores its own wrapper on unload', () => {
    const { forwarding, unload } = setup();
    unload();
    expect(WorkspaceLeaf.prototype.setViewState).toBe(forwarding);
  });

  it('preserves a later plugin wrapper and makes the retained Story Map wrapper inert', async () => {
    const { forwarding, leaf, unload } = setup();
    const storyWrapper = WorkspaceLeaf.prototype.setViewState;
    const laterWrapper = vi.fn(function (this: WorkspaceLeaf, state: ViewState, eState?: unknown) {
      return storyWrapper.call(this, state, eState);
    });
    WorkspaceLeaf.prototype.setViewState = laterWrapper;
    unload();
    expect(WorkspaceLeaf.prototype.setViewState).toBe(laterWrapper);
    const state = { type: 'markdown', state: { file: 'story.md' } };
    await leaf.setViewState(state);
    expect(laterWrapper).toHaveBeenCalledWith(state);
    expect(forwarding).toHaveBeenCalledWith(state, undefined);
  });
});

describe('plugin load', () => {
  function loadPlugin(data: unknown = null) {
    const app = {
      vault: { getAbstractFileByPath: () => null, configDir: '.obsidian' },
      metadataCache: { getFileCache: () => ({ frontmatter: {} }) },
      workspace: { on: () => () => {}, getLeavesOfType: () => [], trigger: vi.fn(), openLinkText: vi.fn(), getActiveFile: () => null, activeLeaf: null },
      loadLocalStorage: () => null,
      saveLocalStorage: vi.fn(),
    };
    const plugin = new StoryMapPlugin(app as never, {} as never);
    Object.assign(plugin, { app, data });
    return { plugin, app };
  }

  it('owns the legacy leaflet language and nothing else', async () => {
    const { plugin } = loadPlugin();
    await plugin.onload();

    const internals = plugin as unknown as { codeBlockProcessors: Array<[string, unknown]> };
    // Exactly one language is claimed, so every other fenced block in the vault
    // keeps Obsidian's own renderer.
    expect(internals.codeBlockProcessors.map(([language]) => language)).toEqual(['leaflet']);
    expect(typeof internals.codeBlockProcessors[0]?.[1]).toBe('function');
  });

  it('registers the Story Map view, the hover-link source, and both commands', async () => {
    const { plugin } = loadPlugin();
    await plugin.onload();

    const internals = plugin as unknown as { viewTypes: string[]; settingTabs: unknown[]; commands: Array<{ id: string }> };
    expect(internals.viewTypes).toEqual([VIEW_TYPE_STORY_MAP]);
    expect(internals.settingTabs).toHaveLength(1);
    expect(internals.commands.map((command) => command.id)).toEqual([
      'open-as-story-map',
      'open-as-markdown',
      'find-location-coordinates',
      'import-leaflet-settings',
    ]);
  });

  it('migrates stored settings on load and keeps them per dialect', async () => {
    const { plugin } = loadPlugin({
      version: 2,
      story: { order: 'desc', noteDisplay: 'full' },
      map: { theme: 'vintage', zoom: 7, showPath: true },
      leafletCompatibility: { defaultCenter: [1, 2], diagnostics: true },
    });
    await plugin.onload();

    expect(plugin.getSourceDefaults()).toEqual({
      order: 'desc',
      noteDisplay: 'full',
      map: { theme: 'vintage', zoom: 7, showPath: true },
    });
    // The compatibility center exists for legacy blocks only; it never centers a
    // story-map document.
    expect(plugin.settings.leafletCompatibility.defaultCenter).toEqual([1, 2]);
    expect(plugin.isNotePreviewEnabled()).toBe(true);
  });

  it('migrates flat version 1 defaults on load', async () => {
    const { plugin } = loadPlugin({ mapTheme: 'atlas', mapShowPath: false, dateField: 'visited' });
    await plugin.onload();

    expect(plugin.getSourceDefaults()).toEqual({
      dateField: 'visited',
      map: { theme: 'atlas', showPath: false },
    });
  });

  it('releases the inline block roots on unload', async () => {
    const { plugin } = loadPlugin();
    await plugin.onload();
    const internals = plugin as unknown as { cleanups: Array<() => void> };
    // Agent controller, the inline block controller, and the view-state wrapper.
    expect(internals.cleanups).toHaveLength(3);
    expect(() => {
      for (const cleanup of internals.cleanups) cleanup();
    }).not.toThrow();
  });
});
