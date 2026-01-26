export const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW" class="dark">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OT 記錄器 Pro</title>
    
    <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>📝</text></svg>">

    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
    <script src="https://unpkg.com/@pdf-lib/fontkit@0.0.4/dist/fontkit.umd.min.js"></script>
    <style>
        body { background-color: #111827; }
        
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .calendar-day { text-align: center; padding: 4px; border-radius: 4px; font-size: 0.8rem; height: 32px; display: flex; align-items: center; justify-content: center; }
        
        .has-ot { background-color: #6366f1; color: white; font-weight: bold; box-shadow: 0 0 5px rgba(99, 102, 241, 0.5); }
        .has-money { background-color: #10b981; color: white; font-weight: bold; box-shadow: 0 0 5px rgba(16, 185, 129, 0.5); }
        .has-transport { background-color: #F59E0B; color: white; font-weight: bold; box-shadow: 0 0 5px rgba(245, 158, 11, 0.5); }
        
        .has-both { 
            background: linear-gradient(135deg, #6366f1 50%, #10b981 50%); 
            color: white; font-weight: bold; 
        }
        .has-money-transport { 
            background: linear-gradient(135deg, #10b981 50%, #F59E0B 50%); 
            color: white; font-weight: bold; 
        }
        .has-ot-transport { 
            background: linear-gradient(135deg, #6366f1 50%, #F59E0B 50%); 
            color: white; font-weight: bold; 
        }
        .has-triple {
            background: linear-gradient(135deg, 
                #6366f1 33%, 
                #10b981 33%, #10b981 66%, 
                #F59E0B 66%);
            color: white; font-weight: bold;
        }
        
        .no-ot { background-color: #374151; color: #9CA3AF; }
        .empty-day { background-color: transparent; }

        .delete-ui { display: none !important; }
        .edit-mode .delete-ui { display: flex !important; }
        .edit-mode td.delete-ui, .edit-mode th.delete-ui { display: table-cell !important; }
        
        /* 歷史記錄標籤樣式 - 修改部分 */
        .history-chip {
            /* 加入 cursor-pointer 確保滑鼠變手形，select-none 防止反白文字 */
            @apply inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600 mr-2 mb-2 cursor-pointer select-none transition hover:bg-gray-600 hover:text-white;
        }
        .history-delete {
            /* 刪除按鈕 X 的樣式，Hover 時變紅色 */
            @apply ml-1.5 text-gray-400 hover:text-red-400 font-bold px-1 rounded hover:bg-gray-800 transition;
        }
    </style>
</head>
<body class="min-h-screen p-4 font-sans text-gray-200">
    <div class="max-w-3xl mx-auto bg-gray-800 rounded-xl shadow-2xl overflow-hidden p-6 border border-gray-700">
        
        <div id="mainTitleArea" class="text-center mb-6">
            <h1 class="text-2xl font-bold text-gray-100">OT 記錄器</h1>
        </div>

        <div id="authSection" class="mb-4 bg-gray-700 p-3 rounded-lg border border-gray-600">
            <label class="block text-xs font-bold text-gray-300 mb-1">存取密碼 (PIN)</label>
            <input type="password" id="pin" class="w-full bg-gray-800 border-gray-600 text-white border rounded px-2 py-1 focus:ring-indigo-500 focus:border-indigo-500" placeholder="****">
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
            <div class="flex gap-2 mb-4 bg-gray-900 p-1 rounded-lg overflow-x-auto border border-gray-700">
                <button type="button" onclick="setType('hourly')" id="btn-hourly" class="flex-1 py-2 px-2 rounded-md text-sm font-bold bg-gray-700 text-white shadow transition">🕒 OT</button>
                <button type="button" onclick="setType('oncall')" id="btn-oncall" class="flex-1 py-2 px-2 rounded-md text-sm font-bold text-gray-400 hover:bg-gray-800 transition">📅 當更</button>
                <button type="button" onclick="setType('percall')" id="btn-percall" class="flex-1 py-2 px-2 rounded-md text-sm font-bold text-gray-400 hover:bg-gray-800 transition">📞 Call</button>
                <button type="button" onclick="setType('transport')" id="btn-transport" class="flex-1 py-2 px-2 rounded-md text-sm font-bold text-gray-400 hover:bg-gray-800 transition">🚕 交通</button>
            </div>

            <form id="addForm" class="space-y-4">
                <input type="hidden" id="recordType" value="hourly">
                
                <div>
                    <label class="block text-sm font-medium text-gray-300" id="label-date">日期</label>
                    <input type="date" id="date" class="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500" required>
                </div>

                <div id="group-hourly">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-300">地點</label>
                        <input type="text" id="location" class="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500" placeholder="例如：Server Room">
                        <div id="history-location" class="flex flex-wrap gap-2 mt-2"></div>
                    </div>
                    
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-300">開始時間</label>
                            <input type="time" id="start" class="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-300">結束時間</label>
                            <input type="time" id="end" class="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500">
                        </div>
                    </div>

                    <div class="mt-4 mb-2">
                        <label class="block text-sm font-medium text-gray-300 mb-1">工數 (倍數)</label>
                        <div class="flex gap-2">
                            <input type="hidden" id="multiplier" value="1">
                            <button type="button" onclick="setMultiplier(1)" id="mul-1" class="flex-1 py-2 rounded border border-indigo-600 bg-indigo-600 text-white text-sm font-bold transition">x1</button>
                            <button type="button" onclick="setMultiplier(1.5)" id="mul-1.5" class="flex-1 py-2 rounded border border-gray-600 bg-gray-800 text-gray-400 text-sm font-bold hover:bg-gray-700 transition">x1.5</button>
                            <button type="button" onclick="setMultiplier(2)" id="mul-2" class="flex-1 py-2 rounded border border-gray-600 bg-gray-800 text-gray-400 text-sm font-bold hover:bg-gray-700 transition">x2</button>
                            <button type="button" onclick="setMultiplier(3)" id="mul-3" class="flex-1 py-2 rounded border border-gray-600 bg-gray-800 text-gray-400 text-sm font-bold hover:bg-gray-700 transition">x3</button>
                        </div>
                    </div>

                    <div class="text-right text-sm text-gray-400 mt-2" id="durationCalc">時數: 0 小時</div>
                </div>

                <div id="group-money" class="hidden space-y-4">
                    <div id="field-endDate" class="hidden">
                        <label class="block text-sm font-medium text-gray-300">結束日期 (至)</label>
                        <input type="date" id="endDate" class="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-300">金額 (HKD)</label>
                        <input type="number" id="amount" class="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500" placeholder="輸入金額">
                    </div>
                    <div id="field-remarks">
                        <label class="block text-sm font-medium text-gray-300" id="label-remarks">備註 (選填)</label>
                        <input type="text" id="moneyRemarks" class="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 placeholder-gray-500 focus:ring-indigo-500 focus:border-indigo-500" placeholder="例如：重啟 Server">
                        
                        <!-- 備註歷史記錄 (現在只有 Call 會顯示，但我們邏輯已修改為不儲存) -->
                        <!-- 為了兼容舊資料，此容器仍保留，但新資料不會再寫入 -->
                        <div id="history-remarks" class="flex flex-wrap gap-2 mt-2"></div>

                        <select id="transportSelect" class="mt-1 block w-full bg-gray-700 border-gray-600 text-white rounded-md p-2 hidden focus:ring-indigo-500 focus:border-indigo-500">
                            <option value="停車場">停車場</option>
                            <option value="隧道">隧道</option>
                            <option value="維修">維修</option>
                            <option value="其他">其他</option>
                        </select>
                    </div>
                </div>

                <button type="submit" id="btn-submit-record" class="w-full bg-indigo-600 text-white py-3 rounded-md font-bold hover:bg-indigo-500 transition shadow-lg shadow-indigo-500/30">儲存記錄</button>
            </form>
        </div>

        <div id="view-export" class="hidden">
            <div id="historyMonthsArea" class="mb-4 hidden">
                <div id="historyBadges" class="flex flex-wrap gap-2"></div>
            </div>
            <div class="flex gap-2 mb-4">
                <input type="month" id="queryMonth" class="flex-1 bg-gray-700 border-gray-600 text-white rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500">
                <button onclick="loadRecords()" class="bg-gray-700 border border-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-600 whitespace-nowrap transition">查詢</button>
                <button onclick="copyShareLink()" id="btn-share" class="bg-blue-600 text-white px-3 py-2 rounded-md hover:bg-blue-500 whitespace-nowrap transition" title="複製分享連結">🔗</button>
                <button onclick="toggleEditMode()" id="btn-edit" class="bg-gray-600 text-white px-3 py-2 rounded-md hover:bg-gray-500 whitespace-nowrap transition" title="管理/刪除">✏️</button>
            </div>
            
            <div id="calendarView" class="mb-6 hidden bg-gray-900/50 p-2 rounded-lg border border-gray-700">
                <div class="calendar-grid"></div>
                <div class="flex justify-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
                    <span class="flex items-center"><span class="w-3 h-3 bg-indigo-500 rounded mr-1"></span>OT</span>
                    <span class="flex items-center"><span class="w-3 h-3 bg-emerald-500 rounded mr-1"></span>當更/Call</span>
                    <span class="flex items-center"><span class="w-3 h-3 bg-amber-500 rounded mr-1"></span>交通</span>
                </div>
            </div>

            <div id="recordsList" class="bg-gray-900 rounded-md border border-gray-700 p-4 mb-4 max-h-80 overflow-y-auto text-sm space-y-2">
                <p class="text-center text-gray-500">請查詢</p>
            </div>

            <div id="totalSummary" class="text-right border-t border-gray-700 pt-4 space-y-1 hidden">
                <div class="text-gray-300">總時數: <span id="sumHours" class="font-bold text-indigo-400 text-xl">0</span> hr</div>
                <div class="text-gray-300">總收入: <span id="sumMoney" class="font-bold text-emerald-400 text-xl">$0</span></div>
                <div class="text-gray-300">總交通: <span id="sumTransport" class="font-bold text-amber-400 text-xl">$0</span></div>
                <div class="text-gray-100 mt-2 pt-2 border-t border-gray-700 flex justify-end items-center">
                    <span>總計 (含交通): <span id="sumAll" class="font-bold text-xl">$0</span></span>
                </div>
            </div>
            <button onclick="generatePDF()" id="pdfBtn" class="w-full mt-4 bg-green-600 text-white py-3 rounded-md font-bold hover:bg-green-500 hidden shadow-lg shadow-green-500/30 transition">
                下載 PDF 報表
            </button>
        </div>
        <p id="msg" class="mt-4 text-center text-sm font-bold min-h-[20px]"></p>
    </div>
`;
