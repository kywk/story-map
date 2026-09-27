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

export interface StoryMapOptions {
  center?: LatLngTuple;
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
  tileUrl: string;
  attribution: string;
  showPath: boolean;
}

export interface StoryMapConfig {
  schema: 'storymap/v1';
  id?: string;
  title?: string;
  height: string;
  map: StoryMapOptions;
  slides: StorySlide[];
}

export interface StoryMapSourceDefaults {
  order?: StoryOrder | undefined;
  dateField?: string | undefined;
  noteDisplay?: StoryNoteDisplay | undefined;
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
  includeTags?: string[];
  excludeTags?: string[];
  map: StoryMapOptions;
  slides?: StorySlide[];
}
