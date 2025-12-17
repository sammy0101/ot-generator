export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // === API 路由：新增資料 (POST /api/add) ===
    if (url.pathname === '/api/add' && request.method === 'POST') {
      const data = await request.json();
      
      // 1. 簡單驗證密碼
      if (data.pin !== env.AUTH_PIN) {
        return new Response('密碼錯誤', { status: 401 });
      }

      // 2. 決定 Key (格式: OT_2023-10) -> 這樣可以按月存取
      // data.date 格式為 "2023-10-27"
      const monthKey = `OT_${data.date.substring(0, 7)}`; 

      // 3. 讀取舊資料 -> 插入新資料 -> 寫回 (Read-Modify-Write)
      let records = await env.OT_RECORDS.get(monthKey, { type: 'json' });
      if (!records) records = [];
      
      records.push({
        id: Date.now(), // 唯一 ID
        date: data.date,
        location: data.location,
        start: data.start,
        end: data.end,
        timestamp: new Date().toISOString()
      });

      // 依照日期排序
      records.sort((a, b) => new Date(a.date) - new Date(b.date));

      await env.OT_RECORDS.put(monthKey, JSON.stringify(records));
      
      return new Response(JSON.stringify({ success: true, count: records.length }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // === API 路由：讀取某月資料 (GET /api/get?month=2023-10) ===
    if (url.pathname === '/api/get' && request.method === 'GET') {
      const month = url.searchParams.get('month'); // e.g., 2023-10
      const pin = url.searchParams.get('pin');

      if (pin !== env.AUTH_PIN) {
         return new Response(JSON.stringify({ error: '密碼錯誤' }), { status: 401 });
      }

      const key = `OT_${month}`;
      const records = await env.OT_RECORDS.get(key, { type: 'json' }) || [];

      return new Response(JSON.stringify(records), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // === 預設路由：回傳前端網頁 ===
    return new Response(htmlUI(), {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};

// 這是前端的 HTML 字串，包含存檔與生成 PDF 的邏輯
function htmlUI() {
  return `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OT 記錄與生成器</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
    <script src="https://unpkg.com/@pdf-lib/fontkit@0.0.4/dist/fontkit.umd.min.js"></script>
</head>
<body class="bg-gray-50 min-h-screen p-4">
    <div class="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl p-6">
        
        <!-- 密碼欄位 (全域使用) -->
        <div class="mb-4">
            <label class="block text-sm font-bold text-gray-700">存取密碼 (PIN)</label>
            <input type="password" id="pin" class="mt-1 block w-full rounded border-gray-300 border p-2 bg-yellow-50" placeholder="請輸入密碼">
        </div>

        <!-- 分頁切換 -->
        <div class="flex border-b mb-4">
            <button onclick="switchTab('record')" id="tab-record" class="w-1/2 py-2 font-bold text-indigo-600 border-b-2 border-indigo-600">每日打卡</button>
            <button onclick="switchTab('export')" id="tab-export" class="w-1/2 py-2 text-gray-500">月結匯出</button>
        </div>

        <!-- 分頁 1: 每日打卡 -->
        <div id="view-record">
            <h2 class="text-xl font-bold mb-4">新增 OT 記錄</h2>
            <form id="addForm" class="space-y-4">
                <div>
                    <label class="block text-sm">日期</label>
                    <input type="date" id="date" class="w-full border p-2 rounded" required>
                </div>
                <div>
                    <label class="block text-sm">地點</label>
                    <input type="text" id="location" class="w-full border p-2 rounded" placeholder="XXX地點" required>
                </div>
                <div class="flex gap-2">
                    <div class="w-1/2">
                        <label class="block text-sm">開始</label>
                        <input type="time" id="start" class="w-full border p-2 rounded" required>
                    </div>
                    <div class="w-1/2">
                        <label class="block text-sm">結束</label>
                        <input type="time" id="end" class="w-full border p-2 rounded" required>
                    </div>
                </div>
                <button type="submit" class="w-full bg-indigo-600 text-white py-2 rounded hover:bg-indigo-700">儲存記錄</button>
            </form>
        </div>

        <!-- 分頁 2: 月結匯出 -->
        <div id="view-export" class="hidden">
            <h2 class="text-xl font-bold mb-4">生成 PDF 報表</h2>
            <div class="space-y-4">
                <div>
                    <label class="block text-sm">選擇月份</label>
                    <input type="month" id="queryMonth" class="w-full border p-2 rounded">
                </div>
                <button onclick="loadRecords()" class="w-full bg-gray-600 text-white py-2 rounded hover:bg-gray-700">查詢記錄</button>
                
                <div id="recordsList" class="bg-gray-50 p-2 rounded text-sm max-h-40 overflow-y-auto">
                    <p class="text-gray-400 text-center">尚未查詢</p>
                </div>

                <button onclick="generatePDF()" id="pdfBtn" class="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 hidden">
                    下載 PDF
                </button>
            </div>
        </div>

        <p id="msg" class="mt-4 text-center text-sm font-bold text-red-500"></p>
    </div>

    <script>
        // 初始化預設日期
        document.getElementById('date').valueAsDate = new Date();
        document.getElementById('queryMonth').value = new Date().toISOString().slice(0, 7);

        // 儲存目前查詢到的資料
        let currentRecords = [];

        function switchTab(tab) {
            document.getElementById('view-record').classList.toggle('hidden', tab !== 'record');
            document.getElementById('view-export').classList.toggle('hidden', tab !== 'export');
            
            document.getElementById('tab-record').className = tab === 'record' ? 'w-1/2 py-2 font-bold text-indigo-600 border-b-2 border-indigo-600' : 'w-1/2 py-2 text-gray-500';
            document.getElementById('tab-export').className = tab === 'export' ? 'w-1/2 py-2 font-bold text-indigo-600 border-b-2 border-indigo-600' : 'w-1/2 py-2 text-gray-500';
            document.getElementById('msg').innerText = '';
        }

        // --- 功能 1: 新增記錄 ---
        document.getElementById('addForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const pin = document.getElementById('pin').value;
            if(!pin) return alert('請輸入密碼');

            const payload = {
                pin: pin,
                date: document.getElementById('date').value,
                location: document.getElementById('location').value,
                start: document.getElementById('start').value,
                end: document.getElementById('end').value
            };

            const btn = e.target.querySelector('button');
            btn.disabled = true;
            btn.innerText = '儲存中...';

            try {
                const res = await fetch('/api/add', {
                    method: 'POST',
                    body: JSON.stringify(payload)
                });
                if(res.ok) {
                    document.getElementById('msg').innerText = '儲存成功！';
                    document.getElementById('msg').className = 'mt-4 text-center text-sm font-bold text-green-600';
                } else {
                    throw new Error(await res.text());
                }
            } catch(err) {
                alert('錯誤: ' + err.message);
            } finally {
                btn.disabled = false;
                btn.innerText = '儲存記錄';
            }
        });

        // --- 功能 2: 查詢記錄 ---
        async function loadRecords() {
            const pin = document.getElementById('pin').value;
            const month = document.getElementById('queryMonth').value;
            if(!pin) return alert('請輸入密碼');

            try {
                const res = await fetch(\`/api/get?month=\${month}&pin=\${pin}\`);
                const data = await res.json();
                
                if(data.error) throw new Error(data.error);

                currentRecords = data;
                const listEl = document.getElementById('recordsList');
                if(data.length === 0) {
                    listEl.innerHTML = '<p class="text-center text-gray-500">該月無記錄</p>';
                    document.getElementById('pdfBtn').classList.add('hidden');
                } else {
                    listEl.innerHTML = data.map(r => 
                        \`<div class="border-b py-1">\${r.date} \${r.location} (\${r.start}-\${r.end})</div>\`
                    ).join('');
                    document.getElementById('pdfBtn').classList.remove('hidden');
                    document.getElementById('msg').innerText = \`找到 \${data.length} 筆記錄\`;
                }
            } catch(err) {
                alert('查詢失敗: ' + err.message);
            }
        }

        // --- 功能 3: 生成 PDF (批次) ---
        async function generatePDF() {
            if(currentRecords.length === 0) return;
            const btn = document.getElementById('pdfBtn');
            btn.innerText = "正在生成 PDF...";
            btn.disabled = true;

            try {
                const { PDFDocument, rgb } = PDFLib;
                const pdfDoc = await PDFDocument.create();
                pdfDoc.registerFontkit(fontkit);

                // 下載字型
                const fontBytes = await fetch('https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-tc@4.5.12/files/noto-sans-tc-all-400-normal.woff').then(res => res.arrayBuffer());
                const customFont = await pdfDoc.embedFont(fontBytes);

                const page = pdfDoc.addPage([595.28, 841.89]); // A4
                const { width, height } = page.getSize();
                const fontSize = 14;
                let yPos = height - 50; // 起始高度

                // 寫入標題
                page.drawText(\`\${document.getElementById('queryMonth').value} OT 記錄表\`, {
                    x: 50, y: yPos, size: 20, font: customFont, color: rgb(0,0,0)
                });
                yPos -= 40;

                // 迴圈寫入每一筆資料
                for (const rec of currentRecords) {
                    const d = new Date(rec.date);
                    const dateStr = \`\${d.getFullYear()}年\${(d.getMonth()+1).toString().padStart(2,'0')}月\${d.getDate().toString().padStart(2,'0')}日\`;
                    const timeStr = \`\${rec.start.replace(':','')}-\${rec.end.replace(':','')}時間\`;
                    
                    // 格式: 20XX年XX月XX日 XXX地點 XXXX-XXXX時間
                    const lineText = \`\${dateStr} \${rec.location} \${timeStr}\`;

                    page.drawText(lineText, {
                        x: 50,
                        y: yPos,
                        size: fontSize,
                        font: customFont,
                        color: rgb(0, 0, 0),
                    });

                    yPos -= 25; // 每行間距

                    // 如果寫滿了，新增一頁 (大概留 50 margin)
                    if (yPos < 50) {
                        const newPage = pdfDoc.addPage([595.28, 841.89]);
                        yPos = height - 50;
                    }
                }

                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = \`OT_Report_\${document.getElementById('queryMonth').value}.pdf\`;
                link.click();

            } catch(err) {
                console.error(err);
                alert("生成失敗: " + err.message);
            } finally {
                btn.innerText = "下載 PDF";
                btn.disabled = false;
            }
        }
    </script>
</body>
</html>
  `;
}
