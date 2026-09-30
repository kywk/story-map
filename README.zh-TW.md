# Story Map

把帶有座標的 Markdown 筆記，變成可以一頁一頁翻閱的地理故事。

同一份來源文件、同一份設定，可以在三個地方呈現：獨立的 React 應用、**Geo Story Map**
Obsidian 外掛，以及 Docusaurus 網站。

[English](README.md) · [文件索引](docs/README.md)

## 安裝

| 位置 | 方式 |
| --- | --- |
| Obsidian | 設定 → 社群外掛 → 瀏覽 → **Geo Story Map**（[社群目錄](https://community.obsidian.md/plugins/geo-story-map)） |
| React | `npm install @story-map/react-story-map react react-dom` |
| Docusaurus | `npm install @story-map/remark-story-map react react-dom` |

## 快速上手

StoryMap 文件就是一般的 Markdown，加上 `story-map: true` frontmatter 與一個設定區塊。
把筆記放進你指定的 `noteFolder`：

````markdown
---
story-map: true
---

```story-map
title: Chile Trip
map:
  theme: vintage
  center: [-33.4489, -70.6693]
  zoom: 6
noteFolder: Travel/Chile/Places
order: asc
dateField: date-created
```
````

```markdown
<!-- Travel/Chile/Places/Santiago.md -->
---
story-map-note: true
title: Santiago
location: [-33.4489, -70.6693]
date-created: 2026-01-15
---
```

`noteFolder` 會遞迴找出所有標記 `story-map-note: true` 的筆記，並依 `dateField` 排序。
版面有 `card`、`full`、`timeline` 三種；地圖主題有 `auto`、`light`、`dark`、`vintage`、
`cyber`、`atlas` 六種。

你也可以直接貼上舊 Obsidian Leaflet 外掛的 ` ```leaflet ` 區塊，它會直接渲染成一張地圖，
標記從資料夾讀取——**不需要修改既有筆記**。

## 開發這個專案

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @story-map/example-react dev   # http://127.0.0.1:5173
```

## 文件

**從這裡開始**

| 文件 | 內容 |
| --- | --- |
| [來源語法](docs/guides/syntax.zh-TW.md) | `story-map` 與 `leaflet` 區塊的所有 key，以及兩者共用的筆記 frontmatter。 |
| [Obsidian 外掛指南](docs/guides/obsidian.zh-TW.md) | 安裝、設定、版面、筆記顯示、AI 座標查詢。 |
| [Docusaurus](docs/guides/docusaurus.zh-TW.md) | 在網站上發布故事與舊版地圖。 |
| [React](docs/guides/react.zh-TW.md) | 直接嵌入 `<StoryMap />` 與 `<GeoMap />`。 |

**參考與貢獻者文件**

| 文件 | 內容 |
| --- | --- |
| [`SPEC.md`](SPEC.md) | 產品與架構契約。 |
| [`docs/architecture.md`](docs/architecture.md) | 實作地圖：套件、資料流、檔案、API。 |
| [`docs/leaflet-compatibility.md`](docs/leaflet-compatibility.md) | 舊 `leaflet` 的哪些 key 真的能用、哪些還沒。 |
| [`AGENTS.md`](AGENTS.md) | 協作規範與完成定義。 |
| [`RELEASING.md`](RELEASING.md) | npm 與 Obsidian 外掛的發布步驟。 |
| [`docs/acceptance/`](docs/acceptance/) | 驗收證據。 |
| [`docs/history/`](docs/history/) | 已封存的計畫。已被取代，非權威來源。 |

## 設計原則

`react-story-map` 絕不 import Obsidian 或 Docusaurus 的 API。各個 adapter 會在渲染之前，
先把筆記、frontmatter、媒體與路由解析成設定物件，讓 renderer 只負責一件事，並且在每個
host 裡跑的是同一份程式碼。

## 授權

MIT — 見 [LICENSE](LICENSE)。外掛發布包內附相依套件的版權聲明。
