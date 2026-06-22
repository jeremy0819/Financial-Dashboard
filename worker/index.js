/**
 * Cloudflare Worker — Anthropic API Proxy
 *
 * 功能：
 *   - 把 API Key 藏在 Worker 環境變數（不暴露給前端使用者）
 *   - 讓 Financial Dashboard 不需要使用者填 API Key 也能用 AI 分析
 *   - 加入 CORS header，允許 GitHub Pages 呼叫
 *
 * 部署後，把 index.html 裡的：
 *   fetch('https://api.anthropic.com/v1/messages', ...)
 * 改成：
 *   fetch('https://your-worker.your-subdomain.workers.dev/v1/messages', ...)
 * 並移除 'x-api-key' 和 'anthropic-dangerous-direct-browser-access' header
 */

const ANTHROPIC_API = 'https://api.anthropic.com';
const ALLOWED_ORIGIN = 'https://jeremy0819.github.io'; // 只允許你的 GitHub Pages

export default {
  async fetch(request, env) {
    // OPTIONS preflight（瀏覽器 CORS 預檢）
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(request) });
    }

    // 只允許 POST /v1/messages
    const url = new URL(request.url);
    if (request.method !== 'POST' || !url.pathname.startsWith('/v1/messages')) {
      return new Response('Not found', { status: 404 });
    }

    // 驗證來源（防止其他人濫用你的 Key）
    const origin = request.headers.get('Origin') || '';
    if (origin !== ALLOWED_ORIGIN) {
      return new Response('Forbidden', { status: 403 });
    }

    // API Key 來自 Worker 環境變數（wrangler secret put ANTHROPIC_API_KEY）
    const apiKey = env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return new Response('Server misconfigured: missing API key', { status: 500 });
    }

    // 轉發請求到 Anthropic
    const body = await request.text();
    const upstream = await fetch(`${ANTHROPIC_API}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body,
    });

    const responseBody = await upstream.text();
    return new Response(responseBody, {
      status: upstream.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(request),
      },
    });
  },
};

function corsHeaders(request) {
  return {
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, anthropic-version',
  };
}
