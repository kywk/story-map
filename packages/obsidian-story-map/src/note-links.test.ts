import { describe, expect, it } from 'vitest';
import type { App, WorkspaceLeaf } from 'obsidian';
import { createNoteLinkHandlers, findMarkdownLeaf } from './note-links.js';

/** A stand-in for the native event; this suite runs without a DOM. */
const event = { type: 'mouseover' } as unknown as MouseEvent;

function leaf(path: string | null): WorkspaceLeaf {
  return { view: { file: path === null ? null : { path } } } as unknown as WorkspaceLeaf;
}

function makeApp(leaves: WorkspaceLeaf[], activeLeaf: WorkspaceLeaf | null = null) {
  const triggered: Array<[string, Record<string, unknown>]> = [];
  const opened: Array<[string, string, boolean]> = [];
  const app = {
    triggered,
    opened,
    workspace: {
      getLeavesOfType: () => leaves,
      activeLeaf,
      trigger: (name: string, payload: Record<string, unknown>) => triggered.push([name, payload]),
      openLinkText: (link: string, source: string, newLeaf: boolean) => opened.push([link, source, newLeaf]),
    },
  };
  return app as unknown as App & { triggered: typeof triggered; opened: typeof opened };
}

describe('createNoteLinkHandlers', () => {
  it('opens the note in a new tab from its own document', () => {
    const app = makeApp([leaf('Index.md')]);
    const handlers = createNoteLinkHandlers(app, { sourcePath: 'Index.md', hoverParent: null, notePreview: true });

    handlers.onNoteClick('Trips/A.md', event);
    expect(app.opened).toEqual([['Trips/A.md', 'Index.md', true]]);
  });

  it('triggers the plugin hover-link source with the owning leaf as the parent', () => {
    const app = makeApp([leaf('Index.md')]);
    const parent = leaf('Index.md');
    const handlers = createNoteLinkHandlers(app, { sourcePath: 'Index.md', hoverParent: parent, notePreview: true });
    const target = {} as HTMLElement;

    handlers.onNoteHover?.('Trips/A.md', target, event);

    const [name, payload] = app.triggered[0]!;
    expect(name).toBe('hover-link');
    expect(payload).toMatchObject({
      source: 'geo-story-map',
      hoverParent: parent,
      targetEl: target,
      linktext: 'Trips/A.md',
      sourcePath: 'Index.md',
      event,
    });
  });

  it('omits the preview callback when the preview is off or no leaf anchors it', () => {
    const app = makeApp([leaf('Index.md')]);
    expect(
      createNoteLinkHandlers(app, { sourcePath: 'Index.md', hoverParent: leaf('Index.md'), notePreview: false })
        .onNoteHover,
    ).toBeUndefined();
    expect(
      createNoteLinkHandlers(app, { sourcePath: 'Index.md', hoverParent: null, notePreview: true }).onNoteHover,
    ).toBeUndefined();
  });
});

describe('findMarkdownLeaf', () => {
  it('prefers the leaf rendering the block document', () => {
    const other = leaf('Other.md');
    const owner = leaf('Index.md');
    expect(findMarkdownLeaf(makeApp([other, owner]), 'Index.md')).toBe(owner);
  });

  it('falls back to the active leaf for a pane Obsidian has not reported yet', () => {
    const active = leaf('Something.md');
    expect(findMarkdownLeaf(makeApp([leaf('Other.md')], active), 'Index.md')).toBe(active);
  });

  it('returns null when no leaf can anchor a preview', () => {
    expect(findMarkdownLeaf(makeApp([leaf('Other.md')]), 'Index.md')).toBeNull();
    expect(findMarkdownLeaf(makeApp([leaf(null)]), 'Index.md')).toBeNull();
  });
});
