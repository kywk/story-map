# Geo Story Map for Obsidian

一個 Obsidian 外掛：把 Markdown 文件以全螢幕地圖加翻頁投影片的方式開啟，也會把舊版
`leaflet` 區塊渲染成一般 Markdown 裡的內嵌地圖。

[English](obsidian.md) · [來源語法](syntax.zh-TW.md)

僅支援桌面版。需要 Obsidian **1.8.7** 或更新版本。

## 安裝

**設定 → 社群外掛 → 瀏覽**，搜尋 **Geo Story Map**，然後按**安裝**與**啟用**。它列在
[社群目錄](https://community.obsidian.md/plugins/geo-story-map)。

手動安裝：從[最新版本](https://github.com/kywk/story-map/releases/latest)下載
`main.js`、`manifest.json`、`styles.css`，放進
`<Vault>/.obsidian/plugins/geo-story-map/`，再啟用外掛。

## 使用方式

1. 建立帶有 `story-map: true` frontmatter 與
   [`story-map` 區塊](syntax.zh-TW.md#story-map-區塊)的 Markdown 文件。
2. 在區塊指定的 `noteFolder` 下放入筆記，每則都標記 `story-map-note: true` 並帶有
   `location`。
3. 關閉再重新開啟文件，或從命令面板執行 **Geo Story Map: Open as map**。

**Open as Markdown** 可把同一個檔案切回編輯模式，且不會改動來源內容。

可用的範例檔案在
[`examples/obsidian/panel-opacity-demo.md`](../../examples/obsidian/panel-opacity-demo.md)。

## 版面

`layout.mode` 只由文件決定：`card`（預設）、`full` 或 `timeline`。

| 版面 | 外觀 |
| --- | --- |
| `card` | 浮在地圖上的投影片卡片。 |
| `full` | 滿版地圖旁邊的可捲動故事區。 |
| `timeline` | 地圖旁邊每則條目一列，沿用 `layout.full.side` 與 `layout.full.contentRatio`。 |

timeline 的每一列包含日期標籤、封面縮圖、標題、簡短描述與筆記連結。這個清單本身就是
導覽，所以沒有上一頁／下一頁按鈕；點擊某一列會選取它，且目前這一列會自動捲入畫面。

每則條目的日期來自你設定的 `dateField`，因此 timeline 與預設排序讀到的是同一個值。
明列的投影片可以自己寫 `date`，且優先採用。日期顯示為 `Apr 12, 2024`。

## 筆記顯示

`noteDisplay` 可為 `basic`、`link`（預設）或 `full`，各自顯示的內容見
[語法參考](syntax.zh-TW.md#筆記顯示)。在 `link` 模式中，hover 標題會顯示 Obsidian 頁面
預覽，點擊則在新分頁開啟筆記；`leaflet` 區塊的標記 tooltip 行為相同。

## 設定

**設定 → Geo Story Map** 分成五個區段。這個分組**就是**預設值的邊界，而且預設值是
**依 dialect 分開解析**的，因此舊版設定永遠不會改變故事的呈現。

| 區段 | 項目 | 適用對象 |
| --- | --- | --- |
| Story | `order`、`dateField`、`noteDisplay`、`initialSlide`、`panelOpacity` | 僅 `story-map` |
| Map | `theme`、`zoom`、`minZoom`、`maxZoom`、`showPath` | 僅 `story-map` |
| Map | 淺色／深色圖磚 URL、出處標示、子網域 | 兩種 dialect |
| Markers & interaction | 預設標記類型、標記類型登錄表、tooltip 模式、頁面預覽、Shift 點擊複製 | `leaflet` 區塊 |
| Leaflet compatibility | 預設中心點、預設單位制、相容性警告、**Import settings from Obsidian Leaflet** | 僅 `leaflet` |
| Local agents | 可執行檔、參數、預設 agent、偵測狀態 | AI 查詢；裝置本機，存放在設定檔之外 |

屬於單一故事的值——`title`、`noteFolder`、地圖中心、`layout`、`slides`——一律留在文件裡，
不會在這裡被預設化。

解析順序為「區塊 key → 外掛設定 → 內建預設」，兩種 dialect 各自獨立。兩個結果：

- Leaflet 專用的預設中心點、標記登錄表、tooltip 預設或單位制，絕不會套用到原生
  StoryMap。
- 淺色／深色圖磚這組設定是兩種 dialect 都會讀取的唯一一組。主題絕不會取代你設定的
  圖磚 URL。

設定以 `version: 2` 儲存。舊的扁平結構會在載入時自動遷移；檔案損毀時會退回內建預設，
而不是直接失敗。

### 從 Obsidian Leaflet 匯入設定

**Import settings from Obsidian Leaflet**（同名命令）只會在**你主動要求時**讀取舊外掛的
`data.json`。該外掛永遠不是執行期相依套件，匯入範圍僅限持久性的地圖與標記概念：圖磚
伺服器與子網域、出處標示、標記類型、tooltip 行為、頁面預覽、點擊複製、單位制與預設
中心點。可變的標記狀態、覆蓋層、CSV 資料、map-view 狀態與舊設定目錄都不會匯入。

Font Awesome 圖示在對應到已知的可攜符號時會轉換，否則保留預設標記外觀並給出警告。
沒有 API key 的 CARTO Basemap URL 會被回報且**不會**套用，因此不會變成無聲失效的預設值。

## 舊版 `leaflet` 區塊

` ```leaflet ` 區塊會在一般筆記中渲染成內嵌地圖。它是第二種 dialect，有自己的 parser：
沒有投影片、沒有故事版面、沒有面板。其 key 請見
[語法參考](syntax.zh-TW.md#leaflet-區塊)。

- 它使用自己的 `height`，絕不會被改成全視圖的 `100%`。
- `markerFolder` 會遞迴解析。沒有有效 `location` 的筆記會被略過。
- 啟用 **Copy location on Shift-click** 後，Shift 點擊標記會複製其
  `location: [lat, lng]`。
- 無法讀取的區塊會在區塊內部回報錯誤，筆記其餘部分不受影響。
- 只註冊 `leaflet` 語言，其他程式碼區塊一律沿用 Obsidian 自己的渲染器。

哪些 key 真的被支援，逐項記錄在
[相容性矩陣](../../docs/leaflet-compatibility.md)，包含已解析但尚未實作的那些。

## AI 座標查詢

**Find coordinates with AI** 可在任何 Markdown 筆記上使用：

1. 輸入地點名稱（支援中文及其他語言）。
2. 預設的本機 CLI agent 會回傳排序後的候選清單。
3. 在清單中或互動式小地圖上挑選一個。
4. 選擇 **Update/Add frontmatter** 寫入 `location: [lat, lng]`（連同選填的
   `mapmarker`），或選擇 **Copy to clipboard**。

內建 agent 有 Codex、Claude Code、OpenCode 與 pi，也可加入自訂 CLI。可執行檔、參數、
預設 agent 與偵測狀態都在 **設定 → Geo Story Map → Local agents**，並存於 Obsidian 的
本機儲存空間——絕不寫進你的 vault。座標僅供參考；尤其是較冷門的地點，請先在地圖上
確認候選位置再寫入。

## 網路使用

圖磚預設來自 OpenStreetMap，會向該供應商揭露所請求的地圖範圍。若設定了
`map.tileUrl`，則改用你指定的供應商。遠端的投影片媒體會在顯示時連線到其設定的 host。
AI 查詢只會把你輸入的地點名稱送給 CLI agent 的模型供應商。

## 從原始碼建置

```bash
pnpm --filter @story-map/obsidian-story-map build
```

把 `dist/main.js`、`dist/manifest.json`、`dist/styles.css` 與
`dist/THIRD_PARTY_NOTICES.txt` 複製到 `<Vault>/.obsidian/plugins/geo-story-map/`。
儲存庫根目錄的 `manifest.json` 與 `versions.json` 為權威來源，建置會複製到 `dist`。
詳見[發布指南](../../docs/obsidian-submission.md)。
