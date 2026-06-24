// ─── networth.js ─────────────────────────────────────────
// 淨資產追蹤
// 依賴：core.js（pad, toast）
// ─────────────────────────────────────────────────────────

const NW_KEY='kaku_networth_v1';
function getNWData(){ try{ return JSON.parse(localStorage.getItem(NW_KEY)||'[]'); }catch(e){ return []; } }
function saveNWData(d){ try{ localStorage.setItem(NW_KEY,JSON.stringify(d)); }catch(e){} }
let nwChart=null,nwPieChart=null;

function nwNetWorth(s){ return (s.cash||0)+(s.bank||0)+(s.twStock||0)+(s.usStock||0)+(s.crypto||0)+(s.other||0)+(s.realEstate||0)-(s.debt||0); }

function nwSaveField(ym,field,val){
  const data=getNWData();
  let snap=data.find(s=>s.ym===ym);
  if(!snap){ snap={ym,cash:0,bank:0,twStock:0,usStock:0,crypto:0,realEstate:0,other:0,debt:0}; data.push(snap); }
  snap[field]=Number(val)||0;
  data.sort((a,b)=>a.ym<b.ym?-1:1);
  saveNWData(data);
  // refresh summary numbers without full re-render
  const nw=nwNetWorth(snap);
  const el=document.getElementById('nw_total'); if(el) el.textContent='NT$'+Math.round(nw).toLocaleString();
  const sorted=data.slice().sort((a,b)=>a.ym<b.ym?-1:1);
  nwDrawPie(snap);
  if(sorted.length>=2) nwDrawLine(sorted);
  nwUpdateChecks(snap);
}

function nwDrawLine(sorted){
  const el=document.getElementById('cvNWLine'); if(!el||typeof Chart==='undefined') return;
  if(nwChart){ nwChart.destroy(); nwChart=null; }
  const pts=sorted.slice(-12);
  nwChart=new Chart(el.getContext('2d'),{
    type:'line',
    data:{
      labels:pts.map(s=>s.ym),
      datasets:[{label:'淨資產',data:pts.map(s=>nwNetWorth(s)),
        borderColor:'rgba(59,130,246,0.9)',backgroundColor:'rgba(59,130,246,0.08)',
        fill:true,tension:0.4,pointRadius:4,borderWidth:2.5}]
    },
    options:{responsive:true,maintainAspectRatio:false,animation:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>'NT$'+Math.round(ctx.parsed.y).toLocaleString()}}},
      scales:{
        y:{ticks:{callback:v=>'NT$'+(v/1000).toFixed(0)+'k',font:{size:9},color:'#94a3b8'},grid:{color:'#f1f5f9'}},
        x:{ticks:{font:{size:9},color:'#94a3b8'},grid:{display:false}}
      }}
  });
}

function nwDrawPie(snap){
  const el=document.getElementById('cvNWPie'); if(!el||typeof Chart==='undefined') return;
  if(nwPieChart){ nwPieChart.destroy(); nwPieChart=null; }
  const cats=[
    {label:'現金',value:snap.cash||0,color:'#94a3b8'},
    {label:'銀行存款',value:snap.bank||0,color:'#3b82f6'},
    {label:'台股',value:snap.twStock||0,color:'#10b981'},
    {label:'美股',value:snap.usStock||0,color:'#8b5cf6'},
    {label:'加密貨幣',value:snap.crypto||0,color:'#f59e0b'},
    {label:'不動產',value:snap.realEstate||0,color:'#ec4899'},
    {label:'其他投資',value:snap.other||0,color:'#6b7280'},
  ].filter(c=>c.value>0);
  if(!cats.length) return;
  nwPieChart=new Chart(el.getContext('2d'),{
    type:'doughnut',
    data:{labels:cats.map(c=>c.label),datasets:[{data:cats.map(c=>c.value),backgroundColor:cats.map(c=>c.color),borderWidth:2,borderColor:'#fff'}]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,
      plugins:{legend:{position:'right',labels:{font:{size:10},color:'#475569',boxWidth:12}}},
      cutout:'60%'}
  });
}

