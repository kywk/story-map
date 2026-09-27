import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => {
  class Plugin {
    cleanups: Array<() => void> = [];
    register(cleanup: () => void) { this.cleanups.push(cleanup); }
  }
  class TFile { constructor(public path: string) {} }
  class WorkspaceLeaf {
    async setViewState(_state: unknown, _eState?: unknown): Promise<void> {}
  }
  return { Plugin, TFile, WorkspaceLeaf };
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
