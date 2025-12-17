// src/api.js

export async function handleAdd(request, env) {
    try {
        const data = await request.json();
        // 驗證 PIN
        if (data.pin !== env.AUTH_PIN) {
            return new Response('密碼錯誤', { status: 401 });
        }

        const monthKey = `OT_${data.date.substring(0, 7)}`;
        
        let records = await env.OT_RECORDS.get(monthKey, { type: 'json' });
        if (!records) records = [];

        // 建立新記錄物件
        const newRecord = {
            id: Date.now(),
            type: data.type || 'hourly', // 預設為時數
            date: data.date,             // 開始日期
            endDate: data.endDate,       // 結束日期 (當更用)
            location: data.location,     // 地點或備註
            start: data.start,           // 開始時間 (OT用)
            end: data.end,               // 結束時間 (OT用)
            amount: data.amount ? parseInt(data.amount) : 0, // 金額 (HKD)
            timestamp: new Date().toISOString()
        };

        records.push(newRecord);

        // 排序 (依日期)
        records.sort((a, b) => new Date(a.date) - new Date(b.date));

        await env.OT_RECORDS.put(monthKey, JSON.stringify(records));

        return new Response(JSON.stringify({ success: true }), {
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// 讀取與列表功能的代碼不需要改，維持原樣即可
export async function handleGet(request, env) {
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    const pin = url.searchParams.get('pin');
    if (pin !== env.AUTH_PIN) return new Response(JSON.stringify({ error: '密碼錯誤' }), { status: 401 });
    const key = `OT_${month}`;
    const records = await env.OT_RECORDS.get(key, { type: 'json' }) || [];
    return new Response(JSON.stringify(records), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleListMonths(request, env) {
    const url = new URL(request.url);
    const pin = url.searchParams.get('pin');
    if (pin !== env.AUTH_PIN) return new Response(JSON.stringify({ error: '密碼錯誤' }), { status: 401 });
    const list = await env.OT_RECORDS.list({ prefix: "OT_" });
    const months = list.keys.map(k => k.name.replace('OT_', ''));
    months.sort().reverse();
    return new Response(JSON.stringify(months), { headers: { 'Content-Type': 'application/json' } });
}
