export type LatLngTuple = [lat: number, lng: number];

export interface StoryLocation {
  lat: number;
  lng: number;
  zoom?: number;
}

export type StoryMediaType = 'image' | 'video' | 'iframe';

export interface StoryMedia {
  type: StoryMediaType;
  src: string;
  alt?: string;
  caption?: string;
}

export interface StorySlide {
  id?: string;
  note?: string;
  notePath?: string;
  title?: string;
  text?: string;
  location?: StoryLocation;
  media?: StoryMedia;
  mapmarker?: string;
}

export type StoryOrder = 'asc' | 'desc';

export const DEFAULT_STORY_ORDER: StoryOrder = 'asc';
export const DEFAULT_DATE_FIELD = 'date-created';

export type StoryNoteDisplay = 'basic' | 'link' | 'full';

export const DEFAULT_NOTE_DISPLAY: StoryNoteDisplay = 'link';

export type StoryInitialSlide = 'first' | 'last' | number;
export const DEFAULT_INITIAL_SLIDE: StoryInitialSlide = 'first';

export type StoryMapTheme = 'auto' | 'light' | 'dark' | 'vintage' | 'cyber' | 'atlas';
export const DEFAULT_MAP_THEME: StoryMapTheme = 'light';

export type StoryMapLayoutMode = 'card' | 'full';
export const DEFAULT_LAYOUT_MODE: StoryMapLayoutMode = 'card';
export const DEFAULT_CARD_ALIGN: StoryMapCardLayout['align'] = 'left';
export const DEFAULT_FULL_SIDE: StoryMapFullLayout['side'] = 'left';
export const DEFAULT_FULL_CONTENT_RATIO = 0.5;

export interface StoryMapCardLayout {
  align: 'left' | 'center' | 'right';
  widthRatio?: number;
  heightRatio?: number;
}

export interface StoryMapFullLayout {
  side: 'left' | 'right';
  contentRatio: number;
}

export interface StoryMapLayoutOptions {
  mode: StoryMapLayoutMode;
  card: StoryMapCardLayout;
  full: StoryMapFullLayout;
}

export interface StoryMapOptions {
  center?: LatLngTuple;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  theme: StoryMapTheme;
  tileUrl: string;
  attribution: string;
  showPath: boolean;
}

export interface StoryMapConfig {
  schema: 'storymap/v1';
  id?: string;
  title?: string;
  height: string;
  initialSlide?: number | undefined;
  map: StoryMapOptions;
  layout: StoryMapLayoutOptions;
  slides: StorySlide[];
}

export interface StoryMapSourceDefaults {
  order?: StoryOrder | undefined;
  dateField?: string | undefined;
  noteDisplay?: StoryNoteDisplay | undefined;
  initialSlide?: StoryInitialSlide | undefined;
  map?: Partial<Omit<StoryMapOptions, 'center'>> | undefined;
}

export interface StoryMapSourceConfig {
  schema: 'storymap/v1';
  id?: string;
  title?: string;
  height: string;
  noteFolder?: string;
  order: StoryOrder;
  dateField: string;
  noteDisplay: StoryNoteDisplay;
  initialSlide: StoryInitialSlide;
  includeTags?: string[];
  excludeTags?: string[];
  map: StoryMapOptions;
  layout: StoryMapLayoutOptions;
  slides?: StorySlide[];
}
