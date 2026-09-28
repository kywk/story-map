import type { App, TFile } from 'obsidian';
import {
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
  type StoryMapSourceConfig,
  type StoryMedia,
  type StoryNoteDisplay,
  type StorySlide,
} from '@story-map/story-map-core';

export async function resolveObsidianStory(
  app: App,
  source: StoryMapSourceConfig,
  sourcePath: string,
): Promise<StoryMapConfig> {
  const noteDisplay = effectiveNoteDisplay(source.layout.mode, source.noteDisplay);
  const explicitSlides = source.slides ?? [];
  const slides = explicitSlides.length > 0
    ? await resolveExplicitSlides(app, explicitSlides, sourcePath, noteDisplay)
    : source.noteFolder
      ? await resolveFolderSlides(
          app,
          source.noteFolder,
          source.dateField,
          source.order,
          noteDisplay,
          source.includeTags,
          source.excludeTags,
        )
      : [];

  return toStoryMapConfig(source, slides);
}

async function resolveExplicitSlides(
  app: App,
  slides: StorySlide[],
  sourcePath: string,
  noteDisplay: StoryNoteDisplay,
): Promise<StorySlide[]> {
  return Promise.all(slides.map((slide) => resolveSlide(app, slide, sourcePath, noteDisplay)));
}

async function resolveFolderSlides(
  app: App,
  noteFolder: string,
  dateField: string,
  order: StoryMapSourceConfig['order'],
  noteDisplay: StoryNoteDisplay,
  includeTags?: readonly string[],
  excludeTags?: readonly string[],
): Promise<StorySlide[]> {
  const entries = app.vault
    .getMarkdownFiles()
    .filter((file) => isPathInFolder(file.path, noteFolder))
    .map((file) => {
      const frontmatter = readFrontmatter(app, file);
      return {
        path: file.path,
        date: toTimestamp(frontmatter[dateField]),
        file,
        frontmatter,
      };
    })
    .filter((entry) => entry.frontmatter['story-map-note'] === true)
    .filter((entry) => matchesTagFilter(entry.frontmatter, includeTags, excludeTags));

  return Promise.all(
    sortNoteDates(entries, order).map((entry) =>
      resolveDiscoveredNote(app, entry.file, entry.frontmatter, noteDisplay),
    ),
  );
}

async function resolveDiscoveredNote(
  app: App,
  file: TFile,
  frontmatter: Record<string, unknown>,
  noteDisplay: StoryNoteDisplay,
): Promise<StorySlide> {
  const frontmatterFields = slideFromNoteFrontmatter(frontmatter, file.basename);
  const slide: StorySlide = noteDisplay === 'full'
    ? locationOnlySlide(frontmatterFields)
    : { ...frontmatterFields };
  const media = slide.media ? await resolveMedia(app, slide.media, file.path) : undefined;
  const withMedia = media ? { ...slide, media } : slide;
  return applyNoteDisplay(app, withMedia, file, noteDisplay);
}

async function resolveSlide(
  app: App,
  slide: StorySlide,
  sourcePath: string,
  noteDisplay: StoryNoteDisplay,
): Promise<StorySlide> {
  let resolved: Partial<StorySlide> = {};
  let noteFile: TFile | null = null;

  if (slide.note) {
    noteFile = resolveWikiFile(app, slide.note, sourcePath);
    if (noteFile) {
      const frontmatterFields = slideFromNoteFrontmatter(readFrontmatter(app, noteFile), noteFile.basename);
      resolved = noteDisplay === 'full' ? locationOnlySlide(frontmatterFields) : frontmatterFields;
    }
  }

  const merged = mergeResolvedSlide(slide, resolved);
  const mediaSource = slide.media ? sourcePath : (noteFile?.path ?? sourcePath);
  const media = merged.media ? await resolveMedia(app, merged.media, mediaSource) : undefined;
  const withMedia = { ...merged, ...(media ? { media } : {}) };
  return noteFile ? applyNoteDisplay(app, withMedia, noteFile, noteDisplay) : withMedia;
}

async function applyNoteDisplay(
  app: App,
  slide: StorySlide,
  file: TFile,
  noteDisplay: StoryNoteDisplay,
): Promise<StorySlide> {
  if (noteDisplay === 'basic') return slide;
  if (noteDisplay === 'link') return { ...slide, notePath: file.path };

  const body = stripFrontmatter(await app.vault.cachedRead(file)).trim();
  return { ...slide, notePath: file.path, ...(body ? { text: body } : {}) };
}

async function resolveMedia(app: App, media: StoryMedia, sourcePath: string): Promise<StoryMedia> {
  if (/^(https?:|data:|app:|blob:)/i.test(media.src)) return media;

  const clean = parseWikiLinkRef(media.src);
  const file = app.metadataCache.getFirstLinkpathDest(clean, sourcePath);
  if (!file) return media;

  return { ...media, src: app.vault.getResourcePath(file) };
}

function resolveWikiFile(app: App, link: string, sourcePath: string): TFile | null {
  return app.metadataCache.getFirstLinkpathDest(parseWikiLinkRef(link), sourcePath);
}

function readFrontmatter(app: App, file: TFile): Record<string, unknown> {
  const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
  return frontmatter ?? {};
}
