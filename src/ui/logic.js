export const logicScript = `
    const today = new Date();
    document.getElementById('date').valueAsDate = today;
    document.getElementById('endDate').valueAsDate = today;
    document.getElementById('queryMonth').value = today.toISOString().slice(0, 7);
    
    let currentRecords =[];
    let grandTotalMinutes = 0;
    let grandTotalMoney = 0;
    let grandTotalTransport = 0;
    let knownMonths = new Set();
    let sentMonths = new Set(); 
    let isEditMode = false;

    const urlParams = new URLSearchParams(window.location.search);
    const isShareMode = urlParams.get('view') === 'share';
    const sharedMonth = urlParams.get('month');

    (function init() {
        if (window.USER_NAME) {
            const el = document.getElementById('uiUserNameDisplay');
            if (el) el.innerText = window.USER_NAME;
        }

        if (isShareMode) {
            document.getElementById('mainTitleArea').classList.add('hidden');
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('tabContainer').classList.add('hidden');
            document.getElementById('view-record').classList.add('hidden');
            document.getElementById('view-export').classList.remove('hidden');
            document.getElementById('queryControls').classList.add('hidden');
            document.getElementById('historyMonthsArea').classList.add('hidden');
            
            document.getElementById('shareHeader').classList.remove('hidden');
            
            // === 修改重點：在分享標題加上月份 ===
            const monthLabel = sharedMonth ? \` (\${sharedMonth})\` : '';
            if (window.USER_NAME) {
                document.getElementById('shareTitle').innerText = window.USER_NAME + " 的 OT 記錄" + monthLabel;
            } else {
                document.getElementById('shareTitle').innerText = "OT 記錄報表" + monthLabel;
            }
            // ================================

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
    })();

    function updateHistory(key, value) {
        if (!value) return;
        let history = JSON.parse(localStorage.getItem('ot_history_' + key) || '[]');
        history = history.filter(v => v !== value);
        history.unshift(value);
        if (history.length > 10) history.pop();
        localStorage.setItem('ot_history_' + key, JSON.stringify(history));
    }

    function removeHistory(key, value) {
        let history = JSON.parse(localStorage.getItem('ot_history_' + key) || '[]');
        history = history.filter(v => v !== value);
        localStorage.setItem('ot_history_' + key, JSON.stringify(history));
        if (key === 'location') renderHistoryChips('location', 'history-location', 'location');
        if (key === 'remarks') renderHistoryChips('remarks', 'history-remarks', 'moneyRemarks');
    }

    function renderHistoryChips(key, containerId, inputId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const history = JSON.parse(localStorage.getItem('ot_history_' + key) || '[]');
        
        container.innerHTML = history.map(val => \`
            <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-700 text-gray-300 border border-gray-600 mr-2 mb-2 select-none hover:bg-gray-600 hover:text-white transition">
                <span class="cursor-pointer" onclick="document.getElementById('\${inputId}').value='\${val}'">\${val}</span>
                <span class="ml-2 text-gray-500 hover:text-red-400 font-bold px-1 cursor-pointer transition" onclick="removeHistory('\${key}', '\${val}')">×</span>
            </span>
        \`).join('');
    }

    function managePinStorage() {
        if (isShareMode) return;
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

    function copyShareLink() {
        const month = document.getElementById('queryMonth').value;
        const url = \`\${window.location.origin}\${window.location.pathname}?view=share&month=\${month}\`;
        navigator.clipboard.writeText(url).then(() => {
            alert('已複製分享連結 (無需密碼即可查看此月報表)：\\n' + url);
        });
    }

    function renderMonthButtons() {
        const area = document.getElementById('historyMonthsArea');
        const badges = document.getElementById('historyBadges');
        const sortedMonths = Array.from(knownMonths).sort().reverse();

        if (sortedMonths.length > 0) {
            area.classList.remove('hidden');
            badges.innerHTML = sortedMonths.map(m => {
                const isSent = sentMonths.has(m);
                const btnClass = isSent 
                    ? "month-btn sent px-4 py-2 text-sm font-bold border rounded-full transition focus:outline-none shadow-sm"
                    : "month-btn px-4 py-2 text-sm font-bold text-indigo-200 bg-indigo-900 border border-indigo-700 rounded-full hover:bg-indigo-800 transition focus:outline-none shadow-sm";

                return \`
                    <div class="relative inline-block mb-3 mr-3">
                        <button type="button" onclick="document.getElementById('queryMonth').value='\${m}';loadRecords();" class="\${btnClass}">\${m}</button>
                        <button type="button" onclick="toggleSent('\${m}', this)" class="status-ui absolute -top-1 -left-1 w-5 h-5 items-center justify-center text-[10px] font-bold text-white \${isSent ? 'bg-gray-500 hover:bg-gray-400' : 'bg-emerald-600 hover:bg-emerald-500'} rounded-full shadow-md border border-white dark:border-gray-800 transition transform hover:scale-110" title="\${isSent ? '取消已發送' : '標記為已發送'}">\${isSent ? '✕' : '📤'}</button>
                        <button type="button" onclick="deleteMonth('\${m}', this)" class="delete-ui absolute -top-1 -right-1 w-5 h-5 items-center justify-center text-[10px] font-bold text-white bg-red-600 rounded-full shadow-md hover:bg-red-500 border border-white dark:border-gray-800 transition transform hover:scale-110" title="刪除整月">✕</button>
                    </div>
                \`;
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

        const btnTypes =['hourly', 'oncall', 'percall', 'transport'];
        btnTypes.forEach(t => {
            const btn = document.getElementById('btn-' + t);
            if (btn) {
                if (t === type) {
                    btn.className = "flex-1 py-2 px-2 rounded-md text-sm font-bold bg-gray-700 text-white border border-gray-500 shadow whitespace-nowrap transition";
                } else {
                    btn.className = "flex-1 py-2 px-2 rounded-md text-sm font-bold text-gray-500 hover:bg-gray-800 hover:text-gray-300 whitespace-nowrap transition";
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
        const historyRemarks = document.getElementById('history-remarks');

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
                document.getElementById('endDate').required = false;

                if (type === 'transport') {
                    labelRemarks.innerText = '行程/詳情';
                    inputRemarks.classList.add('hidden');
                    selectTransport.classList.remove('hidden');
                    if(historyRemarks) historyRemarks.classList.add('hidden');
                } else {
                    labelRemarks.innerText = '備註 (選填)';
                    inputRemarks.classList.remove('hidden');
                    selectTransport.classList.add('hidden');
                    if(historyRemarks) historyRemarks.classList.remove('hidden'); 
                    inputRemarks.placeholder = '例如：重啟 Server';
                }
            }
        }
    }

    function setMultiplier(val) {
        document.getElementById('multiplier').value = val;
        const mulVals = [1, 1.5, 2, 3];
        mulVals.forEach(v => {
            const btn = document.getElementById('mul-' + v);
            if (btn) {
                if (v === val) {
                    btn.className = "flex-1 py-2 rounded border border-indigo-600 bg-indigo-600 text-white text-sm font-bold transition";
                } else {
                    btn.className = "flex-1 py-2 rounded border border-gray-600 bg-gray-800 text-gray-400 text-sm font-bold hover:bg-gray-700 transition";
                }
            }
        });
        updateDuration();
    }

    function getMinutesDiff(start, end) {
        const[sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 24 * 60; 
        return diff;
    }

    function formatHours(minutes) { 
        return (minutes / 60).toFixed(1); 
    }

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
                document.getElementById('durationCalc').innerText = \`時數: \${hoursStr} 小時\`;
            } else {
                document.getElementById('durationCalc').innerText = \`時數: \${hoursStr} hr (x\${mul}) = \${effHoursStr} 小時\`;
            }
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
        btn.disabled = true; 
        btn.innerText = '儲存中...';
        
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
                    if (type === 'percall' && payload.location) {
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
            } else { 
                throw new Error(await res.text()); 
            }
        } catch (err) { 
            alert(err.message); 
        } finally { 
            btn.disabled = false; 
            btn.innerText = '儲存記錄'; 
        }
    });

    async function deleteRecord(id, date) {
        if (!confirm('確定要刪除這筆記錄嗎？')) return;
        const pin = document.getElementById('pin').value;
        try {
            const res = await fetch('/api/delete', {
                method: 'POST',
                body: JSON.stringify({ pin, id, date })
            });
            if (res.ok) { 
                loadRecords(); 
            } else { 
                throw new Error('刪除失敗'); 
            }
        } catch(err) { 
            alert(err.message); 
        }
    }

    async function deleteMonth(month, btnElement) {
        if (!confirm('⚠️ 警告：確定要刪除[' + month + '] 的所有資料嗎？刪除後無法復原！')) return;
        const pin = document.getElementById('pin').value;
        btnElement.disabled = true; 
        btnElement.innerText = '...';
        try {
            const res = await fetch('/api/delete_month', {
                method: 'POST',
                body: JSON.stringify({ pin, month })
            });
            if (res.ok) { 
                btnElement.parentNode.remove();
                knownMonths.delete(month);
                const currentViewMonth = document.getElementById('queryMonth').value;
                if (currentViewMonth === month) {
                    document.getElementById('recordsList').innerHTML = '<p class="text-center text-gray-500">已刪除</p>';
                    document.getElementById('calendarView').classList.add('hidden');
                    document.getElementById('totalSummary').classList.add('hidden');
                    document.getElementById('pdfBtn').classList.add('hidden');
                }
                alert('已刪除 ' + month + ' 的資料');
            } else { 
                throw new Error('刪除失敗'); 
            }
        } catch(err) { 
            alert(err.message); 
            btnElement.disabled = false; 
            btnElement.innerText = '✕'; 
        }
    }

    async function fetchHistoryMonths() {
        const pin = document.getElementById('pin').value;
        if (!pin) return;
        managePinStorage();
        try {
            const res = await fetch(\`/api/list_months?pin=\${pin}\`);
            const data = await res.json();
            if (!data.error) {
                if (Array.isArray(data)) {
                    data.forEach(m => knownMonths.add(m));
                } else if (data.months) {
                    data.months.forEach(m => knownMonths.add(m));
                    sentMonths = new Set(data.sentList ||[]);
                }
                renderMonthButtons();
            }
        } catch(e) {
            console.error("載入月份失敗:", e);
        }
    }

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
            } else if (hasMoney) {
                div.className = 'calendar-day has-money';
            } else if (hasTransport) {
                div.className = 'calendar-day has-transport';
            } else if (hasOT) {
                div.className = 'calendar-day has-ot';
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
                url = \`/api/public/get?month=\${monthStr}\`;
            } else {
                url = \`/api/get?month=\${monthStr}&pin=\${pin}\`;
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
                let html = '<table class="w-full text-left text-gray-300"><thead><tr class="text-gray-500 border-b border-gray-700"><th>日期</th><th>項目</th><th class="text-right">詳情</th><th class="text-right">數值</th><th class="text-right w-10 delete-ui">操作</th></tr></thead><tbody>';
                
                if (isShareMode) {
                    html = '<table class="w-full text-left text-gray-300"><thead><tr class="text-gray-500 border-b border-gray-700"><th>日期</th><th>項目</th><th class="text-right">詳情</th><th class="text-right">數值</th></tr></thead><tbody>';
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
                        
                        typeLabel = r.location || 'OT';
                        detail = \`\${r.start.replace(':','')} - \${r.end.replace(':','')}\`;
                        
                        const mulLabel = mul > 1 ? \` <span class="text-indigo-400 font-bold">(x\${mul})</span>\` : '';
                        value = \`\${formatHours(effectiveMins)} hr\${mulLabel}\`;
                    } else if (r.type === 'transport') {
                        grandTotalTransport += amount;
                        typeLabel = \`<span class="text-amber-400 font-bold">交通費</span>\`;
                        detail = r.location ? \`<span class="text-gray-400">(\${r.location})</span>\` : '-';
                        value = \`$\${amount}\`;
                    } else if (r.type === 'oncall') {
                        grandTotalMoney += amount;
                        typeLabel = \`<span class="text-emerald-400 font-bold">當更</span>\`; 
                        const startD = r.date.split('-')[2];
                        const endD = r.endDate ? r.endDate.split('-')[2] : '';
                        detail = \`\${startD}日 - \${endD}日\`; 
                        value = \`$\${amount}\`;
                    } else { 
                        grandTotalMoney += amount;
                        typeLabel = \`<span class="text-emerald-400 font-bold">Call</span>\`;
                        detail = r.location ? \`<span class="text-gray-400">(\${r.location})</span>\` : '-';
                        value = \`$\${amount}\`;
                    }

                    const deleteBtn = isShareMode ? '' : \`<td class="py-2 text-right delete-ui"><button onclick="deleteRecord(\${r.id}, '\${r.date}')" class="text-red-400 hover:text-red-300 text-xs">🗑️</button></td>\`;

                    html += \`
                        <tr class="border-b border-gray-700 last:border-0 hover:bg-gray-800 transition">
                            <td class="py-2 text-xs md:text-sm">\${r.date.split('-')[2]}日</td>
                            <td class="py-2 text-xs md:text-sm">\${typeLabel}</td>
                            <td class="py-2 text-right text-xs md:text-sm font-mono text-gray-400">\${detail}</td>
                            <td class="py-2 text-right text-xs md:text-sm font-bold">\${value}</td>
                            \${deleteBtn}
                        </tr>
                    \`;
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
