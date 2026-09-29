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
    syntax: 'Configuration',
    start: 'Get started',
    github: 'GitHub',
  },
  langLabel: 'Language',
  hero: {
    schema: 'storymap/v1',
    title: 'Markdown notes, turned into geographic stories.',
    lede: 'Turn your Markdown notes into a journey you can explore. Write in Obsidian, connect places on a map, and publish with React or Docusaurus.',
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
        body: 'Write in your vault. Open a note as a full-pane map, then return to Markdown whenever you want to edit.',
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
      caption: 'Mark each note with story-map-note: true and add its location.',
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
        'Open Settings → Community plugins → Browse in Obsidian.',
        'Search for Geo Story Map in the official community plugin directory.',
        'Select Install, then Enable.',
        'Copy both examples above into a story document and a note under Travel/Chile/Places. Reopen the story as a map.',
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
    syntax: '設定指南',
    start: '開始使用',
    github: 'GitHub',
  },
  langLabel: '語言',
  hero: {
    schema: 'storymap/v1',
    title: '把 Markdown 筆記，變成地理故事。',
    lede: '把 Markdown 筆記串成可以探索的旅程。在 Obsidian 寫下故事，用地圖連起每個地點，再透過 React 或 Docusaurus 分享。',
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
        body: '在 Vault 內寫作，以完整工作區分頁開啟故事地圖。需要編輯時，隨時切回 Markdown。',
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
      caption: '筆記需加上 story-map-note: true 標記與座標。',
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
        '在 Obsidian 開啟「設定 → 第三方外掛 → 瀏覽」。',
        '在官方社群外掛市集搜尋 Geo Story Map。',
        '選擇「安裝」，完成後按下「啟用」。',
        '複製上方兩份範例，建立故事文件，並在 Travel/Chile/Places 放入故事筆記。重新開啟故事文件即可顯示地圖。',
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

interface GuideCopy {
  headline: string; headlineEnd: string; tryDemo: string; demoLabel: string;
  sourceOwned: string; primaryNav: string; resources: string;
  featuresHeading: string; featuresLede: string;
  features: { title: string; body: string }[];
  demoNote: string; settingsHeading: string; precedence: string;
  tableHint: string; columns: string[]; settings: [string, string, string][]; documentOnly: string;
  clipboard: Record<'idle' | 'done' | 'error', string>;
  download: string; reactGuide: string; remarkGuide: string;
  faqHeading: string; faqLede: string; faq: { question: string; answer: string }[];
}

export const guideCopy: Record<Lang, GuideCopy> = {
  en: {
    headline: 'Every note.', headlineEnd: 'A place in your story.',
    tryDemo: 'Explore the live examples', demoLabel: 'Illustrative Taiwan journey',
    sourceOwned: 'Your notes stay Markdown.', primaryNav: 'Main navigation', resources: 'Resources',
    featuresHeading: 'Keep writing.\nLet the map connect it.',
    featuresLede: 'A travel journal, a collection of places, a story across cities. Start with the notes you already keep.',
    features: [
      { title: 'A folder becomes a story', body: 'Add coordinates and mark your notes. StoryMap finds them across subfolders, sorts them by date, and lets you include or exclude frontmatter tags.' },
      { title: 'A view for every kind of note', body: 'Show metadata, link back to the original, or read the full Markdown body. Switch between the map and your source in Obsidian.' },
      { title: 'Make the map feel like your story', body: 'Six built-in themes. A compact card or a full reading layout. Adjust alignment and proportions while the same map stays mounted.' },
      { title: 'Find a place with your local AI agent', body: 'On Obsidian desktop, use a configured CLI agent to suggest coordinates. Review the candidates on a map; only your confirmation writes a location to the active note.' },
    ],
    demoNote: 'Illustrative stories · live renderer · images and map tiles load from external services. Map navigation uses English labels.',
    settingsHeading: 'The settings, at a glance.',
    precedence: 'In Obsidian: a value in your document wins, then plugin settings, then built-in defaults. Remark uses document values and built-in defaults.',
    tableHint: 'On narrow screens, swipe the table sideways to read all three columns.',
    columns: ['Setting', 'Default / choices', 'What it does'],
    settings: [
      ['noteFolder', 'Vault-relative path', 'Find marked notes recursively in one folder. A non-empty slides list takes precedence and keeps your exact order.'],
      ['order · dateField', 'asc · date-created', 'Order folder notes by a frontmatter date; choose desc for newest first.'],
      ['includeTags · excludeTags', '[]', 'Match any listed frontmatter tag, ignoring case and leading #. Nested tags match exactly; exclude wins.'],
      ['noteDisplay', 'link · basic · full', 'link adds a title link; basic uses metadata; full uses the note body without frontmatter title or media. Full layout always uses full note display.'],
      ['map.theme', 'light · Obsidian: auto', 'auto follows the host. light, dark, vintage, cyber, and atlas are fixed palettes.'],
      ['panelOpacity', '0.85', 'Translucent article/card background opacity (0.0–1.0), allowing the map to show through behind the text.'],
      ['map.zoom · map.showPath', '6 · true', 'Set initial zoom and slide location path visibility. minZoom / maxZoom limit range.'],
      ['layout.mode', 'card · full', 'card overlays a compact panel; full provides a reading area beside the map.'],
      ['layout.card', 'align: left', 'align: left / center / right. Optional widthRatio: 0.20–0.80; heightRatio: 0.20–0.95.'],
      ['layout.full', 'side: left · contentRatio: 0.5', 'side: left / right. contentRatio: 0.30–0.70. Narrow screens stack the reading area vertically.'],
      ['height', '520px', 'Document height for web publishing. Obsidian fills its workspace pane at 100%.'],
      ['map.tileUrl · map.attribution', 'OpenStreetMap', 'Use another compatible tile provider and supply its attribution.'],
    ],
    documentOnly: 'Folder, tags, center, layout, slides, height, title, id, and schema belong in the document, not plugin defaults. Local AI agent settings stay on this device.',
    clipboard: { idle: 'Copy source', done: 'Copied', error: 'Select and copy manually' },
    download: 'Get it from the plugin directory', reactGuide: 'Complete React example', remarkGuide: 'Docusaurus setup & browser client',
    faqHeading: 'Before you begin.', faqLede: 'A few practical details about the way StoryMap works.',
    faq: [
      { question: 'Do I need a StoryMap account?', answer: 'No StoryMap account or database is required. Your source stays in Markdown files. Map tiles and example images use external providers, so the demo needs a network connection.' },
      { question: 'Does it work on Obsidian mobile?', answer: 'The Obsidian plugin is desktop-only and requires Obsidian 1.8.7 or later. Published web stories and this demo adapt to narrow browser screens.' },
      { question: 'Can I choose the slide order myself?', answer: 'Yes. Supply an explicit, non-empty slides list. That list preserves your order and ignores noteFolder. Date ordering and tag filters apply to folder discovery.' },
      { question: 'Will my Obsidian links work on the web?', answer: 'Title links use Obsidian navigation in the vault. For Docusaurus, configure resolveNoteHref using your site’s routes. WikiLink and embed expansion inside full note bodies is not included.' },
      { question: 'How do I publish a story?', answer: 'Use the Remark adapter with Docusaurus and register its browser client. It resolves notes during the build; Leaflet starts only in the browser. The linked setup guide includes the required configuration and stylesheets.' },
    ],
  },
  zh: {
    headline: '每一則筆記，', headlineEnd: '都有故事的座標。',
    tryDemo: '探索互動範例', demoLabel: '台灣旅程示範', sourceOwned: '筆記，依然是你的 Markdown。',
    primaryNav: '主要導覽', resources: '相關資源',
    featuresHeading: '繼續寫筆記，\n讓地圖串起故事。',
    featuresLede: '一段旅行、一份地點收藏，或橫跨城市的故事。從你原本就在寫的筆記開始。',
    features: [
      { title: '一個資料夾，就是一段故事', body: '加上座標、標記筆記，StoryMap 就會從資料夾與子資料夾中找出內容，依日期排序，並支援用 frontmatter 標籤篩選或排除。' },
      { title: '用適合的方式閱讀筆記', body: '只呈現中繼資料、連回原始筆記，或閱讀完整 Markdown 內文。在 Obsidian 隨時切換地圖與原始碼檢視。' },
      { title: '讓地圖也有故事的個性', body: '六種內建主題，搭配精簡卡片或完整閱讀版型。調整位置與比例時，地圖仍維持同一個實例。' },
      { title: '讓本機 AI agent 協助找座標', body: '在 Obsidian 桌面版設定 CLI agent，即可取得座標建議。先在地圖確認候選地點，按下確認後才會寫入目前筆記。' },
    ],
    demoNote: '示範故事 · 真實互動元件 · 圖片與地圖圖磚由外部服務載入。地圖導覽按鈕使用英文。',
    settingsHeading: '常用設定，一次看懂。',
    precedence: 'Obsidian 的套用順序：文件設定 → 外掛設定 → 內建預設值。Remark 使用文件設定與內建預設值。',
    tableHint: '窄螢幕可左右滑動表格，查看完整三欄資訊。',
    columns: ['設定', '預設值／選項', '用途'],
    settings: [
      ['noteFolder', 'Vault 相對路徑', '遞迴讀取單一資料夾中已標記的筆記。若 slides 有內容，優先使用該清單並保留原順序。'],
      ['order · dateField', 'asc · date-created', '依 frontmatter 日期排序；改為 desc 即可讓最新筆記排在前面。'],
      ['includeTags · excludeTags', '[]', '比對任一 frontmatter 標籤，忽略大小寫與前置 #。巢狀標籤須完全相符；排除條件優先。'],
      ['noteDisplay', 'link · basic · full', 'link 加入標題連結；basic 顯示中繼資料；full 使用筆記內文，不帶入 frontmatter 標題與媒體。full 版型一律使用完整內文。'],
      ['map.theme', 'light · Obsidian: auto', 'auto 跟隨宿主配色；light、dark、vintage、cyber、atlas 使用固定配色。'],
      ['panelOpacity', '0.85', '卡片／文章背景透明度（0.0–1.0），可透出後方的底圖細節。'],
      ['map.zoom · map.showPath', '6 · true', '設定初始縮放與地點連線。minZoom／maxZoom 可限制縮放範圍。'],
      ['layout.mode', 'card · full', 'card 在地圖上疊加精簡卡片；full 在地圖旁提供完整閱讀區。'],
      ['layout.card', 'align: left', 'align 可選 left／center／right。widthRatio 範圍 0.20–0.80；heightRatio 範圍 0.20–0.95。'],
      ['layout.full', 'side: left · contentRatio: 0.5', 'side 可選 left／right；contentRatio 範圍 0.30–0.70。窄螢幕改為垂直排列。'],
      ['height', '520px', '網頁發佈時的文件高度；Obsidian 固定以 100% 填滿工作區分頁。'],
      ['map.tileUrl · map.attribution', 'OpenStreetMap', '可換用相容的圖磚供應商，並提供對應的出處標示。'],
    ],
    documentOnly: '資料夾、標籤、中心座標、版型、投影片、高度、標題、id 與 schema 僅能在文件設定。本機 AI agent 設定只儲存在這台裝置。',
    clipboard: { idle: '複製原始碼', done: '已複製', error: '請選取文字手動複製' },
    download: '前往官方外掛市集', reactGuide: '完整 React 範例', remarkGuide: 'Docusaurus 設定與瀏覽器端整合',
    faqHeading: '開始前，你可能想知道。', faqLede: '幾個關於 StoryMap 使用方式的實用解答。',
    faq: [
      { question: '需要註冊 StoryMap 帳號嗎？', answer: '不需要 StoryMap 帳號，也不需要資料庫。來源保留為 Markdown 檔案。地圖圖磚與範例圖片使用外部服務，因此示範頁需要網路連線。' },
      { question: '支援 Obsidian 手機版嗎？', answer: 'Obsidian 外掛僅支援桌面版，最低版本為 1.8.7。發佈後的網頁故事與本頁示範則會適應手機瀏覽器的窄螢幕。' },
      { question: '可以自己決定投影片順序嗎？', answer: '可以。明確填入非空的 slides 清單，就會保留你指定的順序，並忽略 noteFolder。日期排序與標籤篩選僅用於資料夾自動探索。' },
      { question: 'Obsidian 連結可以直接用在網站嗎？', answer: '標題連結在 Vault 內使用 Obsidian 導覽；Docusaurus 則需要透過 resolveNoteHref 對應站台路由。完整筆記內文不包含 WikiLink 與嵌入語法展開。' },
      { question: '如何把故事發佈到網站？', answer: '在 Docusaurus 加入 Remark 轉接器，並註冊瀏覽器端模組。筆記在建置時解析，Leaflet 僅在瀏覽器啟動。上方整合指南包含必要設定與樣式匯入方式。' },
    ],
  },
};
