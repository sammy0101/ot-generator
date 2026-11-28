# Complete Project Codebase
Generated on: Sat Nov 28 09:21:24 UTC 2026

## File: src/api.js
````js
import {
    getAuthSecret,
    timingSafeVerifyPassword,
    createSessionToken,
    buildSessionCookie,
    buildClearSessionCookie,
    authenticateRequest,
    isSameOriginPost,
} from './auth.js';

const ALLOWED_TYPES = new Set(['hourly', 'oncall', 'percall', 'transport']);

function jsonResponse(data, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=UTF-8',
            ...extraHeaders,
        },
    });
}

function isValidDateStr(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
    const [y, m, d] = str.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function isValidMonthStr(str) {
    if (typeof str !== 'string' || !/^\d{4}-\d{2}$/.test(str)) return false;
    const m = Number(str.slice(5, 7));
    return m >= 1 && m <= 12;
}

function isValidTimeStr(str) {
    return typeof str === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(str);
}

function sortRecords(records) {
    return records.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.start || '').localeCompare(b.start || '');
    });
}

function validateAndBuildRecord(data, existingId = null) {
    const type = data.type || 'hourly';
    if (!ALLOWED_TYPES.has(type)) {
        return { error: '無效的記錄類型' };
    }
    if (!isValidDateStr(data.date)) {
        return { error: '無效的日期格式 (應為 YYYY-MM-DD)' };
    }

    const location = typeof data.location === 'string' ? data.location.trim().slice(0, 100) : '';

    if (type === 'hourly') {
        if (!isValidTimeStr(data.start) || !isValidTimeStr(data.end)) {
            return { error: '無效的時間格式 (應為 HH:MM)' };
        }
        const multiplier = data.multiplier !== undefined && data.multiplier !== '' ? Number(data.multiplier) : 1;
        if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 10) {
            return { error: '無效的工數倍數' };
        }
        return {
            record: {
                id: existingId || crypto.randomUUID(),
                type,
                date: data.date,
                location,
                start: data.start,
                end: data.end,
                multiplier,
                amount: 0,
                timestamp: new Date().toISOString(),
            },
        };
    }

    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount < 0) {
        return { error: '無效的金額數值' };
    }

    let endDate = '';
    if (type === 'oncall') {
        if (!isValidDateStr(data.endDate)) {
            return { error: '無效的結束日期格式' };
        }
        if (data.endDate < data.date) {
            return { error: '結束日期不可早於開始日期' };
        }
        endDate = data.endDate;
    }

    return {
        record: {
            id: existingId || crypto.randomUUID(),
            type,
            date: data.date,
            endDate: type === 'oncall' ? endDate : undefined,
            location: type === 'oncall' ? '' : location,
            multiplier: 1,
            amount: Math.round(amount),
            timestamp: new Date().toISOString(),
        },
    };
}

async function requireAuth(request, env) {
    if (request.method === 'POST' && !isSameOriginPost(request)) {
        return { ok: false, response: jsonResponse({ error: '跨來源請求已被拒絕' }, 403) };
    }
    const auth = await authenticateRequest(request, env);
    if (!auth.authenticated) {
        return { ok: false, response: jsonResponse({ error: '請先登入' }, 401) };
    }
    return {
        ok: true,
        cookieHeaders: auth.refreshCookie ? { 'Set-Cookie': auth.refreshCookie } : {},
    };
}

export async function handleLogin(request, env) {
    if (!isSameOriginPost(request)) {
        return jsonResponse({ error: '跨來源請求已被拒絕' }, 403);
    }
    const secret = getAuthSecret(env);
    if (!secret) {
        return jsonResponse({ error: '伺服器尚未設定登入密碼' }, 500);
    }

    try {
        const data = await request.json();
        const password = typeof data.password === 'string' ? data.password : '';
        const remember = Boolean(data.remember);

        const isValid = await timingSafeVerifyPassword(password, secret);
        if (!isValid) {
            await new Promise((resolve) => setTimeout(resolve, 300));
            return jsonResponse({ error: '密碼錯誤' }, 401);
        }

        const token = await createSessionToken(secret, remember);
        const cookie = buildSessionCookie(request, token, remember);
        return jsonResponse(
            { success: true },
            200,
            { 'Set-Cookie': cookie }
        );
    } catch {
        return jsonResponse({ error: '無效的請求格式' }, 400);
    }
}

