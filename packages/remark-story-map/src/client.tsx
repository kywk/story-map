import { createRoot, type Root } from 'react-dom/client';
import type { ComponentType } from 'react';
import type { StoryMapConfig } from '@story-map/story-map-core';
import 'leaflet/dist/leaflet.css';
import '@story-map/react-story-map/styles.css';

const roots = new Map<Element, Root>();
const pending = new Set<Element>();

interface RendererModule {
  StoryMap: ComponentType<{ story: StoryMapConfig }>;
}

let rendererPromise: Promise<RendererModule> | undefined;

function loadRenderer(): Promise<RendererModule> {
  rendererPromise ??= import('@story-map/react-story-map') as unknown as Promise<RendererModule>;
  return rendererPromise;
}

async function mountHost(host: HTMLElement) {
  if (roots.has(host) || pending.has(host)) return;
  const raw = host.dataset.storyMapConfig;
  if (!raw) return;

  pending.add(host);
  try {
    const story = JSON.parse(decodeURIComponent(raw)) as StoryMapConfig;
    const { StoryMap } = await loadRenderer();
    if (roots.has(host) || !host.isConnected) return;

    const root = createRoot(host);
    root.render(<StoryMap story={story} />);
    roots.set(host, root);
  } catch (error) {
    host.textContent = error instanceof Error ? `StoryMap error: ${error.message}` : 'StoryMap error';
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
