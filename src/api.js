// src/api.js

// 處理新增資料
export async function handleAdd(request, env) {
    try {
        const data = await request.json();
        // 驗證 PIN
        if (data.pin !== env.AUTH_PIN) {
            return new Response('密碼錯誤', { status: 401 });
        }

        const monthKey = `OT_${data.date.substring(0, 7)}`;
        
        // 從 KV 讀取
        let records = await env.OT_RECORDS.get(monthKey, { type: 'json' });
        if (!records) records = [];

        // 新增記錄
        records.push({
            id: Date.now(),
            date: data.date,
            location: data.location,
            start: data.start,
            end: data.end,
            timestamp: new Date().toISOString()
        });

        // 排序
        records.sort((a, b) => new Date(a.date) - new Date(b.date));

        // 寫回 KV
        await env.OT_RECORDS.put(monthKey, JSON.stringify(records));

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// 處理讀取單月資料
export async function handleGet(request, env) {
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
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

// 處理列出所有月份
export async function handleListMonths(request, env) {
    const url = new URL(request.url);
    const pin = url.searchParams.get('pin');

    if (pin !== env.AUTH_PIN) {
        return new Response(JSON.stringify({ error: '密碼錯誤' }), { status: 401 });
    }

    const list = await env.OT_RECORDS.list({ prefix: "OT_" });
    const months = list.keys.map(k => k.name.replace('OT_', ''));
    months.sort().reverse();

    return new Response(JSON.stringify(months), {
        headers: { 'Content-Type': 'application/json' }
    });
}
