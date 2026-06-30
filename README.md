# 台服 PoE2 過濾器製造機

專為台服 Path of Exile 2 玩家製作的繁體中文過濾器製造機。介面使用繁中顯示，匯出的 `.filter` 仍保留遊戲可讀取的英文語法。

## 本機開發

```bash
pnpm install
pnpm dev
```

本機網址預設為 `http://127.0.0.1:5173/`。

## 建置

```bash
pnpm build
```

建置結果會輸出到 `dist/`。

## Vercel 部署

1. 將專案推送到 GitHub。
2. 到 Vercel 新增專案並匯入 GitHub repo。
3. Framework Preset 選 Vite，Build Command 使用 `pnpm build`，Output Directory 使用 `dist`。
4. 第一版可先使用 Vercel 提供的 `*.vercel.app` 網址。
5. 後續推送到 `main` 分支後，Vercel 會自動重新部署。
6. 如果 Vercel 專案網址不是 `poe2-tw-filter-maker.vercel.app`，請同步更新 `public/sitemap.xml`。

## Google AdSense 環境變數

尚未取得 AdSense 發布商 ID 時，保持以下預設即可。網站會顯示廣告預留框，但不會載入 Google AdSense script。

```env
VITE_ENABLE_ADSENSE=false
VITE_ADSENSE_CLIENT_ID=
VITE_AD_SLOT_LEFT=
VITE_AD_SLOT_RIGHT=
VITE_AD_SLOT_MOBILE=
```

取得 AdSense ID 與廣告版位後，在 Vercel Project Settings -> Environment Variables 設定：

```env
VITE_ENABLE_ADSENSE=true
VITE_ADSENSE_CLIENT_ID=ca-pub-xxxxxxxxxxxxxxxx
VITE_AD_SLOT_LEFT=你的左側廣告 slot
VITE_AD_SLOT_RIGHT=你的右側廣告 slot
VITE_AD_SLOT_MOBILE=你的手機版廣告 slot
```

同時更新 `public/ads.txt`，將範本中的 `pub-0000000000000000` 換成自己的 AdSense 發布商 ID。

## 上線前檢查

```bash
pnpm test
pnpm build
```

確認匯出頁可以下載 `.filter`，並檢查隱私權政策、使用說明、免責聲明、聯絡方式可以從頁尾開啟。
