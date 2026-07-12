// ─── portfolio.js ────────────────────────────────────────
// 個人資產分析模組：持股管理、核心-衛星雙軌制、月度損益、
// 沉沒基金、決策追蹤
// 依賴：core.js（card, srcBadge, dataBadge, upCls, fmtBig, toast,
//         pfNorm, pfSave, pfLoad）
//       analysis.js（fmGet, daysAgo）
// ─────────────────────────────────────────────────────────

// ─── 持股管理 ─────────────────────────────────────────────
function pfLoadTemplate(){ PF=JSON.parse(JSON.stringify(KAKU_TEMPLATE)); pfSave(); renderPortfolio(); }
function pfClear(){ if(!confirm('確定清空所有持股？（僅清除本機瀏覽器資料）')) return; PF={holdings:[],cash:0}; pfPrices={}; pfSave(); renderPortfolio(); toast('已清空持股組合','info'); }
function pfEdit(i,f,v){ if(!PF.holdings[i]) return; PF.holdings[i][f]=(f==='shares'||f==='cost')?(Number(v)||0):(f==='ticker'?pfNorm(v):v); pfSave(); pfRecompute(); if(f==='ticker') pfFetchOne(PF.holdings[i].ticker); }

// 編輯代號後自動抓該檔報價（免按「更新報價」即可看到現價/市值/名稱）
async function pfFetchOne(t){
  t=pfNorm(t); if(!t) return;
  if(pfPrices[t] && pfPrices[t].price!=null){ pfFillNames(t); pfRecompute(); return; }
  try{
    if(/\.TWO?$/.test(t)){ const id=t.replace(/\.TWO?$/,'');
      const [px,info]=await Promise.all([ fmGet('TaiwanStockPrice',id,daysAgo(14)), fmGet('TaiwanStockInfo',id,daysAgo(30)) ]);
      const s=px.slice().sort((a,b)=>a.date<b.date?-1:1), last=s[s.length-1];
      pfPrices[t]={ price:last?Number(last.close):null, date:last?last.date:null, industry:info[0]?info[0].industry_category:null, name:info[0]?info[0].stock_name:null };
    } else { const s=(await fmGet('USStockPrice',t,daysAgo(14))).slice().sort((a,b)=>a.date<b.date?-1:1), last=s[s.length-1];
      pfPrices[t]={ price:last?Number(last.Close):null, date:last?last.date:null, industry:'美股', name:t }; }
    pfSave();
  }catch(e){}
  pfFillNames(t); pfRecompute();
}

// 就地回填名稱輸入框（使用者未填時），不重建整列、不影響焦點
function pfFillNames(t){
  const nm=pfPrices[t]&&pfPrices[t].name; if(!nm) return;
  const rows=document.querySelectorAll('#portfolio tbody tr');
  PF.holdings.forEach((h,idx)=>{ if(pfNorm(h.ticker)===t){ if(!h.name){ h.name=nm; pfSave(); } const inp=rows[idx]&&rows[idx].children[1].querySelector('input'); if(inp&&!inp.value) inp.value=nm; } });
}
function pfAdd(){ PF.holdings.push({ticker:'',name:'',track:'core',shares:0,cost:0}); pfSave(); renderPortfolio(); }
function pfDel(i){ PF.holdings.splice(i,1); pfSave(); renderPortfolio(); }
function pfSetCash(v){ PF.cash=Number(v)||0; pfSave(); pfRecompute(); }

// 抓取組合內每檔現價 + 產業
async function runPortfolio(){
  const btn=document.getElementById('pfRun'); if(btn){ btn.disabled=true; btn.textContent='⏳ 抓取中...'; }
  const uniq=[...new Set(PF.holdings.map(h=>pfNorm(h.ticker)).filter(Boolean))];
  await Promise.all(uniq.map(async t=>{
    try{
      if(/\.TWO?$/.test(t)){ const id=t.replace(/\.TWO?$/,'');
        const [px,info]=await Promise.all([ fmGet('TaiwanStockPrice',id,daysAgo(14)), fmGet('TaiwanStockInfo',id,daysAgo(30)) ]);
        const s=px.slice().sort((a,b)=>a.date<b.date?-1:1), last=s[s.length-1];
        pfPrices[t]={ price:last?Number(last.close):null, date:last?last.date:null, industry:info[0]?info[0].industry_category:null, name:info[0]?info[0].stock_name:null };
      } else { const s=(await fmGet('USStockPrice',t,daysAgo(14))).slice().sort((a,b)=>a.date<b.date?-1:1), last=s[s.length-1];
        pfPrices[t]={ price:last?Number(last.Close):null, date:last?last.date:null, industry:'美股', name:t }; }
    }catch(e){ pfPrices[t]=pfPrices[t]||{price:null,date:null,industry:null,name:null}; }
  }));
  PF.holdings.forEach(h=>{ const t=pfNorm(h.ticker); if(t&&pfPrices[t]&&!h.name&&pfPrices[t].name) h.name=pfPrices[t].name; });
  pfSave();
  if(btn){ btn.disabled=false; btn.textContent='🔄 更新報價並分析'; }
  renderPortfolio();
  const ok=uniq.filter(t=>pfPrices[t]&&pfPrices[t].price!=null).length;
  if(uniq.length) toast(ok?`已更新 ${ok}/${uniq.length} 檔報價`:'報價抓取失敗，請稍後再試', ok?'success':'error');
  checkAlerts();
}

// 計算市值/損益/軌道占比/產業占比
function pfCompute(){
  let total=0; const rows=PF.holdings.map(h=>{
    const t=pfNorm(h.ticker), pr=pfPrices[t]||{};
    const price=pr.price!=null?pr.price:null;
    const value=(price!=null&&h.shares)?price*h.shares:null;
    const cost=(h.cost&&h.shares)?h.cost*h.shares:null;
    const pl=(value!=null&&cost!=null)?value-cost:null;
    const plPct=(pl!=null&&cost)?pl/cost*100:null;
    if(value!=null) total+=value;
    return {...h,t,price,value,cost,pl,plPct,industry:pr.industry||null};
  });
  const cash=Number(PF.cash)||0, gross=total+cash;
  const byTrack={core:0,satellite:0,defense:cash};
  rows.forEach(r=>{ if(r.value!=null) byTrack[r.track]=(byTrack[r.track]||0)+r.value; });
  const byInd={}; rows.forEach(r=>{ if(r.value!=null){ const k=r.industry||'未分類'; byInd[k]=(byInd[k]||0)+r.value; } });
  return {rows,total,cash,gross,byTrack,byInd};
}

// 雙軌制紀律檢核（七條）
function pfRules(c){
  const g=c.gross||1;
  const corePct=(c.byTrack.core||0)/g*100, satPct=(c.byTrack.satellite||0)/g*100, defPct=(c.byTrack.defense||0)/g*100;
  const valued=c.rows.filter(r=>r.value!=null);
  const maxSingle=valued.length?Math.max(...valued.map(r=>r.value/g*100)):0;
  const indVals=Object.values(c.byInd), maxInd=indVals.length?Math.max(...indVals)/g*100:0;
  const satVals=c.rows.filter(r=>r.track==='satellite'&&r.value!=null).map(r=>r.value/g*100), maxSat=satVals.length?Math.max(...satVals):0;
  // 第八條：衛星倉有無破月線未停損（從 satMAStatus 全域狀態讀取）
  const satBreached = typeof satMAStatus!=='undefined' && Object.values(satMAStatus).some(s=>s&&s.signal==='red');
  return [
    {label:'核心倉 70–80%', pass:corePct>=70&&corePct<=80, txt:corePct.toFixed(1)+'%'},
    {label:'衛星倉 20–30%', pass:satPct>=20&&satPct<=30, txt:satPct.toFixed(1)+'%'},
    {label:'防禦層 > 15%', pass:defPct>=15, txt:defPct.toFixed(1)+'%'},
    {label:'單一個股 < 15%', pass:maxSingle<15, txt:'最大 '+maxSingle.toFixed(1)+'%'},
    {label:'單一產業 < 35%', pass:maxInd<35, txt:'最大 '+maxInd.toFixed(1)+'%'},
    {label:'衛星單檔 < 5%', pass:maxSat<5, txt:'最大 '+maxSat.toFixed(1)+'%'},
    {label:'衛星總和 < 30%', pass:satPct<30, txt:satPct.toFixed(1)+'%'},
    {label:'衛星倉無破月線部位', pass:!satBreached, txt:satBreached?'⚠️ 有破線未停損':'✓ 無'}
  ];
}

