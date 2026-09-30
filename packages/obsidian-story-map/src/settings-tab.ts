import {
  Notice, PluginSettingTab, Setting, type App, type ButtonComponent, type TextComponent,
  type SettingDefinitionItem, type SettingDefinitionRender,
} from 'obsidian';
import type {
  MarkerTooltipDisplay,
  MarkerTypeDefinition,
  StoryInitialSlide,
  StoryMapTheme,
  StoryNoteDisplay,
  StoryOrder,
  TileSource,
} from '@story-map/story-map-core';
import { parseArguments, type AgentConfig, type DetectedAgent } from './agents.js';
import { t, translateMessage } from './i18n.js';
import type { LocalAgents } from './local-agents.js';
import type StoryMapPlugin from './main.js';
import {
  compact,
  defaultSettings,
  patchSettings,
  type SectionPatch,
  type StoryMapPluginSettings,
  type UnitSystem,
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

const TOOLTIP_OPTIONS: Array<[value: MarkerTooltipDisplay, label: string]> = [
  ['hover', 'On hover (default)'],
  ['always', 'Always visible'],
  ['never', 'Never'],
];

const UNIT_OPTIONS: Array<[value: UnitSystem, label: string]> = [
  ['metric', 'Metric (meters)'],
  ['imperial', 'Imperial (miles)'],
];

export class StoryMapSettingTab extends PluginSettingTab {
  private agentDraft: LocalAgents | null = null;
  private centerDraft: { lat?: number | undefined; lng?: number | undefined } | null = null;
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

  /**
   * The tab is grouped by what a setting actually affects, which is also the
   * defaulting boundary: `Story` and the zoom/theme/path keys are `story-map`
   * defaults, `Markers & interaction` configure the shared `<GeoMap />` surface,
   * the tile pair is the one provider configuration both dialects render, and
   * `Leaflet compatibility` never reaches a native StoryMap.
   */
  private settingRows(): SettingRow[] {
    const rows: SettingRow[] = [
      ...this.storyRows(),
      ...this.mapRows(),
      ...this.markerRows(),
      ...this.compatibilityRows(),
    ];
    if (this.plugin.agentController) rows.push(...this.agentRows());
    return rows;
  }

  private storyRows(): SettingRow[] {
    const story = this.plugin.settings.story;
    return [
      { name: 'Story', render: (setting) => {
        setting
          .setDesc(
            "Defaults for the keys a document's story-map block may omit: document value, then these settings, then the built-in default. Per-story values (title, noteFolder, map center, layout, slides) stay in the document.",
          )
          .setHeading();
      } },
      { name: 'Default order', render: (setting) => {
        setting
          .setDesc('Folder ordering direction. Built-in default: ascending.')
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(Object.fromEntries(ORDER_OPTIONS))
              .setValue(story.order ?? 'asc')
              .onChange((value) => this.patchStory({ order: toOrder(value) })),
          );
      } },
      { name: 'Default date field', render: (setting) => {
        setting
          .setDesc('Frontmatter field used for folder ordering. Built-in default: date-created.')
          .addText((text) =>
            text
              .setPlaceholder('date-created')
              .setValue(story.dateField ?? '')
              .onChange((value) => this.patchStory({ dateField: trimOrUndefined(value) })),
          );
      } },
      { name: 'Default note display', render: (setting) => {
        setting
          .setDesc('How resolved notes are presented. Built-in default: link.')
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(Object.fromEntries(NOTE_DISPLAY_OPTIONS))
              .setValue(story.noteDisplay ?? 'link')
              .onChange((value) => this.patchStory({ noteDisplay: toNoteDisplay(value) })),
          );
      } },
      { name: 'Default initial slide', render: (setting) => {
        setting
          .setDesc('Slide to display when opening the story map. Built-in default: first.')
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(Object.fromEntries(INITIAL_SLIDE_OPTIONS))
              .setValue(story.initialSlide === 'last' ? 'last' : 'first')
              .onChange((value) => this.patchStory({ initialSlide: toInitialSlide(value) })),
          );
      } },
      { name: 'Default panel opacity', render: (setting) => {
        setting
          .setDesc('Article / card panel background opacity (0.0 to 1.0). Built-in default: 0.85.')
          .addText((text) => {
            text.inputEl.step = '0.05';
            text.inputEl.min = '0';
            text.inputEl.max = '1';
            text.setPlaceholder('0.85');
            this.number(text, story.panelOpacity, (value) => this.patchStory({ panelOpacity: clampOpacity(value) }));
          });
      } },
      { name: 'Restore defaults', render: (setting) => {
        setting
          .setDesc('Return every section to its built-in default.')
          .addButton((button) =>
            button
              .setButtonText('Restore defaults')
              .onClick(() => {
                this.plugin.settings = defaultSettings();
                this.centerDraft = null;
                void this.plugin.saveSettings();
                this.refreshSettings();
              }),
          );
      } },
    ];
  }

  private mapRows(): SettingRow[] {
    const map = this.plugin.settings.map;
    const light = map.tiles?.light ?? {};
    const dark = map.tiles?.dark;
    const patchTiles = (which: 'light' | 'dark', patch: SectionPatch<TileSource>): void => {
      const current = this.plugin.settings.map.tiles ?? {};
      this.patchMap({
        // Spreading the patch last lets an emptied field overwrite the stored value,
        // and `compact` then drops it, so clearing a field really removes the
        // override instead of leaving the previous URL in place.
        tiles: { ...current, [which]: compact({ ...(current[which] ?? {}), ...patch }) },
      });
    };
    const setDarkTilesEnabled = (enabled: boolean): void => {
      const current = this.plugin.settings.map.tiles ?? {};
      if (enabled) {
        this.patchMap({ tiles: { ...current, dark: current.dark ?? { url: '', attribution: '' } } });
        return;
      }
      if (current.dark === undefined) return;
      const { dark: _dropped, ...rest } = current;
      this.patchMap({ tiles: rest });
    };

    return [
      { name: 'Map', render: (setting) => {
        setting
          .setDesc('Presentation and tile provider defaults. A theme is visual and a tile provider is map data: a theme never replaces a configured tile URL.')
          .setHeading();
      } },
      { name: 'Default map theme', render: (setting) => {
        setting
          .setDesc('story-map documents only. Default: auto, which follows the Obsidian light/dark theme and colors.')
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(Object.fromEntries(MAP_THEME_OPTIONS))
              .setValue(map.theme ?? 'auto')
              .onChange((value) => this.patchMap({ theme: toMapTheme(value) })),
          );
      } },
      { name: 'Default zoom', render: (setting) => {
        setting
          .setDesc('story-map documents only.')
          .addText((text) => this.number(text, map.zoom, (value) => this.patchMap({ zoom: value })));
      } },
      { name: 'Default minimum zoom', render: (setting) => {
        setting
          .addText((text) => this.number(text, map.minZoom, (value) => this.patchMap({ minZoom: value })));
      } },
      { name: 'Default maximum zoom', render: (setting) => {
        setting
          .addText((text) => this.number(text, map.maxZoom, (value) => this.patchMap({ maxZoom: value })));
      } },
      { name: 'Default show path', render: (setting) => {
        setting
          .setDesc('Connect located slides with a polyline when a block does not set showPath.')
          .addToggle((toggle) =>
            toggle
              .setValue(map.showPath ?? true)
              .onChange((value) => this.patchMap({ showPath: value })),
          );
      } },
      { name: 'Light tile URL', render: (setting) => {
        setting
          .setDesc('Used by every map when no block sets its own tile source. Built-in default: OpenStreetMap standard tiles.')
          .addText((text) =>
            text
              .setPlaceholder('https://tile.openstreetmap.org/{z}/{x}/{y}.png')
              .setValue(light.url ?? '')
              .onChange((value) => patchTiles('light', { url: trimOrUndefined(value) })),
          );
      } },
      { name: 'Light tile attribution', render: (setting) => {
        setting
          .setDesc('Shown on the map and required by most tile usage policies.')
          .addText((text) =>
            text
              .setPlaceholder('© OpenStreetMap contributors')
              .setValue(light.attribution ?? '')
              .onChange((value) => patchTiles('light', { attribution: trimOrUndefined(value) })),
          );
      } },
      { name: 'Light tile subdomains', render: (setting) => {
        setting
          .setDesc('Comma-separated values for a {s} tile URL.')
          .addText((text) =>
            text
              .setValue(formatSubdomains(light.subdomains))
              .onChange((value) => patchTiles('light', { subdomains: parseSubdomains(value) })),
          );
      } },
      { name: 'Use separate dark tiles', render: (setting) => {
        setting
          .setDesc('Keep a second tile source for dark mode. Off by default.')
          .addToggle((toggle) =>
            toggle
              .setValue(dark !== undefined)
              .onChange(setDarkTilesEnabled),
          );
      } },
      { name: 'Dark tile URL', render: (setting) => {
        setting
          .addText((text) =>
            text
              .setValue(dark?.url ?? '')
              .onChange((value) => patchTiles('dark', { url: trimOrUndefined(value) })),
          );
      } },
      { name: 'Dark tile attribution', render: (setting) => {
        setting
          .addText((text) =>
            text
              .setValue(dark?.attribution ?? '')
              .onChange((value) => patchTiles('dark', { attribution: trimOrUndefined(value) })),
          );
      } },
      { name: 'Dark tile subdomains', render: (setting) => {
        setting
          .addText((text) =>
            text
              .setValue(formatSubdomains(dark?.subdomains))
              .onChange((value) => patchTiles('dark', { subdomains: parseSubdomains(value) })),
          );
      } },
    ];
  }

  private markerRows(): SettingRow[] {
    const { markers, interaction } = this.plugin.settings;
    const rows: SettingRow[] = [
      { name: 'Markers & interaction', render: (setting) => {
        setting
          .setDesc('Applies to inline leaflet blocks. A story-map document renders its own slides and never uses the marker registry.')
          .setHeading();
      } },
      { name: 'Default marker type', render: (setting) => {
        setting
          .setDesc('Used when a note has no mapmarker and no tag matches a marker type.')
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(Object.fromEntries(markerTypeOptions(markers.types, markers.defaultType)))
              .setValue(markers.defaultType)
              .onChange((value) => this.patchMarkers({ defaultType: value })),
          );
      } },
      { name: 'Default marker tooltip', render: (setting) => {
        setting
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(Object.fromEntries(TOOLTIP_OPTIONS))
              .setValue(markers.tooltip)
              .onChange((value) => this.patchMarkers({ tooltip: toTooltip(value) })),
          );
      } },
      { name: 'Preview linked note on hover', render: (setting) => {
        setting
          .setDesc('Show the Obsidian page preview when hovering a linked note title or marker link.')
          .addToggle((toggle) =>
            toggle
              .setValue(interaction.notePreview)
              .onChange((value) => this.patchInteraction({ notePreview: value })),
          );
      } },
      { name: 'Copy location on Shift-click', render: (setting) => {
        setting
          .setDesc('Shift-click a marker to copy its location: [lat, lng] line, ready to paste into note frontmatter.')
          .addToggle((toggle) =>
            toggle
              .setValue(interaction.copyCoordinatesOnShiftClick)
              .onChange((value) => this.patchInteraction({ copyCoordinatesOnShiftClick: value })),
          );
      } },
    ];

    for (const type of markers.types) {
      rows.push({
        name: t('Marker type: {id}', { id: type.id }),
        render: (setting) => {
          setting
            .setDesc('A portable symbol or image URL, a color, and optional zoom bounds. Font Awesome names are not supported.')
            .addText((text) =>
              text
                .setPlaceholder('icon symbol or image URL')
                .setValue(iconValue(type))
                .onChange((value) => this.patchMarkerType(type, { icon: iconFromText(value) })),
            )
            .addText((text) =>
              text
                .setPlaceholder('color')
                .setValue(type.color ?? '')
                .onChange((value) => this.patchMarkerType(type, { color: trimOrUndefined(value) })),
            )
            .addText((text) => this.number(text, type.minZoom, (value) => this.patchMarkerType(type, { minZoom: value })))
            .addText((text) => this.number(text, type.maxZoom, (value) => this.patchMarkerType(type, { maxZoom: value })))
            .addButton((button) =>
              button
                .setButtonText(t('Remove marker type'))
                .onClick(() => this.removeMarkerType(type)),
            );
        },
      });
    }

    rows.push({ name: 'Add marker type', render: (setting) => {
      setting
        .setDesc('Adds a marker type by name; edit its symbol, color, and zoom bounds on the row it creates.')
        .addButton((button) =>
          button
            .setButtonText(t('Add marker type'))
            .setCta()
            .onClick(() => {
              const types = [...this.plugin.settings.markers.types, { id: nextMarkerTypeId(this.plugin.settings.markers.types) }];
              this.patchMarkers({ types });
            }),
        );
    } });

    return rows;
  }

  private compatibilityRows(): SettingRow[] {
    const compat = this.plugin.settings.leafletCompatibility;
    const centerDraft = this.centerDraft ?? {};
    return [
      { name: 'Leaflet compatibility', render: (setting) => {
        setting
          .setDesc('Defaults that only ever apply to a legacy leaflet fenced block. They never reach a story-map document.')
          .setHeading();
      } },
      { name: 'Default latitude', render: (setting) => {
        setting
          .setDesc('Used when a leaflet block omits lat. Built-in default: 0.')
          .addText((text) => this.number(text, centerDraft.lat ?? compat.defaultCenter?.[0], (value) => this.patchCenterHalf('lat', value)));
      } },
      { name: 'Default longitude', render: (setting) => {
        setting
          .setDesc('Used when a leaflet block omits long. Built-in default: 0.')
          .addText((text) => this.number(text, centerDraft.lng ?? compat.defaultCenter?.[1], (value) => this.patchCenterHalf('lng', value)));
      } },
      { name: 'Default unit system', render: (setting) => {
        setting
          .setDesc('Carried for future measurement tooling. Nothing measures distances yet.')
          .addDropdown((dropdown) =>
            dropdown
              .addOptions(Object.fromEntries(UNIT_OPTIONS))
              .setValue(compat.unitSystem ?? 'metric')
              .onChange((value) => this.patchCompatibility({ unitSystem: toUnitSystem(value) })),
          );
      } },
      { name: 'Show compatibility warnings', render: (setting) => {
        setting
          .setDesc('List the recognized but unimplemented keys a leaflet block uses under the map, so nothing is silently ignored.')
          .addToggle((toggle) =>
            toggle
              .setValue(compat.diagnostics)
              .onChange((value) => this.patchCompatibility({ diagnostics: value })),
          );
      } },
      { name: t('Import settings from Obsidian Leaflet'), render: (setting) => {
        setting
          .setDesc(t('Reads the old plugin settings once, if they exist in this vault. Mutable markers, overlays, CSV data, and map-view state are not imported.'))
          .addButton((button) =>
            button
              .setButtonText(t('Import settings from Obsidian Leaflet'))
              .onClick(() => void this.plugin.importLeafletSettings()),
          );
      } },
    ];
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

  private patchStory(patch: SectionPatch<StoryMapPluginSettings['story']>): void {
    this.apply(patchSettings(this.plugin.settings, 'story', patch));
  }

  private patchMap(patch: SectionPatch<StoryMapPluginSettings['map']>): void {
    this.apply(patchSettings(this.plugin.settings, 'map', patch));
  }

  private patchMarkers(patch: SectionPatch<StoryMapPluginSettings['markers']>): void {
    this.apply(patchSettings(this.plugin.settings, 'markers', patch));
  }

  private patchInteraction(patch: SectionPatch<StoryMapPluginSettings['interaction']>): void {
    this.apply(patchSettings(this.plugin.settings, 'interaction', patch));
  }

  private patchCompatibility(patch: SectionPatch<StoryMapPluginSettings['leafletCompatibility']>): void {
    this.apply(patchSettings(this.plugin.settings, 'leafletCompatibility', patch));
  }

  /**
   * Immutably replace one type, keyed by its current id so a rename stays in
   * place. The patch is spread last so an emptied field drops the key instead of
   * storing an empty string.
   */
  private patchMarkerType(type: MarkerTypeDefinition, patch: SectionPatch<MarkerTypeDefinition>): void {
    const types = this.plugin.settings.markers.types.map((item) =>
      item.id === type.id ? (compact({ ...item, ...patch }) as MarkerTypeDefinition) : item,
    );
    this.patchMarkers({ types });
  }

  private removeMarkerType(type: MarkerTypeDefinition): void {
    const types = this.plugin.settings.markers.types.filter((item) => item.id !== type.id);
    const defaultType = this.plugin.settings.markers.defaultType === type.id ? 'default' : this.plugin.settings.markers.defaultType;
    this.patchMarkers({ types, defaultType });
    this.refreshSettings();
  }

  /**
   * A center needs both halves, so a half-typed value is kept as a draft and only
   * committed once the pair is complete. That way typing a latitude never silently
   * drops the saved longitude, or writes a center the author did not mean.
   */
  private patchCenterHalf(half: 'lat' | 'lng', value: number | undefined): void {
    const current = this.plugin.settings.leafletCompatibility.defaultCenter;
    const draft = this.centerDraft ?? { lat: current?.[0], lng: current?.[1] };
    const next = { ...draft, [half]: value };
    if (next.lat === undefined || next.lng === undefined) {
      this.centerDraft = next;
      return;
    }
    this.centerDraft = null;
    this.patchCompatibility({ defaultCenter: [next.lat, next.lng] });
  }

  private apply(settings: StoryMapPluginSettings): void {
    this.plugin.settings = settings;
    void this.plugin.saveSettings();
  }
}

