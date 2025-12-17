// src/index.js
import { handleAdd, handleGet, handleListMonths } from './api.js';
import { getHtml } from './ui.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // API 路由分配
    if (url.pathname === '/api/add' && request.method === 'POST') {
      return handleAdd(request, env);
    }

    if (url.pathname === '/api/get' && request.method === 'GET') {
      return handleGet(request, env);
    }
    
    if (url.pathname === '/api/list_months' && request.method === 'GET') {
      return handleListMonths(request, env);
    }

    // 預設：回傳 UI 網頁
    return new Response(getHtml(), {
      headers: { 'content-type': 'text/html;charset=UTF-8' },
    });
  },
};
