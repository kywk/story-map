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
    control?: Control;
    constructor(container: { rows: Setting[] }) { container.rows.push(this); }
    setName(name: string) { this.name = name; return this; }
    setDesc() { return this; }
    setHeading() { return this; }
    addDropdown = this.addControl;
    addText = this.addControl;
    addToggle = this.addControl;
    addButton = this.addControl;
    addControl(callback: (control: Control) => void) {
      this.control = new Control(); callback(this.control); return this;
    }
  }
  class Notice { constructor(_message?: unknown, _timeout?: number) {} }
  return { PluginSettingTab, Setting, Notice };
});

import type { App } from 'obsidian';
import type StoryMapPlugin from './main.js';
import { StoryMapSettingTab } from './settings-tab.js';

type Row = { name: string; control?: { value: unknown; change?: (value: string) => void; click?: () => void } };
function setup() {
  const plugin = { settings: { dateField: 'created' }, saveSettings: vi.fn(async () => {}) };
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
    settings: { dateField: 'created' },
    saveSettings: vi.fn(async () => {}),
    agentController: controller,
  };
  const tab = new StoryMapSettingTab({} as App, plugin as unknown as StoryMapPlugin);
  const container = tab.containerEl as unknown as { empty: ReturnType<typeof vi.fn>; rows: Row[] };
  return { tab, plugin, controller, container };
}

describe('settings definitions and legacy rendering', () => {
  it('exposes all defaultable settings to modern settings search without DOM work', () => {
    const { tab, container } = setup();
    const definitions = tab.getSettingDefinitions();
    expect(definitions.map((definition) => 'name' in definition ? definition.name : '')).toEqual([
      'Defaults', 'Default order', 'Default date field', 'Default note display', 'Default initial slide', 'Map', 'Default map theme',
      'Default zoom', 'Default minimum zoom', 'Default maximum zoom', 'Default map opacity', 'Default tile URL',
      'Default attribution', 'Default show path', 'Restore defaults',
    ]);
    expect(container.empty).not.toHaveBeenCalled();
  });

  it('renders and persists settings on hosts without the modern update API', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    const field = container.rows.find((row) => row.name === 'Default date field');
    expect(field?.control?.value).toBe('created');
    field?.control?.change?.(' modified ');
    expect(plugin.settings.dateField).toBe('modified');
    expect(plugin.saveSettings).toHaveBeenCalledOnce();
    container.rows.find((row) => row.name === 'Restore defaults')?.control?.click?.();
    expect(container.empty).toHaveBeenCalledTimes(2);
    expect(container.rows.find((row) => row.name === 'Default date field')?.control?.value).toBe('');
  });

  it('persists the map theme and restores the built-in selection', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    const theme = container.rows.find((row) => row.name === 'Default map theme');
    expect(theme?.control?.value).toBe('auto');
    theme?.control?.change?.('atlas');
    expect(plugin.settings).toMatchObject({ mapTheme: 'atlas' });
    expect(plugin.saveSettings).toHaveBeenCalledOnce();
    container.rows.find((row) => row.name === 'Restore defaults')?.control?.click?.();
    expect(container.rows.find((row) => row.name === 'Default map theme')?.control?.value).toBe('auto');
  });

  it('persists map opacity and clamps to valid range', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    const opacity = container.rows.find((row) => row.name === 'Default map opacity');
    expect(opacity?.control?.value).toBe('');
    opacity?.control?.change?.('0.4');
    expect(plugin.settings).toMatchObject({ mapOpacity: 0.4 });
    expect(plugin.saveSettings).toHaveBeenCalledOnce();
    opacity?.control?.change?.('1.5');
    expect(plugin.settings).toMatchObject({ mapOpacity: 1 });
    container.rows.find((row) => row.name === 'Restore defaults')?.control?.click?.();
    expect(container.rows.find((row) => row.name === 'Default map opacity')?.control?.value).toBe('');
  });

  it('persists the initial slide and restores the built-in selection', () => {
    const { tab, plugin, container } = setup();
    tab.display();
    const slide = container.rows.find((row) => row.name === 'Default initial slide');
    expect(slide?.control?.value).toBe('first');
    slide?.control?.change?.('last');
    expect(plugin.settings).toMatchObject({ initialSlide: 'last' });
    expect(plugin.saveSettings).toHaveBeenCalledOnce();
    container.rows.find((row) => row.name === 'Restore defaults')?.control?.click?.();
    expect(container.rows.find((row) => row.name === 'Default initial slide')?.control?.value).toBe('first');
  });

  it('redraws reset values without invoking newer host APIs', () => {
    const { tab, container } = setup();
    const update = vi.fn();
    Object.assign(tab, { update });
    const definitions = tab.getSettingDefinitions().map((row) => 'name' in row ? row.name : '');
    tab.display();
    container.rows.find((row) => row.name === 'Restore defaults')?.control?.click?.();
    expect(update).not.toHaveBeenCalled();
    expect(container.empty).toHaveBeenCalledTimes(2);
    expect(tab.getSettingDefinitions().map((row) => 'name' in row ? row.name : '')).toEqual(definitions);
    expect(container.rows.find((row) => row.name === 'Default date field')?.control?.value).toBe('');
  });
});

describe('local agent settings', () => {
  it('exposes agent rows and persists the draft', () => {
    const { tab, controller, container } = setupWithAgents();
    const names = tab.getSettingDefinitions().map((row) => 'name' in row ? row.name : '');
    expect(names).toContain('Local agents');
    expect(names).toContain('Apply local settings');

    tab.display();
    container.rows.find((row) => row.name === 'Apply local settings')?.control?.click?.();
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

    container.rows.find((row) => row.name === 'Codex · Not detected')?.control?.click?.();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(controller.test).toHaveBeenCalled();
    expect(container.rows.some((row) => row.name === 'Codex · Detected')).toBe(true);
  });
});
