import { Notice } from 'obsidian';
import { t, translateMessage } from './i18n.js';
import { importLegacyLeafletSettings, readLegacyLeafletSettings } from './leaflet-import.js';
import type StoryMapPlugin from './main.js';

/**
 * Optional, user-initiated import of the historical Obsidian Leaflet settings.
 *
 * The old plugin is never required: its `data.json` is read through the Vault
 * adapter only when the user asks, and the plugin keeps working when it is absent,
 * disabled, or uninstalled. When it is absent the user is told so rather than
 * having the current settings silently replaced by a partial import.
 */
export async function importObsidianLeafletSettings(plugin: StoryMapPlugin): Promise<void> {
  const data = await readLegacyLeafletSettings(plugin.app);
  if (!data) {
    new Notice(t('No saved Obsidian Leaflet settings were found in this vault.'));
    return;
  }

  const result = importLegacyLeafletSettings(plugin.getSettings(), data);
  if (result.imported.length === 0) {
    new Notice(t('No importable Obsidian Leaflet settings were found.'));
    return;
  }

  plugin.settings = result.settings;
  await plugin.saveSettings();
  new Notice(t('Imported Obsidian Leaflet settings: {items}', { items: result.imported.join(', ') }));

  for (const warning of result.warnings) {
    new Notice(translateMessage(warning), 0);
  }
}
