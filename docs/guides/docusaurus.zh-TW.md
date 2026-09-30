# Docusaurus

`@story-map/remark-story-map` 在建置階段把 fenced block 轉成 host 元素，並在瀏覽器中
掛載共用 renderer。一個外掛同時處理兩種 dialect，一個 client 入口掛載對應的 renderer——
所以同一頁同時有故事與舊版地圖時，Leaflet 也只會載入一次。

[English](docusaurus.md) · [來源語法](syntax.zh-TW.md)

## 安裝

```bash
npm install @story-map/remark-story-map react react-dom
```

React 與 React DOM 是 peer dependency，兩者都必須是 React 19。使用 React 18 的
Docusaurus 2/3 網站不符合需求。

## 註冊外掛

建置期入口與瀏覽器期入口是分開的。建置期可以使用 Node 的 `fs`；瀏覽器期不可以。

```ts
// docusaurus.config.ts
import remarkStoryMap from '@story-map/remark-story-map';
import { createContentLinkIndex } from './scripts/content-links.js';

const contentLinkIndex = createContentLinkIndex({ root: __dirname, docsConfig, blogConfig });

const storyMapOptions = {
  vaultRoot: __dirname,
  resolveNoteHref: (vaultRelativePath: string) => {
    const matches = contentLinkIndex.resolve(vaultRelativePath);
    return matches.length === 1 ? matches[0].route : undefined;
  },
  leafletDefaults: { theme: 'auto' },
};

export default {
  presets: [['classic', { docs: { remarkPlugins: [[remarkStoryMap, storyMapOptions]] } }]],
  plugins: ['./plugins/story-map-client'],
};
```

> **若你的打包工具破壞了套件的具名 `zod` 匯出**，請改用 Node 原生的 `require(esm)`
> 載入，讓套件的模組圖留在原生 loader 上：
>
> ```js
> // plugins/remark-story-map-loader.cjs
> const { createRequire } = require('node:module');
> const nativeRequire = createRequire(__filename);
> const mod = nativeRequire('@story-map/remark-story-map');
> module.exports = mod.default ?? mod;
> ```

Client 外掛只有幾行：

```js
// plugins/story-map-client/index.js
module.exports = function storyMapClientPlugin() {
  return {
    name: 'story-map-client',
    getClientModules() {
      return [require.resolve('@story-map/remark-story-map/client')];
    },
  };
};
```

`docusaurus build` 期間不會建立任何 Leaflet 實例。Leaflet 只在瀏覽器 client 的 effect
內部動態載入。

## 選項

| 選項 | 用途 |
| --- | --- |
| `vaultRoot` | 要索引的 repo／vault 根目錄。`noteFolder` 探索、明列的 `note:` WikiLink 與 `leaflet` 的 `markerFolder` 都需要它。省略時區塊仍會被解析，但不會解析任何內容。 |
| `assetBase` | 重寫已解析 Vault 相對媒體路徑的 URL 前綴，例如 `/vault-assets`。它只重寫 URL；複製檔案仍由你負責。 |
| `resolveNoteHref` | 把 Vault 相對筆記路徑（不含 `.md`、使用正斜線）對應到已發布的 href。 |
| `leafletDefaults` | 僅供 `leaflet` 使用的相容性預設值。絕不會套用到 `story-map` 區塊。 |
| `leafletPresentation` | 僅供 `leaflet` 使用的標記類型登錄表、預設類型與 tooltip 模式。 |

### 路由由你的網站決定

這個套件絕不實作 Docusaurus 的 slug 或 permalink 規則。`resolveNoteHref` 是唯一的接
合點，只在 `noteDisplay: link` 與 `leaflet` 標記連結時被呼叫。回傳 `undefined`（包含
多筆符合而無法決定的情況）會讓連結保持未連結，而不是猜一條路徑。

如果你要從一個用 `routeBase` 加小寫檔名自己組標記 URL 的外掛搬遷過來，**不要**移植
那套演算法。把 `resolveNoteHref` 指向你原本就有的路由索引即可。

## 轉換產出的 HTML

```html
<!-- story-map fence -->
<div class="story-map-host" data-story-map-kind="story" data-story-map-document="true"
     data-story-map-instance="sm-1" data-story-map-config="<url-encoded JSON>"></div>

<!-- leaflet fence -->
<div class="story-map-host" data-story-map-kind="map"
     data-story-map-instance="sm-2" data-story-map-config="<url-encoded JSON>"></div>
```

`data-story-map-kind` 是明確的判別屬性，client 依此選擇 `<StoryMap />` 或 `<GeoMap />`。
缺少此屬性的 host 會被視為 story，因此在引入判別屬性之前就已發布的頁面仍可正常運作。

`data-story-map-instance` 是每個檔案的計數器，刻意**不**由作者寫的 `id` 推導而來。
既有內容在不同地圖間重用 id，而同一頁的兩個區塊不能互相衝突；作者寫的 `id` 在 payload
中都會原樣保留。

## 筆記與媒體

設定 `vaultRoot` 後，筆記會遞迴建立索引，並跳過點開頭的目錄、`node_modules`、`build`、
`dist` 與 `coverage`。

- 明列的 `slides` 完全保留作者順序。
- `noteFolder` 需要 `story-map-note: true`，且只依 `order` + `dateField` 排序。
  `includeTags` / `excludeTags` 依 frontmatter 標籤過濾。
- 相對媒體的解析基準：筆記推導出的媒體相對於**筆記**；投影片上直接寫的媒體相對於
  **來源文件**。

## 主題橋接

內建主題會同時為地圖與 StoryMap 介面配色。若想要選用的 Infima 顏色橋接，可載入
`examples/docusaurus/story-map-theme.css`。

若你設定 `map.theme: auto`，請自行橋接：renderer 內建的 `auto` 預設跟隨
`prefers-color-scheme`，那是**作業系統**，而不是 Docusaurus 存在 localStorage 的主題
切換。**兩個方向都要宣告。** 只有 dark 的橋接會被 renderer 自己的 dark media query
蓋掉，於是 OS 為深色的讀者把你的網站切成淺色時，地圖仍然是深色的。

## 全頁檢視

全視窗地圖加上 Markdown 切換，刻意**不是**套件選項——它會操作佈景 DOM、收合文件側邊欄
並監看路由生命週期，因此屬於網站本身。見
[`docs/docusaurus-full-page.md`](../docusaurus-full-page.md)。

## 從獨立 Leaflet 外掛搬遷

當你的 ` ```leaflet ` 區塊已經能透過這個套件渲染，就可以刪掉網站自己的 `leaflet`
remark 外掛與其 CDN 啟動腳本。Leaflet 之後只會從這個 bundle 載入，而且只在頁面上真的
有 story 或 map host 時。實際移除的驗證記錄見
[遷移驗收報告](../acceptance/2026-09-30-docusaurus-leaflet-migration.md)。
