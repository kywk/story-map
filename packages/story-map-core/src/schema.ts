import { z } from 'zod';
import {
  DEFAULT_CARD_ALIGN,
  DEFAULT_FULL_CONTENT_RATIO,
  DEFAULT_FULL_SIDE,
  DEFAULT_INITIAL_SLIDE,
  DEFAULT_LAYOUT_MODE,
  DEFAULT_MAP_OPACITY,
  DEFAULT_MAP_THEME,
} from './types.js';

const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  zoom: z.number().min(0).max(24).optional(),
});

const mediaSchema = z.object({
  type: z.enum(['image', 'video', 'iframe']),
  src: z.string().min(1),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const storySlideSchema = z.object({
  id: z.string().optional(),
  note: z.string().optional(),
  notePath: z.string().optional(),
  title: z.string().optional(),
  text: z.string().optional(),
  location: locationSchema.optional(),
  media: mediaSchema.optional(),
  mapmarker: z.string().optional(),
});

const cardLayoutSchema = z.object({
  align: z.enum(['left', 'center', 'right']).default(DEFAULT_CARD_ALIGN),
  widthRatio: z.number().min(0.20).max(0.80).optional(),
  heightRatio: z.number().min(0.20).max(0.95).optional(),
});

const fullLayoutSchema = z.object({
  side: z.enum(['left', 'right']).default(DEFAULT_FULL_SIDE),
  contentRatio: z.number().min(0.30).max(0.70).default(DEFAULT_FULL_CONTENT_RATIO),
});

const defaultLayout = {
  mode: DEFAULT_LAYOUT_MODE,
  card: { align: DEFAULT_CARD_ALIGN },
  full: { side: DEFAULT_FULL_SIDE, contentRatio: DEFAULT_FULL_CONTENT_RATIO },
};

export const storyMapLayoutSchema = z.object({
  mode: z.enum(['card', 'full']).default(DEFAULT_LAYOUT_MODE),
  card: cardLayoutSchema.default({ align: DEFAULT_CARD_ALIGN }),
  full: fullLayoutSchema.default({
    side: DEFAULT_FULL_SIDE,
    contentRatio: DEFAULT_FULL_CONTENT_RATIO,
  }),
});

export const mapOpacitySchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed.endsWith('%')) {
      const num = parseFloat(trimmed.slice(0, -1));
      if (!Number.isNaN(num)) return num / 100;
    }
    const num = parseFloat(trimmed);
    if (!Number.isNaN(num)) return num;
  }
  return val;
}, z.number().min(0).max(1));

export const initialSlideSchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    const trimmed = val.trim().toLowerCase();
    if (trimmed === 'first' || trimmed === 'last') return trimmed;
    if (/^\d+$/.test(trimmed)) return parseInt(trimmed, 10);
  }
  return val;
}, z.union([z.enum(['first', 'last']), z.number().int().min(0)]));

const storyMapBaseSchema = z.object({
  schema: z.literal('storymap/v1').default('storymap/v1'),
  id: z.string().optional(),
  title: z.string().optional(),
  height: z.string().default('520px'),
  initialSlide: z.number().int().min(0).optional(),
  map: z.object({
    center: z.tuple([
      z.number().min(-90).max(90),
      z.number().min(-180).max(180),
    ]).optional(),
    zoom: z.number().min(0).max(24).default(6),
    minZoom: z.number().min(0).max(24).optional(),
    maxZoom: z.number().min(0).max(24).optional(),
    opacity: mapOpacitySchema.default(DEFAULT_MAP_OPACITY),
    theme: z.enum(['auto', 'light', 'dark', 'vintage', 'cyber', 'atlas']).default(DEFAULT_MAP_THEME),
    tileUrl: z.string().min(1).default('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
    attribution: z.string().default('© OpenStreetMap contributors'),
    showPath: z.boolean().default(true),
  }).default({
    zoom: 6,
    opacity: DEFAULT_MAP_OPACITY,
    theme: DEFAULT_MAP_THEME,
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    showPath: true,
  }),
  layout: storyMapLayoutSchema.default(defaultLayout),
});

export const storyMapSourceSchema = storyMapBaseSchema.extend({
  noteFolder: z.string().min(1).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
  dateField: z.string().min(1).default('date-created'),
  noteDisplay: z.enum(['basic', 'link', 'full']).default('link'),
  initialSlide: initialSlideSchema.default(DEFAULT_INITIAL_SLIDE),
  includeTags: z.array(z.string().min(1)).optional(),
  excludeTags: z.array(z.string().min(1)).optional(),
  slides: z.array(storySlideSchema).optional(),
});

export const storyMapSchema = storyMapBaseSchema.extend({
  slides: z.array(storySlideSchema).min(1),
});