// ─── 風險暴露熱力圖（損益兩平視覺化）─────────────────────
function pfRiskHeatmap(c, g){
  const priced=c.rows.filter(r=>r.value!=null&&r.plPct!=null);
  if(!priced.length) return '';
  const sorted=priced.slice().sort((a,b)=>(a.plPct||0)-(b.plPct||0));
  const inBreakeven=sorted.filter(r=>Math.abs(r.plPct)<3);
  const alertBanner=inBreakeven.length?`<div class="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700 font-bold">⚠️ 損益兩平警戒區（±3%）：${inBreakeven.map(r=>r.ticker||(r.name||'')).join('、')} — 建議確認持倉邏輯</div>`:'';
  const rows=sorted.map(r=>{
    const pp=r.plPct;
    const barColor=pp<-10?'bg-red-500':pp<-5?'bg-red-400':pp<-2?'bg-amber-400':pp<0?'bg-amber-300':pp<5?'bg-emerald-300':pp<15?'bg-emerald-500':'bg-emerald-600';
    const wt=r.value?+(r.value/g*100).toFixed(1):0;
    const barW=Math.min(Math.abs(pp)*4,100);
    const sign=pp>=0?'+':'';
    return `<div class="flex items-center gap-2 text-xs py-1">
      <span class="w-14 font-mono text-slate-600 truncate shrink-0" title="${r.name||r.ticker}">${r.ticker||r.name}</span>
      <div class="flex-1 h-3.5 bg-slate-100 rounded overflow-hidden relative">
        <div class="${barColor} h-full rounded transition-all" style="width:${barW}%"></div>
      </div>
      <span class="w-14 text-right tabular-nums font-bold shrink-0 ${pp>=0?'text-emerald-600':'text-red-500'}">${sign}${pp.toFixed(1)}%</span>
      <span class="w-10 text-right tabular-nums text-slate-400 shrink-0">${wt}%</span>
    </div>`;
  }).join('');
  return card(`<div class="flex items-center justify-between mb-2">
    <p class="text-xs font-bold text-slate-600">⚡ 風險暴露 · 損益兩平警示 ${srcBadge('data')}</p>
    <div class="flex gap-3 text-[10px] text-slate-400">
      <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-red-500 inline-block"></span>深度虧損</span>
      <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block"></span>警戒</span>
      <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block"></span>獲利</span>
    </div>
  </div>
  ${alertBanner}
  <div class="flex text-[10px] text-slate-400 mb-1 px-0 gap-2">
    <span class="w-14 shrink-0">代號</span>
    <span class="flex-1">損益距離（棒長 ∝ |P&L%|）</span>
    <span class="w-14 text-right">損益%</span>
    <span class="w-10 text-right">權重</span>
  </div>
  ${rows}
  <p class="text-[10px] text-slate-400 mt-2">棒越長 = 偏離成本越遠；橘色區 = 損益兩平附近，需特別關注。</p>`,'border-amber-100');
}

