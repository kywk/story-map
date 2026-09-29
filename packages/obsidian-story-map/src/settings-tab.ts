import {
  Notice, PluginSettingTab, Setting, type App, type ButtonComponent, type TextComponent,
  type SettingDefinitionItem, type SettingDefinitionRender,
} from 'obsidian';
import type { StoryInitialSlide, StoryMapTheme, StoryNoteDisplay, StoryOrder } from '@story-map/story-map-core';
import { parseArguments, type AgentConfig, type DetectedAgent } from './agents.js';
import { t, translateMessage } from './i18n.js';
import type { LocalAgents } from './local-agents.js';
import type StoryMapPlugin from './main.js';
import {
  DEFAULT_STORY_MAP_SETTINGS,
  type StoryMapPluginSettings,
} from './settings-data.js';

type SettingRow = Omit<SettingDefinitionRender, 'render'> & {
  render: (setting: Setting) => void;
};

const ORDER_OPTIONS: Array<[value: string, label: string]> = [
  ['asc', 'Ascending (default)'],
  ['desc', 'Descending'],
];

const NOTE_DISPLAY_OPTIONS: Array<[value: string, label: string]> = [
  ['basic', 'Basic information only'],
  ['link', 'Title link with page preview (default)'],
  ['full', 'Full note body'],
];

const INITIAL_SLIDE_OPTIONS: Array<[value: string, label: string]> = [
  ['first', 'First slide (default)'],
  ['last', 'Last slide'],
];

const MAP_THEME_OPTIONS: Array<[value: StoryMapTheme, label: string]> = [
  ['auto', 'Auto (follow Obsidian theme) (default)'],
  ['light', 'Light'],
  ['dark', 'Dark'],
  ['vintage', 'Vintage'],
  ['cyber', 'Cyber'],
  ['atlas', 'Atlas'],
];

export class StoryMapSettingTab extends PluginSettingTab {
  private agentDraft: LocalAgents | null = null;
  private detectionStarted = false;
  private readonly agentTests = new Set<AbortController>();

  constructor(app: App, private readonly plugin: StoryMapPlugin) {
    super(app, plugin);
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return this.settingRows();
  }

  // Obsidian 1.8–1.12 render imperatively; 1.13+ indexes and renders definitions.
  display(): void {
    this.renderFallback();
  }

  hide(): void {
    for (const abort of this.agentTests) abort.abort();
    this.agentTests.clear();
    this.agentDraft = null;
    this.detectionStarted = false;
  }

  private renderFallback(): void {
    this.containerEl.empty();
    for (const row of this.settingRows()) {
      row.render(new Setting(this.containerEl).setName(row.name));
    }
  }

  private refreshSettings(): void {
    // The definitions and their search labels are static. Only control values change;
    // redraw the same rows using APIs available on every supported host.
    this.renderFallback();
  }

  private redraw(): void {
    const update = (this as Partial<{ update(): void }>).update;
    if (typeof update === 'function') update.call(this);
    else this.renderFallback();
  }

