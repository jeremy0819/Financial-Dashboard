#!/bin/bash
# validate.sh — 快速語法 + 結構驗證（支援模組化架構）
# 用法：bash scripts/validate.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HTML="$ROOT/index.html"
SRC="$ROOT/src"

echo "🔍 驗證 index.html + src/ 模組 ..."

# 1. 檔案存在
[[ -f "$HTML" ]] || { echo "❌ index.html 不存在"; exit 1; }

# 2. JS 語法 — index.html inline blocks（用 Python 正確萃取，排除 <script src=>）
echo -n "  index.html 內嵌 JS... "
INLINE_JS=$(python3 -c "
import re, sys
with open('$HTML', encoding='utf-8') as f:
    html = f.read()
# 只取沒有 src 屬性的 script 區塊
blocks = re.findall(r'<script(?! src)[^>]*>(.*?)</script>', html, re.DOTALL)
print('\n'.join(blocks))
")
if echo "$INLINE_JS" | node --check 2>/dev/null; then
  echo "✅"
else
  echo "❌  JS 語法錯誤："
  echo "$INLINE_JS" | node --check 2>&1 | head -5
  exit 1
fi

# 3. src/ 模組語法（如果目錄存在）
if [[ -d "$SRC" ]]; then
  echo -n "  src/ 模組語法... "
  FAILED=()
  for f in "$SRC"/*.js; do
    [[ -f "$f" ]] || continue
    node --check "$f" 2>/dev/null || FAILED+=("$(basename "$f")")
  done
  if [[ ${#FAILED[@]} -eq 0 ]]; then
    COUNT=$(ls "$SRC"/*.js 2>/dev/null | wc -l)
    echo "✅ ($COUNT 個模組)"
  else
    echo "❌  語法錯誤：${FAILED[*]}"
    exit 1
  fi
fi

# 4. 關鍵函式存在（搜尋 index.html + src/ 全部）
echo -n "  關鍵函式... "
REQUIRED=(tabHealth tabValuation tabGrowth tabDebate tabDecision tabScenario renderCalc fetchReal renderPortfolio)
MISSING=()
for fn in "${REQUIRED[@]}"; do
  # 搜尋 index.html 和所有 src/*.js
  if ! grep -rq "function $fn" "$HTML" "$SRC" 2>/dev/null; then
    MISSING+=("$fn")
  fi
done
if [[ ${#MISSING[@]} -eq 0 ]]; then
  echo "✅"
else
  echo "❌  缺少：${MISSING[*]}"
  exit 1
fi

# 5. DB 包含 6 支精選股票（DB 留在 index.html）
echo -n "  精選股票 DB... "
REQUIRED_TICKERS=("2330.TW" "2454.TW" "2881.TW" "2308.TW" "NVDA" "TSLA")
MISSING_T=()
for t in "${REQUIRED_TICKERS[@]}"; do
  grep -q "'$t'" "$HTML" || MISSING_T+=("$t")
done
if [[ ${#MISSING_T[@]} -eq 0 ]]; then
  echo "✅"
else
  echo "❌  缺少股票：${MISSING_T[*]}"
  exit 1
fi

# 6. 情境分析資料 (sc 欄位)
echo -n "  情境分析資料 (sc)... "
SC_COUNT=$(grep -c "sc:{" "$HTML" 2>/dev/null || true)
if [[ "$SC_COUNT" -ge 6 ]]; then
  echo "✅ ($SC_COUNT 筆)"
else
  echo "⚠️  只找到 $SC_COUNT 筆 sc 情境資料（期望 ≥ 6）"
fi

# 7. 免責聲明
echo -n "  免責聲明... "
grep -rq "不構成.*投資建議\|非投資建議" "$HTML" "$SRC" 2>/dev/null && echo "✅" || echo "⚠️  找不到免責聲明文字"

echo ""
echo "✅ 驗證完成"