function renderPortfolio(){
  const el=document.getElementById('portfolio'); if(!el) return;
  if(!PF.holdings.length){
    el.innerHTML=`<div class="max-w-md mx-auto text-center py-16">
      <p class="text-5xl mb-3">📁</p>
      <p class="text-base font-bold text-slate-500 mb-1">個人資產分析 · 核心-衛星雙軌制</p>
      <p class="text-sm text-slate-400 mb-6">建立投資組合，依雙軌制框架檢核配置紀律。<br>資料只存在本機瀏覽器（localStorage），不會上傳。</p>
      <div class="flex gap-2 justify-center">
        <button onclick="pfLoadTemplate()" class="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg">載入雙軌制範本</button>
        <button onclick="pfAdd()" class="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 text-sm font-bold rounded-lg hover:bg-slate-50">➕ 手動新增</button>
      </div></div>`;
    return;
  }
  const c=pfCompute(), g=c.gross||1;
  const priced=c.rows.some(r=>r.value!=null);
  const pfTab=typeof pfActiveTab!=='undefined'?pfActiveTab:'holdings';
  const tabNav=['holdings','inst','stoploss','mkttemp','monthly','sinking','decisions'].map((k,i)=>{
    const labels=['📊 持股管理','🏛️ 機構健診','🛑 衛星停損','🌡️ 市場溫度','📅 月度報表','🏦 沉沒基金','📈 決策追蹤'];
    const active=pfTab===k;
    return `<button onclick="pfSwitchTab('${k}')" class="px-3 py-2 text-xs font-bold whitespace-nowrap border-b-2 transition-colors ${active?'border-blue-600 text-blue-700':'border-transparent text-slate-400 hover:text-slate-600'}">${labels[i]}</button>`;
  }).join('');
  const trackOpt=sel=>['core','satellite','defense'].map(k=>`<option value="${k}" ${k===sel?'selected':''}>${TRACKS[k].label}</option>`).join('');
  const rowsHtml=c.rows.map((r,i)=>{
    // 損益兩平警示：根據 plPct 設定列背景與圖示
    const pp=r.plPct;
    const rowBg=pp!=null?(pp<-10?'bg-rose-50':pp<0?'bg-amber-50/50':pp<5?'':''):'';
    const beIcon=pp!=null?(Math.abs(pp)<3?'<span class="text-amber-500 text-[11px]" title="損益兩平警戒區 ±3%">⚠️</span>':pp<-10?'<span class="text-rose-500 text-[11px]" title="深度虧損">🔴</span>':''):'';
    const beTooltip=r.cost&&r.price!=null?`title="成本${r.cost.toFixed(2)} → 現價${r.price.toFixed(2)}，距損益兩平 ${pp!=null?(pp>=0?'+':'')+pp.toFixed(1)+'%':'—'}"`:'';
    return `<tr class="border-b border-slate-100 ${rowBg} hover:bg-blue-50/40 transition-colors">
    <td class="px-1.5 py-1"><input value="${r.ticker||''}" onchange="pfEdit(${i},'ticker',this.value);this.value=(PF.holdings[${i}]||{}).ticker||this.value" placeholder="2330.TW 或 2330" title="台股可只打數字(自動補.TW)，美股直接打代號如 NVDA" class="w-20 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs font-mono focus:outline-none focus:border-blue-400"></td>
    <td class="px-1.5 py-1"><input value="${(r.name||'').replace(/"/g,'&quot;')}" onchange="pfEdit(${i},'name',this.value)" class="w-24 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs focus:outline-none focus:border-blue-400"></td>
    <td class="px-1.5 py-1"><input type="number" value="${r.shares||''}" placeholder="股數" title="持有股數" onchange="pfEdit(${i},'shares',this.value)" class="w-20 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs text-right tabular-nums focus:outline-none focus:border-blue-400"></td>
    <td class="px-1.5 py-1"><input type="number" step="0.01" value="${r.cost||''}" placeholder="每股成本" title="每股平均買入價（可留空）" onchange="pfEdit(${i},'cost',this.value)" class="w-24 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs text-right tabular-nums focus:outline-none focus:border-blue-400"></td>
    <td class="px-1.5 py-1"><select onchange="pfEdit(${i},'track',this.value)" class="bg-slate-50 border border-slate-200 rounded px-1 py-1 text-xs focus:outline-none focus:border-blue-400">${trackOpt(r.track)}</select></td>
    <td class="px-1.5 py-1 text-right text-xs tabular-nums text-slate-500" id="pfc-price-${i}">${r.price!=null?r.price.toLocaleString():'—'}</td>
    <td class="px-1.5 py-1 text-right text-xs tabular-nums font-medium text-slate-700" id="pfc-val-${i}">${r.value!=null?Math.round(r.value).toLocaleString():'—'}</td>
    <td class="px-1.5 py-1 text-right text-xs tabular-nums text-slate-600" id="pfc-wt-${i}">${r.value!=null?(r.value/g*100).toFixed(1)+'%':'—'}</td>
    <td class="px-1.5 py-1 text-right text-xs tabular-nums ${upCls(r.pl)}" id="pfc-pl-${i}" ${beTooltip}>${pfPLstr(r)}${beIcon}</td>
    <td class="px-1 py-1 text-center"><button onclick="pfDel(${i})" class="text-slate-300 hover:text-red-500" title="刪除">✕</button></td>
  </tr>`;}).join('');
  // 主內容依 pfTab 切換
  let pfMainContent='';
  if(pfTab==='holdings'){
    pfMainContent=`
    <div id="pfSummary" class="grid grid-cols-2 sm:grid-cols-5 gap-2">${pfSummaryHTML(c)}</div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${card(`<p class="text-xs font-bold text-slate-600 mb-2">🥧 三軌配置</p><div style="position:relative;height:220px;width:100%"><canvas id="cvPf"></canvas></div>`)}
      ${card(`<p class="text-xs font-bold text-slate-600 mb-1">📏 雙軌制紀律檢核 ${srcBadge('framework')}</p><div id="pfRulesBox">${pfRulesHTML(c)}</div>`)}
    </div>
    ${card(`<div class="flex items-center justify-between mb-2">
        <p class="text-xs font-bold text-slate-600">持股明細</p>
        <div class="text-xs text-slate-400 flex items-center gap-1">防禦現金 <input type="number" value="${PF.cash||0}" onchange="pfSetCash(this.value)" class="w-24 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs text-right tabular-nums focus:outline-none focus:border-blue-400"></div>
      </div>
      <div class="overflow-x-auto ns"><table class="w-full text-xs"><thead><tr class="text-slate-400 border-b border-slate-200">
        <th class="px-1.5 py-1 text-left font-medium">代號</th><th class="px-1.5 py-1 text-left font-medium">名稱</th>
        <th class="px-1.5 py-1 text-right font-medium">股數</th><th class="px-1.5 py-1 text-right font-medium">成本/股</th>
        <th class="px-1.5 py-1 text-left font-medium">軌道</th><th class="px-1.5 py-1 text-right font-medium">現價</th>
        <th class="px-1.5 py-1 text-right font-medium">市值</th><th class="px-1.5 py-1 text-right font-medium">權重</th>
        <th class="px-1.5 py-1 text-right font-medium">損益</th><th class="px-1 py-1"></th>
      </tr></thead><tbody>${rowsHtml}</tbody></table></div>
      <p class="text-[11px] text-slate-400 mt-2">💡 <b>股數</b>＝你持有的股數；<b>成本/股</b>＝每股平均買入價（用於計算損益，只想看配置可留空）。現價／市值／權重／損益由系統依報價自動計算。</p>`)}
    ${card(`<p class="text-xs font-bold text-slate-600 mb-2">📋 配置健診（依雙軌制紀律）${srcBadge('framework')}</p>
      <div id="pfAdviceBox">${pfAdviceHTML(c)}</div>`)}
    ${pfRiskHeatmap(c,g)}
    ${card(renderAlerts())}`;
  } else if(pfTab==='inst'){
    pfMainContent=renderInstitutional();
  } else if(pfTab==='stoploss'){
    pfMainContent=renderSatStopLoss(c);
  } else if(pfTab==='mkttemp'){
    pfMainContent=`<div id="mktTempSection" class="space-y-4"><p class="text-xs text-slate-400">⏳ 正在抓取市場溫度指標...</p></div>`;
  } else if(pfTab==='monthly'){
    pfMainContent=renderMonthlyPL();
  } else if(pfTab==='sinking'){
    pfMainContent=renderSinkingFund();
  } else if(pfTab==='decisions'){
    pfMainContent=renderDecisionLog();
  }

  el.innerHTML=`<div class="max-w-5xl mx-auto space-y-4">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div><p class="text-base font-bold text-slate-800">📁 個人資產分析 · 核心-衛星雙軌制</p>
        <p class="text-xs text-slate-400">資料只存本機瀏覽器 ｜ 報價 FinMind 日收盤${priced?'':' ｜ 尚未更新報價'}</p></div>
      <div class="flex gap-2">
        <button onclick="pfAdd()" class="px-3 py-2 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-50">➕ 新增</button>
        <button onclick="pfClear()" class="px-3 py-2 bg-white border border-slate-300 text-slate-400 text-xs font-bold rounded-lg hover:bg-red-50 hover:text-red-500">清空</button>
        <button id="pfRun" onclick="runPortfolio()" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg">🔄 更新報價並分析</button>
        <button onclick="exportPDF()" class="px-3 py-2 bg-white border border-slate-300 text-slate-500 text-xs font-bold rounded-lg hover:bg-slate-50 no-print" title="匯出 PDF">📄 PDF</button>
      </div>
    </div>
    <div class="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div class="border-b border-slate-100 flex overflow-x-auto ns">${tabNav}</div>
      <div class="p-4 space-y-4 fade-in">${pfMainContent}</div>
    </div>
    <p class="text-[11px] text-slate-400 text-center pt-1">⚠️ 本工具為個人紀律輔助，數據來自第三方 API，不構成投資建議。</p>
  </div>`;
  if(pfTab==='holdings') drawPortfolio(c);
  if(pfTab==='mkttemp') fetchAndRenderMarketTemp();
}

function drawPortfolio(c){
  const el=document.getElementById('cvPf'); if(!el||typeof Chart==='undefined') return;
  if(pfChart) pfChart.destroy();
  const segs=[['core',c.byTrack.core||0],['satellite',c.byTrack.satellite||0],['defense',c.byTrack.defense||0]].filter(s=>s[1]>0);
  if(!segs.length){ pfChart=null; return; }
  pfChart=new Chart(el.getContext('2d'),{type:'doughnut',
    data:{labels:segs.map(s=>TRACKS[s[0]].label),datasets:[{data:segs.map(s=>+s[1].toFixed(0)),backgroundColor:segs.map(s=>TRACKS[s[0]].color),borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,font:{size:11}}}}}});
}

