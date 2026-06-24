// ─── market.js ───────────────────────────────────────────
// 市場快報（加密、外匯、恐懼貪婪指數）
// 依賴：core.js（toast）
// ─────────────────────────────────────────────────────────

let mktCache=null, mktCacheTs=0, mktTimerId=null;

function mktFetch(url){
  const ctrl=new AbortController();
  setTimeout(()=>ctrl.abort(),10000);
  return fetch(url,{signal:ctrl.signal}).then(r=>r.json());
}

async function fetchMktData(){
  if(mktCache&&Date.now()-mktCacheTs<60000) return mktCache;
  try{
    const [crypto,fx,fg]=await Promise.all([
      mktFetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,solana&vs_currencies=twd,usd&include_24hr_change=true'),
      mktFetch('https://open.er-api.com/v6/latest/USD'),
      mktFetch('https://api.alternative.me/fng/')
    ]);
    mktCache={crypto,fx,fg}; mktCacheTs=Date.now();
    return mktCache;
  }catch(e){ return null; }
}

async function renderMarket(){
  if(mktTimerId){ clearInterval(mktTimerId); mktTimerId=null; }
  const panel=document.getElementById('marketPanel');
  panel.innerHTML=`<div class="max-w-4xl mx-auto space-y-4 fade-in">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div><p class="text-lg font-bold text-slate-700">🌍 市場快報</p>
        <p class="text-xs text-slate-400 mt-0.5">即時加密報價 · 外匯匯率 · 市場情緒</p></div>
      <div class="flex items-center gap-3">
        <span class="text-[10px] text-slate-400">⏱ <span id="mktCountdown" class="font-mono font-bold text-slate-500">60s</span> 後自動刷新</span>
        <button onclick="mktCache=null;renderMarket()" class="text-xs px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors font-bold">🔄 立即刷新</button>
      </div>
    </div>
    <div id="mktBody" class="space-y-4">
      <div class="flex items-center justify-center h-40 text-slate-400">
        <div class="text-center"><p class="text-3xl mb-2">⏳</p><p class="text-sm">載入市場數據中…</p></div>
      </div>
    </div>
  </div>`;

  const data=await fetchMktData();
  const mktBody=document.getElementById('mktBody'); if(!mktBody) return;

  if(!data){
    mktBody.innerHTML=`<div class="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">⚠️ 無法連接 API（CoinGecko / Open Exchange Rates / Alternative.me）。請確認網路連線後點「刷新」。</div>`;
    return;
  }

  const {crypto,fx,fg}=data;
  const usdTwd=fx.rates?.TWD||32;
  const jpyTwd=fx.rates?(fx.rates.TWD/fx.rates.JPY):null;
  const eurUsd=fx.rates?(1/fx.rates.EUR):null;
  const btc=crypto.bitcoin||{};
  const eth=crypto.ethereum||{};
  const sol=crypto.solana||{};
  const fgVal=Number(fg.data?.[0]?.value)||50;
  const fgLabel=fg.data?.[0]?.value_classification||'Neutral';
  const fgIcon=fgVal<20?'😱':fgVal<40?'😨':fgVal<60?'😐':fgVal<80?'😊':'🤑';
  const fgColor=fgVal<25?'red':fgVal<45?'orange':fgVal<55?'yellow':fgVal<75?'green':'emerald';

  const chgCls=v=>v>0?'text-emerald-600 bg-emerald-50':v<0?'text-red-500 bg-red-50':'text-slate-400 bg-slate-50';
  const chgStr=v=>v!=null?(v>0?'▲ +':'▼ ')+Math.abs(v).toFixed(2)+'%':'—';

  const cryptoCards=[
    {name:'Bitcoin',sym:'BTC',icon:'₿',twd:btc.twd,usd:btc.usd,chg:btc.twd_24h_change,iconBg:'bg-amber-50 text-amber-600'},
    {name:'Ethereum',sym:'ETH',icon:'Ξ',twd:eth.twd,usd:eth.usd,chg:eth.twd_24h_change,iconBg:'bg-indigo-50 text-indigo-600'},
    {name:'Solana',sym:'SOL',icon:'◎',twd:sol.twd,usd:sol.usd,chg:sol.twd_24h_change,iconBg:'bg-purple-50 text-purple-600'},
  ].map(c=>`<div class="bg-white border border-slate-200 rounded-xl p-4 flex items-center gap-3 transition-shadow hover:shadow-sm">
    <div class="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold ${c.iconBg} shrink-0">${c.icon}</div>
    <div class="flex-1 min-w-0">
      <p class="text-[10px] text-slate-400">${c.name} <span class="font-mono">${c.sym}</span></p>
      <p class="text-sm font-bold tabular-nums text-slate-800">NT$${c.twd?Math.round(c.twd).toLocaleString():'—'}</p>
      <p class="text-[10px] text-slate-400">US$${c.usd?c.usd.toLocaleString():'—'}</p>
    </div>
    <span class="text-xs font-bold px-2 py-1 rounded-lg tabular-nums ${chgCls(c.chg)}">${chgStr(c.chg)}</span>
  </div>`).join('');

  const fxCards=[
    {label:'USD / TWD',val:usdTwd,prec:2},
    {label:'JPY / TWD',val:jpyTwd,prec:4},
    {label:'EUR / USD',val:eurUsd,prec:4},
    {label:'CNY / TWD',val:fx.rates?(fx.rates.TWD/fx.rates.CNY):null,prec:2},
  ].map(r=>`<div class="bg-white border border-slate-200 rounded-xl p-3">
    <p class="text-[10px] text-slate-400 mb-1">${r.label}</p>
    <p class="text-sm font-bold tabular-nums text-slate-700">${r.val?r.val.toFixed(r.prec):'—'}</p>
  </div>`).join('');

  mktBody.innerHTML=`
    <div>
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">加密貨幣 · 24h</p>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">${cryptoCards}</div>
    </div>
    <div>
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">外匯匯率（美元基準）</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">${fxCards}</div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div class="bg-white border border-slate-200 rounded-xl p-4">
        <p class="text-xs font-bold text-slate-600 mb-3">😨 加密貨幣恐懼貪婪指數</p>
        <div class="flex items-center gap-4 mb-3">
          <span class="text-4xl">${fgIcon}</span>
          <div>
            <p class="text-3xl font-bold tabular-nums text-${fgColor}-600">${fgVal}</p>
            <p class="text-xs text-slate-500">${fgLabel}</p>
          </div>
          <div class="ml-auto text-[10px] text-slate-400 text-right leading-5">
            <p>0 = 極度恐慌</p><p>50 = 中性</p><p>100 = 極度貪婪</p>
          </div>
        </div>
        <div class="w-full h-3 rounded-full overflow-hidden bg-gradient-to-r from-red-500 via-yellow-400 to-green-500 relative">
          <div class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-slate-600 rounded-full shadow" style="left:calc(${fgVal}% - 6px)"></div>
        </div>
        <div class="flex justify-between text-[10px] text-slate-400 mt-1"><span>恐慌</span><span>貪婪</span></div>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-4">
        <p class="text-xs font-bold text-slate-600 mb-3">📰 H2 2026 市場觀察</p>
        <div class="space-y-2 text-xs">
          <div class="flex gap-2 items-start"><span class="text-sm">🔵</span><span class="text-slate-500">Fed 降息週期中，美股成長股、科技股持續受惠</span></div>
          <div class="flex gap-2 items-start"><span class="text-sm">🟡</span><span class="text-slate-500">台股 AI 供應鏈估值偏高，注意 Q3 財報季波動</span></div>
          <div class="flex gap-2 items-start"><span class="text-sm">🟢</span><span class="text-slate-500">ETH 機構化加速（ETF 核准後），配置 5–7% 合理</span></div>
          <div class="flex gap-2 items-start"><span class="text-sm">🔴</span><span class="text-slate-500">台海地緣風險持續存在，為台股最大尾部風險</span></div>
          <div class="flex gap-2 items-start"><span class="text-sm">⚡</span><span class="text-slate-500">美元走弱趨勢下，持有 USD 資產需注意匯兌損失</span></div>
        </div>
      </div>
    </div>
    <p class="text-[11px] text-slate-400 text-center">數據來源：CoinGecko · Open Exchange Rates · Alternative.me ｜ 更新：<span id="mktFetchTime">${new Date().toLocaleTimeString('zh-TW')}</span> ⚠️ 僅供參考，非投資建議</p>`;
  // ── 60 秒自動刷新倒數 ──
  let mktSec=60;
  mktTimerId=setInterval(()=>{
    mktSec--;
    const cdEl=document.getElementById('mktCountdown'); if(cdEl) cdEl.textContent=mktSec+'s';
    if(mktSec<=0){ clearInterval(mktTimerId); mktTimerId=null; mktCache=null; renderMarket(); }
  },1000);
}
