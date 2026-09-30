/**
 * The single note-link decision, shared by the two surfaces that render one.
 *
 * `NoteLink` in `StoryMap.tsx` renders a React anchor; `<GeoMap />` builds the same
 * anchor imperatively for a Leaflet tooltip, because a Leaflet layer cannot host a
 * React tree. Both read the class list, the `href`, and the presence of `data-href`
 * from {@link noteLinkAttributes} and wire the callbacks through
 * {@link attachNoteLinkHandlers}, so the two shapes can never drift:
 *
 * - no host callbacks -> a normal `<a href>` (a Docusaurus published route);
 * - host callbacks -> the click default is prevented, `data-href` is emitted for the
 *   host's hover-link registration, and the callbacks receive the native event (the
 *   Obsidian Page preview on hover, open in new tab on click).
 */
export interface NoteLinkHandler {
  onNoteClick?: ((notePath: string, event: MouseEvent) => void) | undefined;
  onNoteHover?: ((notePath: string, targetEl: HTMLElement, event: MouseEvent) => void) | undefined;
}

/** The host half of a note link: the two callbacks plus an extra visual class. */
export interface NoteLinkShape extends NoteLinkHandler {
  className?: string | undefined;
  noteLinkClassName?: string | undefined;
}

export interface NoteLinkAttributes {
  className: string;
  href: string;
  /** Only present for the callback-driven variant Obsidian registers as a hover source. */
  dataHref: string | undefined;
  /** True when a host callback owns navigation, so the click default must be prevented. */
  callbackDriven: boolean;
}

export function noteLinkAttributes(notePath: string, shape: NoteLinkShape): NoteLinkAttributes {
  const callbackDriven = shape.onNoteClick !== undefined || shape.onNoteHover !== undefined;
  return {
    className: ['story-map__note-link', shape.className, shape.noteLinkClassName].filter(Boolean).join(' '),
    href: notePath,
    dataHref: callbackDriven ? notePath : undefined,
    callbackDriven,
  };
}

/**
 * Attach the callback-driven behaviors to an anchor built from
 * {@link noteLinkAttributes}. `read` is a getter rather than a snapshot so a host
 * that swaps its callbacks does not have to rebuild every marker to pick them up.
 * A shape without callbacks leaves the anchor as a plain browser link.
 */
export function attachNoteLinkHandlers(
  element: HTMLElement,
  notePath: string,
  read: () => NoteLinkShape,
): void {
  element.addEventListener('click', (event) => {
    const shape = read();
    if (shape.onNoteClick === undefined && shape.onNoteHover === undefined) return;
    event.preventDefault();
    shape.onNoteClick?.(notePath, event);
  });
  element.addEventListener('mouseover', (event) => {
    read().onNoteHover?.(notePath, element, event);
  });
}
