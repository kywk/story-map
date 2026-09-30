import type { GeoMapConfig, GeoMarker, MarkerTypeDefinition, StoryMapConfig, StorySlide } from '@story-map/story-map-core';
import type { Lang } from './i18n.js';

const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const IMAGE_BASE = 'https://commons.wikimedia.org/wiki/Special:FilePath/';

interface LocalizedText {
  title: string;
  text: string;
  caption?: string;
}

interface Spot {
  lat: number;
  lng: number;
  zoom: number;
  /** ISO `YYYY-MM-DD`, parsed as UTC midnight by `Date.parse` for the timeline layout. */
  date?: string;
  image?: string;
  en: LocalizedText;
  zh: LocalizedText;
}

export interface SiteExample {
  id: string;
  index: string;
  label: Record<Lang, string>;
  region: Record<Lang, string>;
  blurb: Record<Lang, string>;
  story: Record<Lang, StoryMapConfig>;
}

function mediaFor(spot: Spot, lang: Lang): StorySlide['media'] {
  if (!spot.image) return undefined;
  const caption = spot[lang].caption;
  return {
    type: 'image',
    src: `${IMAGE_BASE}${spot.image}?width=960`,
    alt: spot[lang].title,
    ...(caption ? { caption } : {}),
  };
}

function buildStory(
  title: Record<Lang, string>,
  map: { center: [number, number]; zoom: number; minZoom?: number; maxZoom?: number },
  spots: Spot[],
): Record<Lang, StoryMapConfig> {
  const make = (lang: Lang): StoryMapConfig => ({
    schema: 'storymap/v1',
    title: title[lang],
    height: '100%',
    panelOpacity: 0.85,
    map: {
      theme: 'light',
      center: map.center,
      zoom: map.zoom,
      ...(map.minZoom === undefined ? {} : { minZoom: map.minZoom }),
      ...(map.maxZoom === undefined ? {} : { maxZoom: map.maxZoom }),
      tileUrl: TILE_URL,
      attribution: ATTRIBUTION,
      showPath: true,
    },
    layout: { mode: 'card', card: { align: 'left' }, full: { side: 'left', contentRatio: 0.5 } },
    slides: spots.map((spot): StorySlide => {
      const media = mediaFor(spot, lang);
      return {
        title: spot[lang].title,
        text: spot[lang].text,
        location: { lat: spot.lat, lng: spot.lng, zoom: spot.zoom },
        ...(spot.date === undefined ? {} : { date: Date.parse(spot.date) }),
        ...(media ? { media } : {}),
      };
    }),
  });

  return { en: make('en'), zh: make('zh') };
}

