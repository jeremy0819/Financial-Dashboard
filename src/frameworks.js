// ═══ 機構級分析框架引擎（frameworks.js）═══════════════════
// 規格來源：機構級投資分析框架 v1.0（2026-07-10）
// 每個框架 = 輸入 → 判斷邏輯 → Signal 輸出
// 可自動計算：F2 多元化 / F3 風控 / F4 技術 / F6 估值(部分) / F7 情緒(proxy) / F9 成長股息
// 需 AI/人工：F1 市場掃描 / F5 總經 / F8 業績解讀 / F10 事件衝擊（無免費結構化資料源）
// ⚠️ 僅供參考，非投資建議

// ─── 閾值參數表（集中管理，依市場狀態調校）───────────────
const THRESHOLDS={
  ROE_MIN:0.15, ROA_MIN:0.08, FCF_NI_MIN:0.80,          // F6 品質/現金流
  DEBT_MFG_MAX:0.50, DEBT_IC_MAX:0.30,                  // F6 財務結構
  FIN_PB_MAX:1.5, FIN_YIELD_MIN:4.0,                    // F6 金融股估值（yield 用 %）
  SINGLE_STOCK_MAX:15, SINGLE_SECTOR_MAX:30,            // F2/F3 集中度（%）
  SINGLE_FACTOR_MAX:60, DEFENSE_MIN:15,                 // F2 因子/防禦層（%）
  SAT_POSITION_MAX:5, SAT_LOSS_ALERT:-10,               // F3 衛星紀律（%）
  RSI_OVERBOUGHT:70, RSI_OVERSOLD:30,                   // F4 技術
  BIAS_OVERHEAT:15,                                     // F7 60日正乖離過熱（%，個股用）
  SENTIMENT_GREED:80, SENTIMENT_FEAR:20,                // F7 情緒分數
  DIVIDEND_YIELD_MIN:4.0, DIVIDEND_TARGET_W:20          // F9 股息股門檻/建議配比（%）
};

// ─── Signal 工廠（時間戳記 + 來源標籤）─────────────────────
function mkSignal(framework,verdict,score,reasons,src){
  return { framework, verdict, score, reasons:reasons||[],
    source_tag:src||'framework', timestamp:new Date().toISOString(),
    data_date:new Date().toISOString().slice(0,10) };
}

// ─── 技術指標工具 ─────────────────────────────────────────
function fwSMA(arr,n){ if(!arr||arr.length<n) return null; return arr.slice(-n).reduce((s,v)=>s+v,0)/n; }
function fwRSI(closes,n=14){
  if(!closes||closes.length<n+1) return null;
  let gain=0,loss=0;
  for(let i=closes.length-n;i<closes.length;i++){
    const d=closes[i]-closes[i-1];
    if(d>0) gain+=d; else loss-=d;
  }
  if(gain+loss===0) return 50;
  const rs=loss===0?Infinity:(gain/n)/(loss/n);
  return loss===0?100:100-100/(1+rs);
}

// ─── 框架 4｜技術分析（Technical Analysis Engine）──────────
function fwTechnical(closes){
  if(!closes||closes.length<20) return mkSignal('technical','N/A',null,['價格資料不足（<20日）'],'data');
  const price=closes[closes.length-1];
  const ma20=fwSMA(closes,20), ma60=fwSMA(closes,60), ma120=fwSMA(closes,120);
  const rsi=fwRSI(closes,14);
  let trend='盤整';
  if(ma20&&ma60&&ma120){ if(ma20>ma60&&ma60>ma120) trend='多頭排列'; else if(ma20<ma60&&ma60<ma120) trend='空頭排列'; }
  let rsiState='中性';
  if(rsi!=null){ if(rsi>THRESHOLDS.RSI_OVERBOUGHT) rsiState='超買'; else if(rsi<THRESHOLDS.RSI_OVERSOLD) rsiState='超賣'; }
  const bias60=ma60?(price-ma60)/ma60*100:null; // 60日乖離（F7 情緒 proxy 借用）
  let verdict='HOLD', reasons=[];
  if(trend==='多頭排列'&&rsiState==='中性'&&ma20&&price>ma20){ verdict='HOLD/BUY'; reasons.push('多頭排列 + RSI 中性 + 站上月線'); }
  else if(ma20&&price<ma20&&trend!=='多頭排列'){ verdict='SELL/減碼'; reasons.push('跌破月線且非多頭排列'); }
  else if(rsiState==='超買'){ verdict='HOLD/慎追'; reasons.push('RSI 超買，追高風險'); }
  else if(rsiState==='超賣'&&trend!=='空頭排列'){ verdict='觀察買點'; reasons.push('RSI 超賣，非空頭排列'); }
  else reasons.push(`趨勢${trend}，RSI ${rsiState}`);
  const s=mkSignal('technical',verdict,null,reasons,'data');
  Object.assign(s,{price,ma20,ma60,ma120,rsi,trend,rsiState,bias60});
  return s;
}

