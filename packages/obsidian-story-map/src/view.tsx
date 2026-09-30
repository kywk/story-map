import { TextFileView, type Menu, type TFile, type WorkspaceLeaf } from 'obsidian';
import { createRoot, type Root } from 'react-dom/client';
import {
  extractFencedBlock,
  parseStoryMapSourceYaml,
  type StoryMapSourceDefaults,
} from '@story-map/story-map-core';
import { StoryMap } from '@story-map/react-story-map';
import { STORY_MAP_FENCE, VIEW_TYPE_STORY_MAP } from './constants.js';
import { createNoteLinkHandlers, type NoteLinkHandlers } from './note-links.js';
import { resolveObsidianStory } from './resolver.js';

export interface StoryMapViewHost {
  openAsMarkdown(file: TFile, leaf: WorkspaceLeaf): void;
  getSourceDefaults(): StoryMapSourceDefaults;
  /** Page preview on hover is a shared Obsidian behavior, not a per-view one. */
  isNotePreviewEnabled(): boolean;
}

export class StoryMapView extends TextFileView {
  private root: Root | null = null;
  private hostEl: HTMLElement | null = null;
  private renderToken = 0;

  constructor(leaf: WorkspaceLeaf, private readonly host: StoryMapViewHost) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_STORY_MAP;
  }

  getDisplayText(): string {
    return this.file?.basename ?? 'Geo Story Map';
  }

  getIcon(): string {
    return 'map';
  }

  onPaneMenu(menu: Menu, source: string): void {
    const file = this.file;
    if (source === 'more-options' && file) {
      menu.addItem((item) =>
        item
          .setTitle('Open as Markdown')
          .setIcon('file-text')
          .setSection('pane')
          .onClick(() => this.host.openAsMarkdown(file, this.leaf)),
      );
    }
    super.onPaneMenu(menu, source);
  }

  getViewData(): string {
    return this.data;
  }

  setViewData(data: string, clear: boolean): void {
    this.data = data;
    if (clear) this.clear();
    void this.render(data);
  }

  refresh(): void {
    void this.render(this.data);
  }

  clear(): void {
    this.renderToken += 1;
    this.unmountReact();
    this.contentEl.empty();
    this.contentEl.removeClass('story-map-view-content');
    this.hostEl = null;
  }

  onunload(): void {
    this.clear();
  }

  private unmountReact(): void {
    if (this.root) {
      this.root.unmount();
      this.root = null;
    }
  }

  private ensureHost(): HTMLElement {
    if (!this.hostEl || !this.contentEl.contains(this.hostEl)) {
      this.contentEl.empty();
      this.contentEl.addClass('story-map-view-content');

      const host = this.contentEl.createDiv({ cls: 'story-map-view' });
      this.hostEl = host;
    }
    return this.hostEl;
  }

  private async render(source: string): Promise<void> {
    const token = ++this.renderToken;
    this.unmountReact();

    const host = this.ensureHost();
    host.empty();
    host.removeClass('story-map-host--error');

    try {
      const block = extractFencedBlock(source, STORY_MAP_FENCE);
      if (block === null) {
        throw new Error(
          'No `story-map` fenced block found. Add a fenced block containing the StoryMap configuration.',
        );
      }

      const parsed = parseStoryMapSourceYaml(block, this.host.getSourceDefaults());
      const story = await resolveObsidianStory(this.app, parsed, this.file?.path ?? '');
      if (token !== this.renderToken) return;

      const { onNoteClick, onNoteHover } = this.noteLinks();
      this.root = createRoot(host);
      this.root.render(
        <StoryMap
          story={{ ...story, height: '100%' }}
          noteLinkClassName="internal-link"
          onNoteClick={onNoteClick}
          // `exactOptionalPropertyTypes`: a disabled preview omits the callback
          // instead of passing `undefined`, so the renderer keeps a plain link.
          {...(onNoteHover ? { onNoteHover } : {})}
        />,
      );
    } catch (error) {
      if (token !== this.renderToken) return;
      host.addClass('story-map-host--error');
      host.setText(formatStoryMapError(error));
    }
  }

  /**
   * The same note-link pair the inline `leaflet` block uses: open in a new tab on
   * click, and the registered page preview on hover. Built per render so a
   * settings change to the preview is picked up without extra bookkeeping.
   */
  private noteLinks(): NoteLinkHandlers {
    return createNoteLinkHandlers(this.app, {
      sourcePath: this.file?.path ?? '',
      hoverParent: this.leaf,
      notePreview: this.host.isNotePreviewEnabled(),
    });
  }
}

function formatStoryMapError(error: unknown): string {
  if (error && typeof error === 'object' && 'issues' in error) {
    const issues = (error as { issues: Array<{ path: Array<string | number>; message: string }> })
      .issues;
    if (issues.length > 0) {
      const details = issues
        .map((issue) => `- ${issue.path.join('.') || 'configuration'}: ${issue.message}`)
        .join('\n');
      return `StoryMap configuration error:\n${details}`;
    }
  }

  if (error instanceof Error) return `StoryMap error: ${error.message}`;
  return 'StoryMap error: unknown error';
}
