import { describe, expect, it, vi } from 'vitest';

const rootMocks = vi.hoisted(() => {
  const roots: Array<{ render: ReturnType<typeof vi.fn>; unmount: ReturnType<typeof vi.fn> }> = [];
  return { roots };
});

vi.mock('react-dom/client', () => ({
  createRoot: () => {
    const root = { render: vi.fn(), unmount: vi.fn() };
    rootMocks.roots.push(root);
    return root;
  },
}));

// The renderer module now exports both entry points; the client destructures the
// pair from one shared import, so the mock must carry both.
vi.mock('@story-map/react-story-map', () => ({ StoryMap: () => null, GeoMap: () => null }));

describe('StoryMap browser client SPA lifecycle', () => {
  it('mounts multiple hosts once and unmounts removed hosts', async () => {
    const { mountStoryMaps } = await import('./client.js');
    const makeHost = (title: string) => ({
      dataset: { storyMapConfig: encodeURIComponent(JSON.stringify({ title })) },
      isConnected: true,
      textContent: '',
    });
    const first = makeHost('First');
    const second = makeHost('Second');
    const hosts = [first, second];
    const scope = { querySelectorAll: () => hosts } as unknown as ParentNode;

    mountStoryMaps(scope);
    mountStoryMaps(scope);
    await vi.waitFor(() => expect(rootMocks.roots).toHaveLength(2));
    expect(rootMocks.roots.map((root) => root.render.mock.calls[0]?.[0].props.story.title)).toEqual([
      'First',
      'Second',
    ]);

    mountStoryMaps(scope);
    expect(rootMocks.roots).toHaveLength(2);

    first.isConnected = false;
    hosts.shift();
    mountStoryMaps(scope);
    await vi.waitFor(() => expect(rootMocks.roots[0]?.unmount).toHaveBeenCalledOnce());
    expect(rootMocks.roots[1]?.unmount).not.toHaveBeenCalled();

    second.isConnected = false;
    hosts.shift();
    mountStoryMaps(scope);
    await vi.waitFor(() => expect(rootMocks.roots[1]?.unmount).toHaveBeenCalledOnce());
  });
});
