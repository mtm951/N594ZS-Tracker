// ---------- V5.1 SMART WORKFLOW / OPS RESCUE ----------
// Inventory reservations, derived movement history, mobile Quick Add,
// organizational system status, and a hard-rescue path for Aircraft Ops.

(function(){
  const style=document.createElement('style');
  style.textContent=`
    .quick-add-fab{position:fixed;right:18px;bottom:18px;z-index:74;width:54px;height:54px;border-radius:50%;border:0;background:#2d7fd1;color:#fff;font-size:30px;font-weight:500;box-shadow:0 10px 28px rgba(23,50,76,.28);cursor:pointer;display:grid;place-items:center;line-height:1}
    .quick-add-fab:hover{transform:translateY(-1px)}
    .quick-add-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}.quick-add-grid button{border:1px solid #d3dfe8;border-radius:10px;background:#f8fbfd;color:#17324c;text-align:left;padding:13px;cursor:pointer;font-weight:800}.quick-add-grid button small{display:block;color:#6e7f8e;font-weight:600;margin-top:3px}.quick-add-grid button:hover{background:#eef6fc}
    .smart-status-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.smart-status-card{border:1px solid #dfe7ed;border-radius:9px;padding:10px;background:#fff}.smart-status-card span{display:block;font-size:10px;text-transform:uppercase;font-weight:850;color:#6c7f8f}.smart-status-card b{display:block;font-size:20px;margin-top:3px}.system-status-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.system-status{border:1px solid #dfe7ed;border-radius:9px;background:#fff;padding:11px;text-align:left;cursor:pointer}.system-status:hover{background:#f8fbfd}.system-status-head{display:flex;justify-content:space-between;gap:8px;align-items:center}.system-dot{width:10px;height:10px;border-radius:50%;display:inline-block}.system-dot.green{background:#2d9960}.system-dot.yellow{background:#d39a2c}.system-dot.red{background:#b74a45}.system-status small{display:block;color:#6e7f8e;margin-top:5px;line-height:1.35}
    .reservation-row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #edf1f4}.reservation-row:last-child{border-bottom:0}.reservation-qty{white-space:nowrap;font-weight:850}.stock-short{color:#b74a45}.stock-ok{color:#2d9960}
    .movement-row{display:grid;grid-template-columns:90px 85px minmax(0,1fr) auto;gap:8px;align-items:start;padding:7px 0;border-bottom:1px solid #edf1f4;font-size:12px}.movement-row:last-child{border-bottom:0}.movement-kind{font-weight:850;text-transform:uppercase;font-size:10px}.movement-in{color:#21754a}.movement-out{color:#984039}.movement-reserve{color:#865b11}
    .ops-rescue-note{margin:10px 0}.ops-status-panel{margin:12px 0 14px;padding:12px;border:1px solid #dce6ed;border-radius:10px;background:#f9fcfe}
    @media(max-width:760px){.quick-add-fab{right:14px;bottom:72px}.quick-add-grid{grid-template-columns:1fr}.smart-status-strip{grid-template-columns:repeat(2,1fr)}.system-status-grid{grid-template-columns:1fr}.movement-row{grid-template-columns:72px 70px minmax(0,1fr)}.movement-row>*:last-child{grid-column:3}.reservation-row{grid-template-columns:1fr auto}.reservation-row button{grid-column:1/-1}}
  `;
  document.head.appendChild(style);
})();

// ---------- AIRCRAFT OPS: PERMANENT NAV + SAFE RENDER ----------
function ensureAircraftOpsNav(){
  if(!NAV.some(x=>x[0]==='ops')){
    const i=NAV.findIndex(x=>x[0]==='readiness');
    const j=i>=0?i+1:Math.max(0,NAV.findIndex(x=>x[0]==='projects'));
    NAV.splice(j<0?NAV.length:j,0,['ops','Aircraft Ops']);
  }
}
ensureAircraftOpsNav();