  private settingRows(): SettingRow[] {
    const rows: SettingRow[] = [
      { name: 'Defaults', render: (setting) => {
        setting
          .setDesc(
            "Defaults applied when a document's story-map block omits a key. Document values always win, then these settings, then built-in defaults. Per-story values (title, noteFolder, map center) are set in each document instead.",
          )
          .setHeading();
      } },
      { name: 'Default order', render: (setting) => {
        setting
          .setDesc('Folder ordering direction. Built-in default: ascending.')
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(Object.fromEntries(ORDER_OPTIONS))
              .setValue(this.plugin.settings.order ?? 'asc')
              .onChange((value) => this.patch({ order: toOrder(value) })),
          );
      } },
      { name: 'Default date field', render: (setting) => {
        setting
          .setDesc('Frontmatter field used for folder ordering. Built-in default: date-created.')
          .addText((text) =>
            text
              .setPlaceholder('date-created')
              .setValue(this.plugin.settings.dateField ?? '')
              .onChange((value) => this.patch({ dateField: trimOrUndefined(value) })),
          );
      } },
      { name: 'Default note display', render: (setting) => {
        setting
          .setDesc('How resolved notes are presented. Built-in default: link.')
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(Object.fromEntries(NOTE_DISPLAY_OPTIONS))
              .setValue(this.plugin.settings.noteDisplay ?? 'link')
              .onChange((value) => this.patch({ noteDisplay: toNoteDisplay(value) })),
          );
      } },
      { name: 'Default initial slide', render: (setting) => {
        setting
          .setDesc('Slide to display when opening the story map. Built-in default: first.')
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(Object.fromEntries(INITIAL_SLIDE_OPTIONS))
              .setValue(this.plugin.settings.initialSlide === 'last' ? 'last' : 'first')
              .onChange((value) => this.patch({ initialSlide: toInitialSlide(value) })),
          );
      } },
      { name: 'Map', render: (setting) => {
        setting.setHeading();
      } },
      { name: 'Default map theme', render: (setting) => {
        setting
          .setDesc('Default: auto, which follows the Obsidian light/dark theme and colors. A theme selected in the document takes precedence.')
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(Object.fromEntries(MAP_THEME_OPTIONS))
              .setValue(this.plugin.settings.mapTheme ?? 'auto')
              .onChange((value) => this.patch({ mapTheme: toMapTheme(value) })),
          );
      } },
      { name: 'Default zoom', render: (setting) => {
        setting
          .addText((text) => this.number(text, this.plugin.settings.mapZoom, (value) => this.patch({ mapZoom: value })));
      } },
      { name: 'Default minimum zoom', render: (setting) => {
        setting
          .addText((text) => this.number(text, this.plugin.settings.mapMinZoom, (value) => this.patch({ mapMinZoom: value })));
      } },
      { name: 'Default maximum zoom', render: (setting) => {
        setting
          .addText((text) => this.number(text, this.plugin.settings.mapMaxZoom, (value) => this.patch({ mapMaxZoom: value })));
      } },
      { name: 'Default tile URL', render: (setting) => {
        setting
          .setDesc('Built-in default: OpenStreetMap standard tiles.')
          .addText((text) =>
            text
              .setPlaceholder('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png')
              .setValue(this.plugin.settings.mapTileUrl ?? '')
              .onChange((value) => this.patch({ mapTileUrl: trimOrUndefined(value) })),
          );
      } },
      { name: 'Default attribution', render: (setting) => {
        setting
          .addText((text) =>
            text
              .setPlaceholder('© OpenStreetMap contributors')
              .setValue(this.plugin.settings.mapAttribution ?? '')
              .onChange((value) => this.patch({ mapAttribution: trimOrUndefined(value) })),
          );
      } },
      { name: 'Default show path', render: (setting) => {
        setting
          .setDesc('Connect located slides with a polyline when a block does not set showPath.')
          .addToggle((toggle) =>
            toggle
              .setValue(this.plugin.settings.mapShowPath ?? true)
              .onChange((value) => this.patch({ mapShowPath: value })),
          );
      } },
      { name: 'Restore defaults', render: (setting) => {
        setting.addButton((button) =>
          button
            .setButtonText('Restore defaults')
            .onClick(() => {
              this.plugin.settings = { ...DEFAULT_STORY_MAP_SETTINGS };
              void this.plugin.saveSettings();
              this.refreshSettings();
            }),
        );
      } },
    ];
    if (this.plugin.agentController) rows.push(...this.agentRows());
    return rows;
  }

  private agentDraftState(): LocalAgents | null {
    const controller = this.plugin.agentController;
    if (!controller) return null;
    if (!this.agentDraft) {
      this.agentDraft = structuredClone(controller.local);
      this.startDetection();
    }
    return this.agentDraft;
  }

  private startDetection(): void {
    if (this.detectionStarted) return;
    this.detectionStarted = true;
    void this.runDetection().catch(() => {
      // Auto-detection is best-effort; the explicit button reports failures.
    });
  }

  private async runDetection(): Promise<void> {
    const controller = this.plugin.agentController;
    const draft = this.agentDraft;
    if (!controller || !draft) return;
    draft.detected = await controller.detect();
    this.redraw();
  }

  private markDetected(agent: AgentConfig): void {
    const draft = this.agentDraft;
    if (!draft) return;
    const detected: DetectedAgent = { ...agent, installed: true };
    const index = draft.detected.findIndex((item) => item.id === agent.id);
    if (index >= 0) draft.detected[index] = detected;
    else draft.detected.push(detected);
    this.redraw();
  }

  private agentRows(): SettingRow[] {
    const draft = this.agentDraftState();
    if (!draft) return [];
    const rows: SettingRow[] = [
      { name: t('Local agents'), render: (setting) => {
        setting
          .setDesc(t('Uses a local CLI login and model. The place name is sent to that service. Paths, arguments, and the default agent are stored only on this device.'))
          .setHeading();
      } },
    ];

    for (const agent of draft.agents) {
      const detected = draft.detected.find((item) => item.id === agent.id);
      const suffix = detected?.installed ? t('Detected') : t('Not detected');
      const isDefault = agent.id === draft.defaultId;
      rows.push({ name: `${agent.name} · ${suffix}`, render: (setting) => {
        setting
          .addButton((button) =>
            button
              .setButtonText(t('Set as default'))
              .setDisabled(isDefault)
              .onClick(() => {
                draft.defaultId = agent.id;
                this.redraw();
              }),
          )
          .addButton((button) =>
            button
              .setButtonText(t('Test'))
              .onClick(() => void this.testAgent(agent, button)),
          );
      } });
      rows.push({ name: t('Executable name or absolute path'), render: (setting) => {
        setting.setDesc(agent.name).addText((text) =>
          text.setValue(agent.command).onChange((value) => {
            agent.command = value;
          }),
        );
      } });
      rows.push({ name: t('{name} arguments', { name: agent.name }), render: (setting) => {
        setting
          .setDesc(t('Full launch arguments, separated by spaces with quote support; no shell is used. Keep the built-in non-interactive and output-format arguments.'))
          .addText((text) =>
            text.setValue(agent.args).onChange((value) => {
              agent.args = value;
            }),
          );
      } });
      if (agent.kind === 'custom') {
        rows.push({ name: t('Display name'), render: (setting) => {
          setting.addText((text) =>
            text.setValue(agent.name).onChange((value) => {
              agent.name = value;
            }),
          );
        } });
        rows.push({ name: t('Remove custom agent'), render: (setting) => {
          setting.addButton((button) =>
            button.setButtonText(t('Remove custom agent')).onClick(() => {
              draft.agents = draft.agents.filter((item) => item.id !== agent.id);
              if (draft.defaultId === agent.id) draft.defaultId = draft.agents[0]?.id ?? '';
              this.redraw();
            }),
          );
        } });
      }
    }

    rows.push({ name: t('Apply local settings'), render: (setting) => {
      setting.addButton((button) =>
        button
          .setButtonText(t('Apply local settings'))
          .setCta()
          .onClick(() => this.applyAgentDraft()),
      );
    } });
    rows.push({ name: t('Detect saved configurations again'), render: (setting) => {
      setting.addButton((button) =>
        button
          .setButtonText(t('Detect saved configurations again'))
          .onClick(() => void this.detectAgents(button)),
      );
    } });
    rows.push({ name: t('Add custom CLI'), render: (setting) => {
      setting.addButton((button) =>
        button.setButtonText(t('Add custom CLI')).onClick(() => {
          draft.agents.push({
            id: `custom-${Date.now()}`,
            kind: 'custom',
            name: t('Custom CLI'),
            command: '',
            args: '',
          });
          this.redraw();
        }),
      );
    } });
    return rows;
  }

  private applyAgentDraft(): void {
    const controller = this.plugin.agentController;
    const draft = this.agentDraftState();
    if (!controller || !draft) return;
    try {
      for (const agent of draft.agents) {
        if (!agent.command.trim()) throw new Error(t('Executable cannot be empty'));
        parseArguments(agent.args);
      }
      if (!draft.agents.some((agent) => agent.id === draft.defaultId)) {
        throw new Error(t('Choose a default agent'));
      }
      controller.saveLocal(structuredClone(draft));
      new Notice(t('Local settings saved'));
    } catch (error) {
      new Notice(translateMessage(error instanceof Error ? error.message : String(error)));
    }
  }

  private async detectAgents(button: ButtonComponent): Promise<void> {
    button.setDisabled(true);
    try {
      await this.runDetection();
      new Notice(t('Detection complete; unsaved path and argument drafts were not checked'));
    } catch (error) {
      new Notice(translateMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      button.setDisabled(false);
    }
  }

  private async testAgent(agent: AgentConfig, button: ButtonComponent): Promise<void> {
    const controller = this.plugin.agentController;
    if (!controller) return;
    const abort = new AbortController();
    this.agentTests.add(abort);
    button.setDisabled(true);
    try {
      parseArguments(agent.args);
      const answer = await controller.test({ ...agent }, abort.signal);
      this.markDetected(agent);
      new Notice(t('Test succeeded: {answer}', { answer: answer.slice(0, 120) }));
    } catch (error) {
      new Notice(translateMessage(error instanceof Error ? error.message : String(error)));
    } finally {
      this.agentTests.delete(abort);
      button.setDisabled(false);
    }
  }

  private number(
    text: TextComponent,
    value: number | undefined,
    update: (value: number | undefined) => void,
  ): void {
    text.inputEl.type = 'number';
    text.setValue(value === undefined ? '' : String(value));
    text.onChange((raw) => update(parseNumber(raw)));
  }

  private patch(patch: Partial<StoryMapPluginSettings>): void {
    this.plugin.settings = { ...this.plugin.settings, ...patch };
    void this.plugin.saveSettings();
  }
}

function trimOrUndefined(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toOrder(value: string): StoryOrder | undefined {
  return value === 'asc' || value === 'desc' ? value : undefined;
}

function toNoteDisplay(value: string): StoryNoteDisplay | undefined {
  return value === 'basic' || value === 'link' || value === 'full' ? value : undefined;
}

function toMapTheme(value: string): StoryMapTheme | undefined {
  return value === 'auto' || value === 'light' || value === 'dark' || value === 'vintage' || value === 'cyber' || value === 'atlas'
    ? value : undefined;
}

function toInitialSlide(value: string): StoryInitialSlide | undefined {
  return value === 'first' || value === 'last' ? value : undefined;
}
