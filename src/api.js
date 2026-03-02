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

// === 核心修正：Worker 背景代理下載官方字型 ===
export async function handleGetFont(request, env) {
    try {
        // 使用相容性與解析度最佳的 1.1 版粉圓體，直接從官方抓
        const fontUrl = 'https://github.com/justfont/open-huninn-font/releases/download/v1.1/jf-openhuninn-1.1.ttf';
        
        // 偽裝成瀏覽器去抓，並利用 Cloudflare 邊緣快取
        const fontRes = await fetch(fontUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            cf: { cacheTtl: 31536000 } // 快取一年，速度飛快
        });
        
        if (!fontRes.ok) {
            return new Response("字型伺服器錯誤: " + fontRes.status, { status: 502 });
        }
        
        // 將乾淨的二進位檔案原封不動回傳
        return new Response(fontRes.body, {
            headers: {
                "Content-Type": "font/ttf",
                "Cache-Control": "public, max-age=31536000, immutable",
                "Access-Control-Allow-Origin": "*"
            }
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