function smartActivatePage(page){
  currentPage=page;
  document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
  document.getElementById('page-'+page)?.classList.add('active');
}
function renderOpsFallback(err=null){
  const page=document.getElementById('page-ops');if(!page)return;
  page.innerHTML=`<div class="card"><div class="toolbar"><div><h1>Aircraft Ops</h1><div class="muted">N594ZS operational workspace</div></div><span class="mini-badge">safe mode</span></div>${err?`<div class="warning ops-rescue-note"><b>The full Ops module did not finish rendering.</b><br><span class="small">${esc(err.message||String(err))}</span></div>`:''}<div id="smartOpsFallbackStatus"></div><div class="notice" style="margin-top:12px">Your aircraft data is still available. This safe page keeps status/readiness visible while the richer configuration, inspection, specs, costs, trends, flight-card, timeline and report workspace loads separately.</div></div>`;
  const box=document.getElementById('smartOpsFallbackStatus');if(box)box.innerHTML=smartStatusBoardHTML(true);
}
function smartRenderOpsSafe(){
  try{
    if(typeof renderOps==='function')renderOps();else renderOpsFallback();
  }catch(e){console.error('Aircraft Ops render failed',e);renderOpsFallback(e)}
  injectSmartOpsStatus();
}

const smartRenderNavBase=renderNav;
renderNav=function(){ensureAircraftOpsNav();smartRenderNavBase()};
const smartNavToBase=navTo;
navTo=function(page){
  ensureAircraftOpsNav();
  if(page!=='ops')return smartNavToBase(page);
  try{smartNavToBase(page)}catch(e){console.error('Aircraft Ops navigation failed',e);smartActivatePage('ops');renderNav();window.scrollTo({top:0,behavior:'smooth'});renderOpsFallback(e);return}
  smartRenderOpsSafe();
};

// ---------- PROJECT PLANNED / RESERVED PARTS ----------
const smartNormalizeBase=normalizeDB;
normalizeDB=function(){
  smartNormalizeBase();
  db.projects=arr(db.projects);db.projects.forEach(p=>{p.plannedParts=arr(p.plannedParts).map(x=>({id:x.id||uid(),partId:x.partId?Number(x.partId):null,name:x.name||'',qty:num(x.qty)||1,unit:x.unit||'ea',notes:x.notes||''}))});
};
normalizeDB();

function partPhysicalOnHand(p){return partAvailable(p)}
function partReservedQty(partId){return arr(db.projects).filter(p=>p.status!=='Done').reduce((sum,p)=>sum+arr(p.plannedParts).filter(x=>Number(x.partId)===Number(partId)).reduce((s,x)=>s+num(x.qty),0),0)}
function partFreeQty(p){const on=partPhysicalOnHand(p);return on===null?null:on-partReservedQty(p.id)}
function partReservationProjects(partId){const out=[];for(const p of arr(db.projects)){if(p.status==='Done')continue;for(const x of arr(p.plannedParts))if(Number(x.partId)===Number(partId))out.push({project:p,item:x})}return out}

function plannedPartsHTML(projectId){
  const p=projectById(projectId);if(!p)return '';
  const rows=arr(p.plannedParts);
  return `<div class="detail-card" id="projectPlannedPartsCard"><div class="section-tools"><div><h3>Planned / Reserved Parts</h3><div class="tiny muted">Reservations reduce free inventory but do not record physical consumption.</div></div><button class="icon-btn" onclick="openReservePartModal(${p.id})">+ Reserve Part</button></div>${rows.length?rows.map(x=>{const part=x.partId?partById(x.partId):null,on=part?partPhysicalOnHand(part):null,free=part?partFreeQty(part):null;return `<div class="reservation-row"><div><b>${x.partId?`<button class="linkbtn" onclick="openPartDetail(${x.partId})">${esc(x.name||partName(x.partId))}</button>`:esc(x.name||'Planned item')}</b><div class="task-note">${esc(x.notes||'')}${part&&free!==null?` • free after all reservations: ${esc(free)} ${esc(part.unit||x.unit||'ea')}`:''}</div></div><div class="reservation-qty ${part&&free!==null&&free<0?'stock-short':'stock-ok'}">${esc(x.qty)} ${esc(x.unit||part?.unit||'ea')}</div><button class="icon-btn" onclick="removeReservedPart(${p.id},${x.id})">Release</button></div>`}).join(''):'<div class="empty">No parts reserved for this project yet.</div>'}</div>`;
}
function injectProjectReservations(projectId){
  const box=document.getElementById('modalBox');if(!box||box.querySelector('#projectPlannedPartsCard'))return;
  const left=box.querySelector('.detail-grid > div:first-child');if(!left)return;
  const first=left.querySelector('.detail-card');if(first)first.insertAdjacentHTML('afterend',plannedPartsHTML(projectId));else left.insertAdjacentHTML('afterbegin',plannedPartsHTML(projectId));
}
const smartOpenProjectDetailBase=openProjectDetail;
openProjectDetail=function(id){smartOpenProjectDetailBase(id);injectProjectReservations(Number(id))};

