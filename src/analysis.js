// ─── analysis.js ─────────────────────────────────────────
// 六層次分析模組：fetchReal, buildPrompt, renderResults,
// renderTabContent, tabHealth, tabValuation, tabGrowth,
// tabDebate, tabDecision, tabScenario
// 依賴：core.js（全域 FM, pad, fmtBig, daysAgo, card, srcBadge, dataBadge,
//         staticBadge, upCls, toneCls, signalPill, fmtDate, pct, badge,
//         metaRow, getApiEndpoint, getApiHeaders, toast）
// ─────────────────────────────────────────────────────────

// ─── FINMIND REAL-DATA LAYER ─────────────────────────────
async function fmGet(dataset,id,start){
  const ctrl=new AbortController();
  const timer=setTimeout(()=>ctrl.abort(),10000); // 10s 超時
  try{
    const r=await fetch(`${FM}?dataset=${dataset}&data_id=${encodeURIComponent(id)}&start_date=${start}`,{signal:ctrl.signal});
    clearTimeout(timer);
    const j=await r.json();
    return (j&&Array.isArray(j.data))?j.data:[];
  }catch(e){ clearTimeout(timer); return []; }
}
// 簡單移動平均：回傳與 arr 等長陣列，前 p-1 筆為 null
function sma(arr,p){
  return arr.map((_,i)=>{ if(i<p-1) return null; let s=0; for(let k=i-p+1;k<=i;k++) s+=arr[k]; return +(s/p).toFixed(2); });
}
// 日收盤 + 5條技術均線（5/10/月20/季60/半年120），只顯示最近約120個交易日
function buildTech(prices,closeKey){
  const sorted=prices.slice().sort((a,b)=>a.date<b.date?-1:1);
  const dates=sorted.map(p=>p.date);
  const close=sorted.map(p=>Number(p[closeKey]));
  const ma={5:sma(close,5),10:sma(close,10),20:sma(close,20),60:sma(close,60),120:sma(close,120)};
  const N=Math.min(120,close.length), s=close.length-N, sl=a=>a.slice(s);
  return { labels:dates.slice(s), close:sl(close), ma5:sl(ma[5]), ma10:sl(ma[10]), ma20:sl(ma[20]), ma60:sl(ma[60]), ma120:sl(ma[120]) };
}
// 由真實數據產生「即時數據訊號」（技術面/估值/營收/毛利），tone: good/warn/bad
function buildSignals(real){
  const s={}; const t=real.tech;
  if(t&&t.close.length){
    const n=t.close.length, last=t.close[n-1], lv=a=>a[n-1];
    const m5=lv(t.ma5),m20=lv(t.ma20),m60=lv(t.ma60),m120=lv(t.ma120);
    const bull=last>m5&&m5>m20&&m20>m60&&m60>m120, bear=last<m5&&m5<m20&&m20<m60&&m60<m120;
    s.tech={label:bull?'均線多頭排列':bear?'均線空頭排列':'區間盤整',tone:bull?'good':bear?'bad':'warn',
      note:(m60!=null?((last>=m60?'站上':'跌破')+'季線 '+m60.toFixed(0)):'資料不足')};
  }
  if(real.perPctile!=null&&real.per!=null){
    const p=real.perPctile;
    s.val={label:p<=30?'本益比相對偏低':p>=70?'本益比相對偏高':'本益比區間中段',tone:p<=30?'good':p>=70?'bad':'warn',
      note:'P/E '+real.per+'x ｜ 近一年第 '+Math.round(p)+' 百分位'};
  }
  if(real.revYoY!=null){
    s.rev={label:real.revYoY>=10?'營收動能強勁':real.revYoY>=0?'營收大致持平':'營收年減',tone:real.revYoY>=10?'good':real.revYoY>=0?'warn':'bad',
      note:'最新月營收年增 '+real.revYoY.toFixed(1)+'%'};
  }
  if(real.grossM!=null&&real.grossMPrev!=null){
    const d=real.grossM-real.grossMPrev;
    s.margin={label:d>=0.5?'毛利率改善':d<=-0.5?'毛利率下滑':'毛利率持平',tone:d>=0.5?'good':d<=-0.5?'bad':'warn',
      note:'毛利率 '+real.grossM.toFixed(1)+'%（季變動 '+(d>=0?'+':'')+d.toFixed(1)+'pt）'};
  }
  if(real.inst&&real.inst.fSum5!=null){
    const f=real.inst.fSum5;
    s.chip={label:f>0?'外資近5日買超':f<0?'外資近5日賣超':'外資近5日中性',tone:f>0?'good':f<0?'bad':'warn',
      note:'外資5日 '+(f>0?'+':'')+f.toLocaleString()+' 張 ｜ 最新日 '+(real.inst.fLast>0?'+':'')+real.inst.fLast.toLocaleString()+' 張'};
  }
  return s;
}