const marathonSpots: Spot[] = [
  {
    lat: 35.6895,
    lng: 139.6917,
    zoom: 12,
    date: '2025-03-02',
    image: 'Tokyo_Marathon_2019_Runner_(32321717927).jpg',
    en: {
      title: 'Tokyo Marathon',
      text: '**2 March 2025 · Tokyo, Japan**\n\nThe season opener. The course starts beneath the Tokyo Metropolitan Government Building in Shinjuku, with runners setting off into the city.',
    },
    zh: {
      title: '東京馬拉松 · Tokyo Marathon',
      text: '**2025-03-02 · 日本東京**\n\n年度首站。起點位於新宿的東京都廳前，跑者由此展開穿越城市的旅程。',
    },
  },
  {
    lat: 42.3601,
    lng: -71.0589,
    zoom: 12,
    date: '2025-04-21',
    image: "Boston_Marathon_2019_Women's_pack.agr.jpg",
    en: {
      title: 'Boston Marathon',
      text: '**21 April 2025 · Boston, USA**\n\nThe oldest annual marathon in the world, run every Patriots Day from Hopkinton down into the city.',
    },
    zh: {
      title: '波士頓馬拉松 · Boston Marathon',
      text: '**2025-04-21 · 美國波士頓**\n\n全世界最古老的年度馬拉松，固定於愛國者日舉行，從霍普金頓一路跑進波士頓市區。',
    },
  },
  {
    lat: 51.5074,
    lng: -0.1278,
    zoom: 12,
    date: '2025-04-27',
    image: '2010_London_Marathon_II.jpg',
    en: {
      title: 'London Marathon',
      text: '**27 April 2025 · London, UK**\n\nFrom Greenwich along the Thames and through the city, finishing on the Mall below Buckingham Palace.',
    },
    zh: {
      title: '倫敦馬拉松 · London Marathon',
      text: '**2025-04-27 · 英國倫敦**\n\n從格林威治出發，沿泰晤士河穿越市區，終點在白金漢宮前的林蔭大道。',
    },
  },
  {
    lat: -33.8688,
    lng: 151.2093,
    zoom: 12,
    date: '2025-08-31',
    image: 'Sydney_Opera_House_and_Harbour_Bridge,_southeast_view_20230224_1.jpg',
    en: {
      title: 'Sydney Marathon',
      text: '**31 August 2025 · Sydney, Australia**\n\nThe seventh major, added in 2025, with a course that crosses the Harbour Bridge and passes the Opera House.',
    },
    zh: {
      title: '雪梨馬拉松 · Sydney Marathon',
      text: '**2025-08-31 · 澳洲雪梨**\n\n2025 年正式加入大滿貫行列的第七站，路線經過港灣大橋與雪梨歌劇院。',
    },
  },
  {
    lat: 52.52,
    lng: 13.405,
    zoom: 12,
    date: '2025-09-21',
    image: '1000_-_Ziel_Berlin_Marathon.jpg',
    en: {
      title: 'Berlin Marathon',
      text: '**21 September 2025 · Berlin, Germany**\n\nFamous for a flat, fast course that has produced many world records. Start and finish at the Brandenburg Gate.',
    },
    zh: {
      title: '柏林馬拉松 · Berlin Marathon',
      text: '**2025-09-21 · 德國柏林**\n\n以平坦快速聞名，多次締造世界紀錄。起終點都在布蘭登堡門。',
    },
  },
  {
    lat: 41.8781,
    lng: -87.6298,
    zoom: 12,
    date: '2025-10-12',
    image: 'Chicago_marathon_2019.jpg',
    en: {
      title: 'Chicago Marathon',
      text: '**12 October 2025 · Chicago, USA**\n\nA flat loop through 29 neighbourhoods, starting and finishing in Grant Park.',
    },
    zh: {
      title: '芝加哥馬拉松 · Chicago Marathon',
      text: '**2025-10-12 · 美國芝加哥**\n\n橫跨城市 29 個街區，路線平坦，起終點位於格蘭特公園。',
    },
  },
  {
    lat: 40.7128,
    lng: -74.006,
    zoom: 12,
    date: '2025-11-02',
    image: 'New_York_marathon_Verrazano_bridge.jpg',
    en: {
      title: 'New York City Marathon',
      text: '**2 November 2025 · New York, USA**\n\nThe season finale. From Staten Island through all five boroughs, ending in Central Park.',
    },
    zh: {
      title: '紐約市馬拉松 · New York City Marathon',
      text: '**2025-11-02 · 美國紐約**\n\n年度收官之戰。從史泰登島出發，穿越五個行政區，在中央公園畫下句點。',
    },
  },
];

