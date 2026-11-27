# Complete Project Codebase
Generated on: Fri Nov 27 08:02:55 UTC 2026

## File: src/api.js
````js
export async function handleAdd(request, env) {
    try {
        const data = await request.json();
        if (data.pin !== env.AUTH_PIN) return new Response('密碼錯誤', { status: 401 });

        const monthKey = `OT_${data.date.substring(0, 7)}`;
        let records = await env.OT_RECORDS.get(monthKey, { type: 'json' });
        if (!records) records =[];

        records.push({
            id: Date.now(),
            type: data.type || 'hourly',
            date: data.date,
            endDate: data.endDate,
            location: data.location,
            start: data.start,
            end: data.end,
            multiplier: data.multiplier ? parseFloat(data.multiplier) : 1,
            amount: data.amount ? parseInt(data.amount) : 0,
            timestamp: new Date().toISOString()
        });

        records.sort((a, b) => new Date(a.date) - new Date(b.date));
        await env.OT_RECORDS.put(monthKey, JSON.stringify(records));

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function handleDelete(request, env) {
    try {
        const data = await request.json();
        if (data.pin !== env.AUTH_PIN) return new Response('密碼錯誤', { status: 401 });

        const monthKey = `OT_${data.date.substring(0, 7)}`;
        let records = await env.OT_RECORDS.get(monthKey, { type: 'json' });
        if (!records) return new Response(JSON.stringify({ success: false }), { status: 404 });

        const newRecords = records.filter(r => r.id !== data.id);
        await env.OT_RECORDS.put(monthKey, JSON.stringify(newRecords));

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function handleDeleteMonth(request, env) {
    try {
        const data = await request.json();
        if (data.pin !== env.AUTH_PIN) return new Response('密碼錯誤', { status: 401 });
        const monthKey = `OT_${data.month}`;
        await env.OT_RECORDS.delete(monthKey);
        
        let sentList = await env.OT_RECORDS.get("OT_META_SENT", { type: 'json' }) ||[];
        if (sentList.includes(data.month)) {
            sentList = sentList.filter(m => m !== data.month);
            await env.OT_RECORDS.put("OT_META_SENT", JSON.stringify(sentList));
        }

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function handleToggleSent(request, env) {
    try {
        const data = await request.json();
        if (data.pin !== env.AUTH_PIN) return new Response('密碼錯誤', { status: 401 });

        let sentList = await env.OT_RECORDS.get("OT_META_SENT", { type: 'json' }) ||[];
        
        if (sentList.includes(data.month)) {
            sentList = sentList.filter(m => m !== data.month);
        } else {
            sentList.push(data.month);
        }
        
        await env.OT_RECORDS.put("OT_META_SENT", JSON.stringify(sentList));

        return new Response(JSON.stringify({ success: true, list: sentList }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

export async function handleGet(request, env) {
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    const pin = url.searchParams.get('pin');
    if (pin !== env.AUTH_PIN) return new Response(JSON.stringify({ error: '密碼錯誤' }), { status: 401 });
    const key = `OT_${month}`;
    const records = await env.OT_RECORDS.get(key, { type: 'json' }) ||[];
    return new Response(JSON.stringify(records), { headers: { 'Content-Type': 'application/json' } });
}

export async function handlePublicGet(request, env) {
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    const key = `OT_${month}`;
    const records = await env.OT_RECORDS.get(key, { type: 'json' }) ||[];
    return new Response(JSON.stringify(records), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleListMonths(request, env) {
    const url = new URL(request.url);
    const pin = url.searchParams.get('pin');
    if (pin !== env.AUTH_PIN) return new Response(JSON.stringify({ error: '密碼錯誤' }), { status: 401 });
    
    const list = await env.OT_RECORDS.list({ prefix: "OT_" });
    const months = list.keys
        .map(k => k.name.replace('OT_', ''))
        .filter(m => m.match(/^\d{4}-\d{2}$/)); 
    
    months.sort().reverse();
    const sentList = await env.OT_RECORDS.get("OT_META_SENT", { type: 'json' }) ||[];

    return new Response(JSON.stringify({ months, sentList }), { headers: { 'Content-Type': 'application/json' } });
}

// === 從 KV 讀取 Base64 純文字字型 ===
export async function handleGetFont(request, env) {
    try {
        const b64 = await env.OT_RECORDS.get('SYSTEM_FONT_B64');
        if (!b64) return new Response("Font not found in KV", { status: 404 });
        
        return new Response(b64, {
            headers: {
                "Content-Type": "text/plain",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

````

## File: src/ui/pdf.js
````js
export const pdfScript = `
    async function generatePDF() {
        if(currentRecords.length === 0) return;
        const btn = document.getElementById('pdfBtn');
        const originalText = btn.innerText;
        
        btn.innerText = "載入字型與生成中... (請稍候)"; 
        btn.disabled = true;
        
        try {
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);
            
            const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
            
            // === 獲取純文字字型並還原（含記憶體快取） ===
            let fontBytes = window.__CACHED_FONT_BYTES;
            if (!fontBytes) {
                const fontUrl = '/api/font'; 
                const fontRes = await fetch(fontUrl);
                if (!fontRes.ok) {
                    const errText = await fontRes.text();
                    throw new Error('字型載入失敗: ' + errText);
                }
                
                const b64String = await fontRes.text();
                if (b64String.includes("<!DOC") || b64String.includes("<html")) {
                    throw new Error("下載到無效的字型檔案，請確認 GitHub Actions 是否部署成功。");
                }

                const binaryString = window.atob(b64String);
                const len = binaryString.length;
                fontBytes = new Uint8Array(len);
                for (let i = 0; i < len; i++) {
                    fontBytes[i] = binaryString.charCodeAt(i);
                }
                window.__CACHED_FONT_BYTES = fontBytes;
            }

            const chineseFont = await pdfDoc.embedFont(fontBytes);
            // ============================================

            let page = pdfDoc.addPage([595.28, 841.89]);
            const { width, height } = page.getSize();
            let yPos = height - 60;
            const marginX = 40;

            const colorBlack = rgb(0, 0, 0);
            const colorGreen = rgb(0, 0.5, 0);
            const colorOrange = rgb(0.85, 0.5, 0);
            const colorBlue = rgb(0.38, 0.4, 0.94);

            const monthStr = document.getElementById('queryMonth').value;
            page.drawText(monthStr, { x: marginX, y: yPos, size: 20, font: helveticaBold });
            page.drawText(' OT/當更/交通 記錄表', { x: marginX + 90, y: yPos, size: 20, font: chineseFont });
            
            if (window.USER_NAME) {
                const nameText = window.USER_NAME;
                const nameWidth = chineseFont.widthOfTextAtSize(nameText, 14);
                page.drawText(nameText, { x: width - marginX - nameWidth, y: yPos, size: 14, font: chineseFont, color: rgb(0.3, 0.3, 0.3) });
            }

            yPos -= 40;

            const col = { d: 40, item: 130, detail: 350, val: 480 };
            const fontSize = 11;
            const drawTxt = (text, x, font, color=colorBlack) => page.drawText(text, { x, y: yPos, size: fontSize, font, color });

            const drawTableHeader = () => {
                drawTxt('日期', col.d, chineseFont, rgb(0.5,0.5,0.5));
                drawTxt('項目/地點', col.item, chineseFont, rgb(0.5,0.5,0.5));
                drawTxt('時間/詳情', col.detail, chineseFont, rgb(0.5,0.5,0.5));
                drawTxt('時數/金額', col.val, chineseFont, rgb(0.5,0.5,0.5));
                page.drawLine({ start: { x: marginX, y: yPos-5 }, end: { x: width-marginX, y: yPos-5 }, thickness: 1, color: rgb(0.8,0.8,0.8) });
                yPos -= 25;
            };

            drawTableHeader();

            for (const r of currentRecords) {
                const amount = Number(r.amount) || 0; 
                if (r.type !== 'hourly' && amount === 0) continue;

                // 繪製列之前檢查空間，換頁時重新指派 page 並繪製表頭
                if (yPos < 60) {
                    page = pdfDoc.addPage([595.28, 841.89]);
                    yPos = height - 60;
                    drawTableHeader();
                }

                let itemStr = '', detailStr = '', valStr = '';
                let detailFont = helvetica; 
                let rowColor = colorBlack;

                if (r.type === 'hourly') {
                    itemStr = r.location || 'OT';
                    const mins = getMinutesDiff(r.start, r.end);
                    detailStr = r.start.replace(':', '') + ' - ' + r.end.replace(':', '');
                    const mul = r.multiplier || 1;
                    const effectiveMins = mins * mul;
                    valStr = formatHours(effectiveMins) + ' hr';
                    if (mul > 1) valStr += ' (x' + mul + ')';
                    rowColor = colorBlue;
                } else if (r.type === 'transport') {
                    itemStr = '交通費';
                    detailStr = r.location ? r.location : '-';
                    detailFont = chineseFont; 
                    valStr = '$' + amount;
                    rowColor = colorOrange;
                } else if (r.type === 'oncall') {
                    itemStr = '當更 On-Call';
                    const startD = r.date.split('-')[2];
                    const endD = r.endDate ? r.endDate.split('-')[2] : '';
                    detailStr = startD + '日 - ' + endD + '日';
                    detailFont = chineseFont;
                    valStr = '$' + amount;
                    rowColor = colorGreen;
                } else { 
                    itemStr = 'Call';
                    detailStr = r.location ? r.location : '-';
                    detailFont = chineseFont;
                    valStr = '$' + amount;
                    rowColor = colorGreen;
                }

                drawTxt(r.date, col.d, helvetica);
                const safeItem = itemStr.length > 20 ? itemStr.substring(0,19)+'...' : itemStr;
                drawTxt(safeItem, col.item, chineseFont, rowColor);
                drawTxt(detailStr, col.detail, detailFont);
                drawTxt(valStr, col.val, helveticaBold, rowColor);

                page.drawLine({ start: { x: marginX, y: yPos-8 }, end: { x: width-marginX, y: yPos-8 }, thickness: 0.5, color: rgb(0.9,0.9,0.9) });
                yPos -= 25;
            }

            // 總結區塊需要約 110pt 高度，空間不足時自動換頁
            if (yPos < 150) {
                page = pdfDoc.addPage([595.28, 841.89]);
                yPos = height - 60;
            }

            yPos -= 10;
            page.drawLine({ start: { x: marginX, y: yPos }, end: { x: width-marginX, y: yPos }, thickness: 1 });
            yPos -= 25;

            // 1. 總當更/Call
            drawTxt("總當更/Call: ", 350, chineseFont);
            drawTxt("$" + grandTotalMoney, 440, helveticaBold, colorGreen);
            yPos -= 20;

            // 2. 總交通
            drawTxt("總交通: ", 350, chineseFont);
            drawTxt("$" + grandTotalTransport, 440, helveticaBold, colorOrange);
            yPos -= 15;

            // 3. 統計小分隔線
            page.drawLine({ start: { x: 350, y: yPos }, end: { x: width-marginX, y: yPos }, thickness: 0.5, color: rgb(0.7,0.7,0.7) });
            yPos -= 20;

            // 4. 總計 (含交通)
            drawTxt("總計 (含交通): ", 350, chineseFont); 
            const totalAll = grandTotalMoney + grandTotalTransport;
            drawTxt("$" + totalAll, 440, helveticaBold, colorBlack); 
            yPos -= 20;

            // 5. 總時數
            drawTxt("總時數: ", 350, chineseFont);
            drawTxt(formatHours(grandTotalMinutes) + " hr", 440, helveticaBold, colorBlue);

            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const blobUrl = URL.createObjectURL(blob);
            let filename = 'OT_Record_' + monthStr + '.pdf';
            if (window.USER_NAME) filename = 'OT_Record_' + monthStr + '_' + window.USER_NAME + '.pdf';

            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);

        } catch(err) { 
            console.error(err); 
            alert("生成失敗: " + err.message); 
        } finally { 
            btn.disabled = false; 
            btn.innerText = originalText; 
        }
    }
`;
````

## File: src/ui/html.js
````js
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
        .empty-day { background-color: transparent; }

        .delete-ui { display: none !important; }
        .edit-mode .delete-ui { display: flex !important; }
        .edit-mode td.delete-ui, .edit-mode th.delete-ui { display: table-cell !important; }

        .status-ui { display: none !important; }
        .edit-mode .status-ui { display: flex !important; }

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
        
        <div id="mainTitleArea" class="text-center mb-6">
            <h1 class="text-2xl font-bold tracking-tight text-white drop-shadow-sm">OT 記錄器</h1>
        </div>

        <div id="authSection" class="mb-4 liquid-glass-panel p-3.5 sm:p-4 rounded-2xl">
            <label class="block text-xs font-bold text-slate-300 mb-1.5">存取密碼 (PIN)</label>
            <input type="password" id="pin" class="w-full liquid-glass-input text-white rounded-xl px-3 py-2 outline-none placeholder-slate-400" placeholder="****">
            <div class="mt-2.5 flex items-center">
                <input type="checkbox" id="rememberPin" class="h-4 w-4 text-indigo-400 bg-slate-900/60 border-white/25 rounded focus:ring-indigo-400 focus:ring-offset-0">
                <label for="rememberPin" class="ml-2 block text-xs text-slate-300 font-bold cursor-pointer">記住密碼 (下次自動登入)</label>
            </div>
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
                        <input type="number" id="amount" class="mt-1.5 block w-full liquid-glass-input text-white rounded-xl py-2 px-3 placeholder-slate-400/70 outline-none" placeholder="輸入金額">
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
                    <button onclick="toggleEditMode()" id="btn-edit" class="bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3.5 py-2 rounded-xl whitespace-nowrap transition shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]" title="管理/刪除">✏️</button>
                </div>
            </div>
            
            <!-- 月曆視圖：電腦端（md）最大寬度設為 lg 確保整體比例平衡 -->
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

    <!-- 時間選擇滾輪彈出視窗（Liquid Glass 風格） -->
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

    <!-- 管理月份的 Action Sheet / 彈出式底部選單（Liquid Glass 風格） -->
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
</body>
</html>
`;

````

## File: src/ui/logic.js
````js
export const logicScript = `
    const today = new Date();
    document.getElementById('date').valueAsDate = today;
    document.getElementById('endDate').valueAsDate = today;
    document.getElementById('queryMonth').value = today.toISOString().slice(0, 7);
    
    let currentRecords = [];
    let grandTotalMinutes = 0;
    let grandTotalMoney = 0;
    let grandTotalTransport = 0;
    let knownMonths = new Set();
    let sentMonths = new Set(); 
    let isEditMode = false;
    let modalCloseTimer = null;
    let timeWheelTimer = null;
    let activeTimePrefix = null;
    const TIME_ROW_HEIGHT = 44;

    const urlParams = new URLSearchParams(window.location.search);
    const isShareMode = urlParams.get('view') === 'share';
    const sharedMonth = urlParams.get('month');
    const isTouchPrimary = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

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

    // === 歷史記錄自訂儲存與渲染功能 ===
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
        try {
            const history = JSON.parse(localStorage.getItem('ot_hist_' + key) || '[]');
            if (history.length === 0) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = history.map(val => {
                const escapedVal = val.replace(/'/g, "\\\\'");
                return '<span class="history-chip" onclick="document.getElementById(\\'' + targetInputId + '\\').value=\\'' + escapedVal + '\\'; if(\\'' + targetInputId + '\\' === \\'location\\' && typeof updateDuration === \\'function\\') updateDuration();">' +
                    val +
                    '<span class="history-delete" onclick="event.stopPropagation(); deleteHistory(\\'' + key + '\\', \\'' + escapedVal + '\\', \\'' + containerId + '\\', \\'' + targetInputId + '\\')">×</span>' +
                    '</span>';
            }).join('');
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

    (init)();

    function init() {
        setupTimeControls();
        updateDuration();

        if (isShareMode) {
            document.getElementById('mainTitleArea').classList.add('hidden');
            document.getElementById('authSection').classList.add('hidden');
            document.getElementById('tabContainer').classList.add('hidden');
            document.getElementById('view-record').classList.add('hidden');
            document.getElementById('view-export').classList.remove('hidden');
            
            document.getElementById('queryControls').classList.add('hidden');
            document.getElementById('historyMonthsArea').classList.add('hidden');
            
            document.getElementById('shareHeader').classList.remove('hidden');
            const monthLabel = sharedMonth ? ' (' + sharedMonth + ')' : '';
            if (window.USER_NAME) {
                document.getElementById('shareTitle').innerText = window.USER_NAME + " 的 OT 記錄" + monthLabel;
            } else {
                document.getElementById('shareTitle').innerText = "OT 記錄報表" + monthLabel;
            }

            if (sharedMonth) {
                document.getElementById('queryMonth').value = sharedMonth;
                loadRecords(true); 
            }
        } else {
            const pinEl = document.getElementById('pin');
            const rememberEl = document.getElementById('rememberPin');
            const savedPin = localStorage.getItem('ot_pin');
            if (savedPin && pinEl && rememberEl) {
                pinEl.value = savedPin;
                rememberEl.checked = true;
                fetchHistoryMonths();
            }
            if (rememberEl) {
                rememberEl.addEventListener('change', managePinStorage);
            }
            if (pinEl) {
                pinEl.addEventListener('input', function() {
                    if (rememberEl && rememberEl.checked && this.value) {
                        localStorage.setItem('ot_pin', this.value);
                    }
                });
            }
            renderHistoryChips('location', 'history-location', 'location');
        }
    }

    function managePinStorage() {
        if(isShareMode) return;
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
            btn.className = "bg-red-500/75 hover:bg-red-500/90 border border-red-300/50 text-white px-3.5 py-2 rounded-xl whitespace-nowrap transition shadow-[0_4px_14px_rgba(239,68,68,0.3),inset_0_1px_1px_rgba(255,255,255,0.4)] font-bold";
            btn.innerText = '完成';
            container.classList.add('edit-mode'); 
        } else {
            btn.className = "bg-white/10 hover:bg-white/20 border border-white/20 text-white px-3.5 py-2 rounded-xl whitespace-nowrap transition shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)]";
            btn.innerText = '✏️';
            container.classList.remove('edit-mode');
        }
    }

    // === 點擊月份按鈕時的分流控制 ===
    function handleMonthClick(m) {
        if (isEditMode) {
            openMonthModal(m);
        } else {
            document.getElementById('queryMonth').value = m;
            loadRecords();
        }
    }

    // === 月份管理彈出視窗控制 ===
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

    // === 複製分享連結功能 ===
    function copyShareLink() {
        const month = document.getElementById('queryMonth').value || today.toISOString().slice(0, 7);
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
        const pin = document.getElementById('pin').value;
        if (!pin) return;
        
        if (btnElement) btnElement.disabled = true;
        const textSpan = document.getElementById('modalToggleSentText');
        if (textSpan) textSpan.innerText = '處理中...';
        
        try {
            const res = await fetch('/api/toggle_sent', {
                method: 'POST',
                body: JSON.stringify({ pin, month })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.list && data.list.includes(month)) {
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
        } finally {
            if (btnElement) btnElement.disabled = false;
        }
    }

    async function deleteMonth(month, btnElement) {
        if (!confirm('⚠️ 警告：確定要刪除[' + month + '] 的所有資料嗎？刪除後無法復原！')) return;
        const pin = document.getElementById('pin').value;
        if (!pin) return;
        
        if (btnElement) btnElement.disabled = true;
        
        try {
            const res = await fetch('/api/delete_month', {
                method: 'POST',
                body: JSON.stringify({ pin, month })
            });
            if (res.ok) { 
                knownMonths.delete(month);
                sentMonths.delete(month);
                renderMonthButtons();

                const currentViewMonth = document.getElementById('queryMonth').value;
                if (currentViewMonth === month) {
                    document.getElementById('recordsList').innerHTML = '<p class="text-center text-slate-400">已刪除</p>';
                    document.getElementById('calendarView').classList.add('hidden');
                    document.getElementById('totalSummary').classList.add('hidden');
                    document.getElementById('pdfBtn').classList.add('hidden');
                }
                alert('已刪除 ' + month + ' 的資料');
            } else { 
                throw new Error('刪除失敗'); 
            }
        } catch (err) { 
            alert(err.message); 
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
            badges.className = "grid grid-cols-4 md:grid-cols-6 gap-2 mb-4";
            badges.innerHTML = sortedMonths.map(m => {
                const isSent = sentMonths.has(m);
                const btnClass = isSent 
                    ? "month-btn sent w-full h-10 text-[10px] min-[375px]:text-xs font-bold rounded-xl transition focus:outline-none cursor-pointer"
                    : "month-btn w-full h-10 text-[10px] min-[375px]:text-xs font-bold rounded-xl transition focus:outline-none cursor-pointer";

                return '<div class="relative w-full">' +
                    '<button type="button" onclick="handleMonthClick(\\'' + m + '\\')" class="' + btnClass + '">' + m + '</button>' +
                    '</div>';
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

        const btnTypes = ['hourly', 'oncall', 'percall', 'transport'];
        btnTypes.forEach(t => {
            const btn = document.getElementById('btn-' + t);
            if (btn) {
                if (t === type) {
                    btn.className = "flex-1 py-2.5 px-2 rounded-xl text-sm font-bold text-white shadow-md border border-white/25 bg-white/15 backdrop-blur-md whitespace-nowrap transition";
                } else {
                    btn.className = "flex-1 py-2.5 px-2 rounded-xl text-sm font-bold text-white/55 hover:bg-white/10 hover:text-white border border-transparent whitespace-nowrap transition";
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
            const btnId = 'mul-' + v; 
            const btn = document.getElementById(btnId);
            if(btn) {
                if (v === val) {
                    btn.className = "flex-1 py-2.5 rounded-xl border border-indigo-400/60 bg-indigo-500/40 text-white text-sm font-bold shadow-[0_0_15px_rgba(99,102,241,0.3),inset_0_1px_1px_rgba(255,255,255,0.35)] transition";
                } else {
                    btn.className = "flex-1 py-2.5 rounded-xl border border-white/15 bg-white/5 text-white/60 text-sm font-bold hover:bg-white/10 hover:text-white transition";
                }
            }
        });
        updateDuration();
    }

    async function deleteRecord(id, date) {
        if(!confirm('確定要刪除這筆記錄嗎？')) return;
        const pin = document.getElementById('pin').value;
        try {
            const res = await fetch('/api/delete', {
                method: 'POST',
                body: JSON.stringify({ pin, id, date })
            });
            if(res.ok) { loadRecords(); } else { throw new Error('刪除失敗'); }
        } catch(err) { alert(err.message); }
    }

    async function fetchHistoryMonths() {
        const pin = document.getElementById('pin').value;
        if(!pin) return;
        managePinStorage();
        try {
            const res = await fetch('/api/list_months?pin=' + pin);
            const data = await res.json();
            if(!data.error) {
                knownMonths.clear();
                if (Array.isArray(data)) {
                    data.forEach(m => knownMonths.add(m));
                } else if (data.months) {
                    data.months.forEach(m => knownMonths.add(m));
                    sentMonths = new Set(data.sentList || []);
                }
                renderMonthButtons();
            }
        } catch(e) {
            console.error("載入月份失敗:", e);
        }
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
            document.getElementById('durationCalc').innerText = "時數: 0 小時";
        }
    }

    function switchTab(tab) {
        document.getElementById('view-record').classList.toggle('hidden', tab !== 'record');
        document.getElementById('view-export').classList.toggle('hidden', tab !== 'export');
        if (tab === 'export' && document.getElementById('pin').value) {
            fetchHistoryMonths();
        }
        
        const active = "flex-1 py-3 text-center font-bold text-indigo-300 border-b-2 border-indigo-400 bg-white/5 rounded-t-xl transition";
        const inactive = "flex-1 py-3 text-center text-white/55 hover:text-indigo-300 hover:bg-white/5 rounded-t-xl transition";
        document.getElementById('tab-record').className = tab === 'record' ? active : inactive;
        document.getElementById('tab-export').className = tab === 'export' ? active : inactive;
    }

    document.getElementById('addForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const pin = document.getElementById('pin').value;
        if (!pin) return alert('請先輸入 PIN 密碼');
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
        }
        const btn = document.getElementById('btn-submit-record');
        btn.disabled = true; btn.innerText = '儲存中...';
        managePinStorage();
        try {
            const payload = { 
                pin, 
                type, 
                date: document.getElementById('date').value,
                multiplier: document.getElementById('multiplier').value 
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
            const res = await fetch('/api/add', { method: 'POST', body: JSON.stringify(payload) });
            if (res.ok) {
                document.getElementById('msg').innerText = '✅ 儲存成功';
                document.getElementById('msg').className = 'mt-4 text-center text-sm font-bold text-emerald-300';
                document.getElementById('amount').value = '';
                document.getElementById('location').value = '';
                document.getElementById('moneyRemarks').value = '';
                document.getElementById('transportSelect').selectedIndex = 0; 
                setMultiplier(1);
                const currentMonth = payload.date.substring(0, 7);
                knownMonths.add(currentMonth);
                fetchHistoryMonths();
                renderHistoryChips('location', 'history-location', 'location');
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

    async function loadRecords(forcePublic = false) {
        const pin = document.getElementById('pin').value;
        const monthStr = document.getElementById('queryMonth').value; 
        
        if (!isShareMode && !pin) return alert('請先輸入 PIN 密碼');
        if (!isShareMode) managePinStorage();

        const listEl = document.getElementById('recordsList');
        const summaryEl = document.getElementById('totalSummary');
        
        listEl.innerHTML = '<p class="text-center text-slate-300/75">載入中...</p>';
        
        try {
            let url;
            if (isShareMode || forcePublic) {
                url = '/api/public/get?month=' + monthStr;
            } else {
                url = '/api/get?month=' + monthStr + '&pin=' + pin;
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
                listEl.innerHTML = '<p class="text-center text-slate-400">無記錄</p>';
                summaryEl.classList.add('hidden');
                document.getElementById('pdfBtn').classList.add('hidden');
            } else {
                let html = '<table class="w-full text-left text-slate-200"><thead><tr class="text-white/50 border-b border-white/15"><th>日期</th><th>項目/地點</th><th class="text-right">時間/詳情</th><th class="text-right">時數/金額</th><th class="text-right w-10 delete-ui">操作</th></tr></thead><tbody>';
                
                if (isShareMode) {
                    html = '<table class="w-full text-left text-slate-200"><thead><tr class="text-white/50 border-b border-white/15"><th>日期</th><th>項目/地點</th><th class="text-right">時間/詳情</th><th class="text-right">時數/金額</th></tr></thead><tbody>';
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
                        
                        typeLabel = '<span class="text-indigo-300 font-bold">' + (r.location || 'OT') + '</span>';
                        detail = r.start.replace(':', '') + ' - ' + r.end.replace(':', '');
                        const mulLabel = mul > 1 ? ' (x' + mul + ')' : '';
                        
                        value = '<span class="text-indigo-300 font-bold">' + formatHours(effectiveMins) + ' hr' + mulLabel + '</span>';
                    } else if (r.type === 'transport') {
                        grandTotalTransport += amount;
                        
                        typeLabel = '<span class="text-amber-300 font-bold">交通費</span>';
                        detail = r.location ? '<span class="text-white/70">' + r.location + '</span>' : '-';
                        
                        value = '<span class="text-amber-300 font-bold">$' + amount + '</span>';
                    } else if (r.type === 'oncall') {
                        grandTotalMoney += amount;
                        
                        typeLabel = '<span class="text-emerald-300 font-bold">當更</span>'; 
                        const startD = r.date.split('-')[2];
                        const endD = r.endDate ? r.endDate.split('-')[2] : '';
                        detail = startD + '日 - ' + endD + '日'; 
                        
                        value = '<span class="text-emerald-300 font-bold">$' + amount + '</span>';
                    } else { 
                        grandTotalMoney += amount;
                        
                        typeLabel = '<span class="text-emerald-300 font-bold">Call</span>';
                        detail = r.location ? '<span class="text-white/70">' + r.location + '</span>' : '-';
                        
                        value = '<span class="text-emerald-300 font-bold">$' + amount + '</span>';
                    }

                    const [yr, mo, dy] = r.date.split('-');
                    const formattedDate = yr + '年' + parseInt(mo) + '月' + parseInt(dy) + '日';

                    const deleteBtn = isShareMode ? '' : '<td class="py-2 text-right delete-ui"><button onclick="deleteRecord(' + r.id + ', \\'' + r.date + '\\')" class="text-red-300 hover:text-red-200 text-xs">🗑️</button></td>';

                    html += '<tr class="border-b border-white/10 last:border-0 hover:bg-white/10 transition">' +
                        '<td class="py-2 text-xs md:text-sm">' + formattedDate + '</td>' +
                        '<td class="py-2 text-xs md:text-sm">' + typeLabel + '</td>' +
                        '<td class="py-2 text-right text-xs md:text-sm font-mono text-white/70">' + detail + '</td>' +
                        '<td class="py-2 text-right text-xs md:text-sm font-bold">' + value + '</td>' +
                        deleteBtn +
                        '</tr>';
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
````

## File: src/ui/index.js
````js
import { htmlContent } from './html.js';
import { logicScript } from './logic.js';
import { pdfScript } from './pdf.js';

// 接收 userName 參數
export function getHtml(userName = '') {
    // 防止 undefined 或 null 變成字串 "undefined"
    const safeName = userName || '';
    
    return `
        ${htmlContent}
        <script>
            // === 關鍵：將後端的名字注入到前端變數 ===
            window.USER_NAME = "${safeName}";
            // ===================================
            
            ${logicScript}
            ${pdfScript}
        </script>
        </body>
        </html>
    `;
}

````

## File: src/index.js
````js
import { handleAdd, handleGet, handleListMonths, handleDelete, handleDeleteMonth, handlePublicGet, handleToggleSent, handleGetFont } from './api.js';
import { getHtml } from './ui/index.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/add' && request.method === 'POST') return handleAdd(request, env);
    if (url.pathname === '/api/delete' && request.method === 'POST') return handleDelete(request, env);
    if (url.pathname === '/api/delete_month' && request.method === 'POST') return handleDeleteMonth(request, env);
    if (url.pathname === '/api/toggle_sent' && request.method === 'POST') return handleToggleSent(request, env);
    if (url.pathname === '/api/get' && request.method === 'GET') return handleGet(request, env);
    if (url.pathname === '/api/public/get' && request.method === 'GET') return handlePublicGet(request, env);
    if (url.pathname === '/api/list_months' && request.method === 'GET') return handleListMonths(request, env);
    
    // === 註冊讀取字型的 API ===
    if (url.pathname === '/api/font' && request.method === 'GET') return handleGetFont(request, env);

    const userName = (env.USER_NAME && env.USER_NAME !== "REPLACE_ME_NAME") ? env.USER_NAME : "";
    
    return new Response(getHtml(userName), {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};

````

## File: README.md
````md
# OT 記錄器 Pro (OT Record Generator)

一個基於 Cloudflare Workers 與 KV 構建的輕量級加班、當更與交通費記錄工具。採用 **Liquid Glass（液態玻璃）** 視覺介面，支援自動生成 A4 PDF 報表、月曆視覺化顯示以及唯讀分享功能。

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)
![KV Storage](https://img.shields.io/badge/Database-Workers_KV-blue?style=flat-square)
![PDF Generation](https://img.shields.io/badge/PDF-pdf--lib-red?style=flat-square)

## ✨ 主要功能

*   **多種類型記錄**：
    *   🕒 **時數 OT**：記錄加班日期、地點（支援常用地點歷史標籤快速帶入）與時段，支援工數倍數（`x1`、`x1.5`、`x2`、`x3`）自動換算總時數。
    *   ⏱️ **半小時制時間輸入**：分鐘限定 `00` 與 `30`。電腦端支援鍵盤直接輸入與方向鍵調整（未輸入分鐘自動帶入 `00`）；手機端點擊時間欄位會彈出仿 iPhone 計時器的雙欄上下滑動滾輪（開啟時自動定位至目前小時）。
    *   📅 **當更 (On-Call)**：記錄當更日期範圍與津貼。
    *   📞 **Call**：記錄每次出勤津貼與備註。
    *   🚕 **交通費**：記錄實報實銷的交通費用（支援下拉選單：停車場、隧道、維修、其他）。
*   **視覺化月曆與報表**：
    *   以顏色區分不同類型的記錄（藍色 OT、綠色 當更/Call、橙色 交通）。
    *   支援**雙色/三色條紋**顯示，若同一天有多種類型記錄，月曆格子會自動顯示對應條紋。
    *   網頁列表與 PDF 統一採用「日期、項目/地點、時間/詳情、時數/金額」表頭與對應色彩標記，底部依序彙整「總當更/Call」、「總交通」、「總計 (含交通)」與「總時數」。
    *   支援月份「已提交 (`✓`)」狀態標記，方便追蹤申報進度。
*   **PDF 報表生成**：
    *   前端使用 `pdf-lib` 自動生成 A4 格式 PDF。
    *   支援**中文字型**（部署時自動自 GitHub 下載 `justfont/open-huninn-font` 粉圓體並寫入 KV，由 `/api/font` 提供）。
    *   自動計算總當更/Call、總交通、總計與總時數，檔名與抬頭自動帶入使用者名稱。
*   **安全性與分享**：
    *   **PIN 碼保護**：寫入與讀取資料需輸入密碼（支援「記住密碼」）。
    *   **分享連結**：可生成唯讀連結，供他人查看或下載單月報表，無需密碼（內建剪貼簿相容複製機制）。
*   **現代化介面與防誤觸管理**：
    *   採用 **Liquid Glass（液態玻璃）** 風格設計，搭配響應式寬度（手機端最佳化與電腦端加寬排版）。
    *   點擊管理模式（✏️）後點選月份會彈出 **Action Sheet 選單**（標記提交 / 刪除整月 / 取消），避免在手機上誤觸刪除。

## 🛠️ 技術架構

*   **Runtime**: Cloudflare Workers (Serverless)
*   **Database**: Cloudflare Workers KV (Key-Value Storage)
*   **Frontend**: Vanilla JS + Tailwind CSS (由 Worker 直接回傳 HTML)
*   **PDF Library**: `pdf-lib` + `fontkit`
*   **CI/CD**: GitHub Actions 手動觸發部署

## 🚀 部署教學

本專案設計為使用 **GitHub Actions** 進行部署，您無需在本地安裝複雜環境。

### 1. 前置準備
1.  擁有一個 Cloudflare 帳號。
2.  Fork 或 Clone 此儲存庫到您的 GitHub。

### 2. 設定 Cloudflare
1.  登入 Cloudflare Dashboard，進入 **Workers & Pages**。
2.  建立一個 **KV Namespace**：
    *   名稱隨意，例如 `OT_RECORDS`。
    *   建立後，複製該 Namespace 的 **ID**。
3.  獲取 **Account ID** (在 Workers 首頁右側)。
4.  建立 **API Token**：
    *   權限選擇「Edit Cloudflare Workers」。
    *   **重要**：確保該 Token 有權限編輯 KV Storage。

### 3. 設定 GitHub Secrets
進入您的 GitHub Repository -> **Settings** -> **Secrets and variables** -> **Actions**，新增以下 Repository secrets：

| Secret 名稱 | 說明 | 範例 |
| :--- | :--- | :--- |
| `CLOUDFLARE_API_TOKEN` | 您的 Cloudflare API Token | `xRw...` |
| `CLOUDFLARE_ACCOUNT_ID` | 您的 Cloudflare Account ID | `a1b2...` |
| `OT_KV_ID` | 步驟 2 建立的 KV Namespace ID | `4f8e...` |
| `AUTH_PIN` | 您想設定的登入密碼 (PIN) | `123456` |
| `USER_NAME` | 您的名字 (顯示在報表抬頭與 PDF 上) | `陳大文` |

### 4. 開始部署
*   `deploy.yml` 已設定為**手動觸發**（`workflow_dispatch`），推送程式碼至 `main` 不會自動部署 Worker。
*   請前往 GitHub Repository 上方的 **Actions** 分頁，選擇 **Deploy to Cloudflare Workers**，點擊右側 **Run workflow** 即可執行部署（部署時會一併下載最新粉圓體字型並上傳至 KV）。

## 📂 專案結構

```text
ot-generator/
├── .github/workflows/
│   ├── deploy.yml        # GitHub Actions 手動部署腳本 (上傳字型至 KV + 部署 Worker)
│   └── combine-code.yml  # 自動將專案程式碼彙整為 combined_project_code.md
├── src/
│   ├── index.js          # 程式入口與路由 (Router)
│   ├── api.js            # 後端邏輯 (CRUD KV 資料庫與字型讀取)
│   └── ui/               # 前端程式碼
│       ├── index.js      # UI 組裝與 USER_NAME 注入
│       ├── html.js       # HTML 結構、Liquid Glass 樣式與滾輪/Action Sheet 視窗
│       ├── logic.js      # 前端互動邏輯 (時間輸入/滾輪、月曆、管理彈窗、UI 控制)
│       └── pdf.js        # PDF 生成邏輯 (pdf-lib)
└── wrangler.toml         # Cloudflare 設定檔模板
```

## 📖 使用說明

1.  **登入**：開啟部署後的網址，輸入您在 Secrets 設定的 `AUTH_PIN`。
2.  **新增記錄**：
    *   選擇類型 (OT / 當更 / Call / 交通)。
    *   填寫日期、時間（僅限 `00` / `30` 分鐘）或金額與工數倍數。
    *   按下「儲存記錄」。
3.  **月結報表**：
    *   切換到「月結報表」分頁。
    *   系統會自動列出已有記錄的月份，點擊月份按鈕即可載入。
    *   點擊「下載 PDF 報表」即可匯出檔案。
4.  **管理與刪除資料**：
    *   點擊查詢列右側的 `✏️` 按鈕進入管理模式（按鈕會變為紅色的「完成」）。
    *   **單筆刪除**：點擊下方記錄列表右側的垃圾桶圖示 🗑️。
    *   **月份提交狀態與整月刪除**：於管理模式下直接點擊上方任一月份按鈕，透過底部彈出的選單選擇「標記為已提交 / 取消提交狀態」或「刪除整月資料」。
5.  **分享**：
    *   在月結報表頁面點擊 🔗 按鈕，複製連結給他人。該連結不需要 PIN 碼即可查看或下載該月報表。

## 📝 注意事項

*   **資料延遲**：Cloudflare KV 具有「最終一致性」特性，刪除或新增資料後，列表更新可能會有數秒鐘的延遲，這是正常現象。
*   **中文字型**：PDF 生成使用部署時自動從 GitHub (`justfont/open-huninn-font`) 下載並轉存至 Workers KV (`SYSTEM_FONT_B64`) 的粉圓體字型，首次生成 PDF 時瀏覽器會向 `/api/font` 載入並快取字型檔，請稍候片刻。

---
Created with ❤️ by Cloudflare Workers

````

## File: .github/workflows/combine-code.yml
````yml
name: Generate All Codebase to MD

on:
  push:
    branches:
      - main
    paths-ignore:
      - 'combined_project_code.md' # 避免此檔案自身更新引發無限循環
  workflow_dispatch: # 支援在 GitHub 網頁上手動觸發執行

permissions:
  contents: write

jobs:
  build:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Combine All Files into MD
        run: |
          OUT_FILE="combined_project_code.md"
          echo "# Complete Project Codebase" > "$OUT_FILE"
          echo "Generated on: $(date)" >> "$OUT_FILE"
          echo "" >> "$OUT_FILE"

          # 遍歷專案內的所有檔案，排除依賴、Git 歷史、打包產物及二進位檔案
          find . -type f \
            -not -path "*/node_modules/*" \
            -not -path "*/.git/*" \
            -not -path "*/dist/*" \
            -not -name "package-lock.json" \
            -not -name "yarn.lock" \
            -not -name "pnpm-lock.yaml" \
            -not -name "$OUT_FILE" \
            -not -name "*.png" \
            -not -name "*.jpg" \
            -not -name "*.jpeg" \
            -not -name "*.gif" \
            -not -name "*.ico" \
            -not -name "*.woff*" \
            -not -name "*.ttf" | while read -r file; do
              
              # 取得相對路徑與副檔名
              rel_path="${file#./}"
              ext="${file##*.}"
              
              # 如果無副檔名，清除變數避免格式混亂
              if [ "$ext" = "$rel_path" ]; then
                ext=""
              fi
              
              # 寫入檔案標題
              echo "## File: $rel_path" >> "$OUT_FILE"
              # 使用四個反單引號（````）包裹，防止內部程式碼的三個反單引號造成排版衝突
              echo "\`\`\`\`$ext" >> "$OUT_FILE"
              cat "$file" >> "$OUT_FILE"
              echo "" >> "$OUT_FILE"
              echo "\`\`\`\`" >> "$OUT_FILE"
              echo "" >> "$OUT_FILE"
          done

      - name: Commit and Push changes
        run: |
          git config --local user.email "github-actions[bot]@users.noreply.github.com"
          git config --local user.name "github-actions[bot]"
          git add combined_project_code.md
          
          if git diff --staged --quiet; then
            echo "No changes in codebase."
          else
            git commit -m "docs: auto-generate complete codebase [skip ci]"
            git push origin main
          fi

````

## File: .github/workflows/deploy.yml
````yml
name: Deploy to Cloudflare Workers

on:
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Inject KV ID
        run: |
          sed -i 's/REPLACE_ME_KV_ID/${{ secrets.OT_KV_ID }}/g' wrangler.toml

      - name: Inject User Name
        run: |
          sed -i "s/REPLACE_ME_NAME/${{ secrets.USER_NAME }}/g" wrangler.toml

      # === 1. 下載並轉換為純文字 ===
      - name: Download and Convert Font
        run: |
          echo "正在查詢最新版本的字型..."
          TTF_URL=$(curl -s -H "Authorization: token ${{ secrets.GITHUB_TOKEN }}" https://api.github.com/repos/justfont/open-huninn-font/releases/latest | jq -r '.assets[] | select(.name | endswith(".ttf")) | .browser_download_url' | head -n 1)
          
          if [ -z "$TTF_URL" ] || [ "$TTF_URL" == "null" ]; then
            echo "錯誤：在最新版本中找不到 .ttf 檔案！"
            exit 1
          fi
          
          echo "找到最新字型檔案：$TTF_URL"
          curl -L -o font.ttf "$TTF_URL"
          
          echo "正在轉換為 Base64 純文字以防止資料損壞..."
          base64 -w 0 font.ttf > font_b64.txt

      # === 2. 上傳至 KV (修正為 v4 語法：kv key put) ===
      - name: Upload Font to KV
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: kv key put --namespace-id=${{ secrets.OT_KV_ID }} "SYSTEM_FONT_B64" --path font_b64.txt

      # === 3. 部署 Worker ===
      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          secrets: |
            AUTH_PIN
        env:
          AUTH_PIN: ${{ secrets.AUTH_PIN }}

````

## File: wrangler.toml
````toml
name = "ot-generator"
main = "src/index.js"
compatibility_date = "2023-12-01"

# KV 設定
[[kv_namespaces]]
binding = "OT_RECORDS"
id = "REPLACE_ME_KV_ID"  # <--- 這裡維持佔位符

# === 修改重點：加入 vars 區塊 ===
[vars]
USER_NAME = "REPLACE_ME_NAME"  # <--- 這裡放名字佔位符

````

