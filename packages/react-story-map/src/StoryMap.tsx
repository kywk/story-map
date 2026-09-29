import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { StoryMapConfig, StorySlide } from '@story-map/story-map-core';
import { MapCanvas } from './MapCanvas.js';
import { StoryTimeline } from './Timeline.js';

export interface StoryMapProps {
  story: StoryMapConfig;
  initialSlide?: number;
  className?: string;
  onSlideChange?: (index: number, slide: StorySlide) => void;
  onNoteClick?: (notePath: string, event: MouseEvent) => void;
  onNoteHover?: (notePath: string, targetEl: HTMLElement, event: MouseEvent) => void;
  noteLinkClassName?: string;
}

export function StoryMap({
  story,
  initialSlide,
  className,
  onSlideChange,
  onNoteClick,
  onNoteHover,
  noteLinkClassName,
}: StoryMapProps) {
  const resolvedInitial = initialSlide ?? story.initialSlide ?? 0;
  const [rawActiveIndex, setActiveIndex] = useState(() => clamp(resolvedInitial, 0, story.slides.length - 1));
  const activeIndex = clamp(rawActiveIndex, 0, story.slides.length - 1);
  const activeSlide = story.slides[activeIndex];

  useEffect(() => {
    if (activeSlide) onSlideChange?.(activeIndex, activeSlide);
  }, [activeIndex, activeSlide, onSlideChange]);

  useEffect(() => {
    setActiveIndex((current) => clamp(current, 0, story.slides.length - 1));
  }, [story.slides.length]);

  function goTo(next: number) {
    setActiveIndex(clamp(next, 0, story.slides.length - 1));
  }

  if (!activeSlide) {
    return (
      <section
        className={['story-map', className].filter(Boolean).join(' ')}
        style={{ height: story.height }}
        data-map-theme={story.map.theme}
        data-layout={story.layout.mode}
        aria-label={story.title ?? 'Story map'}
      >
        <div className="story-map__empty">This StoryMap has no slides.</div>
      </section>
    );
  }

  const layout = story.layout;
  const isFull = layout.mode === 'full';
  const isTimeline = layout.mode === 'timeline';
  const panelOpacity = story.panelOpacity;
  const style = {
    height: story.height,
    ...(layout.card.widthRatio === undefined ? {} : { '--story-map-card-width': `${Math.round(layout.card.widthRatio * 10000) / 100}%` }),
    ...(layout.card.heightRatio === undefined ? {} : { '--story-map-card-height': `${Math.round(layout.card.heightRatio * 10000) / 100}%` }),
    '--story-map-content-ratio': `${Math.round(layout.full.contentRatio * 10000) / 100}%`,
    ...(panelOpacity !== undefined ? { '--story-map-panel-opacity': `${panelOpacity}` } : {}),
  } as CSSProperties;

  return (
    <section
      className={['story-map', className].filter(Boolean).join(' ')}
      style={style}
      data-map-theme={story.map.theme}
      data-panel-opacity={panelOpacity}
      data-layout={layout.mode}
      data-card-align={layout.card.align}
      data-full-side={layout.full.side}
      // Timeline has no option block of its own; it reuses `layout.full`, and this
      // attribute keeps the timeline CSS independent of that internal reuse.
      data-timeline-side={isTimeline ? layout.full.side : undefined}
      tabIndex={0}
      aria-label={story.title ?? 'Story map'}
      onKeyDown={(event) => {
        if (event.key === 'ArrowLeft') goTo(activeIndex - 1);
        if (event.key === 'ArrowRight') goTo(activeIndex + 1);
      }}
    >
      <MapCanvas story={story} activeIndex={activeIndex} />
      {isTimeline ? (
        <StoryTimeline
          story={story}
          activeIndex={activeIndex}
          onGo={goTo}
          onNoteClick={onNoteClick}
          onNoteHover={onNoteHover}
          noteLinkClassName={noteLinkClassName}
        />
      ) : (
        <>
          <div className="story-map__presentation">
            <div className="story-map__panel">
            {story.title && <div className="story-map__story-title">{story.title}</div>}
            <SlideTitle
              slide={activeSlide}
              onNoteClick={onNoteClick}
              onNoteHover={onNoteHover}
              noteLinkClassName={noteLinkClassName}
            />
            <StoryMediaView slide={activeSlide} />
            {activeSlide.text && (
              <div className="story-map__text">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{activeSlide.text}</ReactMarkdown>
              </div>
            )}
            {!isFull && (
              <StoryNav activeIndex={activeIndex} total={story.slides.length} compact={false} onGo={goTo} />
            )}
            </div>
          </div>
          {isFull && (
            <StoryNav activeIndex={activeIndex} total={story.slides.length} compact onGo={goTo} />
          )}
        </>
      )}
    </section>
  );
}

