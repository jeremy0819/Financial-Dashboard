// ─── core.js ─────────────────────────────────────────────
// 核心工具模組：格式化函式、UI 工具、模式切換、localStorage 管理
// 依賴：全域 HTML 元素、TRACKS/TABS 常數（定義於 index.html）
// ─────────────────────────────────────────────────────────

// ─── CLOCK ───────────────────────────────────────────────
function pad(n){return String(n).padStart(2,'0')}
function tick(){
  const d=new Date();
  document.getElementById('cDate').textContent=`${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())}`;
  document.getElementById('cTime').textContent=`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
setInterval(tick,1000); tick();

// ─── TOAST 輕量通知（取代 alert）─────────────────────────
function toast(msg,type='info'){
  const colors={info:'bg-slate-800',success:'bg-emerald-600',warn:'bg-amber-500',error:'bg-rose-600'};
  const el=document.createElement('div');
  el.className=`${colors[type]||colors.info} text-white text-xs font-bold px-4 py-2.5 rounded-full shadow-lg fade-in`;
  el.textContent=msg;
  document.getElementById('toastBox').appendChild(el);
  setTimeout(()=>{ el.style.transition='opacity .3s'; el.style.opacity='0'; setTimeout(()=>el.remove(),300); },2600);
}

// ─── FORMAT HELPERS ──────────────────────────────────────
function fmtBig(v,unit){ // 數字 → 億 (TWD) 或 億美元
  const x=v/1e8;
  return x.toLocaleString('en-US',{maximumFractionDigits:0})+(unit||'億');
}
function fmtPct(v){ return v==null?'—':(v>=0?'+':'')+v.toFixed(1)+'%'; }
function daysAgo(n){ const d=new Date(); d.setDate(d.getDate()-n); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function fmtNum(n){ return Math.round(n).toLocaleString('zh-TW'); }

// ─── RENDER HELPERS ──────────────────────────────────────
function card(inner,extra=''){ return `<div class="bg-white border border-slate-200 rounded-xl p-4 transition-shadow hover:shadow-sm ${extra}">${inner}</div>`; }
function badge(label,type='info'){
  const map={info:'bg-blue-100 text-blue-800',success:'bg-emerald-100 text-emerald-800',danger:'bg-red-100 text-red-800',warning:'bg-amber-100 text-amber-800'};
  return `<span class="text-xs font-bold px-2.5 py-0.5 rounded-full ${map[type]||map.info}">${label}</span>`;
}
function metaRow(icon,label,val){
  return `<div class="flex gap-2.5 py-2 border-b border-slate-100 last:border-0"><span class="text-base mt-0.5">${icon}</span><div><p class="text-xs text-slate-400">${label}</p><p class="text-sm text-slate-800 font-medium">${val}</p></div></div>`;
}
function pct(v){ return v==null?'—':(v>=0?'+':'')+v.toFixed(1)+'%'; }
function fmtDate(s){ return s?s.slice(5):''; }                       // YYYY-MM-DD → MM-DD

// ─── V7.0 判斷來源標籤（三分流）───────────────────────────
function srcBadge(type, date){
  const cfg={
    framework:{icon:'🧠',label:'框架推論',bg:'bg-blue-100',tc:'text-blue-700',conf:'MED'},
    data:{icon:'📊',label:'即時數據',bg:'bg-sky-100',tc:'text-sky-700',conf:'HIGH'},
    ai:{icon:'🤖',label:'AI 生成',bg:'bg-purple-100',tc:'text-purple-700',conf:'MED'}
  };
  const c=cfg[type]||cfg.framework;
  const ds=date?` · ${fmtDate(date)}`:'';
  const confCls=c.conf==='HIGH'?'text-emerald-600':c.conf==='MED'?'text-amber-600':'text-slate-400';
  return `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded ${c.bg} ${c.tc} ml-1 inline-flex items-center gap-1 shrink-0">${c.icon} ${c.label}<span class="${confCls} font-mono text-[9px]">[${c.conf}]${ds}</span></span>`;
}
function dataBadge(date){ return srcBadge('data', date); }
function staticBadge(src){ return srcBadge(src==='ai'?'ai':'framework'); }

