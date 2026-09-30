import { MarkdownRenderChild, Notice, type App, type MarkdownPostProcessorContext } from 'obsidian';
import { createRoot, type Root } from 'react-dom/client';
import { useCallback, useEffect, useRef } from 'react';
import type { LeafletMouseEvent } from 'leaflet';
import {
  LeafletParseError,
  parseLeafletSourceYaml,
  type GeoMapConfig,
  type GeoMapDiagnostic,
  type GeoMarker,
  type MarkerTooltipDisplay,
  type MarkerTypeDefinition,
} from '@story-map/story-map-core';
import { GeoMap, type GeoMapRuntime } from '@story-map/react-story-map';
import { formatLocationLine } from './coordinates.js';
import { t } from './i18n.js';
import { resolveObsidianGeoMap } from './leaflet-resolver.js';
import { createNoteLinkHandlers, findMarkdownLeaf } from './note-links.js';
import { toLeafletSourceDefaults, type StoryMapPluginSettings } from './settings-data.js';

/** The historical fenced language this processor owns. Nothing else is registered. */
export const LEAFLET_FENCE = 'leaflet';

/** How close, in container pixels, a shift-click must be to count as a marker click. */
const SHIFT_CLICK_RADIUS_PX = 16;

export interface LeafletBlockHost {
  app: App;
  getSettings(): StoryMapPluginSettings;
}

interface MountedBlock {
  source: string;
  sourcePath: string;
}

/**
 * Renders legacy `leaflet` fenced blocks inside ordinary Markdown reading view.
 *
 * The processor is independent of the full-leaf StoryMap view in both directions:
 * it uses the block's own `height` instead of the forced `100%`, it never opens a
 * workspace view, and it requires no `story-map: true` frontmatter. Only the
 * `leaflet` language is registered, so every other code block in the vault keeps
 * its normal renderer.
 *
 * Mount lifetime follows the Markdown render rather than a workspace view:
 * a `MarkdownRenderChild` releases the React root when Obsidian discards the
 * block, and a render token makes a late unload from an earlier render harmless,
 * so a re-render, a file switch, or a plugin unload never leaves a React root or
 * a Leaflet instance behind.
 */
export class LeafletBlockController {
  private readonly roots = new Map<HTMLElement, { root: Root; token: number }>();
  private readonly mounted = new Map<HTMLElement, MountedBlock>();
  private token = 0;
  private disposed = false;

  constructor(private readonly host: LeafletBlockHost) {}

  /** The handler passed to `registerMarkdownCodeBlockProcessor('leaflet', ...)`. */
  readonly process = (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext): void => {
    if (this.disposed) return;
    const sourcePath = ctx.sourcePath;
    // One token per render. Obsidian can unload a superseded render child after a
    // newer render already replaced the root, so a release only ever unmounts the
    // render it belongs to.
    const token = ++this.token;
    this.mounted.set(el, { source, sourcePath });
    this.render(el, source, sourcePath, token);
    ctx.addChild(new LeafletBlockChild(el, () => this.release(el, token)));
  };

  /** Re-render every open block, e.g. after a settings change. */
  refresh(): void {
    if (this.disposed) return;
    for (const [el, block] of [...this.mounted]) {
      this.render(el, block.source, block.sourcePath, ++this.token);
    }
  }

  /** Unmount every React root and Leaflet instance this controller created. */
  dispose(): void {
    this.disposed = true;
    for (const el of [...this.roots.keys()]) this.unmount(el);
    this.mounted.clear();
  }

  private render(el: HTMLElement, source: string, sourcePath: string, token: number): void {
    this.unmount(el);
    el.empty();
    el.removeClass('story-map-host--error');
    el.addClass('geo-story-map-block-host');

    try {
      const settings = this.host.getSettings();
      const parsed = parseLeafletSourceYaml(source, toLeafletSourceDefaults(settings));
      const config = resolveObsidianGeoMap(this.host.app, parsed, {
        types: settings.markers.types,
        defaultTypeId: settings.markers.defaultType,
        tooltip: settings.markers.tooltip,
      });
      const links = createNoteLinkHandlers(this.host.app, {
        sourcePath,
        hoverParent: findMarkdownLeaf(this.host.app, sourcePath),
        notePreview: settings.interaction.notePreview,
      });

      const root = createRoot(el);
      this.roots.set(el, { root, token });
      root.render(
        <LeafletBlock
          config={config}
          markerTypes={settings.markers.types}
          tooltip={settings.markers.tooltip}
          showDiagnostics={settings.leafletCompatibility.diagnostics}
          copyOnShiftClick={settings.interaction.copyCoordinatesOnShiftClick}
          onNoteClick={links.onNoteClick}
          onNoteHover={links.onNoteHover}
          label={config.id}
        />,
      );
    } catch (error) {
      // A block this plugin cannot read reports inside itself: the rest of the note
      // still renders, and the rest of the vault is untouched.
      el.addClass('story-map-host--error');
      el.setText(formatLeafletError(error));
    }
  }

  private release(el: HTMLElement, token: number): void {
    const entry = this.roots.get(el);
    if (entry && entry.token !== token) return;
    this.mounted.delete(el);
    this.unmount(el);
  }

  private unmount(el: HTMLElement): void {
    const entry = this.roots.get(el);
    if (!entry) return;
    this.roots.delete(el);
    entry.root.unmount();
  }
}

class LeafletBlockChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private readonly release: () => void,
  ) {
    super(containerEl);
  }

  onunload(): void {
    this.release();
  }
}