async function fetchReal(ticker){
  const isTW=/\.TWO?$/.test(ticker);
  const real={ isTW, market:isTW?'台股':'美股', revSeries:null, name:null, industry:null,
    price:null, priceStr:null, per:null, pbr:null, divYield:null,
    grossM:null, grossMPrev:null, opM:null, netM:null, eps:null, revYoY:null, tech:null,
    inst:null, margin:null, fcfReal:null, divHist:null, cashYield:null,
    asOf:null, priceDate:null, change:null, changePct:null, perPctile:null, perDate:null, revDate:null, finDate:null, signals:{} };

  if(isTW){
    const id=ticker.replace(/\.TWO?$/,'');
    const [px,per,rev,fin,inst,marg,cf,div,info]=await Promise.all([
      fmGet('TaiwanStockPrice',id,daysAgo(500)),
      fmGet('TaiwanStockPER',id,daysAgo(400)),
      fmGet('TaiwanStockMonthRevenue',id,daysAgo(420)),
      fmGet('TaiwanStockFinancialStatements',id,daysAgo(420)),
      fmGet('TaiwanStockInstitutionalInvestorsBuySell',id,daysAgo(80)),
      fmGet('TaiwanStockMarginPurchaseShortSale',id,daysAgo(80)),
      fmGet('TaiwanStockCashFlowsStatement',id,daysAgo(420)),
      fmGet('TaiwanStockDividend',id,daysAgo(1900)),
      fmGet('TaiwanStockInfo',id,daysAgo(30))
    ]);
    const pxs=px.slice().sort((a,b)=>a.date<b.date?-1:1);
    if(pxs.length){ const n=pxs.length,last=pxs[n-1]; real.price=Number(last.close); real.priceStr='NT$'+real.price.toLocaleString(); real.priceDate=last.date; real.asOf=last.date;
      if(n>1){ const prev=Number(pxs[n-2].close); real.change=real.price-prev; real.changePct=prev?real.change/prev*100:null; } }
    if(per.length){ const last=per[per.length-1]; const rnd=v=>v!=null?+Number(v).toFixed(2):null;
      real.per=rnd(last.PER); real.pbr=rnd(last.PBR); real.divYield=rnd(last.dividend_yield); real.perDate=last.date;
      const arr=per.map(x=>x.PER).filter(v=>v!=null&&v>0); if(arr.length>20){ real.perPctile=arr.filter(v=>v<real.per).length/arr.length*100; } }
    // 月營收趨勢 + 年增率
    if(rev.length){
      const sorted=rev.slice().sort((a,b)=>a.date<b.date?-1:1);
      const last12=sorted.slice(-12);
      real.revSeries={ labels:last12.map(r=>`${r.revenue_year}-${pad(r.revenue_month)}`), values:last12.map(r=>Number(r.revenue)/1e8) };
      const newest=sorted[sorted.length-1]; real.revDate=`${newest.revenue_year}-${pad(newest.revenue_month)}`;
      const yearAgo=sorted.find(r=>r.revenue_year===newest.revenue_year-1 && r.revenue_month===newest.revenue_month);
      if(yearAgo) real.revYoY=((newest.revenue-yearAgo.revenue)/yearAgo.revenue*100);
    }
    // 最新與前一期財報利潤率 + EPS
    if(fin.length){
      const byDate={};
      fin.forEach(r=>{ (byDate[r.date]=byDate[r.date]||{})[r.type]=Number(r.value); });
      const dates=Object.keys(byDate).sort();
      const gm=q=>(q&&q.Revenue&&q.GrossProfit!=null)?q.GrossProfit/q.Revenue*100:null;
      const q=byDate[dates[dates.length-1]], qp=dates.length>1?byDate[dates[dates.length-2]]:null;
      real.finDate=dates[dates.length-1];
      if(q&&q.Revenue){
        real.grossM=gm(q);
        if(q.OperatingIncome!=null) real.opM=q.OperatingIncome/q.Revenue*100;
        const net=q.IncomeAfterTaxes!=null?q.IncomeAfterTaxes:q.TotalConsolidatedProfitForThePeriod;
        if(net!=null) real.netM=net/q.Revenue*100;
      }
      real.grossMPrev=gm(qp);
      if(qp&&qp.Revenue){
        real.opMPrev=qp.OperatingIncome!=null?qp.OperatingIncome/qp.Revenue*100:null;
        const netp=qp.IncomeAfterTaxes!=null?qp.IncomeAfterTaxes:qp.TotalConsolidatedProfitForThePeriod;
        if(netp!=null) real.netMPrev=netp/qp.Revenue*100;
      }
      if(q&&q.EPS!=null) real.eps=q.EPS;
    }
    // 三大法人（外資/投信/自營）每日淨額（張＝股/1000）
    if(inst.length){
      const byD={};
      inst.forEach(r=>{ const d=byD[r.date]=byD[r.date]||{f:0,t:0,d:0}; const net=(Number(r.buy)-Number(r.sell))/1000;
        if(r.name==='Foreign_Investor') d.f+=net; else if(r.name==='Investment_Trust') d.t+=net; else d.d+=net; });
      const ds=Object.keys(byD).sort(), tail=ds.slice(-20), L=ds[ds.length-1];
      const fSum5=ds.slice(-5).reduce((s,d)=>s+byD[d].f,0);
      real.inst={ dates:tail, foreign:tail.map(d=>+byD[d].f.toFixed(0)), trust:tail.map(d=>+byD[d].t.toFixed(0)), dealer:tail.map(d=>+byD[d].d.toFixed(0)),
        lastDate:L, fLast:+byD[L].f.toFixed(0), tLast:+byD[L].t.toFixed(0), dLast:+byD[L].d.toFixed(0), fSum5:+fSum5.toFixed(0) };
    }
    // 融資融券餘額（張）
    if(marg.length){
      const s=marg.slice().sort((a,b)=>a.date<b.date?-1:1), last=s[s.length-1], prev=s.length>1?s[s.length-2]:null;
      real.margin={ date:last.date, mBal:Number(last.MarginPurchaseTodayBalance), sBal:Number(last.ShortSaleTodayBalance),
        mChg:prev?Number(last.MarginPurchaseTodayBalance)-Number(prev.MarginPurchaseTodayBalance):null };
    }
    // 真實自由現金流＝營業現金流＋資本支出(負值)；季報為當年累計
    if(cf.length){
      const byD={}; cf.forEach(r=>{ (byD[r.date]=byD[r.date]||{})[r.type]=Number(r.value); });
      const ds=Object.keys(byD).sort(), q=byD[ds[ds.length-1]];
      const ocf=q?(q.CashFlowsFromOperatingActivities!=null?q.CashFlowsFromOperatingActivities:q.NetCashInflowFromOperatingActivities):null;
      const capex=q&&q.PropertyAndPlantAndEquipment!=null?q.PropertyAndPlantAndEquipment:null;
      if(ocf!=null) real.fcfReal={ date:ds[ds.length-1], ocf, capex, fcf:capex!=null?ocf+capex:ocf };
    }
    // 股利：近年現金股利 + 近12月現金殖利率
    if(div.length){
      const recs=div.map(r=>({ ex:r.CashExDividendTradingDate||'', cash:Number(r.CashEarningsDistribution||0)+Number(r.CashStatutorySurplus||0) })).filter(r=>r.cash>0&&r.ex);
      const byY={}; recs.forEach(r=>{ const y=r.ex.slice(0,4); byY[y]=(byY[y]||0)+r.cash; });
      const years=Object.keys(byY).filter(y=>/^\d{4}$/.test(y)).sort();
      if(years.length) real.divHist=years.slice(-5).map(y=>({y,cash:+byY[y].toFixed(2)}));
      const cutoff=daysAgo(365), ttm=recs.filter(r=>r.ex>=cutoff).reduce((s,r)=>s+r.cash,0);
      if(real.price){ if(ttm>0) real.cashYield=+(ttm/real.price*100).toFixed(2);
        else if(real.divHist) real.cashYield=+(real.divHist[real.divHist.length-1].cash/real.price*100).toFixed(2); }
    }
    // 公司名稱 / 產業別
    if(info.length){ real.name=info[0].stock_name||null; real.industry=info[0].industry_category||null; }
    real.tech=pxs.length?buildTech(pxs,'close'):null;
  } else {
    const px=(await fmGet('USStockPrice',ticker,daysAgo(500))).slice().sort((a,b)=>a.date<b.date?-1:1);
    if(px.length){ const n=px.length,last=px[n-1]; real.price=Number(last.Close); real.priceStr='$'+real.price.toLocaleString(); real.priceDate=last.date; real.asOf=last.date;
      if(n>1){ const prev=Number(px[n-2].Close); real.change=real.price-prev; real.changePct=prev?real.change/prev*100:null; } }
    real.tech=px.length?buildTech(px,'Close'):null;
  }
  // 沒抓到任何價格 → 視為失敗
  if(real.price==null) return null;
  real.signals=buildSignals(real);
  return real;
}

