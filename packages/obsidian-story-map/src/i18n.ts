export type Locale = 'en' | 'zh-TW';
export type MessageKey = keyof typeof zhTW;

const zhTW = {
  // Command and modals
  'Find coordinates with AI': '用 AI 查找座標',
  'Enter a place name. Chinese and other languages are supported.': '輸入地點名稱，支援中文與其他語言。',
  Location: '地點',
  Search: '搜尋',
  Cancel: '取消',
  'Searching coordinates…': '正在查找座標…',
  'Choose a place': '選擇地點',
  'Update/Add frontmatter': '更新/新增 frontmatter 資訊',
  'Copy to clipboard': '複製到剪貼簿',
  'Coordinates copied to clipboard': '座標已複製到剪貼簿',
  'Could not copy to clipboard': '無法複製到剪貼簿',
  'Frontmatter updated': '已更新 frontmatter',
  'Could not update frontmatter': '無法更新 frontmatter',
  'mapmarker (leave empty to skip)': 'mapmarker（留空則不寫入）',
  'The AI did not return valid coordinates.': 'AI 沒有回傳有效的座標。',
  // Inline leaflet blocks
  Map: '地圖',
  'Compatibility notices ({count})': '相容性提示（{count}）',
  'Leaflet block configuration error': 'leaflet 區塊設定錯誤',
  'Leaflet block error': 'leaflet 區塊錯誤',
  'Marker type: {id}': '標記類型：{id}',
  'Add marker type': '新增標記類型',
  'Remove marker type': '移除標記類型',
  'Import settings from Obsidian Leaflet': '從 Obsidian Leaflet 匯入設定',
  'Reads the old plugin settings once, if they exist in this vault. Mutable markers, overlays, CSV data, and map-view state are not imported.':
    '若此 vault 中存在舊插件設定，會讀取一次。可變標記、圖層覆蓋、CSV 資料與地圖檢視狀態都不會匯入。',
  'No saved Obsidian Leaflet settings were found in this vault.':
    '在此 vault 中找不到已儲存的 Obsidian Leaflet 設定。',
  'No importable Obsidian Leaflet settings were found.': '找不到可匯入的 Obsidian Leaflet 設定。',
  'Imported Obsidian Leaflet settings: {items}': '已匯入的 Obsidian Leaflet 設定：{items}',
  'This CARTO Basemaps URL does not contain an API key. CARTO now requires keys for Basemaps. Configure a CARTO key or switch to another tile provider.':
    '這個 CARTO Basemaps URL 沒有包含 API key。CARTO 的 Basemaps 現在需要 key。請設定 CARTO key，或改用其他圖磚供應商。',
  'The marker type "{id}" uses an icon this plugin cannot translate to a portable symbol. It keeps the default marker visual; set a symbol or image in settings to change it.':
    '標記類型「{id}」使用的圖示無法轉換成可攜的符號，會沿用預設的標記外觀；若要變更，請在設定中指定符號或圖片。',
  // Local agent settings
  'Local agents': '本地 AI 代理',
  'Uses a local CLI login and model. The place name is sent to that service. Paths, arguments, and the default agent are stored only on this device.':
    '使用本地 CLI 的登入與模型；地點名稱會送到該服務。路徑、參數與預設代理只儲存在本機。',
  Detected: '已偵測',
  'Not detected': '未偵測',
  'Set as default': '設為預設',
  Test: '測試',
  'Testing…': '測試中…',
  'Test succeeded: {answer}': '測試成功：{answer}',
  'Executable name or absolute path': '執行檔名稱或絕對路徑',
  '{name} arguments': '{name} 參數',
  'Full launch arguments, separated by spaces with quote support; no shell is used. Keep the built-in non-interactive and output-format arguments.':
    '完整啟動參數，以空白分隔並支援引號；不使用 shell。請保留內建的非互動與輸出格式參數。',
  'Display name': '顯示名稱',
  'Remove custom agent': '移除自訂代理',
  'Apply local settings': '套用本地設定',
  'Local settings saved': '本地設定已儲存',
  'Detect saved configurations again': '重新偵測已儲存的設定',
  'Detection complete; unsaved path and argument drafts were not checked':
    '偵測完成；未儲存的路徑與參數草稿未被檢查',
  'Add custom CLI': '新增自訂 CLI',
  'Custom CLI': '自訂 CLI',
  'Choose a default local agent in settings': '請在設定中選擇預設的本地 AI 代理',
  'Executable cannot be empty': '執行檔不可空白',
  'Choose a default agent': '請選擇預設代理',
  // Agent runtime errors
  'Agent arguments have an unclosed quote': 'Agent 參數的引號未閉合',
  'The local agent executable was not found. Check its path in settings.':
    '找不到本地 AI 代理執行檔，請至設定檢查路徑。',
  'The local agent could not be started. Check the executable and permissions.':
    '無法啟動本地 AI 代理，請檢查執行檔與權限。',
  'The local agent failed (exit code {code}). Check its login and settings in a terminal.':
    '本地 AI 代理執行失敗（退出碼 {code}），請在終端機檢查登入與設定。',
  'The local agent could not read the input.': '本地 AI 代理無法讀取輸入。',
  'The local agent timed out.': '本地 AI 代理逾時。',
  'The local agent output exceeded the size limit.': '本地 AI 代理輸出超過上限。',
  'The local agent did not return a result. Check non-interactive and output-format arguments.':
    '本地 AI 代理沒有回傳結果，請檢查非互動與輸出格式參數。',
  'The request was cancelled.': '要求已取消。',
  '{name} reported a failure.': '{name} 回報失敗。',
} as const;

let locale: Locale = 'en';

export function resolveLocale(obsidianLanguage: string): Locale {
  return /^zh-(tw|hk|mo|hant)(-|$)/i.test(obsidianLanguage.replaceAll('_', '-')) ? 'zh-TW' : 'en';
}

/** Called once on plugin load; command names capture the locale at registration time. */
export function configureI18n(obsidianLanguage: string): Locale {
  locale = resolveLocale(obsidianLanguage);
  return locale;
}

export function getLocale(): Locale {
  return locale;
}

export function t(key: MessageKey, values: Record<string, string | number> = {}): string {
  const text: string = locale === 'zh-TW' ? zhTW[key] : key;
  return text.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.hasOwn(values, name) ? String(values[name]) : match,
  );
}

/** Translate agent/service messages at the UI boundary without double-translating. */
export function translateMessage(message: string): string {
  if (Object.hasOwn(zhTW, message)) return t(message as MessageKey);
  const key = (Object.keys(zhTW) as MessageKey[]).find((candidate) => zhTW[candidate] === message);
  return key ? t(key) : message;
}