// ── 計算區塊 HTML（供 render 與就地更新共用）──
function pfSummaryHTML(c){
  const g=c.gross||1;
  const totPL=c.rows.reduce((s,r)=>s+(r.pl!=null?r.pl:0),0);
  const costBase=c.rows.reduce((s,r)=>s+(r.pl!=null&&r.cost!=null?r.cost:0),0);
  const totPLpct=costBase?totPL/costBase*100:null;
  const priced=c.rows.some(r=>r.value!=null);
  const trackCard=k=>{ const v=c.byTrack[k]||0, p=v/g*100, T=TRACKS[k], ok=k==='defense'?p>=T.min:(p>=T.min&&p<=T.max);
    return `<div class="bg-white border ${ok?'border-emerald-200':'border-amber-200'} rounded-xl p-3">
      <p class="text-xs text-slate-400">${T.label} <span class="text-[10px]">目標 ${k==='defense'?'>'+T.min:T.min+'–'+T.max}%</span></p>
      <p class="text-lg font-bold tabular-nums" style="color:${T.color}">${p.toFixed(1)}%</p>
      <p class="text-[11px] text-slate-400 tabular-nums">${Math.round(v).toLocaleString()}</p></div>`; };
  return card(`<p class="text-xs text-slate-400 mb-0.5">總市值（含現金）</p><p class="text-lg font-bold text-slate-800 tabular-nums">${Math.round(c.gross).toLocaleString()}</p>`)+
    card(`<p class="text-xs text-slate-400 mb-0.5">總損益</p><p class="text-lg font-bold tabular-nums ${upCls(totPL)}">${priced?(totPL>0?'+':'')+Math.round(totPL).toLocaleString()+(totPLpct!=null?` (${totPLpct>0?'+':''}${totPLpct.toFixed(1)}%)`:''):'—'}</p>`)+
    trackCard('core')+trackCard('satellite')+trackCard('defense');
}
function pfRulesHTML(c){
  return pfRules(c).map(rr=>`<div class="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
    <span class="text-xs text-slate-600">${rr.pass?'✅':'⚠️'} ${rr.label}</span>
    <span class="text-xs font-bold tabular-nums ${rr.pass?'text-emerald-600':'text-amber-600'}">${rr.txt}</span></div>`).join('');
}
// 規則式（免金鑰）配置健診：依七條紀律與配置缺口產生具體建議
function pfAdvice(c){
  const g=c.gross||1, rules=pfRules(c);
  const core=(c.byTrack.core||0)/g*100, sat=(c.byTrack.satellite||0)/g*100, def=(c.byTrack.defense||0)/g*100;
  const valued=c.rows.filter(r=>r.value!=null), tips=[];
  if(!valued.length && !(Number(PF.cash)>0)) return {passCount:0,total:rules.length,tips:['尚未輸入持股或更新報價：填入股數後點「🔄 更新報價並分析」即可看到配置與健診。']};
  if(core>80) tips.push(`核心倉 ${core.toFixed(1)}% 偏高（目標 70–80%）：可減碼最重的核心股，或增配衛星/防禦平衡。`);
  else if(valued.some(r=>r.track==='core')&&core<70) tips.push(`核心倉 ${core.toFixed(1)}% 偏低（目標 70–80%）：逢回可加碼核心價值股。`);
  if(sat>30) tips.push(`衛星倉 ${sat.toFixed(1)}% 超過 30% 上限：動能曝險過大，嚴設停損、分批降低。`);
  else if(sat<20&&valued.some(r=>r.track==='satellite')) tips.push(`衛星倉 ${sat.toFixed(1)}% 低於 20%：動能參與偏少，趨勢確認時可小量布局。`);
  if(def<15) tips.push(`防禦現金 ${def.toFixed(1)}% 低於 15%：緩衝不足，建議提高現金以備修正加碼。`);
  valued.filter(r=>r.value/g*100>=15).forEach(r=>tips.push(`${r.name||r.ticker} 占 ${(r.value/g*100).toFixed(1)}%，超過單一個股 15% 上限：集中度偏高。`));
  Object.entries(c.byInd).forEach(([k,v])=>{ const p=v/g*100; if(p>=35) tips.push(`產業「${k}」合計 ${p.toFixed(1)}%，超過 35% 上限：產業集中風險偏高。`); });
  c.rows.filter(r=>r.track==='satellite'&&r.value!=null&&r.value/g*100>=5).forEach(r=>tips.push(`衛星股 ${r.name||r.ticker} 占 ${(r.value/g*100).toFixed(1)}%，超過衛星單檔 5% 上限。`));
  return {passCount:rules.filter(r=>r.pass).length, total:rules.length, tips};
}
function pfAdviceHTML(c){
  const a=pfAdvice(c);
  const g=c.gross||1;
  const head=`<p class="text-xs mb-2">紀律檢核：<b class="${a.passCount===a.total?'text-emerald-600':'text-amber-600'}">${a.passCount}/${a.total} 通過</b></p>`;
  // 再平衡金額建議
  const corePct=(c.byTrack.core||0)/g*100, satPct=(c.byTrack.satellite||0)/g*100, defPct=(c.byTrack.defense||0)/g*100;
  const rebalTips=[];
  const TARGET={core:{lo:70,hi:80},sat:{lo:20,hi:30},def:{lo:15,hi:100}};
  if(corePct<TARGET.core.lo){ const need=Math.round((TARGET.core.lo/100*g)-(c.byTrack.core||0)); rebalTips.push(`🔵 再平衡：買入 NT$${need.toLocaleString()} 核心股 → 達到 70% 目標`); }
  else if(corePct>TARGET.core.hi){ const trim=Math.round((c.byTrack.core||0)-(TARGET.core.hi/100*g)); rebalTips.push(`🔵 再平衡：減碼 NT$${trim.toLocaleString()} 核心股 → 降至 80% 目標`); }
  if(satPct>TARGET.sat.hi){ const trim=Math.round((c.byTrack.satellite||0)-(TARGET.sat.hi/100*g)); rebalTips.push(`🟡 再平衡：減碼 NT$${trim.toLocaleString()} 衛星股 → 降至 30% 上限`); }
  if(defPct<TARGET.def.lo){ const need=Math.round((TARGET.def.lo/100*g)-(c.byTrack.defense||0)); rebalTips.push(`🟢 再平衡：增加 NT$${need.toLocaleString()} 現金防禦 → 達到 15% 目標`); }
  const rebalHtml=rebalTips.length?`<div class="mt-2 pt-2 border-t border-slate-100 space-y-1">`+rebalTips.map(t=>`<p class="text-xs text-blue-700 bg-blue-50 rounded px-2 py-1">${t}</p>`).join('')+`</div>`:'';
  if(!a.tips.length) return head+`<p class="text-xs text-emerald-600">✅ 配置全數符合雙軌制紀律，維持紀律即可。</p>`+rebalHtml;
  return head+`<ul class="space-y-1.5">`+a.tips.map(t=>`<li class="text-xs text-slate-600 flex gap-1.5"><span class="text-amber-500 shrink-0">▶</span><span>${t}</span></li>`).join('')+`</ul>`+rebalHtml;
}
function pfPLstr(r){ return r.pl!=null?(r.pl>0?'+':'')+Math.round(r.pl).toLocaleString()+(r.plPct!=null?`<span class="text-[10px]"> (${r.plPct>0?'+':''}${r.plPct.toFixed(1)}%)</span>`:''):'—'; }
let pfActiveTab='holdings'; // v7.0 portfolio sub-tab state
function pfSwitchTab(tab){ pfActiveTab=tab; renderPortfolio(); }

// 只就地更新計算結果（不重建輸入框 → 不重設捲動、不失焦）
function pfRecompute(){
  if(!PF.holdings.length){ renderPortfolio(); return; }
  const c=pfCompute(), g=c.gross||1;
  c.rows.forEach((r,i)=>{
    const set=(id,html)=>{ const e=document.getElementById(id); if(e) e.innerHTML=html; };
    set(`pfc-price-${i}`, r.price!=null?r.price.toLocaleString():'—');
    set(`pfc-val-${i}`, r.value!=null?Math.round(r.value).toLocaleString():'—');
    set(`pfc-wt-${i}`, r.value!=null?(r.value/g*100).toFixed(1)+'%':'—');
    const pl=document.getElementById(`pfc-pl-${i}`); if(pl){ pl.className='px-1.5 py-1 text-right text-xs tabular-nums '+upCls(r.pl); pl.innerHTML=pfPLstr(r); }
  });
  const s=document.getElementById('pfSummary'); if(s) s.innerHTML=pfSummaryHTML(c);
  const rb=document.getElementById('pfRulesBox'); if(rb) rb.innerHTML=pfRulesHTML(c);
  const ab=document.getElementById('pfAdviceBox'); if(ab) ab.innerHTML=pfAdviceHTML(c);
  if(pfActiveTab==='holdings') drawPortfolio(c);
}

