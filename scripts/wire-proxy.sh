#!/bin/bash
# wire-proxy.sh — 把 Cloudflare Worker URL 寫進 index.html
# 用法：bash scripts/wire-proxy.sh https://financial-dashboard-proxy.你的帳號.workers.dev
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HTML="$ROOT/index.html"
URL="$1"

if [[ -z "$URL" ]]; then
  echo "用法：bash scripts/wire-proxy.sh <Worker URL>"
  echo "範例：bash scripts/wire-proxy.sh https://financial-dashboard-proxy.jeremy0819.workers.dev"
  echo ""
  echo "目前設定："
  grep "const PROXY_URL=" "$HTML"
  exit 1
fi

# 驗證 URL 格式
if [[ ! "$URL" =~ ^https:// ]]; then
  echo "❌ URL 必須以 https:// 開頭" >&2
  exit 1
fi

echo "▶ 寫入 PROXY_URL：$URL"
sed -i "s|const PROXY_URL=null;|const PROXY_URL='$URL';|g" "$HTML"

# 驗證有沒有成功替換
if grep -q "const PROXY_URL='$URL';" "$HTML"; then
  echo "✅ 已更新 index.html"
else
  echo "❌ 替換失敗，請確認 index.html 中有 'const PROXY_URL=null;'" >&2
  exit 1
fi

echo ""
echo "▶ 驗證 JS 語法..."
bash "$ROOT/scripts/validate.sh"

echo ""
echo "▶ Commit & Push..."
cd "$ROOT"
git add index.html
git commit -m "feat: 接上 Cloudflare Worker 代理（移除前端 API Key 需求）

Worker URL：$URL
使用者不再需要填入 API Key 即可使用 AI 分析。

https://claude.ai/code/session_01BpWioK7twiqWSqh4EdaB5J"
git push origin "$(git branch --show-current)"

echo ""
echo "✅ 完成！GitHub Pages 約 1–2 分鐘後生效"
echo "   訪客無需填 Key，直接使用 AI 六層分析"
