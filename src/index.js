// src/index.js

import { handleAdd, handleGet, handleListMonths } from './api.js';
import { getHtml } from './ui/index.js'; // <--- 改這裡，指向新的 ui 資料夾

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === '/api/add' && request.method === 'POST') {
      return handleAdd(request, env);
    }

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
