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

        .month-btn.sent {
            background-color: #065f46;
            border-color: #059669;
            color: #d1fae5;
        }
        .month-btn.sent::before {
            content: '✓ ';
            font-size: 0.8em;
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

        /* 排除勾選框與時間日期的外觀清除 */
        input, select, textarea {
            color-scheme: dark !important; 
            box-sizing: border-box;
        }
        
        input:not([type="checkbox"]):not([type="time"]):not([type="date"]), select, textarea {
            -webkit-appearance: none;
            appearance: none;
        }

        /* 解決 iOS 點擊「清除」後時間框變完全空白的完美方案 */
        input[type="time"] {
            position: relative;
        }
        /* 當數值為空（無效）時，利用偽元素強制在方塊內印出灰色提示文字 */
        input[type="time"]:invalid::before {
            content: attr(placeholder);
            color: #6b7280; /* gray-500 */
            position: absolute;
            left: 10px;
            top: 50%;
            transform: translateY(-50%);
            pointer-events: none;
            font-size: 0.95rem;
        }
        /* 當選取了時間（有效）時，立刻隱藏提示文字，正常顯示時間數字 */
        input[type="time"]:valid::before {
            content: "" !important;
            display: none !important;
        }
    </style>
</head>
<body class="min-h-screen p-2 sm:p-4 font-sans text-gray-200 flex flex-col justify-start">
    
    <!-- === 修改重點：卡片最大寬度限制在 450px (max-w-[450px])，這在手機和電腦上比例都是最完美的 === -->
    <div class="w-full max-w-[450px] mx-auto bg-gray-800 rounded-xl shadow-2xl overflow-hidden p-4 sm:p-6 border border-gray-700 my-2 sm:my-4">
        
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
                    <!-- 修改：日期改回 w-full（在 450px 卡片下，能與其他方塊完美對齊） -->
                    <input type="date" id="date" class="mt-1 block w-full bg-gray-700 border border-gray-600 text-white rounded-md p-2.5 focus:ring-indigo-500 focus:border-indigo-500" required>
                </div>

                <div id="group-hourly">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-300">地點</label>
                        <input type="text" id="location" class="mt-1 block w-full bg-gray-700 border border-gray-600 text-white rounded-md p-2.5 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500" placeholder="例如：Server Room">
                        <div id="history-location" class="flex flex-wrap gap-2 mt-2"></div>
                    </div>
                    
                    <!-- 修改：改用 flex 佈局並加上 gap-3，100% 保證 iOS 上會有 12px 的優雅空隙，且寬度 w-full 能與其他方塊對齊 -->
                    <div class="flex gap-3">
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-300">開始時間</label>
                            <input type="time" id="start" placeholder="開始時間" required class="mt-1 block w-full border border-gray-600 bg-gray-700 text-white rounded-md p-2.5 focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        <div class="flex-1">
                            <label class="block text-sm font-medium text-gray-300">結束時間</label>
                            <input type="time" id="end" placeholder="結束時間" required class="mt-1 block w-full border border-gray-600 bg-gray-700 text-white rounded-md p-2.5 focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                    </div>

                    <!-- 修改：倍數按鈕也改為 w-full 撐滿，整體感極強 -->
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
                        <!-- 修改：結束日期改為 w-full 撐滿 -->
                        <input type="date" id="endDate" class="mt-1 block w-full border border-gray-600 bg-gray-700 text-white rounded-md p-2.5 focus:ring-indigo-500 focus:border-indigo-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300">金額 (HKD)</label>
                        <!-- 修改：金額改為 w-full 撐滿 -->
                        <input type="number" id="amount" class="mt-1 block w-full border border-gray-600 bg-gray-700 text-white rounded-md p-2.5 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500" placeholder="輸入金額">
                    </div>
                    <div id="field-remarks">
                        <label class="block text-sm font-medium text-gray-300" id="label-remarks">備註 (選填)</label>
                        <input type="text" id="moneyRemarks" class="mt-1 block w-full border border-gray-600 bg-gray-700 text-white rounded-md p-2.5 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500" placeholder="例如：重啟 Server">
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
            <div id="historyMonthsArea" class="mb-4 hidden">
                <div id="historyBadges" class="flex flex-wrap gap-2"></div>
            </div>
            
            <div id="queryControls" class="flex flex-col sm:flex-row gap-2 mb-4">
                <input type="month" id="queryMonth" class="w-full sm:flex-1 bg-gray-700 border-gray-600 text-white rounded-md p-2.5 focus:ring-indigo-500 focus:border-indigo-500">
                <div class="flex gap-2 w-full sm:w-auto">
                    <button onclick="loadRecords()" class="flex-1 sm:flex-initial bg-gray-700 border border-gray-600 text-white px-4 py-2.5 rounded-md hover:bg-gray-600 whitespace-nowrap transition">查詢</button>
                    <button onclick="copyShareLink()" id="btn-share" class="bg-blue-600 text-white px-3 py-2.5 rounded-md hover:bg-blue-500 whitespace-nowrap transition" title="複製分享連結">🔗</button>
                    <button onclick="toggleEditMode()" id="btn-edit" class="bg-gray-600 text-white px-3 py-2.5 rounded-md hover:bg-gray-500 whitespace-nowrap transition" title="管理/刪除">✏️</button>
                </div>
            </div>
            
            <div id="calendarView" class="mb-6 hidden bg-gray-900/50 p-2.5 rounded-lg border border-gray-700 max-w-md mx-auto">
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

            <div id="totalSummary" class="text-right border-t border-gray-700 pt-4 space-y-1 hidden text-sm sm:text-base">
                <div class="text-gray-300">總時數: <span id="sumHours" class="font-bold text-indigo-400 text-xl">0</span> hr</div>
                <div class="text-gray-300">總收入: <span id="sumMoney" class="font-bold text-emerald-400 text-xl">$0</span></div>
                <div class="text-gray-300">總交通: <span id="sumTransport" class="font-bold text-amber-400 text-xl">$0</span></div>
                <div class="text-gray-100 mt-2 pt-2 border-t border-gray-700 flex justify-end items-center">
                    <span id="uiUserNameDisplay" class="text-gray-500 font-bold text-lg mr-auto"></span>
                    <span>總計 (含交通): <span id="sumAll" class="font-bold text-xl">$0</span></span>
                </div>
            </div>
            <button onclick="generatePDF()" id="pdfBtn" class="w-full mt-4 bg-green-600 text-white py-3 sm:py-3.5 rounded-md font-bold hover:bg-green-500 hidden shadow-lg shadow-green-500/30 transition">
                下載 PDF 報表
            </button>
        </div>
        <p id="msg" class="mt-4 text-center text-sm font-bold min-h-[20px]"></p>
    </div>
</body>
</html>
`;