# Complete Project Codebase
Generated on: Wed Jul 15 10:39:21 UTC 2026

## File: README.md
````md
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

````

## File: src/ui/html.js
````js
export const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    
    <!-- iOS Web App 設定 -->
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="OT 記錄">
    
    <title>OT 記錄器 Pro</title>
    
    <!-- 網站圖標 -->
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📝</text></svg>">
    <link rel="apple-touch-icon" href="https://cdn-icons-png.flaticon.com/512/2535/2535556.png">

    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
    <script src="https://unpkg.com/@pdf-lib/fontkit@0.0.4/dist/fontkit.umd.min.js"></script>
    <style>
        body { background-color: #111827; }
        
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        
        .calendar-day { 
            text-align: center; 
            padding: 4px; 
            border-radius: 4px; 
            font-size: 0.8rem; 
            height: 36px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
        }
        @media (min-width: 640px) {
            .calendar-day {
                height: 40px;
                font-size: 0.875rem;
            }
        }
        
        /* 顏色標記 */
        .has-ot { background-color: #6366f1; color: white; font-weight: bold; box-shadow: 0 0 5px rgba(99, 102, 241, 0.5); }
        .has-money { background-color: #10b981; color: white; font-weight: bold; box-shadow: 0 0 5px rgba(16, 185, 129, 0.5); }
        .has-transport { background-color: #F59E0B; color: white; font-weight: bold; box-shadow: 0 0 5px rgba(245, 158, 11, 0.5); }
        
        .has-both { background: linear-gradient(135deg, #6366f1 50%, #10b981 50%); color: white; font-weight: bold; }
        .has-money-transport { background: linear-gradient(135deg, #10b981 50%, #f59e0b 50%); color: white; font-weight: bold; }
        .has-ot-transport { background: linear-gradient(135deg, #6366f1 50%, #f59e0b 50%); color: white; font-weight: bold; }
        .has-triple { background: linear-gradient(135deg, #6366f1 33%, #10b981 33%, #10b981 66%, #f59e0b 66%); color: white; font-weight: bold; }
        
        .no-ot { background-color: #374151; color: #9ca3af; }
        .empty-day { background-color: transparent; }

        .delete-ui { display: none !important; }
        .edit-mode .delete-ui { display: flex !important; }
        .edit-mode td.delete-ui, .edit-mode th.delete-ui { display: table-cell !important; }

        .status-ui { display: none !important; }
        .edit-mode .status-ui { display: flex !important; }

        /* 月份按鈕已發送樣式 */
        .month-btn.sent {
            background-color: #065f46 !important;
            border-color: #059669 !important;
            color: #d1fae5 !important;
        }
        .month-btn.sent::before {
            content: '✓ ';
            font-size: 0.8em;
        }

        /* 編輯模式下，月份按鈕呈現輕微 wiggling 以示警告（可选） */
        .edit-mode .month-btn {
            border-color: #ef4444 !important;
        }

        .history-chip {
            display: inline-flex; align-items: center; padding: 0.25rem 0.6rem; 
            border-radius: 9999px; font-size: 0.75rem; font-weight: 500; 
            background-color: #374151; color: #d1d5db; border: 1px solid #4b5563; 
            margin-right: 0.5rem; margin-bottom: 0.5rem; cursor: pointer; 
            user-select: none; transition: all 0.2s;
        }
        .history-chip:hover { background-color: #4b5563; color: white; }
        .history-delete {
            margin-left: 0.375rem; color: #9ca3af; font-weight: bold; 
            padding: 0 0.25rem; border-radius: 0.25rem; transition: all 0.2s; cursor: pointer;
        }
        .history-delete:hover { color: #f87171; background-color: #1f2937; }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* 排除勾選框、時間、日期的外觀清除 */
        input, select, textarea {
            color-scheme: dark !important; 
            box-sizing: border-box;
        }
        
        input:not([type="checkbox"]):not([type="time"]):not([type="date"]), select, textarea {
            -webkit-appearance: none;
            appearance: none;
        }

        /* 解決 iOS Safari 內建日期/時間/月份元件在空值時高度縮水的 WebKit 專屬標準 Bug 修正 */
        input::-webkit-date-and-time-value {
            min-height: 1.5em;
        }
    </style>
</head>
<body class="min-h-screen p-2 sm:p-4 font-sans text-gray-200 flex flex-col justify-start">
    
    <!-- 卡片最大寬度限制：手機端最大 450px，電腦端（md）擴展至 800px 確保橫向排版舒適 -->
    <div class="w-full max-w-[450px] md:max-w-[800px] mx-auto bg-gray-800 rounded-xl shadow-2xl overflow-hidden p-4 sm:p-6 border border-gray-700 my-2 sm:my-4 transition-all duration-300">
        
        <div id="mainTitleArea" class="text-center mb-6">
            <h1 class="text-2xl font-bold text-gray-100">OT 記錄器</h1>
        </div>

        <div id="authSection" class="mb-4 bg-gray-700 p-3 sm:p-4 rounded-lg border border-gray-600">
            <label class="block text-xs font-bold text-gray-300 mb-1">存取密碼 (PIN)</label>
            <input type="password" id="pin" class="w-full bg-gray-800 border-gray-600 text-white border rounded px-2.5 py-2 focus:ring-indigo-500 focus:border-indigo-500" placeholder="****">
            <div class="mt-2 flex items-center">
                <input type="checkbox" id="rememberPin" class="h-4 w-4 text-indigo-500 bg-gray-800 border-gray-600 rounded focus:ring-indigo-500 focus:ring-offset-gray-800">
                <label for="rememberPin" class="ml-2 block text-xs text-gray-300 font-bold cursor-pointer">記住密碼 (下次自動登入)</label>
            </div>
        </div>

        <div id="shareHeader" class="hidden mb-6 text-center">
            <h1 class="text-2xl font-bold text-white" id="shareTitle">OT 記錄報表</h1>
            <p class="text-sm text-gray-400 mt-1">唯讀模式</p>
        </div>

        <div class="flex border-b border-gray-700 mb-6" id="tabContainer">
            <button onclick="switchTab('record')" id="tab-record" class="flex-1 py-3 text-center font-bold text-indigo-400 border-b-2 border-indigo-500 transition hover:bg-gray-700/50">新增記錄</button>
            <button onclick="switchTab('export')" id="tab-export" class="flex-1 py-3 text-center text-gray-500 hover:text-indigo-400 hover:bg-gray-700/50 transition">月結報表</button>
        </div>

        <div id="view-record">
            <div class="flex gap-2 mb-4 bg-gray-900 p-1 rounded-lg overflow-x-auto border border-gray-700 no-scrollbar px-1">
                <button type="button" onclick="setType('hourly')" id="btn-hourly" class="flex-1 py-2.5 px-3 rounded-md text-sm font-bold bg-gray-700 text-white shadow transition">🕒 OT</button>
                <button type="button" onclick="setType('oncall')" id="btn-oncall" class="flex-1 py-2.5 px-3 rounded-md text-sm font-bold text-gray-400 hover:bg-gray-800 whitespace-nowrap transition">📅 當更</button>
                <button type="button" onclick="setType('percall')" id="btn-percall" class="flex-1 py-2.5 px-3 rounded-md text-sm font-bold text-gray-400 hover:bg-gray-800 whitespace-nowrap transition">📞 Call</button>
                <button type="button" onclick="setType('transport')" id="btn-transport" class="flex-1 py-2.5 px-3 rounded-md text-sm font-bold text-gray-400 hover:bg-gray-800 whitespace-nowrap transition">🚕 交通</button>
            </div>

            <form id="addForm" class="space-y-4">
                <input type="hidden" id="recordType" value="hourly">
                <div>
                    <label class="block text-sm font-medium text-gray-300" id="label-date">日期</label>
                    <div class="mt-1 flex items-center w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
                        <input type="date" id="date" class="w-full bg-transparent border-none p-0 text-white focus:ring-0 outline-none" required>
                    </div>
                </div>
                <div id="group-hourly">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-300">地點</label>
                        <input type="text" id="location" class="mt-1 block w-full bg-gray-700 border border-gray-600 text-white rounded-md py-2 px-3 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500" placeholder="例如：Server Room">
                        <div id="history-location" class="flex flex-wrap gap-2 mt-2"></div>
                    </div>
                    
                    <div class="flex space-x-3 w-full">
                        <div class="flex-1 min-w-0">
                            <label class="block text-sm font-medium text-gray-300">開始時間</label>
                            <div class="mt-1 flex items-center w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
                                <input type="time" id="start" required class="w-full bg-transparent border-none p-0 text-white focus:ring-0 outline-none">
                            </div>
                        </div>
                        <div class="flex-1 min-w-0">
                            <label class="block text-sm font-medium text-gray-300">結束時間</label>
                            <div class="mt-1 flex items-center w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
                                <input type="time" id="end" required class="w-full bg-transparent border-none p-0 text-white focus:ring-0 outline-none">
                            </div>
                        </div>
                    </div>

                    <div class="mt-4 mb-2">
                        <label class="block text-sm font-medium text-gray-300 mb-1">工數 (倍數)</label>
                        <div class="flex gap-2">
                            <input type="hidden" id="multiplier" value="1">
                            <button type="button" onclick="setMultiplier(1)" id="mul-1" class="flex-1 py-2.5 rounded border border-indigo-600 bg-indigo-600 text-white text-sm font-bold transition">x1</button>
                            <button type="button" onclick="setMultiplier(1.5)" id="mul-1.5" class="flex-1 py-2.5 rounded border border-gray-600 bg-gray-800 text-gray-400 text-sm font-bold hover:bg-gray-700 transition">x1.5</button>
                            <button type="button" onclick="setMultiplier(2)" id="mul-2" class="flex-1 py-2.5 rounded border border-gray-600 bg-gray-800 text-gray-400 text-sm font-bold hover:bg-gray-700 transition">x2</button>
                            <button type="button" onclick="setMultiplier(3)" id="mul-3" class="flex-1 py-2.5 rounded border border-gray-600 bg-gray-800 text-gray-400 text-sm font-bold hover:bg-gray-700 transition">x3</button>
                        </div>
                    </div>

                    <div class="text-right text-sm text-gray-400 mt-2" id="durationCalc">時數: 0 小時</div>
                </div>

                <div id="group-money" class="hidden space-y-4">
                    <div id="field-endDate" class="hidden">
                        <label class="block text-sm font-medium text-gray-300">結束日期 (至)</label>
                        <div class="mt-1 flex items-center w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
                            <input type="date" id="endDate" class="w-full bg-transparent border-none p-0 text-white focus:ring-0 outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300">金額 (HKD)</label>
                        <input type="number" id="amount" class="mt-1 block w-full border border-gray-600 bg-gray-700 text-white rounded-md py-2 px-3 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500" placeholder="輸入金額">
                    </div>
                    <div id="field-remarks">
                        <label class="block text-sm font-medium text-gray-300" id="label-remarks">備註 (選填)</label>
                        <input type="text" id="moneyRemarks" class="mt-1 block w-full border border-gray-600 bg-gray-700 text-white rounded-md py-2 px-3 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500" placeholder="例如：重啟 Server">
                        <div id="history-remarks" class="flex flex-wrap gap-2 mt-2"></div>
                        <select id="transportSelect" class="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2.5 hidden focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="停車場">停車場</option>
                            <option value="隧道">隧道</option>
                            <option value="維修">維修</option>
                            <option value="其他">其他</option>
                        </select>
                    </div>
                </div>

                <button type="submit" id="btn-submit-record" class="w-full bg-indigo-600 text-white py-3 sm:py-3.5 rounded-md font-bold hover:bg-indigo-500 transition shadow-lg shadow-indigo-500/30">儲存記錄</button>
            </form>
        </div>

        <div id="view-export" class="hidden">
            
            <!-- 歷史月份按鈕：手機端 4 欄，電腦端（md）自動延展至 6 欄 -->
            <div id="historyMonthsArea" class="mb-4 hidden">
                <div id="historyBadges" class="grid grid-cols-4 md:grid-cols-6 gap-2 mb-4"></div>
            </div>
            
            <div id="queryControls" class="flex flex-col sm:flex-row gap-2 mb-4">
                <div class="flex-1 flex items-center w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus-within:ring-2 focus-within:ring-indigo-500">
                    <input type="month" id="queryMonth" class="w-full bg-transparent border-none p-0 text-white focus:ring-0 outline-none">
                </div>
                <div class="flex gap-2 w-full sm:w-auto">
                    <button onclick="loadRecords()" class="flex-1 sm:flex-initial bg-gray-700 border border-gray-600 text-white px-4 py-2.5 rounded-md hover:bg-gray-600 whitespace-nowrap transition">查詢</button>
                    <button onclick="copyShareLink()" id="btn-share" class="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-500 whitespace-nowrap transition" title="複製分享連結">🔗</button>
                    <button onclick="toggleEditMode()" id="btn-edit" class="bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-500 whitespace-nowrap transition" title="管理/刪除">✏️</button>
                </div>
            </div>
            
            <!-- 月曆視圖：電腦端（md）最大寬度設為 lg 確保整體比例平衡 -->
            <div id="calendarView" class="mb-6 hidden bg-gray-900/50 p-2.5 rounded-lg border border-gray-700 max-w-md md:max-w-lg mx-auto">
                <div class="calendar-grid"></div>
                <div class="flex justify-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                    <span class="flex items-center"><span class="w-3 h-3 bg-indigo-500 rounded mr-1"></span>OT</span>
                    <span class="flex items-center"><span class="w-3 h-3 bg-emerald-500 rounded mr-1"></span>當更/Call</span>
                    <span class="flex items-center"><span class="w-3 h-3 bg-amber-500 rounded mr-1"></span>交通</span>
                </div>
            </div>

            <div id="recordsList" class="bg-gray-900 rounded-md border border-gray-700 p-3 sm:p-4 mb-4 max-h-80 overflow-y-auto overflow-x-auto text-sm space-y-2">
                <p class="text-center text-gray-500">請查詢</p>
            </div>

            <!-- 總結數據欄位（校正總時數至與其他行相同的 text-xl 比例大小） -->
            <div id="totalSummary" class="text-right border-t border-gray-700 pt-4 space-y-1 hidden text-sm sm:text-base">
                <div class="text-gray-300">總當更/Call: <span id="sumMoney" class="font-bold text-emerald-400 text-xl">$0</span></div>
                <div class="text-gray-300">總交通: <span id="sumTransport" class="font-bold text-amber-400 text-xl">$0</span></div>
                
                <!-- 底部隔線及統計：將總時數的大小比例調校一致 -->
                <div class="text-gray-100 mt-2 pt-2 border-t border-gray-700 space-y-1">
                    <div class="font-bold">總計 (含交通): <span id="sumAll" class="text-xl text-gray-100 font-bold">$0</span></div>
                    <div class="text-gray-300">總時數: <span id="sumHours" class="font-bold text-indigo-400 text-xl">0</span> hr</div>
                </div>
            </div>
            
            <button onclick="generatePDF()" id="pdfBtn" class="w-full mt-4 bg-green-600 text-white py-3 sm:py-3.5 rounded-md font-bold hover:bg-green-500 hidden shadow-lg shadow-green-500/30 transition">
                下載 PDF 報表
            </button>
        </div>
        <p id="msg" class="mt-4 text-center text-sm font-bold min-h-[20px]"></p>
    </div>

    <!-- === 新增：管理月份的 Action Sheet / 彈出式底部選單（徹底阻斷误觸） === -->
    <div id="monthActionModal" onclick="closeMonthModal()" class="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center hidden opacity-0 transition-opacity duration-300">
        <!-- 點擊內部區塊時防止因冒泡事件關閉視窗 -->
        <div id="monthActionSheet" onclick="event.stopPropagation();" class="w-full max-w-[450px] bg-gray-800 rounded-t-2xl sm:rounded-2xl border-t sm:border border-gray-700 p-6 space-y-4 transform translate-y-full sm:translate-y-0 sm:scale-95 transition-all duration-300 shadow-2xl">
            <div class="text-center">
                <h3 id="modalMonthTitle" class="text-lg font-bold text-gray-100 font-mono">管理月份</h3>
                <p class="text-xs text-gray-400 mt-1">請選擇要對該月份執行的安全操作</p>
            </div>
            <div class="flex flex-col gap-2.5 pt-2">
                <button type="button" id="modalToggleSentBtn" class="w-full py-3.5 px-4 text-sm font-bold text-emerald-200 bg-emerald-950/80 border border-emerald-800 rounded-xl hover:bg-emerald-900 transition flex items-center justify-center gap-2">
                    <span id="modalToggleSentIcon">📤</span> <span id="modalToggleSentText">標記為已提交</span>
                </button>
                <button type="button" id="modalDeleteBtn" class="w-full py-3.5 px-4 text-sm font-bold text-red-200 bg-red-950/80 border border-red-900 rounded-xl hover:bg-red-900 transition flex items-center justify-center gap-2">
                    🗑️ 刪除整月資料
                </button>
                <button type="button" onclick="closeMonthModal()" class="w-full py-3.5 px-4 text-sm font-bold text-gray-300 bg-gray-700/60 border border-gray-600 rounded-xl hover:bg-gray-600 transition">
                    取消
                </button>
            </div>
        </div>
    </div>
</body>
</html>
`;

````

## File: src/ui/index.js
````js
import { htmlContent } from './html.js';
import { logicScript } from './logic.js';
import { pdfScript } from './pdf.js';

// 接收 userName 參數
export function getHtml(userName = '') {
    // 防止 undefined 或 null 變成字串 "undefined"
    const safeName = userName || '';
    
    return `
        ${htmlContent}
        <script>
            // === 關鍵：將後端的名字注入到前端變數 ===
            window.USER_NAME = "${safeName}";
            // ===================================
            
            ${logicScript}
            ${pdfScript}
        </script>
        </body>
        </html>
    `;
}

````

## File: src/ui/pdf.js
````js
export const pdfScript = `
    async function generatePDF() {
        if(currentRecords.length === 0) return;
        const btn = document.getElementById('pdfBtn');
        const originalText = btn.innerText;
        
        btn.innerText = "載入字型與生成中... (請稍候)"; 
        btn.disabled = true;
        
        try {
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
            
            const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
            
            // === 獲取純文字字型並還原 ===
            const fontUrl = '/api/font'; 

            const fontRes = await fetch(fontUrl);
            if (!fontRes.ok) {
                const errText = await fontRes.text();
                throw new Error(\`字型載入失敗: \${errText}\`);
            }
            
            // 拿到 Base64 純文字
            const b64String = await fontRes.text();
            
            if (b64String.includes("<!DOC") || b64String.includes("<html")) {
                throw new Error("下載到無效的字型檔案，請確認 GitHub Actions 是否部署成功。");
            }

            // 在瀏覽器端將 Base64 轉換回二進位陣列
            const binaryString = window.atob(b64String);
            const len = binaryString.length;
            const fontBytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                fontBytes[i] = binaryString.charCodeAt(i);
            }

            const chineseFont = await pdfDoc.embedFont(fontBytes);
            // ============================================

            const page = pdfDoc.addPage([595.28, 841.89]);
            const { width, height } = page.getSize();
            let yPos = height - 60;
            const marginX = 40;

            const colorBlack = rgb(0, 0, 0);
            const colorGreen = rgb(0, 0.5, 0);
            const colorOrange = rgb(0.85, 0.5, 0);
            const colorBlue = rgb(0.38, 0.4, 0.94); // 藍色主題色 (對應網頁端 indigo-400)

            const monthStr = document.getElementById('queryMonth').value;
            page.drawText(monthStr, { x: marginX, y: yPos, size: 20, font: helveticaBold });
            page.drawText(' OT/當更/交通 記錄表', { x: marginX + 90, y: yPos, size: 20, font: chineseFont });
            
            if (window.USER_NAME) {
                const nameText = window.USER_NAME;
                const nameWidth = chineseFont.widthOfTextAtSize(nameText, 14);
                page.drawText(nameText, { x: width - marginX - nameWidth, y: yPos, size: 14, font: chineseFont, color: rgb(0.3, 0.3, 0.3) });
            }

            yPos -= 40;

            const col = { d: 40, item: 130, detail: 350, val: 480 };
            const fontSize = 11;
            const drawTxt = (text, x, font, color=colorBlack) => page.drawText(text, { x, y: yPos, size: fontSize, font, color });

            drawTxt('日期', col.d, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('項目/地點', col.item, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('時間/詳情', col.detail, chineseFont, rgb(0.5,0.5,0.5));
            drawTxt('時數/金額', col.val, chineseFont, rgb(0.5,0.5,0.5));
            
            page.drawLine({ start: { x: marginX, y: yPos-5 }, end: { x: width-marginX, y: yPos-5 }, thickness: 1, color: rgb(0.8,0.8,0.8) });
            yPos -= 25;

            for (const r of currentRecords) {
                const amount = Number(r.amount) || 0; 
                if (r.type !== 'hourly' && amount === 0) continue;

                let itemStr = '', detailStr = '', valStr = '';
                let detailFont = helvetica; 
                let rowColor = colorBlack;

                if (r.type === 'hourly') {
                    itemStr = r.location || 'OT';
                    const mins = getMinutesDiff(r.start, r.end);
                    detailStr = r.start.replace(':', '') + ' - ' + r.end.replace(':', '');
                    const mul = r.multiplier || 1;
                    const effectiveMins = mins * mul;
                    valStr = formatHours(effectiveMins) + ' hr';
                    if (mul > 1) valStr += ' (x' + mul + ')';
                    rowColor = colorBlue;
                } else if (r.type === 'transport') {
                    itemStr = '交通費';
                    detailStr = r.location ? r.location : '-';
                    detailFont = chineseFont; 
                    valStr = '$' + amount;
                    rowColor = colorOrange;
                } else if (r.type === 'oncall') {
                    itemStr = '當更 On-Call';
                    const startD = r.date.split('-')[2];
                    const endD = r.endDate ? r.endDate.split('-')[2] : '';
                    detailStr = startD + '日 - ' + endD + '日';
                    detailFont = chineseFont;
                    valStr = '$' + amount;
                    rowColor = colorGreen;
                } else { 
                    itemStr = 'Call';
                    detailStr = r.location ? r.location : '-';
                    detailFont = chineseFont;
                    valStr = '$' + amount;
                    rowColor = colorGreen;
                }

                drawTxt(r.date, col.d, helvetica);
                const safeItem = itemStr.length > 20 ? itemStr.substring(0,19)+'...' : itemStr;
                
                // === 已優化調整：將項目欄位（safeItem）也帶入與金額相同的 rowColor，實現統一上色 ===
                drawTxt(safeItem, col.item, chineseFont, rowColor);
                
                drawTxt(detailStr, col.detail, detailFont);
                drawTxt(valStr, col.val, helveticaBold, rowColor);

                page.drawLine({ start: { x: marginX, y: yPos-8 }, end: { x: width-marginX, y: yPos-8 }, thickness: 0.5, color: rgb(0.9,0.9,0.9) });
                yPos -= 25;
                
                if (yPos < 50) { pdfDoc.addPage([595.28, 841.89]); yPos = height - 50; }
            }

            yPos -= 10;
            page.drawLine({ start: { x: marginX, y: yPos }, end: { x: width-marginX, y: yPos }, thickness: 1 });
            yPos -= 25;

            // === 依據您的指定，重新安排 PDF 底部統計區塊的輸出順序 ===
            
            // 1. 總當更/Call
            drawTxt("總當更/Call: ", 350, chineseFont);
            drawTxt("$" + grandTotalMoney, 440, helveticaBold, colorGreen);
            yPos -= 20;

            // 2. 總交通
            drawTxt("總交通: ", 350, chineseFont);
            drawTxt("$" + grandTotalTransport, 440, helveticaBold, colorOrange);
            yPos -= 15;

            // 3. 統計小分隔線
            page.drawLine({ start: { x: 350, y: yPos }, end: { x: width-marginX, y: yPos }, thickness: 0.5, color: rgb(0.7,0.7,0.7) });
            yPos -= 20;

            // 4. 總計 (含交通)
            drawTxt("總計 (含交通): ", 350, chineseFont); 
            const totalAll = grandTotalMoney + grandTotalTransport;
            drawTxt("$" + totalAll, 440, helveticaBold, colorBlack); 
            yPos -= 20;

            // 5. 總時數
            drawTxt("總時數: ", 350, chineseFont);
            drawTxt(formatHours(grandTotalMinutes) + " hr", 440, helveticaBold, colorBlue);

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            
            let filename = 'OT_Record_' + monthStr + '.pdf';
            if (window.USER_NAME) filename = 'OT_Record_' + monthStr + '_' + window.USER_NAME + '.pdf';
            link.download = filename;
            
            link.click();

        } catch(err) { 
            console.error(err); 
            alert("生成失敗: " + err.message); 
        } finally { 
            btn.disabled = false; 
            btn.innerText = originalText; 
        }
    }
`;

````

## File: src/ui/logic.js
````js
export const logicScript = `
    const today = new Date();
    document.getElementById('date').valueAsDate = today;
    document.getElementById('endDate').valueAsDate = today;
    document.getElementById('queryMonth').value = today.toISOString().slice(0, 7);
    
    let currentRecords = [];
    let grandTotalMinutes = 0;
    let grandTotalMoney = 0;
    let grandTotalTransport = 0;
    let knownMonths = new Set();
    let sentMonths = new Set(); 
    let isEditMode = false;

    const urlParams = new URLSearchParams(window.location.search);
    const isShareMode = urlParams.get('view') === 'share';
    const sharedMonth = urlParams.get('month');

    // === 歷史記錄自訂儲存與渲染功能 ===
    function updateHistory(key, value) {
        if (!value || value.trim() === '') return;
        try {
            let history = JSON.parse(localStorage.getItem('ot_hist_' + key) || '[]');
            history = history.filter(v => v !== value);
            history.unshift(value);
            if (history.length > 5) history.pop();
            localStorage.setItem('ot_hist_' + key, JSON.stringify(history));
        } catch (e) {
            console.error(e);
        }
    }

    function renderHistoryChips(key, containerId, targetInputId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        try {
            const history = JSON.parse(localStorage.getItem('ot_hist_' + key) || '[]');
            if (history.length === 0) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = history.map(val => {
                const escapedVal = val.replace(/'/g, "\\\\'");
                return '<span class="history-chip" onclick="document.getElementById(\\'' + targetInputId + '\\').value=\\'' + escapedVal + '\\'; if(\\'' + targetInputId + '\\' === \\'location\\' && typeof updateDuration === \\'function\\') updateDuration();">' +
                    val +
                    '<span class="history-delete" onclick="event.stopPropagation(); deleteHistory(\\'' + key + '\\', \\'' + escapedVal + '\\', \\'' + containerId + '\\', \\'' + targetInputId + '\\')">×</span>' +
                    '</span>';
            }).join('');
        } catch (e) {
            console.error(e);
        }
    }

    function deleteHistory(key, val, containerId, targetInputId) {
        try {
            let history = JSON.parse(localStorage.getItem('ot_hist_' + key) || '[]');
            history = history.filter(v => v !== val);
            localStorage.setItem('ot_hist_' + key, JSON.stringify(history));
            renderHistoryChips(key, containerId, targetInputId);
        } catch (e) {
            console.error(e);
        }
    }

    (init)();

    function init() {
        // 網頁 UI 底部不顯示名字，僅供 PDF 使用
        updateDuration();

        if (isShareMode) {
            document.getElementById('mainTitleArea').classList.add('hidden');
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('tabContainer').classList.add('hidden');
            document.getElementById('view-record').classList.add('hidden');
            document.getElementById('view-export').classList.remove('hidden');
            
            document.getElementById('queryControls').classList.add('hidden');
            document.getElementById('historyMonthsArea').classList.add('hidden');
            
            document.getElementById('shareHeader').classList.remove('hidden');
            const monthLabel = sharedMonth ? ' (' + sharedMonth + ')' : '';
            if (window.USER_NAME) {
                document.getElementById('shareTitle').innerText = window.USER_NAME + " 的 OT 記錄" + monthLabel;
            } else {
                document.getElementById('shareTitle').innerText = "OT 記錄報表" + monthLabel;
            }

            if (sharedMonth) {
                document.getElementById('queryMonth').value = sharedMonth;
                loadRecords(true); 
            }
        } else {
            const savedPin = localStorage.getItem('ot_pin');
            if (savedPin) {
                document.getElementById('pin').value = savedPin;
                document.getElementById('rememberPin').checked = true;
                fetchHistoryMonths();
            }
            renderHistoryChips('location', 'history-location', 'location');
            renderHistoryChips('remarks', 'history-remarks', 'moneyRemarks');
        }
    }

    function managePinStorage() {
        if(isShareMode) return;
        const pin = document.getElementById('pin').value;
        const remember = document.getElementById('rememberPin').checked;
        if (remember && pin) {
            localStorage.setItem('ot_pin', pin);
        } else {
            localStorage.removeItem('ot_pin');
        }
    }

    function toggleEditMode() {
        const pin = document.getElementById('pin').value;
        if (!pin) return alert('請先輸入 PIN 密碼才能進入管理模式');
        
        isEditMode = !isEditMode;
        
        const btn = document.getElementById('btn-edit');
        const container = document.getElementById('view-export');
        
        if (isEditMode) {
            btn.classList.add('bg-red-600', 'hover:bg-red-500');
            btn.classList.remove('bg-gray-600', 'hover:bg-gray-500');
            btn.innerText = '完成';
            container.classList.add('edit-mode'); 
        } else {
            btn.classList.add('bg-gray-600', 'hover:bg-gray-500');
            btn.classList.remove('bg-red-600', 'hover:bg-red-500');
            btn.innerText = '✏️';
            container.classList.remove('edit-mode');
        }
    }

    // === 點擊月份按鈕時的路由分流控制（解決 misclick 的核心） ===
    function handleMonthClick(m) {
        if (isEditMode) {
            // 編輯模式：彈出管理彈出視窗
            openMonthModal(m);
        } else {
            // 正常模式：直接載入歷史資料
            document.getElementById('queryMonth').value = m;
            loadRecords();
        }
    }

    // === 月份管理彈出視窗控制（Action Sheet 觸發動畫與動態綁定） ===
    function openMonthModal(month) {
        const isSent = sentMonths.has(month);
        
        document.getElementById('modalMonthTitle').innerText = '管理 ' + month;
        document.getElementById('modalToggleSentText').innerText = isSent ? '取消提交狀態' : '標記為已提交';
        document.getElementById('modalToggleSentIcon').innerText = isSent ? '✕' : '📤';
        
        // 動態綁定 Toggle 提交按鈕動作
        document.getElementById('modalToggleSentBtn').onclick = async () => {
            const btn = document.getElementById('modalToggleSentBtn');
            await toggleSent(month, btn);
            closeMonthModal();
        };
        
        // 動態綁定 刪除 按鈕動作
        document.getElementById('modalDeleteBtn').onclick = async () => {
            const btn = document.getElementById('modalDeleteBtn');
            await deleteMonth(month, btn);
            closeMonthModal();
        };
        
        const modal = document.getElementById('monthActionModal');
        const sheet = document.getElementById('monthActionSheet');
        
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('opacity-100');
            modal.classList.remove('opacity-0');
            sheet.classList.remove('translate-y-full');
            sheet.classList.add('translate-y-0');
            sheet.classList.remove('sm:scale-95');
            sheet.classList.add('sm:scale-100');
        }, 10);
    }

    function closeMonthModal() {
        const modal = document.getElementById('monthActionModal');
        const sheet = document.getElementById('monthActionSheet');
        
        modal.classList.add('opacity-0');
        modal.classList.remove('opacity-100');
        sheet.classList.add('translate-y-full');
        sheet.classList.remove('translate-y-0');
        sheet.classList.add('sm:scale-95');
        sheet.classList.remove('sm:scale-100');
        
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }

    async function toggleSent(month, btnElement) {
        const pin = document.getElementById('pin').value;
        if (!pin) return;
        
        const originalText = btnElement.innerText;
        btnElement.innerText = '...';
        btnElement.disabled = true;
        
        try {
            const res = await fetch('/api/toggle_sent', {
                method: 'POST',
                body: JSON.stringify({ pin, month })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.list.includes(month)) {
                    sentMonths.add(month);
                } else {
                    sentMonths.delete(month);
                }
                renderMonthButtons();
            } else {
                throw new Error('操作失敗');
            }
        } catch (e) {
            alert(e.message);
            btnElement.innerText = originalText;
            btnElement.disabled = false;
        }
    }

    async function deleteMonth(month, btnElement) {
        if(!confirm('⚠️ 警告：確定要刪除[' + month + '] 的所有資料嗎？刪除後無法復原！')) return;
        const pin = document.getElementById('pin').value;
        btnElement.disabled = true; btnElement.innerText = '...';
        try {
            const res = await fetch('/api/delete_month', {
                method: 'POST',
                body: JSON.stringify({ pin, month })
            });
            if(res.ok) { 
                knownMonths.delete(month);
                sentMonths.delete(month);
                renderMonthButtons(); // 動態更新按鈕狀態

                const currentViewMonth = document.getElementById('queryMonth').value;
                if (currentViewMonth === month) {
                    document.getElementById('recordsList').innerHTML = '<p class="text-center text-gray-500">已刪除</p>';
                    document.getElementById('calendarView').classList.add('hidden');
                    document.getElementById('totalSummary').classList.add('hidden');
                    document.getElementById('pdfBtn').classList.add('hidden');
                }
                alert('已刪除 ' + month + ' 的資料');
            } else { throw new Error('刪除失敗'); }
        } catch(err) { alert(err.message); btnElement.disabled = false; btnElement.innerText = '刪除整月資料'; }
    }

    // === 正常狀態下的格狀月份按鈕渲染 ===
    function renderMonthButtons() {
        const area = document.getElementById('historyMonthsArea');
        const badges = document.getElementById('historyBadges');
        const sortedMonths = Array.from(knownMonths).sort().reverse();

        if (sortedMonths.length > 0) {
            area.classList.remove('hidden');
            badges.className = "grid grid-cols-4 md:grid-cols-6 gap-2 mb-4";
            badges.innerHTML = sortedMonths.map(m => {
                const isSent = sentMonths.has(m);
                const btnClass = isSent 
                    ? "month-btn sent w-full h-10 text-[10px] min-[375px]:text-xs font-bold border rounded-lg transition focus:outline-none shadow-sm cursor-pointer"
                    : "month-btn w-full h-10 text-[10px] min-[375px]:text-xs font-bold text-indigo-200 bg-indigo-900 border border-indigo-700 rounded-lg hover:bg-indigo-800 transition focus:outline-none shadow-sm cursor-pointer";

                // 將 onclick 導向統一分流處理函式 handleMonthClick
                return '<div class="relative w-full">' +
                    '<button type="button" onclick="handleMonthClick(\\'' + m + '\\')" class="' + btnClass + '">' + m + '</button>' +
                    '</div>';
            }).join('');
        } else {
            area.classList.add('hidden');
        }
    }

    function setType(type) {
        document.getElementById('amount').value = '';
        document.getElementById('moneyRemarks').value = ''; 
        document.getElementById('transportSelect').selectedIndex = 0; 
        document.getElementById('recordType').value = type;
        
        if (type !== 'hourly') {
            setMultiplier(1);
        }

        const btnTypes = ['hourly', 'oncall', 'percall', 'transport'];
        btnTypes.forEach(t => {
            const btn = document.getElementById('btn-' + t);
            if (btn) {
                if (t === type) {
                    btn.className = "flex-1 py-2.5 px-2 rounded-md text-sm font-bold bg-gray-700 text-white border border-gray-500 shadow whitespace-nowrap transition";
                } else {
                    btn.className = "flex-1 py-2.5 px-2 rounded-md text-sm font-bold text-gray-500 hover:bg-gray-800 hover:text-gray-300 whitespace-nowrap transition";
                }
            }
        });

        const groupHourly = document.getElementById('group-hourly');
        const groupMoney = document.getElementById('group-money');
        const fieldEndDate = document.getElementById('field-endDate');
        const fieldRemarks = document.getElementById('field-remarks');
        const labelDate = document.getElementById('label-date');
        const labelRemarks = document.getElementById('label-remarks');
        const inputRemarks = document.getElementById('moneyRemarks');
        const selectTransport = document.getElementById('transportSelect');

        if (type === 'hourly') {
            groupHourly.classList.remove('hidden');
            groupMoney.classList.add('hidden');
            labelDate.innerText = '日期';
            document.getElementById('start').required = true;
            document.getElementById('end').required = true;
            document.getElementById('amount').required = false;
        } else {
            groupHourly.classList.add('hidden');
            groupMoney.classList.remove('hidden');
            document.getElementById('start').required = false;
            document.getElementById('end').required = false;
            document.getElementById('amount').required = true;

            if (type === 'oncall') {
                labelDate.innerText = '開始日期';
                fieldEndDate.classList.remove('hidden');
                fieldRemarks.classList.add('hidden'); 
                document.getElementById('endDate').required = true;
            } else { 
                labelDate.innerText = '日期';
                fieldEndDate.classList.add('hidden');
                fieldRemarks.classList.remove('hidden'); 

                if (type === 'transport') {
                    labelRemarks.innerText = '行程/詳情';
                    inputRemarks.classList.add('hidden');
                    selectTransport.classList.remove('hidden');
                } else {
                    labelRemarks.innerText = '備註 (選填)';
                    inputRemarks.classList.remove('hidden');
                    selectTransport.classList.add('hidden');
                    inputRemarks.placeholder = '例如：重啟 Server';
                }
            }
        }
    }

    function setMultiplier(val) {
        document.getElementById('multiplier').value = val;
        const mulVals = [1, 1.5, 2, 3];
        mulVals.forEach(v => {
            const btnId = 'mul-' + v; 
            const btn = document.getElementById(btnId);
            if(btn) {
                if (v === val) {
                    btn.className = "flex-1 py-2.5 rounded border border-indigo-600 bg-indigo-600 text-white text-sm font-bold transition";
                } else {
                    btn.className = "flex-1 py-2.5 rounded border border-gray-600 bg-gray-800 text-gray-400 text-sm font-bold hover:bg-gray-700 transition";
                }
            }
        });
        updateDuration();
    }

    async function deleteRecord(id, date) {
        if(!confirm('確定要刪除這筆記錄嗎？')) return;
        const pin = document.getElementById('pin').value;
        try {
            const res = await fetch('/api/delete', {
                method: 'POST',
                body: JSON.stringify({ pin, id, date })
            });
            if(res.ok) { loadRecords(); } else { throw new Error('刪除失敗'); }
        } catch(err) { alert(err.message); }
    }

    async function fetchHistoryMonths() {
        const pin = document.getElementById('pin').value;
        if(!pin) return;
        managePinStorage();
        try {
            const res = await fetch(\`/api/list_months?pin=\${pin}\`);
            const data = await res.json();
            if(!data.error) {
                knownMonths.clear();
                if (Array.isArray(data)) {
                    data.forEach(m => knownMonths.add(m));
                } else if (data.months) {
                    data.months.forEach(m => knownMonths.add(m));
                    sentMonths = new Set(data.sentList || []);
                }
                renderMonthButtons();
            }
        } catch(e) {
            console.error("載入月份失敗:", e);
        }
    }

    document.getElementById('pin').addEventListener('blur', fetchHistoryMonths);

    function getMinutesDiff(start, end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 24 * 60; 
        return diff;
    }
    function formatHours(minutes) { return (minutes / 60).toFixed(1); }

    document.getElementById('start').addEventListener('change', updateDuration);
    document.getElementById('end').addEventListener('change', updateDuration);
    
    function updateDuration() {
        const s = document.getElementById('start').value;
        const e = document.getElementById('end').value;
        const mul = parseFloat(document.getElementById('multiplier').value) || 1;
        
        if (s && e) {
            const mins = getMinutesDiff(s, e);
            const effectiveMins = mins * mul;
            const hoursStr = formatHours(mins);
            const effHoursStr = formatHours(effectiveMins);
            
            if (mul === 1) {
                document.getElementById('durationCalc').innerText = '時數: ' + hoursStr + ' 小時';
            } else {
                document.getElementById('durationCalc').innerText = '時數: ' + hoursStr + ' hr (x' + mul + ') = ' + effHoursStr + ' 小時';
            }
        } else {
            document.getElementById('durationCalc').innerText = "時數: 0 小時";
        }
    }

    function switchTab(tab) {
        document.getElementById('view-record').classList.toggle('hidden', tab !== 'record');
        document.getElementById('view-export').classList.toggle('hidden', tab !== 'export');
        if (tab === 'export' && document.getElementById('pin').value) {
            fetchHistoryMonths();
        }
        
        const active = "flex-1 py-3 text-center font-bold text-indigo-400 border-b-2 border-indigo-500 transition hover:bg-gray-700/50";
        const inactive = "flex-1 py-3 text-center text-gray-500 hover:text-indigo-400 hover:bg-gray-700/50 transition";
        document.getElementById('tab-record').className = tab === 'record' ? active : inactive;
        document.getElementById('tab-export').className = tab === 'export' ? active : inactive;
    }

    document.getElementById('addForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = document.getElementById('pin').value;
        if (!pin) return alert('請先輸入 PIN 密碼');
        const btn = document.getElementById('btn-submit-record');
        btn.disabled = true; btn.innerText = '儲存中...';
        managePinStorage();
        try {
            const type = document.getElementById('recordType').value;
            const payload = { 
                pin, 
                type, 
                date: document.getElementById('date').value,
                multiplier: document.getElementById('multiplier').value 
            };
            if (type === 'hourly') {
                payload.location = document.getElementById('location').value;
                payload.start = document.getElementById('start').value;
                payload.end = document.getElementById('end').value;
                updateHistory('location', payload.location);
            } else {
                payload.amount = Number(document.getElementById('amount').value) || 0;
                if (type === 'transport') {
                    payload.location = document.getElementById('transportSelect').value;
                } else {
                    payload.location = document.getElementById('moneyRemarks').value || '';
                    if (payload.location) {
                        updateHistory('remarks', payload.location);
                    }
                }
                if (type === 'oncall') {
                    payload.endDate = document.getElementById('endDate').value;
                }
            }
            const res = await fetch('/api/add', { method: 'POST', body: JSON.stringify(payload) });
            if (res.ok) {
                document.getElementById('msg').innerText = '✅ 儲存成功';
                document.getElementById('msg').className = 'mt-4 text-center text-sm font-bold text-green-400';
                document.getElementById('amount').value = '';
                document.getElementById('location').value = '';
                document.getElementById('moneyRemarks').value = '';
                document.getElementById('transportSelect').selectedIndex = 0; 
                setMultiplier(1);
                const currentMonth = payload.date.substring(0, 7);
                knownMonths.add(currentMonth);
                fetchHistoryMonths();
                renderHistoryChips('location', 'history-location', 'location');
                renderHistoryChips('remarks', 'history-remarks', 'moneyRemarks');
                setTimeout(() => document.getElementById('msg').innerText = '', 2000);
            } else { throw new Error(await res.text()); }
        } catch(err) { alert(err.message); } 
        finally { btn.disabled = false; btn.innerText = '儲存記錄'; }
    });

    function renderCalendar(year, month, records) {
        const grid = document.querySelector('.calendar-grid');
        grid.innerHTML = '';
        
        const otDays = new Set();
        const moneyDays = new Set();
        const transportDays = new Set();

        records.forEach(r => {
            const d = parseInt(r.date.split('-')[2]);
            if (r.type === 'hourly') otDays.add(d);
            else if (r.type === 'transport') transportDays.add(d);
            else {
                moneyDays.add(d);
                if (r.type === 'oncall' && r.endDate) {
                    const start = new Date(r.date);
                    const end = new Date(r.endDate);
                    for (let dt = start; dt <= end; dt.setDate(dt.getDate() + 1)) {
                        if (dt.getMonth() + 1 === month) moneyDays.add(dt.getDate());
                    }
                }
            }
        });

        const daysInMonth = new Date(year, month, 0).getDate();
        const firstDay = new Date(year, month - 1, 1).getDay();

        for (let i = 0; i < firstDay; i++) grid.appendChild(document.createElement('div'));
        
        for (let d = 1; d <= daysInMonth; d++) {
            const div = document.createElement('div');
            div.innerText = d;
            
            const hasOT = otDays.has(d);
            const hasMoney = moneyDays.has(d);
            const hasTransport = transportDays.has(d);

            if (hasOT && hasMoney && hasTransport) {
                div.className = 'calendar-day has-triple';
            } else if (hasOT && hasMoney) {
                div.className = 'calendar-day has-both';
            } else if (hasMoney && hasTransport) {
                div.className = 'calendar-day has-money-transport';
            } else if (hasOT && hasTransport) {
                div.className = 'calendar-day has-ot-transport';
            } else if (hasOT) {
                div.className = 'calendar-day has-ot';
            } else if (hasMoney) {
                div.className = 'calendar-day has-money';
            } else if (hasTransport) {
                div.className = 'calendar-day has-transport';
            } else {
                div.className = 'calendar-day no-ot';
            }
            grid.appendChild(div);
        }
        document.getElementById('calendarView').classList.remove('hidden');
    }

    async function loadRecords(forcePublic = false) {
        const pin = document.getElementById('pin').value;
        const monthStr = document.getElementById('queryMonth').value; 
        
        if (!isShareMode && !pin) return alert('請先輸入 PIN 密碼');
        if (!isShareMode) managePinStorage();

        const listEl = document.getElementById('recordsList');
        const summaryEl = document.getElementById('totalSummary');
        
        listEl.innerHTML = '<p class="text-center text-gray-400">載入中...</p>';
        
        try {
            let url;
            if (isShareMode || forcePublic) {
                url = '/api/public/get?month=' + monthStr;
            } else {
                url = '/api/get?month=' + monthStr + '&pin=' + pin;
            }

            const res = await fetch(url);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            
            currentRecords = data;
            grandTotalMinutes = 0;
            grandTotalMoney = 0;
            grandTotalTransport = 0;
            
            const [y, m] = monthStr.split('-').map(Number);
            renderCalendar(y, m, data);

            if (data.length === 0) {
                listEl.innerHTML = '<p class="text-center text-gray-500">無記錄</p>';
                summaryEl.classList.add('hidden');
                document.getElementById('pdfBtn').classList.add('hidden');
            } else {
                // === 網頁表頭修改：與 PDF 報表完全一致（日期、項目/地點、時間/詳情、時數/金額） ===
                let html = '<table class="w-full text-left text-gray-300"><thead><tr class="text-gray-500 border-b border-gray-700"><th>日期</th><th>項目/地點</th><th class="text-right">時間/詳情</th><th class="text-right">時數/金額</th><th class="text-right w-10 delete-ui">操作</th></tr></thead><tbody>';
                
                if (isShareMode) {
                    html = '<table class="w-full text-left text-gray-300"><thead><tr class="text-gray-500 border-b border-gray-700"><th>日期</th><th>項目/地點</th><th class="text-right">時間/詳情</th><th class="text-right">時數/金額</th></tr></thead><tbody>';
                }

                data.forEach(r => {
                    const amount = Number(r.amount) || 0; 
                    if (r.type !== 'hourly' && amount === 0) return;

                    let detail = '', value = '', typeLabel = '';
                    
                    if (r.type === 'hourly') {
                        const mins = getMinutesDiff(r.start, r.end);
                        const mul = r.multiplier || 1;
                        const effectiveMins = mins * mul;
                        grandTotalMinutes += effectiveMins;
                        
                        // 1. 項目/地點：藍色
                        typeLabel = '<span class="text-indigo-400 font-bold">' + (r.location || 'OT') + '</span>';
                        detail = r.start.replace(':', '') + ' - ' + r.end.replace(':', '');
                        const mulLabel = mul > 1 ? ' (x' + mul + ')' : '';
                        
                        // 2. 時數/金額：同步上色（藍色）
                        value = '<span class="text-indigo-400 font-bold">' + formatHours(effectiveMins) + ' hr' + mulLabel + '</span>';
                    } else if (r.type === 'transport') {
                        grandTotalTransport += amount;
                        
                        // 1. 項目/地點：橙色
                        typeLabel = '<span class="text-amber-400 font-bold">交通費</span>';
                        detail = r.location ? '<span class="text-gray-400">' + r.location + '</span>' : '-';
                        
                        // 2. 時數/金額：同步上色（橙色）
                        value = '<span class="text-amber-400 font-bold">$' + amount + '</span>';
                    } else if (r.type === 'oncall') {
                        grandTotalMoney += amount;
                        
                        // 1. 項目/地點：綠色
                        typeLabel = '<span class="text-emerald-400 font-bold">當更</span>'; 
                        const startD = r.date.split('-')[2];
                        const endD = r.endDate ? r.endDate.split('-')[2] : '';
                        detail = startD + '日 - ' + endD + '日'; 
                        
                        // 2. 時數/金額：同步上色（綠色）
                        value = '<span class="text-emerald-400 font-bold">$' + amount + '</span>';
                    } else { 
                        grandTotalMoney += amount;
                        
                        // 1. 項目/地點：綠色
                        typeLabel = '<span class="text-emerald-400 font-bold">Call</span>';
                        detail = r.location ? '<span class="text-gray-400">' + r.location + '</span>' : '-';
                        
                        // 2. 時數/金額：同步上色（綠色）
                        value = '<span class="text-emerald-400 font-bold">$' + amount + '</span>';
                    }

                    const [yr, mo, dy] = r.date.split('-');
                    const formattedDate = yr + '年' + parseInt(mo) + '月' + parseInt(dy) + '日';

                    const deleteBtn = isShareMode ? '' : '<td class="py-2 text-right delete-ui"><button onclick="deleteRecord(' + r.id + ', \\'' + r.date + '\\')" class="text-red-400 hover:text-red-300 text-xs">🗑️</button></td>';

                    html += '<tr class="border-b border-gray-700 last:border-0 hover:bg-gray-800 transition">' +
                        '<td class="py-2 text-xs md:text-sm">' + formattedDate + '</td>' +
                        '<td class="py-2 text-xs md:text-sm">' + typeLabel + '</td>' +
                        '<td class="py-2 text-right text-xs md:text-sm font-mono text-gray-400">' + detail + '</td>' +
                        '<td class="py-2 text-right text-xs md:text-sm font-bold">' + value + '</td>' +
                        deleteBtn +
                        '</tr>';
                });
                
                html += '</tbody></table>';
                listEl.innerHTML = html;

                const totalAll = grandTotalMoney + grandTotalTransport;
                document.getElementById('sumHours').innerText = formatHours(grandTotalMinutes);
                document.getElementById('sumMoney').innerText = '$' + grandTotalMoney;
                document.getElementById('sumTransport').innerText = '$' + grandTotalTransport;
                document.getElementById('sumAll').innerText = '$' + totalAll; 
                
                summaryEl.classList.remove('hidden');
                document.getElementById('pdfBtn').classList.remove('hidden');
                
                if (isEditMode) {
                    document.getElementById('view-export').classList.add('edit-mode');
                }
            }
        } catch (err) { 
            alert(err.message); 
        }
    }
`;

````

## File: src/index.js
````js
import { handleAdd, handleGet, handleListMonths, handleDelete, handleDeleteMonth, handlePublicGet, handleToggleSent, handleGetFont } from './api.js';
import { getHtml } from './ui/index.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/add' && request.method === 'POST') return handleAdd(request, env);
    if (url.pathname === '/api/delete' && request.method === 'POST') return handleDelete(request, env);
    if (url.pathname === '/api/delete_month' && request.method === 'POST') return handleDeleteMonth(request, env);
    if (url.pathname === '/api/toggle_sent' && request.method === 'POST') return handleToggleSent(request, env);
    if (url.pathname === '/api/get' && request.method === 'GET') return handleGet(request, env);
    if (url.pathname === '/api/public/get' && request.method === 'GET') return handlePublicGet(request, env);
    if (url.pathname === '/api/list_months' && request.method === 'GET') return handleListMonths(request, env);
    
    // === 註冊讀取字型的 API ===
    if (url.pathname === '/api/font' && request.method === 'GET') return handleGetFont(request, env);

    const userName = (env.USER_NAME && env.USER_NAME !== "REPLACE_ME_NAME") ? env.USER_NAME : "";
    
    return new Response(getHtml(userName), {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};

````

## File: src/api.js
````js
export async function handleAdd(request, env) {
    try {
        const data = await request.json();
        if (data.pin !== env.AUTH_PIN) return new Response('密碼錯誤', { status: 401 });

        const monthKey = `OT_${data.date.substring(0, 7)}`;
        let records = await env.OT_RECORDS.get(monthKey, { type: 'json' });
        if (!records) records =[];

        records.push({
            id: Date.now(),
            type: data.type || 'hourly',
            date: data.date,
            endDate: data.endDate,
            location: data.location,
            start: data.start,
            end: data.end,
            multiplier: data.multiplier ? parseFloat(data.multiplier) : 1,
            amount: data.amount ? parseInt(data.amount) : 0,
            timestamp: new Date().toISOString()
        });

        records.sort((a, b) => new Date(a.date) - new Date(b.date));
        await env.OT_RECORDS.put(monthKey, JSON.stringify(records));

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function handleDelete(request, env) {
    try {
        const data = await request.json();
        if (data.pin !== env.AUTH_PIN) return new Response('密碼錯誤', { status: 401 });

        const monthKey = `OT_${data.date.substring(0, 7)}`;
        let records = await env.OT_RECORDS.get(monthKey, { type: 'json' });
        if (!records) return new Response(JSON.stringify({ success: false }), { status: 404 });

        const newRecords = records.filter(r => r.id !== data.id);
        await env.OT_RECORDS.put(monthKey, JSON.stringify(newRecords));

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function handleDeleteMonth(request, env) {
    try {
        const data = await request.json();
        if (data.pin !== env.AUTH_PIN) return new Response('密碼錯誤', { status: 401 });
        const monthKey = `OT_${data.month}`;
        await env.OT_RECORDS.delete(monthKey);
        
        let sentList = await env.OT_RECORDS.get("OT_META_SENT", { type: 'json' }) ||[];
        if (sentList.includes(data.month)) {
            sentList = sentList.filter(m => m !== data.month);
            await env.OT_RECORDS.put("OT_META_SENT", JSON.stringify(sentList));
        }

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function handleToggleSent(request, env) {
    try {
        const data = await request.json();
        if (data.pin !== env.AUTH_PIN) return new Response('密碼錯誤', { status: 401 });

        let sentList = await env.OT_RECORDS.get("OT_META_SENT", { type: 'json' }) ||[];
        
        if (sentList.includes(data.month)) {
            sentList = sentList.filter(m => m !== data.month);
        } else {
            sentList.push(data.month);
        }
        
        await env.OT_RECORDS.put("OT_META_SENT", JSON.stringify(sentList));

        return new Response(JSON.stringify({ success: true, list: sentList }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function handleGet(request, env) {
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    const pin = url.searchParams.get('pin');
    if (pin !== env.AUTH_PIN) return new Response(JSON.stringify({ error: '密碼錯誤' }), { status: 401 });
    const key = `OT_${month}`;
    const records = await env.OT_RECORDS.get(key, { type: 'json' }) ||[];
    return new Response(JSON.stringify(records), { headers: { 'Content-Type': 'application/json' } });
}

export async function handlePublicGet(request, env) {
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    const key = `OT_${month}`;
    const records = await env.OT_RECORDS.get(key, { type: 'json' }) ||[];
    return new Response(JSON.stringify(records), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleListMonths(request, env) {
    const url = new URL(request.url);
    const pin = url.searchParams.get('pin');
    if (pin !== env.AUTH_PIN) return new Response(JSON.stringify({ error: '密碼錯誤' }), { status: 401 });
    
    const list = await env.OT_RECORDS.list({ prefix: "OT_" });
    const months = list.keys
        .map(k => k.name.replace('OT_', ''))
        .filter(m => m.match(/^\d{4}-\d{2}$/)); 
    
    months.sort().reverse();
    const sentList = await env.OT_RECORDS.get("OT_META_SENT", { type: 'json' }) ||[];

    return new Response(JSON.stringify({ months, sentList }), { headers: { 'Content-Type': 'application/json' } });
}

// === 從 KV 讀取 Base64 純文字字型 ===
export async function handleGetFont(request, env) {
    try {
        const b64 = await env.OT_RECORDS.get('SYSTEM_FONT_B64');
        if (!b64) return new Response("Font not found in KV", { status: 404 });
        
        return new Response(b64, {
            headers: {
                "Content-Type": "text/plain",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

````

## File: wrangler.toml
````toml
name = "ot-generator"
main = "src/index.js"
compatibility_date = "2023-12-01"

# KV 設定
[[kv_namespaces]]
binding = "OT_RECORDS"
id = "REPLACE_ME_KV_ID"  # <--- 這裡維持佔位符

# === 修改重點：加入 vars 區塊 ===
[vars]
USER_NAME = "REPLACE_ME_NAME"  # <--- 這裡放名字佔位符

````

## File: .github/workflows/deploy.yml
````yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches:
      - main
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Inject KV ID
        run: |
          sed -i 's/REPLACE_ME_KV_ID/${{ secrets.OT_KV_ID }}/g' wrangler.toml

      - name: Inject User Name
        run: |
          sed -i "s/REPLACE_ME_NAME/${{ secrets.USER_NAME }}/g" wrangler.toml

      # === 1. 下載並轉換為純文字 ===
      - name: Download and Convert Font
        run: |
          echo "正在查詢最新版本的字型..."
          TTF_URL=$(curl -s -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" https://api.github.com/repos/justfont/open-huninn-font/releases/latest | jq -r '.assets[] | select(.name | endswith(".ttf")) | .browser_download_url' | head -n 1)
          
          if [ -z "$TTF_URL" ] || [ "$TTF_URL" == "null" ]; then
            echo "錯誤：在最新版本中找不到 .ttf 檔案！"
            exit 1
          fi
          
          echo "找到最新字型檔案：$TTF_URL"
          curl -L -o font.ttf "$TTF_URL"
          
          echo "正在轉換為 Base64 純文字以防止資料損壞..."
          base64 -w 0 font.ttf > font_b64.txt

      # === 2. 上傳至 KV (修正為 v4 語法：kv key put) ===
      - name: Upload Font to KV
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: kv key put --namespace-id=${{ secrets.OT_KV_ID }} "SYSTEM_FONT_B64" --path font_b64.txt

      # === 3. 部署 Worker ===
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          secrets: |
            AUTH_PIN
        env:
          AUTH_PIN: ${{ secrets.AUTH_PIN }}

````

## File: .github/workflows/combine-code.yml
````yml
name: Generate All Codebase to MD

on:
  push:
    branches:
      - main
    paths-ignore:
      - 'combined_project_code.md' # 避免此檔案自身更新引發無限循環
  workflow_dispatch: # 支援在 GitHub 網頁上手動觸發執行

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Combine All Files into MD
        run: |
          OUT_FILE="combined_project_code.md"
          echo "# Complete Project Codebase" > "$OUT_FILE"
          echo "Generated on: $(date)" >> "$OUT_FILE"
          echo "" >> "$OUT_FILE"

          # 遍歷專案內的所有檔案，排除依賴、Git 歷史、打包產物及二進位檔案
          find . -type f \
            -not -path "*/node_modules/*" \
            -not -path "*/.git/*" \
            -not -path "*/dist/*" \
            -not -name "package-lock.json" \
            -not -name "yarn.lock" \
            -not -name "pnpm-lock.yaml" \
            -not -name "$OUT_FILE" \
            -not -name "*.png" \
            -not -name "*.jpg" \
            -not -name "*.jpeg" \
            -not -name "*.gif" \
            -not -name "*.ico" \
            -not -name "*.woff*" \
            -not -name "*.ttf" | while read -r file; do
              
              # 取得相對路徑與副檔名
              rel_path="${file#./}"
              ext="${file##*.}"
              
              # 如果無副檔名，清除變數避免格式混亂
              if [ "$ext" = "$rel_path" ]; then
                ext=""
              fi
              
              # 寫入檔案標題
              echo "## File: $rel_path" >> "$OUT_FILE"
              # 使用四個反單引號（````）包裹，防止內部程式碼的三個反單引號造成排版衝突
              echo "\`\`\`\`$ext" >> "$OUT_FILE"
              cat "$file" >> "$OUT_FILE"
              echo "" >> "$OUT_FILE"
              echo "\`\`\`\`" >> "$OUT_FILE"
              echo "" >> "$OUT_FILE"
          done

      - name: Commit and Push changes
        run: |
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add combined_project_code.md
          
          if git diff --staged --quiet; then
            echo "No changes in codebase."
          else
            git commit -m "docs: auto-generate complete codebase [skip ci]"
            git push origin main
          fi

````

