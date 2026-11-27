export const logicScript = `
    function getLocalDateStr(dt) {
        const y = dt.getFullYear();
        const m = String(dt.getMonth() + 1).padStart(2, '0');
        const d = String(dt.getDate()).padStart(2, '0');
        return y + '-' + m + '-' + d;
    }

    function parseLocalDate(dateStr) {
        const parts = dateStr.split('-').map(Number);
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }

    function escapeHtml(str) {
        return String(str === undefined || str === null ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    const today = new Date();
    const todayStr = getLocalDateStr(today);
    document.getElementById('date').value = todayStr;
    document.getElementById('endDate').value = todayStr;
    document.getElementById('queryMonth').value = todayStr.slice(0, 7);

    let currentRecords = [];
    let grandTotalMinutes = 0;
    let grandTotalMoney = 0;
    let grandTotalTransport = 0;
    let knownMonths = new Set();
    let sentMonths = new Set();
    let isEditMode = false;
    let modalCloseTimer = null;
    let editModalCloseTimer = null;
    let timeWheelTimer = null;
    let activeTimePrefix = null;
    const TIME_ROW_HEIGHT = 44;

    const urlParams = new URLSearchParams(window.location.search);
    const isShareMode = urlParams.get('view') === 'share';
    const sharedMonth = urlParams.get('month');
    const isTouchPrimary = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

    function showLoginGate(message) {
        document.getElementById('appContainer').classList.add('hidden');
        document.getElementById('loginSection').classList.remove('hidden');
        const errEl = document.getElementById('loginError');
        if (errEl) errEl.innerText = message || '';
        const pwdEl = document.getElementById('loginPassword');
        if (pwdEl) {
            pwdEl.value = '';
            setTimeout(() => pwdEl.focus(), 50);
        }
    }

    function showAppContainer() {
        document.getElementById('loginSection').classList.add('hidden');
        document.getElementById('appContainer').classList.remove('hidden');
        if (window.USER_NAME) {
            const badge = document.getElementById('headerUserBadge');
            if (badge) {
                badge.innerText = window.USER_NAME;
                badge.classList.remove('hidden');
            }
        }
    }

    async function apiFetch(url, options) {
        const opts = Object.assign({ credentials: 'same-origin' }, options || {});
        const res = await fetch(url, opts);
        if (res.status === 401 && !isShareMode && url !== '/api/login') {
            currentRecords = [];
            knownMonths.clear();
            sentMonths.clear();
            showLoginGate('登入已逾時或憑證無效，請重新登入');
            throw new Error('AUTH_REQUIRED');
        }
        return res;
    }

    async function logout() {
        try {
            await fetch('/api/logout', { method: 'POST', credentials: 'same-origin' });
        } catch (e) {
            console.error(e);
        }
        currentRecords = [];
        knownMonths.clear();
        sentMonths.clear();
        if (isEditMode) toggleEditMode(true);
        document.getElementById('recordsList').innerHTML = '<p class="text-center text-slate-400">請查詢</p>';
        document.getElementById('calendarView').classList.add('hidden');
        document.getElementById('totalSummary').classList.add('hidden');
        document.getElementById('pdfBtn').classList.add('hidden');
        showLoginGate('');
    }

    // === 混合式時間輸入（電腦鍵盤輸入 + 手機滾輪上下滑動） ===
    function normalizeHour(val) {
        const digits = val.replace(/[^0-9]/g, '');
        if (!digits) return '';
        let n = parseInt(digits.slice(0, 2), 10);
        if (n > 23) n = 23;
        return n < 10 ? '0' + n : '' + n;
    }

    function normalizeMin(val) {
        const digits = val.replace(/[^0-9]/g, '');
        if (!digits) return '';
        if (digits === '3') return '30';
        if (digits === '0') return '00';
        const n = parseInt(digits.slice(0, 2), 10);
        return (n >= 15 && n < 45) ? '30' : '00';
    }

    function getTimeValue(prefix) {
        const hEl = document.getElementById(prefix + 'Hour');
        const mEl = document.getElementById(prefix + 'Min');
        if (!hEl || !mEl) return '';
        const h = normalizeHour(hEl.value);
        if (!h) return '';
        const m = normalizeMin(mEl.value) || '00';
        return h + ':' + m;
    }

    function handleTimeBoxClick(prefix, e) {
        if (isTouchPrimary) {
            openTimeWheel(prefix);
            return;
        }
        const mEl = document.getElementById(prefix + 'Min');
        const hEl = document.getElementById(prefix + 'Hour');
        if (e && e.target === mEl) {
            mEl.focus();
            mEl.select();
        } else if (hEl) {
            hEl.focus();
            hEl.select();
        }
    }

    function onHourInput(prefix) {
        const hEl = document.getElementById(prefix + 'Hour');
        const mEl = document.getElementById(prefix + 'Min');
        let val = hEl.value.replace(/[^0-9]/g, '');
        if (val.length > 2) val = val.slice(0, 2);
        if (val.length === 1 && parseInt(val, 10) >= 3) {
            val = '0' + val;
        }
        if (val.length === 2) {
            if (parseInt(val, 10) > 23) val = '23';
            hEl.value = val;
            if (!mEl.value) mEl.value = '00';
            updateDuration();
            mEl.focus();
            mEl.select();
            return;
        }
        hEl.value = val;
        updateDuration();
    }

    function onHourBlur(prefix) {
        const hEl = document.getElementById(prefix + 'Hour');
        const mEl = document.getElementById(prefix + 'Min');
        const val = normalizeHour(hEl.value);
        if (!val) {
            hEl.value = '';
            mEl.value = '';
            updateDuration();
            return;
        }
        hEl.value = val;
        if (!mEl.value) mEl.value = '00';
        updateDuration();
    }

    function onMinInput(prefix) {
        const mEl = document.getElementById(prefix + 'Min');
        let val = mEl.value.replace(/[^0-9]/g, '');
        if (val.length > 2) val = val.slice(0, 2);
        if (val.length === 2) {
            val = normalizeMin(val);
        }
        mEl.value = val;
        updateDuration();
    }

    function onMinBlur(prefix) {
        const hEl = document.getElementById(prefix + 'Hour');
        const mEl = document.getElementById(prefix + 'Min');
        if (!hEl.value) {
            mEl.value = normalizeMin(mEl.value);
            updateDuration();
            return;
        }
        mEl.value = normalizeMin(mEl.value) || '00';
        updateDuration();
    }

    function onHourKeyDown(prefix, e) {
        const hEl = document.getElementById(prefix + 'Hour');
        const mEl = document.getElementById(prefix + 'Min');
        if (hEl.readOnly) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            let n = hEl.value ? parseInt(hEl.value, 10) : new Date().getHours();
            if (isNaN(n)) n = new Date().getHours();
            if (hEl.value) {
                n = e.key === 'ArrowUp' ? (n + 1) % 24 : (n + 23) % 24;
            }
            hEl.value = n < 10 ? '0' + n : '' + n;
            if (!mEl.value) mEl.value = '00';
            updateDuration();
        } else if (e.key === ':' || e.key === 'ArrowRight') {
            if (e.key === ':' || hEl.selectionStart === hEl.value.length) {
                e.preventDefault();
                mEl.focus();
                mEl.select();
            }
        }
    }

    function onMinKeyDown(prefix, e) {
        const hEl = document.getElementById(prefix + 'Hour');
        const mEl = document.getElementById(prefix + 'Min');
        if (mEl.readOnly) return;
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            mEl.value = (mEl.value === '00') ? '30' : '00';
            updateDuration();
        } else if (e.key === 'ArrowLeft' && mEl.selectionStart === 0) {
            e.preventDefault();
            hEl.focus();
            hEl.select();
        } else if (e.key === 'Backspace' && !mEl.value) {
            e.preventDefault();
            hEl.focus();
        } else if (e.key === 'Enter') {
            onMinBlur(prefix);
        }
    }

    function updateWheelHighlight(wheelId, activeIndex) {
        const wheel = document.getElementById(wheelId);
        if (!wheel) return;
        const items = wheel.querySelectorAll('[data-wheel-item]');
        items.forEach((el, idx) => {
            if (idx === activeIndex) {
                el.classList.add('text-white', 'text-2xl');
                el.classList.remove('text-white/35', 'text-lg');
            } else {
                el.classList.add('text-white/35', 'text-lg');
                el.classList.remove('text-white', 'text-2xl');
            }
        });
    }

    function selectWheelItem(wheelId, index) {
        const wheel = document.getElementById(wheelId);
        if (!wheel) return;
        wheel.scrollTo({ top: index * TIME_ROW_HEIGHT, behavior: 'smooth' });
    }

    function openTimeWheel(prefix) {
        if (timeWheelTimer) {
            clearTimeout(timeWheelTimer);
            timeWheelTimer = null;
        }
        activeTimePrefix = prefix;
        const hEl = document.getElementById(prefix + 'Hour');
        const mEl = document.getElementById(prefix + 'Min');
        const titleEl = document.getElementById('timeWheelTitle');
        if (titleEl) {
            titleEl.innerText = prefix === 'start' ? '選擇開始時間' : '選擇結束時間';
        }

        const currentHour = new Date().getHours();
        const curH = hEl && hEl.value ? parseInt(normalizeHour(hEl.value), 10) : currentHour;
        const curM = mEl && normalizeMin(mEl.value) === '30' ? 1 : 0;
        const hIdx = isNaN(curH) ? currentHour : Math.max(0, Math.min(23, curH));

        const modal = document.getElementById('timeWheelModal');
        const sheet = document.getElementById('timeWheelSheet');
        const hourWheel = document.getElementById('wheelHour');
        const minWheel = document.getElementById('wheelMin');
        if (!modal || !sheet || !hourWheel || !minWheel) return;

        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';

        modal.classList.remove('hidden');
        hourWheel.style.scrollBehavior = 'auto';
        minWheel.style.scrollBehavior = 'auto';
        hourWheel.scrollTop = hIdx * TIME_ROW_HEIGHT;
        minWheel.scrollTop = curM * TIME_ROW_HEIGHT;
        updateWheelHighlight('wheelHour', hIdx);
        updateWheelHighlight('wheelMin', curM);

        setTimeout(() => {
            modal.classList.add('opacity-100');
            modal.classList.remove('opacity-0');
            sheet.classList.remove('translate-y-full');
            sheet.classList.add('translate-y-0');
            sheet.classList.remove('sm:scale-95');
            sheet.classList.add('sm:scale-100');
            hourWheel.scrollTop = hIdx * TIME_ROW_HEIGHT;
            minWheel.scrollTop = curM * TIME_ROW_HEIGHT;
        }, 10);
    }

    function closeTimeWheel() {
        const modal = document.getElementById('timeWheelModal');
        const sheet = document.getElementById('timeWheelSheet');
        if (!modal || !sheet) return;

        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';

        modal.classList.add('opacity-0');
        modal.classList.remove('opacity-100');
        sheet.classList.add('translate-y-full');
        sheet.classList.remove('translate-y-0');
        sheet.classList.add('sm:scale-95');
        sheet.classList.remove('sm:scale-100');

        if (timeWheelTimer) clearTimeout(timeWheelTimer);
        timeWheelTimer = setTimeout(() => {
            modal.classList.add('hidden');
            timeWheelTimer = null;
        }, 300);
    }

    function confirmTimeWheel() {
        if (!activeTimePrefix) return;
        const hourWheel = document.getElementById('wheelHour');
        const minWheel = document.getElementById('wheelMin');
        const hIdx = Math.max(0, Math.min(23, Math.round(hourWheel.scrollTop / TIME_ROW_HEIGHT)));
        const mIdx = Math.max(0, Math.min(1, Math.round(minWheel.scrollTop / TIME_ROW_HEIGHT)));
        const hStr = hIdx < 10 ? '0' + hIdx : '' + hIdx;
        const mStr = mIdx === 1 ? '30' : '00';
        document.getElementById(activeTimePrefix + 'Hour').value = hStr;
        document.getElementById(activeTimePrefix + 'Min').value = mStr;
        updateDuration();
        closeTimeWheel();
    }

    function clearTimeWheel() {
        if (!activeTimePrefix) return;
        document.getElementById(activeTimePrefix + 'Hour').value = '';
        document.getElementById(activeTimePrefix + 'Min').value = '';
        updateDuration();
        closeTimeWheel();
    }

    function setupTimeControls() {
        ['start', 'end'].forEach(prefix => {
            const hEl = document.getElementById(prefix + 'Hour');
            const mEl = document.getElementById(prefix + 'Min');
            if (!hEl || !mEl) return;

            if (isTouchPrimary) {
                hEl.readOnly = true;
                mEl.readOnly = true;
                hEl.classList.add('cursor-pointer');
                mEl.classList.add('cursor-pointer');
            } else {
                hEl.addEventListener('focus', function() { this.select(); });
                mEl.addEventListener('focus', function() { this.select(); });
                hEl.addEventListener('input', function() { onHourInput(prefix); });
                hEl.addEventListener('blur', function() { onHourBlur(prefix); });
                hEl.addEventListener('keydown', function(e) { onHourKeyDown(prefix, e); });
                mEl.addEventListener('input', function() { onMinInput(prefix); });
                mEl.addEventListener('blur', function() { onMinBlur(prefix); });
                mEl.addEventListener('keydown', function(e) { onMinKeyDown(prefix, e); });
            }
        });

        const wheelHour = document.getElementById('wheelHour');
        const wheelMin = document.getElementById('wheelMin');
        if (wheelHour) {
            wheelHour.addEventListener('scroll', function() {
                const idx = Math.max(0, Math.min(23, Math.round(this.scrollTop / TIME_ROW_HEIGHT)));
                updateWheelHighlight('wheelHour', idx);
            });
        }
        if (wheelMin) {
            wheelMin.addEventListener('scroll', function() {
                const idx = Math.max(0, Math.min(1, Math.round(this.scrollTop / TIME_ROW_HEIGHT)));
                updateWheelHighlight('wheelMin', idx);
            });
        }

        const timeModal = document.getElementById('timeWheelModal');
        if (timeModal) {
            timeModal.addEventListener('touchmove', function(e) {
                if (!e.target.closest('#wheelHour, #wheelMin')) {
                    e.preventDefault();
                }
            }, { passive: false });
        }
    }

    // === 歷史記錄自訂儲存與渲染功能 (使用安全的 data-* 與事件委派防止 XSS) ===
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
        container.innerHTML = '';
        try {
            const history = JSON.parse(localStorage.getItem('ot_hist_' + key) || '[]');
            history.forEach(val => {
                const chip = document.createElement('span');
                chip.className = 'history-chip';
                chip.textContent = val;
                chip.addEventListener('click', () => {
                    const input = document.getElementById(targetInputId);
                    if (input) input.value = val;
                    if (targetInputId === 'location') updateDuration();
                });

                const del = document.createElement('span');
                del.className = 'history-delete';
                del.textContent = '×';
                del.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteHistory(key, val, containerId, targetInputId);
                });

                chip.appendChild(del);
                container.appendChild(chip);
            });
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

    function initEditTimeSelects() {
        const hourSelects = ['editStartHour', 'editEndHour'];
        hourSelects.forEach(id => {
            const sel = document.getElementById(id);
            if (!sel) return;
            sel.innerHTML = '';
            for (let h = 0; h < 24; h++) {
                const val = h < 10 ? '0' + h : '' + h;
                const opt = document.createElement('option');
                opt.value = val;
                opt.textContent = val;
                opt.className = 'bg-slate-900 text-white';
                sel.appendChild(opt);
            }
        });
        resetEditMinSelect('editStartMin', '00');
        resetEditMinSelect('editEndMin', '00');
    }

    function resetEditMinSelect(id, selectedMin) {
        const sel = document.getElementById(id);
        if (!sel) return;
        const mins = ['00', '30'];
        if (selectedMin && !mins.includes(selectedMin)) {
            mins.push(selectedMin);
            mins.sort();
        }
        sel.innerHTML = '';
        mins.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            opt.className = 'bg-slate-900 text-white';
            sel.appendChild(opt);
        });
        sel.value = selectedMin || '00';
    }

    function initAuthenticatedApp() {
        showAppContainer();
        renderHistoryChips('location', 'history-location', 'location');
        fetchHistoryMonths();
    }

    (init)();

    function init() {
        localStorage.removeItem('ot_pin'); // 清除舊版明文 PIN 殘留
        setupTimeControls();
        initEditTimeSelects();
        updateDuration();

        if (isShareMode) {
            showAppContainer();
            document.getElementById('mainTitleArea').classList.add('hidden');
            document.getElementById('tabContainer').classList.add('hidden');
            document.getElementById('view-record').classList.add('hidden');
            document.getElementById('view-export').classList.remove('hidden');

            document.getElementById('queryControls').classList.add('hidden');
            document.getElementById('historyMonthsArea').classList.add('hidden');

            document.getElementById('shareHeader').classList.remove('hidden');
            const monthLabel = sharedMonth ? ' (' + sharedMonth + ')' : '';
            if (window.USER_NAME) {
                document.getElementById('shareTitle').innerText = window.USER_NAME + ' 的 OT 記錄' + monthLabel;
            } else {
                document.getElementById('shareTitle').innerText = 'OT 記錄報表' + monthLabel;
            }

            if (sharedMonth) {
                document.getElementById('queryMonth').value = sharedMonth;
                loadRecords(true);
            }
            return;
        }

        if (window.USER_NAME) {
            const sub = document.getElementById('loginUserSubtitle');
            if (sub) {
                sub.innerText = '使用者：' + window.USER_NAME;
                sub.classList.remove('hidden');
            }
        }

        if (window.INITIAL_AUTH) {
            initAuthenticatedApp();
        } else {
            showLoginGate('');
        }
    }

    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const password = document.getElementById('loginPassword').value;
        const remember = document.getElementById('rememberLogin').checked;
        const btn = document.getElementById('btn-login');
        const errEl = document.getElementById('loginError');

        errEl.innerText = '';
        btn.disabled = true;
        btn.innerText = '驗證中...';

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password, remember }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                errEl.innerText = data.error || '登入失敗';
                return;
            }
            document.getElementById('loginPassword').value = '';
            initAuthenticatedApp();
        } catch (err) {
            errEl.innerText = '連線失敗，請稍後再試';
        } finally {
            btn.disabled = false;
            btn.innerText = '登入系統';
        }
    });

    function toggleEditMode(forceOff = false) {
        isEditMode = forceOff ? false : !isEditMode;

        const btn = document.getElementById('btn-edit');
        const container = document.getElementById('view-export');

        if (isEditMode) {
            btn.className = 'bg-red-500/75 hover:bg-red-500/90 border border-red-300/50 text-white px-3.5 py-2 rounded-xl whitespace-nowrap transition shadow-[0_4px_14px_rgba(239,68,68,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] font-bold';
            btn.innerText = '完成';
            container.classList.add('edit-mode');
        } else {
            btn.className = 'bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3.5 py-2 rounded-xl whitespace-nowrap transition shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]';
            btn.innerText = '✏️';
            container.classList.remove('edit-mode');
        }
    }

    function handleMonthClick(m) {
        if (isEditMode) {
            openMonthModal(m);
        } else {
            document.getElementById('queryMonth').value = m;
            loadRecords();
        }
    }

    function openMonthModal(month) {
        if (modalCloseTimer) {
            clearTimeout(modalCloseTimer);
            modalCloseTimer = null;
        }

        const isSent = sentMonths.has(month);
        const titleEl = document.getElementById('modalMonthTitle');
        if (titleEl) titleEl.innerText = '管理 ' + month;

        const textEl = document.getElementById('modalToggleSentText');
        if (textEl) textEl.innerText = isSent ? '取消提交狀態' : '標記為已提交';

        const iconEl = document.getElementById('modalToggleSentIcon');
        if (iconEl) iconEl.innerText = isSent ? '✕' : '📤';

        const toggleBtn = document.getElementById('modalToggleSentBtn');
        if (toggleBtn) {
            toggleBtn.disabled = false;
            toggleBtn.onclick = async () => {
                await toggleSent(month, toggleBtn);
                closeMonthModal();
            };
        }

        const deleteBtn = document.getElementById('modalDeleteBtn');
        if (deleteBtn) {
            deleteBtn.disabled = false;
            deleteBtn.onclick = async () => {
                await deleteMonth(month, deleteBtn);
                closeMonthModal();
            };
        }

        const modal = document.getElementById('monthActionModal');
        const sheet = document.getElementById('monthActionSheet');
        if (!modal || !sheet) return;

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
        if (!modal || !sheet) return;

        modal.classList.add('opacity-0');
        modal.classList.remove('opacity-100');
        sheet.classList.add('translate-y-full');
        sheet.classList.remove('translate-y-0');
        sheet.classList.add('sm:scale-95');
        sheet.classList.remove('sm:scale-100');

        if (modalCloseTimer) clearTimeout(modalCloseTimer);
        modalCloseTimer = setTimeout(() => {
            modal.classList.add('hidden');
            modalCloseTimer = null;
        }, 300);
    }

    // === 單筆記錄編輯彈窗控制 ===
    function openEditModal(recordId) {
        const rec = currentRecords.find(r => String(r.id) === String(recordId));
        if (!rec) return;

        if (editModalCloseTimer) {
            clearTimeout(editModalCloseTimer);
            editModalCloseTimer = null;
        }

        const type = rec.type || 'hourly';
        document.getElementById('editId').value = rec.id;
        document.getElementById('editOriginalDate').value = rec.date;
        document.getElementById('editType').value = type;
        document.getElementById('editDate').value = rec.date;

        const gHourly = document.getElementById('editGroupHourly');
        const gMoney = document.getElementById('editGroupMoney');
        const fEndDate = document.getElementById('editFieldEndDate');
        const fRemarks = document.getElementById('editFieldRemarks');
        const lblDate = document.getElementById('editLabelDate');
        const lblRemarks = document.getElementById('editLabelRemarks');
        const inpRemarks = document.getElementById('editMoneyRemarks');
        const selTrans = document.getElementById('editTransportSelect');

        if (type === 'hourly') {
            gHourly.classList.remove('hidden');
            gMoney.classList.add('hidden');
            lblDate.innerText = '日期';
            document.getElementById('editLocation').value = rec.location || '';

            const [sh, sm] = (rec.start || '09:00').split(':');
            const [eh, em] = (rec.end || '10:00').split(':');
            document.getElementById('editStartHour').value = sh || '09';
            resetEditMinSelect('editStartMin', sm || '00');
            document.getElementById('editEndHour').value = eh || '10';
            resetEditMinSelect('editEndMin', em || '00');

            const mulSel = document.getElementById('editMultiplier');
            const mulStr = String(rec.multiplier || 1);
            if (!Array.from(mulSel.options).some(o => o.value === mulStr)) {
                const opt = document.createElement('option');
                opt.value = mulStr;
                opt.textContent = 'x' + mulStr;
                opt.className = 'bg-slate-900';
                mulSel.appendChild(opt);
            }
            mulSel.value = mulStr;
            document.getElementById('editAmount').required = false;
            document.getElementById('editEndDate').required = false;
        } else {
            gHourly.classList.add('hidden');
            gMoney.classList.remove('hidden');
            document.getElementById('editAmount').required = true;
            document.getElementById('editAmount').value = rec.amount || 0;

            if (type === 'oncall') {
                lblDate.innerText = '開始日期';
                fEndDate.classList.remove('hidden');
                fRemarks.classList.add('hidden');
                document.getElementById('editEndDate').required = true;
                document.getElementById('editEndDate').value = rec.endDate || rec.date;
            } else {
                lblDate.innerText = '日期';
                fEndDate.classList.add('hidden');
                fRemarks.classList.remove('hidden');
                document.getElementById('editEndDate').required = false;

                if (type === 'transport') {
                    lblRemarks.innerText = '行程/詳情';
                    inpRemarks.classList.add('hidden');
                    selTrans.classList.remove('hidden');
                    const locVal = rec.location || '其他';
                    if (!Array.from(selTrans.options).some(o => o.value === locVal)) {
                        const opt = document.createElement('option');
                        opt.value = locVal;
                        opt.textContent = locVal;
                        opt.className = 'bg-slate-900 text-white';
                        selTrans.appendChild(opt);
                    }
                    selTrans.value = locVal;
                } else {
                    lblRemarks.innerText = '備註 (選填)';
                    inpRemarks.classList.remove('hidden');
                    selTrans.classList.add('hidden');
                    inpRemarks.value = rec.location || '';
                }
            }
        }

        const modal = document.getElementById('editRecordModal');
        const sheet = document.getElementById('editRecordSheet');
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

    function closeEditModal() {
        const modal = document.getElementById('editRecordModal');
        const sheet = document.getElementById('editRecordSheet');
        if (!modal || !sheet) return;

        modal.classList.add('opacity-0');
        modal.classList.remove('opacity-100');
        sheet.classList.add('translate-y-full');
        sheet.classList.remove('translate-y-0');
        sheet.classList.add('sm:scale-95');
        sheet.classList.remove('sm:scale-100');

        if (editModalCloseTimer) clearTimeout(editModalCloseTimer);
        editModalCloseTimer = setTimeout(() => {
            modal.classList.add('hidden');
            editModalCloseTimer = null;
        }, 300);
    }

    document.getElementById('editRecordForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = document.getElementById('btn-save-edit');
        btn.disabled = true;
        btn.innerText = '儲存中...';

        const type = document.getElementById('editType').value;
        const payload = {
            id: document.getElementById('editId').value,
            originalDate: document.getElementById('editOriginalDate').value,
            type,
            date: document.getElementById('editDate').value,
        };

        if (type === 'hourly') {
            payload.location = document.getElementById('editLocation').value;
            payload.start = document.getElementById('editStartHour').value + ':' + document.getElementById('editStartMin').value;
            payload.end = document.getElementById('editEndHour').value + ':' + document.getElementById('editEndMin').value;
            payload.multiplier = document.getElementById('editMultiplier').value;
        } else {
            payload.amount = Number(document.getElementById('editAmount').value) || 0;
            if (type === 'transport') {
                payload.location = document.getElementById('editTransportSelect').value;
            } else if (type === 'oncall') {
                payload.endDate = document.getElementById('editEndDate').value;
                if (payload.endDate < payload.date) {
                    btn.disabled = false;
                    btn.innerText = '儲存變更';
                    return alert('結束日期不可早於開始日期');
                }
            } else {
                payload.location = document.getElementById('editMoneyRemarks').value || '';
            }
        }

        try {
            const res = await apiFetch('/api/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '更新失敗');

            knownMonths.add(data.month);
            if (data.movedFrom) {
                document.getElementById('queryMonth').value = data.month;
                fetchHistoryMonths();
            }
            renderRecordsView(data.month, data.records);
            closeEditModal();
        } catch (err) {
            if (err.message !== 'AUTH_REQUIRED') alert(err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = '儲存變更';
        }
    });

    // === 複製分享連結功能 ===
    function copyShareLink() {
        const month = document.getElementById('queryMonth').value || todayStr.slice(0, 7);
        const url = window.location.origin + window.location.pathname + '?view=share&month=' + month;

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(url).then(() => {
                alert('已複製分享連結 (無需密碼即可查看此月報表)：\\n' + url);
            }).catch(() => {
                fallbackCopyText(url);
            });
        } else {
            fallbackCopyText(url);
        }
    }

    function fallbackCopyText(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        try {
            document.execCommand('copy');
            alert('已複製分享連結 (無需密碼即可查看此月報表)：\\n' + text);
        } catch (err) {
            prompt('請手動複製分享連結：', text);
        }
        document.body.removeChild(textarea);
    }

    async function toggleSent(month, btnElement) {
        if (btnElement) btnElement.disabled = true;
        const textSpan = document.getElementById('modalToggleSentText');
        if (textSpan) textSpan.innerText = '處理中...';

        try {
            const res = await apiFetch('/api/toggle_sent', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '操作失敗');

            if (data.list && data.list.includes(month)) {
                sentMonths.add(month);
            } else {
                sentMonths.delete(month);
            }
            renderMonthButtons();
        } catch (e) {
            if (e.message !== 'AUTH_REQUIRED') alert(e.message);
        } finally {
            if (btnElement) btnElement.disabled = false;
        }
    }

    async function deleteMonth(month, btnElement) {
        if (!confirm('⚠️ 警告：確定要刪除 [' + month + '] 的所有資料嗎？刪除後無法復原！')) return;
        if (btnElement) btnElement.disabled = true;

        try {
            const res = await apiFetch('/api/delete_month', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ month }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '刪除失敗');

            knownMonths.delete(month);
            sentMonths.delete(month);
            renderMonthButtons();

            const currentViewMonth = document.getElementById('queryMonth').value;
            if (currentViewMonth === month) {
                currentRecords = [];
                document.getElementById('recordsList').innerHTML = '<p class="text-center text-slate-400">已刪除</p>';
                document.getElementById('calendarView').classList.add('hidden');
                document.getElementById('totalSummary').classList.add('hidden');
                document.getElementById('pdfBtn').classList.add('hidden');
            }
            alert('已刪除 ' + month + ' 的資料');
        } catch (err) {
            if (err.message !== 'AUTH_REQUIRED') alert(err.message);
        } finally {
            if (btnElement) btnElement.disabled = false;
        }
    }

    // === 月份按鈕渲染 ===
    function renderMonthButtons() {
        const area = document.getElementById('historyMonthsArea');
        const badges = document.getElementById('historyBadges');
        const sortedMonths = Array.from(knownMonths).sort().reverse();

        if (sortedMonths.length > 0) {
            area.classList.remove('hidden');
            badges.className = 'grid grid-cols-4 md:grid-cols-6 gap-2 mb-4';
            badges.innerHTML = '';
            sortedMonths.forEach(m => {
                const isSent = sentMonths.has(m);
                const wrapper = document.createElement('div');
                wrapper.className = 'relative w-full';

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = isSent
                    ? 'month-btn sent w-full h-10 text-[10px] min-[375px]:text-xs font-bold rounded-xl transition focus:outline-none cursor-pointer'
                    : 'month-btn w-full h-10 text-[10px] min-[375px]:text-xs font-bold rounded-xl transition focus:outline-none cursor-pointer';
                btn.textContent = m;
                btn.addEventListener('click', () => handleMonthClick(m));

                wrapper.appendChild(btn);
                badges.appendChild(wrapper);
            });
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
                    btn.className = 'flex-1 py-2.5 px-2 rounded-xl text-sm font-bold text-white shadow-md border border-white/25 bg-white/15 backdrop-blur-md whitespace-nowrap transition';
                } else {
                    btn.className = 'flex-1 py-2.5 px-2 rounded-xl text-sm font-bold text-white/55 hover:bg-white/10 hover:text-white border border-transparent whitespace-nowrap transition';
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
            document.getElementById('startHour').required = true;
            document.getElementById('startMin').required = true;
            document.getElementById('endHour').required = true;
            document.getElementById('endMin').required = true;
            document.getElementById('amount').required = false;
            document.getElementById('endDate').required = false;
        } else {
            groupHourly.classList.add('hidden');
            groupMoney.classList.remove('hidden');
            document.getElementById('startHour').required = false;
            document.getElementById('startMin').required = false;
            document.getElementById('endHour').required = false;
            document.getElementById('endMin').required = false;
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
            const btn = document.getElementById('mul-' + v);
            if (btn) {
                if (v === val) {
                    btn.className = 'flex-1 py-2.5 rounded-xl border border-indigo-400/60 bg-indigo-500/40 text-white text-sm font-bold shadow-[0_0_15px_rgba(99,102,241,0.3),inset_0_1px_1px_rgba(255,255,255,0.35)] transition';
                } else {
                    btn.className = 'flex-1 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white/60 text-sm font-bold hover:bg-white/10 hover:text-white transition';
                }
            }
        });
        updateDuration();
    }

    async function deleteRecord(id, date) {
        if (!confirm('確定要刪除這筆記錄嗎？')) return;
        try {
            const res = await apiFetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, date }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '刪除失敗');

            if (Array.isArray(data.records)) {
                renderRecordsView(data.month, data.records);
                if (data.records.length === 0) {
                    knownMonths.delete(data.month);
                    renderMonthButtons();
                }
            } else {
                loadRecords();
            }
        } catch (err) {
            if (err.message !== 'AUTH_REQUIRED') alert(err.message);
        }
    }

    async function fetchHistoryMonths() {
        try {
            const res = await apiFetch('/api/list_months');
            const data = await res.json();
            if (!data.error && data.months) {
                data.months.forEach(m => knownMonths.add(m));
                sentMonths = new Set(data.sentList || []);
                renderMonthButtons();
            }
        } catch (e) {
            if (e.message !== 'AUTH_REQUIRED') console.error('載入月份失敗:', e);
        }
    }

    function getMinutesDiff(start, end) {
        const [sh, sm] = start.split(':').map(Number);
        const [eh, em] = end.split(':').map(Number);
        let diff = (eh * 60 + em) - (sh * 60 + sm);
        if (diff < 0) diff += 24 * 60;
        return diff;
    }

    function formatHours(minutes) {
        return (minutes / 60).toFixed(1);
    }

    function updateDuration() {
        const s = getTimeValue('start');
        const e = getTimeValue('end');
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
            document.getElementById('durationCalc').innerText = '時數: 0 小時';
        }
    }

    function switchTab(tab) {
        document.getElementById('view-record').classList.toggle('hidden', tab !== 'record');
        document.getElementById('view-export').classList.toggle('hidden', tab !== 'export');
        if (tab === 'export') {
            fetchHistoryMonths();
            if (currentRecords.length === 0) {
                loadRecords();
            }
        }

        const active = 'flex-1 py-3 text-center font-bold text-indigo-300 border-b-2 border-indigo-400 bg-white/5 rounded-t-xl transition';
        const inactive = 'flex-1 py-3 text-center text-white/55 hover:text-indigo-300 hover:bg-white/5 rounded-t-xl transition';
        document.getElementById('tab-record').className = tab === 'record' ? active : inactive;
        document.getElementById('tab-export').className = tab === 'export' ? active : inactive;
    }

    document.getElementById('addForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = document.getElementById('recordType').value;
        if (type === 'hourly') {
            if (!isTouchPrimary) {
                onHourBlur('start');
                onMinBlur('start');
                onHourBlur('end');
                onMinBlur('end');
            }
            if (!getTimeValue('start') || !getTimeValue('end')) {
                return alert('請選擇開始時間與結束時間');
            }
        } else if (type === 'oncall') {
            const startD = document.getElementById('date').value;
            const endD = document.getElementById('endDate').value;
            if (endD < startD) {
                return alert('結束日期不可早於開始日期');
            }
        }

        const btn = document.getElementById('btn-submit-record');
        btn.disabled = true;
        btn.innerText = '儲存中...';

        try {
            const payload = {
                type,
                date: document.getElementById('date').value,
                multiplier: document.getElementById('multiplier').value,
            };
            if (type === 'hourly') {
                payload.location = document.getElementById('location').value;
                payload.start = getTimeValue('start');
                payload.end = getTimeValue('end');
                updateHistory('location', payload.location);
            } else {
                payload.amount = Number(document.getElementById('amount').value) || 0;
                if (type === 'transport') {
                    payload.location = document.getElementById('transportSelect').value;
                } else {
                    payload.location = document.getElementById('moneyRemarks').value || '';
                }
                if (type === 'oncall') {
                    payload.endDate = document.getElementById('endDate').value;
                }
            }

            const res = await apiFetch('/api/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '儲存失敗');

            document.getElementById('msg').innerText = '✅ 儲存成功';
            document.getElementById('msg').className = 'mt-4 text-center text-sm font-bold text-emerald-300';
            document.getElementById('amount').value = '';
            document.getElementById('location').value = '';
            document.getElementById('moneyRemarks').value = '';
            document.getElementById('transportSelect').selectedIndex = 0;
            setMultiplier(1);

            const currentMonth = data.month || payload.date.substring(0, 7);
            knownMonths.add(currentMonth);
            renderMonthButtons();
            renderHistoryChips('location', 'history-location', 'location');

            if (document.getElementById('queryMonth').value === currentMonth && Array.isArray(data.records)) {
                renderRecordsView(currentMonth, data.records);
            }
            setTimeout(() => (document.getElementById('msg').innerText = ''), 2000);
        } catch (err) {
            if (err.message !== 'AUTH_REQUIRED') alert(err.message);
        } finally {
            btn.disabled = false;
            btn.innerText = '儲存記錄';
        }
    });

    function renderCalendar(year, month, records) {
        const grid = document.querySelector('.calendar-grid');
        grid.innerHTML = '';

        const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
        weekDays.forEach(w => {
            const hd = document.createElement('div');
            hd.className = 'text-center text-[11px] font-bold text-slate-400 pb-1';
            hd.textContent = w;
            grid.appendChild(hd);
        });

        const otDays = new Set();
        const moneyDays = new Set();
        const transportDays = new Set();

        records.forEach(r => {
            if (r.type !== 'hourly' && Number(r.amount || 0) === 0) return;

            const start = parseLocalDate(r.date);
            if (r.type === 'oncall' && r.endDate) {
                const end = parseLocalDate(r.endDate);
                for (let dt = new Date(start.getTime()); dt <= end; dt.setDate(dt.getDate() + 1)) {
                    if (dt.getFullYear() === year && dt.getMonth() + 1 === month) {
                        moneyDays.add(dt.getDate());
                    }
                }
                return;
            }

            if (start.getFullYear() === year && start.getMonth() + 1 === month) {
                const d = start.getDate();
                if (r.type === 'hourly') otDays.add(d);
                else if (r.type === 'transport') transportDays.add(d);
                else moneyDays.add(d);
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

    function renderRecordsView(monthStr, data) {
        const listEl = document.getElementById('recordsList');
        const summaryEl = document.getElementById('totalSummary');

        currentRecords = data;
        grandTotalMinutes = 0;
        grandTotalMoney = 0;
        grandTotalTransport = 0;

        const [y, m] = monthStr.split('-').map(Number);
        renderCalendar(y, m, data);

        if (data.length === 0) {
            listEl.innerHTML = '<p class="text-center text-slate-400">無記錄</p>';
            summaryEl.classList.add('hidden');
            document.getElementById('pdfBtn').classList.add('hidden');
            return;
        }

        let html = '<table class="w-full text-left text-slate-200"><thead><tr class="text-white/50 border-b border-white/15"><th>日期</th><th>項目/地點</th><th class="text-right">時間/詳情</th><th class="text-right">時數/金額</th>';
        if (!isShareMode) {
            html += '<th class="text-right w-16 delete-ui">操作</th>';
        }
        html += '</tr></thead><tbody>';

        data.forEach(r => {
            const amount = Number(r.amount) || 0;
            if (r.type !== 'hourly' && amount === 0) return;

            let detail = '', value = '', typeLabel = '';

            if (r.type === 'hourly') {
                const mins = getMinutesDiff(r.start, r.end);
                const mul = r.multiplier || 1;
                const effectiveMins = mins * mul;
                grandTotalMinutes += effectiveMins;

                typeLabel = '<span class="text-indigo-300 font-bold">' + escapeHtml(r.location || 'OT') + '</span>';
                detail = escapeHtml(r.start.replace(':', '') + ' - ' + r.end.replace(':', ''));
                const mulLabel = mul > 1 ? ' (x' + mul + ')' : '';

                value = '<span class="text-indigo-300 font-bold">' + formatHours(effectiveMins) + ' hr' + mulLabel + '</span>';
            } else if (r.type === 'transport') {
                grandTotalTransport += amount;
                typeLabel = '<span class="text-amber-300 font-bold">交通費</span>';
                detail = r.location ? '<span class="text-white/70">' + escapeHtml(r.location) + '</span>' : '-';
                value = '<span class="text-amber-300 font-bold">$' + amount + '</span>';
            } else if (r.type === 'oncall') {
                grandTotalMoney += amount;
                typeLabel = '<span class="text-emerald-300 font-bold">當更</span>';
                const startD = r.date.split('-')[2];
                const endD = r.endDate ? r.endDate.split('-')[2] : '';
                detail = escapeHtml(startD + '日 - ' + endD + '日');
                value = '<span class="text-emerald-300 font-bold">$' + amount + '</span>';
            } else {
                grandTotalMoney += amount;
                typeLabel = '<span class="text-emerald-300 font-bold">Call</span>';
                detail = r.location ? '<span class="text-white/70">' + escapeHtml(r.location) + '</span>' : '-';
                value = '<span class="text-emerald-300 font-bold">$' + amount + '</span>';
            }

            const [yr, mo, dy] = r.date.split('-');
            const formattedDate = yr + '年' + parseInt(mo, 10) + '月' + parseInt(dy, 10) + '日';
            const safeIdAttr = escapeHtml(r.id);
            const safeDateAttr = escapeHtml(r.date);

            const actionCol = isShareMode
                ? ''
                : '<td class="py-2 text-right delete-ui whitespace-nowrap">' +
                  '<button type="button" data-action="edit" data-id="' + safeIdAttr + '" class="text-sky-300 hover:text-sky-200 text-xs mr-2" title="編輯">✏️</button>' +
                  '<button type="button" data-action="delete" data-id="' + safeIdAttr + '" data-date="' + safeDateAttr + '" class="text-red-300 hover:text-red-200 text-xs" title="刪除">🗑️</button>' +
                  '</td>';

            html += '<tr class="border-b border-white/10 last:border-0 hover:bg-white/10 transition">' +
                '<td class="py-2 text-xs md:text-sm">' + formattedDate + '</td>' +
                '<td class="py-2 text-xs md:text-sm">' + typeLabel + '</td>' +
                '<td class="py-2 text-right text-xs md:text-sm font-mono text-white/70">' + detail + '</td>' +
                '<td class="py-2 text-right text-xs md:text-sm font-bold">' + value + '</td>' +
                actionCol +
                '</tr>';
        });

        html += '</tbody></table>';
        listEl.innerHTML = html;

        if (!isShareMode) {
            listEl.querySelectorAll('button[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', () => openEditModal(btn.getAttribute('data-id')));
            });
            listEl.querySelectorAll('button[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', () => deleteRecord(btn.getAttribute('data-id'), btn.getAttribute('data-date')));
            });
        }

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

    async function loadRecords(forcePublic = false) {
        const monthStr = document.getElementById('queryMonth').value;
        if (!monthStr) return;

        const listEl = document.getElementById('recordsList');
        listEl.innerHTML = '<p class="text-center text-slate-300/75">載入中...</p>';

        try {
            let res;
            if (isShareMode || forcePublic) {
                res = await fetch('/api/public/get?month=' + encodeURIComponent(monthStr));
            } else {
                res = await apiFetch('/api/get?month=' + encodeURIComponent(monthStr));
            }
            const data = await res.json();
            if (!res.ok || data.error) throw new Error(data.error || '讀取失敗');

            renderRecordsView(monthStr, data);
        } catch (err) {
            if (err.message !== 'AUTH_REQUIRED') {
                listEl.innerHTML = '<p class="text-center text-red-300">讀取失敗</p>';
                alert(err.message);
            }
        }
    }
`;
