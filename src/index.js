// src/index.js
import { handleAdd, handleGet, handleListMonths, handleDelete, handleDeleteMonth, handlePublicGet } from './api.js';
import { getHtml } from './ui/index.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/add' && request.method === 'POST') {
      return handleAdd(request, env);
    }
    
    if (url.pathname === '/api/delete' && request.method === 'POST') {
      return handleDelete(request, env);
    }

    if (url.pathname === '/api/delete_month' && request.method === 'POST') {
      return handleDeleteMonth(request, env);
    }

    if (url.pathname === '/api/get' && request.method === 'GET') {
      return handleGet(request, env);
    }

    // === 新增公開路由 ===
    if (url.pathname === '/api/public/get' && request.method === 'GET') {
      return handlePublicGet(request, env);
    }
    // =================

    if (url.pathname === '/api/list_months' && request.method === 'GET') {
      return handleListMonths(request, env);
    }

    // 傳遞環境變數中的 USER_NAME (如果在 Secrets 沒設定，就是空字串)
    return new Response(getHtml(env.USER_NAME || ''), {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};
