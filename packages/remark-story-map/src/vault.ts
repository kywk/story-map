import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import {
  DEFAULT_DATE_FIELD,
  effectiveNoteDisplay,
  isPathInFolder,
  locationOnlySlide,
  matchesTagFilter,
  mergeResolvedSlide,
  parseWikiLinkRef,
  slideFromNoteFrontmatter,
  sortNoteDates,
  stripFrontmatter,
  toStoryMapConfig,
  toTimestamp,
  type StoryMapConfig,
  type StoryMapLayoutMode,
  type StoryMapSourceConfig,
  type StoryMedia,
  type StoryNoteDisplay,
  type StorySlide,
} from '@story-map/story-map-core';

export interface VaultResolveOptions {
  vaultRoot: string;
  assetBase?: string;
  resolveNoteHref?: (vaultRelativePath: string) => string | undefined;
}

const EXCLUDED_DIRECTORIES = new Set(['node_modules', 'build', 'dist', 'coverage']);

interface IndexedNote {
  absolutePath: string;
  relativePath: string;
  frontmatter: Record<string, unknown>;
}

export class VaultIndex {
  private readonly byBasename = new Map<string, string[]>();
  private readonly byRelativePath = new Map<string, string>();
  private readonly notes: IndexedNote[] = [];

  constructor(private readonly options: VaultResolveOptions) {
    this.scan(options.vaultRoot);
  }

  resolveSource(source: StoryMapSourceConfig, sourcePath?: string): StoryMapConfig {
    const noteDisplay = effectiveNoteDisplay(source.layout.mode, source.noteDisplay);
    const explicitSlides = source.slides ?? [];
    const slides = explicitSlides.length > 0
      ? this.resolveExplicitSlides(
          explicitSlides,
          sourcePath,
          noteDisplay,
          source.layout.mode,
          source.dateField,
        )
      : source.noteFolder
        ? this.resolveFolder(
            source.noteFolder,
            source.dateField,
            source.order,
            noteDisplay,
            source.layout.mode,
            source.includeTags,
            source.excludeTags,
          )
        : [];

    return toStoryMapConfig(source, slides);
  }

  /**
   * Re-resolves `note:` references on an already normalized config. `dateField`
   * is not part of `StoryMapConfig`, so it defaults to the built-in
   * `date-created`; pass the document's own value when it differs. Slides that
   * already carry a `date` keep it, because an authored value always wins.
   */
  resolveStory(
    story: StoryMapConfig,
    sourcePath?: string,
    dateField: string = DEFAULT_DATE_FIELD,
  ): StoryMapConfig {
    return {
      ...story,
      slides: this.resolveExplicitSlides(
        story.slides,
        sourcePath,
        'link',
        story.layout.mode,
        dateField,
      ),
    };
  }

  private resolveExplicitSlides(
    slides: StorySlide[],
    sourcePath: string | undefined,
    noteDisplay: StoryNoteDisplay,
    layoutMode: StoryMapLayoutMode,
    dateField: string,
  ): StorySlide[] {
    return slides.map((slide) => this.resolveSlide(slide, sourcePath, noteDisplay, layoutMode, dateField));
  }

  private resolveFolder(
    noteFolder: string,
    dateField: string,
    order: StoryMapSourceConfig['order'],
    noteDisplay: StoryNoteDisplay,
    layoutMode: StoryMapLayoutMode,
    includeTags?: readonly string[],
    excludeTags?: readonly string[],
  ): StorySlide[] {
    const entries = this.notes
      .filter((note) => isPathInFolder(note.relativePath, noteFolder))
      .map((note) => ({
        path: note.relativePath,
        date: toTimestamp(note.frontmatter[dateField]),
        note,
      }))
      .filter((entry) => entry.note.frontmatter['story-map-note'] === true)
      .filter((entry) => matchesTagFilter(entry.note.frontmatter, includeTags, excludeTags));

    return sortNoteDates(entries, order).map((entry) =>
      this.slideForNote(entry.note, noteDisplay, layoutMode, entry.date),
    );
  }

  private slideForNote(
    note: IndexedNote,
    noteDisplay: StoryNoteDisplay,
    layoutMode: StoryMapLayoutMode,
    date: number | null,
  ): StorySlide {
    const frontmatterFields = slideFromNoteFrontmatter(note.frontmatter, path.basename(note.relativePath));
    const slide: StorySlide = noteDisplay === 'full' && layoutMode !== 'timeline'
      ? locationOnlySlide(frontmatterFields)
      : { ...frontmatterFields, ...(date !== null ? { date } : {}) };
    const media = slide.media
      ? this.resolveMedia(slide.media, path.posix.dirname(note.relativePath))
      : undefined;
    const withMedia = media ? { ...slide, media } : slide;
    return this.applyNoteDisplay(withMedia, note, noteDisplay);
  }

