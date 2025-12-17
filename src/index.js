// src/index.js
import { handleAdd, handleGet, handleListMonths, handleDelete } from './api.js'; // 記得引入 handleDelete
import { getHtml } from './ui/index.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/add' && request.method === 'POST') {
      return handleAdd(request, env);
    }
    
    // === 新增刪除路由 ===
    if (url.pathname === '/api/delete' && request.method === 'POST') {
      return handleDelete(request, env);
    }
    // =================

    if (url.pathname === '/api/get' && request.method === 'GET') {
      return handleGet(request, env);
    }
    
    if (url.pathname === '/api/list_months' && request.method === 'GET') {
      return handleListMonths(request, env);
    }

    return new Response(getHtml(), {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};
