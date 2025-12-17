// src/ui.js

export function getHtml() {
  return `
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
        .calendar-day { text-align: center; padding: 4px; border-radius: 4px; font-size: 0.8rem; }
        .has-ot { background-color: #4F46E5; color: white; font-weight: bold; }
        .has-money { background-color: #059669; color: white; font-weight: bold; } /* 綠色給當更/Call */
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

        <!-- 分頁 1: 新增記錄 -->
        <div id="view-record">
            <!-- 類型選擇器 -->
            <div class="flex gap-2 mb-4 bg-gray-100 p-1 rounded-lg">
                <button type="button" onclick="setType('hourly')" id="btn-hourly" class="flex-1 py-2 rounded-md text-sm font-bold bg-white shadow text-indigo-600 transition">🕒 時數 OT</button>
                <button type="button" onclick="setType('oncall')" id="btn-oncall" class="flex-1 py-2 rounded-md text-sm font-bold text-gray-500 transition">📅 當更</button>
                <button type="button" onclick="setType('percall')" id="btn-percall" class="flex-1 py-2 rounded-md text-sm font-bold text-gray-500 transition">📞 Call</button>
            </div>

            <form id="addForm" class="space-y-4">
                <input type="hidden" id="recordType" value="hourly">
                
                <!-- 通用: 開始日期 -->
                <div>
                    <label class="block text-sm font-medium text-gray-700" id="label-date">日期</label>
                    <input type="date" id="date" class="mt-1 block w-full border border-gray-300 rounded-md p-2" required>
                </div>

                <!-- 欄位組 A: 時數 OT -->
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

                <!-- 欄位組 B: 當更/Call (金額) -->
                <div id="group-money" class="hidden space-y-4">
                    <!-- 當更才顯示的結束日期 -->
                    <div id="field-endDate" class="hidden">
                        <label class="block text-sm font-medium text-gray-700">結束日期 (至)</label>
                        <input type="date" id="endDate" class="mt-1 block w-full border border-gray-300 rounded-md p-2">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium text-gray-700">金額 (HKD)</label>
                        <input type="number" id="amount" class="mt-1 block w-full border border-gray-300 rounded-md p-2" placeholder="例如：500">
                    </div>
                </div>

                <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-md font-bold hover:bg-indigo-700 transition">儲存記錄</button>
            </form>
        </div>

        <!-- 分頁 2: 月結報表 -->
        <div id="view-export" class="hidden">
            <div id="historyMonthsArea" class="mb-4 hidden">
                <div id="historyBadges" class="flex flex-wrap gap-2"></div>
            </div>

            <div class="flex gap-2 mb-4">
                <input type="month" id="queryMonth" class="flex-1 border border-gray-300 rounded-md p-2">
                <button onclick="loadRecords()" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">查詢</button>
            </div>

            <!-- 月曆視圖 -->
            <div id="calendarView" class="mb-6 hidden">
                <div class="calendar-grid"></div>
                <div class="flex justify-center gap-4 mt-2 text-xs">
                    <span class="flex items-center"><span class="w-3 h-3 bg-indigo-600 rounded mr-1"></span>OT</span>
                    <span class="flex items-center"><span class="w-3 h-3 bg-green-600 rounded mr-1"></span>當更/Call</span>
                </div>
            </div>

            <!-- 列表 -->
            <div id="recordsList" class="bg-gray-50 rounded-md border border-gray-200 p-4 mb-4 max-h-80 overflow-y-auto text-sm space-y-2">
                <p class="text-center text-gray-400">請查詢</p>
            </div>

            <!-- 總計區 -->
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

    <script>
        // === 初始化 ===
        const today = new Date();
        document.getElementById('date').valueAsDate = today;
        document.getElementById('endDate').valueAsDate = today;
        document.getElementById('queryMonth').value = today.toISOString().slice(0, 7);
        
        let currentRecords = [];
        let grandTotalMinutes = 0;
        let grandTotalMoney = 0;

        // === 介面切換邏輯 ===
        function setType(type) {
            document.getElementById('recordType').value = type;
            
            // 按鈕樣式
            ['hourly', 'oncall', 'percall'].forEach(t => {
                const btn = document.getElementById('btn-' + t);
                if (t === type) {
                    btn.className = "flex-1 py-2 rounded-md text-sm font-bold bg-white shadow text-indigo-600 transition";
                } else {
                    btn.className = "flex-1 py-2 rounded-md text-sm font-bold text-gray-500 hover:bg-gray-200 transition";
                }
            });

            // 欄位顯示控制
            const groupHourly = document.getElementById('group-hourly');
            const groupMoney = document.getElementById('group-money');
            const fieldEndDate = document.getElementById('field-endDate');
            const labelDate = document.getElementById('label-date');

            if (type === 'hourly') {
                groupHourly.classList.remove('hidden');
                groupMoney.classList.add('hidden');
                labelDate.innerText = '日期';
                // 必填設定
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
                    document.getElementById('endDate').required = true;
                } else { // percall
                    labelDate.innerText = '日期';
                    fieldEndDate.classList.add('hidden');
                    document.getElementById('endDate').required = false;
                }
            }
        }

        // === 歷史月份載入 ===
        async function fetchHistoryMonths() {
            const pin = document.getElementById('pin').value;
            if(!pin) return;
            try {
                const res = await fetch(\`/api/list_months?pin=\${pin}\`);
                const months = await res.json();
                if(months.error) return; 
                const area = document.getElementById('historyMonthsArea');
                const badges = document.getElementById('historyBadges');
                if(months.length > 0) {
                    area.classList.remove('hidden');
                    badges.innerHTML = months.map(m => \`
                        <button onclick="document.getElementById('queryMonth').value='\${m}';loadRecords();" 
                                class="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded hover:bg-indigo-200">
                            \${m}
                        </button>
                    \`).join('');
                }
            } catch(e) {}
        }
        document.getElementById('pin').addEventListener('blur', fetchHistoryMonths);

        // === 時間計算工具 ===
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
            if (s && e) {
                const mins = getMinutesDiff(s, e);
                document.getElementById('durationCalc').innerText = \`時數: \${formatHours(mins)} 小時\`;
            }
        }

        function switchTab(tab) {
            document.getElementById('view-record').classList.toggle('hidden', tab !== 'record');
            document.getElementById('view-export').classList.toggle('hidden', tab !== 'export');
            if(tab === 'export' && document.getElementById('pin').value) fetchHistoryMonths();
            // 簡化 tab 樣式切換代碼...
            const active = "flex-1 py-3 text-center font-bold text-indigo-600 border-b-2 border-indigo-600 transition";
            const inactive = "flex-1 py-3 text-center text-gray-500 hover:text-indigo-500 transition";
            document.getElementById('tab-record').className = tab === 'record' ? active : inactive;
            document.getElementById('tab-export').className = tab === 'export' ? active : inactive;
        }

        // === 提交表單 ===
        document.getElementById('addForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pin = document.getElementById('pin').value;
            if(!pin) return alert('請先輸入 PIN 密碼');
            const btn = e.target.querySelector('button');
            btn.disabled = true; btn.innerText = '儲存中...';

            try {
                const type = document.getElementById('recordType').value;
                const payload = {
                    pin,
                    type,
                    date: document.getElementById('date').value,
                };

                if (type === 'hourly') {
                    payload.location = document.getElementById('location').value;
                    payload.start = document.getElementById('start').value;
                    payload.end = document.getElementById('end').value;
                } else {
                    payload.amount = document.getElementById('amount').value;
                    if (type === 'oncall') {
                        payload.endDate = document.getElementById('endDate').value;
                    }
                }

                const res = await fetch('/api/add', { method: 'POST', body: JSON.stringify(payload) });
                if(res.ok) {
                    document.getElementById('msg').innerText = '✅ 儲存成功';
                    document.getElementById('msg').className = 'mt-4 text-center text-sm font-bold text-green-600';
                    setTimeout(() => document.getElementById('msg').innerText = '', 2000);
                } else { throw new Error(await res.text()); }
            } catch(err) { alert(err.message); } 
            finally { btn.disabled = false; btn.innerText = '儲存記錄'; }
        });

        // === 渲染月曆 ===
        function renderCalendar(year, month, records) {
            const grid = document.querySelector('.calendar-grid');
            grid.innerHTML = '';
            
            // 標記工作日 (Set 存日期數字)
            const otDays = new Set();
            const moneyDays = new Set();

            records.forEach(r => {
                const d = parseInt(r.date.split('-')[2]);
                if (r.type === 'hourly') otDays.add(d);
                else {
                    moneyDays.add(d);
                    // 當更需要標記範圍內的所有日期
                    if (r.type === 'oncall' && r.endDate) {
                        const start = new Date(r.date);
                        const end = new Date(r.endDate);
                        for(let dt = start; dt <= end; dt.setDate(dt.getDate() + 1)) {
                            // 確保只標記本月
                            if(dt.getMonth() + 1 === month) moneyDays.add(dt.getDate());
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
                div.className = 'calendar-day ' + (moneyDays.has(d) ? 'has-money' : (otDays.has(d) ? 'has-ot' : 'no-ot'));
                grid.appendChild(div);
            }
            document.getElementById('calendarView').classList.remove('hidden');
        }

        // === 載入記錄與計算 ===
        async function loadRecords() {
            const pin = document.getElementById('pin').value;
            const monthStr = document.getElementById('queryMonth').value; 
            if(!pin) return alert('請先輸入 PIN 密碼');
            const listEl = document.getElementById('recordsList');
            const summaryEl = document.getElementById('totalSummary');
            
            listEl.innerHTML = '<p class="text-center">載入中...</p>';
            
            try {
                const res = await fetch(\`/api/get?month=\${monthStr}&pin=\${pin}\`);
                const data = await res.json();
                if(data.error) throw new Error(data.error);
                
                currentRecords = data;
                grandTotalMinutes = 0;
                grandTotalMoney = 0;
                
                const [y, m] = monthStr.split('-').map(Number);
                renderCalendar(y, m, data);

                if(data.length === 0) {
                    listEl.innerHTML = '<p class="text-center text-gray-500">無記錄</p>';
                    summaryEl.classList.add('hidden');
                    document.getElementById('pdfBtn').classList.add('hidden');
                } else {
                    let html = '<table class="w-full text-left"><thead><tr class="text-gray-500 border-b"><th>日期</th><th>項目</th><th class="text-right">詳情</th><th class="text-right">數值</th></tr></thead><tbody>';
                    
                    data.forEach(r => {
                        let detail = '', value = '', typeLabel = '';
                        
                        if (r.type === 'hourly') {
                            // 時數 OT
                            const mins = getMinutesDiff(r.start, r.end);
                            grandTotalMinutes += mins;
                            typeLabel = r.location || 'OT';
                            detail = \`\${r.start.replace(':','')} - \${r.end.replace(':','')}\`;
                            value = \`\${formatHours(mins)} hr\`;
                        } else if (r.type === 'oncall') {
                            // 當更
                            grandTotalMoney += r.amount;
                            typeLabel = '<span class="text-green-600 font-bold">當更</span>';
                            // 顯示日期範圍 (只顯示日)
                            const endD = r.endDate ? r.endDate.split('-')[2] : '';
                            detail = \`~ \${endD}日\`; 
                            value = \`$\${r.amount}\`;
                        } else {
                            // Per Call
                            grandTotalMoney += r.amount;
                            typeLabel = '<span class="text-green-600 font-bold">Call</span>';
                            detail = '-';
                            value = \`$\${r.amount}\`;
                        }

                        html += \`
                            <tr class="border-b last:border-0 hover:bg-gray-50">
                                <td class="py-2 text-xs md:text-sm">\${r.date.split('-')[2]}日</td>
                                <td class="py-2 text-xs md:text-sm">\${typeLabel}</td>
                                <td class="py-2 text-right text-xs md:text-sm font-mono text-gray-500">\${detail}</td>
                                <td class="py-2 text-right text-xs md:text-sm font-bold">\${value}</td>
                            </tr>
                        \`;
                    });
                    html += '</tbody></table>';
                    listEl.innerHTML = html;

                    // 更新總計顯示
                    document.getElementById('sumHours').innerText = formatHours(grandTotalMinutes);
                    document.getElementById('sumMoney').innerText = '$' + grandTotalMoney;
                    summaryEl.classList.remove('hidden');
                    document.getElementById('pdfBtn').classList.remove('hidden');
                }
            } catch(err) { alert(err.message); }
        }

        // === PDF 生成 (支援多種類型) ===
        async function generatePDF() {
            if(currentRecords.length === 0) return;
            const btn = document.getElementById('pdfBtn');
            btn.innerText = "生成中..."; btn.disabled = true;
            try {
                const { PDFDocument, rgb, StandardFonts } = PDFLib;
                const pdfDoc = await PDFDocument.create();
                pdfDoc.registerFontkit(fontkit);
                
                // 字型
                const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
                const fontBytes = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-tc@4.5.12/files/noto-sans-tc-all-400-normal.woff').then(res => res.arrayBuffer());
                const chineseFont = await pdfDoc.embedFont(fontBytes);

                const page = pdfDoc.addPage([595.28, 841.89]);
                const { width, height } = page.getSize();
                let yPos = height - 60;
                const marginX = 40;

                // 標題
                const monthStr = document.getElementById('queryMonth').value;
                page.drawText(monthStr, { x: marginX, y: yPos, size: 20, font: helveticaBold });
                page.drawText(' OT/當更 記錄表', { x: marginX + 90, y: yPos, size: 20, font: chineseFont });
                yPos -= 40;

                // 表頭
                const col = { d: 40, item: 130, detail: 350, val: 480 };
                const fontSize = 11;
                const drawTxt = (text, x, font, color=rgb(0,0,0)) => 
                    page.drawText(text, { x, y: yPos, size: fontSize, font, color });

                drawTxt('日期', col.d, chineseFont, rgb(0.5,0.5,0.5));
                drawTxt('項目/地點', col.item, chineseFont, rgb(0.5,0.5,0.5));
                drawTxt('時間/詳情', col.detail, chineseFont, rgb(0.5,0.5,0.5));
                drawTxt('時數/金額', col.val, chineseFont, rgb(0.5,0.5,0.5));
                
                page.drawLine({ start: { x: marginX, y: yPos-5 }, end: { x: width-marginX, y: yPos-5 }, thickness: 1, color: rgb(0.8,0.8,0.8) });
                yPos -= 25;

                // 內容
                for (const r of currentRecords) {
                    let itemStr = '', detailStr = '', valStr = '';
                    let isMoney = false;

                    if (r.type === 'hourly') {
                        itemStr = r.location || 'OT';
                        const mins = getMinutesDiff(r.start, r.end);
                        detailStr = \`\${r.start.replace(':','')} - \${r.end.replace(':','')}\`;
                        valStr = formatHours(mins) + ' hr';
                    } else if (r.type === 'oncall') {
                        itemStr = '當更 On-Call';
                        detailStr = r.endDate ? \`~ \${r.endDate}\` : '';
                        valStr = '$' + r.amount;
                        isMoney = true;
                    } else { // percall
                        itemStr = 'Call';
                        valStr = '$' + r.amount;
                        isMoney = true;
                    }

                    // 畫內容
                    drawTxt(r.date, col.d, helvetica);
                    
                    const safeItem = itemStr.length > 15 ? itemStr.substring(0,14)+'...' : itemStr;
                    drawTxt(safeItem, col.item, chineseFont);
                    
                    drawTxt(detailStr, col.detail, helvetica);
                    drawTxt(valStr, col.val, helveticaBold, isMoney ? rgb(0,0.5,0) : rgb(0,0,0));

                    page.drawLine({ start: { x: marginX, y: yPos-8 }, end: { x: width-marginX, y: yPos-8 }, thickness: 0.5, color: rgb(0.9,0.9,0.9) });
                    yPos -= 25;
                    
                    if (yPos < 50) { pdfDoc.addPage([595.28, 841.89]); yPos = height - 50; }
                }

                // 總計
                yPos -= 10;
                page.drawLine({ start: { x: marginX, y: yPos }, end: { x: width-marginX, y: yPos }, thickness: 1 });
                yPos -= 25;

                // 總時數
                drawTxt("總時數: ", 350, chineseFont);
                drawTxt(formatHours(grandTotalMinutes) + " hr", 410, helveticaBold);
                
                yPos -= 20;
                // 總金額
                drawTxt("總金額: ", 350, chineseFont);
                drawTxt("$" + grandTotalMoney, 410, helveticaBold, rgb(0,0.5,0));

                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = \`Report_\${monthStr}.pdf\`;
                link.click();

            } catch(err) { console.error(err); alert("生成失敗: " + err.message); } 
            finally { btn.disabled = false; btn.innerText = "下載 PDF 報表"; }
        }
    </script>
</body>
</html>
  `;
}