// ─── 框架 3｜風險管理（Risk Management Engine）─────────────
function fwRisk(row,gross,tech){
  const reasons=[], flags={stop_loss_triggered:false,position_oversized:false,discipline_violation:false};
  const posPct=(row.value!=null&&gross)?row.value/gross*100:null;
  if(row.track==='satellite'&&tech&&tech.ma20&&tech.price<tech.ma20){
    flags.stop_loss_triggered=true;
    reasons.push(`跌破月線停損線（現價 ${tech.price.toFixed(1)} < MA20 ${tech.ma20.toFixed(1)}），分批出場`);
  }
  if(posPct!=null){
    if(row.track==='satellite'&&posPct>THRESHOLDS.SAT_POSITION_MAX){ flags.position_oversized=true; reasons.push(`衛星單檔 ${posPct.toFixed(1)}% > 上限 ${THRESHOLDS.SAT_POSITION_MAX}%`); }
    if(posPct>THRESHOLDS.SINGLE_STOCK_MAX){ flags.position_oversized=true; reasons.push(`單一持股 ${posPct.toFixed(1)}% > 上限 ${THRESHOLDS.SINGLE_STOCK_MAX}%`); }
  }
  if(row.track==='satellite'&&row.plPct!=null&&row.plPct<THRESHOLDS.SAT_LOSS_ALERT&&flags.stop_loss_triggered){
    flags.discipline_violation=true;
    reasons.push(`衛星虧損 ${row.plPct.toFixed(1)}% 超過 ${THRESHOLDS.SAT_LOSS_ALERT}% 且已破月線 — 違反停損紀律`);
  }
  const bad=flags.stop_loss_triggered||flags.position_oversized||flags.discipline_violation;
  const s=mkSignal('risk',bad?'ACTION':'OK',null,reasons.length?reasons:['風控檢查通過'],'framework');
  s.flags=flags; s.posPct=posPct;
  return s;
}

// ─── 框架 2｜投資組合多元化（Diversification Engine）───────
function fwDiversification(c){
  const g=c.gross||1, reasons=[], flags=[];
  const sectorW={};
  Object.entries(c.byInd).forEach(([k,v])=>{ sectorW[k]=v/g*100; });
  Object.entries(sectorW).forEach(([k,w])=>{
    if(w>THRESHOLDS.SINGLE_SECTOR_MAX) flags.push(`產業超標：${k} ${w.toFixed(1)}% > ${THRESHOLDS.SINGLE_SECTOR_MAX}%`);
  });
  // 單一因子暴露：半導體/電子零組件/其他電子 視為同一「科技因子」
  const techKeys=Object.keys(sectorW).filter(k=>/半導體|電子|光電|電腦|通信|資訊|美股/.test(k));
  const factorW=techKeys.reduce((s,k)=>s+sectorW[k],0);
  if(factorW>THRESHOLDS.SINGLE_FACTOR_MAX) flags.push(`科技單一因子 ${factorW.toFixed(1)}% > ${THRESHOLDS.SINGLE_FACTOR_MAX}% — 嚴重暴露`);
  const defPct=(c.byTrack.defense||0)/g*100;
  if(defPct<THRESHOLDS.DEFENSE_MIN) flags.push(`防禦層 ${defPct.toFixed(1)}% < 下限 ${THRESHOLDS.DEFENSE_MIN}%`);
  // 缺乏的防禦性板塊建議
  const has=k=>Object.keys(sectorW).some(x=>x.includes(k));
  const missing=[];
  if(!has('電信')&&!has('通信網路')) missing.push('電信（如 2412 中華電）');
  if(!has('食品')) missing.push('食品（如 1216 統一）');
  if(!has('金融')) missing.push('金融（如 2881 富邦金）');
  const s=mkSignal('diversification',flags.length?'FLAG':'OK',
    Math.max(0,100-flags.length*25),
    flags.length?flags:['集中度檢查通過'],'framework');
  s.sector_weights=sectorW; s.factor_exposure=factorW; s.suggested_sectors=missing;
  return s;
}