// ─── V7.1 財報狗式三燈健診系統 ────────────────────────────
function diagCfg(level){
  return {good:{dot:'🟢',bg:'bg-emerald-50',border:'border-emerald-200',tc:'text-emerald-700',label:'健康'},
          warn:{dot:'🟡',bg:'bg-amber-50',  border:'border-amber-200',  tc:'text-amber-600', label:'警訊'},
          danger:{dot:'🔴',bg:'bg-red-50',  border:'border-red-200',    tc:'text-red-700',   label:'危險'}}[level]||{dot:'⚪',bg:'bg-slate-50',border:'border-slate-200',tc:'text-slate-400',label:'—'};
}
function diagRow(label,value,level,note=''){
  const c=diagCfg(level);
  return `<div class="flex items-center gap-2 py-2 border-b border-slate-100 last:border-0">
    <span class="text-base shrink-0 w-5">${c.dot}</span>
    <span class="flex-1 text-xs font-medium text-slate-700">${label}${note?`<span class="text-[10px] text-slate-400 ml-1">${note}</span>`:''}</span>
    <span class="text-xs font-bold tabular-nums ${c.tc} mr-1">${value}</span>
    <span class="text-[10px] px-1.5 py-0.5 rounded border font-bold ${c.bg} ${c.border} ${c.tc} shrink-0">${c.label}</span>
  </div>`;
}
// 四維健診：獲利性/安全性/成長性/籌碼，整合為一張摘要卡（仿財報狗）
function buildHealthDiag(d, real){
  const rows=[];
  // 獲利性
  if(real){
    const roe = real.per!=null && real.pbr!=null && real.per>0 ? +(real.pbr/real.per*100).toFixed(1) : null; // ROE≈(P/B)/(P/E)*100 approximation
    if(real.grossM!=null) rows.push(diagRow('毛利率',real.grossM.toFixed(1)+'%', real.grossM>=30?'good':real.grossM>=15?'warn':'danger','獲利性'));
    if(real.opM!=null)    rows.push(diagRow('營業利益率',real.opM.toFixed(1)+'%',  real.opM>=10?'good':real.opM>=0?'warn':'danger','獲利性'));
    if(real.netM!=null)   rows.push(diagRow('稅後淨利率',real.netM.toFixed(1)+'%', real.netM>=8?'good':real.netM>=0?'warn':'danger','獲利性'));
    // 安全性
    if(real.fcfReal){
      const fcfOk=real.fcfReal.fcf>0;
      rows.push(diagRow('自由現金流(FCF)',fmtBig(real.fcfReal.fcf)+'億', fcfOk?'good':'danger','安全性'));
    }
    if(real.per!=null && real.pbr!=null){
      const debtLevel = real.pbr>3?'warn':real.pbr>6?'danger':'good';
      rows.push(diagRow('P/B 股價淨值比', real.pbr+'x', real.pbr<2?'good':real.pbr<4?'warn':'danger','安全性'));
    }
    // 成長性
    if(real.revYoY!=null) rows.push(diagRow('月營收年增率',pct(real.revYoY), real.revYoY>=10?'good':real.revYoY>=0?'warn':'danger','成長性'));
    const tri=calcTripleRate(real);
    if(tri) rows.push(diagRow('三率趨勢 QoQ', tri.trend==='triple_up'?'三率全升↑':tri.trend==='double_up'?`${tri.rising}率上升↑`:tri.trend==='triple_down'?'三率全降↓':tri.trend==='double_down'?`${tri.falling}率下降↓`:'持平',
      tri.trend==='triple_up'?'good':tri.trend==='double_up'?'good':tri.trend==='triple_down'?'danger':tri.trend==='double_down'?'warn':'warn','成長性'));
    // 籌碼
    if(real.signals&&real.signals.chip) rows.push(diagRow('外資籌碼',real.signals.chip.label,real.signals.chip.tone==='good'?'good':real.signals.chip.tone==='bad'?'danger':'warn','籌碼'));
  } else {
    // 純DB模式：用策展分數
    const sc=d.score||60;
    rows.push(diagRow('整體財務評分',sc+' / 100', sc>=70?'good':sc>=50?'warn':'danger',''));
  }
  if(!rows.length) return '';
  return card(`<div class="flex items-center gap-2 mb-3"><span class="text-xs font-bold text-slate-700">🏥 財務健診摘要</span>${real?dataBadge(real.finDate||real.asOf):srcBadge('framework')}</div>${rows.join('')}`);
}
// 三率趨勢計算（季比季）
function calcTripleRate(real){
  if(!real) return null;
  const items=[
    {k:'gross',cur:real.grossM,prev:real.grossMPrev},
    {k:'op',   cur:real.opM,   prev:real.opMPrev},
    {k:'net',  cur:real.netM,  prev:real.netMPrev}
  ].map(x=>({...x, chg:(x.cur!=null&&x.prev!=null)?x.cur-x.prev:null})).filter(x=>x.chg!=null);
  if(!items.length) return null;
  const rising=items.filter(x=>x.chg>=0.1).length;
  const falling=items.filter(x=>x.chg<=-0.1).length;
  const trend=rising>=3?'triple_up':rising>=2?'double_up':falling>=3?'triple_down':falling>=2?'double_down':'flat';
  return {items,rising,falling,trend};
}
// DDM 股利折現模型（仿財報狗）
function calcDDM(real){
  if(!real||!real.divHist||real.divHist.length<2) return null;
  const h=real.divHist;
  const d0=h[0].cash, dN=h[h.length-1].cash;
  if(!d0||!dN||dN<=0) return null;
  const years=h.length-1;
  const g=years>0?Math.pow(dN/d0,1/years)-1:0;
  const gCapped=Math.min(Math.max(g,-0.02),0.07);
  const req=0.09; // 必要報酬率 9%
  if(req<=gCapped) return null;
  const D1=dN*(1+gCapped);
  const intrinsic=+(D1/(req-gCapped)).toFixed(1);
  return {intrinsic,g:+(gCapped*100).toFixed(1),req:+(req*100).toFixed(1),D1:+D1.toFixed(2),divNow:dN};
}

