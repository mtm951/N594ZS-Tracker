function renderAircraft(){
  document.getElementById('page-aircraft').innerHTML=`<div class="grid">
    <div class="card aircraft-card span-4"><div class="photo-wrap"><img id="airPhoto"><div class="photo-placeholder" id="airPlaceholder">🛩️</div></div><div class="aircraft-body"><button class="btn secondary" onclick="document.getElementById('photoFile').click()">Change Aircraft Photo</button></div></div>
    <div class="card span-8"><div class="toolbar"><div><h1>Aircraft</h1><div class="muted">Core N594ZS information used throughout the tracker.</div></div><button class="btn primary" onclick="editAircraft()">Edit Aircraft</button></div>
      <div class="grid"><div class="span-6"><div class="kv"><span>Registration</span><b>${esc(db.aircraft.tail)}</b></div><div class="kv"><span>Model</span><b>${esc(db.aircraft.model)}</b></div><div class="kv"><span>Serial / builder ref.</span><b>${esc(db.aircraft.serial||'Not set')}</b></div><div class="kv"><span>Base airport</span><b>${esc(db.aircraft.base||'Not set')}</b></div><div class="kv"><span>Engine</span><b>${esc(db.aircraft.engine)}</b></div><div class="kv"><span>Rated power</span><b>${esc(db.aircraft.hp||'—')} hp</b></div></div>
      <div class="span-6"><div class="kv"><span>Max gross</span><b>${esc(db.aircraft.gross||'—')} lb</b></div><div class="kv"><span>Empty weight</span><b>${esc(db.aircraft.emptyWeight||'Not set')}</b></div><div class="kv"><span>Empty CG</span><b>${esc(db.aircraft.emptyCg||'Not set')}</b></div><div class="kv"><span>Airframe hours</span><b>${esc(db.aircraft.airframeHours||'Not set')}</b></div><div class="kv"><span>Engine hours</span><b>${esc(db.aircraft.engineHours||'Not set')}</b></div><div class="kv"><span>Inspection date</span><b>${esc(db.aircraft.annualDate||'Not set')}</b></div></div></div>
      <div class="detail-section"><label>Aircraft / configuration notes</label><div class="detail-text">${esc(db.aircraft.notes||'No aircraft notes yet.')}</div></div>
    </div>
    <div class="card span-12 notice"><b>Status:</b> ${esc(db.aircraft.status)}. This tracker organizes project information; it does not itself establish airworthiness, satisfy required inspections, or replace required logbook entries.</div>
  </div>`;
  if(db.aircraft.photo){const img=document.getElementById('airPhoto');if(img){img.src=db.aircraft.photo;img.style.display='block';document.getElementById('airPlaceholder').style.display='none'}}
}

function trackerSystemFilterOptions(selected=''){
  const selectedValue=String(selected||'');
  let names=[];
  if(typeof window.systemNames==='function')names=window.systemNames();
  else{
    const pools=['projects','parts','orders','logs','docs','checklists','maintenance','squawks','purchases','equipment','specs'];
    names=[...new Set(pools.flatMap(k=>Array.isArray(db[k])?db[k].map(x=>String(x?.system||'').trim()).filter(Boolean):[]))].sort((a,b)=>a.localeCompare(b));
  }
  return '<option value="">All systems</option>'+
    names.map(n=>`<option value="${esc(n)}" ${String(n)===selectedValue?'selected':''}>${esc(n)}</option>`).join('')+
    `<option value="__unassigned__" ${selectedValue==='__unassigned__'?'selected':''}>Unassigned</option>`;
}
function trackerRecordMatchesSystem(record,selected,type=''){
  const wanted=String(selected||'');if(!wanted)return true;
  if(typeof window.systemRecordMatches==='function')return window.systemRecordMatches(record,wanted,type);
  let actual=String(record?.system||'').trim();
  if(type==='orders'&&typeof window.orderSystemName==='function')actual=String(window.orderSystemName(record)||'').trim();
  if(wanted==='__unassigned__')return !actual;
  return actual===wanted;
}

