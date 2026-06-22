#!/bin/bash
# sync-db.sh — 把 scripts/stock-db.js 的內容同步回 index.html
# 用法：bash scripts/sync-db.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HTML="$ROOT/index.html"
DB="$ROOT/scripts/stock-db.js"

if [[ ! -f "$DB" ]]; then
  echo "❌ 找不到 $DB" >&2
  exit 1
fi

# 取出 db 內容（去掉頂部的注釋行，只取 const DB={...} 的部分）
DB_CONTENT=$(sed -n '/^const DB={/,/^};$/p' "$DB")
if [[ -z "$DB_CONTENT" ]]; then
  echo "❌ stock-db.js 中找不到 'const DB={...}' 區塊" >&2
  exit 1
fi

# 用 awk 替換 index.html 中的 DB 區塊
awk -v db="$DB_CONTENT" '
  /^const DB=\{/      { printing=1 }
  printing && /^};$/  { print db; printing=0; next }
  !printing           { print }
' "$HTML" > "$HTML.tmp"

# 驗證語法
JS=$(sed -n '/<script>/,/<\/script>/p' "$HTML.tmp" | sed '1d;$d')
if ! echo "$JS" | node --check 2>/dev/null; then
  rm "$HTML.tmp"
  echo "❌ 同步後 JS 語法錯誤，已還原。請檢查 stock-db.js" >&2
  exit 1
fi

mv "$HTML.tmp" "$HTML"
echo "✅ stock-db.js 已同步回 index.html"
echo "   變更行數：$(git diff --stat "$HTML" 2>/dev/null || echo '（git diff 需在 repo 內執行）')"
