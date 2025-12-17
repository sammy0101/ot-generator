export const logicScript = `
    const today = new Date();
    document.getElementById('date').valueAsDate = today;
    document.getElementById('endDate').valueAsDate = today;
    document.getElementById('queryMonth').value = today.toISOString().slice(0, 7);
    
    let currentRecords = [];
    let grandTotalMinutes = 0;
    let grandTotalMoney = 0;

    function setType(type) {
        // 切換類型時，清空金額，防止資料殘留
        document.getElementById('amount').value = '';
        document.getElementById('recordType').value = type;
        
        ['hourly', 'oncall', 'percall'].forEach(t => {
            const btn = document.getElementById('btn-' + t);
            if (t === type) {
                btn.className = "flex-1 py-2 rounded-md text-sm font-bold bg-white shadow text-indigo-600 transition";
            } else {
                btn.className = "flex-1 py-2 rounded-md text-sm font-bold text-gray-500 hover:bg-gray-200 transition";
            }
        });

        const groupHourly = document.getElementById('group-hourly');
        const groupMoney = document.getElementById('group-money');
        const fieldEndDate = document.getElementById('field-endDate');
        const labelDate = document.getElementById('label-date');

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
                document.getElementById('endDate').required = true;
            } else { 
                labelDate.innerText = '日期';
                fieldEndDate.classList.add('hidden');
                document.getElementById('endDate').required = false;
            }
        }
    }

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
                            class="bg-indigo-100 text-indigo-800 text-xs px-2 py-1 rounded hover:bg-indigo-200 transition">
                        \${m}
                    </button>
                \`).join('');
            }
        } catch(e) {}
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
        if (s && e) {
            const mins = getMinutesDiff(s, e);
            document.getElementById('durationCalc').innerText = \`時數: \${formatHours(mins)} 小時\`;
        }
    }

    function switchTab(tab) {
        document.getElementById('view-record').classList.toggle('hidden', tab !== 'record');
        document.getElementById('view-export').classList.toggle('hidden', tab !== 'export');
        if(tab === 'export' && document.getElementById('pin').value) fetchHistoryMonths();
        
        const active = "flex-1 py-3 text-center font-bold text-indigo-600 border-b-2 border-indigo-600 transition";
        const inactive = "flex-1 py-3 text-center text-gray-500 hover:text-indigo-500 transition";
        document.getElementById('tab-record').className = tab === 'record' ? active : inactive;
        document.getElementById('tab-export').className = tab === 'export' ? active : inactive;
    }

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
                // 強制轉換為數字，避免傳送空字串
                payload.amount = Number(document.getElementById('amount').value) || 0;
                if (type === 'oncall') {
                    payload.endDate = document.getElementById('endDate').value;
                }
            }

            const res = await fetch('/api/add', { method: 'POST', body: JSON.stringify(payload) });
            if(res.ok) {
                document.getElementById('msg').innerText = '✅ 儲存成功';
                document.getElementById('msg').className = 'mt-4 text-center text-sm font-bold text-green-600';
                
                // === 修復重點：儲存成功後，清空輸入欄位 ===
                document.getElementById('amount').value = '';
                document.getElementById('location').value = '';
                // =====================================

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

        records.forEach(r => {
            const d = parseInt(r.date.split('-')[2]);
            if (r.type === 'hourly') otDays.add(d);
            else {
                moneyDays.add(d);
                if (r.type === 'oncall' && r.endDate) {
                    const start = new Date(r.date);
                    const end = new Date(r.endDate);
                    for(let dt = start; dt <= end; dt.setDate(dt.getDate() + 1)) {
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
            
            // === 修復重點：雙色判斷 ===
            if (otDays.has(d) && moneyDays.has(d)) {
                div.className = 'calendar-day has-both'; // 既有OT又有錢 -> 雙色
            } else if (moneyDays.has(d)) {
                div.className = 'calendar-day has-money';
            } else if (otDays.has(d)) {
                div.className = 'calendar-day has-ot';
            } else {
                div.className = 'calendar-day no-ot';
            }
            // ========================

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
                    
                    // === 修復重點：確保金額是數字，避免 undefined ===
                    const amount = Number(r.amount) || 0; 
                    // =======================================

                    if (r.type === 'hourly') {
                        const mins = getMinutesDiff(r.start, r.end);
                        grandTotalMinutes += mins;
                        typeLabel = r.location || 'OT';
                        detail = \`\${r.start.replace(':','')} - \${r.end.replace(':','')}\`;
                        value = \`\${formatHours(mins)} hr\`;
                    } else if (r.type === 'oncall') {
                        grandTotalMoney += amount;
                        typeLabel = '<span class="text-green-600 font-bold">當更</span>';
                        const endD = r.endDate ? r.endDate.split('-')[2] : '';
                        detail = \`~ \${endD}日\`; 
                        value = \`$\${amount}\`;
                    } else {
                        grandTotalMoney += amount;
                        typeLabel = '<span class="text-green-600 font-bold">Call</span>';
                        detail = '-';
                        value = \`$\${amount}\`;
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

                document.getElementById('sumHours').innerText = formatHours(grandTotalMinutes);
                document.getElementById('sumMoney').innerText = '$' + grandTotalMoney;
                summaryEl.classList.remove('hidden');
                document.getElementById('pdfBtn').classList.remove('hidden');
            }
        } catch(err) { alert(err.message); }
    }
`;