let projectSort={key:'priority',dir:'asc'};
const PROJECT_PRIORITY_RANK={High:0,Medium:1,Low:2};
const PROJECT_STATUS_RANK={'In Progress':0,Open:1,Blocked:2,Done:3};

function projectSortHead(label,key){
  const active=projectSort.key===key,aria=active?(projectSort.dir==='asc'?'ascending':'descending'):'none';
  return `<th class="project-sortable" aria-sort="${aria}"><button class="project-sort-button" data-project-sort="${key}" onclick="setProjectSort('${key}')" title="Sort by ${esc(label)}">${esc(label)} <span>${active?(projectSort.dir==='asc'?'▲':'▼'):'↕'}</span></button></th>`;
}
function refreshProjectSortHeaders(){
  document.querySelectorAll('#page-projects .project-sort-button').forEach(b=>{
    const active=b.dataset.projectSort===projectSort.key;
    b.closest('th')?.setAttribute('aria-sort',active?(projectSort.dir==='asc'?'ascending':'descending'):'none');
    const arrow=b.querySelector('span');if(arrow)arrow.textContent=active?(projectSort.dir==='asc'?'▲':'▼'):'↕';
  });
}
function setProjectSort(key){
  if(projectSort.key===key)projectSort.dir=projectSort.dir==='asc'?'desc':'asc';
  else{
    const numericDesc=new Set(['progress','cost']);
    projectSort={key,dir:numericDesc.has(key)?'desc':'asc'};
  }
  refreshProjectSortHeaders();
  renderProjectRows();
}
function projectSortValue(p,key){
  if(key==='title')return p.title||'';
  if(key==='system')return p.system||'';
  if(key==='priority')return PROJECT_PRIORITY_RANK[p.priority]??99;
  if(key==='status')return PROJECT_STATUS_RANK[p.status]??99;
  if(key==='progress')return num(p.percent);
  if(key==='next')return p.nextStep||'';
  if(key==='cost')return num(projectCost(p));
  return '';
}
function sortProjectRows(rows){
  const key=projectSort.key,dir=projectSort.dir==='desc'?-1:1;
  const collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
  return rows.sort((a,b)=>{
    const av=projectSortValue(a,key),bv=projectSortValue(b,key);
    const aBlank=av===''||av===null||av===undefined,bBlank=bv===''||bv===null||bv===undefined;
    if(aBlank!==bBlank)return aBlank?1:-1;
    const primary=typeof av==='number'&&typeof bv==='number'?av-bv:collator.compare(String(av),String(bv));
    return primary*dir||collator.compare(String(a.title||''),String(b.title||''))||num(a.id)-num(b.id);
  });
}

