# React

`@story-map/react-story-map` 會把故事渲染成 Leaflet 地圖上的翻頁投影片，並匯出
`<GeoMap />` 供「只有地圖、沒有故事」的情境使用。需要 React 與 React DOM **19**。

[English](react.md) · [來源語法](syntax.zh-TW.md)

## 安裝

```bash
npm install @story-map/react-story-map react@^19 react-dom@^19 leaflet@^1.9.4
```

在應用程式的全域 CSS 入口或根元件 import 兩個樣式表各一次：

```tsx
import 'leaflet/dist/leaflet.css';
import '@story-map/react-story-map/styles.css';
```

Renderer 不會自動 import，必須由你的 host 打包，並讓容器有實際可見的高度。

## 故事

```tsx
import { createRoot } from 'react-dom/client';
import { StoryMap, type StoryMapConfig } from '@story-map/react-story-map';
import 'leaflet/dist/leaflet.css';
import '@story-map/react-story-map/styles.css';

const story: StoryMapConfig = {
  schema: 'storymap/v1',
  title: 'A walk through Taipei',
  height: '520px',
  panelOpacity: 0.85,
  map: {
    theme: 'light',
    zoom: 14,
    tileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '© OpenStreetMap contributors',
    showPath: true,
  },
  layout: { mode: 'card', card: { align: 'left' }, full: { side: 'left', contentRatio: 0.5 } },
  slides: [
    { title: 'Taipei Main Station', text: 'Start your **walking tour** here.', location: { lat: 25.0478, lng: 121.517 } },
    { title: 'Dihua Street', text: 'Explore the historic street.', location: { lat: 25.0555, lng: 121.5097 }, notePath: '/notes/dihua-street' },
  ],
};

createRoot(document.getElementById('root')!).render(<StoryMap story={story} />);
```

請讓 `story` 物件在無關的 re-render 之間保持穩定。當主題、版面或投影片變更時，
Leaflet 實例會維持掛載，不會重建。

這個 renderer 接受的是**已解析完成**的設定。請用
[`@story-map/story-map-core`](../../packages/story-map-core/README.md) 解析 YAML 與套用
預設值；筆記、資料夾探索、路由與媒體 URL 由你的 host 先解析。

### Props

| Prop | 型別 / 預設 | 用途 |
| --- | --- | --- |
| `story` | `StoryMapConfig`，必填 | 已解析的設定，含地圖選項與排序後的投影片。 |
| `initialSlide` | `number`，`0` | 起始索引（從 0 開始），會被夾在可用範圍內。 |
| `className` | `string` | 外層 section 的額外 class。 |
| `onSlideChange` | `(index, slide) => void` | 目前投影片變化時觸發，包含第一次渲染。 |
| `onNoteClick` | `(notePath, event) => void` | 有連結的標題或 timeline 筆記連結的 host 導覽。 |
| `onNoteHover` | `(notePath, targetEl, event) => void` | 同上的 host 預覽。 |
| `noteLinkClassName` | `string` | 有連結的標題與筆記連結的額外 class。 |

沒有提供筆記 callback 時，`notePath` 會是一般 anchor 的 `href`。只要提供任一個
callback 就會阻止預設的點擊導覽，因此若你的 host 需要點擊可導覽，請一併提供
`onNoteClick`。投影片文字支援 Markdown；WikiLink 與 embed 需由 host 自行解析。

## 一般地圖

`<GeoMap />` 是不帶故事的地圖，`StoryMap` 本身就是建構在它之上。當你只有標記與視野、
沒有敘事需求時使用它。

```tsx
import { GeoMap, type GeoMapConfig } from '@story-map/react-story-map';

const map: GeoMapConfig = {
  schema: 'geomap/v1',
  height: '500px',
  map: {
    theme: 'light',
    zoom: 11,
    minZoom: 4,
    maxZoom: 17,
    tiles: { light: { url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', attribution: '© OpenStreetMap contributors' } },
  },
  markers: [
    { location: { lat: 25.033, lng: 121.5654 }, title: 'Din Tai Fung', type: 'restaurant' },
    { location: { lat: 25.0555, lng: 121.5097 }, title: 'Dihua Street', notePath: '/notes/dihua' },
  ],
};

<GeoMap map={map} />;
```

| Prop | 型別 / 預設 | 用途 |
| --- | --- | --- |
| `map` | `GeoMapConfig`，必填 | 已解析的地圖選項與標記。 |
| `markerTypes` | `readonly MarkerTypeDefinition[]` | 標記類型登錄表，把 `type` 對應到圖示、顏色、標籤與縮放範圍。 |
| `defaultTooltip` | `'always' \| 'hover' \| 'never'`，`hover` | 未自行指定時的 tooltip 模式。 |
| `className` | `string` | 主題根元素上的額外 class。 |
| `label` | `string` | 地圖區域的無障礙名稱。 |
| `onNoteClick` / `onNoteHover` | functions | 有連結標記的 host 導覽／預覽。 |
| `noteLinkClassName` | `string` | 有連結標記的額外 class。 |
| `onReady` | `(runtime: GeoMapRuntime \| null) => void` | Leaflet 就緒後提供 live map；卸載時為 `null`。 |

`type` 未登錄在 registry 中的標記**仍然會渲染**，使用預設外觀——退化的樣子是虛線圓環，
而不是消失的圖釘。標記的 `minZoom` / `maxZoom` 會讓它隨縮放層級出現與消失。

`map.controls`（`noUI`、`noScrollZoom`、`recenter`、`locked`）與 `map.zoomDelta`
目前是**刻意不實作**的，這樣 pending 診斷才不會變成謊話。詳見
[相容性矩陣](../leaflet-compatibility.md)。

## 主題、版面與覆寫

`map.theme` 可為 `auto`、`light`、`dark`、`vintage`、`cyber`、`atlas`。預設主題會同時
協調圖磚、標記、路徑與內容介面，**但不會改變圖磚供應商**。`light` 與 `dark` 是固定
色票；`auto` 跟隨 host（Obsidian 對應到原生佈景，其他 host 使用
`prefers-color-scheme`）。

`layout.mode` 為 `card`、`full` 或 `timeline`。card 支援 `align` 與選用的
`widthRatio`、`heightRatio`；full 支援 `side` 與 `contentRatio`，而 timeline 沿用同樣的
`full` 選項。在窄螢幕上，full 與 timeline 都會變成上方地圖帶、下方滿版清單。card 與
full 保留上一頁／下一頁控制；timeline 則沒有，因為它的清單本身就是導覽。

若要做刻意的顏色覆寫，在元件或祖先元素上設定語意變數：

```css
.my-story-theme {
  --story-map-bg: #18212f;
  --story-map-fg: #f3f4f6;
  --story-map-muted: #cbd5e1;
  --story-map-border: #475569;
  --story-map-accent: #93c5fd;
}
```

```tsx
<StoryMap story={story} className="my-story-theme" />
```

這些變數會覆寫預設主題的面板、文字、連結、邊框與導覽顏色。主題只對圖磚圖層套用
濾鏡，因此覆寫顏色不會讓地圖影像失真。

`<GeoMap />` 使用相同的主題根元素，所以六種主題與這些變數都能直接套用到單純地圖，
不需要額外 CSS。

## 伺服器渲染

JavaScript 入口可安全地在 SSR 期間 import：Leaflet 會在 client effect 中動態載入，
因此伺服器只渲染面板、由瀏覽器接手 hydration。元件卸載時會清理地圖；瀏覽器支援的情況下
會使用 `ResizeObserver`，在版面變更後更新地圖尺寸。