// ─── TAB CONTENTS ────────────────────────────────────────
function tabHealth(d){
  const sc=d.score||70;
  const barCol=sc>=70?'bg-emerald-500':sc>=50?'bg-amber-500':'bg-red-500';
  const scCol=sc>=70?'text-emerald-600':sc>=50?'text-amber-600':'text-red-600';
  const r=d.real, sg=r?r.signals:null;
  const noReal = r?'':`<div class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">⚠️ 即時數據抓取失敗（網路／代號／API 限流），以下為策展靜態觀點，數字可能過時。<button onclick="run()" class="ml-1 underline text-blue-600 font-bold">重試</button></div>`;

  // ── 三燈健診摘要（仿財報狗）──
  const healthDiagCard = buildHealthDiag(d, r);

  // ── 三率趨勢卡（財報狗特色：毛利/營業/淨利 QoQ）──
  const tri = r ? calcTripleRate(r) : null;
  const triCard = tri ? card(`
    <div class="flex items-center gap-2 mb-3">
      <span class="text-xs font-bold text-slate-700">📉 三率趨勢（季比季）</span>${dataBadge(r.finDate)}
    </div>
    <div class="grid grid-cols-3 gap-2">
      ${[{label:'毛利率',cur:tri.items.find(x=>x.k==='gross')},{label:'營業利益率',cur:tri.items.find(x=>x.k==='op')},{label:'稅後淨利率',cur:tri.items.find(x=>x.k==='net')}].map(({label,cur})=>{
        if(!cur) return `<div class="bg-slate-50 rounded-lg p-2 text-center"><p class="text-[10px] text-slate-400">${label}</p><p class="text-xs text-slate-400">—</p></div>`;
        const arrow=cur.chg>=0.1?'↑':cur.chg<=-0.1?'↓':'→';
        const cls=cur.chg>=0.1?'text-emerald-600 font-bold':cur.chg<=-0.1?'text-rose-600 font-bold':'text-slate-500';
        return `<div class="bg-slate-50 rounded-lg p-2 text-center">
          <p class="text-[10px] text-slate-400 mb-0.5">${label}</p>
          <p class="text-sm font-bold tabular-nums text-slate-800">${cur.cur.toFixed(1)}%</p>
          <p class="text-xs ${cls}">${arrow} ${(cur.chg>=0?'+':'')+cur.chg.toFixed(1)}pt</p>
        </div>`;
      }).join('')}
    </div>
    <p class="text-[11px] text-slate-400 mt-2">
      ${tri.trend==='triple_up'?'🟢 三率全部上升，獲利品質改善中':tri.trend==='double_up'?`🟡 ${tri.rising} 率上升，趨勢偏正`:tri.trend==='triple_down'?'🔴 三率全部下滑，獲利惡化警訊':tri.trend==='double_down'?`🟡 ${tri.falling} 率下滑，需觀察`:'→ 三率大致持平，無明顯趨勢'}
    </p>`) : '';

  const sigCard = (sg&&(sg.tech||sg.val||sg.rev||sg.margin||sg.chip)) ? card(`<div class="flex items-center gap-2 mb-2"><span class="text-xs font-bold text-slate-600">📡 即時數據訊號</span>${dataBadge(r.asOf)}</div><div class="grid grid-cols-1 sm:grid-cols-2 gap-2">${signalPill(sg.tech)}${signalPill(sg.val)}${signalPill(sg.rev)}${signalPill(sg.margin)}${signalPill(sg.chip)}</div>`) : '';
  const radarCard = card(`<p class="text-xs font-bold text-slate-600 mb-2">🕸️ 六維評分雷達圖</p><div style="position:relative;height:280px;width:100%"><canvas id="cvRadar"></canvas></div>`);
  const chartCard = (r&&r.tech) ? card(`<p class="text-xs font-bold text-slate-600 mb-2">📈 技術均線圖（日收盤 + 5/10/月/季/半年線）${dataBadge(r.priceDate)}</p><div style="position:relative;height:300px;width:100%"><canvas id="cvTech"></canvas></div>`) : '';
  const revCard = (r&&r.revSeries) ? card(`<p class="text-xs font-bold text-slate-600 mb-2">🏭 近12月營收（億）${dataBadge(r.revDate)}</p><div style="position:relative;height:170px;width:100%"><canvas id="cvRev"></canvas></div>`) : '';
  const chipCard = (r&&(r.inst||r.margin)) ? card(`<div class="flex items-center gap-2 mb-2"><span class="text-xs font-bold text-slate-600">📊 籌碼面（三大法人買賣超／融資融券）</span>${r.inst?dataBadge(r.inst.lastDate):(r.margin?dataBadge(r.margin.date):'')}</div>`+
    (r.inst?`<div class="grid grid-cols-3 gap-2 mb-2">
      <div class="bg-slate-50 rounded-lg p-2 text-center"><p class="text-[11px] text-slate-400">外資</p><p class="text-sm font-bold tabular-nums ${upCls(r.inst.fLast)}">${r.inst.fLast>0?'+':''}${r.inst.fLast.toLocaleString()} 張</p></div>
      <div class="bg-slate-50 rounded-lg p-2 text-center"><p class="text-[11px] text-slate-400">投信</p><p class="text-sm font-bold tabular-nums ${upCls(r.inst.tLast)}">${r.inst.tLast>0?'+':''}${r.inst.tLast.toLocaleString()} 張</p></div>
      <div class="bg-slate-50 rounded-lg p-2 text-center"><p class="text-[11px] text-slate-400">自營</p><p class="text-sm font-bold tabular-nums ${upCls(r.inst.dLast)}">${r.inst.dLast>0?'+':''}${r.inst.dLast.toLocaleString()} 張</p></div>
    </div>`:'')+
    (r.margin?`<div class="grid grid-cols-2 gap-2 text-xs mb-2">
      <div class="bg-slate-50 rounded-lg p-2"><span class="text-slate-400">融資餘額 </span><b class="tabular-nums">${r.margin.mBal.toLocaleString()} 張</b>${r.margin.mChg!=null?` <span class="${upCls(r.margin.mChg)} tabular-nums">(${r.margin.mChg>0?'+':''}${r.margin.mChg.toLocaleString()})</span>`:''}</div>
      <div class="bg-slate-50 rounded-lg p-2"><span class="text-slate-400">融券餘額 </span><b class="tabular-nums">${r.margin.sBal.toLocaleString()} 張</b></div>
    </div>`:'')+
    (r.inst?`<div style="position:relative;height:170px;width:100%"><canvas id="cvInst"></canvas></div>`:'')) : '';
  const fcfStr = (r&&r.fcfReal) ? `${fmtBig(r.fcfReal.fcf)}<span class="text-[10px] text-slate-400 ml-1">（營業現金流 ${fmtBig(r.fcfReal.ocf)}${r.fcfReal.capex!=null?' − 資本支出 '+fmtBig(Math.abs(r.fcfReal.capex)):''}，${fmtDate(r.fcfReal.date)} 當年累計）</span>` : d.fcf;
  return `<div class="max-w-3xl space-y-3">
    ${noReal}
    ${healthDiagCard}
    ${triCard}
    ${sigCard}
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">${radarCard}${chartCard||'<div></div>'}</div>
    ${revCard}
    ${chipCard}
    <div class="flex items-center gap-2 flex-wrap pt-1">
      <span class="text-sm font-bold text-slate-700">策展觀點摘要</span>${srcBadge('framework')}
    </div>
    ${card(`
      <div class="flex justify-between items-center mb-2">
        <span class="text-xs text-slate-500">整體財務評分</span>
        <span class="text-xl font-bold ${scCol} tabular-nums">${sc} / 100</span>
      </div>
      <div class="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
        <div class="${barCol} h-2.5 rounded-full" style="width:${sc}%"></div>
      </div>
      <p class="text-xs text-slate-500 mt-3 bg-slate-50 rounded-lg p-2.5">${d.hsum}</p>
    `,'border-dashed')}
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
      ${card(metaRow('📈','5年營收趨勢',d.rev)+metaRow('💰','淨利趨勢',d.ni),'border-dashed')}
      ${card(metaRow('💵','自由現金流',fcfStr)+metaRow('📉','利潤率趨勢',d.margin),'border-dashed')}
    </div>
    ${card(metaRow('🏦','債務水平',d.debt),'border-dashed')}
  </div>`;
}