export async function handleLogout(request) {
    if (!isSameOriginPost(request)) {
        return jsonResponse({ error: '跨來源請求已被拒絕' }, 403);
    }
    return jsonResponse(
        { success: true },
        200,
        { 'Set-Cookie': buildClearSessionCookie(request) }
    );
}

export async function handleAdd(request, env) {
    const auth = await requireAuth(request, env);
    if (!auth.ok) return auth.response;

    try {
        const data = await request.json();
        const validated = validateAndBuildRecord(data);
        if (validated.error) {
            return jsonResponse({ error: validated.error }, 400, auth.cookieHeaders);
        }

        const month = validated.record.date.substring(0, 7);
        const monthKey = `OT_${month}`;
        const records = (await env.OT_RECORDS.get(monthKey, { type: 'json' })) || [];
        records.push(validated.record);
        sortRecords(records);

        await env.OT_RECORDS.put(monthKey, JSON.stringify(records));
        return jsonResponse({ success: true, month, records }, 200, auth.cookieHeaders);
    } catch (e) {
        return jsonResponse({ error: e.message }, 500, auth.cookieHeaders);
    }
}

export async function handleUpdate(request, env) {
    const auth = await requireAuth(request, env);
    if (!auth.ok) return auth.response;

    try {
        const data = await request.json();
        if (data.id === undefined || data.id === null || data.id === '') {
            return jsonResponse({ error: '缺少記錄 ID' }, 400, auth.cookieHeaders);
        }
        const originalDate = isValidDateStr(data.originalDate) ? data.originalDate : data.date;
        if (!isValidDateStr(originalDate)) {
            return jsonResponse({ error: '無效的原始日期' }, 400, auth.cookieHeaders);
        }

        const validated = validateAndBuildRecord(data, data.id);
        if (validated.error) {
            return jsonResponse({ error: validated.error }, 400, auth.cookieHeaders);
        }

        const origMonth = originalDate.substring(0, 7);
        const newMonth = validated.record.date.substring(0, 7);
        const origKey = `OT_${origMonth}`;
        const newKey = `OT_${newMonth}`;

        const origRecords = (await env.OT_RECORDS.get(origKey, { type: 'json' })) || [];
        const targetIdx = origRecords.findIndex((r) => String(r.id) === String(data.id));
        if (targetIdx === -1) {
            return jsonResponse({ error: '找不到該筆記錄' }, 404, auth.cookieHeaders);
        }

        if (origKey === newKey) {
            origRecords[targetIdx] = validated.record;
            sortRecords(origRecords);
            await env.OT_RECORDS.put(origKey, JSON.stringify(origRecords));
            return jsonResponse(
                { success: true, month: newMonth, movedFrom: null, records: origRecords },
                200,
                auth.cookieHeaders
            );
        }

        const updatedOrig = origRecords.filter((r) => String(r.id) !== String(data.id));
        const destRecords = (await env.OT_RECORDS.get(newKey, { type: 'json' })) || [];
        destRecords.push(validated.record);
        sortRecords(destRecords);

        await Promise.all([
            updatedOrig.length > 0
                ? env.OT_RECORDS.put(origKey, JSON.stringify(updatedOrig))
                : env.OT_RECORDS.delete(origKey),
            env.OT_RECORDS.put(newKey, JSON.stringify(destRecords)),
        ]);

        return jsonResponse(
            { success: true, month: newMonth, movedFrom: origMonth, records: destRecords },
            200,
            auth.cookieHeaders
        );
    } catch (e) {
        return jsonResponse({ error: e.message }, 500, auth.cookieHeaders);
    }
}

