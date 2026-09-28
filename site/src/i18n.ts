export type Lang = 'en' | 'zh';

export interface Copy {
  meta: { title: string; description: string };
  nav: { overview: string; examples: string; syntax: string; start: string; github: string };
  langLabel: string;
  hero: {
    schema: string;
    title: string;
    lede: string;
    ctaPlugin: string;
    ctaNpm: string;
    ctaSpec: string;
    live: string;
    liveHint: string;
    facts: { value: string; label: string }[];
  };
  hosts: {
    heading: string;
    lede: string;
    flow: string[];
    items: { name: string; pkg: string; body: string; note?: string }[];
  };
  examples: {
    heading: string;
    lede: string;
    switchLabel: string;
    openLabel: string;
    slideCountLabel: string;
  };
  syntax: {
    heading: string;
    lede: string;
    document: { label: string; caption: string };
    note: { label: string; caption: string };
    points: string[];
  };
  start: {
    heading: string;
    lede: string;
    obsidian: { heading: string; steps: string[] };
    libraries: { heading: string; body: string };
    docusaurus: { heading: string; body: string };
    links: { spec: string; architecture: string; plugin: string; repository: string };
  };
  footer: { line: string; license: string };
}

const en: Copy = {
  meta: {
    title: 'Geo Story Map — Markdown notes as geographic stories',
    description:
      'StoryMap turns a fenced Markdown block and a folder of notes into an interactive, slide-by-slide geographic story across Obsidian, React, and Docusaurus.',
  },
  nav: {
    overview: 'Overview',
    examples: 'Examples',
    syntax: 'Syntax',
    start: 'Get started',
    github: 'GitHub',
  },
  langLabel: 'Language',
  hero: {
    schema: 'storymap/v1',
    title: 'Markdown notes, turned into geographic stories.',
    lede: 'Write a story as a fenced block inside a Markdown note. Drop in notes with coordinates. StoryMap resolves the same source into an Obsidian view, a React component, or a published Docusaurus page — one configuration, three hosts.',
    ctaPlugin: 'Install the Obsidian plugin',
    ctaNpm: 'Use the npm packages',
    ctaSpec: 'Read the spec',
    live: 'Live on this page',
    liveHint: 'Drag the map, then page through the stops with Next or the arrow keys.',
    facts: [
      { value: '1', label: 'configuration model' },
      { value: '3', label: 'hosts, same renderer' },
      { value: '0', label: 'database or account' },
    ],
  },
  hosts: {
    heading: 'One configuration, three hosts.',
    lede: 'Every host resolves its own world — files, routes, themes — into the same StoryMapConfig, then hands it to one shared renderer. Platform code never leaks into the component.',
    flow: ['Markdown', 'core parser', 'StoryMapConfig', 'react-story-map'],
    items: [
      {
        name: 'Obsidian',
        pkg: 'geo-story-map',
        body: 'A file-backed full-leaf view. A story-map document opens as a map by default; notes under noteFolder become slides ordered by date and filtered by includeTags/excludeTags, and Open as Markdown returns you to the editable source. A local CLI agent can look up coordinates on demand.',
        note: 'Desktop 1.8.7+',
      },
      {
        name: 'React',
        pkg: '@story-map/react-story-map',
        body: 'A StoryMap component that owns Leaflet, paged navigation, flyTo sync, and resize handling. It knows nothing about vaults, frontmatter files, or routes.',
        note: 'SSR-import-safe',
      },
      {
        name: 'Docusaurus',
        pkg: '@story-map/remark-story-map',
        body: 'A Remark transform at build time plus a small browser client. The same fences publish as static pages, with note links resolved by the host site.',
        note: 'Never builds Leaflet on the server',
      },
    ],
  },
  examples: {
    heading: 'Three stories, one renderer.',
    lede: 'Explore the live shared renderer. Choose a story, then switch among six map themes and card or full layouts.',
    switchLabel: 'Choose a story',
    openLabel: 'Open',
    slideCountLabel: 'stops',
  },
  syntax: {
    heading: 'The source is ordinary Markdown.',
    lede: 'A StoryMap document is a normal note with story-map frontmatter and one fenced configuration block. Story notes are normal notes with story-map-note and a location.',
    document: {
      label: 'Story document',
      caption: 'Frontmatter flags the file; the fence holds the configuration.',
    },
    note: {
      label: 'Story note',
      caption: 'Any note under noteFolder with a location can join the story.',
    },
    points: [
      'noteFolder recurses into subfolders and keeps notes marked story-map-note.',
      'order (asc or desc) and dateField control folder-generated slide order.',
      'includeTags and excludeTags keep or drop folder notes by their frontmatter tags.',
      'Explicit slides keep their exact order and are never reordered or appended.',
      'noteDisplay: basic, link, or full decides how much of each note reaches the slide.',
      'location, mapmarker, and mapzoom reuse the Leaflet metadata your notes already carry.',
    ],
  },
  start: {
    heading: 'Get started.',
    lede: 'Install the plugin for Obsidian, or pull the libraries into a React app or a Docusaurus site.',
    obsidian: {
      heading: 'Obsidian plugin',
      steps: [
        'Download main.js, manifest.json, and styles.css from the latest release.',
        "Put them in the plugins/geo-story-map/ folder inside your vault's configuration folder.",
        'Enable Geo Story Map in Settings, then Community plugins.',
        'Add story-map: true to a note and reopen it as a map.',
      ],
    },
    libraries: {
      heading: 'npm libraries',
      body: 'The core parser and the React renderer are published together; the Remark adapter follows the same version.',
    },
    docusaurus: {
      heading: 'Docusaurus / Remark',
      body: 'Register the plugin with a vaultRoot, an assetBase, and a resolveNoteHref callback so note links resolve to published routes.',
    },
    links: {
      spec: 'Specification',
      architecture: 'Architecture',
      plugin: 'Plugin guide',
      repository: 'Repository',
    },
  },
  footer: {
    line: 'StoryMap — a small, reusable Leaflet storytelling stack.',
    license: 'MIT licensed.',
  },
};