function nwUpdateChecks(snap){
  const el=document.getElementById('nwChecks'); if(!el) return;
  const totalAssets=(snap.cash||0)+(snap.bank||0)+(snap.twStock||0)+(snap.usStock||0)+(snap.crypto||0)+(snap.other||0)+(snap.realEstate||0);
  const twPct=totalAssets?(snap.twStock||0)/totalAssets*100:0;
  const usPct=totalAssets?(snap.usStock||0)/totalAssets*100:0;
  const cryptoPct=totalAssets?(snap.crypto||0)/totalAssets*100:0;
  const liquidPct=totalAssets?((snap.cash||0)+(snap.bank||0))/totalAssets*100:0;
  const checks=[
    {label:'緊急備用金 ≥ 3個月 (~NT$90k)',ok:(snap.cash||0)+(snap.bank||0)>=90000,detail:`目前 NT$${((snap.cash||0)+(snap.bank||0)).toLocaleString()}`},
    {label:'台股集中度 < 60%',ok:twPct<60,detail:`目前 ${twPct.toFixed(1)}%`},
    {label:'美股配置 ≥ 15%',ok:usPct>=15,detail:`目前 ${usPct.toFixed(1)}%`},
    {label:'加密資產 ≤ 7%',ok:cryptoPct<=7,detail:`目前 ${cryptoPct.toFixed(1)}%`},
    {label:'流動性（現金+銀行） ≥ 8%',ok:liquidPct>=8,detail:`目前 ${liquidPct.toFixed(1)}%`},
  ];
  el.innerHTML=checks.map(c=>`
    <div class="flex items-center gap-2 text-xs py-1.5 border-b border-slate-50 last:border-0">
      <span class="text-sm">${c.ok?'🟢':'🔴'}</span>
      <span class="font-medium text-slate-700 flex-1">${c.label}</span>
      <span class="text-slate-400 tabular-nums">${c.detail}</span>
    </div>`).join('');
}