// 台股慣例 紅漲綠跌：正→紅(rose) 負→綠(emerald)
function upCls(v){ return v==null?'text-slate-800':v>0?'text-rose-600':v<0?'text-emerald-600':'text-slate-500'; }
function toneCls(t){ return t==='good'?'bg-emerald-50 border-emerald-200 text-emerald-700':t==='bad'?'bg-rose-50 border-rose-200 text-rose-700':'bg-amber-50 border-amber-200 text-amber-700'; }
function signalPill(s){ return s?`<div class="rounded-lg border p-2.5 ${toneCls(s.tone)}"><p class="text-xs font-bold">${s.label}</p><p class="text-[11px] opacity-80 mt-0.5">${s.note}</p></div>`:''; }

// ─── API HELPERS ─────────────────────────────────────────
function getApiHeaders(){
  if(PROXY_URL) return {'Content-Type':'application/json','anthropic-version':'2023-06-01'};
  const k=document.getElementById('apiKey')?.value.trim()||'';
  return {'Content-Type':'application/json','x-api-key':k,'anthropic-version':'2023-06-01','anthropic-dangerous-direct-browser-access':'true'};
}
function getApiEndpoint(){ return PROXY_URL?`${PROXY_URL}/v1/messages`:'https://api.anthropic.com/v1/messages'; }
function isAIReady(){
  if(PROXY_URL) return true;
  const k=document.getElementById('apiKey')?.value.trim()||'';
  return k.startsWith('sk-ant-')&&k.length>20;
}
function checkApiKey(){
  if(PROXY_URL) return;
  const k=document.getElementById('apiKey')?.value.trim()||'';
  const st=document.getElementById('apiStatus');
  if(!st) return;
  if(k.startsWith('sk-ant-')&&k.length>20){ st.textContent='質化分析：AI'; st.className='text-xs text-emerald-400 font-mono'; }
  else if(k.length>0){ st.textContent='金鑰格式錯誤'; st.className='text-xs text-red-400 font-mono'; }
  else { st.textContent='質化分析：DB'; st.className='text-xs text-slate-600 font-mono'; }
}
// proxy 模式啟動時，隱藏 key 輸入欄、顯示已啟用狀態
(function initProxyUI(){
  if(!PROXY_URL) return;
  document.addEventListener('DOMContentLoaded',()=>{
    const sec=document.getElementById('apiKeySection');
    if(sec) sec.innerHTML=`<div class="bg-emerald-900/30 border border-emerald-700 rounded-lg px-3 py-2 flex items-center gap-2">
      <span class="text-emerald-400 text-sm">✓</span>
      <div><p class="text-xs text-emerald-400 font-bold">AI 分析已啟用</p><p class="text-[10px] text-slate-500">雲端代理模式 · 免填 Key</p></div>
    </div>`;
  });
})();

// ─── UI STATE ────────────────────────────────────────────
function toggleSidebar(show){
  const sb=document.getElementById('sidebar'), bd=document.getElementById('backdrop');
  const open = show===undefined ? sb.classList.contains('-translate-x-full') : show;
  sb.classList.toggle('-translate-x-full',!open);
  bd.classList.toggle('hidden',!open);
}
function toggleDark(){
  const isDark=document.documentElement.classList.toggle('dark');
  try{ localStorage.setItem(DARK_KEY,isDark?'1':'0'); }catch(e){}
  toast(isDark?'🌙 暗黑模式已開啟':'☀️ 已切換回亮色模式','info');
}
function goalSave(v){ try{ localStorage.setItem(GOAL_KEY,v); }catch(e){ toast('儲存空間不足，目標設定未存入','warn'); } }
function uiSave(){ try{ localStorage.setItem(UI_KEY,JSON.stringify({mode:appMode,ticker:document.getElementById('inp').value})); }catch(e){} }
function uiRestore(){
  try{
    if(localStorage.getItem(DARK_KEY)==='1') document.documentElement.classList.add('dark');
    const u=JSON.parse(localStorage.getItem(UI_KEY)||'{}');
    if(u.ticker) document.getElementById('inp').value=u.ticker;
    const savedGoal=localStorage.getItem(GOAL_KEY)||'';
    const goalEl=document.getElementById('goalInp'); if(goalEl) goalEl.value=savedGoal;
    if(u.mode&&u.mode!=='stock') setMode(u.mode);
  }catch(e){}
}

// ─── QUICK RUN ───────────────────────────────────────────
function quickRun(t){ document.getElementById('inp').value=t; setMode('stock'); run(); }

