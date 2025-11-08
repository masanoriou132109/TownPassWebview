# SafeTrace WebView (React + TypeScript + Vite)

為 TownPass SafeTrace 微服務打造的 React WebView 專案，採用 Vite 作為開發環境並整合官方 UI kit 主色系。基礎頁面已定義 SafeTrace 核心區塊：Hero、服務指標、功能說明與整合亮點。

## 技術堆疊

- TypeScript + React 18
- Vite 開發與建置
- CSS Modules（原生 CSS，於 `src/index.css` 與 `src/App.css` 定義 TownPass 調色盤、排版與元件樣式）

## 開發

```bash
npm install
npm run dev
```

開發伺服器啟動後即可於 `http://localhost:5173` 檢視 SafeTrace 基礎頁面。

## 目錄重點

- `src/index.css`：TownPass 主色、字體與全域樣式設定。
- `src/App.tsx`：SafeTrace 初始頁面結構（Hero、統計卡片、功能卡片、整合亮點）。
- `src/App.css`：對應的版面配置與元件樣式。

後續若需新增模組，可沿用現有色彩變數與版型規則。
