// ---------- V5.0 RELATED RECORDS + PROJECT MEDIA + EQUIPMENT LIFECYCLE ----------

const normalizeDBRelatedBase=normalizeDB;
normalizeDB=function(){
  normalizeDBRelatedBase();
  db.equipment=arr(db.equipment);db.equipment.forEach(e=>{e.warrantyUntil=e.warrantyUntil||'';e.lifecycleNotes=e.lifecycleNotes||''});
};
normalizeDB();

function relatedButton(kind,label,sub,go){return `<button class="related-link" onclick="${go}"><span class="mini-badge">${esc(kind)}</span><b>${esc(label)}</b><small>${esc(sub||'')}</small></button>`}
function relatedFor(type,id){
  const out=[],sid=String(id),nid=Number(id);
  if(type==='project'){
    const p=projectById(nid);if(!p)return out;
    db.equipment.filter(e=>arr(e.linkedProjectIds).includes(nid)).forEach(e=>out.push(['Equipment',e.name,equipmentDisplayModel(e),`openEquipmentDetail(${e.id})`]));
    db.parts.filter(x=>arr(x.linkedProjectIds).includes(nid)||arr(p.partsUsed).some(u=>Number(u.partId)===Number(x.id))).forEach(x=>out.push(['Part',x.name,x.partNo||x.system,`openPartDetail(${x.id})`]));
    db.purchases.filter(x=>Number(x.projectId)===nid).forEach(x=>out.push(['Purchase',x.description,`${x.vendor} • ${x.invoice||x.order||''}`,`openPurchaseDetail('${String(x.id).replace(/'/g,"\\'")}')`]));
    db.orders.filter(x=>Number(x.projectId)===nid).forEach(x=>out.push(['Order',x.item,x.status,`openOrderDetail(${x.id})`]));
    db.logs.filter(x=>arr(x.projectIds).includes(nid)).forEach(x=>out.push(['Work',x.work,x.date,`openLogDetail(${x.id})`]));
    db.docs.filter(x=>arr(x.linkedProjectIds).includes(nid)).forEach(x=>out.push(['Document',x.name,x.revision||x.type,`openDocumentDetail(${x.id})`]));
    db.squawks.filter(x=>Number(x.projectId)===nid).forEach(x=>out.push(['Squawk',x.title,x.status,`openSquawkDetail(${x.id})`]));
    db.runs.filter(x=>arr(x.projectIds).includes(nid)).forEach(x=>out.push(['Run / Test',`${x.date} • ${x.type}`,x.outcome,`openRunDetail(${x.id})`]));
    db.inspections.filter(x=>Number(x.projectId)===nid).forEach(x=>out.push(['Inspection',x.title,x.status,`openInspectionDetail('${String(x.id).replace(/'/g,"\\'")}')`]));
    db.flightCards.filter(x=>Number(x.projectId)===nid).forEach(x=>out.push(['Flight Card',x.title,x.status,`openFlightCardDetail('${String(x.id).replace(/'/g,"\\'")}')`]));
  }else if(type==='equipment'){
    const e=equipmentById(nid);if(!e)return out;
    if(e.purchaseId){const p=db.purchases.find(x=>String(x.id)===String(e.purchaseId));if(p)out.push(['Purchase',p.description,`${p.vendor} • ${p.invoice||p.order||''}`,`openPurchaseDetail('${String(p.id).replace(/'/g,"\\'")}')`])}
    db.docs.filter(d=>arr(d.linkedEquipmentIds).includes(nid)).forEach(d=>out.push(['Document',d.name,d.revision||d.docStatus,`openDocumentDetail(${d.id})`]));
    db.maintenance.filter(m=>Number(m.equipmentId)===nid).forEach(m=>out.push(['Maintenance',m.title,maintenanceDueInfo(m).reason,`openMaintenanceModal(${m.id})`]));
    db.specs.filter(s=>Number(s.equipmentId)===nid).forEach(s=>out.push(['Spec',s.title,`${s.value} ${s.units}`,`openSpecDetail('${String(s.id).replace(/'/g,"\\'")}')`]));
    db.configurations.filter(c=>arr(c.equipmentIds).includes(nid)).forEach(c=>out.push(['Configuration',c.name,c.status,"navTo('ops');setOpsTab('configuration')"]));
    arr(e.linkedProjectIds).map(projectById).filter(Boolean).forEach(p=>out.push(['Project',p.title,p.status,`openProjectDetail(${p.id})`]));
  }else if(type==='part'){
    const p=partById(nid);if(!p)return out;
    db.purchases.filter(x=>Number(x.inventoryPartId)===nid).forEach(x=>out.push(['Purchase',x.description,`${x.vendor} • ${x.invoice||x.order||''}`,`openPurchaseDetail('${String(x.id).replace(/'/g,"\\'")}')`]));
    db.projects.filter(pr=>arr(p.linkedProjectIds).includes(pr.id)||arr(pr.partsUsed).some(x=>Number(x.partId)===nid)).forEach(pr=>out.push(['Project',pr.title,pr.status,`openProjectDetail(${pr.id})`]));
    db.orders.filter(o=>Number(o.partId)===nid).forEach(o=>out.push(['Order',o.item,o.status,`openOrderDetail(${o.id})`]));
    db.logs.filter(l=>arr(l.consumedParts).some(x=>Number(x.partId)===nid)).forEach(l=>out.push(['Work',l.work,l.date,`openLogDetail(${l.id})`]));
    db.docs.filter(d=>arr(d.linkedPartIds).includes(nid)).forEach(d=>out.push(['Document',d.name,d.revision||d.type,`openDocumentDetail(${d.id})`]));
  }else if(type==='purchase'){
    const p=db.purchases.find(x=>String(x.id)===sid);if(!p)return out;
    db.equipment.filter(e=>String(e.purchaseId)===sid).forEach(e=>out.push(['Equipment',e.name,equipmentDisplayModel(e),`openEquipmentDetail(${e.id})`]));
    if(p.inventoryPartId){const part=partById(Number(p.inventoryPartId));if(part)out.push(['Part',part.name,part.partNo||'',`openPartDetail(${part.id})`])}
    if(p.projectId){const pr=projectById(Number(p.projectId));if(pr)out.push(['Project',pr.title,pr.status,`openProjectDetail(${pr.id})`])}
    if(p.invoice)out.push(['Invoice',String(p.invoice),p.vendor||'',`openInvoiceGroup('${String(p.invoice).replace(/'/g,"\\'")}')`]);
  }else if(type==='squawk'){
    const s=db.squawks.find(x=>Number(x.id)===nid);if(!s)return out;
    if(s.projectId){const p=projectById(Number(s.projectId));if(p)out.push(['Project',p.title,p.status,`openProjectDetail(${p.id})`])}
    if(s.sourceInspectionId){const i=db.inspections.find(x=>String(x.id)===String(s.sourceInspectionId));if(i)out.push(['Inspection',i.title,i.date,`openInspectionDetail('${String(i.id).replace(/'/g,"\\'")}')`])}
  }else if(type==='run'){
    const r=db.runs.find(x=>Number(x.id)===nid);if(!r)return out;
    arr(r.projectIds).map(projectById).filter(Boolean).forEach(p=>out.push(['Project',p.title,p.status,`openProjectDetail(${p.id})`]));
    db.flightCards.filter(f=>Number(f.runId)===nid).forEach(f=>out.push(['Flight Card',f.title,f.status,`openFlightCardDetail('${String(f.id).replace(/'/g,"\\'")}')`]));
  }else if(type==='document'){
    const d=docById(nid);if(!d)return out;
    arr(d.linkedEquipmentIds).map(equipmentById).filter(Boolean).forEach(e=>out.push(['Equipment',e.name,equipmentDisplayModel(e),`openEquipmentDetail(${e.id})`]));
    arr(d.linkedProjectIds).map(projectById).filter(Boolean).forEach(p=>out.push(['Project',p.title,p.status,`openProjectDetail(${p.id})`]));
    arr(d.linkedPartIds).map(partById).filter(Boolean).forEach(p=>out.push(['Part',p.name,p.partNo||'',`openPartDetail(${p.id})`]));
    db.specs.filter(s=>Number(s.documentId)===nid).forEach(s=>out.push(['Spec',s.title,`${s.value} ${s.units}`,`openSpecDetail('${String(s.id).replace(/'/g,"\\'")}')`]));
  }
  const seen=new Set();return out.filter(x=>{const k=x[0]+'|'+x[1]+'|'+x[3];if(seen.has(k))return false;seen.add(k);return true}).slice(0,40);
}
function appendRelatedPanel(type,id){const box=document.getElementById('modalBox');if(!box||box.querySelector('[data-related-panel]'))return;const items=relatedFor(type,id);const card=document.createElement('div');card.className='detail-card full related-panel';card.dataset.relatedPanel='1';card.innerHTML=`<div class="section-tools"><h3>Related</h3><span class="mini-badge">${items.length}</span></div>${items.length?`<div class="related-grid">${items.map(x=>relatedButton(...x)).join('')}</div>`:'<div class="empty">No related records linked yet.</div>'}`;box.appendChild(card)}

