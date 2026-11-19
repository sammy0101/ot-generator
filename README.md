# OT 記錄器 Pro (OT Record Generator)

一個基於 Cloudflare Workers 與 KV 構建的輕量級加班、當更與交通費記錄工具。採用 **Liquid Glass（液態玻璃）** 視覺介面，支援自動生成 A4 PDF 報表、月曆視覺化顯示以及唯讀分享功能。

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)
![KV Storage](https://img.shields.io/badge/Database-Workers_KV-blue?style=flat-square)
![PDF Generation](https://img.shields.io/badge/PDF-pdf--lib-red?style=flat-square)

## ✨ 主要功能

*   **多種類型記錄**：
    *   🕒 **時數 OT**：記錄加班日期、地點（支援常用地點歷史標籤快速帶入）與時段，支援工數倍數（`x1`、`x1.5`、`x2`、`x3`）自動換算總時數。
    *   ⏱️ **半小時制時間輸入**：分鐘限定 `00` 與 `30`。電腦端支援鍵盤直接輸入與方向鍵調整（未輸入分鐘自動帶入 `00`）；手機端點擊時間欄位會彈出仿 iPhone 計時器的雙欄上下滑動滾輪（開啟時自動定位至目前小時）。
    *   📅 **當更 (On-Call)**：記錄當更日期範圍與津貼。
    *   📞 **Call**：記錄每次出勤津貼與備註。
    *   🚕 **交通費**：記錄實報實銷的交通費用（支援下拉選單：停車場、隧道、維修、其他）。
*   **視覺化月曆與報表**：
    *   以顏色區分不同類型的記錄（藍色 OT、綠色 當更/Call、橙色 交通）。
    *   支援**雙色/三色條紋**顯示，若同一天有多種類型記錄，月曆格子會自動顯示對應條紋。
    *   網頁列表與 PDF 統一採用「日期、項目/地點、時間/詳情、時數/金額」表頭與對應色彩標記，底部依序彙整「總當更/Call」、「總交通」、「總計 (含交通)」與「總時數」。
    *   支援月份「已提交 (`✓`)」狀態標記，方便追蹤申報進度。
*   **PDF 報表生成**：
    *   前端使用 `pdf-lib` 自動生成 A4 格式 PDF。
    *   支援**中文字型**（部署時自動自 GitHub 下載 `justfont/open-huninn-font` 粉圓體並寫入 KV，由 `/api/font` 提供）。
    *   自動計算總當更/Call、總交通、總計與總時數，檔名與抬頭自動帶入使用者名稱。
*   **安全性與分享**：
    *   **PIN 碼保護**：寫入與讀取資料需輸入密碼（支援「記住密碼」）。
    *   **分享連結**：可生成唯讀連結，供他人查看或下載單月報表，無需密碼（內建剪貼簿相容複製機制）。
*   **現代化介面與防誤觸管理**：
    *   採用 **Liquid Glass（液態玻璃）** 風格設計，搭配響應式寬度（手機端最佳化與電腦端加寬排版）。
    *   點擊管理模式（✏️）後點選月份會彈出 **Action Sheet 選單**（標記提交 / 刪除整月 / 取消），避免在手機上誤觸刪除。

## 🛠️ 技術架構

*   **Runtime**: Cloudflare Workers (Serverless)
*   **Database**: Cloudflare Workers KV (Key-Value Storage)
*   **Frontend**: Vanilla JS + Tailwind CSS (由 Worker 直接回傳 HTML)
*   **PDF Library**: `pdf-lib` + `fontkit`
*   **CI/CD**: GitHub Actions 手動觸發部署

## 🚀 部署教學

本專案設計為使用 **GitHub Actions** 進行部署，您無需在本地安裝複雜環境。

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
| `USER_NAME` | 您的名字 (顯示在報表抬頭與 PDF 上) | `陳大文` |

### 4. 開始部署
*   `deploy.yml` 已設定為**手動觸發**（`workflow_dispatch`），推送程式碼至 `main` 不會自動部署 Worker。
*   請前往 GitHub Repository 上方的 **Actions** 分頁，選擇 **Deploy to Cloudflare Workers**，點擊右側 **Run workflow** 即可執行部署（部署時會一併下載最新粉圓體字型並上傳至 KV）。

## 📂 專案結構

```text
ot-generator/
├── .github/workflows/
│   ├── deploy.yml        # GitHub Actions 手動部署腳本 (上傳字型至 KV + 部署 Worker)
│   └── combine-code.yml  # 自動將專案程式碼彙整為 combined_project_code.md
├── src/
│   ├── index.js          # 程式入口與路由 (Router)
│   ├── api.js            # 後端邏輯 (CRUD KV 資料庫與字型讀取)
│   └── ui/               # 前端程式碼
│       ├── index.js      # UI 組裝與 USER_NAME 注入
│       ├── html.js       # HTML 結構、Liquid Glass 樣式與滾輪/Action Sheet 視窗
│       ├── logic.js      # 前端互動邏輯 (時間輸入/滾輪、月曆、管理彈窗、UI 控制)
│       └── pdf.js        # PDF 生成邏輯 (pdf-lib)
└── wrangler.toml         # Cloudflare 設定檔模板
```

## 📖 使用說明

1.  **登入**：開啟部署後的網址，輸入您在 Secrets 設定的 `AUTH_PIN`。
2.  **新增記錄**：
    *   選擇類型 (OT / 當更 / Call / 交通)。
    *   填寫日期、時間（僅限 `00` / `30` 分鐘）或金額與工數倍數。
    *   按下「儲存記錄」。
3.  **月結報表**：
    *   切換到「月結報表」分頁。
    *   系統會自動列出已有記錄的月份，點擊月份按鈕即可載入。
    *   點擊「下載 PDF 報表」即可匯出檔案。
4.  **管理與刪除資料**：
    *   點擊查詢列右側的 `✏️` 按鈕進入管理模式（按鈕會變為紅色的「完成」）。
    *   **單筆刪除**：點擊下方記錄列表右側的垃圾桶圖示 🗑️。
    *   **月份提交狀態與整月刪除**：於管理模式下直接點擊上方任一月份按鈕，透過底部彈出的選單選擇「標記為已提交 / 取消提交狀態」或「刪除整月資料」。
5.  **分享**：
    *   在月結報表頁面點擊 🔗 按鈕，複製連結給他人。該連結不需要 PIN 碼即可查看或下載該月報表。

## 📝 注意事項

*   **資料延遲**：Cloudflare KV 具有「最終一致性」特性，刪除或新增資料後，列表更新可能會有數秒鐘的延遲，這是正常現象。
*   **中文字型**：PDF 生成使用部署時自動從 GitHub (`justfont/open-huninn-font`) 下載並轉存至 Workers KV (`SYSTEM_FONT_B64`) 的粉圓體字型，首次生成 PDF 時瀏覽器會向 `/api/font` 載入並快取字型檔，請稍候片刻。

---
Created with ❤️ by Cloudflare Workers
