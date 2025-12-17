// src/ui.js

export function getHtml() {
  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OT 記錄器</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
    <script src="https://unpkg.com/@pdf-lib/fontkit@0.0.4/dist/fontkit.umd.min.js"></script>
    <style>
        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
        .calendar-day { text-align: center; padding: 4px; border-radius: 4px; font-size: 0.8rem; }
        .has-ot { background-color: #4F46E5; color: white; font-weight: bold; cursor: pointer; }
        .no-ot { background-color: #F3F4F6; color: #9CA3AF; }
        .empty-day { background-color: transparent; }
    </style>
</head>
<body class="bg-gray-100 min-h-screen p-4 font-sans">
    <div class="max-w-3xl mx-auto bg-white rounded-xl shadow-lg overflow-hidden p-6">
        
        <div class="mb-6 bg-yellow-50 p-4 rounded-lg border border-yellow-200">
            <label class="block text-sm font-bold text-gray-700 mb-1">存取密碼 (PIN)</label>
            <input type="password" id="pin" class="w-full border-gray-300 border rounded px-3 py-2" placeholder="請輸入密碼">
        </div>

        <div class="flex border-b mb-6">
            <button onclick="switchTab('record')" id="tab-record" class="flex-1 py-3 text-center font-bold text-indigo-600 border-b-2 border-indigo-600 transition">每日打卡</button>
            <button onclick="switchTab('export')" id="tab-export" class="flex-1 py-3 text-center text-gray-500 hover:text-indigo-500 transition">月結匯出</button>
        </div>

        <!-- 每日打卡區 -->
        <div id="view-record">
            <h2 class="text-xl font-bold mb-4 text-gray-800">新增記錄</h2>
            <form id="addForm" class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">日期</label>
                    <input type="date" id="date" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">地點</label>
                    <input type="text" id="location" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" placeholder="例如：公司伺服器房" required>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">開始時間</label>
                        <input type="time" id="start" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">結束時間</label>
                        <input type="time" id="end" class="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" required>
                    </div>
                </div>
                <div class="text-right text-sm text-gray-500" id="durationCalc">時數: 0 小時</div>
                <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-md font-bold hover:bg-indigo-700 transition">儲存記錄</button>
            </form>
        </div>

        <!-- 月結匯出區 -->
        <div id="view-export" class="hidden">
            <h2 class="text-xl font-bold mb-4 text-gray-800">生成 PDF 報表</h2>
            
            <div id="historyMonthsArea" class="mb-4 hidden">
                <p class="text-xs text-gray-500 mb-2">已有記錄的月份 (點擊載入)：</p>
                <div id="historyBadges" class="flex flex-wrap gap-2"></div>
            </div>

            <div class="flex gap-2 mb-4">
                <input type="month" id="queryMonth" class="flex-1 border border-gray-300 rounded-md p-2">
                <button onclick="loadRecords()" class="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700">查詢</button>
            </div>

            <div id="calendarView" class="mb-6 hidden">
                <h3 class="text-sm font-bold text-gray-600 mb-2 text-center">本月 OT 分佈</h3>
                <div class="calendar-grid mb-1">
                    <div class="text-center text-xs text-gray-400">日</div>
                    <div class="text-center text-xs text-gray-400">一</div>
                    <div class="text-center text-xs text-gray-400">二</div>
                    <div class="text-center text-xs text-gray-400">三</div>
                    <div class="text-center text-xs text-gray-400">四</div>
                    <div class="text-center text-xs text-gray-400">五</div>
                    <div class="text-center text-xs text-gray-400">六</div>
                </div>
                <div id="calendarGrid" class="calendar-grid"></div>
            </div>

            <div id="recordsList" class="bg-gray-50 rounded-md border border-gray-200 p-4 mb-4 max-h-60 overflow-y-auto text-sm space-y-2">
                <p class="text-center text-gray-400">請選擇月份並查詢</p>
            </div>

            <div id="totalSummary" class="text-right font-bold text-lg text-gray-800 mb-4 hidden">
                本月總計: <span id="totalHoursDisplay" class="text-indigo-600">0</span> 小時
            </div>

            <button onclick="generatePDF()" id="pdfBtn" class="w-full bg-green-600 text-white py-3 rounded-md font-bold hover:bg-green-700 transition hidden shadow-md">
                下載 PDF 報表 (表格版)
            </button>
        </div>

        <p id="msg" class="mt-4 text-center text-sm font-bold min-h-[20px]"></p>
    </div>

    <script>
        document.getElementById('date').valueAsDate = new Date();
        document.getElementById('queryMonth').value = new Date().toISOString().slice(0, 7);
        let currentRecords = [];
        let grandTotalMinutes = 0;

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
                        <button onclick="quickSelectMonth('\${m}')" 
                                class="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded hover:bg-indigo-200 transition">
                            \${m}
                        </button>
                    \`).join('');
                }
            } catch(e) { console.error(e); }
        }

        function quickSelectMonth(m) {
            document.getElementById('queryMonth').value = m;
            loadRecords();
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

        function updateDurationDisplay() {
            const s = document.getElementById('start').value;
            const e = document.getElementById('end').value;
            if (s && e) {
                const mins = getMinutesDiff(s, e);
                document.getElementById('durationCalc').innerText = \`預計時數: \${formatHours(mins)} 小時\`;
            }
        }
        document.getElementById('start').addEventListener('change', updateDurationDisplay);
        document.getElementById('end').addEventListener('change', updateDurationDisplay);

        function switchTab(tab) {
            document.getElementById('view-record').classList.toggle('hidden', tab !== 'record');
            document.getElementById('view-export').classList.toggle('hidden', tab !== 'export');
            if(tab === 'export' && document.getElementById('pin').value) fetchHistoryMonths();
            document.getElementById('tab-record').classList.toggle('text-indigo-600', tab === 'record');
            document.getElementById('tab-record').classList.toggle('border-indigo-600', tab === 'record');
            document.getElementById('tab-export').classList.toggle('text-indigo-600', tab === 'export');
            document.getElementById('tab-export').classList.toggle('border-indigo-600', tab === 'export');
            document.getElementById('msg').innerText = '';
        }

        document.getElementById('addForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pin = document.getElementById('pin').value;
            if(!pin) return alert('請先輸入 PIN 密碼');
            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.innerText = '儲存中...';
            try {
                const payload = {
                    pin,
                    date: document.getElementById('date').value,
                    location: document.getElementById('location').value,
                    start: document.getElementById('start').value,
                    end: document.getElementById('end').value
                };
                const res = await fetch('/api/add', { method: 'POST', body: JSON.stringify(payload) });
                if(res.ok) {
                    document.getElementById('msg').innerText = '✅ 儲存成功';
                    document.getElementById('msg').className = 'mt-4 text-center text-sm font-bold text-green-600';
                } else { throw new Error(await res.text()); }
            } catch(err) { alert(err.message); } 
            finally { btn.disabled = false; btn.innerText = '儲存記錄'; }
        });

        function renderCalendar(year, month, records) {
            const grid = document.getElementById('calendarGrid');
            grid.innerHTML = '';
            const workedDays = new Set(records.map(r => parseInt(r.date.split('-')[2])));
            const firstDay = new Date(year, month - 1, 1).getDay();
            const daysInMonth = new Date(year, month, 0).getDate();

            for (let i = 0; i < firstDay; i++) {
                const div = document.createElement('div');
                div.className = 'calendar-day empty-day';
                grid.appendChild(div);
            }
            for (let d = 1; d <= daysInMonth; d++) {
                const div = document.createElement('div');
                div.innerText = d;
                if (workedDays.has(d)) {
                    div.className = 'calendar-day has-ot';
                    div.title = "有打卡記錄";
                } else { div.className = 'calendar-day no-ot'; }
                grid.appendChild(div);
            }
            document.getElementById('calendarView').classList.remove('hidden');
        }

        async function loadRecords() {
            const pin = document.getElementById('pin').value;
            const monthStr = document.getElementById('queryMonth').value; 
            if(!pin) return alert('請先輸入 PIN 密碼');
            const listEl = document.getElementById('recordsList');
            const summaryEl = document.getElementById('totalSummary');
            const pdfBtn = document.getElementById('pdfBtn');
            listEl.innerHTML = '<p class="text-center">載入中...</p>';
            document.getElementById('calendarView').classList.add('hidden');
            try {
                const res = await fetch(\`/api/get?month=\${monthStr}&pin=\${pin}\`);
                const data = await res.json();
                if(data.error) throw new Error(data.error);
                currentRecords = data;
                grandTotalMinutes = 0;
                const [y, m] = monthStr.split('-').map(Number);
                renderCalendar(y, m, data);
                if(data.length === 0) {
                    listEl.innerHTML = '<p class="text-center text-gray-500">該月份沒有記錄</p>';
                    summaryEl.classList.add('hidden');
                    pdfBtn.classList.add('hidden');
                } else {
                    let html = '<table class="w-full text-left"><thead><tr class="text-gray-500 border-b"><th>日期</th><th>地點</th><th class="text-right">時間</th><th class="text-right">時數</th></tr></thead><tbody>';
                    data.forEach(r => {
                        const mins = getMinutesDiff(r.start, r.end);
                        grandTotalMinutes += mins;
                        html += \`
                            <tr class="border-b last:border-0 hover:bg-gray-50">
                                <td class="py-2">\${r.date}</td>
                                <td class="py-2">\${r.location}</td>
                                <td class="py-2 text-right font-mono">\${r.start.replace(':','')} - \${r.end.replace(':','')}</td>
                                <td class="py-2 text-right">\${formatHours(mins)}</td>
                            </tr>
                        \`;
                    });
                    html += '</tbody></table>';
                    listEl.innerHTML = html;
                    document.getElementById('totalHoursDisplay').innerText = formatHours(grandTotalMinutes);
                    summaryEl.classList.remove('hidden');
                    pdfBtn.classList.remove('hidden');
                    document.getElementById('msg').innerText = '';
                }
            } catch(err) { alert(err.message); listEl.innerHTML = '載入失敗'; }
        }

        async function generatePDF() {
            if(currentRecords.length === 0) return;
            const btn = document.getElementById('pdfBtn');
            btn.innerText = "生成中...";
            btn.disabled = true;
            try {
                const { PDFDocument, rgb, StandardFonts } = PDFLib;
                const pdfDoc = await PDFDocument.create();
                pdfDoc.registerFontkit(fontkit);
                const helveticaFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
                const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
                const fontBytes = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-tc@4.5.12/files/noto-sans-tc-all-400-normal.woff').then(res => res.arrayBuffer());
                const chineseFont = await pdfDoc.embedFont(fontBytes);
                const page = pdfDoc.addPage([595.28, 841.89]);
                const { width, height } = page.getSize();
                let yPos = height - 60;
                const marginX = 40;
                
                const monthStr = document.getElementById('queryMonth').value;
                page.drawText(monthStr, { x: marginX, y: yPos, size: 20, font: helveticaBold });
                page.drawText(' OT 記錄表', { x: marginX + 90, y: yPos, size: 20, font: chineseFont });
                yPos -= 40;
                
                const colX = { date: 40, loc: 130, time: 350, hours: 480 };
                const fontSize = 11;
                page.drawText('日期', { x: colX.date, y: yPos, size: fontSize, font: chineseFont, color: rgb(0.4,0.4,0.4) });
                page.drawText('地點', { x: colX.loc, y: yPos, size: fontSize, font: chineseFont, color: rgb(0.4,0.4,0.4) });
                page.drawText('時間', { x: colX.time, y: yPos, size: fontSize, font: chineseFont, color: rgb(0.4,0.4,0.4) });
                page.drawText('小時', { x: colX.hours, y: yPos, size: fontSize, font: chineseFont, color: rgb(0.4,0.4,0.4) });
                page.drawLine({ start: { x: marginX, y: yPos - 5 }, end: { x: width - marginX, y: yPos - 5 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
                yPos -= 25;

                for (const rec of currentRecords) {
                    const mins = getMinutesDiff(rec.start, rec.end);
                    const timeStr = \`\${rec.start.replace(':','')} - \${rec.end.replace(':','')}\`;
                    const hoursStr = formatHours(mins);
                    page.drawText(rec.date, { x: colX.date, y: yPos, size: fontSize, font: helveticaFont, color: rgb(0,0,0) });
                    const safeLoc = rec.location.length > 15 ? rec.location.substring(0,14)+'...' : rec.location;
                    page.drawText(safeLoc, { x: colX.loc, y: yPos, size: fontSize, font: chineseFont, color: rgb(0,0,0) });
                    page.drawText(timeStr, { x: colX.time, y: yPos, size: fontSize, font: helveticaFont, color: rgb(0,0,0) });
                    page.drawText(hoursStr, { x: colX.hours, y: yPos, size: fontSize, font: helveticaFont, color: rgb(0,0,0) });
                    page.drawLine({ start: { x: marginX, y: yPos - 8 }, end: { x: width - marginX, y: yPos - 8 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
                    yPos -= 25;
                    if (yPos < 50) { pdfDoc.addPage([595.28, 841.89]); yPos = height - 50; }
                }

                yPos -= 10;
                page.drawLine({ start: { x: marginX, y: yPos }, end: { x: width - marginX, y: yPos }, thickness: 1, color: rgb(0, 0, 0) });
                yPos -= 25;
                page.drawText("本月總計: ", { x: 380, y: yPos, size: 14, font: chineseFont, color: rgb(0, 0, 0) });
                const totalValStr = formatHours(grandTotalMinutes);
                const numX = 455; 
                page.drawText(totalValStr, { x: numX, y: yPos, size: 14, font: helveticaBold, color: rgb(0, 0, 0) });
                const numWidth = helveticaBold.widthOfTextAtSize(totalValStr, 14);
                page.drawText(" 小時", { x: numX + numWidth, y: yPos, size: 14, font: chineseFont, color: rgb(0, 0, 0) });

                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = \`OT_\${monthStr}.pdf\`;
                link.click();
            } catch(err) { console.error(err); alert("生成失敗: " + err.message); } 
            finally { btn.innerText = "下載 PDF 報表 (表格版)"; btn.disabled = false; }
        }
    </script>
</body>
</html>
  `;
}