function appendProjectMediaStages(id){const box=document.getElementById('modalBox');if(!box||box.querySelector('[data-project-media-stages]'))return;const wrap=document.createElement('div');wrap.className='detail-card full';wrap.dataset.projectMediaStages='1';wrap.innerHTML=`<div class="section-tools"><h3>Before / During / After Photos</h3><span class="mini-badge">shared</span></div><div class="project-media-stages"><div><div class="section-tools"><b>Before</b><button class="icon-btn" onclick="chooseAttachments('project-before',${id})">+ Upload</button></div><div id="attachments-project-before-${id}"></div></div><div><div class="section-tools"><b>During</b><button class="icon-btn" onclick="chooseAttachments('project-during',${id})">+ Upload</button></div><div id="attachments-project-during-${id}"></div></div><div><div class="section-tools"><b>After</b><button class="icon-btn" onclick="chooseAttachments('project-after',${id})">+ Upload</button></div><div id="attachments-project-after-${id}"></div></div></div>`;box.appendChild(wrap);renderAttachments('project-before',id);renderAttachments('project-during',id);renderAttachments('project-after',id)}

// Add warranty / lifecycle notes to Equipment editing and persistence.
const openEquipmentModalLifecycleBase=openEquipmentModal;
openEquipmentModal=function(id=null,prefill=null){
  const existing=id?equipmentById(id):null,e=existing||prefill||{};openEquipmentModalLifecycleBase(id,prefill);const box=document.getElementById('modalBox'),notes=document.getElementById('eqNotes');if(!box||!notes||document.getElementById('eqWarranty'))return;const host=notes.closest('.full')||notes.parentElement;host?.insertAdjacentHTML('beforebegin',`${field('Warranty / support through','eqWarranty',e.warrantyUntil||'','date')}${textareaField('Lifecycle / replacement notes','eqLifecycle',e.lifecycleNotes||'')}`);
};
const saveEquipmentLifecycleBase=saveEquipment;
saveEquipment=function(id,purchaseId=''){
  const warranty=val('eqWarranty'),lifecycle=val('eqLifecycle');saveEquipmentLifecycleBase(id,purchaseId);const e=id?equipmentById(id):db.equipment[db.equipment.length-1];if(e){e.warrantyUntil=warranty;e.lifecycleNotes=lifecycle;saveDB('Equipment record saved.');}
};