function markerTypeOptions(
  types: readonly MarkerTypeDefinition[],
  current: string,
): Array<[string, string]> {
  const ids = ['default', ...types.map((type) => type.id)];
  if (!ids.includes(current)) ids.push(current);
  return [...new Set(ids)].map((id) => [id, id === current ? `${id} (current)` : id]);
}

function nextMarkerTypeId(types: readonly MarkerTypeDefinition[]): string {
  let index = types.length + 1;
  const taken = new Set(types.map((type) => type.id.toLowerCase()));
  while (taken.has(`type-${index}`)) index += 1;
  return `type-${index}`;
}

function iconValue(type: MarkerTypeDefinition): string {
  return type.icon?.value ?? '';
}

/** Text field to icon: an `http(s)://` or app URL is an image, anything else a symbol. */
function iconFromText(value: string): { kind: 'symbol' | 'image'; value: string } | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  return /^(https?:|app:|data:|\/)/i.test(trimmed)
    ? { kind: 'image', value: trimmed }
    : { kind: 'symbol', value: trimmed };
}

function formatSubdomains(value: string | string[] | undefined): string {
  if (value === undefined) return '';
  return Array.isArray(value) ? value.join(', ') : value;
}

function parseSubdomains(value: string): string[] | undefined {
  const list = value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length === 0 ? undefined : list;
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

function clampOpacity(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  return Math.max(0, Math.min(1, value));
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

function toTooltip(value: string): MarkerTooltipDisplay | undefined {
  return value === 'always' || value === 'hover' || value === 'never' ? value : undefined;
}

function toUnitSystem(value: string): UnitSystem | undefined {
  return value === 'metric' || value === 'imperial' ? value : undefined;
}