// List filters are UI-only and belong to this browser tab, not aircraft data.
// Preserve them across navigation, visibility-triggered cloud re-renders and
// refreshes within the same tab. An explicit dashboard link can still replace
// them intentionally (e.g. "View active projects").
const TRACKER_LIST_FILTER_KEY='n594zs_list_filters_v1';
const TRACKER_LIST_FILTER_IDS={
  projects:['projectSearch','projectStatus','projectSystem','projectPriority'],
  parts:['partSearch','partSystem','partStatus','partInventory']
};
const trackerListFilterState={projects:{},parts:{}};
try{
  const cached=JSON.parse(sessionStorage.getItem(TRACKER_LIST_FILTER_KEY)||'null');
  if(cached&&typeof cached==='object'){
    for(const page of Object.keys(TRACKER_LIST_FILTER_IDS))
      for(const id of TRACKER_LIST_FILTER_IDS[page])
        if(typeof cached[page]?.[id]==='string')trackerListFilterState[page][id]=cached[page][id];
  }
}catch(e){console.warn('List filter session restore unavailable',e)}
function trackerCaptureListFilters(page){
  if(!document.getElementById(page==='projects'?'projectRows':'partRows'))return;
  for(const id of TRACKER_LIST_FILTER_IDS[page]||[]){
    const control=document.getElementById(id);
    if(control)trackerListFilterState[page][id]=String(control.value||'');
  }
  try{sessionStorage.setItem(TRACKER_LIST_FILTER_KEY,JSON.stringify(trackerListFilterState))}
  catch(e){console.warn('List filter session save unavailable',e)}
}
function trackerRestoreListFilters(page){
  for(const id of TRACKER_LIST_FILTER_IDS[page]||[]){
    const control=document.getElementById(id);
    if(!control)continue;
    const value=trackerListFilterState[page][id]||'';
    // If a system/status no longer exists after a cloud update, don't
    // silently filter the entire list to an impossible option.
    if(control.tagName==='SELECT'&&value&&!Array.from(control.options||[]).some(o=>o.value===value))continue;
    control.value=value;
  }
}
function renderProjects(){
  trackerCaptureListFilters('projects');
  document.getElementById('page-projects').innerHTML=`<div class="card"><div class="toolbar"><div><h1>Projects</h1><div class="muted">Every row opens a project workspace with notes, blockers, parts used, orders, work history, documents, files and next steps.</div></div><button class="btn primary" onclick="openProjectModal()">+ New Project</button></div>
  <div class="controls"><input id="projectSearch" placeholder="Search projects…" oninput="renderProjectRows()"><select id="projectStatus" onchange="renderProjectRows()"><option value="">All statuses</option><option value="Active">Active (not done)</option><option value="Held Up">Held Up / Blocked</option><option>Open</option><option>In Progress</option><option>Blocked</option><option>Done</option></select><select id="projectSystem" onchange="renderProjectRows()">${trackerSystemFilterOptions('')}</select><select id="projectPriority" onchange="renderProjectRows()"><option value="">All priorities</option><option>High</option><option>Medium</option><option>Low</option></select></div>
  <div class="table-wrap" style="margin-top:11px"><table><thead><tr>${projectSortHead('Project item','title')}${projectSortHead('System','system')}${projectSortHead('Priority','priority')}${projectSortHead('Status','status')}${projectSortHead('Progress','progress')}${projectSortHead('Next step','next')}${projectSortHead('Cost','cost')}<th></th></tr></thead><tbody id="projectRows"></tbody></table></div></div>`;
  trackerRestoreListFilters('projects');
  renderProjectRows();
}
function renderProjectRows(){
  trackerCaptureListFilters('projects');
  const el=document.getElementById('projectRows');if(!el)return;
  const q=(val('projectSearch')||'').toLowerCase(),st=val('projectStatus'),sys=val('projectSystem'),pr=val('projectPriority');
  const statusMatch=x=>!st||(st==='Active'?x.status!=='Done':st==='Held Up'?(x.status==='Blocked'||Boolean(String(x.blockers||'').trim())):x.status===st);
  const rows=sortProjectRows(db.projects.filter(x=>(!q||[x.title,x.system,x.summary,x.plan,x.nextStep,x.blockers,x.trigger,...x.partsUsed.map(p=>p.name)].join(' ').toLowerCase().includes(q))&&statusMatch(x)&&trackerRecordMatchesSystem(x,sys,'projects')&&(!pr||x.priority===pr)));
  el.innerHTML=rows.map(p=>{const linkedLogs=db.logs.filter(l=>l.projectIds.includes(p.id)).length,orders=db.orders.filter(o=>orderLinkedToProject(o,p.id)&&!isClosedOrder(o)).length;return `<tr class="click-row" onclick="openProjectDetail(${p.id})"><td><div class="task-title">${esc(p.title)}</div><div class="task-note">${esc(p.summary)}</div><div class="task-meta"><span class="mini-badge">${p.partsUsed.length} parts used</span><span class="mini-badge">${orders} open orders</span><span class="mini-badge">${linkedLogs} work entries</span></div></td><td>${esc(p.system)}</td><td>${pill(p.priority)}</td><td>${pill(p.status)}</td><td><div class="small strong">${p.percent}%</div><div class="progress" style="width:95px;margin-top:4px"><div style="width:${p.percent}%"></div></div></td><td>${esc(p.nextStep||'—')}</td><td>${db.settings.showCosts?fmtMoney(projectCost(p)):'Hidden'}</td><td><button class="icon-btn" onclick="event.stopPropagation();openProjectModal(${p.id})">Edit</button></td></tr>`}).join('')||'<tr><td colspan="8" class="empty">No matching projects.</td></tr>';
  refreshProjectSortHeaders();
}

