// ---------- V5.2 STABLE AIRCRAFT OPS SHELL ----------
// Keeps the complete Ops workspace visible, puts Status/RTS in its own tab,
// and isolates each rich Ops tab so one render error cannot hide the others.

(function(){
  const style=document.createElement('style');
  style.textContent=`
    .ops-tabs-stable{flex-wrap:wrap;overflow-x:visible;scrollbar-width:none;padding-bottom:11px}
    .ops-tabs-stable::-webkit-scrollbar{display:none}
    .ops-tabs-stable button{flex:0 0 auto}
    .ops-module-error{margin-bottom:12px}
    .ops-fallback-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
    .ops-fallback-card{border:1px solid #dfe7ef;border-radius:10px;padding:12px;background:#fbfcfe}
    .ops-fallback-card span,.ops-fallback-card b,.ops-fallback-card small{display:block}.ops-fallback-card span,.ops-fallback-card small{color:#718599}.ops-fallback-card b{margin:4px 0}
    @media(max-width:760px){.ops-fallback-grid{grid-template-columns:1fr}.ops-tabs-stable{flex-wrap:nowrap;overflow-x:auto;margin-left:-4px;margin-right:-4px;padding-left:4px;padding-right:4px}}
  `;
  document.head.appendChild(style);
})();

const STABLE_OPS_TABS=[
  ['status','Status / RTS'],
  ['configuration','Configuration'],
  ['inspections','Inspections'],
  ['specs','Specs / Setup'],
  ['consumables','Consumables'],
  ['costs','Costs'],
  ['trends','Test Trends'],
  ['flightcards','Flight Cards'],
  ['timeline','Timeline'],
  ['reports','Reports']
];

window.__n594zsStableOpsTab=sessionStorage.getItem('n594zs_ops_tab')||'status';
if(!STABLE_OPS_TABS.some(x=>x[0]===window.__n594zsStableOpsTab))window.__n594zsStableOpsTab='status';