function appendEquipmentLifecycleCard(id){const e=equipmentById(id),box=document.getElementById('modalBox');if(!e||!box||box.querySelector('[data-equipment-lifecycle]'))return;const linked=db.maintenance.filter(m=>Number(m.equipmentId)===Number(id));const card=document.createElement('div');card.className='detail-card full';card.dataset.equipmentLifecycle='1';card.innerHTML=`<div class="section-tools"><h3>Lifecycle / Recurring Maintenance</h3><button class="primary" onclick="openMaintenanceForEquipment(${e.id})">+ Maintenance Item</button></div><div class="kv"><span>Warranty / support through</span><b>${esc(e.warrantyUntil||'Not recorded')}</b></div><div class="detail-section"><label>Lifecycle / replacement notes</label><div class="detail-text">${esc(e.lifecycleNotes||'No lifecycle notes yet.')}</div></div>${linked.length?`<div class="table-wrap"><table><thead><tr><th>Maintenance item</th><th>Next due</th><th>Status</th></tr></thead><tbody>${linked.map(m=>{const d=maintenanceDueInfo(m);return `<tr class="click-row" onclick="openMaintenanceModal(${m.id})"><td>${esc(m.title)}</td><td>${esc(d.reason||'Not set')}</td><td>${pill(d.status)}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="empty">No equipment-specific recurring maintenance items yet.</div>'}`;box.appendChild(card)}

// Wrap detail views after all v5 feature modules are loaded.
const openProjectDetailRelatedBase=openProjectDetail;
openProjectDetail=function(id){openProjectDetailRelatedBase(id);appendProjectMediaStages(id);appendRelatedPanel('project',id)};
const openPartDetailRelatedBase=openPartDetail;
openPartDetail=function(id){openPartDetailRelatedBase(id);const p=partById(id),box=document.getElementById('modalBox');if(p&&box&&!box.querySelector('[data-part-type]')){const card=[...box.querySelectorAll('.detail-card')].find(c=>/Part Record/i.test(c.querySelector('h3')?.textContent||''));card?.insertAdjacentHTML('beforeend',`<div class="kv" data-part-type><span>Part type</span><b>${esc(p.partType||'Inventory')}</b></div>`)}appendRelatedPanel('part',id)};
const openPurchaseDetailRelatedBase=openPurchaseDetail;
openPurchaseDetail=function(id){openPurchaseDetailRelatedBase(id);appendRelatedPanel('purchase',id)};
const openSquawkDetailRelatedBase=openSquawkDetail;
openSquawkDetail=function(id){openSquawkDetailRelatedBase(id);appendRelatedPanel('squawk',id)};
const openRunDetailRelatedBase=openRunDetail;
openRunDetail=function(id){openRunDetailRelatedBase(id);appendRelatedPanel('run',id)};
const openDocumentDetailRelatedBase=openDocumentDetail;
openDocumentDetail=function(id){openDocumentDetailRelatedBase(id);appendRelatedPanel('document',id)};
const openEquipmentDetailRelatedBase=openEquipmentDetail;
openEquipmentDetail=async function(id){await openEquipmentDetailRelatedBase(id);appendEquipmentLifecycleCard(id);appendRelatedPanel('equipment',id)};

const reopenDetailV5Base=typeof reopenDetail==='function'?reopenDetail:null;
reopenDetail=function(type,id){
  if(type==='inspection')return openInspectionDetail(String(id));
  if(type==='spec')return openSpecDetail(String(id));
  if(type==='flightcard')return openFlightCardDetail(String(id));
  if(type==='project-before'||type==='project-during'||type==='project-after')return openProjectDetail(Number(id));
  if(reopenDetailV5Base)return reopenDetailV5Base(type,id);
};
