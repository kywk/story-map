import { Modal, Notice, type App, type TFile } from 'obsidian';
import type { CircleMarker, Map as LeafletMap } from 'leaflet';
import {
  DEFAULT_TILE_ATTRIBUTION as CORE_TILE_ATTRIBUTION,
  DEFAULT_TILE_URL as CORE_TILE_URL,
} from '@story-map/story-map-core';
import { formatLocationLine, type CoordinateCandidate } from './coordinates.js';
import { t, translateMessage } from './i18n.js';
import type StoryMapPlugin from './main.js';

// The AI lookup mini-map reuses the shared built-in tile source so the picker and a
// rendered map never disagree about which provider the plugin ships with.
export const DEFAULT_TILE_URL = CORE_TILE_URL;
export const DEFAULT_TILE_ATTRIBUTION = CORE_TILE_ATTRIBUTION;

class LocationQueryModal extends Modal {
  private settled = false;

  constructor(app: App, private readonly resolve: (value: string | null) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t('Find coordinates with AI'));
    this.contentEl.createEl('p', {
      text: t('Enter a place name. Chinese and other languages are supported.'),
    });
    const input = this.contentEl.createEl('input', {
      type: 'text',
      cls: 'geo-story-map-coordinate-input',
      attr: { 'aria-label': t('Location') },
    });
    input.focus();

    const submit = (): void => {
      const value = input.value.trim();
      if (!value) {
        input.focus();
        return;
      }
      this.finish(value);
    };
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });

    const buttons = this.contentEl.createDiv({ cls: 'geo-story-map-modal-buttons' });
    const search = buttons.createEl('button', { text: t('Search'), cls: 'mod-cta' });
    search.addEventListener('click', submit);
    const cancel = buttons.createEl('button', { text: t('Cancel') });
    cancel.addEventListener('click', () => this.finish(null));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.settled) this.resolve(null);
  }

  private finish(value: string | null): void {
    this.settled = true;
    this.resolve(value);
    this.close();
  }
}

export function promptLocation(app: App): Promise<string | null> {
  return new Promise((resolve) => new LocationQueryModal(app, resolve).open());
}

export interface CoordinatePickerOptions {
  candidates: CoordinateCandidate[];
  tileUrl: string;
  attribution: string;
  onApply: (lat: number, lng: number, mapmarker: string | undefined) => Promise<void>;
}

class CoordinatePickerModal extends Modal {
  private readonly markers: CircleMarker[] = [];
  private readonly items: HTMLElement[] = [];
  private map: LeafletMap | null = null;
  private mapEl: HTMLElement | null = null;
  private markerInput: HTMLInputElement | null = null;
  private applyButton: HTMLButtonElement | null = null;
  private copyButton: HTMLButtonElement | null = null;
  private selected = -1;
  private disposed = false;

