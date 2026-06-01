#!/bin/bash
# 每次 Edit/Write index.html 後自動驗證 JS 語法
FILE="$1"
if [[ "$FILE" == *"index.html"* ]]; then
  JS=$(sed -n '/<script>/,/<\/script>/p' "$FILE" | sed '1d;$d')
  if ! echo "$JS" | node --input-type=module --check 2>/dev/null; then
    # node module check 可能因 top-level code 失敗，改用 script mode
    if ! echo "$JS" | node --check 2>/dev/null; then
      echo "⚠️  index.html JS 語法錯誤，請修正後再 commit" >&2
      exit 1
    fi
  fi
fi
exit 0