const chileSpots: Spot[] = [
  {
    lat: -33.4489,
    lng: -70.6693,
    zoom: 12,
    date: '2026-01-15',
    image: 'Santiago_de_Chile.jpg',
    en: {
      title: 'Santiago',
      text: '**The journey begins here.**\n\nA capital ringed by the Andes, where the notes are first written and the route is set.',
    },
    zh: {
      title: '聖地牙哥',
      text: '**旅程從這裡開始。**\n\n被安地斯山環抱的首都，筆記在此寫下，路線由此展開。',
    },
  },
  {
    lat: -33.0472,
    lng: -71.6127,
    zoom: 13,
    date: '2026-01-18',
    image: 'Valparaiso,_Chile.jpg',
    en: {
      title: 'Valparaíso',
      text: 'Colour on forty-two hills above the Pacific. Funiculars, murals, and a port that never sits still.',
    },
    zh: {
      title: '瓦爾帕萊索',
      text: '太平洋岸四十二座山丘上的色彩。纜車、壁畫，與一座從不安靜的港城。',
    },
  },
  {
    lat: -22.9087,
    lng: -68.1997,
    zoom: 11,
    date: '2026-01-24',
    image: 'Atacama_Desert.jpg',
    en: {
      title: 'Atacama Desert',
      text: 'The driest place on earth. Salt flats, geysers, and a sky that makes the map feel small.',
    },
    zh: {
      title: '阿塔卡馬沙漠',
      text: '地表最乾之地。鹽湖、間歇泉，與一片讓人覺得地圖渺小的星空。',
    },
  },
  {
    lat: -50.9423,
    lng: -73.4068,
    zoom: 10,
    date: '2026-02-05',
    image: 'Torres_del_Paine,_Chile.jpg',
    en: {
      title: 'Torres del Paine',
      text: '**The far end of the road.**\n\nGranite towers, glacial lakes, and Patagonian wind. The last note closes the story.',
    },
    zh: {
      title: '百內國家公園',
      text: '**路的最盡頭。**\n\n花崗岩塔、冰蝕湖，與巴塔哥尼亞的風。最後一則筆記在此收尾。',
    },
  },
];

const taiwanSpots: Spot[] = [
  {
    lat: 25.033,
    lng: 121.5654,
    zoom: 12,
    date: '2026-04-02',
    image: 'Taipei_101_2019.jpg',
    en: {
      title: 'Taipei',
      text: '**Day one.**\n\nStart in the basin: night markets, the 101, and the first marker on the route.',
    },
    zh: {
      title: '台北',
      text: '**第一天。**\n\n從盆地出發：夜市、101，與路線上第一個標記。',
    },
  },
  {
    lat: 24.1587,
    lng: 121.6219,
    zoom: 11,
    date: '2026-04-03',
    image: 'Taroko_Gorge.jpg',
    en: {
      title: 'Taroko Gorge',
      text: 'Marble walls cut by the Liwu River. The road narrows and the story turns inland.',
    },
    zh: {
      title: '太魯閣峽谷',
      text: '立霧溪切開的大理石峽谷。道路收窄，故事轉進山裡。',
    },
  },
  {
    lat: 21.9458,
    lng: 120.7985,
    zoom: 11,
    date: '2026-04-06',
    image: 'Kenting_National_Park.jpg',
    en: {
      title: 'Kenting',
      text: '**The southern tip.**\n\nCoral reefs and warm water where the island runs out of land.',
    },
    zh: {
      title: '墾丁',
      text: '**島嶼南端。**\n\n珊瑚礁與溫暖海水，陸地在這裡用完。',
    },
  },
];

export const examples: SiteExample[] = [
  {
    id: 'marathon',
    index: '01',
    label: { en: 'World Marathon Majors', zh: '世界七大馬拉松' },
    region: { en: 'Seven cities', zh: '七座城市' },
    blurb: {
      en: 'Seven races across four continents, ordered by race day.',
      zh: '橫跨四大洲的七場賽事，依比賽日排序。',
    },
    story: buildStory(
      { en: 'World Marathon Majors 2025', zh: '2025 世界七大馬拉松' },
      { center: [15, 30], zoom: 2, minZoom: 2, maxZoom: 18 },
      marathonSpots,
    ),
  },
  {
    id: 'chile',
    index: '02',
    label: { en: 'Chile, North to South', zh: '智利，由北到南' },
    region: { en: 'Patagonia to the desert', zh: '從沙漠到巴塔哥尼亞' },
    blurb: {
      en: 'Four notes from a folder, one long country.',
      zh: '一個資料夾裡的四則筆記，一個狹長國度。',
    },
    story: buildStory(
      { en: 'Chile, North to South', zh: '智利，由北到南' },
      { center: [-33.5, -71], zoom: 4, minZoom: 3, maxZoom: 18 },
      chileSpots,
    ),
  },
  {
    id: 'taiwan',
    index: '03',
    label: { en: 'Taiwan, End to End', zh: '台灣，從北到南' },
    region: { en: 'Taipei to Kenting', zh: '台北到墾丁' },
    blurb: {
      en: 'Three stops down the spine of the island.',
      zh: '沿著島嶼脊線南下的三站。',
    },
    story: buildStory(
      { en: 'Taiwan, End to End', zh: '台灣，從北到南' },
      { center: [23.7, 120.9], zoom: 7, minZoom: 6, maxZoom: 18 },
      taiwanSpots,
    ),
  },
];

