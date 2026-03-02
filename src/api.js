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

// === 核心新增：字型代理伺服器功能 ===
export async function handleGetFont(request, env) {
    try {
        const githubUrl = 'https://github.com/justfont/open-huninn-font/releases/download/v2.1/jf-openhuninn-2.1.ttf';
        
        // 伺服器在背景去向 GitHub 要檔案，不受瀏覽器限制
        const response = await fetch(githubUrl, {
            headers: { 'User-Agent': 'CloudflareWorker/1.0' }
        });

        if (!response.ok) {
            return new Response("GitHub 拒絕連線: " + response.status, { status: 502 });
        }

        // 把抓到的檔案轉發給您的網頁，並加上「允許跨網域讀取」的許可證
        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Content-Type', 'font/ttf');
        newHeaders.set('Cache-Control', 'public, max-age=31536000'); // 快取一年

        return new Response(response.body, {
            status: response.status,
            headers: newHeaders
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