// ─── 框架 6｜價值投資六步驟（Value Screening，部分自動）────
// 可自動：Step4 估值（FinMind TaiwanStockPER：PE/PB/殖利率）
// 需 AI/人工：Step0 護城河、Step1 ROE/ROA、Step2 負債比、Step3 FCF（財報數據）
function fwValue(row,per){
  const checked=[], unchecked=['Step0 護城河（需質化判斷）','Step1 ROE/ROA（需財報）','Step2 負債結構（需財報）','Step3 FCF 品質（需財報）'];
  let verdict='INSUFFICIENT_DATA', reasons=[];
  if(!per){
    reasons.push(/\.TWO?$/.test(row.t)?'尚未取得 PER 數據':'美股無 TaiwanStockPER 數據源');
    const s=mkSignal('value',verdict,null,reasons,'data');
    s.checked=checked; s.unchecked=unchecked;
    return s;
  }
  const isFin=/金融|保險|銀行|金控/.test(row.industry||'');
  if(isFin){
    const pbPass=per.PBR!=null&&per.PBR<THRESHOLDS.FIN_PB_MAX;
    const yPass=per.dividend_yield!=null&&per.dividend_yield>THRESHOLDS.FIN_YIELD_MIN;
    checked.push(`金融框架 P/B ${per.PBR!=null?per.PBR.toFixed(2):'?'} ${pbPass?'✓':'✗'}（<${THRESHOLDS.FIN_PB_MAX}）`);
    checked.push(`殖利率 ${per.dividend_yield!=null?per.dividend_yield.toFixed(2):'?'}% ${yPass?'✓':'✗'}（>${THRESHOLDS.FIN_YIELD_MIN}%）`);
    verdict=(pbPass&&yPass)?'Step4 通過':'Step4 未過';
    reasons.push(pbPass&&yPass?'金融股估值框架通過':'金融股估值未達標');
  } else {
    // 一般股：PE 是否低於自身近一年中位數（歷史 PE 百分位 50% 的簡化）
    const pes=per.history||[];
    if(per.PER!=null&&pes.length>=60){
      const sortedPE=pes.slice().sort((a,b)=>a-b);
      const median=sortedPE[Math.floor(sortedPE.length/2)];
      const pass=per.PER<median;
      checked.push(`P/E ${per.PER.toFixed(1)} vs 近一年中位數 ${median.toFixed(1)} ${pass?'✓ 低於':'✗ 高於'}`);
      verdict=pass?'Step4 通過':'Step4 未過';
      reasons.push(pass?'估值低於自身歷史中位數':'估值高於自身歷史中位數（成長股需搭配成長率判斷）');
    } else {
      checked.push(`P/E ${per.PER!=null?per.PER.toFixed(1):'?'}（歷史樣本不足，無法算百分位）`);
      reasons.push('PE 百分位樣本不足');
    }
    if(per.dividend_yield!=null) checked.push(`殖利率 ${per.dividend_yield.toFixed(2)}%`);
  }
  const s=mkSignal('value',verdict,null,reasons,'data');
  s.checked=checked; s.unchecked=unchecked; s.per=per;
  return s;
}

