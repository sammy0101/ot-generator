# OT 記錄器 Pro (OT Record Generator)

一個基於 Cloudflare Workers 與 KV 構建的輕量級加班、當更與交通費記錄工具。採用 **Liquid Glass（液態玻璃）** 視覺介面，支援自動生成 A4 PDF 報表、月曆視覺化顯示以及唯讀分享功能。

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)
![KV Storage](https://img.shields.io/badge/Database-Workers_KV-blue?style=flat-square)
![PDF Generation](https://img.shields.io/badge/PDF-pdf--lib-red?style=flat-square)

## ✨ 主要功能

*   **密碼登入與 30 天滑動續期**：
    *   登入後即可使用完整新增、查詢、編輯與刪除功能，不需重複在介面輸入 PIN 碼。
    *   採用 `HttpOnly` + HMAC-SHA256 簽章 Session Cookie；勾選「保持登入」時每次造訪或操作都會自動刷新 30 天有效期，僅於連續 30 天未登入時才需重新輸入密碼。
*   **多種類型記錄與單筆編輯**：
    *   🕒 **時數 OT**：記錄加班日期、地點（支援常用地點歷史標籤快速帶入）與時段，支援工數倍數（`x1`、`x1.5`、`x2`、`x3`）自動換算總時數。
    *   ⏱️ **半小時制時間輸入**：分鐘限定 `00` 與 `30`。電腦端支援鍵盤直接輸入與方向鍵調整；手機端點擊時間欄位會彈出雙欄上下滑動滾輪。
    *   📅 **當更 (On-Call)**、📞 **Call**、🚕 **交通費**。
    *   ✏️ **單筆編輯**：於管理模式下可直接修改既有記錄的日期（含跨月移動）、時間、地點、倍數或金額，並即時同步畫面。
*   **視覺化月曆與 PDF 報表**：
    *   以顏色與多色條紋區分不同記錄，並修正跨時區與跨月當更計算。
    *   前端使用 `pdf-lib` 生成 A4 PDF，支援 Cache API 本地持久快取字型與欄位寬度自動截斷保護。
*   **唯讀分享連結**：
    *   可生成單月唯讀連結（`?view=share&month=YYYY-MM`），供他人免密碼瀏覽與下載 PDF 報表。

## 🛠️ 技術架構

*   **Runtime**: Cloudflare Workers (Serverless)
*   **Database**: Cloudflare Workers KV (Key-Value Storage)
*   **Auth**: Web Crypto HMAC-SHA256 `HttpOnly` Cookie Session (Sliding 30-day TTL) + Same-Origin CSRF Check
*   **Frontend**: Vanilla JS + Tailwind CSS (由 Worker 直接回傳 HTML)
*   **PDF Library**: `pdf-lib` + `fontkit`
*   **CI/CD**: GitHub Actions 手動觸發部署

## 🚀 部署與 Secret 設定

1. 於 Cloudflare 建立 KV Namespace，取得 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`OT_KV_ID`。
2. 於 GitHub Repository Secrets 設定：
   * `AUTH_PIN`：系統登入密碼（後端同時支援 `AUTH_PASSWORD` 或 `AUTH_PIN`）。
   * `USER_NAME`：報表與頁首顯示的使用者名稱。
3. 前往 GitHub **Actions** 手動執行 **Deploy to Cloudflare Workers** 完成字型上傳與部署。

## 📂 專案結構

```text
ot-generator/
├── .github/workflows/
│   ├── deploy.yml        # GitHub Actions 手動部署腳本
│   └── combine-code.yml  # 彙整專案程式碼為 combined_project_code.md
├── src/
│   ├── index.js          # 路由與頁首 SSR 登入狀態檢查
│   ├── auth.js           # 固定時間密碼比對、HMAC Cookie 簽發/驗證與 30 天滑動續期
│   ├── api.js            # CRUD API（含輸入驗證、UUID 與即時回傳更新）
│   └── ui/
│       ├── index.js      # HTML 組裝與安全變數注入
│       ├── html.js       # 登入閘門、主畫面與編輯彈窗結構
│       ├── logic.js      # 登入狀態機、401 攔截、XSS 防護、月曆與編輯邏輯
│       └── pdf.js        # PDF 生成與 Cache API 字型快取
└── wrangler.toml
```

---
Created with ❤️ by Cloudflare Workers