function tabValuation(d){
  const r=d.real;
  const curShow = r&&r.priceStr ? r.priceStr : d.cur;
  const realBlock = r ? `<div class="flex items-center gap-2 mb-1"><span class="text-sm font-bold text-slate-700">即時估值指標</span>${dataBadge(r.perDate||r.asOf)}</div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      ${card(`<p class="text-xs text-slate-400 mb-1">本益比 P/E</p><p class="text-xl font-bold text-slate-800 tabular-nums">${r.per!=null?r.per+'x':'—'}</p>`)}
      ${card(`<p class="text-xs text-slate-400 mb-1">股價淨值比 P/B</p><p class="text-xl font-bold text-slate-800 tabular-nums">${r.pbr!=null?r.pbr+'x':'—'}</p>`)}
      ${card(`<p class="text-xs text-slate-400 mb-1">現金殖利率</p><p class="text-xl font-bold text-slate-800 tabular-nums">${r.divYield!=null?r.divYield+'%':'—'}</p>`)}
      ${card(`<p class="text-xs text-slate-400 mb-1">P/E 一年百分位</p><p class="text-xl font-bold text-slate-800 tabular-nums">${r.perPctile!=null?Math.round(r.perPctile)+'%':'—'}</p>`)}
    </div>
    ${r.signals&&r.signals.val?signalPill(r.signals.val):''}` : '';
  const gap = (r&&r.price!=null) ? `<p class="text-xs text-amber-700 bg-amber-50 rounded-lg p-2 mt-2">⚠️ 此 DCF／結論為靜態策展數據，與最新收盤 ${r.priceStr} 可能落差大，僅供質化參考。</p>` : '';
  const divBlock = (r&&(r.cashYield!=null||r.divHist)) ? `<div class="flex items-center gap-2 mt-2 mb-1"><span class="text-sm font-bold text-slate-700">💵 股利政策</span>${dataBadge(r.asOf)}</div>
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
      ${card(`<p class="text-xs text-slate-400 mb-1">現金殖利率(近12月)</p><p class="text-xl font-bold text-emerald-600 tabular-nums">${r.cashYield!=null?r.cashYield+'%':'—'}</p>`)}
      ${r.divHist?r.divHist.slice(-3).reverse().map(h=>card(`<p class="text-xs text-slate-400 mb-1">${h.y} 現金股利</p><p class="text-lg font-bold text-slate-800 tabular-nums">${h.cash}</p>`)).join(''):''}
    </div>` : '';
  // DDM 股利折現估值
  const ddm = r ? calcDDM(r) : null;
  const ddmBlock = ddm ? card(`
    <div class="flex items-center gap-2 mb-3"><span class="text-xs font-bold text-slate-700">🧮 DDM 股利折現估值</span>${srcBadge('data')}
      <span class="text-[10px] text-slate-400 ml-auto">必要報酬率 ${ddm.req}%，股利成長率 ${ddm.g}%</span>
    </div>
    <div class="flex items-center gap-6 flex-wrap">
      <div><p class="text-xs text-slate-400 mb-0.5">DDM 合理股價</p>
        <p class="text-2xl font-bold text-purple-700 tabular-nums">${r.isTW?'NT$':'$'}${ddm.intrinsic.toLocaleString()}</p></div>
      <span class="text-lg text-slate-300">vs</span>
      <div><p class="text-xs text-slate-400 mb-0.5">目前股價</p>
        <p class="text-2xl font-bold tabular-nums ${r.price<ddm.intrinsic?'text-emerald-600':'text-rose-500'}">${r.priceStr||'—'}</p></div>
      <div class="ml-auto ${r.price<ddm.intrinsic?'bg-emerald-50 border-emerald-200 text-emerald-700':'bg-rose-50 border-rose-200 text-rose-700'} border rounded-xl px-4 py-2 text-center">
        <p class="text-[10px] font-bold">${r.price<ddm.intrinsic?'低於合理價':'高於合理價'}</p>
        <p class="text-base font-bold tabular-nums">${r.price&&ddm.intrinsic?((r.price/ddm.intrinsic-1)*100>0?'+':'')+((r.price/ddm.intrinsic-1)*100).toFixed(1)+'%':'—'}</p>
      </div>
    </div>
    <p class="text-[11px] text-slate-400 mt-2">基於近 ${r.divHist.length} 年股利歷史，D₁=${r.isTW?'NT$':'$'}${ddm.D1}，僅適用穩定配息個股。</p>
  `) : '';
  return `<div class="max-w-2xl space-y-3">
    ${realBlock}
    ${divBlock}
    ${ddmBlock}
    <div class="flex items-center gap-2 flex-wrap pt-1"><span class="text-sm font-bold text-slate-700">估值觀點</span>${srcBadge('framework')}</div>
    <div class="grid grid-cols-2 gap-2">
      ${card(`<p class="text-xs text-slate-400 mb-1">同業平均 P/E</p><p class="text-lg font-bold text-slate-800">${d.ipe}</p>`,'border-dashed')}
      ${card(`<p class="text-xs text-slate-400 mb-1">策展估值結論</p><p class="text-lg font-bold text-${d.verd==='U'?'emerald':d.verd==='O'?'rose':'amber'}-600">${d.verdz}</p>`,'border-dashed')}
    </div>
    ${card(`
      <p class="text-xs font-bold text-slate-600 mb-3">💡 DCF 折現現金流估值（策展）</p>
      <div class="flex items-center gap-6">
        <div><p class="text-xs text-slate-400">DCF 合理價</p><p class="text-lg font-bold text-blue-600 tabular-nums">${d.dcf}</p></div>
        <span class="text-lg text-slate-300">vs</span>
        <div><p class="text-xs text-slate-400">最新收盤${r?dataBadge(r.priceDate):''}</p><p class="text-lg font-bold text-slate-800 tabular-nums">${curShow}</p></div>
      </div>
      ${gap}
      <p class="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg p-2.5">${d.vsum}</p>
    `,'border-dashed')}
  </div>`;
}

function tabGrowth(d){
  return `<div class="max-w-2xl space-y-3">
    <div class="flex items-center gap-2 mb-1"><span class="text-sm font-bold text-slate-700">成長潛力分析</span>${srcBadge('framework')}</div>
    <div class="grid grid-cols-2 gap-2">
      ${card(`<p class="text-xs text-slate-400 mb-1">🌍 目標市場規模</p><p class="text-base font-bold text-slate-800">${d.mkt}</p>`)}
      ${card(`<p class="text-xs text-slate-400 mb-1">📈 產業年增率</p><p class="text-base font-bold text-emerald-600">${d.rate}</p>`)}
    </div>
    ${card(`<p class="text-xs font-bold text-slate-600 mb-2">🤖 AI 與技術優勢</p><p class="text-xs text-slate-600 bg-blue-50 rounded-lg p-2.5">${d.ai}</p>`)}
    <div class="grid grid-cols-2 gap-2">
      ${card(`<p class="text-xs font-bold text-blue-600 mb-1.5">📅 5年展望</p><p class="text-xs text-slate-700">${d.y5}</p>`)}
      ${card(`<p class="text-xs font-bold text-purple-600 mb-1.5">🔭 10年展望</p><p class="text-xs text-slate-700">${d.y10}</p>`)}
    </div>
    <div class="bg-slate-800 rounded-xl p-4">
      <p class="text-xs text-slate-400 mb-1">成長潛力總結</p>
      <p class="text-xs font-semibold text-slate-100">${d.gsum}</p>
    </div>
  </div>`;
}

function tabDebate(d){
  const pts=(arr,col)=>arr.map(p=>`<div class="flex gap-2 mb-2 text-xs"><span class="font-bold ${col} shrink-0">${col.includes('emerald')?'+':'−'}</span><span class="text-slate-700">${p}</span></div>`).join('');
  return `<div class="max-w-2xl space-y-3">
    <div class="flex items-center gap-2 mb-1"><span class="text-sm font-bold text-slate-700">多空分析師辯論</span>${srcBadge('framework')}</div>
    <div class="grid grid-cols-2 gap-2">
      ${card('<p class="text-xs font-bold text-emerald-700 mb-3">🐂 多頭分析師</p>'+pts(d.bull,'text-emerald-600'))}
      ${card('<p class="text-xs font-bold text-red-700 mb-3">🐻 空頭分析師</p>'+pts(d.bear,'text-red-500'))}
    </div>
    ${card('<p class="text-xs font-bold text-slate-600 mb-2">⚖️ 分析師共識</p><p class="text-xs text-slate-600 bg-slate-50 rounded-lg p-2.5">'+d.bal+'</p>')}
  </div>`;
}

