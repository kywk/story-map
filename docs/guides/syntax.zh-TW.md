# 來源語法

StoryMap 文件就是一般的 Markdown 檔案。這一頁列出兩種 fenced block dialect 接受的
所有 key，以及兩者共用的筆記 frontmatter。

[English](syntax.md)

## 文件本身

````markdown
---
story-map: true
---

```story-map
title: Chile Trip
noteFolder: Travel/Chile/Places
```
````

frontmatter 裡的 `story-map: true` 是讓文件能以地圖檢視開啟的關鍵。`leaflet` 區塊
不需要它——它會直接內嵌在一般 Markdown 中渲染。

## 筆記

筆記就是任何 Markdown 檔案。以下的 key 兩種 dialect 都讀取，所以同一份筆記可以同時
餵給故事投影片與舊版地圖標記。

```markdown
---
story-map-note: true
title: Santiago
location: [-33.4489, -70.6693]
date-created: 2026-01-15
description: The journey begins here.
cover: cover.png
mapmarker: restaurant
mapzoom: [5, 12]
tags: [travel, chile]
---
```

| Key | 使用者 | 意義 |
| --- | --- | --- |
| `story-map-note: true` | story | 標記此筆記可被 `noteFolder` 找到。沒有它就會被忽略。 |
| `title` | 兩者 | 標記／標籤標題，也是投影片標題。 |
| `location` | 兩者 | `[緯度, 經度]`。標記的必要欄位；沒有座標的筆記會被略過，不會報錯。 |
| `description` / `summary` | 兩者 | 標記 tooltip 內容與投影片文字。 |
| `cover` / `image` / `media` | story | 投影片媒體。相對於筆記檔案解析。 |
| `date-created`（或你自訂的 `dateField`） | story | 決定排序，並填入 timeline 列的日期標籤。 |
| `mapmarker` | 兩者 | 標記類型名稱。未註冊的值仍會渲染，並保留你寫的名稱。 |
| `mapzoom` | 兩者 | 標記可見的縮放範圍 `[min, max]`。單一數值視為下限。 |
| `tags` / `tag` | 兩者 | 供 `includeTags` / `excludeTags` 過濾，也作為標記類型的備援來源。可為字串或陣列；比對時不分大小寫，並容忍空白與 tag 前綴。 |

## `story-map` 區塊

camelCase 的 key。這是「故事」：投影片、版面與面板。

| Key | 預設 | 意義 |
| --- | --- | --- |
| `schema` | `storymap/v1` | 來源 schema 識別碼。 |
| `title` | — | 故事標題。 |
| `height` | `520px` | 地圖容器高度。 |
| `noteFolder` | — | 單一 Vault 相對路徑資料夾，遞迴掃描。`slides` 非空時忽略。 |
| `order` | `asc` | 依 `dateField` 用 `asc` 或 `desc`。 |
| `dateField` | `date-created` | 存放每則筆記日期的 frontmatter key。 |
| `noteDisplay` | `link` | `basic`、`link` 或 `full`。 |
| `initialSlide` | `first` | `first`、`last` 或從 0 開始的索引。 |
| `panelOpacity` | `0.85` | 卡片／文章背景的透明度，`0.0`–`1.0`。 |
| `includeTags` | — | 只保留含任一標籤的筆記。 |
| `excludeTags` | — | 排除含任一標籤的筆記。 |
| `slides` | — | 明列的條目。順序完全照寫，絕不會被 `noteFolder` 重排或附加。 |
| `map.theme` | `light` | `auto`、`light`、`dark`、`vintage`、`cyber`、`atlas`。 |
| `map.center` | — | `[緯度, 經度]`。 |
| `map.zoom` | `6` | 初始縮放。 |
| `map.minZoom` / `map.maxZoom` | — | 縮放範圍。 |
| `map.tileUrl` | OpenStreetMap | 圖磚樣板。主題不會取代它。 |
| `map.attribution` | `© OpenStreetMap contributors` | 顯示在地圖上。 |
| `map.showPath` | `true` | 依序連接投影片的路線。 |
| `layout.mode` | `card` | `card`、`full` 或 `timeline`。僅由文件決定。 |
| `layout.card.align` | `left` | `left`、`center`、`right`。 |
| `layout.card.widthRatio` / `heightRatio` | — | `0.20..0.80` 與 `0.20..0.95`。 |
| `layout.full.side` | `left` | `left` 或 `right`。`timeline` 也使用。 |
| `layout.full.contentRatio` | `0.5` | `0.30..0.70`。`timeline` 也使用。 |

