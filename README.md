# OT 記錄器 Pro (OT Record Generator)

一個基於 Cloudflare Workers 與 KV 構建的輕量級加班、當更與交通費記錄工具。支援自動生成 PDF 報表、月曆視覺化顯示以及唯讀分享功能。

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)
![KV Storage](https://img.shields.io/badge/Database-Workers_KV-blue?style=flat-square)
![PDF Generation](https://img.shields.io/badge/PDF-pdf--lib-red?style=flat-square)

## ✨ 主要功能

*   **多種類型記錄**：
    *   🕒 **時數 OT**：記錄加班時段，自動計算時數。
    *   📅 **當更 (On-Call)**：記錄當更日期範圍與津貼。
    *   📞 **Call**：記錄每次出勤津貼與備註。
    *   🚕 **交通費**：記錄實報實銷的交通費用（支援下拉選單：停車場、隧道、維修等）。
*   **視覺化月曆**：
    *   以顏色區分不同類型的記錄（藍色 OT、綠色 收入、橙色 交通）。
    *   支援**雙色/三色條紋**顯示，若同一天有多種類型記錄，格子會自動變色。
*   **PDF 報表生成**：
    *   前端自動生成 A4 格式 PDF。
    *   支援**中文字型** (Noto Sans TC)。
    *   自動計算總時數、總收入與總交通費。
    *   檔名與內容自動帶入使用者名稱。
*   **安全性與分享**：
    *   **PIN 碼保護**：寫入與讀取資料需輸入密碼（支援「記住密碼」）。
    *   **分享連結**：可生成唯讀連結，供他人查看或下載報表，無需密碼。
*   **現代化介面**：使用 Tailwind CSS 設計，響應式佈局，手機電腦皆可用。

## 🛠️ 技術架構

*   **Runtime**: Cloudflare Workers (Serverless)
*   **Database**: Cloudflare Workers KV (Key-Value Storage)
*   **Frontend**: Vanilla JS + Tailwind CSS (由 Worker 直接回傳 HTML)
*   **PDF Library**: `pdf-lib` + `fontkit`
*   **CI/CD**: GitHub Actions 自動部署

## 🚀 部署教學

本專案設計為使用 **GitHub Actions** 進行自動部署，您無需在本地安裝複雜環境。

### 1. 前置準備
1.  擁有一個 Cloudflare 帳號。
2.  Fork 或 Clone 此儲存庫到您的 GitHub。

### 2. 設定 Cloudflare
1.  登入 Cloudflare Dashboard，進入 **Workers & Pages**。
2.  建立一個 **KV Namespace**：
    *   名稱隨意，例如 `OT_RECORDS`。
    *   建立後，複製該 Namespace 的 **ID**。
3.  獲取 **Account ID** (在 Workers 首頁右側)。
4.  建立 **API Token**：
    *   權限選擇「Edit Cloudflare Workers」。
    *   **重要**：確保該 Token 有權限編輯 KV Storage。

### 3. 設定 GitHub Secrets
進入您的 GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**，新增以下 Repository secrets：

| Secret 名稱 | 說明 | 範例 |
| :--- | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | 您的 Cloudflare API Token | `xRw...` |
| `CLOUDFLARE_ACCOUNT_ID` | 您的 Cloudflare Account ID | `a1b2...` |
| `OT_KV_ID` | 步驟 2 建立的 KV Namespace ID | `4f8e...` |
| `AUTH_PIN` | 您想設定的登入密碼 (PIN) | `123456` |
| `USER_NAME` | 您的名字 (顯示在報表與 PDF 上) | `陳大文` |

### 4. 開始部署
*   只要您 `git push` 到 `main` 分支，GitHub Actions 就會自動觸發並部署到 Cloudflare Workers。
*   您也可以在 GitHub Actions 頁面手動觸發部署 (Workflow Dispatch)。

## 📂 專案結構

```text
ot-generator/
├── .github/workflows/
│   └── deploy.yml      # GitHub Actions 部署腳本
├── src/
│   ├── index.js        # 程式入口與路由 (Router)
│   ├── api.js          # 後端邏輯 (CRUD KV 資料庫)
│   └── ui/             # 前端程式碼
│       ├── index.js    # UI 組裝
│       ├── html.js     # HTML 結構與 CSS
│       ├── logic.js    # 前端互動邏輯 (Fetch, Calendar, UI control)
│       └── pdf.js      # PDF 生成邏輯 (pdf-lib)
└── wrangler.toml       # Cloudflare 設定檔模板
```

## 📖 使用說明

1.  **登入**：開啟部署後的網址，輸入您在 Secrets 設定的 `AUTH_PIN`。
2.  **新增記錄**：
    *   選擇類型 (OT / 當更 / Call / 交通)。
    *   填寫日期、時間或金額。
    *   按下「儲存記錄」。
3.  **月結報表**：
    *   切換到「月結報表」分頁。
    *   系統會自動列出已有記錄的月份，點擊按鈕即可載入。
    *   點擊「下載 PDF 報表」即可匯出檔案。
4.  **刪除資料**：
    *   單筆刪除：點擊列表右側的垃圾桶圖示。
    *   整月刪除：在月份按鈕旁點擊 `✕`。
5.  **分享**：
    *   在月結報表頁面點擊 🔗 按鈕，複製連結給他人。該連結不需要 PIN 碼即可查看。

## 📝 注意事項

*   **資料延遲**：Cloudflare KV 具有「最終一致性」特性，刪除或新增資料後，列表更新可能會有數秒鐘的延遲，這是正常現象。本程式已在前端做了快取優化來改善體驗。
*   **中文字型**：PDF 生成使用 Google Noto Sans TC (思源黑體) 的 CDN 資源，首次生成可能需要下載字型檔，請稍候片刻。

---
Created with ❤️ by Cloudflare Workers
