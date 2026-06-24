#!/bin/bash
# 每次 Edit/Write index.html 或 src/*.js 後自動驗證 JS 語法
FILE="$1"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

if [[ "$FILE" == *"index.html"* ]]; then
  INLINE_JS=$(python3 -c "
import re, sys
with open('$FILE', encoding='utf-8') as f:
    html = f.read()
blocks = re.findall(r'<script(?! src)[^>]*>(.*?)</script>', html, re.DOTALL)
print('\n'.join(blocks))
" 2>/dev/null)
  if ! echo "$INLINE_JS" | node --check 2>/dev/null; then
    echo "⚠️  index.html inline JS 語法錯誤，請修正後再 commit" >&2
    exit 1
  fi
fi

if [[ "$FILE" == *"/src/"*".js" ]]; then
  if ! node --check "$FILE" 2>/dev/null; then
    echo "⚠️  $(basename "$FILE") JS 語法錯誤，請修正後再 commit" >&2
    exit 1
  fi
fi

exit 0