  constructor(app: App, private readonly options: CoordinatePickerOptions) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText(t('Choose a place'));
    this.mapEl = this.contentEl.createDiv({ cls: 'geo-story-map-coordinate-map' });
    const list = this.contentEl.createDiv({ cls: 'geo-story-map-coordinate-list' });
    this.options.candidates.forEach((candidate, index) => {
      const item = list.createDiv({
        cls: 'geo-story-map-coordinate-item',
        attr: { role: 'button', tabindex: '0' },
      });
      item.createDiv({ cls: 'geo-story-map-coordinate-name', text: candidate.name });
      if (candidate.detail) {
        item.createDiv({ cls: 'geo-story-map-coordinate-detail', text: candidate.detail });
      }
      item.createDiv({
        cls: 'geo-story-map-coordinate-coords',
        text: `${candidate.lat}, ${candidate.lng}`,
      });
      item.addEventListener('click', () => this.select(index));
      item.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          this.select(index);
        }
      });
      this.items.push(item);
    });

    this.markerInput = this.contentEl.createEl('input', {
      type: 'text',
      cls: 'geo-story-map-marker-input',
      attr: { 'aria-label': t('mapmarker (leave empty to skip)') },
    });
    this.markerInput.placeholder = t('mapmarker (leave empty to skip)');

    const buttons = this.contentEl.createDiv({ cls: 'geo-story-map-modal-buttons' });
    this.applyButton = buttons.createEl('button', {
      text: t('Update/Add frontmatter'),
      cls: 'mod-cta',
    });
    this.applyButton.disabled = true;
    this.applyButton.addEventListener('click', () => void this.apply());
    this.copyButton = buttons.createEl('button', { text: t('Copy to clipboard') });
    this.copyButton.disabled = true;
    this.copyButton.addEventListener('click', () => void this.copy());
    const cancel = buttons.createEl('button', { text: t('Cancel') });
    cancel.addEventListener('click', () => this.close());

    void this.buildMap();
  }

  onClose(): void {
    this.disposed = true;
    this.map?.remove();
    this.map = null;
    this.markers.length = 0;
    this.items.length = 0;
    this.contentEl.empty();
  }

  private async buildMap(): Promise<void> {
    try {
      const L = await import('leaflet');
      if (this.disposed || !this.mapEl) return;
      const map = L.map(this.mapEl, { scrollWheelZoom: false });
      this.map = map;
      L.tileLayer(this.options.tileUrl, { attribution: this.options.attribution }).addTo(map);
      this.options.candidates.forEach((candidate, index) => {
        const marker = L.circleMarker([candidate.lat, candidate.lng], markerStyle(false));
        marker.bindTooltip(candidate.name);
        marker.on('click', () => this.select(index));
        marker.addTo(map);
        this.markers.push(marker);
      });
      this.fitBounds();
    } catch {
      // The list selection still works when the map cannot be created.
    }
    if (!this.disposed) this.select(0);
  }

  private fitBounds(): void {
    if (!this.map) return;
    const points = this.options.candidates.map(
      (candidate) => [candidate.lat, candidate.lng] as [number, number],
    );
    if (points.length > 1) {
      this.map.fitBounds(points, { padding: [30, 30], maxZoom: 12 });
    } else if (points[0]) {
      this.map.setView(points[0], 10);
    }
  }

  private select(index: number): void {
    const candidate = this.options.candidates[index];
    if (!candidate) return;
    this.selected = index;
    this.items.forEach((item, itemIndex) =>
      item.classList.toggle('is-selected', itemIndex === index),
    );
    this.markers.forEach((marker, markerIndex) =>
      marker.setStyle(markerStyle(markerIndex === index)),
    );
    this.map?.panTo([candidate.lat, candidate.lng]);
    if (this.markerInput) this.markerInput.value = candidate.mapmarker ?? '';
    if (this.applyButton) this.applyButton.disabled = false;
    if (this.copyButton) this.copyButton.disabled = false;
  }

  private async apply(): Promise<void> {
    const candidate = this.options.candidates[this.selected];
    if (!candidate || !this.applyButton) return;
    this.applyButton.disabled = true;
    const marker = this.markerInput?.value.trim();
    try {
      await this.options.onApply(candidate.lat, candidate.lng, marker || undefined);
      new Notice(t('Frontmatter updated'));
      this.close();
    } catch (error) {
      new Notice(translateMessage(error instanceof Error ? error.message : String(error)));
      this.applyButton.disabled = false;
    }
  }

  private async copy(): Promise<void> {
    const candidate = this.options.candidates[this.selected];
    if (!candidate) return;
    try {
      await navigator.clipboard.writeText(formatLocationLine(candidate.lat, candidate.lng));
      new Notice(t('Coordinates copied to clipboard'));
    } catch {
      new Notice(t('Could not copy to clipboard'));
    }
  }
}

function markerStyle(selected: boolean): Parameters<CircleMarker['setStyle']>[0] {
  return selected
    ? { radius: 9, color: '#1d4ed8', weight: 3, fillColor: '#3b82f6', fillOpacity: 0.6 }
    : { radius: 7, color: '#2563eb', weight: 2, fillColor: '#93c5fd', fillOpacity: 0.5 };
}

export async function startCoordinateLookup(plugin: StoryMapPlugin, file: TFile): Promise<void> {
  const query = await promptLocation(plugin.app);
  if (!query) return;

  const abort = new AbortController();
  const message = createFragment();
  message.append(createSpan({ text: `${t('Searching coordinates…')} ` }));
  const cancel = createEl('button', { text: t('Cancel') });
  cancel.addEventListener('click', () => abort.abort(), { once: true });
  message.append(cancel);
  const notice = new Notice(message, 0);

  try {
    const candidates = await plugin.agentController.lookupCoordinates(query, abort.signal);
    notice.hide();
    if (abort.signal.aborted) return;
    new CoordinatePickerModal(plugin.app, {
      candidates,
      tileUrl: plugin.settings.map.tiles?.light?.url?.trim() || DEFAULT_TILE_URL,
      attribution: plugin.settings.map.tiles?.light?.attribution?.trim() || DEFAULT_TILE_ATTRIBUTION,
      onApply: (lat, lng, mapmarker) =>
        plugin.app.fileManager.processFrontMatter(file, (frontmatter: Record<string, unknown>) => {
          frontmatter.location = [lat, lng];
          if (mapmarker) frontmatter.mapmarker = mapmarker;
        }),
    }).open();
  } catch (error) {
    notice.hide();
    if (!abort.signal.aborted) {
      new Notice(translateMessage(error instanceof Error ? error.message : String(error)));
    }
  }
}