(()=>{if(document.getElementById('projectSortStyle'))return;const s=document.createElement('style');s.id='projectSortStyle';s.textContent=`#page-projects th.project-sortable{padding:0}#page-projects th.project-sortable:hover{background:#eef5fb}#page-projects .project-sort-button{appearance:none;width:100%;border:0;background:transparent;color:inherit;font:inherit;font-weight:inherit;padding:10px 12px;text-align:left;cursor:pointer;white-space:nowrap}#page-projects .project-sort-button span{font-size:.72em;margin-left:5px;opacity:.55}`;document.head.appendChild(s)})();

function renderParts(){
  trackerCaptureListFilters('parts');
  document.getElementById('page-parts').innerHTML=`<div class="card"><div class="toolbar"><div><h1>Parts & Materials</h1><div class="muted">Every part opens a full record with pricing, inventory, projects, consumption history, orders, receipts/spec sheets and notes.</div></div><button class="btn primary" onclick="openPartModal()">+ Add Part</button></div>
  <div class="controls"><input id="partSearch" placeholder="Search parts…" oninput="renderPartRows()"><select id="partSystem" onchange="renderPartRows()">${trackerSystemFilterOptions('')}</select><select id="partStatus" onchange="renderPartRows()"><option value="">All statuses</option>${unique(db.parts.map(p=>p.status).filter(Boolean)).map(s=>`<option>${esc(s)}</option>`).join('')}</select><select id="partInventory" onchange="renderPartRows()"><option value="">All inventory</option><option value="incoming">Incoming / on order</option><option value="on-hand">On hand</option><option value="out">None on hand</option></select></div>
  <div class="table-wrap" style="margin-top:11px"><table><thead><tr><th>Part / material</th><th>PN / spec</th><th>System</th><th>On Hand</th><th>On Order</th><th>Used</th><th>Status</th><th>Vendor</th><th>Unit price</th><th></th></tr></thead><tbody id="partRows"></tbody></table></div></div>`;trackerRestoreListFilters('parts');renderPartRows();
}
function renderPartRows(){const el=document.getElementById('partRows');if(!el)return;trackerCaptureListFilters('parts');const q=(val('partSearch')||'').toLowerCase(),sys=val('partSystem'),st=val('partStatus'),inv=val('partInventory');const rows=db.parts.filter(p=>{const on=partAvailable(p),incoming=typeof partOnOrderQty==='function'?partOnOrderQty(p.id):0;return(!q||[p.name,p.partNo,p.system,p.vendor,p.notes,p.location].join(' ').toLowerCase().includes(q))&&trackerRecordMatchesSystem(p,sys,'parts')&&(!st||p.status===st)&&(!inv||(inv==='incoming'?incoming>0:inv==='on-hand'?num(on)>0:num(on)<=0))});el.innerHTML=rows.map(p=>{const incoming=typeof partOnOrderQty==='function'?partOnOrderQty(p.id):0;return `<tr class="click-row" onclick="openPartDetail(${p.id})"><td><div class="task-title">${esc(p.name)}</div><div class="task-note">${esc(p.notes)}</div></td><td>${esc(p.partNo||'—')}</td><td>${esc(p.system||'—')}</td><td>${partAvailable(p)===null?'—':esc(partAvailable(p)+' '+(p.unit||''))}</td><td>${incoming?`<span class="blue pill">${esc(incoming+' '+(p.unit||''))}</span>`:'—'}</td><td>${esc(partConsumedQty(p.id)+' '+(p.unit||''))}</td><td>${pill(p.status)}</td><td>${esc(p.vendor||'—')}</td><td>${db.settings.showCosts?fmtMoney(p.unitCost):'Hidden'}</td><td><button class="icon-btn" onclick="event.stopPropagation();openPartModal(${p.id})">Edit</button></td></tr>`}).join('')||'<tr><td colspan="10" class="empty">No matching parts.</td></tr>'}

