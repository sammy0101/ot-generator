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
        /* === Liquid Glass 背景與核心玻璃材質 === */
        body {
            background-color: #060913;
            background-image:
                radial-gradient(circle at 15% 15%, rgba(99, 102, 241, 0.28) 0%, transparent 45%),
                radial-gradient(circle at 85% 22%, rgba(56, 189, 248, 0.22) 0%, transparent 42%),
                radial-gradient(circle at 75% 82%, rgba(16, 185, 129, 0.18) 0%, transparent 48%),
                radial-gradient(circle at 20% 85%, rgba(168, 85, 247, 0.2) 0%, transparent 45%);
            background-attachment: fixed;
            color: #f1f5f9;
        }

        .liquid-glass-card {
            background: linear-gradient(145deg, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.04) 100%);
            backdrop-filter: blur(28px) saturate(185%);
            -webkit-backdrop-filter: blur(28px) saturate(185%);
            border: 1px solid rgba(255, 255, 255, 0.2);
            box-shadow:
                0 24px 60px rgba(0, 0, 0, 0.55),
                inset 0 1px 1px rgba(255, 255, 255, 0.38),
                inset 0 -1px 1px rgba(255, 255, 255, 0.06);
        }

        .liquid-glass-panel {
            background: linear-gradient(160deg, rgba(255, 255, 255, 0.09) 0%, rgba(255, 255, 255, 0.025) 100%);
            backdrop-filter: blur(18px) saturate(155%);
            -webkit-backdrop-filter: blur(18px) saturate(155%);
            border: 1px solid rgba(255, 255, 255, 0.14);
            box-shadow:
                0 8px 24px rgba(0, 0, 0, 0.25),
                inset 0 1px 0 rgba(255, 255, 255, 0.22);
        }

        .liquid-glass-input {
            background: rgba(15, 23, 42, 0.38);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.16);
            box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.3), 0 1px 0 rgba(255, 255, 255, 0.08);
            transition: all 0.2s ease;
        }
        .liquid-glass-input:focus-within,
        input.liquid-glass-input:focus,
        select.liquid-glass-input:focus {
            background: rgba(15, 23, 42, 0.52);
            border-color: rgba(129, 140, 248, 0.78);
            box-shadow:
                0 0 0 3px rgba(99, 102, 241, 0.25),
                inset 0 1px 1px rgba(255, 255, 255, 0.18);
        }

        .liquid-glass-sheet {
            background: linear-gradient(165deg, rgba(30, 41, 59, 0.78) 0%, rgba(15, 23, 42, 0.86) 100%);
            backdrop-filter: blur(36px) saturate(195%);
            -webkit-backdrop-filter: blur(36px) saturate(195%);
            border: 1px solid rgba(255, 255, 255, 0.22);
            box-shadow:
                0 24px 64px rgba(0, 0, 0, 0.65),
                inset 0 1px 1px rgba(255, 255, 255, 0.38);
        }

        .liquid-btn-primary {
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.85) 0%, rgba(79, 70, 229, 0.72) 100%);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(199, 210, 254, 0.42);
            box-shadow:
                0 10px 28px rgba(99, 102, 241, 0.35),
                inset 0 1px 1px rgba(255, 255, 255, 0.45);
        }
        .liquid-btn-primary:hover {
            background: linear-gradient(135deg, rgba(129, 140, 248, 0.9) 0%, rgba(99, 102, 241, 0.82) 100%);
        }

        .liquid-btn-emerald {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.82) 0%, rgba(5, 150, 105, 0.72) 100%);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(167, 243, 208, 0.42);
            box-shadow:
                0 10px 28px rgba(16, 185, 129, 0.32),
                inset 0 1px 1px rgba(255, 255, 255, 0.45);
        }
        .liquid-btn-emerald:hover {
            background: linear-gradient(135deg, rgba(52, 211, 153, 0.88) 0%, rgba(16, 185, 129, 0.82) 100%);
        }

        .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; }
        
        .calendar-day { 
            text-align: center; 
            padding: 4px; 
            border-radius: 8px; 
            font-size: 0.8rem; 
            height: 36px; 
            display: flex; 
            align-items: center; 
            justify-content: center;
            transition: transform 0.15s ease;
        }
        @media (min-width: 640px) {
            .calendar-day {
                height: 40px;
                font-size: 0.875rem;
            }
        }
        
        /* 玻璃質感顏色標記 */
        .has-ot {
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.85), rgba(79, 70, 229, 0.72));
            color: white; font-weight: bold;
            border: 1px solid rgba(199, 210, 254, 0.45);
            box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.4);
        }
        .has-money {
            background: linear-gradient(135deg, rgba(16, 185, 129, 0.85), rgba(5, 150, 105, 0.72));
            color: white; font-weight: bold;
            border: 1px solid rgba(167, 243, 208, 0.45);
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.4);
        }
        .has-transport {
            background: linear-gradient(135deg, rgba(245, 158, 11, 0.85), rgba(217, 119, 6, 0.72));
            color: white; font-weight: bold;
            border: 1px solid rgba(253, 230, 138, 0.45);
            box-shadow: 0 4px 12px rgba(245, 158, 11, 0.35), inset 0 1px 1px rgba(255, 255, 255, 0.4);
        }
        
        .has-both { background: linear-gradient(135deg, rgba(99, 102, 241, 0.85) 50%, rgba(16, 185, 129, 0.85) 50%); color: white; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.35); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35); }
        .has-money-transport { background: linear-gradient(135deg, rgba(16, 185, 129, 0.85) 50%, rgba(245, 158, 11, 0.85) 50%); color: white; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.35); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35); }
        .has-ot-transport { background: linear-gradient(135deg, rgba(99, 102, 241, 0.85) 50%, rgba(245, 158, 11, 0.85) 50%); color: white; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.35); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35); }
        .has-triple { background: linear-gradient(135deg, rgba(99, 102, 241, 0.85) 33%, rgba(16, 185, 129, 0.85) 33%, rgba(16, 185, 129, 0.85) 66%, rgba(245, 158, 11, 0.85) 66%); color: white; font-weight: bold; border: 1px solid rgba(255, 255, 255, 0.35); box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.35); }
        
        .no-ot {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.08);
            color: rgba(255, 255, 255, 0.45);
        }

        .delete-ui { display: none !important; }
        .edit-mode .delete-ui { display: flex !important; }
        .edit-mode td.delete-ui, .edit-mode th.delete-ui { display: table-cell !important; }

        /* 月份按鈕（Liquid Glass 膠囊/磚塊） */
        .month-btn {
            background: linear-gradient(145deg, rgba(99, 102, 241, 0.28) 0%, rgba(79, 70, 229, 0.16) 100%);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(165, 180, 252, 0.32);
            color: #e0e7ff;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2), inset 0 1px 1px rgba(255, 255, 255, 0.25);
        }
        .month-btn:hover {
            background: linear-gradient(145deg, rgba(99, 102, 241, 0.42) 0%, rgba(79, 70, 229, 0.28) 100%);
        }

        /* 月份按鈕已發送樣式 */
        .month-btn.sent {
            background: linear-gradient(145deg, rgba(16, 185, 129, 0.32) 0%, rgba(5, 150, 105, 0.18) 100%) !important;
            border-color: rgba(110, 231, 183, 0.42) !important;
            color: #d1fae5 !important;
            box-shadow: 0 4px 14px rgba(16, 185, 129, 0.18), inset 0 1px 1px rgba(255, 255, 255, 0.28);
        }
        .month-btn.sent::before {
            content: '✓ ';
            font-size: 0.8em;
        }

        /* 編輯模式下，月份按鈕呈現醒目玻璃紅框 */
        .edit-mode .month-btn {
            border-color: rgba(248, 113, 113, 0.78) !important;
            box-shadow: 0 0 12px rgba(239, 68, 68, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.25);
        }

        .history-chip {
            display: inline-flex; align-items: center; padding: 0.25rem 0.65rem; 
            border-radius: 9999px; font-size: 0.75rem; font-weight: 500; 
            background: rgba(255, 255, 255, 0.09); color: #e2e8f0;
            border: 1px solid rgba(255, 255, 255, 0.18);
            backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.2);
            margin-right: 0.5rem; margin-bottom: 0.5rem; cursor: pointer; 
            user-select: none; transition: all 0.2s;
        }
        .history-chip:hover { background: rgba(255, 255, 255, 0.18); color: white; }
        .history-delete {
            margin-left: 0.375rem; color: rgba(255, 255, 255, 0.55); font-weight: bold; 
            padding: 0 0.25rem; border-radius: 0.25rem; transition: all 0.2s; cursor: pointer;
        }
        .history-delete:hover { color: #fca5a5; background: rgba(239, 68, 68, 0.22); }

        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        /* 時間滾輪：鎖定僅允許垂直滑動，禁止左右偏移與鏈式捲動外層網頁 */
        .time-wheel-scroll {
            overflow-y: auto;
            overflow-x: hidden;
            -webkit-overflow-scrolling: touch;
            scroll-snap-type: y mandatory;
            touch-action: pan-y;
            overscroll-behavior: contain;
        }
        .time-wheel-item {
            scroll-snap-align: center;
        }

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
<body class="min-h-screen p-2 sm:p-4 font-sans text-slate-100 flex flex-col justify-start">
    
    <!-- 卡片最大寬度限制：手機端最大 450px，電腦端（md）擴展至 800px 確保橫向排版舒適 -->
    <div class="relative z-10 w-full max-w-[450px] md:max-w-[800px] mx-auto liquid-glass-card rounded-3xl overflow-hidden p-4 sm:p-6 my-2 sm:my-4 transition-all duration-300">
        
        <!-- 登入畫面（未登入且非分享模式時顯示） -->
        <div id="loginSection" class="hidden py-4 max-w-sm mx-auto">
            <div class="text-center mb-6">
                <div class="text-4xl mb-2">🔐</div>
                <h1 class="text-2xl font-bold tracking-tight text-white drop-shadow-sm">OT 記錄器 Pro</h1>
                <p id="loginUserSubtitle" class="text-xs text-slate-300/75 mt-1 hidden"></p>
            </div>
            <form id="loginForm" class="liquid-glass-panel p-5 rounded-2xl space-y-4">
                <div>
                    <label for="loginPassword" class="block text-xs font-bold text-slate-300 mb-1.5">登入密碼</label>
                    <input type="password" id="loginPassword" autocomplete="current-password" required class="w-full liquid-glass-input text-white rounded-xl px-3.5 py-2.5 outline-none placeholder-slate-400" placeholder="請輸入系統密碼">
                </div>
                <div class="flex items-center">
                    <input type="checkbox" id="rememberLogin" checked class="h-4 w-4 text-indigo-400 bg-slate-900/60 border-white/25 rounded focus:ring-indigo-400 focus:ring-offset-0">
                    <label for="rememberLogin" class="ml-2 block text-xs text-slate-300 font-bold cursor-pointer">保持登入 (自動刷新 30 天有效期)</label>
                </div>
                <button type="submit" id="btn-login" class="w-full liquid-btn-primary text-white py-3 rounded-2xl font-bold transition">登入系統</button>
                <p id="loginError" class="text-center text-xs font-bold text-red-300 min-h-[16px]"></p>
            </form>
        </div>

        <!-- 主系統與唯讀分享容器 -->
        <div id="appContainer" class="hidden">
            <div id="mainTitleArea" class="flex items-center justify-between mb-6 gap-2">
                <div class="flex items-center gap-2.5 min-w-0">
                    <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white drop-shadow-sm truncate">OT 記錄器</h1>
                    <span id="headerUserBadge" class="hidden text-xs font-bold px-2.5 py-1 rounded-full bg-indigo-500/25 border border-indigo-300/35 text-indigo-200 truncate"></span>
                </div>
                <button type="button" onclick="logout()" id="btn-logout" class="text-xs font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-1.5 rounded-xl transition whitespace-nowrap">登出</button>
            </div>

            <div id="shareHeader" class="hidden mb-6 text-center">
                <h1 class="text-2xl font-bold text-white drop-shadow-sm" id="shareTitle">OT 記錄報表</h1>
                <p class="text-sm text-slate-300/80 mt-1">唯讀模式</p>
            </div>

            <div class="flex border-b border-white/15 mb-6" id="tabContainer">
                <button onclick="switchTab('record')" id="tab-record" class="flex-1 py-3 text-center font-bold text-indigo-300 border-b-2 border-indigo-400 bg-white/5 rounded-t-xl transition">新增記錄</button>
                <button onclick="switchTab('export')" id="tab-export" class="flex-1 py-3 text-center text-white/55 hover:text-indigo-300 hover:bg-white/5 rounded-t-xl transition">月結報表</button>
            </div>

            <div id="view-record">
                <div class="flex gap-1.5 mb-5 liquid-glass-panel p-1.5 rounded-2xl overflow-x-auto no-scrollbar">
                    <button type="button" onclick="setType('hourly')" id="btn-hourly" class="flex-1 py-2.5 px-2 rounded-xl text-sm font-bold text-white shadow-md border border-white/25 bg-white/15 backdrop-blur-md whitespace-nowrap transition">🕒 OT</button>
                    <button type="button" onclick="setType('oncall')" id="btn-oncall" class="flex-1 py-2.5 px-2 rounded-xl text-sm font-bold text-white/55 hover:bg-white/10 hover:text-white border border-transparent whitespace-nowrap transition">📅 當更</button>
                    <button type="button" onclick="setType('percall')" id="btn-percall" class="flex-1 py-2.5 px-2 rounded-xl text-sm font-bold text-white/55 hover:bg-white/10 hover:text-white border border-transparent whitespace-nowrap transition">📞 Call</button>
                    <button type="button" onclick="setType('transport')" id="btn-transport" class="flex-1 py-2.5 px-2 rounded-xl text-sm font-bold text-white/55 hover:bg-white/10 hover:text-white border border-transparent whitespace-nowrap transition">🚕 交通</button>
                </div>

                <form id="addForm" class="space-y-4">
                    <input type="hidden" id="recordType" value="hourly">
                    <div>
                        <label class="block text-sm font-medium text-slate-200" id="label-date">日期</label>
                        <div class="mt-1.5 flex items-center w-full liquid-glass-input rounded-xl px-3 py-2">
                            <input type="date" id="date" class="w-full bg-transparent border-none p-0 text-white focus:ring-0 outline-none" required>
                        </div>
                    </div>
                    <div id="group-hourly">
                        <div class="mb-4">
                            <label class="block text-sm font-medium text-slate-200">地點</label>
                            <input type="text" id="location" class="mt-1.5 block w-full liquid-glass-input text-white rounded-xl py-2 px-3 placeholder-slate-400/70 outline-none" placeholder="例如：Server Room">
                            <div id="history-location" class="flex flex-wrap gap-2 mt-2"></div>
                        </div>
                        
                        <div class="flex space-x-3 w-full">
                            <div class="flex-1 min-w-0">
                                <label class="block text-sm font-medium text-slate-200">開始時間</label>
                                <div onclick="handleTimeBoxClick('start', event)" class="mt-1.5 flex items-center justify-between w-full liquid-glass-input rounded-xl px-3 py-2 cursor-pointer">
                                    <div class="flex items-center">
                                        <input type="text" id="startHour" inputmode="numeric" maxlength="2" placeholder="--" required aria-label="開始小時" class="w-7 bg-transparent border-none p-0 text-center text-base font-mono text-white placeholder-slate-400 focus:ring-0 focus:bg-indigo-500/35 rounded outline-none">
                                        <span class="text-slate-400 font-mono font-bold mx-0.5 select-none">:</span>
                                        <input type="text" id="startMin" inputmode="numeric" maxlength="2" placeholder="--" required aria-label="開始分鐘" class="w-7 bg-transparent border-none p-0 text-center text-base font-mono text-white placeholder-slate-400 focus:ring-0 focus:bg-indigo-500/35 rounded outline-none">
                                    </div>
                                    <button type="button" onclick="event.stopPropagation(); openTimeWheel('start');" aria-label="選擇開始時間" class="text-slate-300/75 hover:text-white p-0.5 focus:outline-none">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </button>
                                </div>
                            </div>
                            <div class="flex-1 min-w-0">
                                <label class="block text-sm font-medium text-slate-200">結束時間</label>
                                <div onclick="handleTimeBoxClick('end', event)" class="mt-1.5 flex items-center justify-between w-full liquid-glass-input rounded-xl px-3 py-2 cursor-pointer">
                                    <div class="flex items-center">
                                        <input type="text" id="endHour" inputmode="numeric" maxlength="2" placeholder="--" required aria-label="結束小時" class="w-7 bg-transparent border-none p-0 text-center text-base font-mono text-white placeholder-slate-400 focus:ring-0 focus:bg-indigo-500/35 rounded outline-none">
                                        <span class="text-slate-400 font-mono font-bold mx-0.5 select-none">:</span>
                                        <input type="text" id="endMin" inputmode="numeric" maxlength="2" placeholder="--" required aria-label="結束分鐘" class="w-7 bg-transparent border-none p-0 text-center text-base font-mono text-white placeholder-slate-400 focus:ring-0 focus:bg-indigo-500/35 rounded outline-none">
                                    </div>
                                    <button type="button" onclick="event.stopPropagation(); openTimeWheel('end');" aria-label="選擇結束時間" class="text-slate-300/75 hover:text-white p-0.5 focus:outline-none">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div class="mt-4 mb-2">
                            <label class="block text-sm font-medium text-slate-200 mb-1.5">工數 (倍數)</label>
                            <div class="flex gap-2">
                                <input type="hidden" id="multiplier" value="1">
                                <button type="button" onclick="setMultiplier(1)" id="mul-1" class="flex-1 py-2.5 rounded-xl border border-indigo-400/60 bg-indigo-500/40 text-white text-sm font-bold shadow-[0_0_15px_rgba(99,102,241,0.3),inset_0_1px_1px_rgba(255,255,255,0.35)] transition">x1</button>
                                <button type="button" onclick="setMultiplier(1.5)" id="mul-1.5" class="flex-1 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white/60 text-sm font-bold hover:bg-white/10 hover:text-white transition">x1.5</button>
                                <button type="button" onclick="setMultiplier(2)" id="mul-2" class="flex-1 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white/60 text-sm font-bold hover:bg-white/10 hover:text-white transition">x2</button>
                                <button type="button" onclick="setMultiplier(3)" id="mul-3" class="flex-1 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white/60 text-sm font-bold hover:bg-white/10 hover:text-white transition">x3</button>
                            </div>
                        </div>

                        <div class="text-right text-sm text-slate-300 mt-2" id="durationCalc">時數: 0 小時</div>
                    </div>

                    <div id="group-money" class="hidden space-y-4">
                        <div id="field-endDate" class="hidden">
                            <label class="block text-sm font-medium text-slate-200">結束日期 (至)</label>
                            <div class="mt-1.5 flex items-center w-full liquid-glass-input rounded-xl px-3 py-2">
                                <input type="date" id="endDate" class="w-full bg-transparent border-none p-0 text-white focus:ring-0 outline-none">
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-slate-200">金額 (HKD)</label>
                            <input type="number" min="0" step="1" id="amount" class="mt-1.5 block w-full liquid-glass-input text-white rounded-xl py-2 px-3 placeholder-slate-400/70 outline-none" placeholder="輸入金額">
                        </div>
                        <div id="field-remarks">
                            <label class="block text-sm font-medium text-slate-200" id="label-remarks">備註 (選填)</label>
                            <input type="text" id="moneyRemarks" class="mt-1.5 block w-full liquid-glass-input text-white rounded-xl py-2 px-3 placeholder-slate-400/70 outline-none" placeholder="例如：重啟 Server">
                            <select id="transportSelect" class="mt-1.5 block w-full liquid-glass-input text-white rounded-xl p-2.5 hidden outline-none">
                                <option value="停車場" class="bg-slate-900 text-white">停車場</option>
                                <option value="隧道" class="bg-slate-900 text-white">隧道</option>
                                <option value="維修" class="bg-slate-900 text-white">維修</option>
                                <option value="其他" class="bg-slate-900 text-white">其他</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" id="btn-submit-record" class="w-full liquid-btn-primary text-white py-3 sm:py-3.5 rounded-2xl font-bold transition">儲存記錄</button>
                </form>
            </div>

            <div id="view-export" class="hidden">
                
                <!-- 歷史月份按鈕：手機端 4 欄，電腦端（md）自動延展至 6 欄 -->
                <div id="historyMonthsArea" class="mb-4 hidden">
                    <div id="historyBadges" class="grid grid-cols-4 md:grid-cols-6 gap-2 mb-4"></div>
                </div>
                
                <div id="queryControls" class="flex flex-col sm:flex-row gap-2 mb-4">
                    <div class="flex-1 flex items-center w-full liquid-glass-input rounded-xl px-3 py-2">
                        <input type="month" id="queryMonth" class="w-full bg-transparent border-none p-0 text-white focus:ring-0 outline-none">
                    </div>
                    <div class="flex gap-2 w-full sm:w-auto">
                        <button onclick="loadRecords()" class="flex-1 sm:flex-initial liquid-glass-panel text-white px-4 py-2.5 rounded-xl hover:bg-white/15 whitespace-nowrap transition font-medium">查詢</button>
                        <button onclick="copyShareLink()" id="btn-share" class="bg-sky-500/70 hover:bg-sky-400/80 border border-sky-300/40 text-white px-3.5 py-2 rounded-xl whitespace-nowrap transition shadow-[0_4px_14px_rgba(56,189,248,0.28),inset_0_1px_1px_rgba(255,255,255,0.4)]" title="複製分享連結">🔗</button>
                        <button onclick="toggleEditMode()" id="btn-edit" class="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3.5 py-2 rounded-xl whitespace-nowrap transition shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]" title="管理/編輯/刪除">✏️</button>
                    </div>
                </div>
                
                <!-- 月曆視圖 -->
                <div id="calendarView" class="mb-6 hidden liquid-glass-panel p-3 rounded-2xl max-w-md md:max-w-lg mx-auto">
                    <div class="calendar-grid"></div>
                    <div class="flex justify-center gap-4 mt-3 text-xs text-slate-300/80 flex-wrap">
                        <span class="flex items-center"><span class="w-3 h-3 bg-indigo-500/90 border border-indigo-300/50 rounded mr-1.5"></span>OT</span>
                        <span class="flex items-center"><span class="w-3 h-3 bg-emerald-500/90 border border-emerald-300/50 rounded mr-1.5"></span>當更/Call</span>
                        <span class="flex items-center"><span class="w-3 h-3 bg-amber-500/90 border border-amber-300/50 rounded mr-1.5"></span>交通</span>
                    </div>
                </div>

                <div id="recordsList" class="liquid-glass-panel rounded-2xl p-3 sm:p-4 mb-4 max-h-80 overflow-y-auto overflow-x-auto text-sm space-y-2">
                    <p class="text-center text-slate-400">請查詢</p>
                </div>

                <!-- 總結數據欄位 -->
                <div id="totalSummary" class="text-right border-t border-white/15 pt-4 space-y-1 hidden text-sm sm:text-base">
                    <div class="text-slate-300">總當更/Call: <span id="sumMoney" class="font-bold text-emerald-300 text-xl">$0</span></div>
                    <div class="text-slate-300">總交通: <span id="sumTransport" class="font-bold text-amber-300 text-xl">$0</span></div>
                    
                    <div class="text-white mt-2 pt-2 border-t border-white/15 space-y-1">
                        <div class="font-bold">總計 (含交通): <span id="sumAll" class="text-xl text-white font-bold">$0</span></div>
                        <div class="text-slate-300">總時數: <span id="sumHours" class="font-bold text-indigo-300 text-xl">0</span> hr</div>
                    </div>
                </div>
                
                <button onclick="generatePDF()" id="pdfBtn" class="w-full mt-4 liquid-btn-emerald text-white py-3 sm:py-3.5 rounded-2xl font-bold hidden transition">
                    下載 PDF 報表
                </button>
            </div>
            <p id="msg" class="mt-4 text-center text-sm font-bold min-h-[20px]"></p>
        </div>
    </div>

    <!-- 時間選擇滾輪彈出視窗 -->
    <div id="timeWheelModal" onclick="closeTimeWheel()" class="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-end sm:items-center justify-center hidden opacity-0 transition-opacity duration-300 touch-none overscroll-none">
        <div id="timeWheelSheet" onclick="event.stopPropagation();" class="w-full max-w-[450px] liquid-glass-sheet rounded-t-3xl sm:rounded-3xl p-5 space-y-4 transform translate-y-full sm:translate-y-0 sm:scale-95 transition-all duration-300 touch-none overscroll-none">
            <div class="flex items-center justify-between border-b border-white/15 pb-3">
                <button type="button" onclick="clearTimeWheel()" class="text-sm font-bold text-slate-300 hover:text-red-300 px-2 py-1 transition">清除</button>
                <h3 id="timeWheelTitle" class="text-base font-bold text-white">選擇時間</h3>
                <button type="button" onclick="confirmTimeWheel()" class="text-sm font-bold text-indigo-300 hover:text-indigo-200 px-2 py-1 transition">確定</button>
            </div>
            <div class="relative flex items-stretch h-[220px] bg-slate-950/45 rounded-2xl border border-white/15 overflow-hidden select-none shadow-inner">
                <div class="pointer-events-none absolute top-[88px] left-3 right-3 h-[44px] bg-white/10 border border-white/25 rounded-xl z-0 shadow-[inset_0_1px_1px_rgba(255,255,255,0.28)]"></div>
                <div class="pointer-events-none absolute top-0 left-0 right-0 h-[84px] bg-gradient-to-b from-slate-900/90 to-transparent z-20"></div>
                <div class="pointer-events-none absolute bottom-0 left-0 right-0 h-[84px] bg-gradient-to-t from-slate-900/90 to-transparent z-20"></div>
                <div class="pointer-events-none absolute left-1/2 top-[88px] h-[44px] -translate-x-1/2 flex items-center justify-center z-20">
                    <span class="text-2xl font-bold text-white/90 pb-0.5">:</span>
                </div>

                <div id="wheelHour" class="relative z-10 flex-1 h-[220px] no-scrollbar time-wheel-scroll">
                    <div class="h-[88px] shrink-0"></div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 0)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">00</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 1)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">01</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 2)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">02</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 3)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">03</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 4)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">04</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 5)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">05</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 6)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">06</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 7)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">07</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 8)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">08</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 9)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">09</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 10)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">10</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 11)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">11</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 12)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">12</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 13)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">13</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 14)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">14</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 15)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">15</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 16)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">16</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 17)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">17</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 18)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">18</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 19)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">19</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 20)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">20</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 21)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">21</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 22)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">22</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelHour', 23)" class="w-full h-[44px] flex items-center justify-end pr-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">23</div>
                    <div class="h-[88px] shrink-0"></div>
                </div>

                <div id="wheelMin" class="relative z-10 flex-1 h-[220px] no-scrollbar time-wheel-scroll">
                    <div class="h-[88px] shrink-0"></div>
                    <div data-wheel-item onclick="selectWheelItem('wheelMin', 0)" class="w-full h-[44px] flex items-center justify-start pl-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">00</div>
                    <div data-wheel-item onclick="selectWheelItem('wheelMin', 1)" class="w-full h-[44px] flex items-center justify-start pl-8 text-lg font-mono font-bold text-white/35 time-wheel-item cursor-pointer transition-colors">30</div>
                    <div class="h-[88px] shrink-0"></div>
                </div>
            </div>
        </div>
    </div>

    <!-- 單筆記錄編輯彈出視窗 -->
    <div id="editRecordModal" onclick="closeEditModal()" class="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-end sm:items-center justify-center hidden opacity-0 transition-opacity duration-300">
        <div id="editRecordSheet" onclick="event.stopPropagation();" class="w-full max-w-[450px] liquid-glass-sheet rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 space-y-4 transform translate-y-full sm:translate-y-0 sm:scale-95 transition-all duration-300 max-h-[90vh] overflow-y-auto">
            <div class="flex items-center justify-between border-b border-white/15 pb-3">
                <h3 class="text-base font-bold text-white">編輯記錄</h3>
                <button type="button" onclick="closeEditModal()" class="text-sm font-bold text-slate-300 hover:text-white px-2 py-1">✕</button>
            </div>
            <form id="editRecordForm" class="space-y-3.5">
                <input type="hidden" id="editId">
                <input type="hidden" id="editOriginalDate">
                <input type="hidden" id="editType">
                <div>
                    <label class="block text-xs font-bold text-slate-300 mb-1" id="editLabelDate">日期</label>
                    <div class="flex items-center w-full liquid-glass-input rounded-xl px-3 py-2">
                        <input type="date" id="editDate" required class="w-full bg-transparent border-none p-0 text-white focus:ring-0 outline-none">
                    </div>
                </div>

                <div id="editGroupHourly" class="space-y-3.5">
                    <div>
                        <label class="block text-xs font-bold text-slate-300 mb-1">地點</label>
                        <input type="text" id="editLocation" class="w-full liquid-glass-input text-white rounded-xl px-3 py-2 outline-none">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-bold text-slate-300 mb-1">開始時間</label>
                            <div class="flex items-center gap-1 liquid-glass-input rounded-xl px-2 py-1.5">
                                <select id="editStartHour" class="flex-1 bg-transparent text-white text-center font-mono outline-none"></select>
                                <span class="text-slate-400 font-mono">:</span>
                                <select id="editStartMin" class="flex-1 bg-transparent text-white text-center font-mono outline-none"></select>
                            </div>
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-300 mb-1">結束時間</label>
                            <div class="flex items-center gap-1 liquid-glass-input rounded-xl px-2 py-1.5">
                                <select id="editEndHour" class="flex-1 bg-transparent text-white text-center font-mono outline-none"></select>
                                <span class="text-slate-400 font-mono">:</span>
                                <select id="editEndMin" class="flex-1 bg-transparent text-white text-center font-mono outline-none"></select>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-300 mb-1">工數 (倍數)</label>
                        <select id="editMultiplier" class="w-full liquid-glass-input text-white rounded-xl px-3 py-2 outline-none">
                            <option value="1" class="bg-slate-900">x1</option>
                            <option value="1.5" class="bg-slate-900">x1.5</option>
                            <option value="2" class="bg-slate-900">x2</option>
                            <option value="3" class="bg-slate-900">x3</option>
                        </select>
                    </div>
                </div>

                <div id="editGroupMoney" class="hidden space-y-3.5">
                    <div id="editFieldEndDate" class="hidden">
                        <label class="block text-xs font-bold text-slate-300 mb-1">結束日期 (至)</label>
                        <div class="flex items-center w-full liquid-glass-input rounded-xl px-3 py-2">
                            <input type="date" id="editEndDate" class="w-full bg-transparent border-none p-0 text-white focus:ring-0 outline-none">
                        </div>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-300 mb-1">金額 (HKD)</label>
                        <input type="number" min="0" step="1" id="editAmount" class="w-full liquid-glass-input text-white rounded-xl px-3 py-2 outline-none">
                    </div>
                    <div id="editFieldRemarks">
                        <label class="block text-xs font-bold text-slate-300 mb-1" id="editLabelRemarks">備註</label>
                        <input type="text" id="editMoneyRemarks" class="w-full liquid-glass-input text-white rounded-xl px-3 py-2 outline-none">
                        <select id="editTransportSelect" class="w-full liquid-glass-input text-white rounded-xl p-2.5 hidden outline-none">
                            <option value="停車場" class="bg-slate-900 text-white">停車場</option>
                            <option value="隧道" class="bg-slate-900 text-white">隧道</option>
                            <option value="維修" class="bg-slate-900 text-white">維修</option>
                            <option value="其他" class="bg-slate-900 text-white">其他</option>
                        </select>
                    </div>
                </div>

                <div class="flex gap-2.5 pt-2">
                    <button type="button" onclick="closeEditModal()" class="flex-1 py-3 text-sm font-bold text-slate-200 bg-white/10 border border-white/15 rounded-2xl hover:bg-white/20 transition">取消</button>
                    <button type="submit" id="btn-save-edit" class="flex-1 py-3 text-sm font-bold text-white liquid-btn-primary rounded-2xl transition">儲存變更</button>
                </div>
            </form>
        </div>
    </div>

    <!-- 管理月份的 Action Sheet / 彈出式底部選單 -->
    <div id="monthActionModal" onclick="closeMonthModal()" class="fixed inset-0 bg-black/50 backdrop-blur-md z-50 flex items-end sm:items-center justify-center hidden opacity-0 transition-opacity duration-300">
        <div id="monthActionSheet" onclick="event.stopPropagation();" class="w-full max-w-[450px] liquid-glass-sheet rounded-t-3xl sm:rounded-3xl p-6 space-y-4 transform translate-y-full sm:translate-y-0 sm:scale-95 transition-all duration-300">
            <div class="text-center">
                <h3 id="modalMonthTitle" class="text-lg font-bold text-white font-mono">管理月份</h3>
                <p class="text-xs text-slate-300/75 mt-1">請選擇要對該月份執行的安全操作</p>
            </div>
            <div class="flex flex-col gap-2.5 pt-2">
                <button type="button" id="modalToggleSentBtn" class="w-full py-3.5 px-4 text-sm font-bold text-emerald-100 bg-emerald-500/20 border border-emerald-400/40 rounded-2xl hover:bg-emerald-500/35 transition flex items-center justify-center gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)]">
                    <span id="modalToggleSentIcon">📤</span> <span id="modalToggleSentText">標記為已提交</span>
                </button>
                <button type="button" id="modalDeleteBtn" class="w-full py-3.5 px-4 text-sm font-bold text-red-100 bg-red-500/20 border border-red-400/40 rounded-2xl hover:bg-red-500/35 transition flex items-center justify-center gap-2 shadow-[inset_0_1px_1px_rgba(255,255,255,0.22)]">
                    🗑️ 刪除整月資料
                </button>
                <button type="button" onclick="closeMonthModal()" class="w-full py-3.5 px-4 text-sm font-bold text-slate-200 bg-white/10 border border-white/15 rounded-2xl hover:bg-white/20 transition shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                    取消
                </button>
            </div>
        </div>
    </div>
    <!--APP_SCRIPTS-->
</body>
</html>
`;