// ─── 框架 9｜成長股 vs 股息股（Growth-Dividend Classifier）─
function fwGrowthDividend(rows,perMap,gross){
  let growthV=0,divV=0,mixV=0;
  const classified=rows.map(r=>{
    const per=perMap[r.t];
    let type='混合/未知';
    if(per&&per.dividend_yield!=null){
      if(per.dividend_yield>THRESHOLDS.DIVIDEND_YIELD_MIN) type='股息股';
      else if(per.dividend_yield<2) type='成長股';
    } else if(/金融|電信|食品/.test(r.industry||'')) type='股息股';
    else if(/半導體|電子|美股/.test(r.industry||'')) type='成長股';
    if(r.value!=null){
      if(type==='股息股') divV+=r.value; else if(type==='成長股') growthV+=r.value; else mixV+=r.value;
    }
    return {t:r.t,name:r.name||r.t,type,yield:per&&per.dividend_yield!=null?per.dividend_yield:null};
  });
  const g=gross||1;
  const growthW=growthV/g*100, divW=divV/g*100;
  const imbalance=divW<THRESHOLDS.DIVIDEND_TARGET_W&&growthW>60;
  const reasons=[`成長股 ${growthW.toFixed(1)}% ／ 股息股 ${divW.toFixed(1)}% ／ 混合 ${(mixV/g*100).toFixed(1)}%`];
  if(imbalance) reasons.push(`股息防禦配置不足（建議拉到 ${THRESHOLDS.DIVIDEND_TARGET_W}%）`);
  const s=mkSignal('growth_dividend',imbalance?'IMBALANCE':'OK',null,reasons,'framework');
  s.classified=classified; s.growthW=growthW; s.divW=divW;
  return s;
}

// ─── 框架 7｜市場情緒（Sentiment，proxy 版）────────────────
// 可自動：持股平均 60 日乖離（過熱 proxy）＋ 加密恐懼貪婪（跨市場情緒參考）
// 需 AI/人工：融資餘額、違約交割、分析師目標價修正（無免費結構化來源）
function fwSentiment(techMap){
  const biases=Object.values(techMap).map(t=>t&&t.bias60).filter(v=>v!=null);
  const avgBias=biases.length?biases.reduce((s,v)=>s+v,0)/biases.length:null;
  const hot=biases.filter(b=>b>THRESHOLDS.BIAS_OVERHEAT).length;
  let score=50, reasons=[];
  if(avgBias!=null){
    score=Math.max(0,Math.min(100,50+avgBias*2.5)); // 乖離 → 情緒分數線性映射
    reasons.push(`持股平均 60 日乖離 ${avgBias.toFixed(1)}%（${hot} 檔乖離 >${THRESHOLDS.BIAS_OVERHEAT}%）`);
  } else reasons.push('無足夠技術數據估算乖離');
  // 借用市場快報的加密 F&G（若已抓過）作跨市場情緒參考
  if(typeof mktCache!=='undefined'&&mktCache&&mktCache.fg){
    const fgVal=Number(mktCache.fg.data?.[0]?.value);
    if(!isNaN(fgVal)) reasons.push(`加密恐懼貪婪指數 ${fgVal}（跨市場情緒參考）`);
  }
  let state='中性', action='正常操作';
  if(score>THRESHOLDS.SENTIMENT_GREED){ state='貪婪'; action='反指標 — 收成而非追高'; }
  else if(score<THRESHOLDS.SENTIMENT_FEAR){ state='恐懼'; action='逆向布局機會'; }
  reasons.push('⚠️ 融資餘額／違約交割／目標價修正 需人工確認');
  const s=mkSignal('sentiment',state,Math.round(score),reasons,'framework');
  s.action_bias=action; s.avgBias=avgBias;
  return s;
}

// ─── 主控引擎（Orchestrator）────────────────────────────────
let instResult=null, instRunning=false;

