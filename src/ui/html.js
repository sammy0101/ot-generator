export const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OT 記錄器 Pro</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
    <script src="https://unpkg.com/@pdf-lib/fontkit@0.0.4/dist/fontkit.umd.min.js"></script>
    <style>
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .calendar-day { text-align: center; padding: 4px; border-radius: 4px; font-size: 0.8rem; height: 32px; display: flex; align-items: center; justify-content: center; }
        .has-ot { background-color: #4F46E5; color: white; font-weight: bold; }
        .has-money { background-color: #059669; color: white; font-weight: bold; }
        .has-both { background: linear-gradient(135deg, #4F46E5 50%, #059669 50%); color: white; font-weight: bold; }
        .no-ot { background-color: #F3F4F6; color: #9CA3AF; }
        .empty-day { background-color: transparent; }
    </style>
</head>
<body class="bg-gray-100 min-h-screen p-4 font-sans">
    <div class="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden p-6">
        
        <div class="mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
            <label class="block text-xs font-bold text-gray-700 mb-1">存取密碼 (PIN)</label>
            <input type="password" id="pin" class="w-full border-gray-300 border rounded px-2 py-1" placeholder="****">
        </div>

        <div class="flex border-b mb-6">
            <button onclick="switchTab('record')" id="tab-record" class="flex-1 py-3 text-center font-bold text-indigo-600 border-b-2 border-indigo-600 transition">新增記錄</button>
            <button onclick="switchTab('export')" id="tab-export" class="flex-1 py-3 text-center text-gray-500 hover:text-indigo-500 transition">月結報表</button>
        </div>

        <div id="view-record">
            <div class="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
                <button type="button" onclick="setType('hourly')" id="btn-hourly" class="flex-1 py-2 rounded-md text-sm font-bold bg-white shadow text-indigo-600 transition">🕒 時數 OT</button>
                <button type="button" onclick="setType('oncall')" id="btn-oncall" class="flex-1 py-2 rounded-md text-sm font-bold text-gray-500 transition">📅 當更</button>
                <button type="button" onclick="setType('percall')" id="btn-percall" class="flex-1 py-2 rounded-md text-sm font-bold text-gray-500 transition">📞 Call</button>
            </div>

            <form id="addForm" class="space-y-4">
                <input type="hidden" id="recordType" value="hourly">
                
                <div>
                    <label class="block text-sm font-medium text-gray-700" id="label-date">日期</label>
                    <input type="date" id="date" class="mt-1 block w-full border border-gray-300 rounded-md p-2" required>
                </div>

                <div id="group-hourly">
                    <div class="mb-4">
                        <label class="block text-sm font-medium text-gray-700">地點</label>
                        <input type="text" id="location" class="mt-1 block w-full border border-gray-300 rounded-md p-2" placeholder="例如：Server Room">
                    </div>
                    <div class="grid grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium text-gray-700">開始時間</label>
                            <input type="time" id="start" class="mt-1 block w-full border border-gray-300 rounded-md p-2">
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700">結束時間</label>
                            <input type="time" id="end" class="mt-1 block w-full border border-gray-300 rounded-md p-2">
                        </div>
                    </div>
                    <div class="text-right text-sm text-gray-500 mt-2" id="durationCalc">時數: 0 小時</div>
                </div>

                <div id="group-money" class="hidden space-y-4">
                    <div id="field-endDate" class="hidden">
                        <label class="block text-sm font-medium text-gray-700">結束日期 (至)</label>
                        <input type="date" id="endDate" class="mt-1 block w-full border border-gray-300 rounded-md p-2">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">金額 (HKD)</label>
                        <input type="number" id="amount" class="mt-1 block w-full border border-gray-300 rounded-md p-2" placeholder="輸入金額">
                    </div>
                    <!-- 修改重點：給備註加了 id="field-remarks" 以便控制顯示/隱藏 -->
                    <div id="field-remarks">
                        <label class="block text-sm font-medium text-gray-700">備註 (選填)</label>
                        <input type="text" id="moneyRemarks" class="mt-1 block w-full border border-gray-300 rounded-md p-2" placeholder="例如：重啟 Server / 1號舖">
                    </div>
                </div>

                <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-md font-bold hover:bg-indigo-700 transition">儲存記錄</button>
            </form>
        </div>

        <div id="view-export" class="hidden">
            <div id="historyMonthsArea" class="mb-4 hidden">
                <div id="historyBadges" class="flex flex-wrap gap-2"></div>
            </div>

            <div class="flex gap-2 mb-4">
                <input type="month" id="queryMonth" class="flex-1 border border-gray-300 rounded-md p-2">
                <button onclick="loadRecords()" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">查詢</button>
            </div>

            <div id="calendarView" class="mb-6 hidden">
                <div class="calendar-grid"></div>
                <div class="flex justify-center gap-4 mt-2 text-xs text-gray-600">
                    <span class="flex items-center"><span class="w-3 h-3 bg-indigo-600 rounded mr-1"></span>OT</span>
                    <span class="flex items-center"><span class="w-3 h-3 bg-green-600 rounded mr-1"></span>當更/Call</span>
                </div>
            </div>

            <div id="recordsList" class="bg-gray-50 rounded-md border border-gray-200 p-4 mb-4 max-h-80 overflow-y-auto text-sm space-y-2">
                <p class="text-center text-gray-400">請查詢</p>
            </div>

            <div id="totalSummary" class="text-right border-t pt-4 space-y-1 hidden">
                <div class="text-gray-600">總時數: <span id="sumHours" class="font-bold text-indigo-600 text-xl">0</span> hr</div>
                <div class="text-gray-600">總金額: <span id="sumMoney" class="font-bold text-green-600 text-xl">$0</span></div>
            </div>

            <button onclick="generatePDF()" id="pdfBtn" class="w-full mt-4 bg-green-600 text-white py-3 rounded-md font-bold hover:bg-green-700 hidden shadow-md">
                下載 PDF 報表
            </button>
        </div>

        <p id="msg" class="mt-4 text-center text-sm font-bold min-h-[20px]"></p>
    </div>
`;