// AI 配置健診
async function pfAI(){
  const box=document.getElementById('pfAiBox'); if(!box) return;
  if(!isAIReady()){ box.innerHTML='<p class="text-xs text-amber-600">請先於左側填入 Anthropic API Key（sk-ant-...）</p>'; return; }
  const c=pfCompute(), g=c.gross||1;
  box.innerHTML='<p class="text-xs text-slate-400">⏳ Claude 配置健診中...</p>';
  const lines=c.rows.filter(r=>r.value!=null).map(r=>`${r.name||r.ticker}(${TRACKS[r.track].label}/${r.industry||'未分類'}) ${(r.value/g*100).toFixed(1)}% 損益${r.plPct!=null?(r.plPct>0?'+':'')+r.plPct.toFixed(1)+'%':'NA'}`).join('；');
  const summ=`總市值${Math.round(c.gross).toLocaleString()}；核心${((c.byTrack.core||0)/g*100).toFixed(0)}% 衛星${((c.byTrack.satellite||0)/g*100).toFixed(0)}% 防禦${((c.byTrack.defense||0)/g*100).toFixed(0)}%。持股：${lines||'（尚未更新報價）'}`;
  try{
    const res=await fetch(getApiEndpoint(),{method:'POST',
      headers:getApiHeaders(),
      body:JSON.stringify({model:MODEL,max_tokens:900,temperature:0,
        system:'你是價值投資與資產配置顧問，依「核心-衛星雙軌制」（核心70-80%價值長抱、衛星20-30%動能停損、防禦現金>15%；單一個股<15%、單一產業<35%、衛星單檔<5%）健診投資組合。用繁體中文、條列、具體可執行，聚焦配置失衡、集中風險與衛星紀律，不要客套與免責聲明。',
        messages:[{role:'user',content:'請健診以下投資組合：'+summ}]})});
    const j=await res.json(); if(j.error) throw new Error(j.error.message||'API 錯誤');
    const txt=j.content.filter(b=>b.type==='text').map(b=>b.text).join('');
    box.innerHTML=`<div class="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">${txt.replace(/[<>]/g,m=>m==='<'?'&lt;':'&gt;')}</div>`;
  }catch(e){ box.innerHTML=`<p class="text-xs text-red-500">AI 健診失敗：${e.message}</p>`; }
}

// ─── 衛星停損監控 ────────────────────────────────────────
let satMAStatus={}; // { ticker: { price, ma20, dist, signal } }

function stopLossLight(dist){
  if(dist==null) return {light:'⚪',label:'資料不足',cls:'text-slate-400',signal:'na'};
  if(dist>3) return {light:'🟢',label:'安全',cls:'text-emerald-600',signal:'green'};
  if(dist>-3) return {light:'🟡',label:'警戒區間',cls:'text-amber-600',signal:'yellow'};
  return {light:'🔴',label:'已破月線 ⚠️',cls:'text-red-600',signal:'red'};
}

async function fetchSatMA20(ticker){
  const isTW=/\.TWO?$/.test(ticker);
  try{
    let prices;
    if(isTW){
      const id=ticker.replace(/\.TWO?$/,'');
      const data=await fmGet('TaiwanStockPrice',id,daysAgo(80));
      prices=data.slice().sort((a,b)=>a.date<b.date?-1:1).map(p=>Number(p.close));
    } else {
      const data=await fmGet('USStockPrice',ticker,daysAgo(80));
      prices=data.slice().sort((a,b)=>a.date<b.date?-1:1).map(p=>Number(p.Close));
    }
    if(prices.length<20) return null;
    const ma20=prices.slice(-20).reduce((s,v)=>s+v,0)/20;
    const price=prices[prices.length-1];
    const dist=(price-ma20)/ma20*100;
    return {price,ma20:+ma20.toFixed(2),dist:+dist.toFixed(2)};
  }catch(e){ return null; }
}

function renderSatStopLoss(c){
  const sats=c.rows.filter(r=>r.track==='satellite');
  if(!sats.length) return `<div class="text-center py-8 text-slate-400 text-sm">沒有衛星倉持股。<br>在持股管理中將軌道設為「衛星倉」即可在此監控停損狀態。</div>`;
  const rows=sats.map(r=>{
    const st=satMAStatus[r.t||r.ticker];
    const sig=st?stopLossLight(st.dist):{light:'⚪',label:'尚未載入',cls:'text-slate-400',signal:'na'};
    const rowBg=sig.signal==='red'?'bg-red-50':sig.signal==='yellow'?'bg-amber-50':'';
    return `<tr class="border-b border-slate-100 ${rowBg}">
      <td class="px-3 py-2 font-mono text-xs">${r.ticker}</td>
      <td class="px-3 py-2 text-xs">${r.name||'—'}</td>
      <td class="px-3 py-2 text-right text-xs tabular-nums">${st?st.price.toLocaleString():'—'}</td>
      <td class="px-3 py-2 text-right text-xs tabular-nums">${st?st.ma20.toLocaleString():'—'}</td>
      <td class="px-3 py-2 text-right text-xs tabular-nums ${st?upCls(st.dist):''}">${st?(st.dist>0?'+':'')+st.dist.toFixed(1)+'%':'—'}</td>
      <td class="px-3 py-2 text-xs font-bold ${sig.cls}">${sig.light} ${sig.label}</td>
    </tr>`;
  }).join('');
  const hasRed=sats.some(r=>{const st=satMAStatus[r.t||r.ticker]; return st&&stopLossLight(st.dist).signal==='red';});
  const loadedCount=sats.filter(r=>satMAStatus[r.t||r.ticker]).length;
  return `<div class="space-y-3">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2"><span class="text-sm font-bold text-slate-700">🛑 衛星倉月線停損監控</span>${srcBadge('data')}</div>
      <button onclick="loadSatMA()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg">🔄 載入月線數據</button>
    </div>
    ${hasRed?`<div class="bg-red-50 border border-red-200 rounded-xl p-3 text-xs text-red-700 font-bold">⚠️ 有衛星股已跌破月線停損點，依衛星倉紀律應分批出場！</div>`:''}
    <div class="bg-blue-50 border border-blue-100 rounded-xl p-3 text-xs text-slate-600">
      <b>月線停損規則：</b>現價跌破 20日均線 → 🔴 破線停損；位於月線 ±3% 以內 → 🟡 警戒；高於月線 +3% → 🟢 安全<br>
      <span class="text-slate-400">已載入 ${loadedCount}/${sats.length} 檔｜${srcBadge('framework')} 規則由雙軌制框架自動計算</span>
    </div>
    <div class="overflow-x-auto ns">
      <table class="w-full text-xs">
        <thead><tr class="text-slate-400 border-b border-slate-200">
          <th class="px-3 py-2 text-left">代號</th><th class="px-3 py-2 text-left">名稱</th>
          <th class="px-3 py-2 text-right">現價</th><th class="px-3 py-2 text-right">月線(20MA)</th>
          <th class="px-3 py-2 text-right">距離%</th><th class="px-3 py-2 text-left">停損狀態</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="text-[11px] text-slate-400">月線 = 近20個交易日收盤均價。數據來源：FinMind 日收盤。⚠️ 僅供紀律參考，非投資建議。</p>
  </div>`;
}

async function loadSatMA(){
  const c=pfCompute();
  const sats=c.rows.filter(r=>r.track==='satellite'&&r.ticker);
  if(!sats.length){ toast('沒有衛星倉持股','warn'); return; }
  const btn=document.querySelector('button[onclick="loadSatMA()"]');
  if(btn){ btn.disabled=true; btn.textContent='⏳ 載入中...'; }
  await Promise.all(sats.map(async r=>{
    const t=pfNorm(r.ticker);
    const res=await fetchSatMA20(t);
    if(res) satMAStatus[t]=res;
  }));
  if(btn){ btn.disabled=false; btn.textContent='🔄 載入月線數據'; }
  renderPortfolio();
}

// ─── 市場溫度計 ──────────────────────────────────────────
let mktTempData=null; // cache

