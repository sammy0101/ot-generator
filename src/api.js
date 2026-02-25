export async function handleAdd(request, env) {
    try {
        const data = await request.json();
        if (data.pin !== env.AUTH_PIN) return new Response('密碼錯誤', { status: 401 });

        const monthKey = `OT_${data.date.substring(0, 7)}`;
        let records = await env.OT_RECORDS.get(monthKey, { type: 'json' });
        if (!records) records = [];

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
        
        // 同時刪除該月的發送狀態
        let sentList = await env.OT_RECORDS.get("OT_META_SENT", { type: 'json' }) || [];
        if (sentList.includes(data.month)) {
            sentList = sentList.filter(m => m !== data.month);
            await env.OT_RECORDS.put("OT_META_SENT", JSON.stringify(sentList));
        }

        return new Response(JSON.stringify({ success: true }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}

// === 新增：切換發送狀態 API ===
export async function handleToggleSent(request, env) {
    try {
        const data = await request.json();
        if (data.pin !== env.AUTH_PIN) return new Response('密碼錯誤', { status: 401 });

        // 讀取目前的已發送清單
        let sentList = await env.OT_RECORDS.get("OT_META_SENT", { type: 'json' }) || [];
        
        if (sentList.includes(data.month)) {
            // 如果已存在，則移除 (變回未發送)
            sentList = sentList.filter(m => m !== data.month);
        } else {
            // 如果不存在，則加入 (變成已發送)
            sentList.push(data.month);
        }
        
        await env.OT_RECORDS.put("OT_META_SENT", JSON.stringify(sentList));

        return new Response(JSON.stringify({ success: true, list: sentList }), { headers: { 'Content-Type': 'application/json' } });
    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
// ==========================

export async function handleGet(request, env) {
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    const pin = url.searchParams.get('pin');
    if (pin !== env.AUTH_PIN) return new Response(JSON.stringify({ error: '密碼錯誤' }), { status: 401 });
    const key = `OT_${month}`;
    const records = await env.OT_RECORDS.get(key, { type: 'json' }) || [];
    return new Response(JSON.stringify(records), { headers: { 'Content-Type': 'application/json' } });
}

export async function handlePublicGet(request, env) {
    const url = new URL(request.url);
    const month = url.searchParams.get('month');
    const key = `OT_${month}`;
    const records = await env.OT_RECORDS.get(key, { type: 'json' }) || [];
    return new Response(JSON.stringify(records), { headers: { 'Content-Type': 'application/json' } });
}

export async function handleListMonths(request, env) {
    const url = new URL(request.url);
    const pin = url.searchParams.get('pin');
    if (pin !== env.AUTH_PIN) return new Response(JSON.stringify({ error: '密碼錯誤' }), { status: 401 });
    
    // 1. 取得所有月份 Key
    const list = await env.OT_RECORDS.list({ prefix: "OT_" });
    // 過濾掉非月份的 key (例如 Meta key)
    const months = list.keys
        .map(k => k.name.replace('OT_', ''))
        .filter(m => m.match(/^\d{4}-\d{2}$/)); // 只保留 YYYY-MM 格式
    
    months.sort().reverse();

    // 2. 取得已發送狀態清單
    const sentList = await env.OT_RECORDS.get("OT_META_SENT", { type: 'json' }) || [];

    // 回傳物件結構改變：包含月份列表和狀態
    return new Response(JSON.stringify({ months, sentList }), { headers: { 'Content-Type': 'application/json' } });
}