function openReservePartModal(projectId){
  const p=projectById(projectId);if(!p)return;
  openModal(`${modalHeader('Reserve Part for Project',p.title)}<div class="form-grid">${typeof searchablePartPicker==='function'?searchablePartPicker('rsv',null,'Inventory part'):`<div class="full"><label>Inventory part</label><select id="rsvPartFallback">${partOptions(null)}</select></div>`}${field('Quantity to reserve','rsvQty','1','number','step="any" min="0.0001"')}${textareaField('Planning note','rsvNotes','')}</div><div class="modal-actions"><button class="secondary" onclick="openProjectDetail(${projectId})">Cancel</button><button class="primary" onclick="saveReservedPart(${projectId})">Reserve</button></div>`);
}
function reservePickerId(){if(typeof partPickerId==='function')return partPickerId('rsv');return selectedNumber('rsvPartFallback')}
function saveReservedPart(projectId){
  const p=projectById(projectId),partId=reservePickerId(),part=partId?partById(partId):null,qty=num(val('rsvQty'));if(!p||!partId||!part)return alert('Choose an inventory part.');if(qty<=0)return alert('Enter a positive quantity.');
  const existing=arr(p.plannedParts).find(x=>Number(x.partId)===Number(partId));if(existing){existing.qty=num(existing.qty)+qty;if(val('rsvNotes'))existing.notes=[existing.notes,val('rsvNotes')].filter(Boolean).join(' • ')}else p.plannedParts.push({id:uid(),partId:part.id,name:part.name,qty,unit:part.unit||'ea',notes:val('rsvNotes')});
  if(!arr(part.linkedProjectIds).includes(projectId))part.linkedProjectIds.push(projectId);saveDB('Part reserved for project.');openProjectDetail(projectId);
}
function removeReservedPart(projectId,itemId){const p=projectById(projectId);if(!p)return;p.plannedParts=arr(p.plannedParts).filter(x=>String(x.id)!==String(itemId));saveDB('Reservation released.');openProjectDetail(projectId)}

// ---------- PARTS: ON HAND / RESERVED / FREE + MOVEMENT HISTORY ----------
renderParts=function(){
  const systems=unique(db.parts.map(x=>x.system).filter(Boolean)).sort();
  document.getElementById('page-parts').innerHTML=`<div class="card"><div class="toolbar"><div><h1>Parts & Materials</h1><div class="muted">Physical inventory, project reservations, usage history and purchasing provenance.</div></div><button class="btn primary" onclick="openPartModal()">+ Add Part</button></div><div class="controls"><input id="partSearch" placeholder="Search parts…" oninput="renderPartRows()"><select id="partSystem" onchange="renderPartRows()"><option value="">All systems</option>${systems.map(s=>`<option>${esc(s)}</option>`).join('')}</select><select id="partStatus" onchange="renderPartRows()"><option value="">All statuses</option>${unique(db.parts.map(p=>p.status).filter(Boolean)).map(s=>`<option>${esc(s)}</option>`).join('')}</select></div><div class="table-wrap" style="margin-top:11px"><table><thead><tr><th>Part / material</th><th>PN / spec</th><th>System</th><th>On hand</th><th>Reserved</th><th>Free</th><th>Status</th><th>Vendor</th><th></th></tr></thead><tbody id="partRows"></tbody></table></div></div>`;renderPartRows();
};
renderPartRows=function(){
  const el=document.getElementById('partRows');if(!el)return;const q=(val('partSearch')||'').toLowerCase(),sys=val('partSystem'),st=val('partStatus');
  const rows=db.parts.filter(p=>(!q||[p.name,p.partNo,p.system,p.vendor,p.notes,p.location,p.partType].join(' ').toLowerCase().includes(q))&&(!sys||(typeof systemRecordMatches==='function'?systemRecordMatches(p,sys,'parts'):p.system===sys))&&(!st||p.status===st));
  el.innerHTML=rows.map(p=>{const on=partPhysicalOnHand(p),r=partReservedQty(p.id),free=partFreeQty(p);return `<tr class="click-row" onclick="openPartDetail(${p.id})"><td><div class="task-title">${esc(p.name)}</div><div class="task-note">${esc(p.description||p.notes||'')}</div></td><td>${esc(p.partNo||'—')}</td><td>${esc(p.system||'—')}</td><td>${on===null?'—':esc(on+' '+(p.unit||''))}</td><td>${esc(r+' '+(p.unit||''))}</td><td class="${free!==null&&free<0?'stock-short':'stock-ok'}">${free===null?'—':esc(free+' '+(p.unit||''))}</td><td>${pill(p.status)}</td><td>${esc(p.vendor||'—')}</td><td><button class="icon-btn" onclick="event.stopPropagation();openPartModal(${p.id})">Edit</button></td></tr>`}).join('')||'<tr><td colspan="9" class="empty">No matching parts.</td></tr>';
};

