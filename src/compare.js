// ─── compare.js ──────────────────────────────────────────
// 比較分析面板
// 依賴：core.js（toast）, analysis.js（fetchReal, computeRadarScores）
// ─────────────────────────────────────────────────────────

let cmpChart1=null,cmpChart2=null;

function renderComparePanel(){
  const panel=document.getElementById('comparePanel');
  const saved=JSON.parse(localStorage.getItem(UI_KEY)||'{}');
  const defA=saved.cmpA||'2330.TW', defB=saved.cmpB||'NVDA';
  panel.innerHTML=`<div class="max-w-5xl mx-auto space-y-4 fade-in">
    <div>
      <p class="text-lg font-bold text-slate-700">⚖️ 比較分析</p>
      <p class="text-xs text-slate-400 mt-0.5">並排雷達圖 · 估值對比 · 六維差異 ｜ 最多同時比較兩檔</p>
    </div>
    <div class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-xs font-bold text-slate-600 mb-3">輸入兩個股票代號</p>
      <div class="flex gap-2 flex-wrap items-end">
        <div><label class="text-[10px] text-slate-400 block mb-1">標的 A</label>
          <input id="cmpA" value="${defA}" class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400 w-36"></div>
        <span class="text-slate-400 font-bold text-lg pb-2">vs</span>
        <div><label class="text-[10px] text-slate-400 block mb-1">標的 B</label>
          <input id="cmpB" value="${defB}" class="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-400 w-36"></div>
        <button onclick="runCompare()" id="cmpRunBtn" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg transition-colors">🔍 開始比較</button>
      </div>
    </div>
    <div id="cmpResult"><p class="text-xs text-slate-400 text-center py-10">👆 輸入兩個代號後點「開始比較」</p></div>
  </div>`;
}

async function runCompare(){
  const btn=document.getElementById('cmpRunBtn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ 抓取中...'; }
  let tA=(document.getElementById('cmpA').value||'').trim().toUpperCase();
  let tB=(document.getElementById('cmpB').value||'').trim().toUpperCase();
  if(!tA||!tB){ toast('請輸入兩個代號','warn'); if(btn){btn.disabled=false;btn.textContent='🔍 開始比較';} return; }
  if(/^\d{4,6}$/.test(tA)) tA+='.TW';
  if(/^\d{4,6}$/.test(tB)) tB+='.TW';
  try{ const u=JSON.parse(localStorage.getItem(UI_KEY)||'{}'); u.cmpA=tA; u.cmpB=tB; localStorage.setItem(UI_KEY,JSON.stringify(u)); }catch(e){}
  document.getElementById('cmpResult').innerHTML='<p class="text-slate-400 text-sm text-center py-12">⏳ 同時抓取兩檔數據中...</p>';
  const [r1,r2]=await Promise.all([cmpFetch(tA),cmpFetch(tB)]);
  if(btn){ btn.disabled=false; btn.textContent='🔍 開始比較'; }
  displayCompare(tA,r1,tB,r2);
}

async function cmpFetch(ticker){
  const d=DB[ticker]?JSON.parse(JSON.stringify(DB[ticker])):{co:ticker,score:50,trend:'?',rev:'—',ni:'—',fcf:'—',margin:'—',debt:'—',hsum:'—',pe:'—',ipe:'—',dcf:'—',cur:'—',verd:'?',verdz:'—',vsum:'—',mkt:'—',rate:'—',ai:'—',y5:'—',y10:'—',gsum:'—',bull:[],bear:[],bal:'—',act:'—',actz:'—',st:'—',lt:'—',cat:[],risk:[],why:'—',sc:null};
  try{ await fetchReal(ticker,d); }catch(e){}
  return d;
}