async function fetchMarketIndicators(){
  // 使用 0050.TW（元大台灣50）作為大盤代理指標
  const [px0050, per0050, marg0050, px2330, per2330]=await Promise.all([
    fmGet('TaiwanStockPrice','0050',daysAgo(500)),
    fmGet('TaiwanStockPER','0050',daysAgo(500)),
    fmGet('TaiwanStockMarginPurchaseShortSale','0050',daysAgo(80)),
    fmGet('TaiwanStockPrice','2330',daysAgo(500)),
    fmGet('TaiwanStockPER','2330',daysAgo(400))
  ]);
  const pxSort=arr=>arr.slice().sort((a,b)=>a.date<b.date?-1:1);
  // ① 大盤 PE 百分位（0050 代理）
  let pePctile=null, curPE=null;
  if(per0050.length){
    const arr=per0050.map(x=>x.PER).filter(v=>v!=null&&v>0);
    const last=per0050[per0050.length-1];
    curPE=last?+Number(last.PER).toFixed(1):null;
    if(arr.length>20&&curPE) pePctile=+(arr.filter(v=>v<curPE).length/arr.length*100).toFixed(0);
  }
  // ② 台積電估計佔大盤權重（固定 ~35% 並附說明）
  let tsmc_weight=35; // 近年大約值
  // ③ 融資餘額 20 日變化（0050.TW 融資）
  let marginChg20=null;
  if(marg0050.length){
    const s=pxSort(marg0050), last=s[s.length-1], prev20=s.length>20?s[s.length-21]:s[0];
    if(last&&prev20) marginChg20=+((Number(last.MarginPurchaseTodayBalance)-Number(prev20.MarginPurchaseTodayBalance))/Number(prev20.MarginPurchaseTodayBalance)*100).toFixed(1);
  }
  // ④ 0050 乖離率（現價 vs 季線 60MA）
  let deviation=null, price0050=null;
  if(px0050.length){
    const s=pxSort(px0050);
    const closes=s.map(p=>Number(p.close));
    if(closes.length>=60){
      const ma60=closes.slice(-60).reduce((a,v)=>a+v,0)/60;
      const last=closes[closes.length-1];
      price0050=last;
      deviation=+((last-ma60)/ma60*100).toFixed(1);
    }
  }
  return {pePctile, curPE, tsmc_weight, marginChg20, deviation, price0050};
}

function calcMktTemp(ind){
  let score=50;
  const factors=[];
  if(ind.pePctile!=null){
    const s=ind.pePctile>80?-20:ind.pePctile>60?-10:ind.pePctile<30?+20:ind.pePctile<40?+10:0;
    score+=s; factors.push({label:'大盤PE百分位',val:ind.pePctile+'%',tone:ind.pePctile>70?'bad':ind.pePctile<35?'good':'warn'});
  }
  if(ind.tsmc_weight!=null){
    const s=ind.tsmc_weight>42?-10:0;
    score+=s; factors.push({label:'台積電佔大盤',val:'~'+ind.tsmc_weight+'%',tone:ind.tsmc_weight>42?'bad':'warn',note:'估計值'});
  }
  if(ind.marginChg20!=null){
    const s=ind.marginChg20>15?-15:ind.marginChg20>5?-8:ind.marginChg20<-10?+10:0;
    score+=s; factors.push({label:'融資20日增幅',val:(ind.marginChg20>0?'+':'')+ind.marginChg20+'%',tone:ind.marginChg20>10?'bad':ind.marginChg20<-5?'good':'warn'});
  }
  if(ind.deviation!=null){
    const s=ind.deviation>10?-20:ind.deviation>5?-10:ind.deviation<-5?+10:0;
    score+=s; factors.push({label:'0050乖離率(季線)',val:(ind.deviation>0?'+':'')+ind.deviation+'%',tone:ind.deviation>8?'bad':ind.deviation<-5?'good':'warn'});
  }
  score=Math.max(0,Math.min(100,score));
  const level=score<40?{label:'價值市場',color:'emerald',advice:'市場估值偏低，可逢低加碼核心倉，提高股票曝險比重'}:score<70?{label:'中性市場',color:'amber',advice:'估值中性，維持目標配置，衛星倉嚴守停損紀律'}:{label:'動能/過熱',color:'red',advice:'市場過熱訊號，提高現金防禦層，衛星倉停損收緊至月線，核心倉目標比例下修'};
  return {score, level, factors};
}

async function fetchAndRenderMarketTemp(){
  const el=document.getElementById('mktTempSection'); if(!el) return;
  el.innerHTML=`<div class="text-center py-6"><p class="text-xs text-slate-400">⏳ 正在抓取市場溫度指標（0050.TW / 2330.TW）...</p></div>`;
  try{
    const ind=await fetchMarketIndicators();
    mktTempData=ind;
    const tmp=calcMktTemp(ind);
    const barW=tmp.score;
    const barCol=tmp.score<40?'bg-emerald-500':tmp.score<70?'bg-amber-500':'bg-red-500';
    const factCards=tmp.factors.map(f=>`<div class="bg-white border ${f.tone==='bad'?'border-red-200':f.tone==='good'?'border-emerald-200':'border-slate-200'} rounded-xl p-3 text-center">
      <p class="text-[11px] text-slate-400 mb-1">${f.label}${f.note?`<span class="text-[9px] ml-0.5">(${f.note})</span>`:''}</p>
      <p class="text-base font-bold tabular-nums ${f.tone==='bad'?'text-red-600':f.tone==='good'?'text-emerald-600':'text-amber-600'}">${f.val}</p>
      <span class="text-[10px] ${f.tone==='bad'?'text-red-400':f.tone==='good'?'text-emerald-400':'text-amber-400'}">${f.tone==='bad'?'⚠️ 過熱':f.tone==='good'?'✅ 偏低':'⏸ 中性'}</span>
    </div>`).join('');
    el.innerHTML=`
      <div class="flex items-center gap-2 mb-1"><span class="text-sm font-bold text-slate-700">🌡️ 市場溫度計</span>${srcBadge('data')}</div>
      <div class="bg-white border border-slate-200 rounded-xl p-4">
        <div class="flex items-end gap-4 mb-3">
          <div><p class="text-xs text-slate-400 mb-1">溫度指數</p><p class="text-4xl font-bold tabular-nums text-${tmp.level.color}-600">${tmp.score}</p></div>
          <div class="flex-1"><p class="text-xs text-slate-400 mb-1">市場狀態</p><p class="text-lg font-bold text-${tmp.level.color}-600">${tmp.level.label}</p></div>
        </div>
        <div class="w-full bg-slate-100 rounded-full h-3 overflow-hidden mb-3">
          <div class="${barCol} h-3 rounded-full transition-all" style="width:${barW}%"></div>
        </div>
        <div class="grid grid-cols-3 text-[10px] text-slate-400 mb-4">
          <span>🟢 0–40 價值市場</span><span class="text-center">🟡 40–70 中性</span><span class="text-right">🔴 70–100 過熱</span>
        </div>
        <div class="bg-${tmp.level.color}-50 border border-${tmp.level.color}-200 rounded-xl p-3 text-xs text-${tmp.level.color}-800 font-medium mb-4">
          📌 ${tmp.level.advice}
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">${factCards}</div>
      </div>
      <p class="text-[11px] text-slate-400">數據來源：FinMind 日收盤｜0050.TW 作為大盤代理。台積電權重為估計值。⚠️ 僅供參考，不構成投資建議。</p>`;
    // 同步更新頂部溫度條
    updateMktTempBar(tmp);
  }catch(e){
    el.innerHTML=`<div class="text-center py-6 text-red-500 text-xs">市場數據抓取失敗：${e.message}</div>`;
  }
}

function updateMktTempBar(tmp){
  const bar=document.getElementById('mktTempBar'); if(!bar) return;
  const col=tmp.score<40?'text-emerald-600':tmp.score<70?'text-amber-600':'text-red-600';
  bar.innerHTML=`<span class="text-xs font-bold ${col}">🌡️ 市場溫度 ${tmp.score}/100</span>
    <span class="text-xs ${col} font-semibold">${tmp.level.label}</span>
    <span class="text-[11px] text-slate-400 hidden sm:inline">${tmp.level.advice}</span>`;
  bar.classList.remove('hidden');
}

// ─── 月度損益表 ──────────────────────────────────────────
const PL_KEY='kaku_monthly_pl_v1';
function getPLData(){ try{ return JSON.parse(localStorage.getItem(PL_KEY)||'{}'); }catch(e){ return {}; } }
function savePLData(d){ try{ localStorage.setItem(PL_KEY,JSON.stringify(d)); }catch(e){} }