function tabDecision(d){
  const cfg={BUY:{bg:'bg-emerald-50',border:'border-emerald-200',tc:'text-emerald-700',e:'✅'},HOLD:{bg:'bg-amber-50',border:'border-amber-200',tc:'text-amber-700',e:'⏸'},AVOID:{bg:'bg-red-50',border:'border-red-200',tc:'text-red-700',e:'❌'}};
  const c=cfg[d.act]||cfg.HOLD;
  const li=(arr,col)=>arr.map(x=>`<div class="flex gap-2 mb-1.5 text-xs"><span class="${col}">▶</span><span class="text-slate-700">${x}</span></div>`).join('');
  return `<div class="max-w-2xl space-y-3">
    <div class="flex items-center gap-2 mb-1"><span class="text-sm font-bold text-slate-700">投資決策</span>${srcBadge('framework')}</div>
    ${card(`<div class="flex flex-col items-center py-3">
      <div class="flex items-center gap-3 px-8 py-4 rounded-xl ${c.bg} border ${c.border}">
        <span class="text-3xl">${c.e}</span>
        <div><p class="text-xs ${c.tc}">建議行動</p><p class="text-3xl font-bold ${c.tc}">${d.actz}</p></div>
      </div>
      <p class="text-xs text-slate-500 mt-3 text-center max-w-sm">${d.why}</p>
    </div>`)}
    <div class="grid grid-cols-2 gap-2">
      ${card('<p class="text-xs font-bold text-blue-600 mb-1.5">📅 短期展望（1年）</p><p class="text-xs text-slate-700">'+d.st+'</p>')}
      ${card('<p class="text-xs font-bold text-purple-600 mb-1.5">🔭 長期展望（5年+）</p><p class="text-xs text-slate-700">'+d.lt+'</p>')}
    </div>
    <div class="grid grid-cols-2 gap-2">
      ${card('<p class="text-xs font-bold text-emerald-700 mb-2">🚀 主要催化劑</p>'+li(d.cat,'text-emerald-500'))}
      ${card('<p class="text-xs font-bold text-red-700 mb-2">⚠️ 主要風險</p>'+li(d.risk,'text-red-500'))}
    </div>
  </div>`;
}

// ─── SCENARIO ANALYSIS TAB ───────────────────────────────
function tabScenario(d){
  const sc=d.sc;
  const r=d.real;
  const curPrice = r&&r.priceStr ? r.priceStr : d.cur;

  // 若無 scenario 資料（fallback 標的），顯示通用框架
  if(!sc){
    return `<div class="max-w-2xl space-y-3">
      <div class="flex items-center gap-2 mb-1"><span class="text-sm font-bold text-slate-700">📐 情境分析框架</span></div>
      <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700">
        此標的目前無精選情境數據。建議：<br>• 填入 Anthropic API Key 後重新分析，Claude 將自動產生三情境預測<br>• 或參考「🎯 投資決策」Tab 的催化劑與風險清單
      </div>
      <div class="grid grid-cols-3 gap-3">
        ${['樂觀','基準','悲觀'].map((l,i)=>{
          const col=['emerald','blue','red'][i];
          return card(`<p class="text-xs font-bold text-${col}-600 mb-2">${['🌟','📊','⚠️'][i]} ${l}情境</p>
            <p class="text-xs text-slate-400">EPS 預估</p><p class="text-base font-bold text-slate-700 tabular-nums mb-2">—</p>
            <p class="text-xs text-slate-400">目標價</p><p class="text-base font-bold text-${col}-600 tabular-nums">—</p>`,`border-${col}-200`);
        }).join('')}
      </div>
    </div>`;
  }

  const scKeys=['best','base','worst'];
  const icons=['🌟','📊','⚠️'];
  const scenarioCards = scKeys.map((k,i)=>{
    const s=sc[k];
    return card(`
      <div class="flex items-center gap-2 mb-2">
        <span class="text-base">${icons[i]}</span>
        <span class="text-xs font-bold text-${s.color}-600">${s.label}情境</span>
      </div>
      <div class="space-y-1.5 text-xs">
        <div class="bg-slate-50 rounded-lg p-2"><p class="text-slate-400 mb-0.5">觸發條件</p><p class="text-slate-700 font-medium">${s.trigger}</p></div>
        <div class="grid grid-cols-2 gap-1.5">
          <div class="bg-${s.color}-50 rounded-lg p-2 text-center"><p class="text-slate-400 mb-0.5">EPS 預估</p><p class="font-bold text-${s.color}-700 tabular-nums">${s.eps}</p></div>
          <div class="bg-${s.color}-50 rounded-lg p-2 text-center"><p class="text-slate-400 mb-0.5">目標價</p><p class="font-bold text-${s.color}-700 tabular-nums">${s.target}</p></div>
        </div>
        <div class="bg-slate-50 rounded-lg p-2"><p class="text-slate-400 mb-0.5">潛在漲跌幅</p><p class="font-bold tabular-nums text-${s.color}-700">${s.upside}</p></div>
        <p class="text-slate-500 leading-relaxed">${s.note}</p>
      </div>`,`border-${s.color}-200`);
  }).join('');

  // 升息兩碼情境模擬（台股特有）
  const rateImpact = card(`
    <p class="text-xs font-bold text-slate-600 mb-3">🏦 升息兩碼情境模擬（台灣視角）</p>
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
      <div class="bg-blue-50 rounded-lg p-2.5">
        <p class="font-bold text-blue-700 mb-1">科技股（${d.co||'本標的'}）</p>
        <p class="text-slate-600">升息→無風險利率↑→DCF折現率↑→高本益比壓縮；短期承壓，長線看基本面</p>
      </div>
      <div class="bg-emerald-50 rounded-lg p-2.5">
        <p class="font-bold text-emerald-700 mb-1">金融股（受益）</p>
        <p class="text-slate-600">淨利差擴大，存款與放款利差改善，壽險投資收益提升</p>
      </div>
      <div class="bg-amber-50 rounded-lg p-2.5">
        <p class="font-bold text-amber-700 mb-1">房地產/都更概念</p>
        <p class="text-slate-600">建融成本↑，開發商IRR下降；但都更案因持有成本低，相對受益有限</p>
      </div>
    </div>`);

  return `<div class="max-w-3xl space-y-3">
    <div class="flex items-center gap-2 mb-1">
      <span class="text-sm font-bold text-slate-700">📐 三情境分析</span>
      ${srcBadge('framework')}
      ${r?`<span class="text-xs text-slate-400">現價 ${curPrice}</span>`:''}
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">${scenarioCards}</div>
    ${rateImpact}
    <p class="text-[11px] text-slate-400 text-center pt-1">⚠️ 情境分析為假設性推演，非投資建議。實際結果受多重不可預測因素影響。</p>
  </div>`;
}