function partMovementRows(part){
  const rows=[];
  for(const p of arr(db.purchases))if(String(p.inventoryPartId||'')===String(part.id))rows.push({date:p.shipDate||'',kind:'IN',desc:`Purchase • ${p.vendor||'Vendor'}${p.invoice?' • '+p.invoice:''}`,qty:num(p.remainingQty===''?p.qty:p.remainingQty),unit:part.unit||'ea'});
  for(const l of arr(db.logs))for(const x of arr(l.consumedParts))if(Number(x.partId)===Number(part.id))rows.push({date:l.date||'',kind:'OUT',desc:l.work||'Work log consumption',qty:num(x.qty),unit:x.unit||part.unit||'ea'});
  for(const r of partReservationProjects(part.id))rows.push({date:'',kind:'RESERVE',desc:r.project.title,qty:num(r.item.qty),unit:r.item.unit||part.unit||'ea'});
  if(!rows.length&&part.stockQty!=='')rows.push({date:part.purchaseDate||'',kind:'BASE',desc:'Recorded inventory quantity',qty:num(part.stockQty),unit:part.unit||'ea'});
  return rows.sort((a,b)=>(b.date||'9999').localeCompare(a.date||'9999'));
}
function injectPartSmartCards(partId){
  const p=partById(partId),box=document.getElementById('modalBox');if(!p||!box||box.querySelector('#smartPartInventory'))return;
  const reservations=partReservationProjects(partId),moves=partMovementRows(p),on=partPhysicalOnHand(p),reserved=partReservedQty(p.id),free=partFreeQty(p);
  const html=`<div class="detail-card" id="smartPartInventory"><h3>Inventory Position</h3><div class="smart-status-strip"><div class="smart-status-card"><span>On hand</span><b>${on===null?'—':esc(on+' '+(p.unit||''))}</b></div><div class="smart-status-card"><span>Reserved</span><b>${esc(reserved+' '+(p.unit||''))}</b></div><div class="smart-status-card"><span>Free</span><b class="${free!==null&&free<0?'stock-short':'stock-ok'}">${free===null?'—':esc(free+' '+(p.unit||''))}</b></div><div class="smart-status-card"><span>Used in logs</span><b>${esc(partConsumedQty(p.id)+' '+(p.unit||''))}</b></div></div>${reservations.length?`<div class="detail-section"><label>Project reservations</label>${reservations.map(r=>`<div class="kv click-row" onclick="openProjectDetail(${r.project.id})"><span>${esc(r.project.title)}</span><b>${esc(r.item.qty)} ${esc(r.item.unit||p.unit||'ea')}</b></div>`).join('')}</div>`:''}<div class="detail-section"><label>Inventory movement / allocation history</label>${moves.map(m=>`<div class="movement-row"><span>${esc(m.date||'Planned')}</span><span class="movement-kind ${m.kind==='IN'?'movement-in':m.kind==='OUT'?'movement-out':m.kind==='RESERVE'?'movement-reserve':''}">${esc(m.kind)}</span><span>${esc(m.desc)}</span><b>${m.kind==='OUT'?'-':m.kind==='IN'?'+':''}${esc(m.qty)} ${esc(m.unit)}</b></div>`).join('')||'<div class="muted">No linked movement history yet.</div>'}</div><div class="tiny muted" style="margin-top:8px">Movement history is assembled from linked purchases, work-log consumption and project reservations. Required aircraft records remain separate.</div></div>`;
  const left=box.querySelector('.detail-grid > div:first-child');if(left)left.insertAdjacentHTML('afterbegin',html);else box.insertAdjacentHTML('beforeend',html);
}
const smartOpenPartDetailBase=openPartDetail;
openPartDetail=function(id){smartOpenPartDetailBase(id);injectPartSmartCards(Number(id))};