let orderSort={key:'default',dir:'asc'};
// Presentation only: closed Orders remain in the same durable records.
let orderStatusFilter='Open';
function setOrderStatusFilter(value){orderStatusFilter=String(value);renderOrderRows()}

const ORDER_STATUS_RANK={'Need to Order':0,Quoted:1,Ordered:2,Backordered:3,Received:4,Cancelled:5};
function orderSortHead(label,key){const active=orderSort.key===key,aria=active?(orderSort.dir==='asc'?'ascending':'descending'):'none';return `<th class="order-sortable" aria-sort="${aria}"><button class="order-sort-button" data-order-sort="${key}" onclick="setOrderSort('${key}')" title="Sort by ${esc(label)}">${esc(label)} <span>${active?(orderSort.dir==='asc'?'▲':'▼'):'↕'}</span></button></th>`}
function refreshOrderSortHeaders(){document.querySelectorAll('#page-orders .order-sort-button').forEach(b=>{const active=b.dataset.orderSort===orderSort.key;b.closest('th')?.setAttribute('aria-sort',active?(orderSort.dir==='asc'?'ascending':'descending'):'none');const arrow=b.querySelector('span');if(arrow)arrow.textContent=active?(orderSort.dir==='asc'?'▲':'▼'):'↕'})}
function setOrderSort(key){if(orderSort.key===key)orderSort.dir=orderSort.dir==='asc'?'desc':'asc';else orderSort={key,dir:'asc'};refreshOrderSortHeaders();renderOrderRows()}
function orderSortValue(o,key){if(key==='item')return o.item;if(key==='project')return orderProjectSummary(o);if(key==='part')return o.partId?partName(o.partId):'';if(key==='vendor')return o.vendor;if(key==='qty')return num(o.qty);if(key==='received')return typeof orderReceivedQty==='function'?orderReceivedQty(o):(o.inventoryApplied?num(o.qty):0);if(key==='status')return ORDER_STATUS_RANK[o.status]??99;if(key==='eta')return o.eta||'';if(key==='total')return orderTotal(o);return ''}
function sortOrderRows(rows,closedFn=isClosedOrder){if(orderSort.key==='default')return rows.sort((a,b)=>closedFn(a)-closedFn(b)||(b.orderedDate||'').localeCompare(a.orderedDate||''));const dir=orderSort.dir==='desc'?-1:1,key=orderSort.key,collator=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});return rows.sort((a,b)=>{const av=orderSortValue(a,key),bv=orderSortValue(b,key),aBlank=av===''||av===null||av===undefined,bBlank=bv===''||bv===null||bv===undefined;if(aBlank!==bBlank)return aBlank?1:-1;const primary=typeof av==='number'&&typeof bv==='number'?av-bv:collator.compare(String(av),String(bv));return primary*dir||collator.compare(String(a.item||''),String(b.item||''))||num(a.id)-num(b.id)})}
(()=>{if(document.getElementById('orderSortStyle'))return;const s=document.createElement('style');s.id='orderSortStyle';s.textContent=`#page-orders th.order-sortable{padding:0}#page-orders th.order-sortable:hover{background:#eef5fb}#page-orders .order-sort-button{appearance:none;width:100%;border:0;background:transparent;color:inherit;font:inherit;font-weight:inherit;padding:10px 12px;text-align:left;cursor:pointer;white-space:nowrap}#page-orders .order-sort-button span{font-size:.72em;margin-left:5px;opacity:.55}`;document.head.appendChild(s)})();
function renderOrders(){
  document.getElementById('page-orders').innerHTML=`<div class="card"><div class="toolbar"><div><h1>Orders</h1><div class="muted">Active purchase queue. Completed and cancelled orders remain searchable under History; nothing is deleted.</div></div><button class="btn primary" onclick="openOrderModal()">+ Add Order</button></div>
  <div class="controls"><input id="orderSearch" placeholder="Search orders…" oninput="renderOrderRows()"><select id="orderStatus" aria-label="Order view" onchange="setOrderStatusFilter(this.value)"><option value="Open"${orderStatusFilter==='Open'?' selected':''}>Open — active orders</option><option value="History"${orderStatusFilter==='History'?' selected':''}>History — received / cancelled</option><option value=""${orderStatusFilter===''?' selected':''}>All orders</option><optgroup label="Individual statuses">${['Need to Order','Quoted','Ordered','Backordered','Received','Cancelled'].map(status=>`<option value="${esc(status)}"${orderStatusFilter===status?' selected':''}>${esc(status)}</option>`).join('')}</optgroup></select><select id="orderSystem" onchange="renderOrderRows()">${trackerSystemFilterOptions('')}</select></div>
  <div class="table-wrap" style="margin-top:11px"><table><thead><tr>${orderSortHead('Item','item')}${orderSortHead('Project','project')}${orderSortHead('Part','part')}${orderSortHead('Vendor','vendor')}${orderSortHead('Quantity','qty')}${orderSortHead('Received','received')}${orderSortHead('Status','status')}${orderSortHead('ETA','eta')}${orderSortHead('Total','total')}<th></th></tr></thead><tbody id="orderRows"></tbody></table></div></div>`;renderOrderRows();
}
function renderOrderRows(){const el=document.getElementById('orderRows');if(!el)return;const q=(val('orderSearch')||'').toLowerCase(),st=val('orderStatus'),sys=val('orderSystem');const statusMatch=o=>!st||(st==='Open'?!isClosedOrder(o):st==='History'?isClosedOrder(o):o.status===st);const rows=sortOrderRows(db.orders.filter(o=>(!q||[o.item,o.vendor,o.tracking,o.notes,o.blockerReason,orderProjectSummary(o),partName(o.partId),typeof window.orderSystemName==='function'?window.orderSystemName(o):o.system].join(' ').toLowerCase().includes(q))&&statusMatch(o)&&trackerRecordMatchesSystem(o,sys,'orders')));const groups=new Map();rows.forEach(o=>{const key=typeof orderGroupKey==='function'?orderGroupKey(o):`single:${o.id}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(o)});el.innerHTML=[...groups.entries()].map(([,items])=>{const first=items[0],total=items.reduce((s,o)=>s+orderTotal(o),0),remaining=items.reduce((s,o)=>s+(isClosedOrder(o)?0:(typeof orderRemainingQty==='function'?orderRemainingQty(o):(o.inventoryApplied?0:num(o.qty)))),0),open=items.filter(o=>!isClosedOrder(o));const grouped=items.length>1||first.tracking;return `${grouped?`<tr class="order-group-row"><td colspan="10"><div class="section-tools"><div><b>${esc(first.tracking||first.vendor||'Order')}</b><div class="task-note">${esc(first.vendor||'No vendor')} • ${items.length} line${items.length===1?'':'s'} • ${db.settings.showCosts?fmtMoney(total):'Costs hidden'} • ${esc(remaining)} unit${remaining===1?'':'s'} remaining</div></div>${open.length?`<div class="action-row"><button class="btn secondary" onclick="event.stopPropagation();openReceiveOrderGroupModal(${first.id})">Receive Part of Order</button><button class="btn success" onclick="event.stopPropagation();receiveOrderGroupFor(${first.id})">Receive Entire Order</button></div>`:''}</div></td></tr>`:''}${items.map(o=>{const received=typeof orderReceivedQty==='function'?orderReceivedQty(o):(o.inventoryApplied?num(o.qty):0);return `<tr class="click-row" onclick="openOrderDetail(${o.id})"><td><b>${esc(o.item)}</b><div class="task-note">${esc(o.blockerReason||o.notes||'')}</div></td><td>${esc(orderProjectSummary(o))}</td><td>${esc(o.partId?partName(o.partId):'—')}</td><td>${esc(o.vendor||'—')}</td><td>${esc(o.qty||'—')} ${esc(o.unit||'')}</td><td>${esc(received+' '+(o.unit||''))}</td><td>${pill(o.status)}</td><td>${esc(o.eta||'—')}</td><td>${db.settings.showCosts?fmtMoney(orderTotal(o)):'Hidden'}</td><td><button class="icon-btn" onclick="event.stopPropagation();openOrderModal(${o.id})">Edit</button></td></tr>`}).join('')}`}).join('')||'<tr><td colspan="10" class="empty">No matching orders.</td></tr>'}

function renderDocuments(){
  document.getElementById('page-documents').innerHTML=`<div class="card"><div class="toolbar"><div><h1>Documents</h1><div class="muted">Manuals, diagrams, records, receipts, specifications and links. Every row opens a document record with links to the work it supports.</div></div><button class="btn primary" onclick="openDocModal()">+ Add Document</button></div><div class="controls"><input id="docSearch" placeholder="Search documents…" oninput="renderDocRows()"><select id="docType" onchange="renderDocRows()"><option value="">All types</option>${unique(db.docs.map(d=>d.type).filter(Boolean)).sort().map(s=>`<option>${esc(s)}</option>`).join('')}</select></div><div class="table-wrap" style="margin-top:11px"><table><thead><tr><th>Document</th><th>Type</th><th>Revision</th><th>System</th><th>Linked projects</th><th>Location</th><th></th></tr></thead><tbody id="docRows"></tbody></table></div></div>`;renderDocRows();
}
function renderDocRows(){const el=document.getElementById('docRows');if(!el)return;const q=(val('docSearch')||'').toLowerCase(),type=val('docType');const rows=db.docs.filter(d=>(!q||[d.name,d.type,d.revision,d.system,d.publisher,d.location,d.notes].join(' ').toLowerCase().includes(q))&&(!type||d.type===type));el.innerHTML=rows.map(d=>`<tr class="click-row" onclick="openDocumentDetail(${d.id})"><td><b>${esc(d.name)}</b><div class="task-note">${esc(d.publisher||d.notes)}</div></td><td>${esc(d.type||'—')}</td><td>${esc(d.revision||'—')}</td><td>${esc(d.system||'—')}</td><td>${d.linkedProjectIds.length}</td><td>${isURL(d.location)?'<span class="blue pill">Web link</span>':esc(d.location||'—')}</td><td><button class="icon-btn" onclick="event.stopPropagation();openDocModal(${d.id})">Edit</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty">No matching documents.</td></tr>'}

function renderLogbook(){
  document.getElementById('page-logbook').innerHTML=`<div class="card"><div class="toolbar"><div><h1>Work Log</h1><div class="muted">Every entry opens into a complete work record: parts/consumables, linked projects, observations, blockers, next step, labor, costs and supporting files.</div></div><button class="btn primary" onclick="openLogModal()">+ Add Work Entry</button></div><div class="controls"><input id="logSearch" placeholder="Search work log…" oninput="renderLogRows()"><select id="logSystem" onchange="renderLogRows()">${trackerSystemFilterOptions('')}</select></div><div class="table-wrap" style="margin-top:11px"><table><thead><tr><th>Date</th><th>System</th><th>Work performed</th><th>Project(s)</th><th>Labor</th><th>Consumed cost</th><th>Blocker / next step</th><th></th></tr></thead><tbody id="logRows"></tbody></table></div></div>`;renderLogRows();
}
function renderLogRows(){const el=document.getElementById('logRows');if(!el)return;const q=(val('logSearch')||'').toLowerCase(),sys=val('logSystem');const rows=[...db.logs].filter(l=>(!q||[l.date,l.system,l.work,l.observations,l.blockers,l.nextStep,l.notes,...l.projectIds.map(projectName),...l.consumedParts.map(p=>p.name)].join(' ').toLowerCase().includes(q))&&trackerRecordMatchesSystem(l,sys,'logs')).sort((a,b)=>(b.date||'').localeCompare(a.date||''));el.innerHTML=rows.map(l=>`<tr class="click-row" onclick="openLogDetail(${l.id})"><td>${esc(l.date)}</td><td>${esc(l.system||'—')}</td><td><b>${esc(l.work)}</b><div class="task-meta"><span class="mini-badge">${l.consumedParts.length} consumed items</span>${l.airframeHours?`<span class="mini-badge">AF ${esc(l.airframeHours)}</span>`:''}${l.engineHours?`<span class="mini-badge">ENG ${esc(l.engineHours)}</span>`:''}</div></td><td>${l.projectIds.length?l.projectIds.map(id=>`<span class="tag">${esc(projectName(id))}</span>`).join(''):'—'}</td><td>${esc(l.laborHours||'—')}</td><td>${db.settings.showCosts?fmtMoney(consumedCost(l)):'Hidden'}</td><td>${l.blockers?`<span class="red pill">Held up</span><div class="task-note">${esc(l.blockers)}</div>`:`<div class="task-note">Next: ${esc(l.nextStep||'—')}</div>`}</td><td><button class="icon-btn" onclick="event.stopPropagation();openLogModal(${l.id})">Edit</button></td></tr>`).join('')||'<tr><td colspan="8" class="empty">No matching work entries.</td></tr>'}

function renderSettings(){
  const repo=db.settings.repositoryUrl||'';
  document.getElementById('page-settings').innerHTML=`<div class="grid"><div class="card span-6"><h1>Settings</h1><div class="form-grid">${field('Currency','settingCurrency',db.settings.currency||'USD')}<div><label>Cost display</label><label style="display:flex;gap:8px;align-items:center;text-transform:none;letter-spacing:0;font-size:13px"><input style="width:auto" type="checkbox" id="settingShowCosts" ${db.settings.showCosts?'checked':''}> Show prices and cost totals</label></div>${textareaField('Owner / project note','settingOwnerNote',db.settings.ownerNote||'')}<div class="full"><label>GitHub repository URL (optional)</label><input id="settingRepo" value="${esc(repo)}" placeholder="https://github.com/you/N594ZS-Tracker"></div></div><div class="action-row" style="margin-top:12px"><button class="btn primary" onclick="saveSettings()">Save Settings</button>${isURL(repo)?`<button class="btn secondary" onclick="window.open('${esc(repo)}','_blank')">Open Repository</button>`:''}</div></div>
  <div class="card span-6"><h2>Backup & Restore</h2><p class="muted">Core data lives in this browser. Files/screenshots live in IndexedDB. A full backup includes both and can be much larger.</p><div class="action-row"><button class="btn secondary" onclick="exportCoreData()">Export Core JSON</button><button class="btn secondary" onclick="exportFullBackup()">Export Full Backup</button><button class="btn secondary" onclick="document.getElementById('importFile').click()">Import Backup</button></div><div id="storageStats" class="cost-box" style="margin-top:12px">Calculating attachment storage…</div></div>
  <div class="card span-6"><h2>GitHub / Deployment</h2><p class="muted">GitHub holds the app code and version history while GitHub Pages publishes the tracker.</p><div class="kv"><span>App version</span><b>${APP_VERSION}</b></div><div class="kv"><span>Data model</span><b>v3</b></div><div class="kv"><span>Local data key</span><code>${DB_KEY}</code></div><div class="detail-section"><label>App update</label><p class="muted small">If this device looks stuck on an older release, force a clean reload of the newest deployed app. This keeps saved tracker data and attachments, checks pending cloud sync first, and clears only old N594ZS app caches/service workers.</p><div class="action-row"><button class="btn secondary" onclick="forceLatestAppVersion()">Force Latest Version</button></div></div></div>
  <div class="card span-6"><h2>Reset</h2><p class="muted">Resetting core data does not automatically delete locally stored attachments.</p><div class="action-row"><button class="btn danger" onclick="resetData()">Reset Starter Data</button><button class="btn danger" onclick="clearAllAttachments()">Delete All Attachments</button></div></div>
  <div class="card span-12 notice"><b>Live sync:</b> GitHub hosts and versions the application code. N594ZS Tracker data syncs through the authenticated Supabase workspace, with record-level cloud sync and live updates across signed-in devices. IndexedDB/local browser storage is only a local cache and recovery layer; it does not replace the shared cloud workspace.</div></div>`;
  renderStorageStats();
}

function renderAll(){renderDashboard();renderAircraft();renderProjects();renderParts();renderOrders();renderDocuments();renderChecklists();renderLogbook();renderSettings();renderNav();document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));document.getElementById('page-'+currentPage)?.classList.add('active')}
