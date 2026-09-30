# Handoff — StoryMap × Docusaurus / kywk.github.io 遷移

交接日期：2026-09-30
前一階段分支：`feat/leaflet`（`kywk/story-map`，35 commits，尚未合併或 push）

**先讀完這份，不要重新發散架構。** 已批准的架構與決策記錄在
[`../2026-09-29-leaflet-compatibility/`](2026-09-29-leaflet-compatibility/)，本文件只描述
現況與接下來要做的事。

## 1. 兩個倉庫

| 倉庫 | 路徑 | 狀態 |
| --- | --- | --- |
| `kywk/story-map` | `/Users/kywk/Dropbox/project/obsidian/story-map` | 分支 `feat/leaflet`，工作區乾淨 |
| `kywk/kywk.github.io` | 需確認實際路徑 | **未改動** |

## 2. 現況

```text
typecheck              PASS
test                   559 pass / 0 fail
                       (core 160, react 93, remark 124, obsidian 182)
build                  PASS
obsidian release check PASS
```

Obsidian 側九項手動驗證**全數通過**（真實 sandbox vault）。
Docusaurus 側**完全未驗證**——這是本文件的主題。

## 3. 任務

在 `kywk.github.io` 讓舊的 `leaflet` 區塊改由 `@story-map/remark-story-map` 渲染，然後
刪掉重複的舊 runtime。

