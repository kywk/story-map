import { describe, expect, it, vi } from 'vitest';

vi.mock('obsidian', () => {
  class PluginSettingTab {
    containerEl = { empty: vi.fn(() => { this.containerEl.rows = []; }), rows: [] as Setting[] };
  }
  class Control {
    inputEl = { type: '' };
    value: unknown;
    disabled = false;
    cta = false;
    change?: (value: never) => void;
    click?: () => void;
    setValue(value: unknown) { this.value = value; return this; }
    setPlaceholder() { return this; }
    addOptions() { return this; }
    setButtonText() { return this; }
    setDisabled(value: boolean) { this.disabled = value; return this; }
    setCta() { this.cta = true; return this; }
    onChange(callback: (value: never) => void) { this.change = callback; return this; }
    onClick(callback: () => void) { this.click = callback; return this; }
  }
  class Setting {
    name = '';
    desc = '';
    heading = false;
    controls: Control[] = [];
    constructor(container: { rows: Setting[] }) { container.rows.push(this); }
    setName(name: string) { this.name = name; return this; }
    setDesc(desc: string) { this.desc = desc; return this; }
    setHeading() { this.heading = true; return this; }
    addDropdown = this.addControl;
    addText = this.addControl;
    addToggle = this.addControl;
    addButton = this.addControl;
    addControl(callback: (control: Control) => void) {
      const control = new Control();
      this.controls.push(control);
      callback(control);
      return this;
    }
  }
  class Notice { constructor(_message?: unknown, _timeout?: number) {} }
  return { PluginSettingTab, Setting, Notice };
});

import type { App } from 'obsidian';
import type StoryMapPlugin from './main.js';
import { defaultSettings, type StoryMapPluginSettings } from './settings-data.js';
import { StoryMapSettingTab } from './settings-tab.js';

type Control = { value: unknown; change?: (value: never) => void; click?: () => void };
/** The settings controls emit strings; a toggle emits a boolean the test casts. */
function set(control: Control | undefined, value: string | boolean): void {
  (control?.change as ((value: string | boolean) => void) | undefined)?.(value);
}
type Row = { name: string; desc: string; controls: Control[] };

/** A named field inside a row that carries more than one control. */
function field(row: Row | undefined, index = 0): Control | undefined {
  return row?.controls[index];
}

function setup(overrides: Partial<StoryMapPluginSettings> = {}) {
  const plugin = {
    settings: { ...defaultSettings(), ...overrides },
    saveSettings: vi.fn(async () => {}),
    importLeafletSettings: vi.fn(async () => {}),
  };
  const tab = new StoryMapSettingTab({} as App, plugin as unknown as StoryMapPlugin);
  const container = tab.containerEl as unknown as { empty: ReturnType<typeof vi.fn>; rows: Row[] };
  return { tab, plugin, container };
}

function setupWithAgents() {
  const controller = {
    local: {
      agents: [{ id: 'codex', kind: 'codex', name: 'Codex', command: 'codex', args: 'exec -' }],
      defaultId: 'codex',
      detected: [],
    },
    saveLocal: vi.fn((next: unknown) => { controller.local = next as typeof controller.local; }),
    detect: vi.fn(async () => []),
    test: vi.fn(async () => 'OK'),
  };
  const plugin = {
    settings: defaultSettings(),
    saveSettings: vi.fn(async () => {}),
    importLeafletSettings: vi.fn(async () => {}),
    agentController: controller,
  };
  const tab = new StoryMapSettingTab({} as App, plugin as unknown as StoryMapPlugin);
  const container = tab.containerEl as unknown as { empty: ReturnType<typeof vi.fn>; rows: Row[] };
  return { tab, plugin, controller, container };
}

const DEFINITION_NAMES = [
  'Story', 'Default order', 'Default date field', 'Default note display', 'Default initial slide',
  'Default panel opacity', 'Restore defaults',
  'Map', 'Default map theme', 'Default zoom', 'Default minimum zoom', 'Default maximum zoom',
  'Default show path', 'Light tile URL', 'Light tile attribution', 'Light tile subdomains',
  'Use separate dark tiles', 'Dark tile URL', 'Dark tile attribution', 'Dark tile subdomains',
  'Markers & interaction', 'Default marker type', 'Default marker tooltip',
  'Preview linked note on hover', 'Copy location on Shift-click', 'Add marker type',
  'Leaflet compatibility', 'Default latitude', 'Default longitude', 'Default unit system',
  'Show compatibility warnings', 'Import settings from Obsidian Leaflet',
];