function displayCompare(tA,dA,tB,dB){
  const el=document.getElementById('cmpResult'); if(!el) return;
  const sc=computeRadarScores(dA), sc2=computeRadarScores(dB);
  const dim=['財務健康','成長性','估值吸引力','籌碼面','技術面','股利'];
  const rA=dA.real||{}, rB=dB.real||{};

  const metricRow=(label,vA,vB,higherBetter=true)=>{
    const nA=parseFloat(vA), nB=parseFloat(vB);
    const aWin=!isNaN(nA)&&!isNaN(nB)&&(higherBetter?nA>nB:nA<nB);
    const bWin=!isNaN(nA)&&!isNaN(nB)&&(higherBetter?nB>nA:nB<nA);
    return `<tr class="border-b border-slate-100">
      <td class="py-1.5 px-3 text-xs text-slate-500 font-medium">${label}</td>
      <td class="py-1.5 px-3 text-xs text-right tabular-nums font-bold ${aWin?'text-emerald-600':bWin?'text-red-400':'text-slate-700'}">${vA!=null?vA:'—'}</td>
      <td class="py-1.5 px-3 text-xs text-right tabular-nums font-bold ${bWin?'text-emerald-600':aWin?'text-red-400':'text-slate-700'}">${vB!=null?vB:'—'}</td>
    </tr>`;
  };

  const verdMap={B:'BUY 買入',H:'HOLD 持有',A:'AVOID 避開','?':'—'};
  const verdBadge=(v)=>{const m={B:'bg-emerald-100 text-emerald-700',H:'bg-blue-100 text-blue-700',A:'bg-red-100 text-red-600'};return `<span class="px-2 py-0.5 rounded text-xs font-bold ${m[v]||'bg-slate-100 text-slate-500'}">${verdMap[v]||v}</span>`;};

  el.innerHTML=`<div class="space-y-4 fade-in">
    <!-- Header scores -->
    <div class="grid grid-cols-2 gap-3">
      <div class="bg-white border border-blue-200 rounded-xl p-4 text-center">
        <p class="text-xs text-slate-400 mb-1 font-mono">${tA}</p>
        <p class="text-xl font-bold text-slate-800">${dA.co||tA}</p>
        <p class="text-3xl font-bold tabular-nums text-blue-600 mt-1">${dA.score}</p>
        <p class="text-xs text-slate-400">綜合評分</p>
        <div class="mt-2">${verdBadge(dA.act)}</div>
        <p class="text-sm tabular-nums text-slate-600 mt-1">${rA.priceStr||dA.cur||'—'}</p>
      </div>
      <div class="bg-white border border-violet-200 rounded-xl p-4 text-center">
        <p class="text-xs text-slate-400 mb-1 font-mono">${tB}</p>
        <p class="text-xl font-bold text-slate-800">${dB.co||tB}</p>
        <p class="text-3xl font-bold tabular-nums text-violet-600 mt-1">${dB.score}</p>
        <p class="text-xs text-slate-400">綜合評分</p>
        <div class="mt-2">${verdBadge(dB.act)}</div>
        <p class="text-sm tabular-nums text-slate-600 mt-1">${rB.priceStr||dB.cur||'—'}</p>
      </div>
    </div>
    <!-- Radar charts -->
    <div class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-xs font-bold text-slate-600 mb-3">🕸 六維雷達對比</p>
      <div class="grid grid-cols-2 gap-4">
        <div style="height:220px"><canvas id="cvCmpA"></canvas></div>
        <div style="height:220px"><canvas id="cvCmpB"></canvas></div>
      </div>
      <div class="mt-3 grid grid-cols-6 gap-1">
        ${dim.map((d,i)=>{const diff=sc[i]-sc2[i];return `<div class="text-center text-[10px]"><p class="text-slate-400">${d}</p><p class="font-bold ${diff>5?'text-blue-600':diff<-5?'text-violet-600':'text-slate-500'}">${diff>0?'+':''}${diff}</p></div>`;}).join('')}
      </div>
      <p class="text-[10px] text-slate-400 text-center mt-1">差值：正數表示 ${dA.co||tA} 領先，負數表示 ${dB.co||tB} 領先</p>
    </div>
    <!-- Metrics table -->
    <div class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-xs font-bold text-slate-600 mb-3">📊 關鍵指標對比 <span class="font-normal text-slate-400">（綠色=領先）</span></p>
      <div class="overflow-x-auto"><table class="w-full">
        <thead><tr class="text-[10px] text-slate-400 border-b border-slate-200">
          <th class="px-3 py-1.5 text-left">指標</th>
          <th class="px-3 py-1.5 text-right">${dA.co||tA}</th>
          <th class="px-3 py-1.5 text-right">${dB.co||tB}</th>
        </tr></thead>
        <tbody>
          ${metricRow('現價',rA.priceStr||dA.cur,rB.priceStr||dB.cur,false)}
          ${metricRow('P/E 本益比',rA.per!=null?rA.per+'x':dA.pe,rB.per!=null?rB.per+'x':dB.pe,false)}
          ${metricRow('P/B 淨值比',rA.pbr!=null?rA.pbr+'x':'—',rB.pbr!=null?rB.pbr+'x':'—',false)}
          ${metricRow('殖利率',rA.divYield!=null?rA.divYield+'%':rA.cashYield!=null?rA.cashYield+'%':'—',rB.divYield!=null?rB.divYield+'%':rB.cashYield!=null?rB.cashYield+'%':'—',true)}
          ${metricRow('月營收 YoY',rA.revYoY!=null?rA.revYoY.toFixed(1)+'%':'—',rB.revYoY!=null?rB.revYoY.toFixed(1)+'%':'—',true)}
          ${metricRow('毛利率',rA.grossM!=null?rA.grossM.toFixed(1)+'%':dA.margin,rB.grossM!=null?rB.grossM.toFixed(1)+'%':dB.margin,true)}
          ${metricRow('綜合評分',dA.score,dB.score,true)}
          ${metricRow('DCF 估值',dA.dcf,dB.dcf,true)}
        </tbody>
      </table></div>
    </div>
    <p class="text-[11px] text-slate-400 text-center">⚠️ 數據來自 FinMind 日收盤及策展 DB，不構成投資建議</p>
  </div>`;
  // Draw both radars
  setTimeout(()=>{
    const drawR=(id,scores,label,color)=>{
      const el=document.getElementById(id); if(!el||typeof Chart==='undefined') return;
      return new Chart(el.getContext('2d'),{type:'radar',data:{labels:dim,datasets:[{label,data:scores,backgroundColor:color+'33',borderColor:color,pointBackgroundColor:color,pointRadius:3,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,animation:false,scales:{r:{min:0,max:100,ticks:{stepSize:25,font:{size:8},color:'#94a3b8'},grid:{color:'#e2e8f0'},pointLabels:{font:{size:10},color:'#475569'}}},plugins:{legend:{display:false}}}});
    };
    if(cmpChart1) cmpChart1.destroy();
    if(cmpChart2) cmpChart2.destroy();
    cmpChart1=drawR('cvCmpA',sc,dA.co||tA,'rgba(59,130,246,0.9)');
    cmpChart2=drawR('cvCmpB',sc2,dB.co||tB,'rgba(124,58,237,0.9)');
  },60);
}
