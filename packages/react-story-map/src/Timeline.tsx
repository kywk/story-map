import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { RefCallback } from 'react';
import type { StoryMapConfig, StorySlide } from '@story-map/story-map-core';
import { NoteLink } from './StoryMap.js';
import type { StoryMapProps } from './StoryMap.js';

export interface StoryTimelineProps {
  story: StoryMapConfig;
  activeIndex: number;
  onGo: (index: number) => void;
  onNoteClick?: StoryMapProps['onNoteClick'] | undefined;
  onNoteHover?: StoryMapProps['onNoteHover'] | undefined;
  noteLinkClassName?: string | undefined;
}

const TIMELINE_DATE_FORMAT = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

/**
 * Fixed `en-US`/UTC formatting, with no locale or formatting knob: server markup and
 * browser hydration then agree, and a date authored at UTC midnight never renders as
 * the previous day for authors west of Greenwich.
 */
export function formatTimelineDate(value: number): string {
  return TIMELINE_DATE_FORMAT.format(value);
}

/**
 * The `timeline` presentation: the map stays full-bleed and the story becomes a
 * scrollable column, exactly like `full`. The list itself is the navigation, so
 * `StoryNav` is not rendered; a row click, the arrow keys, and the existing
 * `activeIndex` effect (map `flyTo` plus marker emphasis) are the only controls.
 *
 * The column reuses `layout.full.side` and `layout.full.contentRatio`; there is no
 * `layout.timeline` block.
 */
export function StoryTimeline({
  story,
  activeIndex,
  onGo,
  onNoteClick,
  onNoteHover,
  noteLinkClassName,
}: StoryTimelineProps) {
  const rowRefs = useRef<Array<HTMLLIElement | null>>([]);

  // Keep the active row visible without measuring or animating it.
  useEffect(() => {
    rowRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  return (
    <div className="story-map__presentation">
      <div className="story-map__panel story-map__timeline-column">
        {story.title && (
          <div className="story-map__story-title story-map__timeline-header">{story.title}</div>
        )}
        <ol className="story-map__timeline">
          {story.slides.map((slide, index) => (
            <TimelineRow
              key={slide.id ?? index}
              slide={slide}
              index={index}
              active={index === activeIndex}
              onSelect={() => onGo(index)}
              rowRef={(element) => {
                rowRefs.current[index] = element;
              }}
              onNoteClick={onNoteClick}
              onNoteHover={onNoteHover}
              noteLinkClassName={noteLinkClassName}
            />
          ))}
        </ol>
      </div>
    </div>
  );
}

interface TimelineRowProps {
  slide: StorySlide;
  index: number;
  active: boolean;
  onSelect: () => void;
  rowRef: RefCallback<HTMLLIElement>;
  onNoteClick?: StoryMapProps['onNoteClick'] | undefined;
  onNoteHover?: StoryMapProps['onNoteHover'] | undefined;
  noteLinkClassName?: string | undefined;
}

function TimelineRow({
  slide,
  index,
  active,
  onSelect,
  rowRef,
  onNoteClick,
  onNoteHover,
  noteLinkClassName,
}: TimelineRowProps) {
  const dateMs = typeof slide.date === 'number' && Number.isFinite(slide.date) ? slide.date : undefined;
  const dateText = dateMs === undefined ? undefined : formatTimelineDate(dateMs);
  const label = slide.title ?? dateText ?? `Slide ${index + 1}`;

  // A missing date renders nothing; only still images become a thumbnail, because a
  // video or iframe has no meaningful 64px representation in a list row.
  const dateNode =
    dateMs === undefined || dateText === undefined ? null : (
      <time className="story-map__timeline-date" dateTime={new Date(dateMs).toISOString()}>
        {dateText}
      </time>
    );

  return (
    <li ref={rowRef} className="story-map__timeline-item" data-active={active ? '' : undefined}>
      {dateNode}
      {slide.media?.type === 'image' && (
        <figure className="story-map__timeline-media">
          <img src={slide.media.src} alt={slide.media.alt ?? ''} loading="lazy" />
        </figure>
      )}
      {/* The heading holds the row-wide select button, so every entry keeps a real
          heading and stays keyboard reachable. Its `::after` stretches over the row;
          the note link below is a sibling raised above that stretched button rather
          than a nested interactive element. */}
      <h3 className="story-map__timeline-title">
        <button
          type="button"
          className="story-map__timeline-select"
          aria-current={active ? 'true' : undefined}
          aria-label={slide.title ? undefined : label}
          onClick={onSelect}
        >
          {slide.title}
        </button>
      </h3>
      {slide.text && (
        <div className="story-map__timeline-text">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{slide.text}</ReactMarkdown>
        </div>
      )}
      {slide.notePath !== undefined && (
        <NoteLink
          notePath={slide.notePath}
          className="story-map__timeline-note"
          aria-label={`Open note: ${label}`}
          onNoteClick={onNoteClick}
          onNoteHover={onNoteHover}
          noteLinkClassName={noteLinkClassName}
        >
          <span aria-hidden="true">↗</span>
        </NoteLink>
      )}
    </li>
  );
}
