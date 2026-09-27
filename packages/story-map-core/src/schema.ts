import { z } from 'zod';

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

const storyMapBaseSchema = z.object({
  schema: z.literal('storymap/v1').default('storymap/v1'),
  id: z.string().optional(),
  title: z.string().optional(),
  height: z.string().default('520px'),
  map: z.object({
    center: z.tuple([
      z.number().min(-90).max(90),
      z.number().min(-180).max(180),
    ]).optional(),
    zoom: z.number().min(0).max(24).default(6),
    minZoom: z.number().min(0).max(24).optional(),
    maxZoom: z.number().min(0).max(24).optional(),
    tileUrl: z.string().min(1).default('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'),
    attribution: z.string().default('© OpenStreetMap contributors'),
    showPath: z.boolean().default(true),
  }).default({
    zoom: 6,
    tileUrl: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    showPath: true,
  }),
});

export const storyMapSourceSchema = storyMapBaseSchema.extend({
  noteFolder: z.string().min(1).optional(),
  order: z.enum(['asc', 'desc']).default('asc'),
  dateField: z.string().min(1).default('date-created'),
  noteDisplay: z.enum(['basic', 'link', 'full']).default('link'),
  includeTags: z.array(z.string().min(1)).optional(),
  excludeTags: z.array(z.string().min(1)).optional(),
  slides: z.array(storySlideSchema).optional(),
});

export const storyMapSchema = storyMapBaseSchema.extend({
  slides: z.array(storySlideSchema).min(1),
});
