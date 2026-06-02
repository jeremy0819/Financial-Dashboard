# Financial Dashboard — Claude Code 工作手冊

## 這是什麼專案

單一 `index.html` 靜態網頁，部署在 GitHub Pages。  
輸入台股/美股代號 → 抓 FinMind 日收盤 → 六層次分析報告 + 個人資產分析 + 投資計算器。  
目前版本：**v6.0**

Live URL: https://jeremy0819.github.io/Financial-Dashboard/

---

## 檔案架構

```
index.html              主體（HTML + Tailwind CSS + Vanilla JS，約 1,500 行）
scripts/
  stock-db.js           精選股票資料庫（6 支：TSMC/MediaTek/Fubon/Delta/NVDA/TSLA）
  validate.sh           快速語法 + 結構驗證腳本
  sync-db.sh            把 stock-db.js 同步回 index.html
  update-stock.sh       一鍵同步 + 驗證 + commit + push（完整工作流）
  wire-proxy.sh         把 Cloudflare Worker URL 寫進 index.html 的 PROXY_URL
worker/
  index.js              Cloudflare Worker（Anthropic API 代理，隱藏 API Key）
  wrangler.toml         Worker 部署設定
  DEPLOY.md             Worker 部署逐步說明
README.md               專案說明（使用者閱讀）
.claude/
  settings.json         專案層級 Claude Code 設定（hooks + 權限白名單）
  hooks/
    post-edit.sh        PostToolUse hook：Edit/Write index.html 後自動驗證 JS
```

> ⚠️ `.claude/settings.json` 引用了 `pre-bash.sh`（PreToolUse for Bash），但該檔案**尚未建立**，hook 會靜默失敗。若需要 Bash 前置檢查，需新建 `.claude/hooks/pre-bash.sh`。

---

## 重要架構決策（不要打破）

| 決策 | 原因 |
|---|---|
| 無框架、無 build | GitHub Pages 純靜態，零設定部署 |
| 所有邏輯在一支 HTML | 使用者只需複製單一檔案即可自架 |
| FinMind API（免金鑰） | 避免使用者被迫申請 key |
| `const PROXY_URL` 集中管理 API 端點 | `null` = 純 DB 模式；設定後自動切換為 Worker 代理 |

---

## 三種 AI 部署模式

`index.html:135` 的 `const PROXY_URL` 決定 AI 功能如何運作：

| 模式 | `PROXY_URL` 值 | AI 功能 | 使用者操作 |
|---|---|---|---|
| 純 DB 模式（預設） | `null` | 無 AI，精選股顯示策展分析 | 不需任何設定 |
| 瀏覽器直連（個人 demo） | `null` + 側欄填 Key | 使用者自填 Anthropic Key | 有 Key 的用戶才能用 AI |
| Cloudflare Worker 代理 | `'https://...'` | 所有訪客直接用 AI | 一次性設定，訪客免填 Key |

切換到 Worker 模式：`bash scripts/wire-proxy.sh <Worker URL>`（自動修改 index.html 並 commit）

---

## 三種應用模式（前端 UI）

側欄有三個模式按鈕，呼叫 `setMode(m)`（`index.html:1127`）：

```
stock      📈 個股分析    預設模式：輸入代號 → 六層次分析 Tab
portfolio  📁 個人資產   建立持股組合 → 核心-衛星分析 → AI 健診
calc       🧮 投資計算器  複利/定期定額/72法則/台灣定存四種試算
```

---

## 台股資料來源

- **FinMind API**：`https://api.finmindtrade.com/api/v4/data`，CORS 開放，免金鑰
- 台股代號格式：`2330.TW`（上市）、`6669.TWO`（上櫃）
- 美股直接用代號：`NVDA`、`TSLA`

---

## 六層次分析 Tab

```
Tab 0  財務健檢   tabHealth()    六維雷達圖 + 技術均線 + 籌碼
Tab 1  估值分析   tabValuation() P/E / P/B / DCF / 股利
Tab 2  成長潛力   tabGrowth()    市場規模 / AI優勢 / 5/10年展望
Tab 3  多空辯論   tabDebate()    bull[] / bear[] / 分析師共識
Tab 4  投資決策   tabDecision()  BUY/HOLD/AVOID + 催化劑/風險
Tab 5  情境分析   tabScenario()  樂觀/基準/悲觀 + 升息情境
```