// 技術均線設定：收盤 + 5/10/月線(20)/季線(60)/半年線(120)
const MA_CFG=[
  {k:'close',label:'收盤',color:'#334155',w:1.8},
  {k:'ma5',label:'5日',color:'#ef4444',w:1},
  {k:'ma10',label:'10日',color:'#f59e0b',w:1},
  {k:'ma20',label:'月線(20)',color:'#10b981',w:1.1},
  {k:'ma60',label:'季線(60)',color:'#3b82f6',w:1.3},
  {k:'ma120',label:'半年線(120)',color:'#8b5cf6',w:1.3}
];
function drawTech(t){
  const el=document.getElementById('cvTech'); if(!el||typeof Chart==='undefined') return;
  if(techChart) techChart.destroy();
  techChart=new Chart(el.getContext('2d'),{
    type:'line',
    data:{labels:t.labels,datasets:MA_CFG.map(m=>({label:m.label,data:t[m.k],borderColor:m.color,borderWidth:m.w,pointRadius:0,tension:.15,spanGaps:true}))},
    options:{responsive:true,maintainAspectRatio:false,animation:false,interaction:{mode:'index',intersect:false},
      plugins:{legend:{labels:{boxWidth:10,font:{size:10}},position:'top'}},
      scales:{ x:{ticks:{maxTicksLimit:8,autoSkip:true,font:{size:9}}}, y:{position:'right'} }}
  });
}
function drawRev(rev){
  const el=document.getElementById('cvRev'); if(!el||typeof Chart==='undefined') return;
  if(revChart) revChart.destroy();
  revChart=new Chart(el.getContext('2d'),{
    type:'bar',
    data:{labels:rev.labels,datasets:[{label:'月營收 (億)',data:rev.values,backgroundColor:'rgba(59,130,246,.5)'}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false}},
      scales:{ x:{ticks:{font:{size:9}}}, y:{position:'right'} }}
  });
}
// 三大法人近20日淨額（張，堆疊長條）
function drawInst(inst){
  const el=document.getElementById('cvInst'); if(!el||typeof Chart==='undefined') return;
  if(instChart) instChart.destroy();
  instChart=new Chart(el.getContext('2d'),{
    type:'bar',
    data:{labels:inst.dates.map(fmtDate),datasets:[
      {label:'外資',data:inst.foreign,backgroundColor:'rgba(244,63,94,.6)'},
      {label:'投信',data:inst.trust,backgroundColor:'rgba(59,130,246,.6)'},
      {label:'自營',data:inst.dealer,backgroundColor:'rgba(168,85,247,.5)'}
    ]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,
      plugins:{legend:{labels:{boxWidth:10,font:{size:10}},position:'top'}},
      scales:{ x:{stacked:true,ticks:{maxTicksLimit:8,font:{size:9}}}, y:{stacked:true,position:'right',ticks:{font:{size:9}}} }}
  });
}

function renderTabContent(d,i){
  const fns=[tabHealth,tabValuation,tabGrowth,tabDebate,tabDecision,tabScenario];
  const tc=document.getElementById('tabContent');
  tc.innerHTML=`<div class="fade-in">${fns[i](d)}</div>`;
  tc.scrollTop=0; // 切換 Tab 自動回到頂部
  if(i===0 && d.real){ if(d.real.tech) drawTech(d.real.tech); if(d.real.revSeries) drawRev(d.real.revSeries); if(d.real.inst) drawInst(d.real.inst); }
  if(i===0) drawRadar(d);
}

function renderResults(ticker,d){
  curData=d; curTab=0;
  const r=d.real;
  const srcTag = d._src==='ai'?'Claude AI':d._src==='db'?'策展資料庫':'自動生成';
  const coName = (r&&r.name)?r.name:d.co;
  document.getElementById('hTitle').textContent=`📋 ${coName} (${ticker.toUpperCase()}) — 財務健檢報告`;
  document.getElementById('hSub').textContent=`質化分析：${srcTag}${r?' ｜ 數字：FinMind 日收盤':''}${r&&r.industry?' ｜ '+r.industry:''}`;

  // 資料新鮮度橫幅
  const fresh=document.getElementById('freshBar');
  const userGoal=(localStorage.getItem(GOAL_KEY)||'').trim();
  const goalBanner=userGoal?`<span class="ml-auto flex items-center gap-1 text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-0.5 text-[10px] font-bold max-w-xs truncate" title="${userGoal}">🎯 ${userGoal}</span>`:'';
  if(r){
    const usLag = r.isTW?'':' · 美股約延遲 1 交易日';
    fresh.innerHTML=`<span class="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span><span>資料截至 <b class="text-slate-700">${r.asOf||'—'}</b>（日收盤，非盤中即時${usLag}）</span><span class="text-slate-400">來源：FinMind</span>${goalBanner}`;
  } else {
    fresh.innerHTML=`<span class="inline-block w-1.5 h-1.5 rounded-full bg-amber-500"></span><span class="text-amber-600">即時數據抓取失敗，以下為策展靜態觀點（數字可能過時）</span>${goalBanner}`;
  }
  fresh.classList.remove('hidden');

  // 關鍵數字一覽列（台股紅漲綠跌）
  const glance=document.getElementById('glanceBar');
  if(r){
    const cell=(lab,val,cls)=>`<div class="bg-white px-4 py-2"><p class="text-[11px] text-slate-400">${lab}</p><p class="text-lg font-bold tabular-nums ${cls||'text-slate-800'}">${val}</p></div>`;
    const chg = r.change!=null?`${r.change>0?'+':''}${r.change.toFixed(2)} (${pct(r.changePct)})`:'—';
    glance.innerHTML =
      cell('收盤價',r.priceStr||'—') + cell('漲跌',chg,upCls(r.change)) +
      cell('P/E',r.per!=null?r.per+'x':'—') + cell('P/B',r.pbr!=null?r.pbr+'x':'—') +
      cell('殖利率',r.divYield!=null?r.divYield+'%':'—') + cell('月營收YoY',pct(r.revYoY),upCls(r.revYoY));
    glance.classList.remove('hidden');
  } else { glance.innerHTML=''; glance.classList.add('hidden'); }

  const bar=document.getElementById('tabBar');
  bar.innerHTML=TABS.map((t,i)=>`
    <button class="tab-btn px-4 py-2.5 text-xs font-semibold border-b-2 transition-colors ${i===0?'border-blue-600 text-blue-700':'border-transparent text-slate-400'}"
      onclick="switchTab(${i})">${t.icon} ${t.label}</button>`).join('');
  document.getElementById('welcome').classList.add('hidden');
  document.getElementById('results').classList.remove('hidden');
  document.getElementById('results').classList.add('flex');
  renderTabContent(d,0); // 容器顯示後再畫圖，避免 canvas 尺寸為 0
}

// ─── RADAR CHART ─────────────────────────────────────────
function computeRadarScores(d){
  const r=d.real, sg=r?r.signals:{};
  // 六維：財務健康、成長性、估值吸引力、籌碼面、技術面、股利
  const health = Math.min(100, d.score||60);
  // 成長性：revYoY + rate string
  let growth = 50;
  if(r&&r.revYoY!=null){ growth = r.revYoY>=20?90:r.revYoY>=10?75:r.revYoY>=0?55:35; }
  else if(d.rate){ const m=d.rate.match(/(\d+)/); if(m) growth=Math.min(95,Number(m[1])*3); }
  // 估值吸引力：P/E百分位越低越好
  let valAttr = 60;
  if(r&&r.perPctile!=null){ valAttr = r.perPctile<=20?88:r.perPctile<=40?72:r.perPctile<=60?55:r.perPctile<=80?38:25; }
  else { valAttr = d.verd==='U'?80:d.verd==='F'?60:35; }
  // 籌碼面
  let chip = 55;
  if(sg&&sg.chip){ chip = sg.chip.tone==='good'?80:sg.chip.tone==='bad'?30:55; }
  // 技術面
  let tech = 55;
  if(sg&&sg.tech){ tech = sg.tech.tone==='good'?82:sg.tech.tone==='bad'?28:55; }
  // 股利
  let div = 40;
  if(r&&r.divYield!=null){ div = r.divYield>=5?85:r.divYield>=3?68:r.divYield>=1?50:30; }
  else if(r&&r.cashYield!=null){ div = r.cashYield>=5?85:r.cashYield>=3?68:r.cashYield>=1?50:30; }
  return [health, growth, valAttr, chip, tech, div];
}
function drawRadar(d){
  const el=document.getElementById('cvRadar'); if(!el||typeof Chart==='undefined') return;
  if(radarChart) radarChart.destroy();
  const scores=computeRadarScores(d);
  radarChart=new Chart(el.getContext('2d'),{
    type:'radar',
    data:{
      labels:['財務健康','成長性','估值吸引力','籌碼面','技術面','股利'],
      datasets:[{label:d.co||'標的',data:scores,
        backgroundColor:'rgba(59,130,246,0.2)',borderColor:'rgba(59,130,246,0.8)',
        pointBackgroundColor:'rgba(59,130,246,1)',pointRadius:4,borderWidth:2}]
    },
    options:{responsive:true,maintainAspectRatio:false,animation:false,
      scales:{r:{min:0,max:100,ticks:{stepSize:25,font:{size:9},color:'#94a3b8'},
        grid:{color:'#e2e8f0'},pointLabels:{font:{size:11},color:'#475569'}}},
      plugins:{legend:{display:false}}}
  });
}