function stableOpsContent(){return document.getElementById('opsContent')}
function stableOpsError(tab,e){
  console.error(`Aircraft Ops ${tab} failed`,e);
  const box=stableOpsContent();if(!box)return;
  box.innerHTML=`<div class="warning ops-module-error"><b>${esc(STABLE_OPS_TABS.find(x=>x[0]===tab)?.[1]||tab)} hit a display error.</b><br><span class="small">${esc(e?.message||String(e||'Unknown error'))}</span><br><span class="tiny muted">The rest of Aircraft Ops is still available from the tabs above.</span></div>`+stableOpsFallback(tab);
}
function stableOpsFallback(tab){
  const configs=arr(db.configurations),inspections=arr(db.inspections),specs=arr(db.specs),cards=arr(db.flightCards),runs=arr(db.runs),parts=arr(db.parts),projects=arr(db.projects),squawks=arr(db.squawks);
  if(tab==='configuration'){
    const active=configs.find(x=>x.status==='Active')||configs[0];
    return `<div class="ops-panel"><div class="section-tools"><div><h2>Configuration</h2><div class="muted">Recorded aircraft configuration revisions.</div></div>${typeof openConfigurationModal==='function'?'<button class="primary" onclick="openConfigurationModal()">+ Configuration</button>':''}</div>${active?`<div class="config-grid"><div class="config-kv"><span>Current</span><b>${esc(active.name||'Configuration')}</b></div><div class="config-kv"><span>Effective</span><b>${esc(active.effectiveDate||'—')}</b></div><div class="config-kv"><span>Fuel</span><b>${active.fuelCapacityGal!==''?esc(active.fuelCapacityGal+' gal'):'—'}</b></div><div class="config-kv"><span>Status</span><b>${esc(active.status||'—')}</b></div></div><div class="detail-text" style="margin-top:12px">${esc(active.notes||active.fuelConfig||'No configuration notes recorded.')}</div>`:'<div class="empty">No configuration revision recorded yet.</div>'}</div>`;
  }
  if(tab==='inspections')return `<div class="ops-panel"><div class="section-tools"><div><h2>Inspections</h2><div class="muted">${inspections.length} structured inspection record${inspections.length===1?'':'s'}.</div></div>${typeof openInspectionModal==='function'?'<button class="primary" onclick="openInspectionModal()">+ Inspection</button>':''}</div>${inspections.map(i=>`<div class="kv ${typeof openInspectionDetail==='function'?'click-row':''}" ${typeof openInspectionDetail==='function'?`onclick="openInspectionDetail('${esc(i.id)}')"`:''}><div><b>${esc(i.title||'Inspection')}</b><div class="task-note">${esc(i.date||'')} • ${esc(i.type||'')}</div></div>${pill(i.status||'Open')}</div>`).join('')||'<div class="empty">No inspections yet.</div>'}</div>`;
  if(tab==='specs')return `<div class="ops-panel"><div class="section-tools"><div><h2>Specs / Setup</h2><div class="muted">${specs.length} stored reference${specs.length===1?'':'s'}.</div></div>${typeof openSpecModal==='function'?'<button class="primary" onclick="openSpecModal()">+ Reference</button>':''}</div>${specs.map(s=>`<div class="kv ${typeof openSpecDetail==='function'?'click-row':''}" ${typeof openSpecDetail==='function'?`onclick="openSpecDetail('${esc(s.id)}')"`:''}><div><b>${esc(s.title||'Reference')}</b><div class="task-note">${esc(s.system||'General')} • ${esc(s.source||'No source recorded')}</div></div><div><b>${esc(s.value||'—')} ${esc(s.units||'')}</b><div class="tiny right">${esc(s.status||'')}</div></div></div>`).join('')||'<div class="empty">No stored specifications/setup references yet.</div>'}</div>`;
  if(tab==='consumables'){
    const rows=parts.filter(p=>p.partType==='Consumable');
    return `<div class="ops-panel"><h2>Consumables</h2>${rows.map(p=>`<div class="kv click-row" onclick="openPartDetail(${p.id})"><div><b>${esc(p.name)}</b><div class="task-note">${esc(p.system||'General')}</div></div><b>${partAvailable(p)===null?'—':esc(partAvailable(p)+' '+(p.unit||''))}</b></div>`).join('')||'<div class="empty">No Parts are classified as Consumable yet.</div>'}</div>`;
  }
  if(tab==='costs'){
    const purchaseSpend=arr(db.purchases).reduce((s,p)=>s+(p.unitPrice===''||p.unitPrice==null?0:num(p.qty)*num(p.unitPrice)),0);
    const invoiceSpend=arr(db.invoices).reduce((s,i)=>s+num(i.total),0);
    return `<div class="ops-panel"><h2>Costs</h2><div class="ops-fallback-grid"><div class="ops-fallback-card"><span>Purchase-line spend</span><b>${fmtMoney(purchaseSpend)}</b><small>Known line prices</small></div><div class="ops-fallback-card"><span>Invoice/order totals</span><b>${fmtMoney(invoiceSpend)}</b><small>${arr(db.invoices).length} invoice/order records</small></div><div class="ops-fallback-card"><span>Equipment values</span><b>${fmtMoney(arr(db.equipment).reduce((s,e)=>s+num(e.purchasePrice),0))}</b><small>Separate view; do not add blindly</small></div></div></div>`;
  }
  if(tab==='trends')return `<div class="ops-panel"><div class="section-tools"><div><h2>Test Trends</h2><div class="muted">${runs.length} run/test record${runs.length===1?'':'s'} available for trend analysis.</div></div>${typeof openRunModal==='function'?'<button class="primary" onclick="openRunModal()">+ Run / Test</button>':''}</div><div class="table-wrap"><table><thead><tr><th>Date</th><th>Type</th><th>Max RPM</th><th>Oil P min</th><th>Oil T max</th><th>Coolant T max</th><th>Outcome</th></tr></thead><tbody>${[...runs].sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,20).map(r=>`<tr ${typeof openRunDetail==='function'?`class="click-row" onclick="openRunDetail(${r.id})"`:''}><td>${esc(r.date||'—')}</td><td>${esc(r.type||'—')}</td><td>${esc(r.rpmMax||'—')}</td><td>${esc(r.oilPressureMin||'—')}</td><td>${esc(r.oilTempMax||'—')}</td><td>${esc(r.coolantTempMax||'—')}</td><td>${esc(r.outcome||'—')}</td></tr>`).join('')||'<tr><td colspan="7" class="empty">No run/test data yet.</td></tr>'}</tbody></table></div></div>`;
  if(tab==='flightcards')return `<div class="ops-panel"><div class="section-tools"><div><h2>Flight Cards</h2><div class="muted">Structured test-point cards for recording planned objectives and actual results.</div></div><div class="action-row">${typeof newFirstFlightCard==='function'?'<button class="secondary" onclick="newFirstFlightCard()">+ First-Flight Template</button>':''}${typeof openFlightCardModal==='function'?'<button class="primary" onclick="openFlightCardModal()">+ Blank Card</button>':''}</div></div><div class="notice">Use applicable operating limitations, aircraft/engine documentation and your own approved test planning. These cards organize data; they do not authorize a flight.</div><div class="table-wrap" style="margin-top:12px"><table><thead><tr><th>Date</th><th>Card</th><th>Status</th><th>Points</th></tr></thead><tbody>${cards.map(f=>`<tr ${typeof openFlightCardDetail==='function'?`class="click-row" onclick="openFlightCardDetail('${esc(f.id)}')"`:''}><td>${esc(f.date||'—')}</td><td><b>${esc(f.title||'Flight-test card')}</b><div class="task-note">${esc(f.conditions||f.notes||'')}</div></td><td>${pill(f.status||'Planned')}</td><td>${arr(f.items).filter(x=>x.result!=='Pending').length}/${arr(f.items).length}</td></tr>`).join('')||'<tr><td colspan="4" class="empty">No flight-test cards yet.</td></tr>'}</tbody></table></div></div>`;
  if(tab==='timeline'){
    const events=[];
    projects.forEach(p=>events.push({date:p.updates?.[0]?.date||'',kind:'Project',title:p.title,sub:p.status}));
    arr(db.logs).forEach(x=>events.push({date:x.date||'',kind:'Work',title:x.work||'Work entry',sub:x.system||''}));
    runs.forEach(x=>events.push({date:x.date||'',kind:'Run/Test',title:x.type||'Run/Test',sub:x.outcome||''}));
    squawks.forEach(x=>events.push({date:x.discoveredDate||'',kind:'Squawk',title:x.title||'Squawk',sub:x.status||''}));
    configs.forEach(x=>events.push({date:x.effectiveDate||'',kind:'Configuration',title:x.name||'Configuration',sub:x.status||''}));
    inspections.forEach(x=>events.push({date:x.date||'',kind:'Inspection',title:x.title||'Inspection',sub:x.status||''}));
    cards.forEach(x=>events.push({date:x.date||'',kind:'Flight Card',title:x.title||'Flight card',sub:x.status||''}));
    events.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    return `<div class="ops-panel"><h2>Aircraft Timeline</h2><div class="aircraft-timeline">${events.slice(0,150).map(e=>`<div class="timeline-event"><div class="timeline-date-badge">${esc(e.date||'—')}</div><div><span class="mini-badge">${esc(e.kind)}</span><b>${esc(e.title)}</b><small>${esc(e.sub||'')}</small></div></div>`).join('')||'<div class="empty">No timeline events yet.</div>'}</div></div>`;
  }
  if(tab==='reports'){
    const since=new Date();since.setDate(since.getDate()-30);const iso=since.toISOString().slice(0,10);
    const recentLogs=arr(db.logs).filter(x=>(x.date||'')>=iso).length,recentRuns=runs.filter(x=>(x.date||'')>=iso).length,recentSq=squawks.filter(x=>(x.discoveredDate||'')>=iso).length;
    return `<div class="ops-panel"><div class="section-tools"><div><h2>Reports</h2><div class="muted">Quick 30-day tracker summary.</div></div><button class="secondary" onclick="window.print()">Print</button></div><div class="report-summary"><div><span>Work entries</span><b>${recentLogs}</b></div><div><span>Runs / tests</span><b>${recentRuns}</b></div><div><span>New squawks</span><b>${recentSq}</b></div><div><span>Open projects</span><b>${projects.filter(p=>p.status!=='Done').length}</b></div></div>${typeof renderOpsReports==='function'?'<div class="notice">The full “What Changed Since…” report is available when this tab’s rich renderer loads.</div>':''}</div>`;
  }
  return '<div class="empty">No data for this Ops tab yet.</div>';
}

