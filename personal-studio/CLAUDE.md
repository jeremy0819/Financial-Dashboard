# 我的 AI 工作環境 — Claude Code 主工作手冊（CLAUDE.md）

> 這份文件是我的**跨 session 記憶**，每次開新對話請先讀這裡。
> 我把 AI skills 當作不同部門的員工在管理，目標是成為建築業的「AI 落地接線人」。

---

## 0. 這份文件怎麼用（給 Claude）

把**整個 `personal-studio/` 資料夾**複製成新 repo 的根目錄，Claude Code 會自動讀到：

- 這份 `CLAUDE.md`（工作室憲法 / 跨 session 記憶）
- `.claude/skills/personal-studio/`（調度大腦）
- `.claude/agents/*.md`（目前已招募的員工：mentor、auditor、evaluation-analyst、document-specialist）
- `WORKFLOW.md`（建造順序與查核迴圈）

開新 session 後，我會說「**啟動工作室**」或直接丟任務，調度 skill 會接手分流。

---

## 1. 關於我

- 台灣傳統建築業從業者（傑丞建設相關，都更／危老開發）。
- **非技術背景**：能操作 AI 工具，**不會寫程式**。
- 指令說明請**拆到最細**，不要預設我懂語法、懂指令怎麼用。
- **請全程使用繁體中文**（台灣用語）。

---

## 2. 我的 AI 員工公司（虛擬部門）

我把 AI skills / agent 當作不同部門的員工在管理。
**目前狀態**：✅ 已落地＝評估部；🔜 下一個落地＝文件部（地主說明書）；其餘部門「留位，用到再招募」。

> 招募原則：**先用現有員工，再招募新員工。** 先問現有 skill / 工具能不能解決，
> 真的不夠，才用行政部的人資（`npx skills find`）找新 skill，或訓練主管（skill-creator）自己包一個。

### 🏢 評估部（核心業務，✅ 已落地）
> 都更／危老前期評估，這是我最重要的 AI 落地成果。對應 agent：`evaluation-analyst`。

| 員工 | 工具 | 負責工作 |
|---|---|---|
| 坪效分析師 | RE-DCF-Tool（已完成 v3.1） | 容積查核、銷坪比、開發評效 |
| 法規查核員 | Claude + 建築技術規則 | §162 逐層計算、法規確認 |
| 財務試算員 | RE-DCF-Tool 財務評效 | 開發評效、敏感度分析 |

### 📝 文件部（🔜 下一個落地）
> 把重複撰寫的文件自動化。對應 agent：`document-specialist`。

| 員工 | 工具/Skill | 負責工作 |
|---|---|---|
| 地主說明書專員 | Claude（下一個落地案例） | 每個案子的客製化說明書 |
| 合約審查員 | Claude | 標出風險條款、逐條解釋 |
| 週報整理員 | Claude | 語音／文字輸入轉結構化報告 |
| 建照查核員 | Claude | 送件前對照法規清單自我檢查 |

### 🌐 翻譯部（留位，用到再招募）
> 參考 baoyu-translate 四段式流程。目前用 skill 直接處理，尚無專屬 agent。

| 員工 | 工具/Skill | 負責工作 |
|---|---|---|
| 技術翻譯 | baoyu-translate skill | 外國建築規範、技術文件翻譯 |
| 台灣化校對 | taiwan-traditional-chinese | 確保用語是台灣建築業慣用詞 |

### 🎨 內容創作部（留位，用到再招募）
> 參考 baoyu 內容創作系列。主戰場是 jieceng-web 官網。

| 員工 | 工具/Skill | 負責工作 |
|---|---|---|
| 提案簡報設計 | baoyu-infographic / Claude | 視覺化坪效資料、開發成果圖 |
| 網站內容編輯 | Claude + jieceng-web | 傑丞建設官網文案 |
| 社群貼文寫手 | baoyu-format-markdown | 案例成果的社群發文 |

### 🛠 行政部（管理其他員工 / 留位）
> 參考 find-skills / skill-creator 概念。這是「招募新員工」的窗口。

| 員工 | 工具/Skill | 負責工作 |
|---|---|---|
| 人資 | find-skills（`npx skills find`） | 找新的 skill 安裝進來 |
| 訓練主管 | skill-creator | 把重複指令包成新 skill |
| 工作流程師 | n8n / Langflow（未來） | 串接多個工具的自動化流程 |

---