function StoryNav({
  activeIndex,
  total,
  compact,
  onGo,
}: {
  activeIndex: number;
  total: number;
  compact: boolean;
  onGo: (index: number) => void;
}) {
  return (
    <nav className="story-map__nav" aria-label="Story navigation">
      <button type="button" disabled={activeIndex === 0} onClick={() => onGo(activeIndex - 1)} aria-label="Previous">
        {compact ? '‹' : 'Previous'}
      </button>
      <span>{activeIndex + 1} / {total}</span>
      <button
        type="button"
        disabled={activeIndex === total - 1}
        onClick={() => onGo(activeIndex + 1)}
        aria-label="Next"
      >
        {compact ? '›' : 'Next'}
      </button>
    </nav>
  );
}

function SlideTitle({
  slide,
  onNoteClick,
  onNoteHover,
  noteLinkClassName,
}: {
  slide: StorySlide;
  onNoteClick?: StoryMapProps['onNoteClick'] | undefined;
  onNoteHover?: StoryMapProps['onNoteHover'] | undefined;
  noteLinkClassName?: string | undefined;
}) {
  if (!slide.title) return null;

  const notePath = slide.notePath;
  if (notePath === undefined) return <h2>{slide.title}</h2>;

  return (
    <h2>
      <NoteLink
        notePath={notePath}
        onNoteClick={onNoteClick}
        onNoteHover={onNoteHover}
        noteLinkClassName={noteLinkClassName}
      >
        {slide.title}
      </NoteLink>
    </h2>
  );
}

export interface NoteLinkProps {
  notePath: string;
  /** Extra visual class for the surface using the link; never replaces the shared base. */
  className?: string | undefined;
  noteLinkClassName?: string | undefined;
  onNoteClick?: StoryMapProps['onNoteClick'] | undefined;
  onNoteHover?: StoryMapProps['onNoteHover'] | undefined;
  'aria-label'?: string | undefined;
  children?: ReactNode;
}

/**
 * The single note-anchor implementation, shared by the panel heading and the
 * timeline note chip so the two surfaces cannot drift apart:
 *
 * - no host callbacks -> a normal `<a href>` (Docusaurus published route);
 * - host callbacks -> the click default is prevented, `data-href` is emitted for
 *   the host's hover-link registration, and the callbacks receive the native event
 *   (Obsidian Page preview on hover, open in new tab on click).
 */
export function NoteLink({
  notePath,
  className,
  noteLinkClassName,
  onNoteClick,
  onNoteHover,
  'aria-label': ariaLabel,
  children,
}: NoteLinkProps) {
  const linkClassName = ['story-map__note-link', className, noteLinkClassName].filter(Boolean).join(' ');

  if (onNoteClick === undefined && onNoteHover === undefined) {
    return (
      <a className={linkClassName} href={notePath} aria-label={ariaLabel}>
        {children}
      </a>
    );
  }

  return (
    <a
      className={linkClassName}
      href={notePath}
      data-href={notePath}
      aria-label={ariaLabel}
      onClick={(event) => {
        event.preventDefault();
        onNoteClick?.(notePath, event.nativeEvent);
      }}
      onMouseOver={(event) => {
        onNoteHover?.(notePath, event.currentTarget, event.nativeEvent);
      }}
    >
      {children}
    </a>
  );
}

function StoryMediaView({ slide }: { slide: StorySlide }) {
  const media = slide.media;
  if (!media) return null;

  if (media.type === 'video') {
    return <video className="story-map__media" src={media.src} controls />;
  }

  if (media.type === 'iframe') {
    return (
      <iframe
        className="story-map__media story-map__iframe"
        src={media.src}
        title={media.alt ?? slide.title ?? 'Story media'}
        loading="lazy"
      />
    );
  }

  return (
    <figure className="story-map__figure">
      <img className="story-map__media" src={media.src} alt={media.alt ?? ''} loading="lazy" />
      {media.caption && <figcaption>{media.caption}</figcaption>}
    </figure>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
