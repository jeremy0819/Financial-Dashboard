#!/bin/bash
# update-stock.sh — 修改 stock-db.js 後一鍵同步、驗證、commit、push
# 用法：
#   bash scripts/update-stock.sh              # 同步 + 驗證（不 commit）
#   bash scripts/update-stock.sh --push       # 同步 + 驗證 + commit + push
#   bash scripts/update-stock.sh --ticker 2330.TW  # 只顯示該股目前的資料
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

show_ticker(){
  local t="$1"
  echo "📋 $t 目前資料："
  awk "/'$t':/,/^  \}/" "$ROOT/scripts/stock-db.js" | head -40
  exit 0
}

PUSH=false
TICKER=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --push)    PUSH=true; shift ;;
    --ticker)  TICKER="$2"; shift 2 ;;
    *)         echo "未知參數：$1"; exit 1 ;;
  esac
done

[[ -n "$TICKER" ]] && show_ticker "$TICKER"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Financial Dashboard — 股票 DB 更新流程"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Step 1: 同步 DB
echo "▶ Step 1：同步 stock-db.js → index.html"
bash "$ROOT/scripts/sync-db.sh"
echo ""

# Step 2: 驗證
echo "▶ Step 2：執行驗證"
bash "$ROOT/scripts/validate.sh"
echo ""

# Step 3: Git diff 摘要
echo "▶ Step 3：變更摘要"
cd "$ROOT"
if git diff --quiet index.html; then
  echo "  ℹ️  index.html 無變動（stock-db.js 內容與 HTML 已一致）"
else
  echo "  已變更："
  git diff --stat index.html
fi
echo ""

# Step 4: Commit + Push（若加 --push）
if $PUSH; then
  echo "▶ Step 4：Commit & Push"
  cd "$ROOT"
  CHANGED=$(git diff --name-only)
  if [[ -z "$CHANGED" && -z "$(git status --porcelain)" ]]; then
    echo "  ℹ️  沒有需要 commit 的變更"
    exit 0
  fi
  git add index.html scripts/stock-db.js
  DATE=$(date '+%Y-%m-%d')
  git commit -m "data: 更新精選股票 DB（$DATE）

  修改來源：scripts/stock-db.js → 自動同步回 index.html

  https://claude.ai/code/session_01BpWioK7twiqWSqh4EdaB5J"
  git push origin "$(git branch --show-current)"
  echo ""
  echo "✅ 已推送，GitHub Pages 約 1–2 分鐘後生效"
else
  echo "ℹ️  若要 commit & push，執行：bash scripts/update-stock.sh --push"
fi

echo ""
echo "✅ 完成"
