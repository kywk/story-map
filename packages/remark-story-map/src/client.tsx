import { createRoot, type Root } from 'react-dom/client';
import type { ComponentType } from 'react';
import type { GeoMapConfig, MarkerTypeDefinition, StoryMapConfig } from '@story-map/story-map-core';
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
 * deliberately has no error UI, so a host that carries diagnostics owns the
 * disclosure; the list is a sibling of the map rather than an overlay, so a
 * diagnostic can never cover the map it is about.
 */
function renderDiagnostics(host: HTMLElement, config: GeoMapConfig): void {
  const diagnostics = config.diagnostics;
  if (!Array.isArray(diagnostics) || diagnostics.length === 0) return;

  const list = document.createElement('ul');
  list.className = 'story-map-host__diagnostics';
  for (const diagnostic of diagnostics) {
    if (!diagnostic || typeof diagnostic.message !== 'string') continue;
    const item = document.createElement('li');
    item.dataset.level = diagnostic.level === 'error' ? 'error' : 'warning';
    if (diagnostic.key) item.dataset.key = diagnostic.key;
    item.dataset.code = diagnostic.code;
    item.textContent = diagnostic.message;
    list.appendChild(item);
  }
  if (list.childElementCount > 0) host.appendChild(list);
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
    root.render(isMap ? <GeoMap map={config} /> : <StoryMap story={config} />);
    roots.set(host, root);

    // Appended after the root is created, so React owns the host's children and
    // a re-render never clears the list.
    if (isMap) renderDiagnostics(host, config);
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