// Improve picker availability display to include reservations.
if(typeof partPickerSelectedHTML==='function'){
  partPickerSelectedHTML=function(p){const on=partPhysicalOnHand(p),r=partReservedQty(p.id),free=partFreeQty(p);return `<b>${esc(p.name||'Part')}</b>${p.partNo?` • PN ${esc(p.partNo)}`:''}${p.system?` • ${esc(p.system)}`:''}${on!==null?` • On hand ${esc(on)} ${esc(p.unit||'ea')} • Reserved ${esc(r)} • Free ${esc(free)}`:''}`};
}

// ---------- ORGANIZATIONAL STATUS / RTS CLOSEOUT ----------
function smartSystemKey(s=''){
  const x=String(s).toLowerCase();
  if(x.includes('fuel'))return 'Fuel';if(x.includes('engine'))return 'Engine';if(x.includes('cool'))return 'Cooling';if(x.includes('electric'))return 'Electrical';if(x.includes('avion')||x.includes('instrument'))return 'Avionics / Instruments';if(x.includes('prop'))return 'Propeller';if(x.includes('landing')||x.includes('brake')||x.includes('wheel'))return 'Landing Gear';if(x.includes('fabric')||x.includes('airframe'))return 'Fabric / Airframe';if(x.includes('control'))return 'Flight Controls';if(x.includes('w&b')||x.includes('record'))return 'Records / W&B';return s||'General';
}
const SMART_SYSTEMS=['Engine','Fuel','Cooling','Electrical','Avionics / Instruments','Propeller','Landing Gear','Fabric / Airframe','Flight Controls','Records / W&B'];
function smartSystemStatus(system){
  const projects=arr(db.projects).filter(p=>p.status!=='Done'&&smartSystemKey(p.system)===system);
  const squawks=arr(db.squawks).filter(s=>s.status!=='Resolved'&&smartSystemKey(s.system)===system);
  const severe=squawks.filter(s=>['Grounded','Before Flight'].includes(s.severity));
  const criticalProjects=projects.filter(p=>p.priority==='High'&&/before (engine|flight|return)|return to service|before ground/i.test(`${p.trigger||''} ${p.phase||''}`));
  const level=(severe.length||criticalProjects.length)?'red':(projects.length||squawks.length)?'yellow':'green';
  return {system,projects,squawks,severe,criticalProjects,level};
}
function smartCloseoutCounts(){
  const criticalSq=arr(db.squawks).filter(s=>s.status!=='Resolved'&&['Grounded','Before Flight'].includes(s.severity));
  const gatedProjects=arr(db.projects).filter(p=>p.status!=='Done'&&/before (engine|flight|return)|return to service|before ground/i.test(`${p.trigger||''} ${p.phase||''}`));
  const failedInspection=arr(db.inspections).reduce((n,i)=>n+arr(i.items).filter(x=>x.result==='Fail').length,0);
  const incompleteChecks=arr(db.checklists).filter(c=>/flight|engine run|return/i.test(`${c.trigger||''} ${c.name||''}`)).reduce((n,c)=>n+arr(c.items).filter(x=>!x.done).length,0);
  let wbPending=false;try{const c=typeof wbConfig==='function'?wbConfig():null;wbPending=!!c&&typeof wbConfigReady==='function'&&!wbConfigReady(c)}catch(_e){}
  const unverifiedSpecs=arr(db.specs).filter(s=>s.status==='Needs Verification').length;
  return {criticalSq,gatedProjects,failedInspection,incompleteChecks,wbPending,unverifiedSpecs};
}
function smartStatusBoardHTML(compact=false){
  const c=smartCloseoutCounts();const systems=SMART_SYSTEMS.map(smartSystemStatus);
  return `<div class="smart-status-strip"><div class="smart-status-card"><span>Critical / before-flight squawks</span><b>${c.criticalSq.length}</b></div><div class="smart-status-card"><span>Gated open projects</span><b>${c.gatedProjects.length}</b></div><div class="smart-status-card"><span>Inspection fails</span><b>${c.failedInspection}</b></div><div class="smart-status-card"><span>${c.wbPending?'W&B pending':'Checklist items'}</span><b>${c.wbPending?'YES':c.incompleteChecks}</b></div></div>${compact?'':`<div class="system-status-grid">${systems.map(s=>`<button class="system-status" onclick="openProjectsView({system:'${esc(s.system)}'})"><div class="system-status-head"><b>${esc(s.system)}</b><span class="system-dot ${s.level}"></span></div><small>${s.projects.length} open project${s.projects.length===1?'':'s'} • ${s.squawks.length} open squawk${s.squawks.length===1?'':'s'}${s.criticalProjects.length?` • ${s.criticalProjects.length} gated`:''}</small></button>`).join('')}</div><div class="tiny muted" style="margin-top:9px">Green/yellow/red summarizes records in this tracker only. It is not an airworthiness determination or return-to-service authorization.</div>`}`;
}
function injectSmartOpsStatus(){
  const page=document.getElementById('page-ops');if(!page||page.querySelector('#smartOpsStatus'))return;
  const shell=page.querySelector('.ops-shell');if(!shell)return;
  const toolbar=shell.querySelector('.toolbar');if(!toolbar)return;
  toolbar.insertAdjacentHTML('afterend',`<div class="ops-status-panel" id="smartOpsStatus"><div class="section-tools"><div><h3>Aircraft Status / RTS Closeout</h3><div class="tiny muted">Organizational view of open tracker records.</div></div><button class="icon-btn" onclick="renderAll();navTo('ops')">Refresh</button></div>${smartStatusBoardHTML(false)}</div>`);
}

