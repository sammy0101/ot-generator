export default {
  async fetch(request, env, ctx) {
    const html = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OT 單據生成器</title>
    <!-- 引入 Tailwind CSS 讓介面好看一點 -->
    <script src="https://cdn.tailwindcss.com"></script>
    <!-- 引入 PDF-LIB 用於生成 PDF -->
    <script src="https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"></script>
    <!-- 引入 Fontkit 用於處理自定義字型 -->
    <script src="https://unpkg.com/@pdf-lib/fontkit@0.0.4/dist/fontkit.umd.min.js"></script>
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center p-4">

    <div class="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 class="text-2xl font-bold mb-6 text-center text-gray-800">OT 單據生成器</h1>
        
        <form id="otForm" class="space-y-4">
            <div>
                <label class="block text-sm font-medium text-gray-700">日期</label>
                <input type="date" id="date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" required>
            </div>

            <div>
                <label class="block text-sm font-medium text-gray-700">地點 (XXX地點)</label>
                <input type="text" id="location" placeholder="例如：公司伺服器房" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" required>
            </div>

            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700">開始時間</label>
                    <input type="time" id="startTime" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" required>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">結束時間</label>
                    <input type="time" id="endTime" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 border p-2" required>
                </div>
            </div>

            <button type="submit" id="generateBtn" class="w-full bg-indigo-600 text-white py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors">
                生成並下載 PDF
            </button>
            <p id="status" class="text-sm text-center text-gray-500 mt-2"></p>
        </form>
    </div>

    <script>
        // 設定今天的日期為預設值
        document.getElementById('date').valueAsDate = new Date();

        document.getElementById('otForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const statusEl = document.getElementById('status');
            const btn = document.getElementById('generateBtn');
            
            try {
                btn.disabled = true;
                btn.textContent = "生成中...";
                statusEl.textContent = "正在下載中文字型與生成文件...";

                // 1. 獲取輸入資料
                const dateVal = new Date(document.getElementById('date').value);
                const location = document.getElementById('location').value;
                const startRaw = document.getElementById('startTime').value.replace(':', '');
                const endRaw = document.getElementById('endTime').value.replace(':', '');
                
                // 格式化日期：20XX年XX月XX日
                const year = dateVal.getFullYear();
                const month = (dateVal.getMonth() + 1).toString().padStart(2, '0');
                const day = dateVal.getDate().toString().padStart(2, '0');
                const formattedDate = \`\${year}年\${month}月\${day}日\`;

                // 組合最終字串
                // 格式: 20XX年XX月XX日 XXX地點 XXXX-XXXX時間
                const finalString = \`\${formattedDate} \${location} \${startRaw}-\${endRaw}時間\`;

                // 2. 初始化 PDF 文件
                const { PDFDocument, rgb } = PDFLib;
                const pdfDoc = await PDFDocument.create();
                
                // 註冊 fontkit
                pdfDoc.registerFontkit(fontkit);

                // 3. 下載中文字型 (這是關鍵，因為預設字型不支援中文)
                // 這裡使用 Google Noto Sans TC 的開源 CDN 連結
                const fontUrl = 'https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-tc@4.5.12/files/noto-sans-tc-all-400-normal.woff';
                const fontBytes = await fetch(fontUrl).then(res => res.arrayBuffer());
                
                // 嵌入字型
                const customFont = await pdfDoc.embedFont(fontBytes);

                // 4. 建立頁面並寫入文字
                const page = pdfDoc.addPage([595.28, 841.89]); // A4 尺寸
                const { width, height } = page.getSize();
                const fontSize = 18; // 字體大小
                const textWidth = customFont.widthOfTextAtSize(finalString, fontSize);

                page.drawText(finalString, {
                    x: (width - textWidth) / 2, // 水平置中
                    y: height - 100,            // 距離頂部 100 單位
                    size: fontSize,
                    font: customFont,
                    color: rgb(0, 0, 0),
                });

                // 5. 輸出並下載
                const pdfBytes = await pdfDoc.save();
                const blob = new Blob([pdfBytes], { type: 'application/pdf' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = \`OT_\${year}\${month}\${day}.pdf\`;
                link.click();

                statusEl.textContent = "下載完成！";
            } catch (err) {
                console.error(err);
                statusEl.textContent = "發生錯誤，請檢查網路 (字型下載失敗？)";
                alert("生成失敗：" + err.message);
            } finally {
                btn.disabled = false;
                btn.textContent = "生成並下載 PDF";
            }
        });
    </script>
</body>
</html>
    `;

    return new Response(html, {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};
