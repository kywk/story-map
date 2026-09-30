# 文件說明

需要理解或修改 StoryMap 時，從這裡開始。
[English](README.md) · [專案首頁](../README.md)

## 使用者指南

每篇都有英文原文與 `zh-TW` 中文版。

| 文件 | 內容 |
| --- | --- |
| [來源語法](guides/syntax.zh-TW.md) · [English](guides/syntax.md) | `story-map` 與 `leaflet` 區塊的所有 key，以及兩者共用的筆記 frontmatter。 |
| [Obsidian 外掛指南](guides/obsidian.zh-TW.md) · [English](guides/obsidian.md) | 安裝、版面、筆記顯示、設定區段、AI 座標查詢、舊版區塊。 |
| [Docusaurus](guides/docusaurus.zh-TW.md) · [English](guides/docusaurus.md) | 發布故事與舊版地圖、路由解析、client、主題橋接。 |
| [React](guides/react.zh-TW.md) · [English](guides/react.md) | `<StoryMap />` 與 `<GeoMap />`、props、主題、版面、SSR、CSS 變數。 |

## 貢獻者與參考文件

僅英文。

| 文件 | 角色 |
| --- | --- |
| [`../README.md`](../README.md) | 專案入口：它是什麼、有哪些套件、如何快速上手。 |
| [`../SPEC.md`](../SPEC.md) | 產品與架構契約（權威來源）。 |
| [`../AGENTS.md`](../AGENTS.md) | 協作規範、邊界、完成定義。 |
| [`../RELEASING.md`](../RELEASING.md) | npm 發布、Trusted Publisher 設定、Obsidian 社群發布。 |
| [`../DESIGN.md`](../DESIGN.md) | 介紹網站的視覺 token 與響應式慣例。 |
| [`architecture.md`](architecture.md) | 實作地圖：套件、資料流、檔案、API。 |
| [`leaflet-compatibility.md`](leaflet-compatibility.md) | ` ```leaflet ` dialect 實際支援哪些 key 的即時記錄，含已知缺口。 |
| [`docusaurus-full-page.md`](docusaurus-full-page.md) | 由網站端實作的全頁 StoryMap 範例（非套件選項）。 |
| [`obsidian-submission.md`](obsidian-submission.md) | 社群上架、發布資產、後續發布檢查。 |
| [`releases/`](releases/) | 各版本發布說明、升級指引、驗證證據。 |
| [`acceptance/`](acceptance/) | 單次變更的驗證證據。 |
| [`history/`](history/) | 已封存的計畫與背景。已被取代，非權威來源。 |

## 文件規則

- `SPEC.md` 與 `architecture.md` 描述的是**現有程式碼**，不是未來計畫。若與原始碼不一致，
  以原始碼為準，文件才是錯的。
- 每個事實只有一個家。檔案層級的細節屬於 `architecture.md`；上層文件連過去，不要重複
  書寫。
- 產品使用者會查的內容屬於 `docs/guides/`，且必須有英文與 `zh-TW` 兩個版本。
- 已完成或被取代的計畫文件，用 `git mv` 移入 `history/<YYYY-MM-DD>-<slug>/`，保留歷史。
- **刪除**開發過程筆記——交接、暫態狀態、對話紀錄——一旦其工作已合併。不要歸檔。如果
  其中證據值得保留，改寫成 `acceptance/` 記錄。
- 行為改變時，在同一個變更中更新對應文件。
- 編輯 `site/` 前先詢問。使用者面向的文案在 `site/src/i18n.ts` 與
  `site/src/stories.ts`；版面或視覺工作請載入 `frontend-design` skill，並保留
  `site/src/styles.css` 既有的地圖相關 token。

新 agent 建議閱讀順序：`../README.md` → `architecture.md` → `../SPEC.md` →
`../AGENTS.md`。