`renderTabContent` 的 `fns` 陣列（`index.html:781`）必須與上述 Tab 順序完全對應。

---

## 精選股票 DB（6 支）

資料在 `scripts/stock-db.js`（同步存在 `index.html` 的 `const DB`）。

**正確更新步驟**（二選一）：

```bash
# 方法 A：只同步不 commit
bash scripts/update-stock.sh

# 方法 B：同步 + 驗證 + commit + push（一鍵完成）
bash scripts/update-stock.sh --push

# 查看特定股票目前資料
bash scripts/update-stock.sh --ticker 2330.TW
```

> **禁止**直接手動修改 `index.html` 裡的 `const DB` 區塊，否則下次 sync 時會被覆蓋。

### DB 欄位結構

```js
{
  co, score(0-100), trend('S'|'W'),
  rev, ni, fcf, margin, debt, hsum,         // 財務健檢
  pe, ipe, dcf, cur, verd, verdz, vsum,     // 估值
  mkt, rate, ai, y5, y10, gsum,             // 成長
  bull[], bear[], bal,                      // 多空
  act, actz, st, lt, cat[], risk[], why,    // 決策
  sc: { best, base, worst }                 // 情境分析 (v6.0)
}
// sc 子物件欄位：label, color, trigger, eps, target, upside, note
```

---

## Claude Code Hooks（.claude/）

| Hook | 觸發時機 | 行為 |
|---|---|---|
| `post-edit.sh` | Edit/Write `index.html` 後 | 自動執行 `node --check` 驗證 JS 語法；失敗則阻止繼續 |
| `pre-bash.sh` | 任何 Bash 工具前 | **檔案不存在**，hook 靜默失敗（不影響功能） |

---

## 常用指令

```bash
# 語法 + 結構驗證（任何修改後必跑）
bash scripts/validate.sh

# 同步 DB（修改 stock-db.js 後）
bash scripts/sync-db.sh

# 一鍵更新股票資料並推送
bash scripts/update-stock.sh --push

# 接上 Cloudflare Worker 代理
bash scripts/wire-proxy.sh https://financial-dashboard-proxy.你的帳號.workers.dev

# 推送到 GitHub Pages（main 分支）
git push origin main
```

---

## 工作流守則

1. **每次修改 `index.html` 後，先跑 `bash scripts/validate.sh`**（hook 也會自動驗 JS，但完整結構檢查只有 validate.sh 才做）
2. **更新個股資料只改 `scripts/stock-db.js`**，然後用 `update-stock.sh` 同步
3. **新增 Tab**：在 `TABS` 陣列加項目 → 實作 `tabXxx(d)` → 在 `renderTabContent` 的 `fns` 陣列同位置加入
4. **台股代號**驗證：純數字 4–6 碼 + `.TW` 後綴，上櫃用 `.TWO`
5. **免責聲明**：每個新功能都要有「僅供參考，非投資建議」（validate.sh 第 6 項會檢查）
6. **API 端點呼叫**：使用 `getApiEndpoint()`（`index.html:966`）和 `getApiHeaders()`（`index.html:962`），不要寫死 URL 或 headers
7. **個人資產資料**僅存在使用者瀏覽器 `localStorage`，不上傳

---

## Cloudflare Worker 代理（worker/）

`worker/index.js` 是一個 Anthropic API 反向代理：

- **CORS 白名單**：只允許 `https://jeremy0819.github.io`（`worker/index.js:17`）
- **API Key**：存在 Worker 環境變數 `ANTHROPIC_API_KEY`，前端看不到
- **只允許** `POST /v1/messages`，其他路徑回 404
- 部署指南：`worker/DEPLOY.md`

部署後，用 `wire-proxy.sh` 寫入 URL，`index.html:957–968` 的三個函式會自動切換行為。

---

## 已知限制

- `pre-bash.sh` 在 `.claude/settings.json` 中被引用但**尚未建立**
- FinMind 免費版有 Rate Limit，多個同時請求可能觸發 429
- 美股資料只有價格和技術面，無財報（FinMind 美股覆蓋有限）
- Cloudflare Worker 免費方案每天 10 萬次請求上限