// ─── PDF EXPORT ──────────────────────────────────────────
function exportPDF(){
  toast('準備列印 / PDF 匯出...','info');
  setTimeout(()=>window.print(),400);
}

// ─── PF LOAD/SAVE ────────────────────────────────────────
function pfLoad(){ try{ const s=localStorage.getItem(PF_KEY); PF=s?JSON.parse(s):{holdings:[],cash:0}; }catch(e){ PF={holdings:[],cash:0}; } if(!PF.holdings) PF.holdings=[]; if(PF.cash==null) PF.cash=0; }
function pfSave(){ try{ localStorage.setItem(PF_KEY,JSON.stringify(PF)); }catch(e){} }
function pfNorm(t){ t=(t||'').trim().toUpperCase(); if(/^\d{4,6}[A-Z]?$/.test(t)) t+='.TW'; return t; }

// ─── SET MODE ────────────────────────────────────────────
function setMode(m){
  if(appMode==='market'&&m!=='market'&&mktTimerId){ clearInterval(mktTimerId); mktTimerId=null; }
  appMode=m;
  uiSave();
  const mBtns={stock:'modeStock',portfolio:'modePortfolio',calc:'modeCalc',networth:'modeNetworth',market:'modeMarket',compare:'modeCompare'};
  Object.entries(mBtns).forEach(([k,id])=>{
    const el=document.getElementById(id); if(!el) return;
    el.className='text-xs font-bold py-1.5 rounded-md transition-colors '+(k===m?'bg-blue-600 text-white':'text-slate-400 hover:text-white');
  });
  const allPanels=['portfolio','calcPanel','networthPanel','marketPanel','comparePanel'];
  allPanels.forEach(id=>document.getElementById(id).classList.add('hidden'));
  document.getElementById('stockControls').classList.toggle('hidden', m!=='stock');
  if(m==='stock'){
    document.getElementById('welcome').classList.toggle('hidden', !!curData);
    document.getElementById('results').classList.toggle('hidden', !curData);
    document.getElementById('results').classList.toggle('flex', !!curData);
    if(!curData){ document.getElementById('hTitle').textContent='🏗️ AI 股票財務健檢系統 v9.0'; document.getElementById('hSub').textContent='輸入股票代號，抓取日收盤財報 + 六層次深度分析'; }
  } else {
    document.getElementById('welcome').classList.add('hidden');
    document.getElementById('results').classList.add('hidden'); document.getElementById('results').classList.remove('flex');
    if(m==='portfolio'){
      document.getElementById('portfolio').classList.remove('hidden');
      document.getElementById('hTitle').textContent='📁 個人資產分析 · 核心-衛星雙軌制';
      document.getElementById('hSub').textContent='資料只存本機瀏覽器 ｜ 報價來源 FinMind 日收盤';
      renderPortfolio();
    } else if(m==='calc'){
      document.getElementById('calcPanel').classList.remove('hidden');
      document.getElementById('hTitle').textContent='🧮 投資計算器';
      document.getElementById('hSub').textContent='複利試算・定存試算・定期定額試算';
      renderCalc();
    } else if(m==='networth'){
      document.getElementById('networthPanel').classList.remove('hidden');
      document.getElementById('hTitle').textContent='💰 淨資產追蹤';
      document.getElementById('hSub').textContent='每月快照 · 趨勢圖 · 配置健診 ｜ 資料只存本機';
      renderNetworth();
    } else if(m==='market'){
      document.getElementById('marketPanel').classList.remove('hidden');
      document.getElementById('hTitle').textContent='🌍 市場快報';
      document.getElementById('hSub').textContent='即時加密貨幣 · 外匯匯率 · 市場情緒';
      renderMarket();
    } else if(m==='compare'){
      document.getElementById('comparePanel').classList.remove('hidden');
      document.getElementById('hTitle').textContent='⚖️ 比較分析';
      document.getElementById('hSub').textContent='並排雷達圖 · 估值對比 · 指標差異';
      renderComparePanel();
    }
  }
  toggleSidebar(false);
}

// ─── TAB SWITCH ──────────────────────────────────────────
function switchTab(i){
  curTab=i;
  document.querySelectorAll('.tab-btn').forEach((b,j)=>{
    b.classList.toggle('border-blue-600',j===i);
    b.classList.toggle('text-blue-700',j===i);
    b.classList.toggle('border-transparent',j!==i);
    b.classList.toggle('text-slate-400',j!==i);
  });
  renderTabContent(curData,i);
}