export interface LeafletBlockProps {
  config: GeoMapConfig;
  markerTypes: readonly MarkerTypeDefinition[];
  tooltip: MarkerTooltipDisplay;
  showDiagnostics: boolean;
  copyOnShiftClick: boolean;
  label?: string | undefined;
  onNoteClick: (notePath: string, event: MouseEvent) => void;
  onNoteHover?: ((notePath: string, targetEl: HTMLElement, event: MouseEvent) => void) | undefined;
}

/**
 * The in-note map surface. `<GeoMap />` owns the whole Leaflet lifecycle, the tile
 * layers, the marker registry rendering, and zoom visibility; this component only
 * chooses the note-link callbacks, adds the optional Shift-click copy, and lists
 * the parser's diagnostics so a recognized-but-unimplemented key is never
 * silently swallowed.
 */
export function LeafletBlock({
  config,
  markerTypes,
  tooltip,
  showDiagnostics,
  copyOnShiftClick,
  label,
  onNoteClick,
  onNoteHover,
}: LeafletBlockProps) {
  const onReady = useShiftClickCopy(config.markers, copyOnShiftClick);
  const diagnostics = showDiagnostics ? (config.diagnostics ?? []) : [];

  return (
    <div className="geo-story-map-block">
      <GeoMap
        map={config}
        markerTypes={markerTypes}
        defaultTooltip={tooltip}
        className="geo-story-map-block__map"
        label={label ?? t('Map')}
        noteLinkClassName="internal-link"
        onNoteClick={onNoteClick}
        // `exactOptionalPropertyTypes`: an absent preview callback is omitted rather
        // than passed as `undefined`, which is how `<GeoMap />` detects the split.
        {...(onNoteHover ? { onNoteHover } : {})}
        onReady={onReady}
      />
      {diagnostics.length > 0 ? <DiagnosticList items={diagnostics} /> : null}
    </div>
  );
}

/**
 * Parser diagnostics, rendered as a short muted list under the map. They are
 * warnings about authored keys, so they must stay readable without competing with
 * the map itself.
 */
function DiagnosticList({ items }: { items: readonly GeoMapDiagnostic[] }) {
  return (
    <details className="geo-story-map-diagnostics">
      <summary>{t('Compatibility notices ({count})', { count: items.length })}</summary>
      <ul>
        {items.map((item, index) => (
          <li key={`${item.code}:${item.key ?? ''}:${index}`} data-level={item.level}>
            {item.key ? <code>{item.key}</code> : null} {item.message}
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Shift-click copies a marker's `location: [lat, lng]` line, the same text the AI
 * lookup writes to the clipboard, so a coordinate can be pasted straight into a
 * note's frontmatter.
 *
 * `<GeoMap />` exposes the live map through `onReady` and reports `null` on
 * teardown; the listener is attached to that instance and removed with it, so the
 * map never keeps a handler belonging to a destroyed block. The enabled flag and
 * the marker list are read through a ref, so toggling the setting or editing a note
 * does not need the map to be rebuilt.
 */
function useShiftClickCopy(
  markers: readonly GeoMarker[],
  enabled: boolean,
): (runtime: GeoMapRuntime | null) => void {
  const stateRef = useRef({ markers, enabled });
  stateRef.current = { markers, enabled };
  const detachRef = useRef<(() => void) | null>(null);

  useEffect(() => () => detachRef.current?.(), []);

  return useCallback((runtime: GeoMapRuntime | null) => {
    detachRef.current?.();
    detachRef.current = null;
    if (!runtime) return;

    const handleClick = (event: LeafletMouseEvent): void => {
      const { markers: current, enabled: copyEnabled } = stateRef.current;
      if (!copyEnabled) return;
      const original = event.originalEvent as MouseEvent | undefined;
      if (!original?.shiftKey) return;
      // A Shift-click on a marker note link belongs to the link, not to the copy.
      const target = original.target as Element | null;
      if (target?.closest?.('a')) return;

      const marker = markerAt(runtime.map, current, event.latlng);
      if (!marker) return;
      original.preventDefault();
      void copyLocationLine(marker.location.lat, marker.location.lng);
    };

    runtime.map.on('click', handleClick);
    detachRef.current = () => {
      runtime.map.off('click', handleClick);
    };
  }, []);
}

/**
 * The marker under a map click. Leaflet layers do not expose themselves on the
 * propagated event, so the configured positions are projected into container
 * pixels and the nearest one inside a small radius wins. Ties keep the earlier
 * marker, matching the render order.
 */
function markerAt(
  map: GeoMapRuntime['map'],
  markers: readonly GeoMarker[],
  latlng: { lat: number; lng: number },
): GeoMarker | undefined {
  if (markers.length === 0) return undefined;
  const clicked = map.latLngToContainerPoint([latlng.lat, latlng.lng]);
  let best: GeoMarker | undefined;
  let bestDistance = SHIFT_CLICK_RADIUS_PX;

  for (const marker of markers) {
    const point = map.latLngToContainerPoint([marker.location.lat, marker.location.lng]);
    const distance = point.distanceTo(clicked);
    if (distance >= bestDistance) continue;
    best = marker;
    bestDistance = distance;
  }
  return best;
}

async function copyLocationLine(lat: number, lng: number): Promise<void> {
  try {
    await navigator.clipboard.writeText(formatLocationLine(lat, lng));
    new Notice(t('Coordinates copied to clipboard'));
  } catch {
    new Notice(t('Could not copy to clipboard'));
  }
}

function formatLeafletError(error: unknown): string {
  if (error instanceof LeafletParseError) return `${t('Leaflet block configuration error')}:\n${error.message}`;
  if (error instanceof Error) return `${t('Leaflet block error')}: ${error.message}`;
  return t('Leaflet block error');
}