### 版面

- `card` — 浮在地圖上的投影片卡片。
- `full` — 滿版地圖旁邊的可捲動故事區。
- `timeline` — 地圖旁邊每則條目一列，含日期；沿用 `layout.full.side` 與
  `layout.full.contentRatio`。這個清單本身就是導覽，所以沒有上一頁／下一頁按鈕。

### 筆記顯示

- `basic` — 只顯示 frontmatter 基本欄位。
- `link` — 基本欄位加一個筆記連結。在 Obsidian 中，hover 會顯示頁面預覽、點擊在新分頁
  開啟；在網站上則是一般的瀏覽器連結。
- `full` — 以筆記內文（去掉 frontmatter）作為投影片文字。

`full` 版面一律使用筆記內文，不受 `noteDisplay` 影響。`timeline` 則會尊重設定，但在
正文旁保留每一列的日期、標題與封面，避免出現空白列。

### 明列的投影片

```yaml
slides:
  - title: Leaving home
    date: 2024-04-12
    text: The flight leaves at dawn.
    location: [25.0330, 121.5654]
  - note: "[[Travel/Chile/Places/Santiago]]"
```

投影片可以用 WikiLink 引用筆記，並繼承該筆記的 frontmatter。投影片上明寫的屬性優先於
筆記推導出的值；自己寫的 `date` 一定優先於筆記的值。

## `leaflet` 區塊

舊版 Obsidian Leaflet 的 dialect，用於「不是故事」的地圖。它有自己的 parser，
**絕不會**進入 `storymap/v1` schema。key 的拼字維持歷史樣貌，因此既有筆記完全不需要
修改就能渲染。

````markdown
```leaflet
id: chile-2509
height: 600px
lat: -33.0000
long: -70.0000
minZoom: 4
maxZoom: 17
defaultZoom: 5
unit: meters
scale: 1
darkMode: true
markerFolder: backpacker/2509 Chile/Chile
```
````

| Key | 預設 | 意義 |
| --- | --- | --- |
| `id` | — | 你寫的識別碼，原樣傳遞。可以跨區塊重複。 |
| `height` | `520px` | 此區塊的高度。絕不會被強制成 `100%`。 |
| `lat` + `long` / `lng` | — | 中心點。只給一半或超出範圍會是錯誤。 |
| `defaultZoom` | `6` | 初始縮放。 |
| `minZoom` / `maxZoom` | — | 縮放範圍。 |
| `markerFolder` | — | Vault 相對路徑資料夾，遞迴掃描。可重複撰寫，也接受 YAML 陣列或逗號分隔字串。 |
| `unit`、`scale` | — | 接受為相容性中繼資料。目前沒有效果；不是錯誤。 |
| `darkMode` | — | 接受為相容性旗標。不會改變主題或圖磚來源。 |

`markerFolder` 內的筆記只要有有效的 `location` 就會成為標記；沒有座標的筆記會被略過。
`mapmarker` 若未註冊，仍會以預設樣式渲染標記，並保留你寫的名稱。

**不會有任何設定被悄悄忽略。** 專案認得但尚未實作的 key，會以診斷訊息列在地圖下方；
無法辨識的 key 另外回報，因此打錯字不會被誤認為「排程中的功能」。每個 key 的完整
狀態請見[逐 key 支援記錄](../leaflet-compatibility.md)。

## 主題與圖磚

`auto` 跟隨 host：Obsidian 會對應到自己的佈景顏色，其他 host 則回退到
`prefers-color-scheme`。`light` 與 `dark` 是固定、不依賴 host 的色票，`vintage`、
`cyber`、`atlas` 則是自訂風格。host 仍可透過設定 `--story-map-*` CSS 變數指定確切
顏色。

內建圖磚來源為 `https://tile.openstreetmap.org/{z}/{x}/{y}.png`，並顯示出處標示。主題
屬於「呈現」，絕不會取代你設定的 `tileUrl`；圖磚供應商與主題是互相獨立的一件事。
