import type { App, TFile, WorkspaceLeaf } from 'obsidian';
import { HOVER_LINK_SOURCE, MARKDOWN_VIEW } from './constants.js';

/**
 * The Obsidian half of a note link, shared by the full-leaf StoryMap view and the
 * inline `leaflet` block so both surfaces behave identically: the page preview on
 * hover and the open-in-new-tab on click.
 *
 * The plugin registers `HOVER_LINK_SOURCE` once, at load. These callbacks are the
 * only way a rendered link reaches that registration, so a host that wires them
 * never has to build a second hover source.
 */
export interface NoteLinkHandlers {
  onNoteClick: (notePath: string, event: MouseEvent) => void;
  /** Absent when the page preview is switched off; the link still opens. */
  onNoteHover?: ((notePath: string, targetEl: HTMLElement, event: MouseEvent) => void) | undefined;
}

export interface NoteLinkOptions {
  /** The document the link came from; Obsidian needs it to resolve the target. */
  sourcePath: string;
  /** The leaf the `hover-link` preview is anchored to. */
  hoverParent: WorkspaceLeaf | null;
  /** Page preview on hover. Off means the link still opens, without a preview. */
  notePreview: boolean;
}

export function createNoteLinkHandlers(app: App, options: NoteLinkOptions): NoteLinkHandlers {
  const { sourcePath, hoverParent, notePreview } = options;

  return {
    onNoteClick: (notePath: string) => {
      void app.workspace.openLinkText(notePath, sourcePath, true);
    },
    // Obsidian's `hover-link` event needs a parent leaf to anchor the preview. The
    // inline block has no leaf of its own, so the caller passes the Markdown leaf
    // that owns the block; without one, the link simply opens without a preview.
    onNoteHover:
      notePreview && hoverParent
        ? (notePath, targetEl, event) => {
            app.workspace.trigger('hover-link', {
              event,
              source: HOVER_LINK_SOURCE,
              hoverParent,
              targetEl,
              linktext: notePath,
              sourcePath,
            });
          }
        : undefined,
  };
}

/**
 * The Markdown leaf currently rendering `sourcePath`, used as the preview anchor
 * for an inline block. Falls back to the active leaf so a preview still works when
 * the block is rendered into a pane Obsidian has not reported yet.
 */
export function findMarkdownLeaf(app: App, sourcePath: string): WorkspaceLeaf | null {
  for (const leaf of app.workspace.getLeavesOfType(MARKDOWN_VIEW)) {
    const file = (leaf.view as { file?: TFile | null }).file;
    if (file?.path === sourcePath) return leaf;
  }
  return app.workspace.activeLeaf ?? null;
}
