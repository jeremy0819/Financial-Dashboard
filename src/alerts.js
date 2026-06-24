// ─── alerts.js ───────────────────────────────────────────
// 瀏覽器價格警報系統
// 依賴：core.js（toast）
// ─────────────────────────────────────────────────────────

const ALERT_KEY='kaku_alerts_v1';
function getAlerts(){ try{ return JSON.parse(localStorage.getItem(ALERT_KEY)||'[]'); }catch(e){ return []; } }
function saveAlerts(a){ try{ localStorage.setItem(ALERT_KEY,JSON.stringify(a)); }catch(e){} }

function alertRequestPermission(){
  if(!('Notification' in window)){ toast('此瀏覽器不支援通知','warn'); return; }
  Notification.requestPermission().then(p=>{ toast(p==='granted'?'✅ 通知權限已開啟':'❌ 通知未授權',p==='granted'?'success':'warn'); });
}

function alertFire(ticker, name, type, targetPrice, currentPrice){
  const title=`${name||ticker} 價格警報`;
  const body=`${type==='above'?'突破':'跌破'}目標價 ${targetPrice}（現價 ${currentPrice.toFixed(2)}）`;
  if(Notification.permission==='granted'){
    new Notification(title,{body,icon:'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📊</text></svg>'});
  }
  toast(`🔔 ${title}: ${body}`,type==='above'?'success':'warn');
}

function checkAlerts(){
  const alerts=getAlerts().filter(a=>a.enabled);
  alerts.forEach(a=>{
    const pr=pfPrices[a.ticker];
    if(!pr||pr.price==null) return;
    const price=pr.price;
    const hit=(a.type==='above'&&price>=a.targetPrice)||(a.type==='below'&&price<=a.targetPrice);
    if(hit){
      const last=a.lastFired; const now=Date.now();
      if(!last||now-last>3600000){ // 1h 間隔防重複
        alertFire(a.ticker,a.name||a.ticker,a.type,a.targetPrice,price);
        const all=getAlerts(); const idx=all.findIndex(x=>x.id===a.id);
        if(idx>=0){ all[idx].lastFired=now; saveAlerts(all); }
      }
    }
  });
}

function renderAlerts(){
  const alerts=getAlerts();
  const perm=('Notification' in window)?Notification.permission:'denied';
  const permBanner=perm!=='granted'?`<div class="mb-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center justify-between">
    <p class="text-xs text-amber-700">需要授權才能發送瀏覽器通知</p>
    <button onclick="alertRequestPermission()" class="text-xs px-2 py-1 bg-amber-600 text-white rounded font-bold hover:bg-amber-500">開啟通知</button>
  </div>`:'';
  const rows=alerts.map((a,i)=>`<div class="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0 text-xs">
    <input type="checkbox" ${a.enabled?'checked':''} onchange="alertToggle(${i},this.checked)" class="rounded">
    <span class="font-mono font-bold text-slate-700 w-20">${a.ticker}</span>
    <span class="text-slate-500">${a.type==='above'?'突破':'跌破'}</span>
    <span class="font-bold tabular-nums text-slate-800">${a.targetPrice}</span>
    <span class="ml-auto"><button onclick="alertDel(${i})" class="text-slate-300 hover:text-red-500">✕</button></span>
  </div>`).join('');
  return `<div class="space-y-3">
    <p class="text-xs font-bold text-slate-600">🔔 價格警報設定</p>
    ${permBanner}
    ${alerts.length?`<div>${rows}</div>`:'<p class="text-xs text-slate-400">尚無警報。在下方新增。</p>'}
    <div class="flex gap-1.5 flex-wrap items-end">
      <input id="alertTicker" placeholder="代號 (2330.TW)" class="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs font-mono w-28 focus:outline-none focus:border-blue-400">
      <select id="alertType" class="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs focus:outline-none">
        <option value="above">突破 ▲</option><option value="below">跌破 ▼</option>
      </select>
      <input id="alertPrice" type="number" placeholder="目標價" class="bg-slate-50 border border-slate-200 rounded px-2 py-1.5 text-xs w-24 text-right tabular-nums focus:outline-none focus:border-blue-400">
      <button onclick="alertAdd()" class="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded hover:bg-blue-500">＋ 新增</button>
    </div>
    <p class="text-[11px] text-slate-400">警報在「更新報價」後觸發，需保持頁面開啟。⚠️ 非盤中即時，以日收盤為準。</p>
  </div>`;
}

function alertAdd(){
  const ticker=(document.getElementById('alertTicker').value||'').trim().toUpperCase();
  const type=document.getElementById('alertType').value;
  const price=parseFloat(document.getElementById('alertPrice').value);
  if(!ticker||isNaN(price)){ toast('請填入代號與目標價','warn'); return; }
  const all=getAlerts();
  all.push({id:Date.now(),ticker,type,targetPrice:price,enabled:true,lastFired:null});
  saveAlerts(all);
  renderPortfolio();
  toast(`已新增警報：${ticker} ${type==='above'?'突破':'跌破'} ${price}`,'success');
}
function alertDel(i){ const a=getAlerts(); a.splice(i,1); saveAlerts(a); renderPortfolio(); }
function alertToggle(i,v){ const a=getAlerts(); if(a[i]) a[i].enabled=v; saveAlerts(a); }
