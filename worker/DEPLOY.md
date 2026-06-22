# Cloudflare Worker 部署指南

## 這是什麼

把 Anthropic API Key 從使用者瀏覽器移到 Cloudflare Worker，  
讓所有訪客不需要填 API Key 就能使用 AI 分析功能。

## 你需要做的（一次性，約 10 分鐘）

### Step 1：建立 Cloudflare 帳號（免費）
前往 https://dash.cloudflare.com/sign-up 註冊。

### Step 2：安裝 Wrangler CLI
```bash
npm install -g wrangler
wrangler login   # 會開瀏覽器，登入 Cloudflare 帳號
```

### Step 3：部署 Worker
```bash
cd worker/
wrangler deploy
```
部署完成後會顯示你的 Worker URL，格式為：  
`https://financial-dashboard-proxy.你的帳號名.workers.dev`

### Step 4：設定 API Key（存在 Worker 環境，不會洩漏）
```bash
wrangler secret put ANTHROPIC_API_KEY
# 貼上你的 sk-ant-... key，按 Enter
```

### Step 5：修改 index.html

把這兩處的 URL 從 Anthropic 直連改成你的 Worker URL：

**位置 1**（個股 AI 分析，約第 860 行）：
```js
// 改前：
const res = await fetch('https://api.anthropic.com/v1/messages', {
  headers: { 'x-api-key': apiKey, 'anthropic-dangerous-direct-browser-access': 'true', ... }

// 改後（移除 x-api-key 和 dangerous-direct-browser-access）：
const res = await fetch('https://financial-dashboard-proxy.你的帳號名.workers.dev/v1/messages', {
  headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' }
```

**位置 2**（個人資產 AI 健診，約第 1230 行）：
同樣替換 URL 並移除 `x-api-key` header。

同時移除側欄的 API Key 輸入欄（index.html 第 53–59 行），因為不再需要。

### Step 6：推送
```bash
bash scripts/validate.sh
git add index.html
git commit -m "feat: 改用 Cloudflare Worker 代理，移除前端 API Key"
git push origin main
```

## 完成後的效果

| 改前 | 改後 |
|---|---|
| 使用者需要自己填 API Key | 所有人直接用 AI 分析，不需要任何設定 |
| API Key 在瀏覽器裡 | API Key 在 Cloudflare Worker 環境變數 |
| 只有填了 key 的人能用 AI | 網站公開，全功能可用 |

## 費用

Cloudflare Worker 免費方案：每天 10 萬次請求，足夠個人使用。  
Anthropic API 依使用量計費（claude-sonnet 約 $0.003/次分析）。

## 安全性說明

- Worker 只允許來自 `https://jeremy0819.github.io` 的請求（CORS 限制）
- 其他網域無法使用你的 Worker 代理
- API Key 永遠不會出現在前端程式碼或 git 歷史