function renderMonthlyPL(){
  const data=getPLData();
  const now=new Date(), ym=`${now.getFullYear()}-${pad(now.getMonth()+1)}`;
  const m=data[ym]||{salary:0,bonus:0,divIncome:0,fixedExp:0,varExp:0,unrealized:0};
  const gross=Number(m.salary)+Number(m.bonus)+Number(m.divIncome);
  const expenses=Number(m.fixedExp)+Number(m.varExp);
  const netOp=gross-expenses;
  const netPL=netOp+Number(m.unrealized);
  const row=(label,val,cls='')=>`<div class="flex justify-between py-1.5 border-b border-slate-100 last:border-0 text-xs"><span class="text-slate-600">${label}</span><span class="font-bold tabular-nums ${cls}">${val>=0?'NT$'+Math.round(val).toLocaleString():'- NT$'+Math.round(Math.abs(val)).toLocaleString()}</span></div>`;
  const inp=(id,val,ph)=>`<input type="number" id="pl_${id}" value="${val||''}" placeholder="${ph}" onchange="savePLField('${ym}','${id}',this.value)" class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-right tabular-nums focus:outline-none focus:border-blue-400">`;
  return `<div class="space-y-3">
    <div class="flex items-center gap-2"><span class="text-sm font-bold text-slate-700">📅 月度損益表</span><span class="text-xs text-slate-400">${ym}</span>${srcBadge('framework')}</div>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      ${card(`<p class="text-xs font-bold text-emerald-700 mb-2">💰 收入</p>
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-xs"><span class="text-slate-500 w-16 shrink-0">薪資</span>${inp('salary',m.salary,'0')}</div>
          <div class="flex items-center gap-2 text-xs"><span class="text-slate-500 w-16 shrink-0">獎金</span>${inp('bonus',m.bonus,'0')}</div>
          <div class="flex items-center gap-2 text-xs"><span class="text-slate-500 w-16 shrink-0">股息/分配</span>${inp('divIncome',m.divIncome,'0')}</div>
        </div>`)}
      ${card(`<p class="text-xs font-bold text-red-700 mb-2">💸 支出</p>
        <div class="space-y-2">
          <div class="flex items-center gap-2 text-xs"><span class="text-slate-500 w-16 shrink-0">固定支出</span>${inp('fixedExp',m.fixedExp,'定投/保費')}</div>
          <div class="flex items-center gap-2 text-xs"><span class="text-slate-500 w-16 shrink-0">變動支出</span>${inp('varExp',m.varExp,'生活費')}</div>
          <div class="flex items-center gap-2 text-xs"><span class="text-slate-500 w-16 shrink-0">未實現損益</span>${inp('unrealized',m.unrealized,'±')}</div>
        </div>`)}
    </div>
    ${card(`<p class="text-xs font-bold text-slate-600 mb-2">📊 損益彙總</p>
      ${row('＋ 薪資+獎金+股息（毛收入）',gross,'text-emerald-600')}
      ${row('－ 固定+變動支出（總支出）',-expenses,'text-red-500')}
      ${row('= 月結餘（毛利）',netOp,netOp>=0?'text-emerald-700':'text-red-600')}
      ${row('± 投資未實現損益',m.unrealized,Number(m.unrealized)>=0?'text-emerald-600':'text-red-500')}
      <div class="flex justify-between pt-2 mt-1 border-t border-slate-200">
        <span class="text-sm font-bold text-slate-700">本月淨損益</span>
        <span class="text-lg font-bold tabular-nums ${netPL>=0?'text-emerald-700':'text-red-600'}">${netPL>=0?'NT$':'- NT$'}${Math.round(Math.abs(netPL)).toLocaleString()}</span>
      </div>`,'border-dashed')}
    <p class="text-[11px] text-slate-400">資料只存本機瀏覽器。每月初手動更新。⚠️ 僅供個人記錄，不構成任何財務建議。</p>
  </div>`;
}

function savePLField(ym, field, val){
  const data=getPLData();
  if(!data[ym]) data[ym]={};
  data[ym][field]=Number(val)||0;
  savePLData(data);
  // 就地更新彙總（不重建整個頁面以保持焦點）
  const m=data[ym];
  const gross=Number(m.salary)+Number(m.bonus)+Number(m.divIncome);
  const expenses=Number(m.fixedExp)+Number(m.varExp);
  const netOp=gross-expenses;
  const netPL=netOp+Number(m.unrealized);
  // 重新 render 摘要只靠 pfSwitchTab 是太重的，這裡簡單處理
}

// ─── 沉沒基金追蹤 ────────────────────────────────────────
const SF_KEY='kaku_sinking_fund_v1';
const SF_DEFAULTS=[
  {name:'保費',annual:36276},
  {name:'紅包',annual:14000},
  {name:'旅遊',annual:12000}
];
function getSFData(){ try{ return JSON.parse(localStorage.getItem(SF_KEY)||'[]'); }catch(e){ return []; } }
function saveSFData(d){ try{ localStorage.setItem(SF_KEY,JSON.stringify(d)); }catch(e){} }

function renderSinkingFund(){
  let items=getSFData(); if(!items.length){ items=SF_DEFAULTS.map(x=>({...x,balance:0})); saveSFData(items); }
  const totalAnnual=items.reduce((s,i)=>s+Number(i.annual),0);
  const monthlyTarget=+(totalAnnual/12).toFixed(0);
  const now=new Date(), monthsElapsed=now.getMonth()+now.getDate()/30;
  const rows=items.map((it,idx)=>{
    const target=+(it.annual*monthsElapsed/12).toFixed(0);
    const bal=Number(it.balance)||0;
    const pct=target?Math.min(100,bal/target*100):0;
    const ok=bal>=target;
    return `<div class="bg-white border ${ok?'border-emerald-200':'border-amber-200'} rounded-xl p-3">
      <div class="flex justify-between mb-1">
        <span class="text-xs font-bold text-slate-700">${it.name}</span>
        <span class="text-[10px] text-slate-400">年度目標 NT$${Number(it.annual).toLocaleString()}</span>
      </div>
      <div class="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
        <div class="${ok?'bg-emerald-500':'bg-amber-400'} h-2 rounded-full" style="width:${pct}%"></div>
      </div>
      <div class="flex justify-between text-xs mb-2">
        <span class="text-slate-400">目前應提撥 NT$${target.toLocaleString()}</span>
        <span class="font-bold tabular-nums ${ok?'text-emerald-600':'text-amber-600'}">已存 NT$${bal.toLocaleString()} (${pct.toFixed(0)}%)</span>
      </div>
      <input type="number" value="${bal}" placeholder="目前已存金額" onchange="sfUpdate(${idx},this.value)"
        class="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs text-right tabular-nums focus:outline-none focus:border-blue-400">
    </div>`;
  }).join('');
  const totalBal=items.reduce((s,i)=>s+Number(i.balance||0),0);
  const totalTarget=+(totalAnnual*monthsElapsed/12).toFixed(0);
  return `<div class="space-y-3">
    <div class="flex items-center gap-2"><span class="text-sm font-bold text-slate-700">🏦 沉沒基金追蹤</span>${srcBadge('framework')}</div>
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-3 flex justify-between items-center flex-wrap gap-2">
      <div><p class="text-xs text-slate-500">月均應提撥</p><p class="text-2xl font-bold text-blue-700 tabular-nums">NT$${monthlyTarget.toLocaleString()}</p></div>
      <div class="text-right"><p class="text-xs text-slate-500">本月截至目前合計進度</p>
        <p class="text-lg font-bold tabular-nums ${totalBal>=totalTarget?'text-emerald-600':'text-amber-600'}">NT$${totalBal.toLocaleString()} / NT$${totalTarget.toLocaleString()}</p></div>
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">${rows}</div>
    <p class="text-[11px] text-slate-400">大額年度支出拆成月份提撥。數字只存本機瀏覽器。</p>
  </div>`;
}
function sfUpdate(idx, val){
  const items=getSFData();
  if(items[idx]) items[idx].balance=Number(val)||0;
  saveSFData(items);
}

