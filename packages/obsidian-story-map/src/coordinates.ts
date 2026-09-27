import { validCoordinates } from '@story-map/story-map-core';
import { t } from './i18n.js';

export interface CoordinateCandidate {
  name: string;
  detail?: string;
  lat: number;
  lng: number;
  mapmarker?: string;
}

export const MAX_COORDINATE_CANDIDATES = 5;

export function coordinateLookupPrompt(): string {
  return [
    'You are a geocoding assistant. The query may be written in Chinese or any other language.',
    `Return up to ${MAX_COORDINATE_CANDIDATES} of the most likely matching places as a JSON array.`,
    'Each item must contain:',
    '- "name": the place name in the same language as the query, including country or administrative area;',
    '- "detail": a short disambiguating note (use Traditional Chinese when the query is Chinese);',
    '- "lat": latitude as a number in WGS84;',
    '- "lng": longitude as a number in WGS84;',
    '- "mapmarker": one short marker category such as city, town, village, landmark, mountain, lake, river, building.',
    'Use accurate coordinates and order the candidates from most to least likely.',
    'Output only the JSON array, with no surrounding text and no code fence.',
  ].join('\n');
}

export function parseCoordinateCandidates(output: string): CoordinateCandidate[] {
  const text = stripCodeFence(output);
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end < start) {
    throw new Error(t('The AI did not return valid coordinates.'));
  }

  let value: unknown;
  try {
    value = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error(t('The AI did not return valid coordinates.'));
  }
  if (!Array.isArray(value)) throw new Error(t('The AI did not return valid coordinates.'));

  const candidates: CoordinateCandidate[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const candidate = coerceCandidate(item);
    if (!candidate) continue;
    const key = `${candidate.lat.toFixed(4)},${candidate.lng.toFixed(4)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push(candidate);
    if (candidates.length >= MAX_COORDINATE_CANDIDATES) break;
  }
  if (candidates.length === 0) throw new Error(t('The AI did not return valid coordinates.'));
  return candidates;
}

export function formatLocationLine(lat: number, lng: number): string {
  return `location: [${formatNumber(lat)}, ${formatNumber(lng)}]`;
}

function coerceCandidate(value: unknown): CoordinateCandidate | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === 'string' ? record.name.trim() : '';
  if (!name || name.length > 200) return undefined;

  const lat = toNumber(record.lat);
  const lng = toNumber(record.lng);
  if (!validCoordinates(lat, lng)) return undefined;

  const detail = typeof record.detail === 'string' ? record.detail.trim() : '';
  const marker = typeof record.mapmarker === 'string' ? record.mapmarker.trim() : '';
  return {
    name,
    ...(detail ? { detail: detail.slice(0, 300) } : {}),
    lat,
    lng,
    ...(marker && !/[\r\n]/.test(marker) ? { mapmarker: marker.slice(0, 40) } : {}),
  };
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) return Number(value);
  return Number.NaN;
}

function stripCodeFence(output: string): string {
  return output.trim().replace(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i, '$1');
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(6)));
}