export async function handleDelete(request, env) {
    const auth = await requireAuth(request, env);
    if (!auth.ok) return auth.response;

    try {
        const data = await request.json();
        if (data.id === undefined || data.id === null || data.id === '' || !isValidDateStr(data.date)) {
            return jsonResponse({ error: '無效的刪除參數' }, 400, auth.cookieHeaders);
        }

        const month = data.date.substring(0, 7);
        const monthKey = `OT_${month}`;
        const records = await env.OT_RECORDS.get(monthKey, { type: 'json' });
        if (!records) {
            return jsonResponse({ success: false, error: '找不到資料' }, 404, auth.cookieHeaders);
        }

        const newRecords = records.filter((r) => String(r.id) !== String(data.id));
        if (newRecords.length === records.length) {
            return jsonResponse({ success: false, error: '找不到該筆記錄' }, 404, auth.cookieHeaders);
        }

        if (newRecords.length === 0) {
            await env.OT_RECORDS.delete(monthKey);
        } else {
            await env.OT_RECORDS.put(monthKey, JSON.stringify(newRecords));
        }

        return jsonResponse({ success: true, month, records: newRecords }, 200, auth.cookieHeaders);
    } catch (e) {
        return jsonResponse({ error: e.message }, 500, auth.cookieHeaders);
    }
}

export async function handleDeleteMonth(request, env) {
    const auth = await requireAuth(request, env);
    if (!auth.ok) return auth.response;

    try {
        const data = await request.json();
        if (!isValidMonthStr(data.month)) {
            return jsonResponse({ error: '無效的月份格式' }, 400, auth.cookieHeaders);
        }

        const monthKey = `OT_${data.month}`;
        await env.OT_RECORDS.delete(monthKey);

        let sentList = (await env.OT_RECORDS.get('OT_META_SENT', { type: 'json' })) || [];
        if (sentList.includes(data.month)) {
            sentList = sentList.filter((m) => m !== data.month);
            await env.OT_RECORDS.put('OT_META_SENT', JSON.stringify(sentList));
        }

        return jsonResponse({ success: true }, 200, auth.cookieHeaders);
    } catch (e) {
        return jsonResponse({ error: e.message }, 500, auth.cookieHeaders);
    }
}

export async function handleToggleSent(request, env) {
    const auth = await requireAuth(request, env);
    if (!auth.ok) return auth.response;

    try {
        const data = await request.json();
        if (!isValidMonthStr(data.month)) {
            return jsonResponse({ error: '無效的月份格式' }, 400, auth.cookieHeaders);
        }

        let sentList = (await env.OT_RECORDS.get('OT_META_SENT', { type: 'json' })) || [];
        if (sentList.includes(data.month)) {
            sentList = sentList.filter((m) => m !== data.month);
        } else {
            sentList.push(data.month);
        }

        await env.OT_RECORDS.put('OT_META_SENT', JSON.stringify(sentList));
        return jsonResponse({ success: true, list: sentList }, 200, auth.cookieHeaders);
    } catch (e) {
        return jsonResponse({ error: e.message }, 500, auth.cookieHeaders);
    }
}

export async function handleGet(request, env) {
    const auth = await requireAuth(request, env);
    if (!auth.ok) return auth.response;

    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    if (!isValidMonthStr(month)) {
        return jsonResponse({ error: '無效的月份格式' }, 400, auth.cookieHeaders);
    }

    const key = `OT_${month}`;
    const records = (await env.OT_RECORDS.get(key, { type: 'json' })) || [];
    return jsonResponse(records, 200, auth.cookieHeaders);
}

export async function handlePublicGet(request, env) {
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    if (!isValidMonthStr(month)) {
        return jsonResponse({ error: '無效的月份格式' }, 400);
    }
    const key = `OT_${month}`;
    const records = (await env.OT_RECORDS.get(key, { type: 'json' })) || [];
    return jsonResponse(records, 200);
}

export async function handleListMonths(request, env) {
    const auth = await requireAuth(request, env);
    if (!auth.ok) return auth.response;

    const list = await env.OT_RECORDS.list({ prefix: 'OT_' });
    const months = list.keys
        .map((k) => k.name.replace('OT_', ''))
        .filter((m) => /^\d{4}-\d{2}$/.test(m));

    months.sort().reverse();
    const sentList = (await env.OT_RECORDS.get('OT_META_SENT', { type: 'json' })) || [];

    return jsonResponse({ months, sentList }, 200, auth.cookieHeaders);
}

