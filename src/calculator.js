// ─── calculator.js ───────────────────────────────────────
// 投資計算器
// 依賴：core.js（fmtNum, toast）
// ─────────────────────────────────────────────────────────

let calcChartCompound=null, calcChartDCA=null;

function renderCalc(){
  const el=document.getElementById('calcPanel'); if(!el) return;
  el.innerHTML=`<div class="max-w-4xl mx-auto space-y-4 fade-in">
    <div class="flex items-center gap-3 flex-wrap">
      <p class="text-base font-bold text-slate-800">🧮 投資計算器</p>
      <span class="text-xs text-slate-400">複利・定存・定期定額三合一試算工具</span>
    </div>

    <!-- 複利試算 -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <p class="text-sm font-bold text-slate-700 mb-3">📈 複利試算（一次性投入）</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><label class="text-xs text-slate-400 block mb-1">初始本金（元）</label>
          <input id="c_principal" type="number" value="100000" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"></div>
        <div><label class="text-xs text-slate-400 block mb-1">年化報酬率（%）</label>
          <input id="c_rate" type="number" value="8" step="0.1" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"></div>
        <div><label class="text-xs text-slate-400 block mb-1">投資年數</label>
          <input id="c_years" type="number" value="20" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"></div>
        <div class="flex items-end">
          <button onclick="calcCompound()" class="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 rounded-lg">計算</button>
        </div>
      </div>
      <div id="c_result" class="hidden grid grid-cols-3 gap-3">
        <div class="bg-blue-50 rounded-xl p-3 text-center"><p class="text-xs text-slate-400 mb-1">最終資產</p><p id="c_final" class="text-xl font-bold text-blue-700 tabular-nums"></p></div>
        <div class="bg-emerald-50 rounded-xl p-3 text-center"><p class="text-xs text-slate-400 mb-1">利息收益</p><p id="c_interest" class="text-xl font-bold text-emerald-600 tabular-nums"></p></div>
        <div class="bg-slate-50 rounded-xl p-3 text-center"><p class="text-xs text-slate-400 mb-1">報酬率倍數</p><p id="c_multi" class="text-xl font-bold text-slate-700 tabular-nums"></p></div>
      </div>
      <div style="position:relative;height:220px;width:100%"><canvas id="cvCompound"></canvas></div>
    </div>

    <!-- 定期定額試算 -->
    <div class="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
      <p class="text-sm font-bold text-slate-700 mb-3">📅 定期定額試算（月定投）</p>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div><label class="text-xs text-slate-400 block mb-1">每月投入（元）</label>
          <input id="d_monthly" type="number" value="10000" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"></div>
        <div><label class="text-xs text-slate-400 block mb-1">年化報酬率（%）</label>
          <input id="d_rate" type="number" value="8" step="0.1" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"></div>
        <div><label class="text-xs text-slate-400 block mb-1">投資年數</label>
          <input id="d_years" type="number" value="20" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"></div>
        <div class="flex items-end">
          <button onclick="calcDCA()" class="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 rounded-lg">計算</button>
        </div>
      </div>
      <div id="d_result" class="hidden grid grid-cols-3 gap-3">
        <div class="bg-blue-50 rounded-xl p-3 text-center"><p class="text-xs text-slate-400 mb-1">最終資產</p><p id="d_final" class="text-xl font-bold text-blue-700 tabular-nums"></p></div>
        <div class="bg-slate-50 rounded-xl p-3 text-center"><p class="text-xs text-slate-400 mb-1">累計投入</p><p id="d_invested" class="text-xl font-bold text-slate-600 tabular-nums"></p></div>
        <div class="bg-emerald-50 rounded-xl p-3 text-center"><p class="text-xs text-slate-400 mb-1">投資收益</p><p id="d_gains" class="text-xl font-bold text-emerald-600 tabular-nums"></p></div>
      </div>
      <div style="position:relative;height:220px;width:100%"><canvas id="cvDCA"></canvas></div>
    </div>

    <!-- 72法則 + 台灣定存試算 -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div class="bg-white border border-slate-200 rounded-xl p-5">
        <p class="text-sm font-bold text-slate-700 mb-3">⚡ 72法則（翻倍所需年數）</p>
        <div class="flex gap-2 mb-3">
          <div class="flex-1"><label class="text-xs text-slate-400 block mb-1">年報酬率（%）</label>
            <input id="r72" type="number" value="8" step="0.1" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" oninput="calc72()"></div>
        </div>
        <div class="bg-purple-50 rounded-xl p-4 text-center">
          <p class="text-xs text-slate-400 mb-1">資產翻倍需要</p>
          <p id="r72result" class="text-3xl font-bold text-purple-700 tabular-nums">9.0 年</p>
        </div>
        <div class="mt-3 space-y-1 text-xs text-slate-500">
          <div class="flex justify-between"><span>台灣定存 ~1.5%</span><span class="font-bold">48.0 年</span></div>
          <div class="flex justify-between"><span>台股大盤 ~10%</span><span class="font-bold">7.2 年</span></div>
          <div class="flex justify-between"><span>標普 500 ~11%</span><span class="font-bold">6.5 年</span></div>
        </div>
      </div>
      <div class="bg-white border border-slate-200 rounded-xl p-5">
        <p class="text-sm font-bold text-slate-700 mb-3">🏦 台灣定存試算</p>
        <div class="space-y-2">
          <div><label class="text-xs text-slate-400 block mb-1">存入金額（元）</label>
            <input id="td_amt" type="number" value="500000" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"></div>
          <div><label class="text-xs text-slate-400 block mb-1">年利率（%，目前約 1.5–2.0%）</label>
            <input id="td_rate" type="number" value="1.65" step="0.05" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"></div>
          <div><label class="text-xs text-slate-400 block mb-1">存款期間（月）</label>
            <input id="td_months" type="number" value="12" class="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"></div>
          <button onclick="calcTD()" class="w-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold py-2 rounded-lg">計算</button>
          <div id="td_result" class="hidden bg-emerald-50 rounded-xl p-3 grid grid-cols-2 gap-2 text-center">
            <div><p class="text-xs text-slate-400 mb-0.5">到期金額</p><p id="td_final" class="font-bold text-emerald-700 tabular-nums"></p></div>
            <div><p class="text-xs text-slate-400 mb-0.5">利息收益</p><p id="td_int" class="font-bold text-emerald-700 tabular-nums"></p></div>
          </div>
        </div>
      </div>
    </div>
    <p class="text-[11px] text-slate-400 text-center pt-1">⚠️ 計算結果為試算參考，不構成投資建議。實際報酬受市場波動影響。</p>
  </div>`;
  calcCompound(); calcDCA(); calc72();
}

