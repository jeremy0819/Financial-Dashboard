#!/bin/bash
# validate.sh — 快速語法 + 結構驗證
# 用法：bash scripts/validate.sh
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HTML="$ROOT/index.html"

echo "🔍 驗證 index.html ..."

# 1. 檔案存在
[[ -f "$HTML" ]] || { echo "❌ index.html 不存在"; exit 1; }

# 2. JS 語法
echo -n "  JS 語法... "
JS=$(sed -n '/<script>/,/<\/script>/p' "$HTML" | sed '1d;$d')
if echo "$JS" | node --check 2>/dev/null; then
  echo "✅"
else
  echo "❌  JS 語法錯誤："
  echo "$JS" | node --check 2>&1 | head -5
  exit 1
fi

# 3. 關鍵函式存在
echo -n "  關鍵函式... "
REQUIRED=(tabHealth tabValuation tabGrowth tabDebate tabDecision tabScenario drawRadar renderCalc fetchReal renderPortfolio)
MISSING=()
for fn in "${REQUIRED[@]}"; do
  grep -q "function $fn" "$HTML" || MISSING+=("$fn")
done
if [[ ${#MISSING[@]} -eq 0 ]]; then
  echo "✅"
else
  echo "❌  缺少：${MISSING[*]}"
  exit 1
fi

# 4. DB 包含 6 支精選股票
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

# 5. 情境分析資料 (sc 欄位)
echo -n "  情境分析資料 (sc)... "
SC_COUNT=$(grep -c "sc:{" "$HTML" 2>/dev/null || true)
if [[ "$SC_COUNT" -ge 6 ]]; then
  echo "✅ ($SC_COUNT 筆)"
else
  echo "⚠️  只找到 $SC_COUNT 筆 sc 情境資料（期望 ≥ 6）"
fi

# 6. 免責聲明
echo -n "  免責聲明... "
grep -q "不構成.*投資建議\|非投資建議" "$HTML" && echo "✅" || echo "⚠️  找不到免責聲明文字"

echo ""
echo "✅ 驗證完成"