async function instFetchOne(t){
  // 每檔抓 200 日收盤（算 MA120 需 120+ 交易日）＋ 台股加抓 PER 一年
  const isTW=/\.TWO?$/.test(t);
  const out={closes:null,per:null};
  try{
    if(isTW){
      const id=t.replace(/\.TWO?$/,'');
      const [px,perRaw]=await Promise.all([
        fmGet('TaiwanStockPrice',id,daysAgo(200)),
        fmGet('TaiwanStockPER',id,daysAgo(370))
      ]);
      out.closes=px.slice().sort((a,b)=>a.date<b.date?-1:1).map(p=>Number(p.close)).filter(v=>!isNaN(v));
      const pers=perRaw.slice().sort((a,b)=>a.date<b.date?-1:1);
      const lastPer=pers[pers.length-1];
      if(lastPer) out.per={ PER:Number(lastPer.PER)||null, PBR:Number(lastPer.PBR)||null,
        dividend_yield:Number(lastPer.dividend_yield)||null,
        history:pers.map(p=>Number(p.PER)).filter(v=>v>0) };
    } else {
      const px=await fmGet('USStockPrice',t,daysAgo(200));
      out.closes=px.slice().sort((a,b)=>a.date<b.date?-1:1).map(p=>Number(p.Close)).filter(v=>!isNaN(v));
    }
  }catch(e){}
  return out;
}

async function runInstitutional(){
  if(instRunning) return;
  const c=pfCompute();
  if(!c.rows.length){ toast('請先建立持股組合','warn'); return; }
  instRunning=true; renderPortfolio();
  const tickers=[...new Set(c.rows.map(r=>r.t).filter(Boolean))];
  const dataMap={};
  // 批次抓取（3 檔一批，避免 FinMind 免費版 429）
  for(let i=0;i<tickers.length;i+=3){
    const batch=tickers.slice(i,i+3);
    const res=await Promise.all(batch.map(t=>instFetchOne(t)));
    batch.forEach((t,j)=>dataMap[t]=res[j]);
  }
  // 逐檔跑 F4 技術 + F3 風控 + F6 估值
  const techMap={}, perMap={}, perStock=[];
  c.rows.forEach(r=>{
    const d=dataMap[r.t]||{};
    const tech=fwTechnical(d.closes);
    techMap[r.t]=tech;
    if(d.per) perMap[r.t]=d.per;
    perStock.push({ row:r, tech, risk:fwRisk(r,c.gross,tech), value:fwValue(r,d.per) });
  });
  // 組合層：F2 多元化 + F9 成長股息 + F7 情緒
  const divSig=fwDiversification(c);
  const gdSig=fwGrowthDividend(c.rows,perMap,c.gross);
  const sentSig=fwSentiment(techMap);
  // 健康分數（扣分制）與行動優先序
  let health=100; const flags=[], actions=[];
  perStock.forEach(p=>{
    const nm=p.row.name||p.row.t;
    if(p.risk.flags.discipline_violation){ health-=15; flags.push(`${nm} 違反停損紀律`); actions.push({pri:1,txt:`${nm}：停損（風控 F3 — ${p.row.plPct!=null?p.row.plPct.toFixed(1)+'%':''} 已破月線）`}); }
    else if(p.risk.flags.stop_loss_triggered){ health-=8; flags.push(`${nm} 觸發月線停損`); actions.push({pri:2,txt:`${nm}：分批出場（技術 F4 跌破月線）`}); }
    if(p.risk.flags.position_oversized){ health-=5; flags.push(`${nm} 部位超標`); actions.push({pri:3,txt:`${nm}：減碼至紀律上限內（風控 F3）`}); }
    if(p.value.verdict==='Step4 通過'&&p.tech.verdict==='HOLD/BUY') actions.push({pri:4,txt:`${nm}：估值＋技術雙訊號正向，可評估加碼（F6+F4）`});
  });
  divSig.reasons.forEach(r=>{ if(divSig.verdict==='FLAG'){ health-=8; flags.push(r); } });
  if(divSig.suggested_sectors.length) actions.push({pri:5,txt:`補防禦板塊：${divSig.suggested_sectors.join('、')}（多元化 F2）`});
  if(gdSig.verdict==='IMBALANCE'){ health-=6; flags.push('成長/股息配置失衡'); }
  if(sentSig.score>THRESHOLDS.SENTIMENT_GREED){ health-=5; flags.push('情緒過熱（proxy）'); }
  health=Math.max(0,Math.round(health));
  instResult={ health, flags, actions:actions.sort((a,b)=>a.pri-b.pri), perStock,
    divSig, gdSig, sentSig, data_date:new Date().toISOString().slice(0,10),
    ts:new Date().toLocaleString('zh-TW') };
  instRunning=false;
  renderPortfolio();
  toast(`機構健診完成：健康分數 ${health}`,health>=70?'success':'warn');
}

