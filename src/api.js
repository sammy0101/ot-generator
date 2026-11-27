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
