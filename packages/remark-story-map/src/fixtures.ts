// The four live `leaflet` blocks from the current `kywk/kywk.github.io` content,
// copied verbatim from
// `docs/history/2026-09-29-leaflet-compatibility/examples/current-vault-leaflet-blocks.md`.
//
// They are the Phase 1 source-compatibility bar, so they are pinned here as test
// data rather than read from the doc at runtime: a test that read the doc would
// happily pass against an edited example. The doc is a historical record of one
// moment; this module is the contract.

export interface LeafletFixture {
  /** Which production page the block lives on. */
  name: 'Chile' | 'Egypt' | 'Kuala Lumpur' | 'Xinjiang';
  /** The source file inside the target repository. */
  source: string;
  /** The authored map id. Chile and Xinjiang deliberately share one. */
  id: string;
  height: string;
  center: [number, number];
  minZoom?: number;
  maxZoom?: number;
  zoom: number;
  markerFolder: string;
  /** The fence body exactly as authored. */
  block: string;
}

export const LEAFLET_FIXTURES: readonly LeafletFixture[] = [
  {
    name: 'Chile',
    source: 'backpacker/2509 Chile/Index de Chile.md',
    id: 'chile-2509',
    height: '600px',
    center: [-33, -70],
    minZoom: 4,
    maxZoom: 17,
    zoom: 5,
    markerFolder: 'backpacker/2509 Chile/Chile',
    block: [
      'id: chile-2509',
      'height: 600px',
      'lat: -33.0000',
      'long: -70.0000',
      'minZoom: 4',
      'maxZoom: 17',
      'defaultZoom: 5',
      'unit: meters',
      'scale: 1',
      'darkMode: true',
      'markerFolder: backpacker/2509 Chile/Chile',
    ].join('\n'),
  },
  {
    name: 'Egypt',
    source: 'backpacker/2401 Egypt/Index Pharaoh Egypt.md',
    id: 'egypt-2401',
    height: '500px',
    center: [27.5, 29.5],
    minZoom: 5,
    maxZoom: 15,
    zoom: 6,
    markerFolder: 'backpacker/2401 Egypt/Egypt',
    block: [
      'id: egypt-2401',
      'height: 500px',
      'lat: 27.50000',
      'long: 29.50000',
      'minZoom: 5',
      'maxZoom: 15',
      'defaultZoom: 6',
      'unit: meters',
      'scale: 1',
      'darkMode: true',
      'markerFolder: backpacker/2401 Egypt/Egypt',
    ].join('\n'),
  },
  {
    name: 'Kuala Lumpur',
    // Shares its source document with Egypt: one page can carry two maps.
    source: 'backpacker/2401 Egypt/Index Pharaoh Egypt.md',
    id: 'kl-2401',
    height: '500px',
    center: [3.15, 101.67],
    minZoom: 11,
    maxZoom: 17,
    zoom: 13,
    markerFolder: 'backpacker/2401 Egypt/Kuala Lumpur',
    block: [
      'id: kl-2401',
      'height: 500px',
      'lat: 3.15000',
      'long: 101.67000',
      'minZoom: 11',
      'maxZoom: 17',
      'defaultZoom: 13',
      'unit: meters',
      'scale: 1',
      'darkMode: true',
      'markerFolder: backpacker/2401 Egypt/Kuala Lumpur',
    ].join('\n'),
  },
  {
    name: 'Xinjiang',
    source: 'backpacker/2601 Xinjiang/Index Xinjiang.md',
    // The authored id is reused from the Chile block on purpose. Nothing may
    // rename it, and nothing may treat the repeat as a collision.
    id: 'chile-2509',
    height: '600px',
    center: [42, 82],
    minZoom: 4,
    maxZoom: 17,
    zoom: 5,
    markerFolder: 'backpacker/2601 Xinjiang/Xinjiang',
    block: [
      'id: chile-2509',
      'height: 600px',
      'lat: 42.0000',
      'long: 82.0000',
      'minZoom: 4',
      'maxZoom: 17',
      'defaultZoom: 5',
      'unit: meters',
      'scale: 1',
      'darkMode: true',
      'markerFolder: backpacker/2601 Xinjiang/Xinjiang',
    ].join('\n'),
  },
];