// ─── CLAUDE AI（質化六層，以真實數字為依據）──────────────
async function callAI(ticker,today,real){
  const ctx = real ? `已知即時數據（請以此為準）：股價=${real.priceStr}；P/E=${real.per}；P/B=${real.pbr}；殖利率=${real.divYield}%；月營收年增=${real.revYoY!=null?real.revYoY.toFixed(1)+'%':'NA'}；最新季毛利率=${real.grossM!=null?real.grossM.toFixed(1)+'%':'NA'}；EPS=${real.eps}` : '無即時數據，請以你的知識分析。';
  const res=await fetch(getApiEndpoint(),{
    method:'POST',
    headers:getApiHeaders(),
    body:JSON.stringify({
      model:MODEL,
      max_tokens:1500,
      temperature:0,
      system:`你是頂尖機構投資分析師。今天是${today}。嚴格只回傳一個 JSON 物件（不要 markdown、不要任何多餘文字），所有欄位皆為「扁平」結構，鍵名與型別必須完全如下：
{"co":"公司中文名","score":整數0-100,"trend":"S或W","rev":"5年營收趨勢","ni":"淨利趨勢","fcf":"FCF狀況","margin":"利潤率趨勢","debt":"債務水平","hsum":"財務總結30字內","pe":"目前P/E","ipe":"同業P/E","dcf":"DCF合理價含單位","cur":"當前股價含單位","verd":"U或O或F","verdz":"低估或高估或合理","vsum":"估值總結","mkt":"目標市場規模","rate":"產業增長率","ai":"AI技術優勢","y5":"5年展望","y10":"10年展望","gsum":"成長總結","bull":["多頭1","多頭2","多頭3"],"bear":["空頭1","空頭2","空頭3"],"bal":"平衡結論","act":"BUY或HOLD或AVOID","actz":"買入或持有或避開","st":"短期展望","lt":"長期展望","cat":["催化劑1","催化劑2","催化劑3"],"risk":["風險1","風險2","風險3"],"why":"建議理由25字內","sc":{"best":{"label":"樂觀","color":"emerald","trigger":"觸發條件","eps":"EPS預估","target":"目標價","upside":"上行幅度","note":"說明"},"base":{"label":"基準","color":"blue","trigger":"觸發條件","eps":"EPS預估","target":"目標價","upside":"上行幅度","note":"說明"},"worst":{"label":"悲觀","color":"red","trigger":"觸發條件","eps":"EPS預估","target":"目標價","upside":"下行幅度","note":"說明"}}}`,
      messages:[{role:'user',content:`分析股票：${ticker}。${ctx}`}]
    })
  });
  const json=await res.json();
  if(json.error) throw new Error(json.error.message||'API 錯誤');
  const raw=json.content.filter(b=>b.type==='text').map(b=>b.text).join('');
  return JSON.parse(raw.replace(/```json|```/g,'').trim());
}

// ─── TERMINAL ANIMATION ──────────────────────────────────
function addLine(text,color,delay){
  setTimeout(()=>{
    const el=document.createElement('div');
    el.style.color=color; el.textContent=text;
    const term=document.getElementById('term');
    term.appendChild(el); term.scrollTop=term.scrollHeight;
  },delay);
}

// ─── MAIN RUN ────────────────────────────────────────────
async function run(){
  let ticker=document.getElementById('inp').value.trim().toUpperCase();
  if(!ticker) return;
  if(/^\d{4,6}[A-Z]?$/.test(ticker)) ticker+='.TW'; // 純數字台股代號自動補 .TW
  document.getElementById('inp').value=ticker;
  uiSave();
  toggleSidebar(false); // 手機：開始分析即收起側欄
  const now=new Date();
  const timeStr=`${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const dateStr=document.getElementById('cDate').textContent;
  const useAI=false;
  const cacheKey=`${ticker}|db`;

  document.getElementById('term').innerHTML='';
  document.getElementById('loader').classList.remove('hidden');
  document.getElementById('welcome').classList.add('hidden');
  document.getElementById('results').classList.add('hidden');
  document.getElementById('results').classList.remove('flex');
  document.getElementById('runBtn').disabled=true;

  [
    {t:`> [${timeStr}] 初始化分析引擎 v7.0`,c:'#4ade80',d:40},
    {t:`> [DATE] ${dateStr} ｜ 標的: ${ticker}`,c:'#22d3ee',d:140},
    {t:`> [FETCH] 連線 FinMind 抓取日收盤財報數據...`,c:'#4ade80',d:260},
    {t:`> [DB] 載入策展資料庫質化分析...`,c:'#94a3b8',d:420},
    {t:`> [MODEL] 計算技術均線與估值訊號...`,c:'#60a5fa',d:560},
    {t:`> [SIGNAL] 彙整即時數據訊號...`,c:'#f472b6',d:680},
  ].forEach(l=>addLine(l.t,l.c,l.d));

  try{
    if(cache[cacheKey]){
      addLine(`> [CACHE] 命中快取，直接呈現`,'#86efac',0);
      const cached=cache[cacheKey];
      setTimeout(()=>finish(ticker,cached),500);
      return;
    }
    // 1) 抓真實數據（與動畫並行）
    const realP=fetchReal(ticker);
    // 2) 取得質化分析
    let narr;
    if(useAI){
      const real0=await realP;
      narr=await callAI(ticker,dateStr,real0);
      narr._src='ai'; narr.real=real0;
    } else {
      const real0=await realP;
      narr=JSON.parse(JSON.stringify(DB[ticker]||fallback(ticker)));
      narr._src=DB[ticker]?'db':'gen'; narr.real=real0;
    }
    // 真實名稱優先（若有抓到價格但 narrative 是 fallback）
    if(narr.real&&narr._src==='gen') narr.co=narr.real.name?narr.real.name:(narr.real.market?`${ticker} (${narr.real.market})`:narr.co);
    const minWait=new Promise(r=>setTimeout(r,800));
    await minWait;
    cache[cacheKey]=narr;
    addLine(`> [✓] 分析完成！正在生成報告...`,'#86efac',0);
    setTimeout(()=>finish(ticker,narr),600);
  } catch(e){
    addLine(`> [ERROR] ${e.message}`,'#f87171',0);
    setTimeout(()=>{
      const fb=JSON.parse(JSON.stringify(DB[ticker]||fallback(ticker)));
      fb._src=DB[ticker]?'db':'gen';
      finish(ticker,fb);
    },1200);
  }
}
function finish(ticker,data){
  document.getElementById('loader').classList.add('hidden');
  document.getElementById('runBtn').disabled=false;
  renderResults(ticker,data);
  if(data.act) logDecision(ticker, data); // v7.0 自動記錄決策
}
