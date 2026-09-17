// ---------- V5.3 INVENTORY TRANSACTIONS / RESERVE->USE / QUICK ADD 2.0 ----------
// Adds auditable manual adjustments on top of existing purchase inflows and work-log outflows.
// Physical stock continues to be reduced only by work-log consumption, preventing project records
// from double-counting inventory.
(function(){
  if(window.__n594zsV53InventoryWorkflowInstalled)return;
  window.__n594zsV53InventoryWorkflowInstalled=true;

  var style=document.createElement('style');
  style.textContent=`
    .inv-adjust-row{display:grid;grid-template-columns:86px minmax(0,1fr) auto auto;gap:8px;align-items:center;padding:8px 0;border-bottom:1px solid #edf1f4;font-size:12px}
    .inv-adjust-row:last-child{border-bottom:0}.inv-adjust-pos{color:#21754a}.inv-adjust-neg{color:#984039}.inv-adjust-delta{font-weight:900;white-space:nowrap}.inv-ledger-note{margin-top:8px;padding:8px 10px;border-radius:7px;background:#f8fbfd;border:1px solid #e1e9ef}
    .reservation-actions{display:flex;gap:6px;justify-content:flex-end;flex-wrap:wrap}.quick-use-list{display:grid;gap:8px;margin-top:10px}.quick-use-item{width:100%;text-align:left;border:1px solid #d7e2e9;border-radius:9px;background:#fff;padding:11px;cursor:pointer;color:#17324c}.quick-use-item:hover{background:#f6fafc}.quick-use-item b{display:block}.quick-use-item small{display:block;color:#6e7f8e;margin-top:4px}.quick-use-qty{float:right;font-weight:900;color:#865b11}
    @media(max-width:760px){.inv-adjust-row{grid-template-columns:72px minmax(0,1fr) auto}.inv-adjust-row .inv-reverse{grid-column:2/-1;justify-self:start}.reservation-actions{grid-column:1/-1;justify-content:flex-start}}
  `;
  document.head.appendChild(style);

  // ----- Normalization / persistent adjustment ledger -----
  var normalizeBase=window.normalizeDB;
  window.normalizeDB=function(){
    normalizeBase();
    (db.parts||[]).forEach(function(p){
      p.inventoryAdjustments=arr(p.inventoryAdjustments).map(function(a){return {
        id:a.id||uid(),date:a.date||today(),delta:num(a.delta),reason:a.reason||'Adjustment',notes:a.notes||'',reverses:a.reverses||null
      }});
    });
  };
  window.normalizeDB();

  window.inventoryAdjustmentTotal=function(partId){
    var p=partById(Number(partId));if(!p)return 0;
    return arr(p.inventoryAdjustments).reduce(function(s,a){return s+num(a.delta)},0);
  };

  // stockQty remains the received/opening quantity. Work logs are physical outflows.
  // Manual corrections/scrap/returns live in inventoryAdjustments.
  window.partAvailable=function(p){
    if(!p)return null;
    var hasBase=!(p.stockQty===''||p.stockQty===null||p.stockQty===undefined);
    var adj=arr(p.inventoryAdjustments).reduce(function(s,a){return s+num(a.delta)},0);
    if(!hasBase&&!adj)return null;
    return num(p.stockQty)+adj-partConsumedQty(p.id);
  };

  var movementBase=window.partMovementRows;
  window.partMovementRows=function(part){
    var rows=typeof movementBase==='function'?movementBase(part):[];
    arr(part.inventoryAdjustments).forEach(function(a){
      rows.push({date:a.date||'',kind:'ADJUST',desc:(a.reason||'Inventory adjustment')+(a.notes?' • '+a.notes:''),qty:num(a.delta),unit:part.unit||'ea'});
    });
    return rows.sort(function(a,b){return (b.date||'9999').localeCompare(a.date||'9999')});
  };

  function adjustmentHistoryHTML(p){
    var rows=[...arr(p.inventoryAdjustments)].sort(function(a,b){return (b.date||'').localeCompare(a.date||'')});
    return `<div class="detail-section" id="manualInventoryAdjustments"><div class="section-tools"><label style="margin:0">Manual inventory adjustments</label><button class="icon-btn" onclick="openInventoryAdjustmentModal(${p.id})">+ Adjust</button></div>${rows.length?rows.map(function(a){var d=num(a.delta);return `<div class="inv-adjust-row"><span>${esc(a.date||'')}</span><span><b>${esc(a.reason||'Adjustment')}</b>${a.notes?`<div class="task-note">${esc(a.notes)}</div>`:''}</span><span class="inv-adjust-delta ${d>=0?'inv-adjust-pos':'inv-adjust-neg'}">${d>0?'+':''}${esc(d)} ${esc(p.unit||'ea')}</span><button class="icon-btn inv-reverse" onclick="reverseInventoryAdjustment(${p.id},${JSON.stringify(a.id)})">Reverse</button></div>`}).join(''):'<div class="muted small">No manual adjustments. Purchases and work-log usage still appear in the transaction history above.</div>'}<div class="tiny muted inv-ledger-note">On hand = recorded received/opening quantity + manual adjustments − work-log consumption. Project reservations affect Free inventory but do not change physical On Hand until they are used.</div></div>`;
  }

  function decoratePartInventory(partId){
    var p=partById(Number(partId)),card=document.getElementById('smartPartInventory');if(!p||!card)return;
    if(!card.querySelector('#inventoryAdjustButton')){
      var h=card.querySelector('h3');if(h)h.insertAdjacentHTML('afterend',`<div class="action-row" style="margin:-2px 0 8px"><button class="icon-btn" id="inventoryAdjustButton" onclick="openInventoryAdjustmentModal(${p.id})">± Adjust Inventory</button></div>`);
    }
    if(!card.querySelector('#manualInventoryAdjustments'))card.insertAdjacentHTML('beforeend',adjustmentHistoryHTML(p));
  }

  var openPartDetailBase=window.openPartDetail;
  window.openPartDetail=function(id){openPartDetailBase(id);decoratePartInventory(Number(id))};

  window.openInventoryAdjustmentModal=function(partId){
    var p=partById(Number(partId));if(!p)return;
    var on=partAvailable(p);
    openModal(`${modalHeader('Adjust Inventory',p.name)}<div class="notice" style="margin-bottom:12px">Current calculated on hand: <b>${on===null?'—':esc(on+' '+(p.unit||'ea'))}</b>. Enter a positive change to add stock or a negative change to remove stock.</div><div class="form-grid">${field('Date','iaDate',today(),'date')}${field('Quantity change (+ / −)','iaDelta','','number','step="any"')}<div class="full"><label>Reason</label><select id="iaReason"><option>Count correction</option><option>Returned to stock</option><option>Found / recovered</option><option>Scrapped / damaged</option><option>Lost / missing</option><option>Other adjustment</option></select></div>${textareaField('Notes','iaNotes','')}</div><div class="modal-actions"><button class="btn secondary" onclick="openPartDetail(${p.id})">Cancel</button><button class="btn primary" onclick="saveInventoryAdjustment(${p.id})">Save Adjustment</button></div>`);
  };

  window.saveInventoryAdjustment=function(partId){
    var p=partById(Number(partId));if(!p)return;
    var delta=Number(val('iaDelta'));if(!Number.isFinite(delta)||delta===0)return alert('Enter a non-zero quantity change.');
    if(delta<0){var on=partAvailable(p);if(on!==null&&on+delta<0&&!confirm('This adjustment will make calculated inventory negative. Save it anyway?'))return;}
    p.inventoryAdjustments=arr(p.inventoryAdjustments);p.inventoryAdjustments.push({id:uid(),date:val('iaDate')||today(),delta:delta,reason:val('iaReason')||'Adjustment',notes:val('iaNotes')||''});
    saveDB('Inventory adjustment recorded.');openPartDetail(p.id);
  };

  window.reverseInventoryAdjustment=function(partId,adjustmentId){
    var p=partById(Number(partId));if(!p)return;var a=arr(p.inventoryAdjustments).find(function(x){return String(x.id)===String(adjustmentId)});if(!a)return;
    if(!confirm('Reverse this adjustment with an equal and opposite transaction?'))return;
    p.inventoryAdjustments.push({id:uid(),date:today(),delta:-num(a.delta),reason:'Reversal',notes:`Reverses ${a.reason||'adjustment'} from ${a.date||'unknown date'}`,reverses:a.id});
    saveDB('Inventory adjustment reversed.');openPartDetail(p.id);
  };

  // ----- Reserved -> Used workflow -----
  window.plannedPartsHTML=function(projectId){
    var p=projectById(Number(projectId));if(!p)return '';
    var rows=arr(p.plannedParts);
    return `<div class="detail-card" id="projectPlannedPartsCard"><div class="section-tools"><div><h3>Planned / Reserved Parts</h3><div class="tiny muted">Reserved reduces Free inventory. Use creates the physical work-log consumption and releases the reservation.</div></div><button class="icon-btn" onclick="openReservePartModal(${p.id})">+ Reserve Part</button></div>${rows.length?rows.map(function(x){var part=x.partId?partById(x.partId):null,free=part?partFreeQty(part):null;return `<div class="reservation-row"><div><b>${x.partId?`<button class="linkbtn" onclick="openPartDetail(${x.partId})">${esc(x.name||partName(x.partId))}</button>`:esc(x.name||'Planned item')}</b><div class="task-note">${esc(x.notes||'')}${part&&free!==null?` • free after reservations: ${esc(free)} ${esc(part.unit||x.unit||'ea')}`:''}</div></div><div class="reservation-qty ${part&&free!==null&&free<0?'stock-short':'stock-ok'}">${esc(x.qty)} ${esc(x.unit||part?.unit||'ea')}</div><div class="reservation-actions">${part?`<button class="btn success" onclick="openUseReservedPartModal(${p.id},${JSON.stringify(x.id)})">Use</button>`:''}<button class="icon-btn" onclick="removeReservedPart(${p.id},${JSON.stringify(x.id)})">Release</button></div></div>`}).join(''):'<div class="empty">No parts reserved for this project yet.</div>'}</div>`;
  };

  window.openUseReservedPartModal=function(projectId,itemId){
    var p=projectById(Number(projectId));if(!p)return;var item=arr(p.plannedParts).find(function(x){return String(x.id)===String(itemId)});if(!item)return;var part=partById(Number(item.partId));if(!part)return;
    var on=partAvailable(part);
    openModal(`${modalHeader('Use Reserved Part',p.title)}<div class="notice" style="margin-bottom:12px"><b>${esc(part.name)}</b><br>Reserved: ${esc(item.qty)} ${esc(item.unit||part.unit||'ea')} • Calculated on hand: ${on===null?'—':esc(on+' '+(part.unit||'ea'))}</div><div class="form-grid">${field('Date','urDate',today(),'date')}${field('Quantity used','urQty',item.qty,'number','step="any" min="0.000001"')}${textareaField('Work performed','urWork',`Used ${part.name} on ${p.title}`)}${textareaField('Measurements / notes','urNotes',item.notes||'')}</div><div class="modal-actions"><button class="btn secondary" onclick="openProjectDetail(${p.id})">Cancel</button><button class="btn success" onclick="saveReservedPartUse(${p.id},${JSON.stringify(item.id)})">Record Use</button></div>`);
  };

  function addProjectUseRecord(project,part,qty,unit,unitCost,notes,logId){
    project.partsUsed=arr(project.partsUsed);
    project.partsUsed.push({id:uid(),partId:part.id,name:part.name,qty:qty,unit:unit,unitCost:unitCost,notes:(notes?notes+' • ':'')+'Recorded from reservation use'+(logId?` • work log ${logId}`:'')});
  }

  window.saveReservedPartUse=function(projectId,itemId){
    var project=projectById(Number(projectId));if(!project)return;var item=arr(project.plannedParts).find(function(x){return String(x.id)===String(itemId)});if(!item)return;var part=partById(Number(item.partId));if(!part)return;
    var qty=Number(val('urQty'));if(!Number.isFinite(qty)||qty<=0)return alert('Enter a positive quantity used.');if(qty>num(item.qty)+1e-9)return alert('Quantity used cannot exceed the reserved quantity.');
    var on=partAvailable(part);if(on!==null&&qty>on&&!confirm('This use exceeds calculated physical inventory and will make the part quantity negative. Record it anyway?'))return;
    var logId=uid(),unit=item.unit||part.unit||'ea',notes=val('urNotes')||'';
    db.logs.push({id:logId,date:val('urDate')||today(),airframeHours:'',engineHours:'',laborHours:'',system:project.system||part.system||'General',projectIds:[project.id],work:val('urWork')||`Used ${part.name}`,observations:notes,blockers:'',nextStep:'',consumedParts:[{id:uid(),partId:part.id,name:part.name,qty:qty,unit:unit,unitCost:part.unitCost,notes:'Consumed from project reservation'}],otherCost:'',notes:'Created by Reserve → Use workflow.'});
    addProjectUseRecord(project,part,qty,unit,part.unitCost,notes,logId);
    item.qty=Math.max(0,num(item.qty)-qty);if(item.qty<=1e-9)project.plannedParts=arr(project.plannedParts).filter(function(x){return String(x.id)!==String(itemId)});
    if(!arr(part.linkedProjectIds).includes(project.id))part.linkedProjectIds.push(project.id);
    saveDB('Reserved part used and inventory consumption recorded.');openLogDetail(logId);
  };

  // ----- Quick Add 2.0 -----
  function openProjectsSelect(id,label,selected){
    var projects=arr(db.projects).filter(function(p){return p.status!=='Done'});
    return `<div class="full"><label>${esc(label||'Project')}</label><select id="${id}">${selectOptions(projects.map(function(p){return {value:p.id,label:p.title}}),selected||null,'— No project —')}</select></div>`;
  }

  window.openQuickReservedUse=function(){
    var count=arr(db.projects).reduce(function(n,p){return n+(p.status==='Done'?0:arr(p.plannedParts).filter(function(x){return !!x.partId}).length)},0);
    openModal(`${modalHeader('Use Reserved Part','Pick a reservation, then record actual use')}<input id="qruSearch" type="search" placeholder="Search project or part…" oninput="renderQuickReservedUseList()"><div id="qruList" class="quick-use-list"></div>${count?'':'<div class="empty">No active part reservations.</div>'}`);
    window.renderQuickReservedUseList();
  };

  window.renderQuickReservedUseList=function(){
    var box=document.getElementById('qruList');if(!box)return;var q=(val('qruSearch')||'').toLowerCase(),rows=[];
    arr(db.projects).filter(function(p){return p.status!=='Done'}).forEach(function(project){arr(project.plannedParts).forEach(function(item){var part=item.partId?partById(Number(item.partId)):null;if(!part)return;var hay=(project.title+' '+part.name+' '+(part.partNo||'')+' '+(part.system||'')).toLowerCase();if(q&&!hay.includes(q))return;rows.push({project:project,item:item,part:part})})});
    box.innerHTML=rows.map(function(r){return `<button class="quick-use-item" onclick="openUseReservedPartModal(${r.project.id},${JSON.stringify(r.item.id)})"><span class="quick-use-qty">${esc(r.item.qty)} ${esc(r.item.unit||r.part.unit||'ea')}</span><b>${esc(r.part.name)}</b><small>${esc(r.project.title)}${r.part.partNo?' • '+esc(r.part.partNo):''} • On hand ${esc(partAvailable(r.part)??'—')}</small></button>`}).join('')||'<div class="empty">No matching reservations.</div>';
  };

  window.openQuickPartUse=function(){
    openModal(`${modalHeader('Quick Part Used','Record actual physical use in a few fields')}<div class="form-grid">${typeof searchablePartPicker==='function'?searchablePartPicker('qpu',null,'Inventory part'):`<div class="full"><label>Inventory part</label><select id="qpuPartFallback">${partOptions(null)}</select></div>`}${openProjectsSelect('qpuProject','Project (optional)',null)}${field('Date','qpuDate',today(),'date')}${field('Quantity used','qpuQty','1','number','step="any" min="0.000001"')}${textareaField('Work performed','qpuWork','')}${textareaField('Notes / measurement','qpuNotes','')}</div><div class="modal-actions"><button class="btn secondary" onclick="openQuickAdd()">Back</button><button class="btn primary" onclick="saveQuickPartUse()">Record Use</button></div>`);
  };

  function quickPartPickerId(){if(typeof partPickerId==='function')return partPickerId('qpu');return selectedNumber('qpuPartFallback')}
  window.saveQuickPartUse=function(){
    var partId=quickPartPickerId(),part=partId?partById(Number(partId)):null;if(!part)return alert('Choose an inventory part.');var qty=Number(val('qpuQty'));if(!Number.isFinite(qty)||qty<=0)return alert('Enter a positive quantity.');
    var projectId=selectedNumber('qpuProject'),project=projectId?projectById(projectId):null,on=partAvailable(part);if(on!==null&&qty>on&&!confirm('This use exceeds calculated physical inventory and will make the quantity negative. Record it anyway?'))return;
    var logId=uid(),unit=part.unit||'ea',work=val('qpuWork')||`Used ${part.name}${project?' on '+project.title:''}`,notes=val('qpuNotes')||'';
    db.logs.push({id:logId,date:val('qpuDate')||today(),airframeHours:'',engineHours:'',laborHours:'',system:project?.system||part.system||'General',projectIds:project?[project.id]:[],work:work,observations:notes,blockers:'',nextStep:'',consumedParts:[{id:uid(),partId:part.id,name:part.name,qty:qty,unit:unit,unitCost:part.unitCost,notes:'Quick Add physical consumption'}],otherCost:'',notes:'Created by Quick Add 2.0.'});
    if(project){addProjectUseRecord(project,part,qty,unit,part.unitCost,notes,logId);if(!arr(part.linkedProjectIds).includes(project.id))part.linkedProjectIds.push(project.id);var reserved=arr(project.plannedParts).find(function(x){return Number(x.partId)===Number(part.id)});if(reserved){reserved.qty=Math.max(0,num(reserved.qty)-qty);if(reserved.qty<=1e-9)project.plannedParts=arr(project.plannedParts).filter(function(x){return String(x.id)!==String(reserved.id)})}}
    saveDB('Part use recorded.');openLogDetail(logId);
  };

  window.openQuickNote=function(measurementMode){
    openModal(`${modalHeader(measurementMode?'Quick Measurement':'Quick Work Note',measurementMode?'Capture a reading or observation':'Minimal work-log entry')}<div class="form-grid">${openProjectsSelect('qnProject','Project (optional)',null)}${field('Date','qnDate',today(),'date')}${textareaField(measurementMode?'What are you measuring?':'Work / note','qnWork','')}${textareaField(measurementMode?'Reading / observation':'Details / observation','qnObs','')}</div><div class="modal-actions"><button class="btn secondary" onclick="openQuickAdd()">Back</button><button class="btn primary" onclick="saveQuickNote(${measurementMode?'true':'false'})">Save</button></div>`);
  };

  window.saveQuickNote=function(measurementMode){
    var projectId=selectedNumber('qnProject'),project=projectId?projectById(projectId):null,work=val('qnWork'),obs=val('qnObs');if(!work&&!obs)return alert('Enter a note or observation.');
    var title=work||(measurementMode?'Measurement / observation':'Work note'),logId=uid();db.logs.push({id:logId,date:val('qnDate')||today(),airframeHours:'',engineHours:'',laborHours:'',system:project?.system||'General',projectIds:project?[project.id]:[],work:title,observations:obs,blockers:'',nextStep:'',consumedParts:[],otherCost:'',notes:measurementMode?'Quick measurement entry.':'Quick work note.'});
    saveDB(measurementMode?'Measurement recorded.':'Work note recorded.');openLogDetail(logId);
  };

  window.openQuickAttach=function(){
    if(currentDetail&&currentDetail.type&&currentDetail.id){chooseAttachments(currentDetail.type,currentDetail.id);return;}
    var projects=arr(db.projects).filter(function(p){return p.status!=='Done'});if(!projects.length)return alert('Open a record first or create a project to attach the photo/file to.');
    openModal(`${modalHeader('Quick Photo / File','Attach directly to an active project')}<div><label>Project</label><select id="qaProject">${selectOptions(projects.map(function(p){return {value:p.id,label:p.title}}),projects[0]?.id,'— Select project —')}</select></div><div class="modal-actions"><button class="btn secondary" onclick="openQuickAdd()">Back</button><button class="btn primary" onclick="chooseQuickAttachmentTarget()">Choose Photo / File</button></div>`);
  };
  window.chooseQuickAttachmentTarget=function(){var pid=selectedNumber('qaProject');if(!pid)return alert('Choose a project.');chooseAttachments('project',pid)};

  window.openQuickAdd=function(){
    openModal(`${modalHeader('Quick Add','Fast capture while you are standing next to N594ZS')}<div class="quick-add-grid"><button onclick="openQuickReservedUse()">Use reserved part<small>Reservation → actual use → inventory deduction</small></button><button onclick="openQuickPartUse()">Part / material used<small>Search inventory and record physical consumption</small></button><button onclick="openQuickNote(false)">Work note<small>Fast project or general work entry</small></button><button onclick="openQuickNote(true)">Measurement<small>Capture a reading, setting or observation</small></button><button onclick="openQuickAttach()">Photo / file<small>Attach to the current record or an active project</small></button><button onclick="openSquawkModal()">Squawk<small>Discrepancy, severity, troubleshooting</small></button><button onclick="openRunModal()">Run / test<small>Engine, ground, taxi or flight-test data</small></button><button onclick="openPurchaseModal()">Purchase<small>Add a purchase-history line</small></button><button onclick="openProjectModal()">Project<small>New job or corrective-work item</small></button><button onclick="navTo('ops');closeModal()">Aircraft Ops<small>Status, configuration, inspections and reports</small></button></div>`);
  };
})();