// === 從 KV 讀取 Base64 純文字字型 (供已登入與唯讀分享 PDF 下載共用) ===
export async function handleGetFont(request, env) {
    try {
        const b64 = await env.OT_RECORDS.get('SYSTEM_FONT_B64');
        if (!b64) return new Response('Font not found in KV', { status: 404 });

        return new Response(b64, {
            headers: {
                'Content-Type': 'text/plain',
                'Cache-Control': 'public, max-age=31536000, immutable',
                'Access-Control-Allow-Origin': '*',
            },
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}

````

## File: src/ui/pdf.js
````js
export const pdfScript = `
    function fitPdfText(text, font, size, maxWidth) {
        const raw = String(text === undefined || text === null ? '' : text);
        if (!raw) return '';
        if (font.widthOfTextAtSize(raw, size) <= maxWidth) return raw;
        const ellipsis = '...';
        const ellipsisWidth = font.widthOfTextAtSize(ellipsis, size);
        let result = '';
        for (let i = 0; i < raw.length; i++) {
            const next = result + raw[i];
            if (font.widthOfTextAtSize(next, size) + ellipsisWidth > maxWidth) {
                break;
            }
            result = next;
        }
        return result + ellipsis;
    }

    async function loadCachedFontBytes() {
        if (window.__CACHED_FONT_BYTES) return window.__CACHED_FONT_BYTES;

        const fontUrl = '/api/font';
        let b64String = '';

        if (window.caches) {
            try {
                const cache = await caches.open('ot-font-cache-v1');
                let cachedRes = await cache.match(fontUrl);
                if (!cachedRes) {
                    const netRes = await fetch(fontUrl);
                    if (!netRes.ok) {
                        const errText = await netRes.text();
                        throw new Error('字型載入失敗: ' + errText);
                    }
                    await cache.put(fontUrl, netRes.clone());
                    cachedRes = netRes;
                }
                b64String = await cachedRes.text();
            } catch (cacheErr) {
                const fallbackRes = await fetch(fontUrl);
                if (!fallbackRes.ok) throw new Error('字型載入失敗');
                b64String = await fallbackRes.text();
            }
        } else {
            const fontRes = await fetch(fontUrl);
            if (!fontRes.ok) {
                const errText = await fontRes.text();
                throw new Error('字型載入失敗: ' + errText);
            }
            b64String = await fontRes.text();
        }

        if (b64String.includes('<!DOC') || b64String.includes('<html')) {
            if (window.caches) {
                try {
                    const cache = await caches.open('ot-font-cache-v1');
                    await cache.delete(fontUrl);
                } catch (e) {}
            }
            throw new Error('下載到無效的字型檔案，請確認 GitHub Actions 是否部署成功。');
        }

        const binaryString = window.atob(b64String);
        const len = binaryString.length;
        const fontBytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            fontBytes[i] = binaryString.charCodeAt(i);
        }
        window.__CACHED_FONT_BYTES = fontBytes;
        return fontBytes;
    }

    async function generatePDF() {
        if (currentRecords.length === 0) return;
        const btn = document.getElementById('pdfBtn');
        const originalText = btn.innerText;

        btn.innerText = '載入字型與生成中... (請稍候)';
        btn.disabled = true;

        try {
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            const pdfDoc = await PDFDocument.create();
            pdfDoc.registerFontkit(fontkit);

            const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const fontBytes = await loadCachedFontBytes();
            const chineseFont = await pdfDoc.embedFont(fontBytes);

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
            const drawTxt = (text, x, font, color = colorBlack) =>
                page.drawText(text, { x, y: yPos, size: fontSize, font, color });

            const drawTableHeader = () => {
                drawTxt('日期', col.d, chineseFont, rgb(0.5, 0.5, 0.5));
                drawTxt('項目/地點', col.item, chineseFont, rgb(0.5, 0.5, 0.5));
                drawTxt('時間/詳情', col.detail, chineseFont, rgb(0.5, 0.5, 0.5));
                drawTxt('時數/金額', col.val, chineseFont, rgb(0.5, 0.5, 0.5));
                page.drawLine({ start: { x: marginX, y: yPos - 5 }, end: { x: width - marginX, y: yPos - 5 }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
                yPos -= 25;
            };

            drawTableHeader();

            for (const r of currentRecords) {
                const amount = Number(r.amount) || 0;
                if (r.type !== 'hourly' && amount === 0) continue;

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
                const safeItem = fitPdfText(itemStr, chineseFont, fontSize, col.detail - col.item - 12);
                const safeDetail = fitPdfText(detailStr, detailFont, fontSize, col.val - col.detail - 12);
                drawTxt(safeItem, col.item, chineseFont, rowColor);
                drawTxt(safeDetail, col.detail, detailFont);
                drawTxt(valStr, col.val, helveticaBold, rowColor);

                page.drawLine({ start: { x: marginX, y: yPos - 8 }, end: { x: width - marginX, y: yPos - 8 }, thickness: 0.5, color: rgb(0.9, 0.9, 0.9) });
                yPos -= 25;
            }

            if (yPos < 150) {
                page = pdfDoc.addPage([595.28, 841.89]);
                yPos = height - 60;
            }

            yPos -= 10;
            page.drawLine({ start: { x: marginX, y: yPos }, end: { x: width - marginX, y: yPos }, thickness: 1 });
            yPos -= 25;

            drawTxt('總當更/Call: ', 350, chineseFont);
            drawTxt('$' + grandTotalMoney, 440, helveticaBold, colorGreen);
            yPos -= 20;

            drawTxt('總交通: ', 350, chineseFont);
            drawTxt('$' + grandTotalTransport, 440, helveticaBold, colorOrange);
            yPos -= 15;

            page.drawLine({ start: { x: 350, y: yPos }, end: { x: width - marginX, y: yPos }, thickness: 0.5, color: rgb(0.7, 0.7, 0.7) });
            yPos -= 20;

            drawTxt('總計 (含交通): ', 350, chineseFont);
            const totalAll = grandTotalMoney + grandTotalTransport;
            drawTxt('$' + totalAll, 440, helveticaBold, colorBlack);
            yPos -= 20;

            drawTxt('總時數: ', 350, chineseFont);
            drawTxt(formatHours(grandTotalMinutes) + ' hr', 440, helveticaBold, colorBlue);

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
        } catch (err) {
            console.error(err);
            alert('生成失敗: ' + err.message);
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

````

## File: src/ui/logic.js
````js
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

````

## File: src/ui/index.js
````js
import { htmlContent } from './html.js';
import { logicScript } from './logic.js';
import { pdfScript } from './pdf.js';

function escapeHtmlAttr(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

export function getHtml(options = {}) {
    const userName = options.userName || '';
    const isAuthenticated = Boolean(options.isAuthenticated);
    const shareMonth = options.shareMonth || '';
    const origin = options.origin || '';

    const safeNameJson = JSON.stringify(userName).replace(/</g, '\\u003c');
    const authBool = isAuthenticated ? 'true' : 'false';

    let titleText = userName ? `OT 記錄器 Pro - ${userName}` : 'OT 記錄器 Pro';
    let ogTitle = titleText;
    let ogDesc = '加班、當更與交通費月結記錄工具';
    let ogUrl = origin ? `${origin}/` : '/';

    if (shareMonth) {
        const [yr, mo] = shareMonth.split('-');
        const monthDisplay = `${yr}年${parseInt(mo, 10)}月`;
        titleText = `${monthDisplay} OT 記錄報表${userName ? ' - ' + userName : ''}`;
        ogTitle = `${monthDisplay} OT 記錄報表${userName ? ' (' + userName + ')' : ''}`;
        ogDesc = `點擊查看 ${shareMonth} OT / 當更 / 交通月結明細與匯出 PDF`;
        ogUrl = `${origin}/?view=share&month=${shareMonth}`;
    }

    // 128x128 小於 WhatsApp 300px 大圖門檻，會顯示為文字旁的小縮圖
    const iconUrl = 'https://cdn-icons-png.flaticon.com/128/2535/2535556.png';

    const metaTags = `
    <title>${escapeHtmlAttr(titleText)}</title>
    <meta name="description" content="${escapeHtmlAttr(ogDesc)}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${escapeHtmlAttr(ogUrl)}">
    <meta property="og:title" content="${escapeHtmlAttr(ogTitle)}">
    <meta property="og:description" content="${escapeHtmlAttr(ogDesc)}">
    <meta property="og:image" content="${iconUrl}">
    <meta property="og:image:width" content="128">
    <meta property="og:image:height" content="128">
    <meta name="twitter:card" content="summary">
    <link rel="apple-touch-icon" href="${iconUrl}">`;

    const scripts = `
        <script>
            window.USER_NAME = ${safeNameJson};
            window.INITIAL_AUTH = ${authBool};
            ${logicScript}
            ${pdfScript}
        </script>
    `;

    return htmlContent
        .replace('<!--APP_META-->', () => metaTags)
        .replace('<!--APP_SCRIPTS-->', () => scripts);
}

````

## File: src/index.js
````js
import {
    handleLogin,
    handleLogout,
    handleAdd,
    handleUpdate,
    handleGet,
    handleListMonths,
    handleDelete,
    handleDeleteMonth,
    handlePublicGet,
    handleToggleSent,
    handleGetFont,
} from './api.js';
import { authenticateRequest } from './auth.js';
import { getHtml } from './ui/index.js';

export default {
    async fetch(request, env) {
        const url = new URL(request.url);

        if (url.pathname === '/api/login' && request.method === 'POST') return handleLogin(request, env);
        if (url.pathname === '/api/logout' && request.method === 'POST') return handleLogout(request);
        if (url.pathname === '/api/add' && request.method === 'POST') return handleAdd(request, env);
        if (url.pathname === '/api/update' && request.method === 'POST') return handleUpdate(request, env);
        if (url.pathname === '/api/delete' && request.method === 'POST') return handleDelete(request, env);
        if (url.pathname === '/api/delete_month' && request.method === 'POST') return handleDeleteMonth(request, env);
        if (url.pathname === '/api/toggle_sent' && request.method === 'POST') return handleToggleSent(request, env);
        if (url.pathname === '/api/get' && request.method === 'GET') return handleGet(request, env);
        if (url.pathname === '/api/public/get' && request.method === 'GET') return handlePublicGet(request, env);
        if (url.pathname === '/api/list_months' && request.method === 'GET') return handleListMonths(request, env);
        if (url.pathname === '/api/font' && request.method === 'GET') return handleGetFont(request, env);

        const userName = env.USER_NAME && env.USER_NAME !== 'REPLACE_ME_NAME' ? env.USER_NAME : '';
        const isShareMode = url.searchParams.get('view') === 'share';
        const rawMonth = url.searchParams.get('month') || '';
        const shareMonth = isShareMode && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : '';

        let initialAuth = false;
        const headers = { 'content-type': 'text/html;charset=UTF-8' };

        if (!isShareMode) {
            const auth = await authenticateRequest(request, env);
            initialAuth = auth.authenticated;
            if (auth.refreshCookie) {
                headers['Set-Cookie'] = auth.refreshCookie;
            }
        }

        return new Response(
            getHtml({
                userName,
                isAuthenticated: initialAuth,
                shareMonth,
                origin: url.origin,
            }),
            { headers }
        );
    },
};

````

## File: src/auth.js
````js
const COOKIE_NAME = 'ot_session';
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 天

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
    }
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(str) {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4);
    const bin = atob(padded);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
    }
    return bytes;
}

export function getAuthSecret(env) {
    return env.AUTH_PASSWORD || env.AUTH_PIN || '';
}

export async function timingSafeVerifyPassword(input, expected) {
    if (typeof input !== 'string' || typeof expected !== 'string' || !expected) {
        return false;
    }
    const [h1, h2] = await Promise.all([
        crypto.subtle.digest('SHA-256', encoder.encode(input)),
        crypto.subtle.digest('SHA-256', encoder.encode(expected)),
    ]);
    const a = new Uint8Array(h1);
    const b = new Uint8Array(h2);
    let diff = 0;
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i];
    }
    return diff === 0;
}

async function getHmacKey(secret) {
    const keyMaterial = await crypto.subtle.digest('SHA-256', encoder.encode(`ot-session-v1:${secret}`));
    return crypto.subtle.importKey(
        'raw',
        keyMaterial,
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign', 'verify']
    );
}

export async function createSessionToken(secret, remember) {
    const now = Date.now();
    const payload = {
        iat: now,
        exp: now + SESSION_TTL_SECONDS * 1000,
        rem: Boolean(remember),
    };
    const payloadB64 = toBase64Url(encoder.encode(JSON.stringify(payload)));
    const key = await getHmacKey(secret);
    const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
    const sigB64 = toBase64Url(new Uint8Array(sigBuffer));
    return `${payloadB64}.${sigB64}`;
}

export async function verifySessionToken(token, secret) {
    if (!token || !secret || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, sigB64] = parts;
    if (!payloadB64 || !sigB64) return null;

    try {
        const key = await getHmacKey(secret);
        const sigBytes = fromBase64Url(sigB64);
        const valid = await crypto.subtle.verify('HMAC', key, sigBytes, encoder.encode(payloadB64));
        if (!valid) return null;

        const payload = JSON.parse(decoder.decode(fromBase64Url(payloadB64)));
        if (!payload || typeof payload.exp !== 'number' || Date.now() >= payload.exp) {
            return null;
        }
        return {
            iat: payload.iat,
            exp: payload.exp,
            rem: Boolean(payload.rem),
        };
    } catch {
        return null;
    }
}

export function getCookieValue(request, name = COOKIE_NAME) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;
    const pairs = cookieHeader.split(';');
    for (const pair of pairs) {
        const idx = pair.indexOf('=');
        if (idx === -1) continue;
        const k = pair.slice(0, idx).trim();
        if (k === name) {
            return decodeURIComponent(pair.slice(idx + 1).trim());
        }
    }
    return null;
}

export function buildSessionCookie(request, token, remember) {
    const isHttps = new URL(request.url).protocol === 'https:';
    const attrs = [
        `${COOKIE_NAME}=${encodeURIComponent(token)}`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
    ];
    if (isHttps) attrs.push('Secure');
    if (remember) attrs.push(`Max-Age=${SESSION_TTL_SECONDS}`);
    return attrs.join('; ');
}

export function buildClearSessionCookie(request) {
    const isHttps = new URL(request.url).protocol === 'https:';
    const attrs = [
        `${COOKIE_NAME}=`,
        'Path=/',
        'HttpOnly',
        'SameSite=Lax',
        'Max-Age=0',
    ];
    if (isHttps) attrs.push('Secure');
    return attrs.join('; ');
}

export function isSameOriginPost(request) {
    const origin = request.headers.get('Origin');
    if (!origin) return true;
    const expectedOrigin = new URL(request.url).origin;
    return origin === expectedOrigin;
}

export async function authenticateRequest(request, env) {
    const secret = getAuthSecret(env);
    if (!secret) return { authenticated: false, session: null, refreshCookie: null };

    const token = getCookieValue(request, COOKIE_NAME);
    const session = await verifySessionToken(token, secret);
    if (!session) return { authenticated: false, session: null, refreshCookie: null };

    let refreshCookie = null;
    if (session.rem) {
        const refreshedToken = await createSessionToken(secret, true);
        refreshCookie = buildSessionCookie(request, refreshedToken, true);
    }

    return { authenticated: true, session, refreshCookie };
}

````

## File: README.md
````md
# OT 記錄器 Pro (OT Record Generator)

一個基於 Cloudflare Workers 與 KV 構建的輕量級加班、當更與交通費記錄工具。採用 **Liquid Glass（液態玻璃）** 視覺介面，支援自動生成 A4 PDF 報表、月曆視覺化顯示以及唯讀分享功能。

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-orange?style=flat-square&logo=cloudflare)
![KV Storage](https://img.shields.io/badge/Database-Workers_KV-blue?style=flat-square)
![PDF Generation](https://img.shields.io/badge/PDF-pdf--lib-red?style=flat-square)

## ✨ 主要功能

*   **密碼登入與 30 天滑動續期**：
    *   登入後即可使用完整新增、查詢、編輯與刪除功能，不需重複在介面輸入 PIN 碼。
    *   採用 `HttpOnly` + HMAC-SHA256 簽章 Session Cookie；勾選「保持登入」時每次造訪或操作都會自動刷新 30 天有效期，僅於連續 30 天未登入時才需重新輸入密碼。
*   **多種類型記錄與單筆編輯**：
    *   🕒 **時數 OT**：記錄加班日期、地點（支援常用地點歷史標籤快速帶入）與時段，支援工數倍數（`x1`、`x1.5`、`x2`、`x3`）自動換算總時數。
    *   ⏱️ **半小時制時間輸入**：分鐘限定 `00` 與 `30`。電腦端支援鍵盤直接輸入與方向鍵調整；手機端點擊時間欄位會彈出雙欄上下滑動滾輪。
    *   📅 **當更 (On-Call)**、📞 **Call**、🚕 **交通費**。
    *   ✏️ **單筆編輯**：於管理模式下可直接修改既有記錄的日期（含跨月移動）、時間、地點、倍數或金額，並即時同步畫面。
*   **視覺化月曆與 PDF 報表**：
    *   以顏色與多色條紋區分不同記錄，並修正跨時區與跨月當更計算。
    *   前端使用 `pdf-lib` 生成 A4 PDF，支援 Cache API 本地持久快取字型與欄位寬度自動截斷保護。
*   **唯讀分享連結**：
    *   可生成單月唯讀連結（`?view=share&month=YYYY-MM`），供他人免密碼瀏覽與下載 PDF 報表。

## 🛠️ 技術架構

*   **Runtime**: Cloudflare Workers (Serverless)
*   **Database**: Cloudflare Workers KV (Key-Value Storage)
*   **Auth**: Web Crypto HMAC-SHA256 `HttpOnly` Cookie Session (Sliding 30-day TTL) + Same-Origin CSRF Check
*   **Frontend**: Vanilla JS + Tailwind CSS (由 Worker 直接回傳 HTML)
*   **PDF Library**: `pdf-lib` + `fontkit`
*   **CI/CD**: GitHub Actions 手動觸發部署

## 🚀 部署與 Secret 設定

1. 於 Cloudflare 建立 KV Namespace，取得 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`OT_KV_ID`。
2. 於 GitHub Repository Secrets 設定：
   * `AUTH_PIN`：系統登入密碼（後端同時支援 `AUTH_PASSWORD` 或 `AUTH_PIN`）。
   * `USER_NAME`：報表與頁首顯示的使用者名稱。
3. 前往 GitHub **Actions** 手動執行 **Deploy to Cloudflare Workers** 完成字型上傳與部署。

## 📂 專案結構

```text
ot-generator/
├── .github/workflows/
│   ├── deploy.yml        # GitHub Actions 手動部署腳本
│   └── combine-code.yml  # 彙整專案程式碼為 combined_project_code.md
├── src/
│   ├── index.js          # 路由與頁首 SSR 登入狀態檢查
│   ├── auth.js           # 固定時間密碼比對、HMAC Cookie 簽發/驗證與 30 天滑動續期
│   ├── api.js            # CRUD API（含輸入驗證、UUID 與即時回傳更新）
│   └── ui/
│       ├── index.js      # HTML 組裝與安全變數注入
│       ├── html.js       # 登入閘門、主畫面與編輯彈窗結構
│       ├── logic.js      # 登入狀態機、401 攔截、XSS 防護、月曆與編輯邏輯
│       └── pdf.js        # PDF 生成與 Cache API 字型快取
└── wrangler.toml
```

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