1. 更新 `@story-map/remark-story-map` 到分支版本。
2. 建置，確認 33 個含 ` ```leaflet ` 的地圖頁面正常。
3. 移除：`docusaurus.config.ts` 的 `remarkLeaflet` 註冊、`plugins/remark-obsidian-leaflet/`、
   `static/js/leaflet-init.js` 及其 `<script>`、被取代的舊 Leaflet CSS。
4. 驗證 SPA 導航、light/dark、多地圖同頁。
5. 依實際結果更新文件。

## 4. 架構約束（不可違反）

1. **一個 Leaflet runtime。** 一個 remark 外掛、一個 client module，
   `leaflet/dist/leaflet.css` 只載入一次。舊的 CDN bootstrap 必須消失。
2. **路由由 host 擁有。** 只透過既有的 `resolveNoteHref`（接
   `scripts/content-links.js` 的 `contentLinkIndex.resolve()`）。**絕對不要移植舊外掛的
   `routeBase` + 小寫檔名 URL 演算法。** 無法解析就留白，不可猜。
3. **兩個 dialect，兩套 parser。** `story-map` 走 `storymap/v1` schema；`leaflet` 走專用
   parser，絕不進 `storymap/v1` Zod schema。不可把非故事地圖偽裝成 Story slides。
4. **Discriminator 明確。** host 帶 `data-story-map-kind="story" | "map"`；`client.tsx`
   依此選 `<StoryMap>` 或 `<GeoMap>`。缺少 attribute 時預設 `story`（舊頁面相容）。
5. **Host instance 身分與 authored `id` 分離。** `data-story-map-instance` 是每檔計數器。
   Xinjiang 重複使用 `chile-2509`，不得改名、去重或拒絕。
6. **Build 時不初始化 Leaflet；瀏覽器 bundle 無 Node API。**
7. **不可靜默忽略作者寫的設定。** 已辨識但未實作的 key 必須產生 `GeoMapDiagnostic`
   並指名該 key。

## 5. vault 事實（已實測，勿重新假設）

- **33 個 `leaflet` 區塊**，只用到 **P0 key**：`lat` `long` `id` `defaultZoom` `minZoom`
  `maxZoom` `scale` `darkMode` `unit` `height` `markerFolder`。無任何 P1/P2/P3。
- 只有 **5 個**有 `markerFolder`（Zao / Egypt / Kuala Lumpur / Chile / Xinjiang），
  其餘 28 個**本來就沒有標記來源**——空地圖是正確行為，不是缺陷。
- `backpacker/2002 Zao/Zao/` 資料夾**是空的** → 該圖 0 個標記，正確。
- 預期標記數：Chile **28**、Egypt **27**、Kuala Lumpur **5**、Xinjiang **20**、Zao **0**。
- `backpacker/2401 Egypt/Index Pharaoh Egypt.md` 同頁有**兩張地圖**
  （`egypt-2401` 與 `kl-2401`），可驗證同頁多 host。
- 舊 `mapmarker` 值：`default`（最多）、`restaurant`、`food`、`shop`。
- **沒有任何筆記使用 `mapzoom`**，marker 縮放可見性在此 vault 無法驗證。
- `width` 是 P1 deferred key，33 個區塊**都沒有用**。地圖寬度跟著筆記寬度是預期行為。

## 6. 必須先讀

在 `story-map` 倉庫：

| 文件 | 內容 |
| --- | --- |
| `AGENTS.md` | 專案規範；「Leaflet compatibility rules」「Non-goals」是重點 |
| `SPEC.md` | §2.1.1 dialect、§6A GeoMap 型別、§11 Docusaurus 行為 |
| `docs/leaflet-compatibility.md` | **逐 key 的真實支援狀態**，含已知缺口 |
| `docs/architecture.md` §14 | 檔案地圖與各層職責 |
| `docs/history/2026-09-29-leaflet-compatibility/patches/kywk-github-io-migration.md` | 遷移計畫 |
| `packages/remark-story-map/README.md` | 兩個 dialect、options、client 生命週期 |
| `examples/docusaurus/config-snippet.js` | 站點端接法範例 |

## 7. ⚠️ 綠燈不等於正確

這一輪有**三個 automated 檢查全數漏掉**的缺陷。請以此為戒。

### 7.1 發佈檢查的 stub 缺 `MarkdownRenderChild`

新加入的 inline `leaflet` block 在 module scope `extends MarkdownRenderChild`，但
`scripts/check-obsidian-release.mjs` 的 stub `obsidian` 模組沒有提供它 → bundle 載入即拋
`Class extends value undefined` → **每一次 Obsidian 發佈都會失敗**。單元測試全綠。

已修：stub 清單移至 `scripts/obsidian-release-stub.mjs`，並新增
`scripts/obsidian-release-stub.test.mjs` 斷言它涵蓋 plugin 的**每一個實際 import**。

### 7.2 匯入器讀錯外掛目錄

社群外掛的正式 id 是 `obsidian-leaflet-plugin`，但匯入器只讀
`plugins/obsidian-leaflet/data.json` → 在真實 vault 上「Import settings from Obsidian
Leaflet」會回報找不到資料。**測試寫了同一個錯誤假設**，所以是綠的。

已修：優先讀正式 id，fallback 到無後綴名稱。

### 7.3 Marker 筆記連結完全不可用

兩個獨立缺陷：

- Leaflet 在指標離開 marker 的瞬間就關閉非 permanent tooltip，而筆記連結就放在
  tooltip 裡 → Obsidian Page preview 開啟後，hover source 立刻離開 DOM，彈窗在指標
  抵達前就崩潰。
- Leaflet 的 `.leaflet-tooltip { pointer-events: none }` → tooltip 內的 `<a>` 根本收不到
  指標事件，完全無法點擊。

**第一次修還修錯了。** 改成 `permanent: true` 後，Leaflet 會在圖層已在地圖上時立刻開啟
tooltip（`_initTooltipInteractions` 把 `permanent` 綁到 `add`，`bindTooltip` 也會直接
open），於是 27 個標記的 tooltip **全部開啟且永不關閉**。最終修法是「綁完在同一個
同步區塊內立刻關閉」，讓 controller 從頭接管生命週期。

### 7.4 方法論

- **不要相信 subagent 報告的「全綠」，自己驗證。** 前一輪逐一讀了每個 agent 的程式碼
  才簽收，實際上抓到多處問題。
- **不要用 mock 掩蓋跨元件的互動。** 這一輪唯一抓到問題的測試，是用 **jsdom + 真實
  React**（`remark` 套件沒有 jsdom，測試環境是 Node，所以必須顯式 stub）。
- **Subagent 在同一分支並行工作會污染 git index。** 前一輪真的發生過（agent D 的檔案被
  從 index 掉出去，需要另外修復）。若並行，先確認分工不重疊，或明確要求 agent 不要動
  git。
- **真實建置優先於測試。** 這一輪所有真正的 bug 都是打開真實 vault 才發現的。

## 8. 已知缺口（誠實記錄，不要當成已支援）

- 已設定的 **dark tile source 有儲存但從未請求**；`darkMode` 解析但不切換 provider。
- **Shift-click 複製座標**用「投影最近的 marker」（16px 半徑），非逐圖層事件。
- `unitSystem` 僅儲存，無量測功能。
- P1 controls（`noUI` `noScrollZoom` `recenter` `lock`）與 `zoomDelta` **刻意不實作**，
  因為 core 會發出 `leaflet-pending-p1` 診斷；實作會讓診斷變成謊話。
- 未來 phase 的 layer 欄位（GeoJSON / GPX / overlays / image maps）只解析並診斷，不渲染。

## 9. 執行注意事項

- `pnpm` 不在預設 PATH：
  ```sh
  export PATH="$HOME/.local/share/mise/installs/pnpm/12.4.1:$PATH";
  ```
- 本機 sandbox vault（已安裝並手動驗證過）：
  `/Users/kywk/workspace/sandbox/obs-story-map`
- 舊 Leaflet 設定備份（若要測設定匯入）：
  `<vault>/.obsidian/geo-story-map/obsidian-leaflet-data.json.bak`
  匯入前需先複製回 `<vault>/.obsidian/plugins/obsidian-leaflet-plugin/data.json`。
- `story-map` 倉庫根目錄的 `.obsidian/` 含本機外掛建置輸出，**未追蹤，不要提交**。
- `feat/leaflet` 尚未合併到 `main`，也尚未 push。

## 10. 交付標準

- `kywk.github.io` 建置成功，四張 fixture 地圖頁面正常。
- SPA 導航進出地圖頁面**不重複掛載、不洩漏 React root**。
- 同頁多個地圖只初始化一次 Leaflet。
- HTML 沒有本機絕對路徑。
- 舊 runtime 檔案確實刪除，且 console 無 `leaflet-init.js` 相關錯誤。
- `docs/leaflet-compatibility.md` 依**實際**結果更新，不是依計畫。
- 若發現新缺陷：先加會失敗的測試，再修，並誠實記錄是誰驗證的。

## 11. 定義完成

- `story-map` 的 `typecheck` / `test` / `build` 仍全綠。
- `kywk.github.io` 建置通過，且四個地圖頁面煙霧測試通過。
- 已刪除重複的 Leaflet runtime。
- 文件反映實際支援狀態。

**若遇到未支援的 Leaflet key，保留在診斷與相容性矩陣中，不要靜默擴充範圍。**