// ---------- MOBILE / GLOBAL QUICK ADD ----------
function ensureQuickAdd(){
  if(document.getElementById('quickAddFab'))return;
  const b=document.createElement('button');b.id='quickAddFab';b.className='quick-add-fab';b.type='button';b.title='Quick Add';b.setAttribute('aria-label','Quick Add');b.textContent='+';b.onclick=openQuickAdd;document.body.appendChild(b);
}
function openQuickAdd(){
  openModal(`${modalHeader('Quick Add','Capture something without hunting for the right tab')}<div class="quick-add-grid"><button onclick="openLogModal()">Work entry<small>Work performed, measurements, parts used</small></button><button onclick="openSquawkModal()">Squawk<small>Discrepancy, severity, troubleshooting</small></button><button onclick="openRunModal()">Run / test<small>Engine, ground, taxi or flight-test data</small></button><button onclick="openProjectModal()">Project<small>New job or corrective-work item</small></button><button onclick="openPartModal()">Part / material<small>Add inventory or a consumable</small></button><button onclick="openPurchaseModal()">Purchase<small>Add a purchase-history line</small></button><button onclick="openOrderModal()">Order<small>Something needed or already ordered</small></button><button onclick="navTo('ops');closeModal()">Aircraft Ops<small>Status, configuration, inspections and reports</small></button></div>`);
}
ensureQuickAdd();

// Final render safety: even if the rich Ops renderer faults, keep the rest of the app and nav usable.
const smartRenderAllBase=renderAll;
renderAll=function(){
  let err=null;try{smartRenderAllBase()}catch(e){err=e;console.error('Render recovered by v5.1 smart workflow',e)}
  ensureAircraftOpsNav();try{renderNav()}catch(_e){}
  if(currentPage==='ops'||err)smartRenderOpsSafe();else injectSmartOpsStatus();
  ensureQuickAdd();
};