// ─── UI：機構健診分頁 ──────────────────────────────────────
function renderInstitutional(){
  const c=pfCompute();
  const priced=c.rows.some(r=>r.value!=null);
  let head=`<div class="flex items-center justify-between flex-wrap gap-2">
    <div><p class="text-sm font-bold text-slate-700">🏛️ 機構級健診 ${srcBadge('framework')}</p>
      <p class="text-[11px] text-slate-400 mt-0.5">10 框架規則引擎 ｜ 可自動：F2/F3/F4/F6*/F7*/F9 ｜ 需人工：F1/F5/F8/F10 ｜ 閾值集中於 THRESHOLDS</p></div>
    <button onclick="runInstitutional()" ${instRunning?'disabled':''} class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-400 text-white text-xs font-bold rounded-lg">${instRunning?'⏳ 分析中...':'🏛️ 執行健診'}</button>
  </div>`;
  if(!c.rows.length) return head+`<p class="text-xs text-slate-400 text-center py-8">尚無持股，請先於「持股管理」建立組合</p>`;
  if(!priced) head+=`<p class="text-[11px] text-amber-600 mt-2">💡 建議先在持股管理按「更新報價並分析」，權重計算才準確</p>`;
  if(!instResult) return head+`<p class="text-xs text-slate-400 text-center py-8">點「執行健診」開始 — 每檔抓 200 日收盤＋PER 估值數據（台股）</p>`;
  const R=instResult;
  const hcol=R.health>=70?'text-emerald-600':R.health>=40?'text-amber-500':'text-red-500';
  let html=head;
  // 健康分數 + 旗標
  html+=`<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
    <div class="bg-white border border-slate-200 rounded-xl p-4 text-center">
      <p class="text-[10px] text-slate-400 uppercase tracking-wide">Portfolio Health</p>
      <p class="text-4xl font-black ${hcol} mt-1">${R.health}</p>
      <p class="text-[10px] text-slate-400 mt-1">數據日 ${R.data_date} ｜ ${R.ts}</p>
    </div>
    <div class="bg-white border border-slate-200 rounded-xl p-4 md:col-span-2">
      <p class="text-xs font-bold text-slate-600 mb-2">🚩 風險旗標（${R.flags.length}）</p>
      ${R.flags.length?R.flags.map(f=>`<p class="text-[11px] text-red-500 leading-relaxed">• ${f}</p>`).join(''):'<p class="text-xs text-emerald-600">無風險旗標</p>'}
    </div>
  </div>`;
  // 行動優先序
  if(R.actions.length) html+=`<div class="bg-white border border-indigo-200 rounded-xl p-4 mt-3">
    <p class="text-xs font-bold text-slate-600 mb-2">📋 行動優先序 ${srcBadge('framework')}</p>
    ${R.actions.map((a,i)=>`<p class="text-[11px] text-slate-600 leading-relaxed"><b class="text-indigo-600">${i+1}.</b> ${a.txt}</p>`).join('')}
  </div>`;
  // 逐檔三維訊號表
  html+=`<div class="bg-white border border-slate-200 rounded-xl p-4 mt-3 overflow-x-auto ns">
    <p class="text-xs font-bold text-slate-600 mb-2">📊 逐檔三維訊號（技術 F4 ｜ 風控 F3 ｜ 估值 F6）</p>
    <table class="w-full text-[11px]"><thead><tr class="text-slate-400 border-b border-slate-200">
      <th class="px-1.5 py-1 text-left">標的</th><th class="px-1.5 py-1 text-left">趨勢</th><th class="px-1.5 py-1 text-right">RSI</th>
      <th class="px-1.5 py-1 text-left">技術判定</th><th class="px-1.5 py-1 text-left">風控</th><th class="px-1.5 py-1 text-left">估值 Step4</th>
    </tr></thead><tbody>
    ${R.perStock.map(p=>{
      const t=p.tech, riskBad=p.risk.verdict==='ACTION';
      const vCol=p.value.verdict==='Step4 通過'?'text-emerald-600':p.value.verdict==='Step4 未過'?'text-amber-600':'text-slate-400';
      return `<tr class="border-b border-slate-100 ${riskBad?'bg-red-50':''}">
        <td class="px-1.5 py-1.5 font-bold">${p.row.name||p.row.t}</td>
        <td class="px-1.5 py-1.5">${t.trend||'—'}</td>
        <td class="px-1.5 py-1.5 text-right tabular-nums">${t.rsi!=null?t.rsi.toFixed(0):'—'}</td>
        <td class="px-1.5 py-1.5">${t.verdict||'—'}</td>
        <td class="px-1.5 py-1.5 ${riskBad?'text-red-500 font-bold':'text-emerald-600'}">${riskBad?p.risk.reasons[0]:'✓'}</td>
        <td class="px-1.5 py-1.5 ${vCol}">${p.value.verdict}</td>
      </tr>`;
    }).join('')}
    </tbody></table>
    <p class="text-[10px] text-slate-400 mt-2">F6 僅自動檢查 Step4 估值（TaiwanStockPER）；Step0-3（護城河/ROE/負債/FCF）需財報數據或 AI 輔助</p>
  </div>`;
  // 組合層三卡
  html+=`<div class="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
    <div class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-xs font-bold text-slate-600 mb-2">🧩 多元化 F2 <span class="text-[10px] font-normal ${R.divSig.verdict==='OK'?'text-emerald-600':'text-red-500'}">${R.divSig.verdict}</span></p>
      ${R.divSig.reasons.map(r=>`<p class="text-[11px] text-slate-500 leading-relaxed">• ${r}</p>`).join('')}
      <p class="text-[10px] text-slate-400 mt-1.5">科技因子暴露 ${R.divSig.factor_exposure.toFixed(1)}%（上限 ${THRESHOLDS.SINGLE_FACTOR_MAX}%）</p>
    </div>
    <div class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-xs font-bold text-slate-600 mb-2">⚖️ 成長 vs 股息 F9 <span class="text-[10px] font-normal ${R.gdSig.verdict==='OK'?'text-emerald-600':'text-amber-600'}">${R.gdSig.verdict}</span></p>
      ${R.gdSig.reasons.map(r=>`<p class="text-[11px] text-slate-500 leading-relaxed">• ${r}</p>`).join('')}
      <div class="mt-1.5">${R.gdSig.classified.map(x=>`<span class="inline-block text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 mr-1 mb-1">${x.name} ${x.type}${x.yield!=null?' '+x.yield.toFixed(1)+'%':''}</span>`).join('')}</div>
    </div>
    <div class="bg-white border border-slate-200 rounded-xl p-4">
      <p class="text-xs font-bold text-slate-600 mb-2">🌡️ 情緒 F7 <span class="text-[10px] font-normal">${R.sentSig.verdict} ${R.sentSig.score}</span></p>
      ${R.sentSig.reasons.map(r=>`<p class="text-[11px] text-slate-500 leading-relaxed">• ${r}</p>`).join('')}
      <p class="text-[11px] font-bold ${R.sentSig.score>THRESHOLDS.SENTIMENT_GREED?'text-red-500':'text-slate-600'} mt-1">→ ${R.sentSig.action_bias}</p>
    </div>
  </div>`;
  // 需人工框架說明
  html+=`<div class="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-3">
    <p class="text-xs font-bold text-slate-500 mb-1.5">🤝 需 AI/人工輔助的框架（無免費結構化資料源）</p>
    <p class="text-[11px] text-slate-400 leading-relaxed">F1 市場掃描（族群資金流/題材輪動）｜ F5 總經傳導（GDP/CPI/匯率→類股）｜ F8 業績解讀（財報 vs 共識/指引方向）｜ F10 事件衝擊（地緣/黑天鵝）。這些判斷請搭配個股分析的 AI 模式或人工研究，結論標注【AI/人工】來源。</p>
  </div>
  <p class="text-[11px] text-slate-400 text-center mt-3">⚠️ 規則引擎輸出僅供紀律輔助參考，非投資建議 ｜ 閾值見 THRESHOLDS（frameworks.js）</p>`;
  return html;
}