describe('settings definitions and legacy rendering', () => {
  it('exposes every section to modern settings search without DOM work', () => {
    const { tab, container } = setup();
    const definitions = tab.getSettingDefinitions();
    expect(definitions.map((definition) => 'name' in definition ? definition.name : '')).toEqual(DEFINITION_NAMES);
    expect(container.empty).not.toHaveBeenCalled();
  });

  it('renders and persists settings on hosts without the modern update API', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    const row = container.rows.find((entry) => entry.name === 'Default date field');
    expect(field(row)?.change).toBeTypeOf('function');
    set(field(row), ' modified ');
    expect(plugin.settings.story.dateField).toBe('modified');
    expect(plugin.saveSettings).toHaveBeenCalledOnce();
    container.rows.find((entry) => entry.name === 'Restore defaults')?.controls[0]?.click?.();
    expect(container.empty).toHaveBeenCalledTimes(2);
    expect(field(container.rows.find((entry) => entry.name === 'Default date field'))?.value).toBe('');
  });

  it('persists the map theme and restores the built-in selection', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    const theme = container.rows.find((entry) => entry.name === 'Default map theme');
    expect(field(theme)?.value).toBe('auto');
    set(field(theme), 'atlas');
    expect(plugin.settings.map.theme).toBe('atlas');
    expect(plugin.saveSettings).toHaveBeenCalledOnce();
    container.rows.find((entry) => entry.name === 'Restore defaults')?.controls[0]?.click?.();
    expect(field(container.rows.find((entry) => entry.name === 'Default map theme'))?.value).toBe('auto');
  });

  it('persists panel opacity and clamps to valid range', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    const opacity = container.rows.find((entry) => entry.name === 'Default panel opacity');
    expect(field(opacity)?.value).toBe('');
    set(field(opacity), '0.4');
    expect(plugin.settings.story.panelOpacity).toBe(0.4);
    expect(plugin.saveSettings).toHaveBeenCalledOnce();
    set(field(opacity), '1.5');
    expect(plugin.settings.story.panelOpacity).toBe(1);
    container.rows.find((entry) => entry.name === 'Restore defaults')?.controls[0]?.click?.();
    expect(field(container.rows.find((entry) => entry.name === 'Default panel opacity'))?.value).toBe('');
  });

  it('persists the initial slide and restores the built-in selection', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    const slide = container.rows.find((entry) => entry.name === 'Default initial slide');
    expect(field(slide)?.value).toBe('first');
    set(field(slide), 'last');
    expect(plugin.settings.story.initialSlide).toBe('last');
    expect(plugin.saveSettings).toHaveBeenCalledOnce();
    container.rows.find((entry) => entry.name === 'Restore defaults')?.controls[0]?.click?.();
    expect(field(container.rows.find((entry) => entry.name === 'Default initial slide'))?.value).toBe('first');
  });

  it('redraws reset values without invoking newer host APIs', () => {
    const { tab, container } = setup();
    const update = vi.fn();
    Object.assign(tab, { update });
    const definitions = tab.getSettingDefinitions().map((row) => 'name' in row ? row.name : '');
    tab.display();
    container.rows.find((entry) => entry.name === 'Restore defaults')?.controls[0]?.click?.();
    expect(update).not.toHaveBeenCalled();
    expect(container.empty).toHaveBeenCalledTimes(2);
    expect(tab.getSettingDefinitions().map((row) => 'name' in row ? row.name : '')).toEqual(definitions);
    expect(field(container.rows.find((entry) => entry.name === 'Default date field'))?.value).toBe('');
  });
});

describe('tile provider settings', () => {
  it('persists the light tile source without disturbing the theme', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    set(field(container.rows.find((entry) => entry.name === 'Light tile URL')), ' https://tiles.test/{z}/{x}/{y}.png ');
    set(field(container.rows.find((entry) => entry.name === 'Light tile attribution')), ' © Test ');
    set(field(container.rows.find((entry) => entry.name === 'Light tile subdomains')), 'a, b c');

    expect(plugin.settings.map.tiles).toEqual({
      light: { url: 'https://tiles.test/{z}/{x}/{y}.png', attribution: '© Test', subdomains: ['a', 'b', 'c'] },
    });
    expect(plugin.settings.map.theme).toBe('auto');
  });

  it('removes a tile override when the field is emptied', () => {
    const { tab, plugin, container } = setup({
      map: {
        theme: 'auto',
        showPath: true,
        tiles: { light: { url: 'https://tiles.test/{z}/{x}/{y}.png', attribution: '© Test' } },
      },
    });
    tab.display();
    set(field(container.rows.find((entry) => entry.name === 'Light tile URL')), '   ');
    // The stored URL is gone, so the block falls back to the built-in provider.
    expect(plugin.settings.map.tiles?.light?.url).toBeUndefined();
    expect(plugin.settings.map.tiles?.light?.attribution).toBe('© Test');
  });

  it('adds and removes the dark tile pair through one toggle', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    const toggle = container.rows.find((entry) => entry.name === 'Use separate dark tiles');
    expect(field(toggle)?.value).toBe(false);

    set(field(toggle), true);
    expect(plugin.settings.map.tiles?.dark).toEqual({ url: '', attribution: '' });
    set(field(container.rows.find((entry) => entry.name === 'Dark tile URL')), 'https://dark.test/{z}/{x}/{y}.png');
    expect(plugin.settings.map.tiles?.light).toBeUndefined();

    set(field(container.rows.find((entry) => entry.name === 'Use separate dark tiles')), false);
    expect(plugin.settings.map.tiles?.dark).toBeUndefined();
  });
});

