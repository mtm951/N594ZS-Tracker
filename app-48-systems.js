// ---------- V5.8 FIRST-CLASS SYSTEM DASHBOARDS ----------
// Derived cross-record view: Aircraft -> System -> projects / squawks / equipment /
// parts / maintenance / documents / work / purchases. No new persisted data model.
(function(){
  if(window.__n594zsSystemsInstalled)return;
  window.__n594zsSystemsInstalled=true;

  if(!NAV.some(x=>x[0]==='systems')){
    const aircraftIndex=NAV.findIndex(x=>x[0]==='aircraft');
    NAV.splice(aircraftIndex<0?1:aircraftIndex+1,0,['systems','Systems']);
  }

  let activeSystemName='';

  const A=v=>Array.isArray(v)?v:[];
  const T=v=>String(v??'').trim();
  const same=(a,b)=>T(a).toLowerCase()===T(b).toLowerCase();
  const J=v=>esc(JSON.stringify(T(v)));
  const money=v=>typeof fmtMoney==='function'?fmtMoney(v):('$'+Number(v||0).toFixed(2));
  const visibleCost=v=>db.settings?.showCosts?money(v):'Hidden';
  const purchaseTotal=p=>Number(p?.qty||0)*Number(p?.unitPrice||0);
  const openProject=p=>p?.status!=='Done';
  const openSquawk=s=>s?.status!=='Resolved';
  const systemMatches=(record,name)=>record&&same(record.system,name);

  function systemNames(){
    const names=[];
    const add=v=>{const s=T(v);if(s&&!names.some(x=>same(x,s)))names.push(s)};
    [
      A(db.projects),A(db.parts),A(db.logs),A(db.docs),A(db.checklists),
      A(db.maintenance),A(db.squawks),A(db.purchases),A(db.equipment),A(db.specs)
    ].forEach(list=>list.forEach(x=>add(x?.system)));
    return names.sort((a,b)=>a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'}));
  }

  window.systemNames=systemNames;

  // Make every system picker draw from the whole tracker rather than only four record types.
  const systemOptionsBase=typeof systemOptions==='function'?systemOptions:null;
  if(systemOptionsBase){
    systemOptions=function(current){return selectOptions(systemNames(),current,'— Select system —')};
  }

  function systemData(name){
    const projects=A(db.projects).filter(x=>systemMatches(x,name));
    const parts=A(db.parts).filter(x=>systemMatches(x,name));
    const logs=A(db.logs).filter(x=>systemMatches(x,name));
    const docs=A(db.docs).filter(x=>systemMatches(x,name));
    const checklists=A(db.checklists).filter(x=>systemMatches(x,name));
    const maintenance=A(db.maintenance).filter(x=>systemMatches(x,name));
    const squawks=A(db.squawks).filter(x=>systemMatches(x,name));
    const purchases=A(db.purchases).filter(x=>systemMatches(x,name));
    const equipment=A(db.equipment).filter(x=>systemMatches(x,name));
    const specs=A(db.specs).filter(x=>systemMatches(x,name));
    const orders=A(db.orders).filter(o=>{
      const pr=o?.projectId&&typeof projectById==='function'?projectById(o.projectId):null;
      const pt=o?.partId&&typeof partById==='function'?partById(o.partId):null;
      return systemMatches(pr,name)||systemMatches(pt,name);
    });
    const openOrders=orders.filter(o=>typeof isClosedOrder==='function'?!isClosedOrder(o):!['Received','Cancelled'].includes(o.status));
    const activeProjects=projects.filter(openProject);
    const unresolvedSquawks=squawks.filter(openSquawk);
    const installedEquipment=equipment.filter(x=>x.status==='Installed');
    const dueMaintenance=maintenance.filter(x=>typeof maintenanceDueInfo==='function'&&['Due','Due Soon'].includes(maintenanceDueInfo(x).status));
    const purchaseSpend=purchases.reduce((s,p)=>s+purchaseTotal(p),0);
    const projectCostTotal=projects.reduce((s,p)=>s+(typeof projectCost==='function'?Number(projectCost(p)||0):0),0);
    const incomingParts=parts.reduce((s,p)=>s+(typeof partOnOrderQty==='function'?Number(partOnOrderQty(p.id)||0):0),0);
    return {name,projects,activeProjects,parts,orders,openOrders,logs,docs,checklists,maintenance,dueMaintenance,squawks,unresolvedSquawks,purchases,purchaseSpend,projectCostTotal,equipment,installedEquipment,specs,incomingParts};
  }

  function totalRecords(d){
    return d.projects.length+d.parts.length+d.orders.length+d.logs.length+d.docs.length+d.checklists.length+d.maintenance.length+d.squawks.length+d.purchases.length+d.equipment.length+d.specs.length;
  }

  function health(d){
    if(d.unresolvedSquawks.some(x=>x.severity==='Grounded'))return {label:'Grounded',cls:'bad'};
    if(d.unresolvedSquawks.some(x=>x.severity==='Before Flight')||d.dueMaintenance.some(x=>maintenanceDueInfo(x).status==='Due'))return {label:'Attention',cls:'warn'};
    if(d.activeProjects.length||d.unresolvedSquawks.length||d.dueMaintenance.length)return {label:'Active',cls:'blue'};
    return {label:'Stable',cls:'good'};
  }

  function systemCard(d){
    const h=health(d);
    const latest=[...d.logs].sort((a,b)=>T(b.date).localeCompare(T(a.date)))[0];
    return `<button class="system-card" onclick="openSystemDashboard(${J(d.name)})">
      <div class="system-card-head"><div><span class="system-kicker">AIRCRAFT SYSTEM</span><h2>${esc(d.name)}</h2></div><span class="system-health ${h.cls}">${esc(h.label)}</span></div>
      <div class="system-card-metrics">
        <div><b>${d.activeProjects.length}</b><span>active projects</span></div>
        <div><b>${d.unresolvedSquawks.length}</b><span>open squawks</span></div>
        <div><b>${d.installedEquipment.length}</b><span>installed items</span></div>
        <div><b>${d.dueMaintenance.length}</b><span>maintenance alerts</span></div>
      </div>
      <div class="system-card-foot"><span>${d.parts.length} parts • ${d.openOrders.length} open orders • ${d.docs.length} docs</span><span>${latest?`Last work ${esc(latest.date||'—')}`:'No work logged'} →</span></div>
    </button>`;
  }

  function renderSystems(){
    const page=document.getElementById('page-systems');if(!page)return;
    if(activeSystemName&&!systemNames().some(x=>same(x,activeSystemName)))activeSystemName='';
    if(activeSystemName){renderSystemDashboard(activeSystemName);return;}
    const systems=systemNames().map(systemData);
    page.innerHTML=`<div class="grid">
      <div class="card span-12 system-hero"><div class="toolbar"><div><h1>Aircraft Systems</h1><div class="muted">The system layer ties together projects, squawks, equipment, parts, maintenance, documents, work history and spending.</div></div><div class="action-row"><button class="secondary" onclick="openProjectsView({status:'Active'})">All Active Projects</button><button class="secondary" onclick="navTo('squawks')">All Squawks</button></div></div>
        <div class="summary-strip system-summary"><div><span>Systems represented</span><b>${systems.length}</b></div><div><span>Active projects</span><b>${systems.reduce((s,d)=>s+d.activeProjects.length,0)}</b></div><div><span>Open squawks</span><b>${systems.reduce((s,d)=>s+d.unresolvedSquawks.length,0)}</b></div><div><span>Maintenance alerts</span><b>${systems.reduce((s,d)=>s+d.dueMaintenance.length,0)}</b></div></div>
        <div class="controls" style="margin-top:12px"><input id="systemSearch" type="search" placeholder="Search systems…" oninput="renderSystemCards()"><select id="systemFocus" onchange="renderSystemCards()"><option value="">All systems</option><option value="attention">Needs attention</option><option value="projects">Active projects</option><option value="squawks">Open squawks</option><option value="maintenance">Maintenance alerts</option></select></div>
      </div>
      <div class="span-12"><div id="systemCards" class="system-grid"></div></div>
    </div>`;
    renderSystemCards();
  }

  function renderSystemCards(){
    const box=document.getElementById('systemCards');if(!box)return;
    const q=T(document.getElementById('systemSearch')?.value).toLowerCase();
    const focus=T(document.getElementById('systemFocus')?.value);
    let systems=systemNames().map(systemData).filter(d=>!q||d.name.toLowerCase().includes(q));
    if(focus==='attention')systems=systems.filter(d=>['Grounded','Attention'].includes(health(d).label));
    if(focus==='projects')systems=systems.filter(d=>d.activeProjects.length);
    if(focus==='squawks')systems=systems.filter(d=>d.unresolvedSquawks.length);
    if(focus==='maintenance')systems=systems.filter(d=>d.dueMaintenance.length);
    systems.sort((a,b)=>{
      const rank=x=>health(x).label==='Grounded'?0:health(x).label==='Attention'?1:health(x).label==='Active'?2:3;
      return rank(a)-rank(b)||b.activeProjects.length-a.activeProjects.length||a.name.localeCompare(b.name);
    });
    box.innerHTML=systems.map(systemCard).join('')||'<div class="card empty">No matching systems.</div>';
  }

  function rowButton(label,sub,right,onclick){
    return `<button class="system-row" onclick="${onclick}"><span><b>${label}</b>${sub?`<small>${sub}</small>`:''}</span>${right?`<span class="system-row-right">${right}</span>`:''}</button>`;
  }

  function panel(title,actionLabel,action,body,cls='span-6'){
    return `<div class="card ${cls}"><div class="section-head"><h2>${esc(title)}</h2>${actionLabel?`<button class="linkbtn" onclick="${action}">${esc(actionLabel)}</button>`:''}</div>${body||'<div class="empty">Nothing recorded for this system yet.</div>'}</div>`;
  }

  function renderSystemDashboard(name){
    const page=document.getElementById('page-systems');if(!page)return;
    const d=systemData(name),h=health(d);
    const active=[...d.activeProjects].sort((a,b)=>({High:0,Medium:1,Low:2}[a.priority]??9)-({High:0,Medium:1,Low:2}[b.priority]??9));
    const squawks=[...d.unresolvedSquawks].sort((a,b)=>({Grounded:0,'Before Flight':1,Monitor:2,Cosmetic:3}[a.severity]??9)-({Grounded:0,'Before Flight':1,Monitor:2,Cosmetic:3}[b.severity]??9));
    const equipment=[...d.equipment].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    const maintenance=[...d.maintenance].sort((a,b)=>{
      const ra={Due:0,'Due Soon':1,OK:2};return (ra[maintenanceDueInfo(a).status]??9)-(ra[maintenanceDueInfo(b).status]??9);
    });
    const docs=[...d.docs].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    const logs=[...d.logs].sort((a,b)=>T(b.date).localeCompare(T(a.date)));
    const purchases=[...d.purchases].sort((a,b)=>T(b.shipDate).localeCompare(T(a.shipDate)));
    const parts=[...d.parts].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    const checklists=[...d.checklists].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||'')));
    const specs=[...d.specs].sort((a,b)=>String(a.title||'').localeCompare(String(b.title||'')));

    page.innerHTML=`<div class="grid">
      <div class="card span-12 system-detail-hero"><div class="toolbar"><div><button class="system-back" onclick="showAllSystems()">← All Systems</button><div class="system-title-line"><h1>${esc(name)}</h1><span class="system-health ${h.cls}">${esc(h.label)}</span></div><div class="muted">Everything in the tracker associated with this aircraft system.</div></div><div class="action-row"><button class="primary" onclick="openSystemProjectModal(${J(name)})">+ Project</button><button class="secondary" onclick="openSystemSquawkModal(${J(name)})">+ Squawk</button><button class="secondary" onclick="openSystemWorkModal(${J(name)})">+ Work Entry</button></div></div>
        <div class="summary-strip system-summary"><div><span>Active projects</span><b>${active.length}</b></div><div><span>Open squawks</span><b>${squawks.length}</b></div><div><span>Installed equipment</span><b>${d.installedEquipment.length}</b></div><div><span>Maintenance alerts</span><b>${d.dueMaintenance.length}</b></div><div><span>Parts</span><b>${parts.length}</b></div><div><span>Open orders</span><b>${d.openOrders.length}</b></div><div><span>Documents</span><b>${docs.length}</b></div><div><span>Work entries</span><b>${logs.length}</b></div><div><span>Recorded purchases</span><b>${visibleCost(d.purchaseSpend)}</b></div></div>
      </div>

      ${panel('Active Projects','View all',`openProjectsView({system:${J(name)}})`,active.map(p=>rowButton(esc(p.title),`${esc(p.priority)} • ${esc(p.status)} • ${p.percent||0}%`,esc(p.nextStep||'Open'),`openProjectDetail(${p.id})`)).join(''))}
      ${panel('Open Squawks','Filtered squawks',`openSystemSquawksView(${J(name)})`,squawks.map(s=>rowButton(esc(s.title),`${esc(s.severity)} • ${esc(s.status)}`,esc(s.discoveredDate||'—'),`openSquawkDetail(${s.id})`)).join(''))}

      ${panel('Installed Equipment','Equipment',`openSystemEquipmentView(${J(name)})`,equipment.map(e=>rowButton(esc(e.name),`${esc(e.manufacturer||'')} ${esc(e.model||'')}`.trim()||esc(e.category||''),esc(e.status||''),`openEquipmentDetail(${e.id})`)).join(''))}
      ${panel('Maintenance','Maintenance',`navTo('maintenance')`,maintenance.map(m=>{const due=maintenanceDueInfo(m);return rowButton(esc(m.title),esc(m.notes||m.basis||''),pill(due.status),`openMaintenanceModal(${m.id})`)}).join(''))}

      ${panel('Parts & Materials','Filtered parts',`openPartsView({system:${J(name)}})`,parts.slice(0,12).map(p=>{const on=typeof partAvailable==='function'?partAvailable(p):p.stockQty;const incoming=typeof partOnOrderQty==='function'?partOnOrderQty(p.id):0;return rowButton(esc(p.name),esc(p.partNo||p.vendor||''),`${on===null?'—':esc(on)} on hand${incoming?` • ${esc(incoming)} incoming`:''}`,`openPartDetail(${p.id})`)}).join('')+(parts.length>12?`<button class="system-more" onclick="openPartsView({system:${J(name)}})">+ ${parts.length-12} more parts</button>`:''))}
      ${panel('Open Orders','All orders',`navTo('orders')`,d.openOrders.map(o=>rowButton(esc(o.item||'Order'),esc(o.vendor||o.status||''),`${esc(o.qty||'—')} ${esc(o.unit||'')}`,`openOrderDetail(${o.id})`)).join(''))}
      ${panel('Documents','Filtered documents',`openSystemDocumentsView(${J(name)})`,docs.slice(0,10).map(x=>rowButton(esc(x.name),esc(x.type||x.publisher||''),esc(x.revision?`Rev ${x.revision}`:''),`openDocumentDetail(${x.id})`)).join('')+(docs.length>10?`<div class="tiny muted">+ ${docs.length-10} more documents</div>`:''))}

      ${panel('Recent Work','Work Log',`openLogsView({system:${J(name)}})`,logs.slice(0,10).map(l=>rowButton(`${esc(l.date||'—')} • ${esc(l.work)}`,esc(l.observations||l.notes||''),l.laborHours?`${esc(l.laborHours)} hr`:'',`openLogDetail(${l.id})`)).join(''))}
      ${panel('Purchases & Cost','Filtered purchases',`openSystemPurchasesView(${J(name)})`,purchases.slice(0,10).map(p=>rowButton(esc(p.pn||p.description||'Purchase'),`${esc(p.shipDate||'—')} • ${esc(p.vendor||'')}`,db.settings?.showCosts?money(purchaseTotal(p)):'Hidden',`openPurchaseDetail(${J(String(p.id))})`)).join('')+(purchases.length?`<div class="system-total"><span>Recorded merchandise spend for this system</span><b>${visibleCost(d.purchaseSpend)}</b></div>`:''))}

      ${panel('Checklists','Checklists',`navTo('checklists')`,checklists.map(c=>{const done=A(c.items).filter(x=>x.done).length;return rowButton(esc(c.name),esc(c.trigger||c.purpose||''),`${done}/${A(c.items).length}`,`openChecklistDetail(${c.id})`)}).join(''))}
      ${panel('Reference Specs','Aircraft Ops',`navTo('ops')`,specs.map(s=>rowButton(esc(s.title),esc(s.source||s.notes||''),esc(`${s.value||'—'} ${s.units||''}`.trim()),`openSpecDetail(${J(String(s.id))})`)).join(''))}

      <div class="card span-12"><div class="section-head"><h2>System Record Summary</h2><span class="tiny muted">Derived live from existing tracker records</span></div><div class="system-ledger">
        <div><span>Total linked records</span><b>${totalRecords(d)}</b></div><div><span>All projects</span><b>${d.projects.length}</b></div><div><span>All squawks</span><b>${d.squawks.length}</b></div><div><span>Equipment records</span><b>${d.equipment.length}</b></div><div><span>Purchase lines</span><b>${d.purchases.length}</b></div><div><span>Project material-use view</span><b>${visibleCost(d.projectCostTotal)}</b></div>
      </div></div>
    </div>`;
  }

  window.renderSystemCards=renderSystemCards;
  window.openSystemDashboard=function(name){activeSystemName=T(name);navTo('systems');renderSystems()};
  window.showAllSystems=function(){activeSystemName='';renderSystems();window.scrollTo({top:0,behavior:'smooth'})};

  window.openSystemProjectModal=function(name){openProjectModal();setControl('prSystem',name)};
  window.openSystemSquawkModal=function(name){openSquawkModal();setControl('sqSystem',name)};
  window.openSystemWorkModal=function(name){openLogModal();setControl('lgSystem',name)};
  window.openSystemEquipmentView=function(name){navTo('equipment');setTimeout(()=>{setControl('equipmentSystem',name);if(typeof renderEquipmentRows==='function')renderEquipmentRows()},0)};
  window.openSystemSquawksView=function(name){navTo('squawks');setTimeout(()=>{setControl('squawkSearch',name);setControl('squawkStatus','Active');if(typeof renderSquawkRows==='function')renderSquawkRows()},0)};
  window.openSystemDocumentsView=function(name){navTo('documents');setTimeout(()=>{setControl('docSearch',name);if(typeof renderDocRows==='function')renderDocRows()},0)};
  window.openSystemPurchasesView=function(name){navTo('purchases');setTimeout(()=>{setControl('purchaseSearch','');setControl('purchaseSystem',name);if(typeof renderPurchaseRows==='function')renderPurchaseRows()},0)};

  const renderAllBase=renderAll;
  renderAll=function(){renderAllBase();renderSystems()};

  const navToBase=navTo;
  navTo=function(page){navToBase(page);if(page==='systems')renderSystems()};

  const style=document.createElement('style');
  style.id='n594zsSystemsStyle';
  style.textContent=`
    .system-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}
    .system-card{appearance:none;text-align:left;width:100%;border:1px solid var(--line);background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);padding:16px;color:var(--text);cursor:pointer;transition:transform .12s ease,border-color .12s ease,box-shadow .12s ease}
    .system-card:hover{transform:translateY(-2px);border-color:#a9c8e5;box-shadow:0 8px 24px rgba(31,74,112,.12)}
    .system-card:focus{outline:3px solid rgba(45,127,209,.18);outline-offset:2px}
    .system-card-head,.system-title-line{display:flex;align-items:center;justify-content:space-between;gap:12px}
    .system-card h2{font-size:18px;margin:2px 0 0}.system-kicker{font-size:9px;font-weight:850;letter-spacing:.12em;color:var(--muted)}
    .system-health{display:inline-flex;align-items:center;border-radius:999px;padding:4px 9px;font-size:11px;font-weight:800;white-space:nowrap;background:var(--graybg);color:var(--text)}
    .system-health.bad{background:var(--redbg);color:var(--red)}.system-health.warn{background:var(--yellowbg);color:var(--yellow)}.system-health.good{background:var(--greenbg);color:var(--green)}.system-health.blue{background:var(--blue2);color:var(--blue)}
    .system-card-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:14px}
    .system-card-metrics>div{background:#f7f9fb;border:1px solid #e7edf2;border-radius:8px;padding:9px}.system-card-metrics b{display:block;font-size:18px}.system-card-metrics span{display:block;font-size:10px;color:var(--muted);margin-top:1px}
    .system-card-foot{display:flex;justify-content:space-between;gap:10px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line);font-size:10px;color:var(--muted)}
    .system-summary{grid-template-columns:repeat(4,minmax(0,1fr))}.system-detail-hero .system-summary{grid-template-columns:repeat(4,minmax(0,1fr));margin-top:13px}
    .system-back{border:0;background:transparent;padding:0;margin:0 0 5px;color:var(--blue);font-weight:800;cursor:pointer}.system-title-line{justify-content:flex-start}.system-title-line h1{margin:0}
    .system-row{appearance:none;width:100%;display:flex;align-items:center;justify-content:space-between;gap:16px;text-align:left;border:0;border-bottom:1px solid var(--line);background:transparent;padding:10px 2px;color:var(--text);cursor:pointer}
    .system-row:last-child{border-bottom:0}.system-row:hover{background:#f8fbfd}.system-row>span:first-child{min-width:0;display:flex;flex-direction:column;gap:2px}.system-row b{white-space:normal}.system-row small{color:var(--muted);font-size:11px;white-space:normal}.system-row-right{flex:0 0 auto;font-size:11px;color:var(--muted);text-align:right;max-width:45%}
    .system-total{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 2px 2px;margin-top:8px;border-top:2px solid var(--line)}.system-total span{font-size:11px;color:var(--muted)}
    .system-more{border:0;background:transparent;color:var(--blue);font-weight:750;padding:9px 0;cursor:pointer}.system-ledger{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px}.system-ledger>div{border:1px solid var(--line);border-radius:8px;padding:10px}.system-ledger span{display:block;font-size:10px;color:var(--muted)}.system-ledger b{display:block;font-size:17px;margin-top:2px}
    @media(max-width:1100px){.system-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.system-ledger{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:760px){.system-grid{grid-template-columns:1fr}.system-summary,.system-detail-hero .system-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.system-card-foot{flex-direction:column}.system-ledger{grid-template-columns:repeat(2,minmax(0,1fr))}.system-row{align-items:flex-start}.system-row-right{max-width:40%}}
  `;
  document.head.appendChild(style);
})();