function stableRenderStatus(){
  const box=stableOpsContent();if(!box)return;
  const status=typeof smartStatusBoardHTML==='function'?smartStatusBoardHTML(false):`<div class="ops-fallback-grid"><div class="ops-fallback-card"><span>Open projects</span><b>${arr(db.projects).filter(p=>p.status!=='Done').length}</b></div><div class="ops-fallback-card"><span>Open squawks</span><b>${arr(db.squawks).filter(s=>s.status!=='Resolved').length}</b></div><div class="ops-fallback-card"><span>Inspections</span><b>${arr(db.inspections).length}</b></div></div>`;
  box.innerHTML=`<div class="ops-panel"><div class="toolbar"><div><h2>Aircraft Status / RTS Closeout</h2><div class="muted">A tracker-based view of remaining work and discrepancies.</div></div><div class="action-row"><button class="secondary" onclick="navTo('readiness')">Open Readiness</button><button class="secondary" onclick="navTo('squawks')">Open Squawks</button></div></div>${status}<div class="notice" style="margin-top:12px">This is an organizational summary of tracker records, not an airworthiness determination or return-to-service approval.</div></div>`;
}

function stableRunRichTab(tab){
  const legacy={configuration:'renderOpsConfiguration',inspections:'renderOpsInspections',specs:'renderOpsSpecs',consumables:'renderOpsConsumables',costs:'renderOpsCosts',trends:'renderOpsTrends',flightcards:'renderOpsFlightCards',timeline:'renderOpsTimeline',reports:'renderOpsReports'}[tab];
  if(tab==='status'){stableRenderStatus();return}
  try{
    if(tab==='flightcards'&&typeof window.renderFlightCardsStarter==='function'){
      window.renderFlightCardsStarter();
      return;
    }
    const fn=legacy&&window[legacy];
    if(typeof fn!=='function')throw new Error(`${legacy||tab} is unavailable`);
    fn();
  }catch(e){stableOpsError(tab,e)}
}

setOpsTab=function(tab){
  if(!STABLE_OPS_TABS.some(x=>x[0]===tab))tab='status';
  window.__n594zsStableOpsTab=tab;sessionStorage.setItem('n594zs_ops_tab',tab);renderOps();
};

renderOps=function(){
  const page=document.getElementById('page-ops');if(!page)return;
  const tab=window.__n594zsStableOpsTab||'status';
  page.innerHTML=`<div class="card ops-shell"><div class="toolbar"><div><h1>Aircraft Ops</h1><div class="muted">Configuration, inspections, references, consumables, costs, test data, flight cards and aircraft history for N594ZS.</div></div><div class="action-row"><span class="mini-badge">10 workspaces</span><span class="mini-badge">v5.2 stable</span></div></div><div class="ops-tabs ops-tabs-stable">${STABLE_OPS_TABS.map(([k,l])=>`<button class="${tab===k?'active':''}" onclick="setOpsTab('${k}')">${esc(l)}</button>`).join('')}</div><div id="opsContent"></div></div>`;
  stableRunRichTab(tab);
};

// v5.1 inserted the status board above the rich tab strip. v5.2 makes Status a real tab instead.
injectSmartOpsStatus=function(){};