  private resolveSlide(
    slide: StorySlide,
    sourcePath: string | undefined,
    noteDisplay: StoryNoteDisplay,
    layoutMode: StoryMapLayoutMode,
    dateField: string,
  ): StorySlide {
    let resolved: Partial<StorySlide> = {};
    let note: IndexedNote | undefined;

    if (slide.note) {
      note = this.findIndexed(parseWikiLinkRef(slide.note));
      if (note) {
        const frontmatterFields = slideFromNoteFrontmatter(note.frontmatter, path.basename(note.relativePath));
        const date = toTimestamp(note.frontmatter[dateField]);
        resolved = noteDisplay === 'full' && layoutMode !== 'timeline'
          ? locationOnlySlide(frontmatterFields)
          : { ...frontmatterFields, ...(date !== null ? { date } : {}) };
      }
    }

    const merged = mergeResolvedSlide(slide, resolved);
    const mediaBase = !slide.media && note
      ? path.posix.dirname(note.relativePath)
      : this.vaultRelativeDirectory(sourcePath);
    const media = merged.media ? this.resolveMedia(merged.media, mediaBase) : undefined;
    const withMedia = { ...merged, ...(media ? { media } : {}) };
    return note ? this.applyNoteDisplay(withMedia, note, noteDisplay) : withMedia;
  }

  private applyNoteDisplay(
    slide: StorySlide,
    note: IndexedNote,
    noteDisplay: StoryNoteDisplay,
  ): StorySlide {
    if (noteDisplay === 'basic') return slide;

    if (noteDisplay === 'link') {
      const href = this.options.resolveNoteHref?.(note.relativePath);
      return href ? { ...slide, notePath: href } : slide;
    }

    const body = stripFrontmatter(readFileSync(note.absolutePath, 'utf8')).trim();
    const href = this.options.resolveNoteHref?.(note.relativePath);
    return { ...slide, ...(href ? { notePath: href } : {}), ...(body ? { text: body } : {}) };
  }

  private resolveMedia(media: StoryMedia, baseDirectory?: string): StoryMedia {
    if (/^(https?:|data:|blob:)/i.test(media.src) || !this.options.assetBase) return media;

    let source = parseWikiLinkRef(media.src).replace(/\\/g, '/');
    if (source.startsWith('./') || source.startsWith('../')) {
      if (!baseDirectory) return media;
      source = path.posix.normalize(path.posix.join(baseDirectory, source));
      if (source.startsWith('..')) return media;
    }

    const url = `${this.options.assetBase.replace(/\/$/, '')}/${source.replace(/^\/+/, '')}`;
    return { ...media, src: url };
  }

  private vaultRelativeDirectory(sourcePath?: string): string | undefined {
    if (!sourcePath) return undefined;

    const relative = path.relative(this.options.vaultRoot, sourcePath).replace(/\\/g, '/');
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return undefined;
    return path.posix.dirname(relative);
  }

  private findIndexed(ref: string): IndexedNote | undefined {
    const normalized = ref.replace(/\\/g, '/').replace(/\.md$/i, '');
    const exact = this.byRelativePath.get(normalized.toLowerCase());
    if (exact) return this.notes.find((note) => note.absolutePath === exact);

    const basename = path.posix.basename(normalized).toLowerCase();
    const matches = this.byBasename.get(basename) ?? [];
    if (matches.length > 1) {
      throw new Error(`Ambiguous WikiLink '${ref}'. Use a Vault-relative path.`);
    }
    const match = matches[0];
    return match ? this.notes.find((note) => note.absolutePath === match) : undefined;
  }

  private scan(directory: string): void {
    if (!existsSync(directory)) return;

    for (const entry of readdirSync(directory)) {
      if (entry.startsWith('.') || EXCLUDED_DIRECTORIES.has(entry)) continue;
      const full = path.join(directory, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        this.scan(full);
        continue;
      }
      if (!entry.toLowerCase().endsWith('.md')) continue;

      const relative = path
        .relative(this.options.vaultRoot, full)
        .replace(/\\/g, '/')
        .replace(/\.md$/i, '');
      const basename = path.basename(relative).toLowerCase();
      const current = this.byBasename.get(basename) ?? [];
      current.push(full);
      this.byBasename.set(basename, current);
      this.byRelativePath.set(relative.toLowerCase(), full);

      const frontmatter = (matter(readFileSync(full, 'utf8')).data ?? {}) as Record<string, unknown>;
      this.notes.push({ absolutePath: full, relativePath: relative, frontmatter });
    }
  }
}