const zh: Copy = {
  meta: {
    title: 'Geo Story Map — 把 Markdown 筆記變成地理故事',
    description:
      'StoryMap 把一段 Markdown 圍欄設定與一整個資料夾的筆記，變成可逐頁瀏覽的互動地理故事，並同時支援 Obsidian、React 與 Docusaurus。',
  },
  nav: {
    overview: '概觀',
    examples: '範例',
    syntax: '語法',
    start: '開始使用',
    github: 'GitHub',
  },
  langLabel: '語言',
  hero: {
    schema: 'storymap/v1',
    title: '把 Markdown 筆記，變成地理故事。',
    lede: '在筆記裡寫一段圍欄設定，放入帶座標的筆記，StoryMap 就會把同一份來源，解析成 Obsidian 檢視、React 元件或發佈後的 Docusaurus 頁面——一份設定，三種載體。',
    ctaPlugin: '安裝 Obsidian 外掛',
    ctaNpm: '使用 npm 套件',
    ctaSpec: '閱讀規格',
    live: '本頁即時示範',
    liveHint: '拖曳地圖，再用「Next」或左右方向鍵逐站瀏覽。',
    facts: [
      { value: '1', label: '份設定模型' },
      { value: '3', label: '種載體共用渲染器' },
      { value: '0', label: '資料庫或帳號' },
    ],
  },
  hosts: {
    heading: '一份設定，三種載體。',
    lede: '每種載體各自解析自己的世界——檔案、路由、主題——再交給同一個共用渲染器。平台細節不會滲進元件。',
    flow: ['Markdown', 'core parser', 'StoryMapConfig', 'react-story-map'],
    items: [
      {
        name: 'Obsidian',
        pkg: 'geo-story-map',
        body: '以檔案為後盾的全葉檢視。story-map 文件預設以地圖開啟；noteFolder 底下的筆記依日期排序，並可用 includeTags／excludeTags 篩選成為每一站，「Open as Markdown」則回到可編輯的原始碼。也能用本機 CLI agent 即時查詢座標。',
        note: '桌面版 1.8.7+',
      },
      {
        name: 'React',
        pkg: '@story-map/react-story-map',
        body: '負責 Leaflet、分頁導覽、flyTo 同步與尺寸變化的 StoryMap 元件。它不認識 vault、frontmatter 檔案或路由。',
        note: 'SSR 匯入安全',
      },
      {
        name: 'Docusaurus',
        pkg: '@story-map/remark-story-map',
        body: '建置期的 Remark 轉換，加上一小段瀏覽器客戶端。同一段圍欄發佈成靜態頁面，筆記連結交由站台解析。',
        note: '伺服器端永不建立 Leaflet',
      },
    ],
  },
  examples: {
    heading: '三段故事，同一個渲染器。',
    lede: '直接操作共用渲染器：選擇故事，切換六種地圖主題與 card／full 版型。',
    switchLabel: '選擇故事',
    openLabel: '開啟',
    slideCountLabel: '站',
  },
  syntax: {
    heading: '來源就是一般的 Markdown。',
    lede: 'StoryMap 文件是帶有 story-map frontmatter 的一般筆記，內含一段圍欄設定。故事筆記則是帶有 story-map-note 與座標的一般筆記。',
    document: {
      label: '故事文件',
      caption: 'frontmatter 標記檔案；圍欄內是設定。',
    },
    note: {
      label: '故事筆記',
      caption: 'noteFolder 底下任何帶座標的筆記，都能加入故事。',
    },
    points: [
      'noteFolder 會遞迴子資料夾，保留標記 story-map-note 的筆記。',
      'order（asc 或 desc）與 dateField 決定資料夾產生幻燈片的順序。',
      'includeTags 與 excludeTags 依 frontmatter 標籤保留或排除資料夾筆記。',
      '明確列出的 slides 保持原順序，永不重排或附加。',
      'noteDisplay: basic、link 或 full 決定每一則筆記進入投影片的份量。',
      'location、mapmarker、mapzoom 沿用筆記既有的 Leaflet 中介資料。',
    ],
  },
  start: {
    heading: '開始使用。',
    lede: '在 Obsidian 安裝外掛，或把函式庫引進 React 應用與 Docusaurus 站台。',
    obsidian: {
      heading: 'Obsidian 外掛',
      steps: [
        '從最新 release 下載 main.js、manifest.json 與 styles.css。',
        '放進 vault 設定資料夾下的 plugins/geo-story-map/。',
        '在「設定 → 第三方外掛」啟用 Geo Story Map。',
        '在筆記加入 story-map: true，重新開啟即可作為地圖檢視。',
      ],
    },
    libraries: {
      heading: 'npm 函式庫',
      body: '核心解析器與 React 渲染器一起發佈；Remark 轉接器版本一致。',
    },
    docusaurus: {
      heading: 'Docusaurus / Remark',
      body: '註冊外掛時提供 vaultRoot、assetBase 與 resolveNoteHref 回呼，筆記連結就能解析成發佈後的路由。',
    },
    links: {
      spec: '規格',
      architecture: '架構',
      plugin: '外掛指南',
      repository: '原始碼',
    },
  },
  footer: {
    line: 'StoryMap — 一套小巧、可重用的 Leaflet 說故事工具。',
    license: 'MIT 授權。',
  },
};

export const copy: Record<Lang, Copy> = { en, zh };

export function detectLang(): Lang {
  if (typeof navigator === 'undefined') return 'en';
  const languages = [navigator.language, ...(navigator.languages ?? [])];
  return languages.some((value) => value.toLowerCase().startsWith('zh')) ? 'zh' : 'en';
}

export function initialLang(): Lang {
  if (typeof window !== 'undefined') {
    const param = new URLSearchParams(window.location.search).get('lang');
    if (param) {
      const lower = param.toLowerCase();
      if (lower.startsWith('zh')) return 'zh';
      if (lower.startsWith('en')) return 'en';
    }
  }
  return detectLang();
}