## 3. 雙身分查核機制（跨部門的自我督促層）

不分部門，這兩個身分隨時可召喚。**同一輪對話不要讓一個身分同時做兩件事。**

| 身分 | 角色 | 觸發 | 對應 agent |
|---|---|---|---|
| **指導者** | 教我怎麼做、提醒可用工具、拆下一步 | 日常對話問「下一步」 | `mentor` |
| **公正查核者** | 只問結果與落差，不給情緒安慰 | 每週固定提示詞啟動 | `auditor` |

啟動公正查核者：`/personal-studio 週查核` → 它讀本週 git log + 對照「下一步行動」與「履歷成果」，逐項回報「說到做到了嗎」。

---

## 4. 調度 skill：`personal-studio`

定義在 `.claude/skills/personal-studio/SKILL.md`。每接到任務照四步走：

1. **分流閘門** — 先判「工具」（重複／要算數／存資料 → 建檔）還是「框架」（一次性／主觀／即時對話 → 留對話）。
2. **派工** — 工具類丟給對應部門 agent；框架類留在對話陪練。
3. **排序** — 對照「下一步行動」提醒目前優先級（先用現有員工再招募）。
4. **觸發查核** — 週／月喚起公正查核者。

呼叫：`/personal-studio` 或直接描述任務讓它接手。

---

## 5. 我的兩個主要 GitHub 專案

### RE-DCF-Tool（評估部主力工具，✅ 已落地）
- https://github.com/jeremy0819/RE-DCF-Tool
- **Python + Streamlit**，部署在 Streamlit Community Cloud。
- **v3.1 現況**：四角色快覽（建管／建築師／地政士／開發商）、容積帳明細、坪效推導步驟、營造坪數基準可切換。
- 三案黃金測試全部 PASS（安和／龜山／中正）。

### jieceng-web（內容創作部官網）
- https://github.com/jeremy0819/jieceng-web
- **Nuxt 3 / Vue**，傑丞建設公司官網。

> ⚠️ 技術棧依專案而定（RE-DCF-Tool＝Streamlit／Python、jieceng-web＝Nuxt／Vue）。
> **沒有「單一 HTML」這種統一慣例。** 工具一律由 Claude 建置與維護，我只負責操作。

---

## 6. 我的學習路線（awesome-agentic-ai-zh）

- 路線 repo：https://github.com/jeremy0819/awesome-agentic-ai-zh
- **路線**：Track A（CLI Power User）+ Knowledge Worker 分支。

| 層級 | 描述 | 狀態 |
|---|---|---|
| Tier 0 | Claude.ai 網頁版 | ✅ 熟練 |
| Tier 1 | Claude Desktop + MCP | 🔄 學習中 |
| Tier 2 | Claude Code、workflow 自動化 | 🔄 使用中 |
| Tier 3 | 本地 LLM、自建 agent | ⏳ 未來 |

**Stage 進度**：Stage 0–3 實作中，Stage 4 以後待規劃。

---

## 7. 環境設定現況

- **OS**：Windows
- **已安裝**：Claude Code（網頁版 session）
- **Skills 位置**：`%USERPROFILE%\.claude\skills\`
- **待完成**：Claude Desktop、MCP 連接、Python 本機環境

---

## 8. 給 Claude 的工作原則

1. **以建築業業務為中心**：所有技術學習都要對應到實際工作場景。
2. **先用現有員工，再招募新員工**：不急著裝新工具，先把現有的用好。
3. **每完成一件事，幫我寫一條履歷句型**。
4. **步驟拆細**：不預設我知道指令怎麼用，給可照做的點擊／指令。
5. **工具用途要說清楚**：每個新 skill 要說它解決什麼具體問題。
6. **用語走台灣繁中**：資料（非數據）、元件（非組件）、函式（非函數）、回傳值（非返回值）。

---

## 9. 我的履歷成果（累積中）

- 「導入 AI 坪效分析工具（RE-DCF-Tool），將都更／危老前期評估自動化，
   通過安和／龜山／中正三案驗證，計算時間從數天縮短至即時。」

---

## 10. 下一步行動

1. ✅ RE-DCF-Tool v3.1 本機完成 → 待 push 到 GitHub
2. 📌 安裝 Claude Desktop（Tier 1 起點）
3. 📌 規劃「地主說明書自動生成」（文件部第一個落地案例）
4. 📌 研究 baoyu-translate skill 安裝方式
