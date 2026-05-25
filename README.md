# 🏗️ AI 股票財務健檢系統 v3.0

> 建築人專屬的股票財務分析工具 — 將財報當作建築設計圖來審查
>
> **v3.0 新增：即時真實數據（FinMind API）+ 互動圖表（Chart.js）**

🔗 **線上 Demo**：<https://jeremy0819.github.io/-/>

---

## 📊 專案簡介

單一 `index.html` 靜態網頁，輸入股票代號即抓取**即時財報數據**並產出**五層次深度分析報告**。
資料來源整合 [My TW Coverage](https://github.com/Timeverse/My-TW-Coverage)（1,735 家台股研究資料庫）的研究框架。

### 核心理念：建築思維 × 財務分析

| 建築概念 | 財務對應 |
|---|---|
| 建案預估總銷 | 損益表營收 |
| 結構強度 / 建融壓力 | 負債比 / DSCR |
| 案場周轉金 | 自由現金流 FCF |
| 開發案 IRR | 股票 ROE / 報酬率 |

---

## ✨ 五層次深度分析框架

```
Layer 1 — 財務健檢    即時股價、月營收年增、毛利率、EPS、股價×營收走勢圖
Layer 2 — 估值分析    即時 P/E、P/B、現金殖利率、DCF 折現
Layer 3 — 成長潛力    市場規模、產業增長率、AI優勢、5/10年展望
Layer 4 — 多空辯論    多頭 vs 空頭分析師，數據支持的對立論點
Layer 5 — 投資決策    BUY / HOLD / AVOID，催化劑與風險清單
```

---

## 🔀 雙引擎：即時數字 + 質化分析

| 引擎 | 來源 | 說明 |
|---|---|---|
| **即時數字** | FinMind API | 股價、P/E、P/B、殖利率、月營收、財報利潤率、EPS（台股完整；美股提供即時股價） |
| **質化分析** | 內建 DB / Claude AI | 6 支精選個股有策展分析；填入 Anthropic API Key 後，由 Claude 以即時數字為依據生成五層分析 |

- **不填金鑰（預設）**：即時數字 + 內建質化分析（DB 或自動生成）。
- **填入 `sk-ant-...` 金鑰**：即時數字 + Claude 即時生成的質化分析（`temperature:0`，結果快取確保一致）。

> ⚠️ 金鑰僅存在瀏覽器記憶體、直接呼叫 Anthropic（靜態網頁無後端代理），僅適合個人 Demo 使用。

---

## 🎯 內建策展個股（其餘代號自動以即時數字 + 自動生成分析呈現）

| 代號 | 公司 | 代號 | 公司 |
|---|---|---|---|
| 2330.TW | 台積電 | 2308.TW | 台達電 |
| 2454.TW | 聯發科 | NVDA | NVIDIA |
| 2881.TW | 富邦金控 | TSLA | Tesla |

輸入方式：台股加 `.TW`（如 `2330.TW`），美股直接輸入代號（如 `NVDA`）。

---

## 🔧 技術架構

- **前端**：HTML5 + Tailwind CSS (CDN) + Vanilla JavaScript（單一檔案，無框架、無建置）
- **即時數據**：[FinMind API](https://finmindtrade.com/)（CORS 開放，免金鑰基本使用）
- **圖表**：Chart.js 4（股價 × 月營收組合圖）
- **AI（選填）**：Anthropic Claude Messages API
- **部署**：GitHub Pages（純靜態）

---

## 🔗 相關專案

| 專案 | 說明 |
|---|---|
| [My TW Coverage](https://github.com/Timeverse/My-TW-Coverage) | 台股研究資料庫（1,735 公司，Python yfinance/FinMind 自動化） |

---

## 👤 作者

**郭哲雍 (Kuo Che-Yung)** — 建築學士 + 建築碩士 ｜ 都更開發 × 財務分析

- 本系統部署：[@jeremy0819](https://github.com/jeremy0819)
- 研究資料庫：[@Timeverse](https://github.com/Timeverse)（My-TW-Coverage）

---

⚠️ **免責聲明**：本系統為展示版，即時數據來自第三方 API、質化分析僅供參考，不構成投資建議。
