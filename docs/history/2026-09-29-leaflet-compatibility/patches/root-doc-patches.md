# Root Documentation Patch Requirements

These are semantic patch requirements, not a blind text-replacement script. Apply them against the current branch and keep surrounding documentation coherent.

## `SPEC.md`

### Goal/scope

Add:

- ordinary GeoMap rendering as a reusable layer;
- `leaflet` fenced-block compatibility in Obsidian and Remark;
- a single shared Leaflet runtime.

Clarify that the goal is documented/static source compatibility, not cloning every historical plugin integration.

### Architecture

Change the conceptual flow from only:

```text
StoryMapConfig -> react-story-map
```

to:

```text
story-map source -> StoryMapConfig -> StoryMap
leaflet source   -> GeoMapConfig   -> GeoMap
                                   ^
StoryMap composes -----------------|
```

### Package responsibilities

`story-map-core` additionally owns:

- GeoMap types;
- Leaflet dialect parser;
- diagnostics.

`react-story-map` additionally owns:

- GeoMap renderer;
- shared Leaflet lifecycle;
- generic marker/tile primitives.

`obsidian-story-map` additionally owns:

- `leaflet` Markdown processor;
- Leaflet compatibility settings/resolution.

`remark-story-map` additionally owns:

- `leaflet` code-node transform;
- map/story browser-host discrimination.

### Tile default

Replace built-in OSM URL:

`https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`

with:

`https://tile.openstreetmap.org/{z}/{x}/{y}.png`

Do not remove configurable tile behavior.

### Note metadata

Move `mapzoom` from "collected/deferred" to an explicitly scheduled marker visibility capability.

### Deferred work

Remove or rewrite these obsolete deferred/non-goal entries:

- marker icon compatibility as a blanket non-goal;
- marker popup parity as a blanket non-goal;
- `mapzoom` visibility semantics as a blanket non-goal;
- GeoJSON/GPX as permanent non-goals.

Replace with phased compatibility wording:

- P0/P1 marker/type/popup/zoom semantics;
- P2 GeoJSON/GPX;
- P3 image maps/drawing/mutable state.

Do not claim deferred features are already implemented.

## `AGENTS.md`

The current file says agents must not introduce marker popup/icon parity or `mapzoom` semantics. That now conflicts with approved work.

Update:

- Mission: current task intentionally expands beyond the prior MVP.
- Source conventions: add `leaflet` fence as supported compatibility dialect.
- Defaulting rules: distinguish native StoryMap defaults from Leaflet compatibility defaults.
- Non-goals: replace old marker/mapzoom exclusions with the new phased exclusions.
- Package boundaries: add GeoMap responsibilities.
- Collaboration rules: PM owns shared public GeoMap contracts.
- Definition of done: add Leaflet fence, current production fixtures, unified Docusaurus runtime.

Keep the existing protections against generic plugin frameworks, MapLibre, Redux, and route-policy duplication.

## `docs/architecture.md`

Document:

- new GeoMap data flow;
- parser split;
- compatibility diagnostics;
- GeoMap renderer lifecycle;
- StoryMap composition;
- Obsidian inline fence lifecycle;
- Remark map/story discriminator;
- tile source behavior;
- marker registry behavior;
- settings migration;
- host boundaries.

Update file-level maps once concrete filenames exist.

## `packages/obsidian-story-map/README.md`

After implementation, update:

- plugin now renders `leaflet` fences in ordinary notes;
- settings sections;
- Leaflet settings import behavior;
- network/tile-provider wording;
- exact OSM default URL;
- compatibility limitations/deferred list.

Do not document planned fields as implemented.
