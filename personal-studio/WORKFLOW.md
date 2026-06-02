# 個人工作室 — Workflow

> 怎麼把六位 agent + 一支 skill + 雙身分查核，串成每天真的會跑的流程。

---

## 一張圖：任務怎麼流動

```
                     ┌─────────────────────┐
   新任務 / 想法  →  │  /personal-studio   │  ← 調度大腦
                     │  Step 1 分流閘門     │
                     └──────────┬──────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                     ▼
        【工具類】                              【框架類】
     會重複/要算數/存資料                    一次性/主觀/即時對話
              │                                     │
              ▼                                     ▼
     派給對應施工 agent                      留在 Project 對話
   ┌──────────┼──────────┐                  ┌────────┴────────┐
   ▼          ▼          ▼                  ▼                 ▼
urban-     finance-   learning-          週/月 Review      決策日誌
renewal    tracker    coach              (auditor)        (第一性原理)
analyst                taste-curator
   │          │          │
   └──────────┴──────────┘
              │
              ▼
        建成單一 HTML 工具
        （localStorage + validate）
```

---

## 日常迴圈（每天）

1. **開場找指導者** — 一句「下一步該做什麼」召喚 `mentor`，它對照建造順序給你今天的一步。
2. **做事走調度** — 有具體任務就丟給 `/personal-studio`，它判工具/框架後派工。
3. **工具類交施工 agent**，框架類自己在對話練。

## 週迴圈（每週固定一次）

1. 跑 `/personal-studio 週查核` → 召喚 `auditor`。
2. `auditor` 讀本週 git log + 各追蹤器狀態，逐項回報「承諾 vs 達成 + 落差」。
3. **不要在這一輪找指導者。** 先讓自己照完鏡子。
4. 照完鏡子後，再開新一輪找 `mentor` 規劃下週修正——兩個身分分開。

## 月迴圈

- `auditor` 做月度對帳：財務進度曲線 vs 目標線、職涯里程碑落後天數、學習複習完成率。
- 回頭更新 `CLAUDE.md` 第 8 節進度備註打勾。

---

## 建造順序（再貼一次，照著走）

| 階段 | 交付 | agent | 為什麼是這個順序 |
|---|---|---|---|
| 第 0 步（3 天） | Financial Dashboard 加財務目標模式 | `finance-tracker` | 現成基礎設施，零學習曲線，先嘗到甜頭 |
| 第 1 個月 | 容積查核工具 | `urban-renewal-analyst` | 規則明確、天天用、出錯看得出來 → 建立信心 |
| 第 2 個月 | 財務儀表板 + 職涯里程碑 | `finance-tracker` | 資料簡單、激勵性強 |
| 第 3 個月 | 可行性快篩器 | `urban-renewal-analyst` | 整合前面學的 |
| 持續 | 框架類（Review / 決策 / 品味） | Project + `auditor` + `taste-curator` | 即時開始，不用等工具 |

> 為什麼第 0 步插在第 1 個月前？因為延伸現有 Financial Dashboard 幾乎零成本，3 天內就能看到「35 歲存千萬」的進度曲線——這個即時激勵會讓你帶著好狀態進第 1 個月的容積工具。

---

## 三條鐵律（貼牆上）

1. **先過分流閘門。** 每個任務先問「工具還是框架」，不確定就傾向框架。
2. **兩個身分不混。** 指導者推你前進，查核者讓你面對現實——永遠分開召喚。
3. **品味要自己練。** `taste-curator` 只管庫存，美學判斷一律自己下筆。

---

## 召喚速查

| 我想… | 指令 |
|---|---|
| 知道下一步 | 對話問「下一步」→ `mentor` |
| 丟一個新任務 | `/personal-studio` |
| 週查核 | `/personal-studio 週查核` → `auditor` |
| 做都更計算工具 | `/personal-studio` 描述 → `urban-renewal-analyst` |
| 做財務/職涯追蹤 | `/personal-studio` 描述 → `finance-tracker` |
| 學習進度/測驗 | `/personal-studio` 描述 → `learning-coach` |
| 整理案例庫 | `/personal-studio` 描述 → `taste-curator` |
