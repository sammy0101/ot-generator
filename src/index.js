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

        let initialAuth = false;
        const headers = { 'content-type': 'text/html;charset=UTF-8' };

        if (!isShareMode) {
            const auth = await authenticateRequest(request, env);
            initialAuth = auth.authenticated;
            if (auth.refreshCookie) {
                headers['Set-Cookie'] = auth.refreshCookie;
            }
        }

        return new Response(getHtml(userName, initialAuth), { headers });
    },
};