function renderNetworth(){
  const panel=document.getElementById('networthPanel');
  const data=getNWData();
  const now=new Date(), ym=`${now.getFullYear()}-${pad(now.getMonth()+1)}`;
  let snap=data.find(s=>s.ym===ym);
  if(!snap){ snap={ym,cash:0,bank:0,twStock:0,usStock:0,crypto:0,realEstate:0,other:0,debt:0}; data.push(snap); data.sort((a,b)=>a.ym<b.ym?-1:1); saveNWData(data); }
  const nw=nwNetWorth(snap);
  const sorted=data.slice().sort((a,b)=>a.ym<b.ym?-1:1);
  const myIdx=sorted.findIndex(s=>s.ym===ym);
  const prev=myIdx>0?sorted[myIdx-1]:null;
  const momChange=prev?nw-nwNetWorth(prev):null;
  const momPct=prev&&nwNetWorth(prev)?((nw/nwNetWorth(prev))-1)*100:null;
  const prevYm=`${now.getFullYear()-1}-${pad(now.getMonth()+1)}`;
  const prevYear=data.find(s=>s.ym===prevYm);
  const yoyChange=prevYear?nw-nwNetWorth(prevYear):null;
  const totalAssets=(snap.cash||0)+(snap.bank||0)+(snap.twStock||0)+(snap.usStock||0)+(snap.crypto||0)+(snap.other||0)+(snap.realEstate||0);

  const inp=(field,val,label)=>`
    <div class="flex items-center gap-2 text-xs">
      <span class="text-slate-500 w-20 shrink-0">${label}</span>
      <input type="number" value="${val||''}" placeholder="0" onchange="nwSaveField('${ym}','${field}',this.value)"
        class="flex-1 bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-right tabular-nums focus:outline-none focus:border-blue-400">
    </div>`;

  const histRows=sorted.slice(-6).reverse().map(s=>{
    const snw=nwNetWorth(s);
    const inv=(s.twStock||0)+(s.usStock||0)+(s.crypto||0)+(s.other||0);
    return `<tr class="border-b border-slate-100 last:border-0 hover:bg-slate-50">
      <td class="py-2 px-3 text-xs text-slate-500 font-mono">${s.ym}</td>
      <td class="py-2 px-3 text-xs text-right font-bold tabular-nums text-slate-700">NT$${Math.round(snw).toLocaleString()}</td>
      <td class="py-2 px-3 text-xs text-right tabular-nums text-blue-600">NT$${Math.round(inv).toLocaleString()}</td>
      <td class="py-2 px-3 text-xs text-right tabular-nums text-slate-400">NT$${Math.round((s.cash||0)+(s.bank||0)).toLocaleString()}</td>
    </tr>`;
  }).join('');

  panel.innerHTML=`<div class="max-w-4xl mx-auto space-y-4 fade-in">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <div>
        <p class="text-lg font-bold text-slate-700">💰 淨資產追蹤</p>
        <p class="text-xs text-slate-400 mt-0.5">每月一次快照，長期追蹤財富曲線 ｜ 資料只存本機</p>
      </div>
      <div class="text-right">
        <p class="text-[10px] text-slate-400 uppercase tracking-wide">${ym} 淨資產</p>
        <p id="nw_total" class="text-2xl font-bold text-blue-700 tabular-nums">NT$${Math.round(nw).toLocaleString()}</p>
        ${momChange!==null?'<p class="text-xs '+(momChange>=0?'text-emerald-600':'text-red-500')+' tabular-nums font-bold">'+(momChange>=0?'▲':'▼')+' NT$'+Math.abs(Math.round(momChange)).toLocaleString()+' MoM '+(momPct!==null?'('+(momPct>=0?'+':'')+momPct.toFixed(1)+'%)':'')+'</p>':''}
        ${(()=>{const fields=['cash','bank','twStock','usStock','crypto','realEstate','other','debt'];const filled=fields.filter(f=>snap[f]&&Number(snap[f])>0).length;const pctFill=Math.round(filled/fields.length*100);const cls=pctFill>=75?'text-emerald-600':pctFill>=50?'text-amber-600':'text-red-500';return '<p class="text-[10px] mt-1 '+cls+' font-bold">📋 快照完整度 '+filled+'/'+fields.length+' ('+pctFill+'%)</p>';})()}
      </div>
    </div>

    <!-- KPI Row -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      ${[
        {label:'總資產',val:totalAssets,color:'slate'},
        {label:'投資資產',val:(snap.twStock||0)+(snap.usStock||0)+(snap.crypto||0)+(snap.other||0),color:'blue'},
        {label:'流動現金',val:(snap.cash||0)+(snap.bank||0),color:'emerald'},
        {label:yoyChange!==null?'YoY 變化':'總負債',val:yoyChange!==null?yoyChange:-(snap.debt||0),color:yoyChange!==null?(yoyChange>=0?'emerald':'red'):(snap.debt?'red':'slate'),prefix:yoyChange!==null?(yoyChange>=0?'▲ NT$':'▼ NT$'):'NT$'}
      ].map(k=>`<div class="bg-white border border-slate-200 rounded-xl p-3 transition-shadow hover:shadow-sm">
        <p class="text-[10px] text-slate-400 mb-1">${k.label}</p>
        <p class="text-sm font-bold tabular-nums text-${k.color}-600">${k.val!=null?(k.prefix||'NT$')+Math.abs(Math.round(k.val)).toLocaleString():'—'}</p>
      </div>`).join('')}
    </div>

    <!-- Input + Pie -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white border border-slate-200 rounded-xl p-4 space-y-2">
        <p class="text-xs font-bold text-slate-600 mb-3">📝 更新 ${ym} 快照</p>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide">資產（TWD）</p>
        ${inp('cash',snap.cash,'💵 現金')}
        ${inp('bank',snap.bank,'🏦 銀行存款')}
        ${inp('twStock',snap.twStock,'🇹🇼 台股')}
        ${inp('usStock',snap.usStock,'🇺🇸 美股')}
        ${inp('crypto',snap.crypto,'₿ 加密貨幣')}
        ${inp('realEstate',snap.realEstate,'🏠 不動產')}
        ${inp('other',snap.other,'📦 其他投資')}
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wide pt-1">負債（TWD）</p>
        ${inp('debt',snap.debt,'💳 總負債')}
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-4 flex flex-col">
        <p class="text-xs font-bold text-slate-600 mb-3">🥧 資產配置</p>
        <div class="flex-1 min-h-0" style="height:220px"><canvas id="cvNWPie"></canvas></div>
      </div>
    </div>

    <!-- Trend -->
    ${sorted.length>=2?`
    <div class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-xs font-bold text-slate-600 mb-3">📈 淨資產趨勢（近 12 個月）</p>
      <div style="height:180px"><canvas id="cvNWLine"></canvas></div>
    </div>`:`
    <div class="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-700">
      💡 輸入本月數據並在下個月再次更新後，將自動生成趨勢曲線。建議每月底更新一次。
    </div>`}

    <!-- Health Checks -->
    <div class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-xs font-bold text-slate-600 mb-3">🏥 財務配置健診</p>
      <div id="nwChecks"></div>
    </div>

    <!-- History -->
    ${sorted.length>0?`
    <div class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-xs font-bold text-slate-600 mb-3">📋 歷史快照（最近 6 筆）</p>
      <div class="overflow-x-auto"><table class="w-full">
        <thead><tr class="text-[10px] text-slate-400 uppercase border-b border-slate-200">
          <th class="text-left px-3 pb-2">月份</th>
          <th class="text-right px-3 pb-2">淨資產</th>
          <th class="text-right px-3 pb-2">投資合計</th>
          <th class="text-right px-3 pb-2">現金+銀行</th>
        </tr></thead>
        <tbody>${histRows}</tbody>
      </table></div>
    </div>`:''}

    <p class="text-[11px] text-slate-400 text-center pb-4">⚠️ 資料僅存於您的瀏覽器本機，不會上傳至任何伺服器。僅供個人記錄，非投資建議。</p>
  </div>`;

  setTimeout(()=>{ nwDrawPie(snap); if(sorted.length>=2) nwDrawLine(sorted); nwUpdateChecks(snap); },60);
}