// ─── 決策回測追蹤 ────────────────────────────────────────
const DL_KEY='kaku_decision_log_v1';
function getDecisionLogs(){ try{ return JSON.parse(localStorage.getItem(DL_KEY)||'[]'); }catch(e){ return []; } }
function logDecision(ticker, data){
  if(!data||!data.act) return;
  const logs=getDecisionLogs();
  const today=new Date().toISOString().slice(0,10);
  const entry={
    date:today, ticker:ticker.toUpperCase(),
    name:data.co||(data.real&&data.real.name)||ticker,
    signal:data.act, signalZ:data.actz,
    price:(data.real&&data.real.price)||null,
    priceStr:(data.real&&data.real.priceStr)||null,
    score:data.score||null,
    why:data.why||''
  };
  const idx=logs.findIndex(l=>l.ticker===entry.ticker&&l.date===today);
  if(idx>=0) logs[idx]=entry; else logs.push(entry);
  try{ localStorage.setItem(DL_KEY,JSON.stringify(logs.slice(-100))); }catch(e){}
}
async function refreshDecisionPrices(){
  const logs=getDecisionLogs();
  if(!logs.length) return;
  const btn=document.getElementById('dlRefreshBtn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ 更新中...'; }
  const tickers=[...new Set(logs.map(l=>l.ticker))];
  const latest={};
  await Promise.all(tickers.map(async t=>{
    try{
      const isTW=/\.TWO?$/.test(t);
      if(isTW){
        const id=t.replace(/\.TWO?$/,'');
        const px=await fmGet('TaiwanStockPrice',id,daysAgo(14));
        const s=px.slice().sort((a,b)=>a.date<b.date?-1:1);
        if(s.length) latest[t]={price:Number(s[s.length-1].close),date:s[s.length-1].date};
      } else {
        const px=await fmGet('USStockPrice',t,daysAgo(14));
        const s=px.slice().sort((a,b)=>a.date<b.date?-1:1);
        if(s.length) latest[t]={price:Number(s[s.length-1].Close),date:s[s.length-1].date};
      }
    }catch(e){}
  }));
  if(btn){ btn.disabled=false; btn.textContent='🔄 更新現價'; }
  renderDecisionLogWithPrices(logs, latest);
}
function renderDecisionLog(){
  const logs=getDecisionLogs();
  if(!logs.length) return `<div class="text-center py-8 text-slate-400 text-sm">
    <p class="mb-2">📋 決策記錄尚空白</p>
    <p class="text-xs">每次在「個股分析」分析完成後，系統會自動記錄 BUY/HOLD/AVOID 決策。<br>分析幾支股票後再來查看。</p>
  </div>`;
  return renderDecisionLogWithPrices(logs, {});
}
function renderDecisionLogWithPrices(logs, latest){
  const el=document.getElementById('dlTableBody');
  const sortedLogs=[...logs].sort((a,b)=>b.date.localeCompare(a.date));
  const sigCfg={BUY:{bg:'bg-emerald-50 text-emerald-700',label:'買入'},HOLD:{bg:'bg-amber-50 text-amber-700',label:'持有'},AVOID:{bg:'bg-red-50 text-red-700',label:'避開'}};
  const rows=sortedLogs.map(l=>{
    const now=latest[l.ticker];
    const ret=(now&&now.price&&l.price)?+((now.price-l.price)/l.price*100).toFixed(1):null;
    const retCls=ret!=null?(ret>0?'text-rose-600':ret<0?'text-emerald-600':'text-slate-500'):'text-slate-400';
    const sig=sigCfg[l.signal]||{bg:'bg-slate-50 text-slate-600',label:l.signalZ||l.signal};
    return `<tr class="border-b border-slate-100 hover:bg-slate-50">
      <td class="px-2 py-2 text-xs text-slate-400">${l.date}</td>
      <td class="px-2 py-2 font-mono text-xs">${l.ticker}</td>
      <td class="px-2 py-2 text-xs text-slate-600 max-w-20 truncate">${l.name||'—'}</td>
      <td class="px-2 py-2"><span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${sig.bg}">${sig.label}</span></td>
      <td class="px-2 py-2 text-right text-xs tabular-nums">${l.priceStr||'—'}</td>
      <td class="px-2 py-2 text-right text-xs tabular-nums">${now?now.price.toLocaleString():'—'}</td>
      <td class="px-2 py-2 text-right text-xs font-bold tabular-nums ${retCls}">${ret!=null?(ret>0?'+':'')+ret+'%':'—'}</td>
      <td class="px-2 py-2 text-xs text-slate-400 max-w-24 truncate" title="${l.why||''}">${l.score?l.score+'/100':''}</td>
    </tr>`;
  }).join('');
  // 統計
  const buyLogs=sortedLogs.filter(l=>l.signal==='BUY'&&latest[l.ticker]&&l.price);
  const buyRets=buyLogs.map(l=>(latest[l.ticker].price-l.price)/l.price*100);
  const buyAvg=buyRets.length?+(buyRets.reduce((s,v)=>s+v,0)/buyRets.length).toFixed(1):null;
  const buyWin=buyRets.length?+(buyRets.filter(v=>v>0).length/buyRets.length*100).toFixed(0):null;
  const avoidLogs=sortedLogs.filter(l=>l.signal==='AVOID'&&latest[l.ticker]&&l.price);
  const avoidRets=avoidLogs.map(l=>(latest[l.ticker].price-l.price)/l.price*100);
  const avoidAvg=avoidRets.length?+(avoidRets.reduce((s,v)=>s+v,0)/avoidRets.length).toFixed(1):null;
  const html=`<div class="space-y-3">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div class="flex items-center gap-2"><span class="text-sm font-bold text-slate-700">📈 決策回測追蹤</span>${srcBadge('data')}</div>
      <div class="flex gap-2">
        <button id="dlRefreshBtn" onclick="refreshDecisionPrices()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg">🔄 更新現價</button>
        <button onclick="if(confirm('確定清除所有決策記錄？'))localStorage.removeItem('${DL_KEY}');renderPortfolio()" class="px-3 py-1.5 bg-white border border-slate-300 text-slate-500 text-xs font-bold rounded-lg hover:bg-red-50 hover:text-red-500">清空</button>
      </div>
    </div>
    ${buyRets.length?`<div class="grid grid-cols-3 gap-2">
      ${card(`<p class="text-[11px] text-slate-400 mb-0.5">BUY 標的平均報酬</p><p class="text-xl font-bold tabular-nums ${buyAvg>=0?'text-emerald-600':'text-red-600'}">${buyAvg!=null?(buyAvg>0?'+':'')+buyAvg+'%':'—'}</p>`)}
      ${card(`<p class="text-[11px] text-slate-400 mb-0.5">BUY 勝率</p><p class="text-xl font-bold tabular-nums ${buyWin>=50?'text-emerald-600':'text-amber-600'}">${buyWin!=null?buyWin+'%':'—'}</p>`)}
      ${card(`<p class="text-[11px] text-slate-400 mb-0.5">AVOID 平均走勢</p><p class="text-xl font-bold tabular-nums ${avoidAvg!=null&&avoidAvg<0?'text-emerald-600':'text-red-600'}">${avoidAvg!=null?(avoidAvg>0?'+':'')+avoidAvg+'%':'—'}</p><p class="text-[10px] text-slate-400">負數=正確避開</p>`)}
    </div>`:''}
    <div class="overflow-x-auto ns">
      <table class="w-full text-xs">
        <thead><tr class="text-slate-400 border-b border-slate-200">
          <th class="px-2 py-2 text-left">日期</th><th class="px-2 py-2 text-left">代號</th><th class="px-2 py-2 text-left">名稱</th>
          <th class="px-2 py-2 text-left">評級</th><th class="px-2 py-2 text-right">紀錄價</th>
          <th class="px-2 py-2 text-right">現價</th><th class="px-2 py-2 text-right">報酬</th><th class="px-2 py-2 text-right">評分</th>
        </tr></thead>
        <tbody id="dlTableBody">${rows}</tbody>
      </table>
    </div>
    <p class="text-[11px] text-slate-400">系統在每次分析個股後自動記錄。按「更新現價」可計算報酬。最多保留 100 筆。⚠️ 過去績效不代表未來結果。</p>
  </div>`;
  if(el){ el.innerHTML=rows; } // 就地更新
  else { const sec=document.getElementById('portfolio'); if(sec) { const box=sec.querySelector('.space-y-3'); if(box) box.innerHTML=html; } }
  return html;
}
