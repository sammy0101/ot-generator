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

    if (url.pathname === '/api/public/get' && request.method === 'GET') {
      return handlePublicGet(request, env);
    }

    if (url.pathname === '/api/list_months' && request.method === 'GET') {
      return handleListMonths(request, env);
    }

    // === 讀取 USER_NAME ===
    // 這裡會讀取被 sed 替換後的 wrangler.toml 裡的 [vars]
    // 如果替換失敗，會顯示空字串，不會報錯
    const userName = (env.USER_NAME && env.USER_NAME !== "REPLACE_ME_NAME") ? env.USER_NAME : "";
    
    return new Response(getHtml(userName), {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};
