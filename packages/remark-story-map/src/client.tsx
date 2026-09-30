import { createRoot, type Root } from 'react-dom/client';
import type { ComponentType, ReactNode } from 'react';
import type {
  GeoMapConfig,
  GeoMapDiagnostic,
  MarkerTypeDefinition,
  StoryMapConfig,
} from '@story-map/story-map-core';
import 'leaflet/dist/leaflet.css';
import '@story-map/react-story-map/styles.css';

/** Which renderer a host element mounts, read from `data-story-map-kind`. */
const STORY_KIND = 'story';
const MAP_KIND = 'map';
const DEFAULT_KIND = STORY_KIND;

const roots = new Map<Element, Root>();
const pending = new Set<Element>();

interface RendererModule {
  StoryMap: ComponentType<{ story: StoryMapConfig }>;
  GeoMap: ComponentType<{
    map: GeoMapConfig;
    markerTypes?: readonly MarkerTypeDefinition[];
  }>;
}

/**
 * One renderer module and one CSS import for the whole page. The `??=` matters:
 * a story host and a map host mounting concurrently share a single import, so the
 * module (and the Leaflet it lazily imports inside its own effects) is evaluated
 * once no matter how many hosts a page holds.
 */
let rendererPromise: Promise<RendererModule> | undefined;

function loadRenderer(): Promise<RendererModule> {
  rendererPromise ??= import('@story-map/react-story-map') as unknown as Promise<RendererModule>;
  return rendererPromise;
}

/** Read the discriminator, defaulting to `story` for a host written before it existed. */
function hostKind(host: HTMLElement): string {
  return host.dataset.storyMapKind || DEFAULT_KIND;
}

/**
 * Surface a recognized-but-unsupported key on the published page. The renderer
 * deliberately has no error UI, so the host owns the disclosure; the list sits
 * below the map rather than over it, so a diagnostic can never cover the map it
 * is about.
 *
 * This returns React elements instead of appending DOM nodes on purpose. React
 * takes ownership of a `createRoot` container and clears its existing children on
 * the first commit, so anything appended to the host around `root.render()` is
 * wiped. Rendering the list inside the same tree is what keeps it on the page.
 */
function hostDiagnostics(config: GeoMapConfig): ReactNode {
  const diagnostics = config.diagnostics;
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) return null;

  const items = diagnostics
    .filter(
      (diagnostic): diagnostic is GeoMapDiagnostic =>
        !!diagnostic && typeof diagnostic.message === 'string' && diagnostic.message.length > 0,
    )
    .map((diagnostic) => (
      <li
        key={`${diagnostic.code}:${diagnostic.key ?? ''}:${diagnostic.message}`}
        data-level={diagnostic.level === 'error' ? 'error' : 'warning'}
        data-code={diagnostic.code}
        {...(diagnostic.key ? { 'data-key': diagnostic.key } : {})}
      >
        {diagnostic.message}
      </li>
    ));

  if (items.length === 0) return null;
  return <ul className="story-map-host__diagnostics">{items}</ul>;
}

/**
 * A `leaflet` host: the map plus its compatibility diagnostics. Only the host's
 * presentation is composed here; map rendering stays in `<GeoMap>`.
 *
 * Exported so a host that mounts maps outside this client - and the tests - can
 * reuse the same composition.
 */
export function MapHost({
  config,
  GeoMap,
}: {
  config: GeoMapConfig;
  GeoMap: ComponentType<{ map: GeoMapConfig }>;
}) {
  return (
    <>
      <GeoMap map={config} />
      {hostDiagnostics(config)}
    </>
  );
}

/** A malformed block degrades in place instead of throwing into the page. */
function renderHostError(host: HTMLElement, error: Error): void {
  host.textContent = `StoryMap error: ${error.message}`;
}

async function mountHost(host: HTMLElement) {
  if (roots.has(host) || pending.has(host)) return;
  const raw = host.dataset.storyMapConfig;
  if (!raw) return;

  pending.add(host);
  try {
    const config = JSON.parse(decodeURIComponent(raw)) as StoryMapConfig & GeoMapConfig;
    const { StoryMap, GeoMap } = await loadRenderer();
    if (roots.has(host) || !host.isConnected) return;

    const isMap = hostKind(host) === MAP_KIND;
    const root = createRoot(host);
    root.render(
      isMap ? <MapHost config={config} GeoMap={GeoMap} /> : <StoryMap story={config} />,
    );
    roots.set(host, root);
  } catch (error) {
    renderHostError(host, error instanceof Error ? error : new Error(String(error)));
  } finally {
    pending.delete(host);
  }
}

function unmountRemovedHosts() {
  for (const [host, root] of roots) {
    if (host.isConnected) continue;
    roots.delete(host);
    queueMicrotask(() => root.unmount());
  }
}

export function mountStoryMaps(scope: ParentNode = document) {
  unmountRemovedHosts();
  const hosts = scope.querySelectorAll<HTMLElement>('[data-story-map-config]');
  hosts.forEach((host) => void mountHost(host));
}

export function startStoryMapClient() {
  if (typeof document === 'undefined') return () => {};

  const run = () => mountStoryMaps(document);
  run();
  const observer = new MutationObserver(run);
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => startStoryMapClient(), { once: true });
  } else {
    startStoryMapClient();
  }
}
