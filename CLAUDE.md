# Financial Dashboard — Claude Code 工作手冊

## 這是什麼專案

單一 `index.html` 靜態網頁，部署在 GitHub Pages。  
輸入台股/美股代號 → 抓 FinMind 日收盤 → 六層次分析報告。  
目前版本：**v6.0**

Live URL: https://jeremy0819.github.io/Financial-Dashboard/

## 檔案架構

```
index.html          主體（HTML + Tailwind CSS + Vanilla JS，約 1,500 行）
scripts/
  stock-db.js       精選股票資料庫（6 支：TSMC/MediaTek/Fubon/Delta/NVDA/TSLA）
  validate.sh       快速語法驗證腳本
README.md           專案說明
.claude/
  settings.json     專案層級 Claude Code 設定（hook: JS 語法驗證）
```

## 重要架構決策（不要打破）

| 決策 | 原因 |
|---|---|
| 無框架、無 build | GitHub Pages 純靜態，零設定部署 |
| 所有邏輯在一支 HTML | 使用者只需複製單一檔案即可自架 |
| FinMind API（免金鑰） | 避免使用者被迫申請 key |
| Anthropic API Key 在 browser | 純前端，無後端，只適合 personal demo |

## 台股資料來源

- **FinMind API**：`https://api.finmindtrade.com/api/v4/data`，CORS 開放
- 台股代號格式：`2330.TW`（上市）、`6669.TWO`（上櫃）
- 美股直接用代號：`NVDA`、`TSLA`

## 六層次分析 Tab 對應

```
Tab 0  財務健檢   tabHealth()    六維雷達圖 + 技術均線 + 籌碼
Tab 1  估值分析   tabValuation() P/E / P/B / DCF / 股利
Tab 2  成長潛力   tabGrowth()    市場規模 / AI優勢 / 5/10年展望
Tab 3  多空辯論   tabDebate()    bull[] / bear[] / 分析師共識
Tab 4  投資決策   tabDecision()  BUY/HOLD/AVOID + 催化劑/風險
Tab 5  情境分析   tabScenario()  樂觀/基準/悲觀 + 升息情境
```

## 精選股票 DB（6 支）

資料在 `scripts/stock-db.js`（同步存在 `index.html` 的 `const DB`）。  
**更新步驟**：修改 `scripts/stock-db.js` → 執行 `scripts/sync-db.sh` → 自動同步回 `index.html`。

欄位結構：
```js
{
  co, score(0-100), trend('S'|'W'),
  rev, ni, fcf, margin, debt, hsum,   // 財務健檢
  pe, ipe, dcf, cur, verd, verdz, vsum,  // 估值
  mkt, rate, ai, y5, y10, gsum,         // 成長
  bull[], bear[], bal,                  // 多空
  act, actz, st, lt, cat[], risk[], why, // 決策
  sc: { best, base, worst }            // 情境分析 (v6.0)
}
```

## 常用指令

```bash
# 語法驗證（任何修改後必跑）
bash scripts/validate.sh

# 同步 DB（修改 stock-db.js 後）
bash scripts/sync-db.sh

# 推送到 GitHub Pages（main 分支）
git push origin main
```

## 工作流守則

1. **每次修改 index.html 後，先跑 `bash scripts/validate.sh`**
2. **更新個股資料只改 `scripts/stock-db.js`**，不直接手動改 HTML 裡的 DB
3. **新增 Tab**：在 TABS 陣列加項目 → 實作 `tabXxx(d)` → 在 `renderTabContent` 的 fns 陣列加入
4. **台股代號**驗證：純數字 4–6 碼 + `.TW` 後綴，上櫃用 `.TWO`
5. **免責聲明**：每個新功能都要有「僅供參考，非投資建議」

## 已知限制

- Anthropic API Key 直接在 browser 發送，僅適合 personal demo（README 有標注）
- FinMind 免費版有 Rate Limit，多個同時請求可能觸發 429
- 美股資料只有價格和技術面，無財報（FinMind 美股覆蓋有限）