describe('marker and interaction settings', () => {
  it('edits, adds, and removes a marker type in place', () => {
    const { tab, plugin, container } = setup({
      markers: { defaultType: 'food', types: [{ id: 'food', color: '#b45309' }], tooltip: 'hover' },
    });
    tab.display();

    const row = container.rows.find((entry) => entry.name === 'Marker type: food');
    expect(row?.desc).toContain('Font Awesome names are not supported');
    // symbol, color, minZoom, maxZoom, remove
    set(field(row, 0), '🍴');
    set(field(row, 2), '4');
    expect(plugin.settings.markers.types).toEqual([
      { id: 'food', icon: { kind: 'symbol', value: '🍴' }, color: '#b45309', minZoom: 4 },
    ]);

    field(container.rows.find((entry) => entry.name === 'Add marker type'), 0)?.click?.();
    expect(plugin.settings.markers.types.map((type) => type.id)).toEqual(['food', 'type-2']);

    field(container.rows.find((entry) => entry.name === 'Marker type: food'), 4)?.click?.();
    expect(plugin.settings.markers.types.map((type) => type.id)).toEqual(['type-2']);
    // Removing the configured default falls back to the built-in generic type.
    expect(plugin.settings.markers.defaultType).toBe('default');
  });

  it('treats an absolute URL as an image icon and clears an emptied one', () => {
    const { tab, plugin, container } = setup({
      markers: { defaultType: 'photo', types: [{ id: 'photo', icon: { kind: 'symbol', value: '★' } }], tooltip: 'hover' },
    });
    tab.display();
    const row = container.rows.find((entry) => entry.name === 'Marker type: photo');
    set(field(row, 0), 'https://example.invalid/photo.png');
    expect(plugin.settings.markers.types[0]?.icon).toEqual({ kind: 'image', value: 'https://example.invalid/photo.png' });
    set(field(container.rows.find((entry) => entry.name === 'Marker type: photo'), 0), '  ');
    expect(plugin.settings.markers.types[0]?.icon).toBeUndefined();
  });

  it('persists the tooltip default, preview, and Shift-click copy toggles', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    set(field(container.rows.find((entry) => entry.name === 'Default marker tooltip')), 'always');
    set(field(container.rows.find((entry) => entry.name === 'Preview linked note on hover')), false);
    set(field(container.rows.find((entry) => entry.name === 'Copy location on Shift-click')), true);

    expect(plugin.settings.markers.tooltip).toBe('always');
    expect(plugin.settings.interaction).toEqual({ notePreview: false, copyCoordinatesOnShiftClick: true });
  });
});

describe('leaflet compatibility settings', () => {
  it('keeps a half-typed center from replacing the last valid pair', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    set(field(container.rows.find((entry) => entry.name === 'Default latitude')), '25.03');
    // A latitude on its own is not a center, so nothing is committed yet.
    expect(plugin.settings.leafletCompatibility.defaultCenter).toBeUndefined();
    set(field(container.rows.find((entry) => entry.name === 'Default longitude')), '121.56');
    expect(plugin.settings.leafletCompatibility.defaultCenter).toEqual([25.03, 121.56]);
  });

  it('carries the unit system and the diagnostics switch', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    set(field(container.rows.find((entry) => entry.name === 'Default unit system')), 'imperial');
    set(field(container.rows.find((entry) => entry.name === 'Show compatibility warnings')), false);
    expect(plugin.settings.leafletCompatibility).toEqual({ unitSystem: 'imperial', diagnostics: false });
  });

  it('delegates the import to the plugin command instead of reading the file here', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    const row = container.rows.find((entry) => entry.name === 'Import settings from Obsidian Leaflet');
    expect(row?.desc).toContain('not imported');
    field(row)?.click?.();
    expect(plugin.importLeafletSettings).toHaveBeenCalledOnce();
  });
});

describe('local agent settings', () => {
  it('exposes agent rows and persists the draft', () => {
    const { tab, controller, container } = setupWithAgents();
    const names = tab.getSettingDefinitions().map((row) => 'name' in row ? row.name : '');
    expect(names).toContain('Local agents');
    expect(names).toContain('Apply local settings');

    tab.display();
    container.rows.find((row) => row.name === 'Apply local settings')?.controls[0]?.click?.();
    expect(controller.saveLocal).toHaveBeenCalledOnce();
    expect(controller.saveLocal.mock.calls[0]?.[0]).toMatchObject({ defaultId: 'codex' });
  });

  it('detects installed agents on open and after a successful test', async () => {
    const { tab, controller, container } = setupWithAgents();
    controller.detect.mockResolvedValueOnce([]);
    tab.display();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(controller.detect).toHaveBeenCalled();
    expect(container.rows.some((row) => row.name === 'Codex · Not detected')).toBe(true);

    // index 1 is the Test button; index 0 is the disabled "Set as default".
    container.rows.find((row) => row.name === 'Codex · Not detected')?.controls[1]?.click?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(controller.test).toHaveBeenCalled();
    expect(container.rows.some((row) => row.name === 'Codex · Detected')).toBe(true);
  });
});