/**
 * A plain map rather than a story: what a ` ```leaflet ` block produces.
 *
 * Markers read from a folder, with no slides, no panel and no narrative. The
 * geography is deliberately a city rather than an island: a legacy Leaflet map is
 * usually one town's worth of places, and a tight cluster is what proves the
 * folder actually produced markers rather than showing a mostly empty ocean.
 *
 * Three separate claims are on screen at the opening zoom, so none of them has
 * to be taken on trust. `food` and `shop` are registered types carrying a portable
 * symbol. `trail` is registered with a color but no icon, so it renders as a
 * plain colored circle. `landmark` is deliberately left unregistered, and its
 * marker draws the dashed fallback ring rather than disappearing. Separately,
 * `Xiangshan` carries a `mapzoom` floor, so it is absent until the reader zooms
 * past level 12.
 */
const legacyMarkers: Record<Lang, GeoMarker[]> = {
  en: [
    { location: { lat: 25.0338, lng: 121.5647 }, title: 'Din Tai Fung', type: 'food', notePath: '/notes/din-tai-fung' },
    { location: { lat: 25.0555, lng: 121.5097 }, title: 'Dihua Street', type: 'shop', notePath: '/notes/dihua-street' },
    { location: { lat: 25.0879, lng: 121.5257 }, title: 'Shilin Night Market', type: 'food' },
    { location: { lat: 25.0503, lng: 121.501 }, title: 'Bopiliao', type: 'landmark' },
    { location: { lat: 25.0305, lng: 121.52 }, title: 'Xiangshan Trailhead', type: 'trail', minZoom: 12 },
  ],
  zh: [
    { location: { lat: 25.0338, lng: 121.5647 }, title: '鼎泰豐', type: 'food', notePath: '/notes/din-tai-fung' },
    { location: { lat: 25.0555, lng: 121.5097 }, title: '迪化街', type: 'shop', notePath: '/notes/dihua-street' },
    { location: { lat: 25.0879, lng: 121.5257 }, title: '士林夜市', type: 'food' },
    { location: { lat: 25.0503, lng: 121.501 }, title: '剝皮寮', type: 'landmark' },
    { location: { lat: 25.0305, lng: 121.52 }, title: '象山登山口', type: 'trail', minZoom: 12 },
  ],
};

export function buildLegacyMap(lang: Lang): GeoMapConfig {
  return {
    schema: 'geomap/v1',
    height: '100%',
    map: {
      theme: 'light',
      center: [25.058, 121.543],
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
      tiles: { light: { url: TILE_URL, attribution: ATTRIBUTION } },
    },
    markers: legacyMarkers[lang],
  };
}

/**
 * The marker type registry a host configures. `landmark` is deliberately absent
 * from it, so that marker shows the real fallback for an unregistered type: it
 * still renders, as a dashed ring, with its authored name kept for diagnostics.
 */
export const legacyMarkerTypes: MarkerTypeDefinition[] = [
  { id: 'food', icon: { kind: 'symbol', value: '🍜' }, color: '#b6472b' },
  { id: 'shop', icon: { kind: 'symbol', value: '🏮' }, color: '#244e3f' },
  { id: 'trail', color: '#8a6d3b' },
];