function calcCompound(){
  const P=Number(document.getElementById('c_principal')?.value)||100000;
  const r=Number(document.getElementById('c_rate')?.value)/100||0.08;
  const y=Number(document.getElementById('c_years')?.value)||20;
  const final=P*Math.pow(1+r,y), interest=final-P;
  const res=document.getElementById('c_result'); if(res) res.classList.remove('hidden');
  const set=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  set('c_final','NT$'+fmtNum(final));
  set('c_interest','NT$'+fmtNum(interest));
  set('c_multi',(final/P).toFixed(2)+'x');
  // Chart
  const el=document.getElementById('cvCompound'); if(!el||typeof Chart==='undefined') return;
  if(calcChartCompound) calcChartCompound.destroy();
  const labels=[], principal=[], total=[];
  for(let i=0;i<=y;i++){ labels.push(i+'年'); principal.push(Math.round(P)); total.push(Math.round(P*Math.pow(1+r,i))); }
  calcChartCompound=new Chart(el.getContext('2d'),{type:'line',
    data:{labels,datasets:[
      {label:'本金',data:principal,borderColor:'#cbd5e1',borderWidth:1.5,pointRadius:0,fill:false},
      {label:'含複利',data:total,borderColor:'#3b82f6',borderWidth:2,pointRadius:0,backgroundColor:'rgba(59,130,246,0.1)',fill:true}
    ]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{labels:{boxWidth:10,font:{size:10}}}},
      scales:{x:{ticks:{maxTicksLimit:8,font:{size:9}}},y:{position:'right',ticks:{callback:v=>'NT$'+fmtNum(v),font:{size:9}}}}}});
}

function calcDCA(){
  const monthly=Number(document.getElementById('d_monthly')?.value)||10000;
  const r=Number(document.getElementById('d_rate')?.value)/100/12||0.08/12;
  const y=Number(document.getElementById('d_years')?.value)||20;
  const n=y*12;
  const final=monthly*(Math.pow(1+r,n)-1)/r*(1+r);
  const invested=monthly*n;
  const res=document.getElementById('d_result'); if(res) res.classList.remove('hidden');
  const set=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  set('d_final','NT$'+fmtNum(final));
  set('d_invested','NT$'+fmtNum(invested));
  set('d_gains','NT$'+fmtNum(final-invested));
  const el=document.getElementById('cvDCA'); if(!el||typeof Chart==='undefined') return;
  if(calcChartDCA) calcChartDCA.destroy();
  const labels=[], inv=[], tot=[];
  for(let m=0;m<=n;m+=Math.max(1,Math.floor(n/40))){
    const fv=m===0?0:monthly*(Math.pow(1+r,m)-1)/r*(1+r);
    labels.push(Math.floor(m/12)+'年'); inv.push(Math.round(monthly*m)); tot.push(Math.round(fv));
  }
  calcChartDCA=new Chart(el.getContext('2d'),{type:'bar',
    data:{labels,datasets:[
      {label:'累計投入',data:inv,backgroundColor:'rgba(203,213,225,0.7)'},
      {label:'累計獲益',data:tot.map((v,i)=>Math.max(0,v-inv[i])),backgroundColor:'rgba(16,185,129,0.6)',stack:'s'},
    ]},
    options:{responsive:true,maintainAspectRatio:false,animation:false,
      plugins:{legend:{labels:{boxWidth:10,font:{size:10}}}},
      scales:{x:{stacked:true,ticks:{maxTicksLimit:8,font:{size:9}}},y:{stacked:false,position:'right',ticks:{callback:v=>'NT$'+fmtNum(v),font:{size:9}}}}}});
}

function calc72(){
  const r=Number(document.getElementById('r72')?.value)||8;
  const el=document.getElementById('r72result'); if(el) el.textContent=(72/r).toFixed(1)+' 年';
}

function calcTD(){
  const amt=Number(document.getElementById('td_amt')?.value)||500000;
  const rate=Number(document.getElementById('td_rate')?.value)/100||0.0165;
  const months=Number(document.getElementById('td_months')?.value)||12;
  const interest=amt*rate*(months/12);
  const final=amt+interest;
  const res=document.getElementById('td_result'); if(res) res.classList.remove('hidden');
  const set=(id,v)=>{ const e=document.getElementById(id); if(e) e.textContent=v; };
  set('td_final','NT$'+fmtNum(final));
  set('td_int','NT$'+fmtNum(interest)+` (稅後約NT$${fmtNum(interest*0.8)})`);
}
